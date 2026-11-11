import AVFoundation
import Foundation
import Speech

/// A recognizer that turns microphone buffers into (text, isFinal) results.
protocol SpeechTranscriptionBackend: AnyObject {
    /// True when audio never leaves the device.
    var isOnDevice: Bool { get }
    func prepare(
        inputFormat: AVAudioFormat,
        onResult: @escaping (String, Bool) -> Void,
        onError: @escaping (Error) -> Void,
        onProgress: @escaping (String) -> Void
    ) async throws
    /// Called on the audio render thread.
    func append(_ buffer: AVAudioPCMBuffer)
    /// Finalize everything heard so far (the speaker paused).
    func endUtterance()
    func stop()
}

enum SpeechTranscriptionError: LocalizedError {
    case unsupportedLocale
    case recognizerUnavailable
    case microphoneUnavailable

    var errorDescription: String? {
        switch self {
        case .unsupportedLocale:
            return "Live captions don't support this device's language yet."
        case .recognizerUnavailable:
            return "Speech recognition is unavailable right now. Check your connection or try again later."
        case .microphoneUnavailable:
            return "No microphone is available on this device."
        }
    }
}

// MARK: - iOS 26+: SpeechAnalyzer + SpeechTranscriber (fully on device)

@available(iOS 26.0, *)
final class AnalyzerTranscriptionBackend: SpeechTranscriptionBackend, @unchecked Sendable {
    let isOnDevice = true
    private let locale: Locale
    private var analyzer: SpeechAnalyzer?
    private var continuation: AsyncStream<AnalyzerInput>.Continuation?
    private var resultsTask: Task<Void, Never>?
    // Read on the audio thread after prepare() completes; never mutated afterwards.
    private var converter: AVAudioConverter?
    private var analyzerFormat: AVAudioFormat?

    init(locale: Locale) {
        self.locale = locale
    }

    static var isAvailable: Bool { SpeechTranscriber.isAvailable }

    func prepare(
        inputFormat: AVAudioFormat,
        onResult: @escaping (String, Bool) -> Void,
        onError: @escaping (Error) -> Void,
        onProgress: @escaping (String) -> Void
    ) async throws {
        guard let supportedLocale = await SpeechTranscriber.supportedLocale(equivalentTo: locale) else {
            throw SpeechTranscriptionError.unsupportedLocale
        }
        let transcriber = SpeechTranscriber(locale: supportedLocale, preset: .progressiveTranscription)
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            onProgress("Downloading the on-device speech model…")
            try await request.downloadAndInstall()
        }

        let analyzer = SpeechAnalyzer(modules: [transcriber])
        let format = await SpeechAnalyzer.bestAvailableAudioFormat(
            compatibleWith: [transcriber],
            considering: inputFormat
        ) ?? inputFormat
        try await analyzer.prepareToAnalyze(in: format)
        if format != inputFormat {
            converter = AVAudioConverter(from: inputFormat, to: format)
            converter?.primeMethod = .none
        }
        analyzerFormat = format

        let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream(bufferingPolicy: .bufferingNewest(64))
        self.continuation = continuation
        self.analyzer = analyzer
        resultsTask = Task {
            do {
                for try await result in transcriber.results {
                    onResult(String(result.text.characters), result.isFinal)
                }
            } catch is CancellationError {
            } catch {
                onError(error)
            }
        }
        try await analyzer.start(inputSequence: stream)
    }

    func append(_ buffer: AVAudioPCMBuffer) {
        guard let continuation else { return }
        if let converted = convert(buffer) {
            continuation.yield(AnalyzerInput(buffer: converted))
        }
    }

    func endUtterance() {
        guard let analyzer else { return }
        Task { try? await analyzer.finalize(through: nil) }
    }

    func stop() {
        continuation?.finish()
        continuation = nil
        resultsTask?.cancel()
        resultsTask = nil
        if let analyzer {
            Task { await analyzer.cancelAndFinishNow() }
        }
        analyzer = nil
    }

    private func convert(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
        guard let converter, let analyzerFormat else { return buffer }
        let ratio = analyzerFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up)) + 1
        guard let output = AVAudioPCMBuffer(pcmFormat: analyzerFormat, frameCapacity: capacity) else { return nil }
        var consumed = false
        var error: NSError?
        let status = converter.convert(to: output, error: &error) { _, inputStatus in
            if consumed {
                inputStatus.pointee = .noDataNow
                return nil
            }
            consumed = true
            inputStatus.pointee = .haveData
            return buffer
        }
        return status == .error || error != nil ? nil : output
    }
}

// MARK: - iOS 17–25 fallback: SFSpeechRecognizer (on device when the model is installed)

final class RecognizerTranscriptionBackend: SpeechTranscriptionBackend, @unchecked Sendable {
    private let recognizer: SFSpeechRecognizer
    private let lock = NSLock()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var onResult: ((String, Bool) -> Void)?
    private var onError: ((Error) -> Void)?

    init?(locale: Locale) {
        guard let recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US")) else {
            return nil
        }
        self.recognizer = recognizer
    }

    var isOnDevice: Bool { recognizer.supportsOnDeviceRecognition }

    func prepare(
        inputFormat: AVAudioFormat,
        onResult: @escaping (String, Bool) -> Void,
        onError: @escaping (Error) -> Void,
        onProgress: @escaping (String) -> Void
    ) async throws {
        guard recognizer.isAvailable else { throw SpeechTranscriptionError.recognizerUnavailable }
        lock.lock()
        self.onResult = onResult
        self.onError = onError
        lock.unlock()
        startNewTask()
    }

    func append(_ buffer: AVAudioPCMBuffer) {
        lock.lock()
        let request = request
        lock.unlock()
        request?.append(buffer)
    }

    /// Hands the finished utterance's request off to finish on its own while new audio goes to a fresh request.
    func endUtterance() {
        lock.lock()
        let finished = request
        lock.unlock()
        startNewTask()
        finished?.endAudio()
    }

    func stop() {
        lock.lock()
        let task = task
        self.task = nil
        request = nil
        onResult = nil
        onError = nil
        lock.unlock()
        task?.cancel()
    }

    private func startNewTask() {
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        request.taskHint = .dictation
        // Prefer on-device; server recognition is only used when no local model exists.
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition

        lock.lock()
        self.request = request
        lock.unlock()

        let task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            self.lock.lock()
            let onResult = self.onResult
            let onError = self.onError
            let isCurrent = self.request === request
            self.lock.unlock()

            if let result {
                onResult?(result.bestTranscription.formattedString, result.isFinal)
                // Server recognition caps task length; keep listening with a fresh request.
                if result.isFinal, isCurrent { self.startNewTask() }
            } else if let error, isCurrent {
                if Self.isBenign(error) {
                    self.startNewTask()
                } else {
                    onError?(error)
                }
            }
        }
        lock.lock()
        if self.request === request {
            self.task = task
        }
        lock.unlock()
    }

    /// "No speech detected" and cancellation are normal at utterance boundaries.
    private static func isBenign(_ error: Error) -> Bool {
        let error = error as NSError
        return error.domain == "kAFAssistantErrorDomain" && [203, 216, 301, 1110].contains(error.code)
    }
}
