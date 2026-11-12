import AVFoundation
import Combine
import Foundation
import QuartzCore
import UIKit
import WebKit
import OSLog

enum CameraPermissionPrompt: String, Identifiable {
    case rationale
    case denied
    case restricted
    case unavailable

    var id: String { rawValue }

    var title: String {
        switch self {
        case .rationale:
            return "Camera access"
        case .denied:
            return "Camera access is off"
        case .restricted:
            return "Camera access is restricted"
        case .unavailable:
            return "Camera unavailable"
        }
    }

    var message: String {
        switch self {
        case .rationale:
            return "The front camera shows your preview and processes hand poses on this device. Video is not saved or sent to the web UI. Continue to the iOS permission prompt?"
        case .denied:
            return "Allow camera access in Settings to use the live preview and hand-pose tracking."
        case .restricted:
            return "Camera access is restricted by this device's settings. Change the restriction before trying again."
        case .unavailable:
            return "This device does not have an available front-facing camera."
        }
    }
}

enum MicrophonePermissionPrompt: String, Identifiable {
    case rationale
    case denied
    case restricted

    var id: String { rawValue }

    var title: String {
        switch self {
        case .rationale:
            return "Live captions"
        case .denied:
            return "Microphone or speech access is off"
        case .restricted:
            return "Speech recognition is restricted"
        }
    }

    var message: String {
        switch self {
        case .rationale:
            return "Signify listens to the person you're talking with and shows their words as captions. Speech is transcribed on this device when possible, and audio is not saved. Continue to the iOS permission prompts?"
        case .denied:
            return "Allow microphone and speech recognition in Settings to see live captions. You can still type and use spoken playback."
        case .restricted:
            return "Speech recognition is restricted by this device's settings. You can still type and use spoken playback."
        }
    }
}

enum NativePermissionPrompt: Equatable, Identifiable {
    case camera(CameraPermissionPrompt)
    case microphone(MicrophonePermissionPrompt)

    var id: String {
        switch self {
        case .camera(let prompt): return "camera-\(prompt.id)"
        case .microphone(let prompt): return "microphone-\(prompt.id)"
        }
    }
}

final class NativeBridgeCoordinator: NSObject, ObservableObject {
    private static let permissionLogger = Logger(subsystem: "com.argussun.signifygesture", category: "permissions")
    static let webBridgeBootstrap = """
    (() => {
      const bridge = window.NativeASLBridge = window.NativeASLBridge || {};
      const post = (type, payload) => window.webkit.messageHandlers.aslBridge.postMessage({ type, ...payload });
      bridge.triggerCameraToggle = bridge.triggerCameraToggle || ((active) => post("triggerCameraToggle", { active }));
      bridge.openPrivacyAndAccount = bridge.openPrivacyAndAccount || (() => post("openPrivacyAndAccount", {}));
      bridge.triggerSpeechRecognition = bridge.triggerSpeechRecognition || ((active) => post("triggerSpeechRecognition", { active }));
      bridge.triggerTTSPlayback = bridge.triggerTTSPlayback || ((text, voiceId) => post("triggerTTSPlayback", { text, voiceId }));
      bridge.stopTTSPlayback = bridge.stopTTSPlayback || (() => post("stopTTSPlayback", {}));
      bridge.triggerAvatarReplay = bridge.triggerAvatarReplay || ((glossSequence) => post("triggerAvatarReplay", { glossSequence }));
      bridge.syncSessionToAWS = bridge.syncSessionToAWS || ((sessionData) => post("syncSessionToAWS", { sessionData }));
    })();
    """

    let camera = CameraCaptureService()
    let captureConsent = CaptureConsentState()
    @MainActor lazy var cognitoAuth = CognitoAuthService()
    @Published var showsPrivacyAndAccount = false
    #if DEBUG
    let trialRecorder = DebugTrialRecorder()
    #endif
    private let speech = NativeSpeechService()
    private let transcription = LiveSpeechTranscriptionService()
    private let classifier: any SignInferenceProvider = CoreMLSignClassifier()
    private let avatarRuntime: AvatarRuntime = UnavailableAvatarRuntime()
    private weak var webView: WKWebView?
    private let memoryQueue = DispatchQueue(label: "com.argussun.signifygesture.memory", qos: .userInitiated)
    private var memoryStore: ConversationMemory?
    private var navigationGeneration = 0

    private let inferenceStateQueue = DispatchQueue(
        label: "com.argussun.signifygesture.inference-state",
        qos: .userInitiated
    )
    private static let validatedConfidenceThreshold: Double? = nil

    @Published private(set) var cameraActive = false
    @Published private(set) var cameraStarting = false
    @Published private(set) var cameraPermissionPrompt: CameraPermissionPrompt?
    @Published private(set) var microphonePermissionPrompt: MicrophonePermissionPrompt?

    var permissionPrompt: NativePermissionPrompt? {
        if let cameraPermissionPrompt { return .camera(cameraPermissionPrompt) }
        if let microphonePermissionPrompt { return .microphone(microphonePermissionPrompt) }
        return nil
    }

    func clearPermissionPrompt(_ prompt: NativePermissionPrompt) {
        switch prompt {
        case .camera(let value) where cameraPermissionPrompt == value:
            clearCameraPermissionPrompt()
        case .microphone(let value) where microphonePermissionPrompt == value:
            clearMicrophonePermissionPrompt()
        default: break
        }
    }

    private var speechCaptionsPending = false
    private var frontendLoadFailed = false
    private var recentFrames: [[Float]] = []
    private var recentFrameTimes: [TimeInterval] = []
    private var lastPublishedGloss: String?
    private var predictionInFlight = false
    private var inferenceGeneration = 0
    private var cameraOperationGeneration = 0
    private var cameraActivationPending = false

    override init() {
        super.init()
        #if DEBUG
        captureConsent.onWithdraw = { [weak self] in
            try self?.trialRecorder.clear()
        }
        #endif
        captureConsent.onChange = { [weak self] granted in
            self?.emit(method: "onCaptureConsentChange", payload: ["consentGranted": granted])
        }
        camera.onTrackingStateChange = { [weak self] state in
            guard let self else { return }
            self.emitEngineStatus(trackingState: state.rawValue)
            if state == .lost {
                self.resetInferenceState()
                #if DEBUG
                DispatchQueue.main.async {
                    self.trialRecorder.interrupt("Hand tracking lost. Active trial discarded; please retry.")
                }
                #endif
            }
        }
        camera.onPoseFrame = { [weak self] frame in
            self?.consume(frame: frame)
            #if DEBUG
            DispatchQueue.main.async { [weak self] in
                self?.trialRecorder.append(frame)
            }
            #endif
        }
        camera.onError = { [weak self] message in
            self?.emit(method: "onNativeError", payload: ["feature": "camera", "message": message])
        }
        speech.setPlaybackStateChangeHandler { [weak self] isPlaying in
            self?.transcription.setPlaybackActive(isPlaying)
            self?.emit(method: "onTTSPlaybackState", payload: isPlaying)
        }
        speech.setErrorHandler { [weak self] message in
            self?.emit(method: "onNativeError", payload: ["feature": "tts", "message": message])
        }
        speech.setProgressHandler { [weak self] progress in
            self?.emit(
                method: "onTTSProgress",
                payload: ["text": progress.text, "location": progress.location, "length": progress.length]
            )
        }
        transcription.onStatusChange = { [weak self] state, message, onDevice in
            var payload: [String: Any] = ["state": state.rawValue]
            if let message { payload["message"] = message }
            if let onDevice { payload["onDevice"] = onDevice }
            self?.emit(method: "onSpeechRecognitionStatusChange", payload: payload)
        }
        transcription.onTranscript = { [weak self] text, isFinal in
            self?.emit(method: "onSpeechTranscribed", payload: ["text": text, "isFinal": isFinal])
        }
        transcription.onAudioLevel = { [weak self] level in
            let rounded = (Double(level) * 100).rounded() / 100
            self?.emit(method: "onAudioLevel", payload: ["source": "mic", "level": rounded])
        }
    }

    func attach(webView: WKWebView) {
        self.webView = webView
        guard webView.url == nil else { return }
        loadFrontend()
    }

    private func loadFrontend() {
        if let urlString = Bundle.main.object(forInfoDictionaryKey: "SIGNIFY_FRONTEND_URL") as? String,
           let url = validatedFrontendURL(urlString) {
            frontendLoadFailed = false
            webView?.load(URLRequest(url: url))
        } else {
            showFrontendLoadError("The frontend URL is not configured in this app build.")
        }
    }

    func frontendLoadDidFail(_ error: Error) {
        let error = error as NSError
        guard error.domain != NSURLErrorDomain || error.code != NSURLErrorCancelled else { return }
        guard !frontendLoadFailed else { return }
        showFrontendLoadError(error.localizedDescription)
    }

    func frontendLoadDidFinish(_ webView: WKWebView) {
        guard let scheme = webView.url?.scheme?.lowercased(),
              scheme == "http" || scheme == "https" else { return }
        frontendLoadFailed = false
    }

    private func showFrontendLoadError(_ message: String) {
        frontendLoadFailed = true
        let safeMessage = Self.escapeHTML(message)
        webView?.loadHTMLString(
            """
            <!doctype html>
            <html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Signify connection issue</title>
            <style>
              body { box-sizing: border-box; margin: 0; min-height: 100vh; display: grid; place-items: center;
                padding: 32px; background: #101914; color: #f5f7f5;
                font: 17px -apple-system, BlinkMacSystemFont, sans-serif; }
              main { width: min(100%, 480px); } h1 { font-size: 26px; }
              p { color: #c6d0ca; line-height: 1.5; overflow-wrap: anywhere; }
              button { margin-top: 16px; border: 0; border-radius: 24px; padding: 14px 24px;
                background: #7cf0bf; color: #10251b; font: inherit; font-weight: 700; }
            </style></head>
            <body><main><h1>Can't connect to Signify</h1>
            <p>The app opened, but couldn't load its web interface. Make sure the development server is running
            and your iPad can reach the Mac, then try again.</p>
            <p id="load-error">\(safeMessage)</p>
            <button type="button" onclick="window.webkit.messageHandlers.aslBridge.postMessage({type:'reloadFrontend'})">Retry</button>
            </main></body></html>
            """,
            baseURL: nil
        )
    }

    private static func escapeHTML(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
    }

    private func validatedFrontendURL(_ value: String) -> URL? {
        guard let url = URL(string: value),
              let scheme = url.scheme?.lowercased(),
              ["https", "http"].contains(scheme),
              url.host != nil else {
            return nil
        }
        return url
    }

    private func consume(frame: LandmarkFrame) {
        guard classifier.availabilityError == nil,
              Self.validatedConfidenceThreshold != nil else { return }

        let frameReceivedAt = ProcessInfo.processInfo.systemUptime
        inferenceStateQueue.async { [weak self] in
            guard let self else { return }

            self.recentFrames.append(frame.values)
            self.recentFrameTimes.append(frameReceivedAt)
            if self.recentFrames.count > 16 {
                let excessCount = self.recentFrames.count - 16
                self.recentFrames.removeFirst(excessCount)
                self.recentFrameTimes.removeFirst(excessCount)
            }
            guard self.recentFrames.count == 16, !self.predictionInFlight else { return }

            self.predictionInFlight = true
            let generation = self.inferenceGeneration
            let sequence = self.recentFrames.flatMap { $0 }
            let sequenceStartedAt = self.recentFrameTimes[0]
            self.classifier.predict(sequence: sequence) { [weak self] result in
                guard let self else { return }
                let latencyMs = max(0, (ProcessInfo.processInfo.systemUptime - sequenceStartedAt) * 1_000)
                self.inferenceStateQueue.async {
                    guard generation == self.inferenceGeneration else { return }
                    self.predictionInFlight = false
                    self.handlePrediction(result, latencyMs: latencyMs)
                }
            }
        }
    }

    private func resetInferenceState() {
        inferenceStateQueue.sync {
            inferenceGeneration += 1
            recentFrames.removeAll(keepingCapacity: true)
            recentFrameTimes.removeAll(keepingCapacity: true)
            lastPublishedGloss = nil
            predictionInFlight = false
        }
    }

    private func handlePrediction(_ result: Result<SignPrediction, Error>, latencyMs: Double) {
        DispatchQueue.main.async { [weak self] in
            self?.emitEngineStatus(trackingState: "tracking", inferenceLatencyMs: latencyMs)
        }
        switch result {
        case .success(let prediction):
            guard let threshold = Self.validatedConfidenceThreshold,
                  prediction.confidence >= threshold else {
                emitRecognitionState(
                    "noResult",
                    message: "The validation-set confidence threshold has not been established.",
                    latencyMs: latencyMs
                )
                return
            }
            guard Self.supportedGlosses.contains(prediction.gloss) else {
                emitRecognitionState("unsupportedGloss", latencyMs: latencyMs)
                return
            }
            guard lastPublishedGloss != prediction.gloss else { return }
            lastPublishedGloss = prediction.gloss
            emit(
                method: "onSignDetected",
                payload: [
                    "gloss": prediction.gloss,
                    "confidence": prediction.confidence,
                    "isFinal": false,
                    "timestamp": Date().timeIntervalSince1970,
                    "latencyMs": latencyMs
                ]
            )
        case .failure(let error):
            emitRecognitionState("noResult", message: error.localizedDescription, latencyMs: latencyMs)
        }
    }

    private static let supportedGlosses: Set<String> = [
        "RESEARCH1", "DEVELOP1", "CLOUD1", "EDIT1", "DECIDE1"
    ]

    private func emitEngineStatus(trackingState: String, inferenceLatencyMs: Double = 0) {
        emit(
            method: "onEngineStatusChange",
            payload: [
                "cameraActive": cameraActive,
                "trackingState": trackingState,
                "inferenceLatencyMs": inferenceLatencyMs
            ]
        )
    }

    private func emitRecognitionState(_ state: String, message: String? = nil, latencyMs: Double? = nil) {
        var payload: [String: Any] = ["state": state]
        if let message { payload["message"] = message }
        if let latencyMs { payload["latencyMs"] = latencyMs }
        emit(method: "onRecognitionStatusChange", payload: payload)
    }

    private func emit(method: String, payload: Any, memoryGeneration: Int? = nil) {
        guard JSONSerialization.isValidJSONObject([payload]),
              let data = try? JSONSerialization.data(withJSONObject: [payload]),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        let fragment = String(json.dropFirst().dropLast())
        let script = "window.NativeASLBridge && window.NativeASLBridge.\(method) && window.NativeASLBridge.\(method)(\(fragment));"
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if let memoryGeneration {
                guard self.navigationGeneration == memoryGeneration,
                      Self.trustsMemoryOrigin(frontend: self.memoryFrontendURL, source: self.webView?.url,
                                              isMainFrame: true) else { return }
            }
            self.webView?.evaluateJavaScript(script)
        }
    }

    func requestCameraActivation() {
        Self.permissionLogger.info("camera_activation_requested authorization=\(self.camera.authorizationStatus.rawValue) active=\(self.cameraActive) starting=\(self.cameraStarting)")
        if cameraActive {
            cameraActivationPending = false
            return
        }
        if cameraStarting {
            return
        }
        #if DEBUG && targetEnvironment(simulator)
        startMockCamera()
        return
        #endif

        switch camera.authorizationStatus {
        case .authorized:
            cameraActivationPending = true
            startCameraCapture()
        case .notDetermined:
            cameraActivationPending = true
            cameraPermissionPrompt = .rationale
        case .denied:
            cameraActivationPending = true
            cameraPermissionPrompt = .denied
        case .restricted:
            cameraActivationPending = false
            cameraPermissionPrompt = .restricted
        @unknown default:
            cameraActivationPending = false
            cameraPermissionPrompt = .restricted
        }
    }

    func confirmCameraPermission() {
        Self.permissionLogger.info("camera_permission_rationale_confirmed")
        cameraPermissionPrompt = nil
        cameraActivationPending = true
        startCameraCapture()
    }

    func openCameraSettings() {
        cameraPermissionPrompt = nil
        cameraActivationPending = true
        guard let settingsURL = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(settingsURL) { [weak self] opened in
            guard !opened, let self else { return }
            self.cameraActivationPending = false
            self.cameraPermissionPrompt = .denied
            self.emit(
                method: "onNativeError",
                payload: ["feature": "camera", "message": "Could not open Settings. Enable camera access there, then try again."]
            )
        }
    }

    func cancelCameraActivation() {
        cameraPermissionPrompt = nil
        cameraActivationPending = false
    }

    func clearCameraPermissionPrompt() {
        cameraPermissionPrompt = nil
    }

    func requestSpeechCaptions() {
        Self.permissionLogger.info("speech_captions_requested permission=\(String(describing: LiveSpeechTranscriptionService.permission), privacy: .public)")
        switch LiveSpeechTranscriptionService.permission {
        case .granted:
            speechCaptionsPending = false
            transcription.start()
        case .undetermined:
            speechCaptionsPending = true
            microphonePermissionPrompt = .rationale
            emit(
                method: "onSpeechRecognitionStatusChange",
                payload: ["state": SpeechCaptionState.preparing.rawValue, "message": "Waiting for microphone permission."]
            )
        case .denied:
            speechCaptionsPending = true
            microphonePermissionPrompt = .denied
            emitSpeechPermissionState(.denied)
        case .restricted:
            speechCaptionsPending = false
            microphonePermissionPrompt = .restricted
            emitSpeechPermissionState(.restricted)
        }
    }

    func confirmMicrophonePermission() {
        Self.permissionLogger.info("microphone_permission_rationale_confirmed")
        microphonePermissionPrompt = nil
        LiveSpeechTranscriptionService.requestPermission { [weak self] permission in
            guard let self, self.speechCaptionsPending else { return }
            switch permission {
            case .granted:
                self.speechCaptionsPending = false
                self.transcription.start()
            case .denied, .undetermined:
                self.speechCaptionsPending = false
                self.emitSpeechPermissionState(.denied)
            case .restricted:
                self.speechCaptionsPending = false
                self.emitSpeechPermissionState(.restricted)
            }
        }
    }

    func openMicrophoneSettings() {
        microphonePermissionPrompt = nil
        guard let settingsURL = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(settingsURL)
    }

    func cancelSpeechCaptions() {
        microphonePermissionPrompt = nil
        guard speechCaptionsPending else { return }
        speechCaptionsPending = false
        emitSpeechPermissionState(.denied)
    }

    func clearMicrophonePermissionPrompt() {
        microphonePermissionPrompt = nil
    }

    func stopSpeechCaptions() {
        speechCaptionsPending = false
        microphonePermissionPrompt = nil
        transcription.stop()
    }

    private func emitSpeechPermissionState(_ state: SpeechCaptionState) {
        let message = state == .restricted
            ? MicrophonePermissionPrompt.restricted.message
            : "Live captions are unavailable without microphone and speech recognition access. You can still type."
        emit(method: "onSpeechRecognitionStatusChange", payload: ["state": state.rawValue, "message": message])
    }

    func stopCamera() {
        cameraPermissionPrompt = nil
        cameraActivationPending = false
        stopCameraCapture()
    }

    func sceneDidBecomeActive() {
        transcription.resume()
        if speechCaptionsPending, microphonePermissionPrompt == nil,
           LiveSpeechTranscriptionService.permission == .granted {
            requestSpeechCaptions()
        }
        if cameraActivationPending {
            requestCameraActivation()
            return
        }
        #if DEBUG && targetEnvironment(simulator)
        return
        #endif
        guard cameraActive, camera.authorizationStatus != .authorized else { return }
        cameraPermissionPrompt = camera.authorizationStatus == .denied ? .denied : .restricted
        stopCameraCapture()
    }

    func sceneDidEnterBackground() {
        transcription.suspend(reason: "Captions paused while Signify is in the background.")
        speech.stop()
        guard cameraActive || cameraStarting else { return }
        cameraActivationPending = false
        stopCameraCapture()
    }

    private func startCameraCapture() {
        guard !cameraActive, !cameraStarting else { return }
        cameraStarting = true
        cameraOperationGeneration += 1
        let operation = cameraOperationGeneration

        camera.start { [weak self] result in
            guard let self else { return }
            guard operation == self.cameraOperationGeneration else {
                if case .success = result {
                    self.camera.stop()
                }
                return
            }

            self.cameraStarting = false
            switch result {
            case .success:
                Self.permissionLogger.info("camera_capture_started")
                self.cameraActivationPending = false
                self.cameraActive = true
                self.emitEngineStatus(trackingState: self.camera.trackingState.rawValue)
                if let error = self.classifier.availabilityError {
                    self.emitRecognitionState("modelUnavailable", message: error.localizedDescription)
                } else if Self.validatedConfidenceThreshold == nil {
                    self.emitRecognitionState(
                        "confidenceThresholdNotValidated",
                        message: "Recognition is disabled until a validation-set confidence threshold is established."
                    )
                }
            case .failure(let error):
                Self.permissionLogger.error("camera_capture_start_failed")
                self.cameraActive = false
                self.cameraActivationPending = false
                self.emitEngineStatus(trackingState: "idle")
                if let captureError = error as? CameraCaptureError {
                    switch captureError {
                    case .permissionDenied:
                        self.cameraPermissionPrompt = .denied
                    case .permissionRestricted:
                        self.cameraPermissionPrompt = .restricted
                    case .cameraUnavailable:
                        self.cameraPermissionPrompt = .unavailable
                    }
                }
                self.emit(method: "onNativeError", payload: ["feature": "camera", "message": error.localizedDescription])
            }
        }
    }

    #if DEBUG && targetEnvironment(simulator)
    static let mockCameraLaunchArgument = "-SignifyMockCamera"
    private var mockFrameTimer: Timer?

    /// Simulator-only stand-in for the camera: no capture session, just synthetic landmark
    /// frames so the debug menu and trial-capture UI can be exercised.
    private func startMockCamera() {
        cameraActivationPending = false
        cameraActive = true
        emitEngineStatus(trackingState: "tracking")
        let start = Date().timeIntervalSince1970
        mockFrameTimer?.invalidate()
        mockFrameTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 15.0, repeats: true) { [weak self] _ in
            let t = Date().timeIntervalSince1970
            let phase = Float((t - start).truncatingRemainder(dividingBy: 2))
            var values = [Float](repeating: 0, count: LandmarkFrame.valueCount)
            for joint in 0..<LandmarkFrame.jointCount {
                let base = (LandmarkFrame.jointCount + joint) * 3
                values[base] = 0.4 + Float(joint) * 0.01
                values[base + 1] = 0.3 + phase * 0.1
                values[base + 2] = 0.9
            }
            let frame = LandmarkFrame(mockValues: values, timestamp: t)
            self?.camera.showMockLandmarks(frame)
            self?.trialRecorder.append(frame)
        }
    }

    func startMockCameraIfRequested() {
        if ProcessInfo.processInfo.arguments.contains(Self.mockCameraLaunchArgument) {
            requestCameraActivation()
        }
    }
    #endif

    private func stopCameraCapture() {
        #if DEBUG
        trialRecorder.interrupt("Camera stopped. Active trial discarded; please retry.")
        #endif
        #if DEBUG && targetEnvironment(simulator)
        mockFrameTimer?.invalidate()
        mockFrameTimer = nil
        #endif
        cameraOperationGeneration += 1
        cameraStarting = false
        camera.stop { [weak self] in
            guard let self else { return }
            self.cameraActive = false
            self.resetInferenceState()
            self.emitEngineStatus(trackingState: "idle")
        }
    }

    private func handleCameraToggle(active: Bool) {
        if active {
            requestCameraActivation()
        } else {
            stopCamera()
        }
    }

    private func handle(_ message: [String: Any]) {
        let method: String
        let payload: [String: Any]
        if let type = message["type"] as? String {
            method = type
            payload = message
        } else if let legacyMethod = message["method"] as? String,
                  let legacyPayload = message["payload"] as? [String: Any] {
            method = legacyMethod
            payload = legacyPayload
        } else {
            emit(method: "onNativeError", payload: ["feature": "bridge", "message": "Malformed native bridge command."])
            return
        }

        switch method {
        case "openPrivacyAndAccount":
            showsPrivacyAndAccount = true
            emit(method: "onCaptureConsentChange", payload: ["consentGranted": captureConsent.isGranted])
        case "triggerCameraToggle":
            guard let active = payload["active"] as? Bool else {
                emit(method: "onNativeError", payload: ["feature": "camera", "message": "Missing camera active state."])
                return
            }
            handleCameraToggle(active: active)
        case "triggerSpeechRecognition":
            guard let active = payload["active"] as? Bool else {
                emit(method: "onNativeError", payload: ["feature": "speech", "message": "Missing listening state."])
                return
            }
            if active {
                requestSpeechCaptions()
            } else {
                stopSpeechCaptions()
            }
        case "triggerTTSPlayback":
            guard let text = payload["text"] as? String else {
                emit(method: "onNativeError", payload: ["feature": "tts", "message": "Missing text to speak."])
                return
            }
            do {
                try speech.speak(text, voiceIdentifier: payload["voiceId"] as? String)
            } catch {
                emit(method: "onNativeError", payload: ["feature": "tts", "message": error.localizedDescription])
            }
        case "stopTTSPlayback":
            speech.stop()
        case "triggerAvatarReplay":
            let glosses = payload["glossSequence"] as? [String] ?? []
            avatarRuntime.replay(glossSequence: glosses) { [weak self] result in
                switch result {
                case .success:
                    self?.emit(method: "onAvatarStatusChange", payload: ["state": "playing"])
                case .failure(let error):
                    self?.emit(method: "onAvatarStatusChange", payload: ["state": "unavailable", "message": error.localizedDescription])
                }
            }
        case "syncSessionToAWS":
            emit(
                method: "onCloudSyncStatusChange",
                payload: ["state": "unavailable", "message": "Cloud sync is not configured in the native shell."]
            )
        case "reloadFrontend":
            frontendLoadFailed = false
            loadFrontend()
        default:
            emit(method: "onNativeError", payload: ["feature": "bridge", "message": "Unsupported bridge command: \(method)"])
        }
    }

    static func trustsMemoryOrigin(frontend: URL?, source: URL?, isMainFrame: Bool) -> Bool {
        guard isMainFrame, let frontend, let source,
              ["https", "http"].contains(frontend.scheme?.lowercased() ?? ""),
              frontend.scheme?.lowercased() == source.scheme?.lowercased(),
              frontend.host?.lowercased() == source.host?.lowercased(),
              frontend.host != nil else { return false }
        let defaultPort = frontend.scheme?.lowercased() == "https" ? 443 : 80
        return (frontend.port ?? defaultPort) == (source.port ?? defaultPort)
    }

    private var memoryFrontendURL: URL? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SIGNIFY_FRONTEND_URL") as? String else { return nil }
        return validatedFrontendURL(value)
    }

    private func handleMemory(_ message: WKScriptMessage, body: [String: Any]) {
        let origin = message.frameInfo.securityOrigin
        let port = origin.port == 0 ? "" : ":\(origin.port)"
        let source = URL(string: "\(origin.protocol)://\(origin.host)\(port)")
        guard Self.trustsMemoryOrigin(frontend: memoryFrontendURL, source: source,
                                     isMainFrame: message.frameInfo.isMainFrame),
              Self.trustsMemoryOrigin(frontend: memoryFrontendURL, source: webView?.url, isMainFrame: true) else {
            Logger(subsystem: "com.argussun.signifygesture", category: "memory").error("memory:untrusted_origin")
            return
        }
        guard let requestID = body["requestId"] as? String, UUID(uuidString: requestID) != nil else {
            emit(method: "onNativeError", payload: ["feature": "memory", "message": MemoryFailure.invalidRequest.message])
            return
        }
        let generation = navigationGeneration
        memoryQueue.async { [weak self] in
            guard let self else { return }
            let response: [String: Any]
            do {
                let bytes = try JSONSerialization.data(withJSONObject: body)
                guard bytes.count <= 2_000_000 else { throw MemoryFailure.invalidRequest }
                let request = try JSONDecoder().decode(MemoryRequest.self, from: bytes)
                if self.memoryStore == nil { self.memoryStore = try ConversationMemory.open() }
                guard let store = self.memoryStore else { throw MemoryFailure.storage }
                let data = try store.perform(request)
                response = ["version": 1, "requestId": requestID, "ok": true,
                            "data": try JSONSerialization.jsonObject(with: JSONEncoder().encode(data))]
            } catch {
                let failure: MemoryFailure
                if let memoryFailure = error as? MemoryFailure {
                    failure = memoryFailure
                } else if error is DecodingError {
                    failure = .invalidRequest
                } else {
                    failure = .storage
                    Logger(subsystem: "com.argussun.signifygesture", category: "memory").error("memory:storage_operation_failed")
                }
                response = ["version": 1, "requestId": requestID, "ok": false,
                            "error": ["code": failure.rawValue, "message": failure.message]]
            }
            self.emit(method: "onMemoryResult", payload: response, memoryGeneration: generation)
        }
    }
}

extension NativeBridgeCoordinator: WKScriptMessageHandler {
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any] else {
            emit(method: "onNativeError", payload: ["feature": "bridge", "message": "Bridge payload must be an object."])
            return
        }
        if body["type"] as? String == "memory" {
            handleMemory(message, body: body)
            return
        }
        handle(body)
    }
}

extension NativeBridgeCoordinator: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        navigationGeneration += 1
    }
    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        frontendLoadDidFail(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        frontendLoadDidFail(error)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        frontendLoadDidFinish(webView)
    }
}
