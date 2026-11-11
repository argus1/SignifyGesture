import AVFoundation
import Foundation
import Speech

enum SpeechCaptionState: String {
    case idle
    case preparing
    case listening
    case paused
    case denied
    case restricted
    case unavailable
    case error
}

enum SpeechCaptionPermission: Equatable {
    case granted
    case undetermined
    case denied
    case restricted
}

/// Live captions of the hearing person's speech: microphone → Apple speech recognition → caption text.
///
/// Public API is main-thread only. Audio buffers are handled on the render thread through `TapState`.
final class LiveSpeechTranscriptionService {
    var onStatusChange: ((SpeechCaptionState, String?, Bool?) -> Void)?
    var onTranscript: ((String, Bool) -> Void)?
    var onAudioLevel: ((Float) -> Void)?

    /// Silence after the last result that ends one caption bubble.
    static let utteranceSilenceInterval: TimeInterval = 1.4
    /// Keep the mic muted briefly after TTS ends so room echo isn't captioned.
    static let playbackTailInterval: TimeInterval = 0.35

    private let audioSession: SpeechAudioSession
    private let engine = AVAudioEngine()
    private let tapState = TapState()
    private var backend: SpeechTranscriptionBackend?
    private var assembler = UtteranceAssembler()
    private var generation = 0
    private var silenceTimer: Timer?
    private var commitFallbackTimer: Timer?
    private var pendingCommit = false
    private var suppressionGeneration = 0
    private var observers: [NSObjectProtocol] = []

    /// The user wants captions on; survives interruptions and backgrounding.
    private(set) var isWanted = false
    private(set) var isRunning = false
    private var isSuspended = false
    private var isSuppressed = false

    init(audioSession: SpeechAudioSession = .shared) {
        self.audioSession = audioSession
        let center = NotificationCenter.default
        observers.append(center.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            self?.handleInterruption(note)
        })
        observers.append(center.addObserver(
            forName: .AVAudioEngineConfigurationChange,
            object: engine,
            queue: .main
        ) { [weak self] _ in
            self?.restartAfterRouteChange()
        })
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
    }

    // MARK: Permissions

    static var permission: SpeechCaptionPermission {
        let speech = SFSpeechRecognizer.authorizationStatus()
        switch (AVAudioApplication.shared.recordPermission, speech) {
        case (.denied, _), (_, .denied):
            return .denied
        case (_, .restricted):
            return .restricted
        case (.undetermined, _), (_, .notDetermined):
            return .undetermined
        default:
            return .granted
        }
    }

    /// Asks for microphone, then speech recognition access. Completes on the main thread.
    static func requestPermission(completion: @escaping (SpeechCaptionPermission) -> Void) {
        AVAudioApplication.requestRecordPermission { granted in
            guard granted else {
                DispatchQueue.main.async { completion(.denied) }
                return
            }
            SFSpeechRecognizer.requestAuthorization { _ in
                DispatchQueue.main.async { completion(permission) }
            }
        }
    }

    // MARK: Lifecycle

    func start() {
        isWanted = true
        guard !isRunning, !isSuspended else { return }
        startEngine()
    }

    func stop() {
        isWanted = false
        isSuspended = false
        teardown()
        onStatusChange?(.idle, nil, nil)
    }

    /// App went to the background: release the mic but remember the user's choice.
    func suspend(reason: String) {
        guard isWanted, !isSuspended else { return }
        isSuspended = true
        teardown()
        onStatusChange?(.paused, reason, nil)
    }

    func resume() {
        guard isSuspended else { return }
        isSuspended = false
        if isWanted { startEngine() }
    }

    /// Mute recognition while the app itself is speaking so TTS is never captioned as the other person.
    func setPlaybackActive(_ active: Bool) {
        suppressionGeneration += 1
        if active {
            isSuppressed = true
            tapState.setSuppressed(true)
            guard isRunning else { return }
            finishUtterance()
            onAudioLevel?(0)
            onStatusChange?(.paused, "Captions pause while your message is spoken.", backend?.isOnDevice)
        } else {
            let token = suppressionGeneration
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.playbackTailInterval) { [weak self] in
                guard let self, token == self.suppressionGeneration else { return }
                self.isSuppressed = false
                self.tapState.setSuppressed(false)
                if self.isRunning {
                    self.onStatusChange?(.listening, nil, self.backend?.isOnDevice)
                }
            }
        }
    }

    private func startEngine() {
        generation += 1
        let token = generation
        isRunning = true
        onStatusChange?(.preparing, nil, nil)

        do {
            try audioSession.beginListening()
        } catch {
            fail(.error, message: "Couldn't start the microphone. \(error.localizedDescription)")
            return
        }

        let inputFormat = engine.inputNode.outputFormat(forBus: 0)
        guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0 else {
            fail(.unavailable, message: SpeechTranscriptionError.microphoneUnavailable.localizedDescription)
            return
        }

        let candidates = makeBackends()
        guard !candidates.isEmpty else {
            fail(.unavailable, message: SpeechTranscriptionError.recognizerUnavailable.localizedDescription)
            return
        }

        Task { @MainActor [weak self] in
            var lastError: Error?
            for candidate in candidates {
                guard let self, token == self.generation else {
                    candidate.stop()
                    return
                }
                do {
                    try await candidate.prepare(
                        inputFormat: inputFormat,
                        onResult: { [weak self] text, isFinal in
                            DispatchQueue.main.async { self?.handleResult(text: text, isFinal: isFinal, token: token) }
                        },
                        onError: { [weak self] error in
                            DispatchQueue.main.async { self?.handleBackendError(error, token: token) }
                        },
                        onProgress: { [weak self] message in
                            DispatchQueue.main.async {
                                guard let self, token == self.generation else { return }
                                self.onStatusChange?(.preparing, message, nil)
                            }
                        }
                    )
                    guard token == self.generation else {
                        candidate.stop()
                        return
                    }
                    self.backend = candidate
                    self.installTapAndStart(backend: candidate, format: inputFormat, token: token)
                    return
                } catch {
                    candidate.stop()
                    lastError = error
                }
            }
            guard let self, token == self.generation else { return }
            self.fail(
                .unavailable,
                message: lastError?.localizedDescription ?? SpeechTranscriptionError.recognizerUnavailable.localizedDescription
            )
        }
    }

    private func makeBackends() -> [SpeechTranscriptionBackend] {
        let locale = Locale.current
        var backends: [SpeechTranscriptionBackend] = []
        if #available(iOS 26.0, *), AnalyzerTranscriptionBackend.isAvailable {
            backends.append(AnalyzerTranscriptionBackend(locale: locale))
        }
        if let recognizer = RecognizerTranscriptionBackend(locale: locale) {
            backends.append(recognizer)
        }
        return backends
    }

    private func installTapAndStart(backend: SpeechTranscriptionBackend, format: AVAudioFormat, token: Int) {
        tapState.configure(backend: backend, suppressed: isSuppressed) { [weak self] level in
            DispatchQueue.main.async {
                guard let self, token == self.generation, !self.isSuppressed else { return }
                self.onAudioLevel?(level)
            }
        }
        let input = engine.inputNode
        input.removeTap(onBus: 0)
        let tapState = self.tapState
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            tapState.handle(buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            fail(.error, message: "Couldn't start the microphone. \(error.localizedDescription)")
            return
        }
        if isSuppressed {
            onStatusChange?(.paused, "Captions pause while your message is spoken.", backend.isOnDevice)
        } else {
            onStatusChange?(.listening, nil, backend.isOnDevice)
        }
    }

    private func teardown() {
        generation += 1
        silenceTimer?.invalidate()
        commitFallbackTimer?.invalidate()
        if isRunning {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
            tapState.clear()
            backend?.stop()
            backend = nil
            commitNow()
            audioSession.endListening()
            onAudioLevel?(0)
        }
        assembler.reset()
        pendingCommit = false
        isRunning = false
    }

    private func fail(_ state: SpeechCaptionState, message: String) {
        teardown()
        isWanted = false
        onStatusChange?(state, message, nil)
    }

    private func restartAfterRouteChange() {
        guard isRunning else { return }
        teardown()
        if isWanted, !isSuspended { startEngine() }
    }

    private func handleInterruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        switch type {
        case .began:
            suspend(reason: "Captions paused by a call or another app.")
        case .ended:
            resume()
        @unknown default:
            break
        }
    }

    // MARK: Results → captions

    private func handleResult(text: String, isFinal: Bool, token: Int) {
        guard token == generation, isRunning else { return }
        let display = assembler.apply(text: text, isFinal: isFinal)
        if pendingCommit, !assembler.hasVolatileText {
            commitNow()
            return
        }
        if !display.isEmpty {
            onTranscript?(display, false)
        }
        scheduleSilenceTimer()
    }

    private func handleBackendError(_ error: Error, token: Int) {
        guard token == generation else { return }
        fail(.error, message: "Live captions stopped. \(error.localizedDescription)")
    }

    private func scheduleSilenceTimer() {
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: Self.utteranceSilenceInterval, repeats: false) { [weak self] _ in
            self?.finishUtterance()
        }
    }

    /// The speaker paused: flush volatile text through the recognizer, then emit one final caption.
    private func finishUtterance() {
        silenceTimer?.invalidate()
        guard !assembler.isEmpty else { return }
        guard assembler.hasVolatileText, let backend else {
            commitNow()
            return
        }
        pendingCommit = true
        backend.endUtterance()
        commitFallbackTimer?.invalidate()
        commitFallbackTimer = Timer.scheduledTimer(withTimeInterval: 1.2, repeats: false) { [weak self] _ in
            self?.commitNow()
        }
    }

    private func commitNow() {
        pendingCommit = false
        silenceTimer?.invalidate()
        commitFallbackTimer?.invalidate()
        if let text = assembler.commit() {
            onTranscript?(text, true)
        }
    }
}

/// State shared with the audio render thread.
private final class TapState: @unchecked Sendable {
    private let lock = NSLock()
    private var backend: SpeechTranscriptionBackend?
    private var suppressed = false
    private var levelHandler: ((Float) -> Void)?
    private var lastLevelTime: TimeInterval = 0
    private static let levelInterval: TimeInterval = 1.0 / 15

    func configure(backend: SpeechTranscriptionBackend, suppressed: Bool, levelHandler: @escaping (Float) -> Void) {
        lock.lock()
        self.backend = backend
        self.suppressed = suppressed
        self.levelHandler = levelHandler
        lock.unlock()
    }

    func setSuppressed(_ value: Bool) {
        lock.lock()
        suppressed = value
        lock.unlock()
    }

    func clear() {
        lock.lock()
        backend = nil
        levelHandler = nil
        lock.unlock()
    }

    func handle(_ buffer: AVAudioPCMBuffer) {
        lock.lock()
        let backend = backend
        let suppressed = suppressed
        let levelHandler = levelHandler
        let now = ProcessInfo.processInfo.systemUptime
        let emitLevel = now - lastLevelTime >= Self.levelInterval
        if emitLevel { lastLevelTime = now }
        lock.unlock()

        guard !suppressed, let backend else { return }
        backend.append(buffer)
        if emitLevel {
            levelHandler?(AudioLevelMeter.normalizedLevel(of: buffer))
        }
    }
}
