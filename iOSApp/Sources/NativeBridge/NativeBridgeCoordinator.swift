import AVFoundation
import Combine
import Foundation
import QuartzCore
import UIKit
import WebKit

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

final class NativeBridgeCoordinator: NSObject, ObservableObject {
    static let webBridgeBootstrap = """
    (() => {
      const bridge = window.NativeASLBridge = window.NativeASLBridge || {};
      const post = (method, payload) => window.webkit.messageHandlers.aslBridge.postMessage({ method, payload });
      bridge.triggerCameraToggle = bridge.triggerCameraToggle || ((active) => post("triggerCameraToggle", { active }));
      bridge.triggerTTSPlayback = bridge.triggerTTSPlayback || ((text, voiceId) => post("triggerTTSPlayback", { text, voiceId }));
      bridge.triggerAvatarReplay = bridge.triggerAvatarReplay || ((glossSequence) => post("triggerAvatarReplay", { glossSequence }));
      bridge.syncSessionToAWS = bridge.syncSessionToAWS || ((sessionData) => post("syncSessionToAWS", { sessionData }));
    })();
    """

    let camera = CameraCaptureService()
    private let speech = NativeSpeechService()
    private let classifier: any SignInferenceProvider = CoreMLSignClassifier()
    private let avatarRuntime: AvatarRuntime = UnavailableAvatarRuntime()
    private weak var webView: WKWebView?

    private let inferenceStateQueue = DispatchQueue(
        label: "com.argussun.signifygesture.inference-state",
        qos: .userInitiated
    )
    private static let validatedConfidenceThreshold: Double? = nil

    @Published private(set) var cameraActive = false
    @Published private(set) var cameraStarting = false
    @Published private(set) var cameraPermissionPrompt: CameraPermissionPrompt?
    private var recentFrames: [[Float]] = []
    private var lastPublishedGloss: String?
    private var predictionInFlight = false
    private var inferenceGeneration = 0
    private var cameraOperationGeneration = 0
    private var cameraActivationPending = false

    override init() {
        super.init()
        camera.onTrackingStateChange = { [weak self] state in
            self?.emitEngineStatus(trackingState: state.rawValue)
        }
        camera.onPoseFrame = { [weak self] frame in
            self?.consume(frame: frame)
        }
        camera.onError = { [weak self] message in
            self?.emit(method: "onNativeError", payload: ["feature": "camera", "message": message])
        }
        speech.setPlaybackStateChangeHandler { [weak self] isPlaying in
            self?.emit(method: "onTTSPlaybackState", payload: isPlaying)
        }
    }

    func attach(webView: WKWebView) {
        self.webView = webView
        guard webView.url == nil else { return }
        if let urlString = Bundle.main.object(forInfoDictionaryKey: "SIGNIFY_FRONTEND_URL") as? String,
           let url = validatedFrontendURL(urlString) {
            webView.load(URLRequest(url: url))
        } else {
            webView.loadHTMLString(Self.frontendNotConfiguredHTML, baseURL: nil)
        }
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

        inferenceStateQueue.async { [weak self] in
            guard let self else { return }

            self.recentFrames.append(frame.values)
            if self.recentFrames.count > 16 {
                self.recentFrames.removeFirst(self.recentFrames.count - 16)
            }
            guard self.recentFrames.count == 16, !self.predictionInFlight else { return }

            self.predictionInFlight = true
            let generation = self.inferenceGeneration
            let sequence = self.recentFrames.flatMap { $0 }
            self.classifier.predict(sequence: sequence) { [weak self] result in
                guard let self else { return }
                self.inferenceStateQueue.async {
                    guard generation == self.inferenceGeneration else { return }
                    self.predictionInFlight = false
                    self.handlePrediction(result)
                }
            }
        }
    }

    private func resetInferenceState() {
        inferenceStateQueue.sync {
            inferenceGeneration += 1
            recentFrames.removeAll(keepingCapacity: true)
            lastPublishedGloss = nil
            predictionInFlight = false
        }
    }

    private func handlePrediction(_ result: Result<SignPrediction, Error>) {
        switch result {
        case .success(let prediction):
            guard let threshold = Self.validatedConfidenceThreshold,
                  prediction.confidence >= threshold else {
                emitRecognitionState("noResult", message: "The validation-set confidence threshold has not been established.")
                return
            }
            guard Self.supportedGlosses.contains(prediction.gloss) else {
                emitRecognitionState("unsupportedGloss")
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
                    "timestamp": Date().timeIntervalSince1970
                ]
            )
        case .failure(let error):
            emitRecognitionState("noResult", message: error.localizedDescription)
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

    private func emitRecognitionState(_ state: String, message: String? = nil) {
        var payload: [String: Any] = ["state": state]
        if let message { payload["message"] = message }
        emit(method: "onRecognitionStatusChange", payload: payload)
    }

    private func emit(method: String, payload: Any) {
        guard JSONSerialization.isValidJSONObject([payload]),
              let data = try? JSONSerialization.data(withJSONObject: [payload]),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        let fragment = String(json.dropFirst().dropLast())
        let script = "window.NativeASLBridge && window.NativeASLBridge.\(method) && window.NativeASLBridge.\(method)(\(fragment));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script)
        }
    }

    func requestCameraActivation() {
        if cameraActive {
            cameraActivationPending = false
            return
        }
        if cameraStarting {
            return
        }

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

    func stopCamera() {
        cameraPermissionPrompt = nil
        cameraActivationPending = false
        stopCameraCapture()
    }

    func sceneDidBecomeActive() {
        if cameraActivationPending {
            requestCameraActivation()
            return
        }
        guard cameraActive, camera.authorizationStatus != .authorized else { return }
        cameraPermissionPrompt = camera.authorizationStatus == .denied ? .denied : .restricted
        stopCameraCapture()
    }

    func sceneDidEnterBackground() {
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

    private func stopCameraCapture() {
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
        guard let method = message["method"] as? String,
              let payload = message["payload"] as? [String: Any] else {
            emit(method: "onNativeError", payload: ["feature": "bridge", "message": "Malformed native bridge command."])
            return
        }

        switch method {
        case "triggerCameraToggle":
            guard let active = payload["active"] as? Bool else {
                emit(method: "onNativeError", payload: ["feature": "camera", "message": "Missing camera active state."])
                return
            }
            handleCameraToggle(active: active)
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
        default:
            emit(method: "onNativeError", payload: ["feature": "bridge", "message": "Unsupported bridge command: \(method)"])
        }
    }

    private static let frontendNotConfiguredHTML = """
    <!doctype html>
    <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="background:transparent;color:white;font:16px -apple-system;padding:24px">
    <p>Lovable frontend URL is not configured. Start the frontend and set SIGNIFY_FRONTEND_URL.</p>
    </body></html>
    """
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
        handle(body)
    }
}

extension NativeBridgeCoordinator: WKNavigationDelegate {}
