import WebKit
import Vision
import XCTest
import SwiftUI
@testable import SignifyGesture

@MainActor
final class NativeBridgeTests: XCTestCase, WKNavigationDelegate, WKScriptMessageHandler {
    private var navigationFinished: XCTestExpectation?
    private var eventReceived: XCTestExpectation?
    private var receivedEvent: [String: Any]?

    private func send(_ script: String) async throws -> [String: Any] {
        let coordinator = NativeBridgeCoordinator()
        let controller = WKUserContentController()
        controller.add(coordinator, name: "aslBridge")
        controller.add(self, name: "testEvents")
        defer {
            controller.removeScriptMessageHandler(forName: "aslBridge")
            controller.removeScriptMessageHandler(forName: "testEvents")
        }
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        let webView = WKWebView(frame: .zero, configuration: configuration)
        defer { webView.stopLoading() }
        webView.navigationDelegate = self
        navigationFinished = expectation(description: "Local test page loaded")
        webView.loadHTMLString(
            "<html><body>Bridge integration test</body></html>",
            baseURL: URL(string: "http://localhost:5173")
        )
        await fulfillment(of: [navigationFinished!], timeout: 10)
        coordinator.attach(webView: webView)
        try await evaluate("""
        window.NativeASLBridge = {
          onEngineStatusChange: payload => window.webkit.messageHandlers.testEvents.postMessage({method: "status", payload}),
          onNativeError: payload => window.webkit.messageHandlers.testEvents.postMessage({method: "error", payload}),
          onSpeechRecognitionStatusChange: payload => window.webkit.messageHandlers.testEvents.postMessage({method: "speechStatus", payload})
        };
        \(NativeBridgeCoordinator.webBridgeBootstrap)
        """, in: webView)
        eventReceived = expectation(description: "Swift replied through NativeASLBridge")
        receivedEvent = nil
        try await evaluate(script, in: webView)
        await fulfillment(of: [eventReceived!], timeout: 10)
        return try XCTUnwrap(receivedEvent)
    }

    private func evaluate(_ script: String, in webView: WKWebView) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            webView.evaluateJavaScript(script + "\ntrue;") { _, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    func testFrontendCameraCommandReachesSwift() async throws {
        let event = try await send("""
        window.webkit.messageHandlers.aslBridge.postMessage({type: "triggerCameraToggle", active: false});
        """)
        XCTAssertEqual(event["method"] as? String, "status")
        let payload = try XCTUnwrap(event["payload"] as? [String: Any])
        XCTAssertEqual(payload["cameraActive"] as? Bool, false)
        XCTAssertEqual(payload["trackingState"] as? String, "idle")
    }

    func testLegacyCameraEnvelopeStillWorks() async throws {
        let event = try await send("""
        window.webkit.messageHandlers.aslBridge.postMessage({method: "triggerCameraToggle", payload: {active: false}});
        """)
        XCTAssertEqual(event["method"] as? String, "status")
    }

    func testInjectedBootstrapUsesWorkingCameraCommand() async throws {
        let event = try await send("window.NativeASLBridge.triggerCameraToggle(false);")
        XCTAssertEqual(event["method"] as? String, "status")
    }

    func testMalformedCameraCommandReturnsActionableError() async throws {
        let event = try await send("""
        window.webkit.messageHandlers.aslBridge.postMessage({type: "triggerCameraToggle", active: "yes"});
        """)
        XCTAssertEqual(event["method"] as? String, "error")
        let payload = try XCTUnwrap(event["payload"] as? [String: Any])
        XCTAssertEqual(payload["feature"] as? String, "camera")
        XCTAssertEqual(payload["message"] as? String, "Missing camera active state.")
    }

    func testStoppingSpeechRecognitionReportsIdleCaptions() async throws {
        let event = try await send("window.NativeASLBridge.triggerSpeechRecognition(false);")
        XCTAssertEqual(event["method"] as? String, "speechStatus")
        let payload = try XCTUnwrap(event["payload"] as? [String: Any])
        XCTAssertEqual(payload["state"] as? String, "idle")
    }

    func testMalformedSpeechRecognitionCommandReturnsActionableError() async throws {
        let event = try await send("""
        window.webkit.messageHandlers.aslBridge.postMessage({type: "triggerSpeechRecognition", active: "yes"});
        """)
        XCTAssertEqual(event["method"] as? String, "error")
        let payload = try XCTUnwrap(event["payload"] as? [String: Any])
        XCTAssertEqual(payload["feature"] as? String, "speech")
        XCTAssertEqual(payload["message"] as? String, "Missing listening state.")
    }

    func testSpeakingBlankTextReturnsTTSError() async throws {
        let event = try await send("window.NativeASLBridge.triggerTTSPlayback('   ');")
        XCTAssertEqual(event["method"] as? String, "error")
        let payload = try XCTUnwrap(event["payload"] as? [String: Any])
        XCTAssertEqual(payload["feature"] as? String, "tts")
        XCTAssertEqual(payload["message"] as? String, "There is no text to speak.")
    }

    func testBootstrapExposesSpeechCommands() {
        XCTAssertTrue(NativeBridgeCoordinator.webBridgeBootstrap.contains("bridge.triggerSpeechRecognition"))
        XCTAssertTrue(NativeBridgeCoordinator.webBridgeBootstrap.contains("bridge.stopTTSPlayback"))
    }

    func testCameraRationalePresentsWithMicrophonePresenterInstalled() async throws {
        let coordinator = NativeBridgeCoordinator()
        try XCTSkipUnless(coordinator.camera.authorizationStatus == .notDetermined,
                          "Requires undetermined camera permission; does not reset device permissions.")
        try await assertPermissionAlert(coordinator: coordinator, title: CameraPermissionPrompt.rationale.title) {
            coordinator.requestCameraActivation()
        }
        XCTAssertEqual(coordinator.permissionPrompt, .camera(.rationale))
        coordinator.cancelCameraActivation()
        XCTAssertNil(coordinator.permissionPrompt)
    }

    func testMicrophoneRationalePresentsWithCameraPresenterInstalled() async throws {
        let coordinator = NativeBridgeCoordinator()
        try XCTSkipUnless(LiveSpeechTranscriptionService.permission == .undetermined,
                          "Requires undetermined microphone/speech permission.")
        try await assertPermissionAlert(coordinator: coordinator, title: MicrophonePermissionPrompt.rationale.title) {
            coordinator.requestSpeechCaptions()
        }
        XCTAssertEqual(coordinator.permissionPrompt, .microphone(.rationale))
        coordinator.cancelSpeechCaptions()
        XCTAssertNil(coordinator.permissionPrompt)
    }

    func testDismissingCameraPromptPreservesPendingMicrophonePrompt() throws {
        let coordinator = NativeBridgeCoordinator()
        try XCTSkipUnless(coordinator.camera.authorizationStatus == .notDetermined &&
                          LiveSpeechTranscriptionService.permission == .undetermined,
                          "Requires undetermined permissions.")
        coordinator.requestCameraActivation()
        coordinator.requestSpeechCaptions()
        XCTAssertEqual(coordinator.permissionPrompt, .camera(.rationale))
        coordinator.clearPermissionPrompt(.camera(.rationale))
        XCTAssertEqual(coordinator.permissionPrompt, .microphone(.rationale))
        // A late dismissal of the old alert must not remove the other permission request.
        coordinator.clearPermissionPrompt(.camera(.rationale))
        XCTAssertEqual(coordinator.permissionPrompt, .microphone(.rationale))
        coordinator.cancelCameraActivation()
        coordinator.cancelSpeechCaptions()
    }

    private func assertPermissionAlert(
        coordinator: NativeBridgeCoordinator,
        title: String,
        request: () -> Void
    ) async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previousWindow = scene.windows.first(where: \.isKeyWindow)
        let window = UIWindow(windowScene: scene)
        let host = UIHostingController(rootView: Color.clear.modifier(NativePermissionAlerts(bridge: coordinator)))
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer {
            host.dismiss(animated: false)
            window.isHidden = true
            previousWindow?.makeKey()
        }
        request()
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            if let alert = host.presentedViewController as? UIAlertController {
                XCTAssertEqual(alert.title, title)
                XCTAssertTrue(alert.actions.contains { $0.title == "Continue" })
                return
            }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        XCTFail("Permission rationale did not present: \(title)")
    }

    func testLandmarkFrameNormalizesMirroredKnownPoseAndOrdersHandsBySide() {
        let leftHand = fixtureHand(
            side: .left,
            wrist: LandmarkPoint(x: 0.2, y: 0.3, confidence: 1.2)
        )
        let rightHand = fixtureHand(
            side: .right,
            wrist: LandmarkPoint(x: 0.8, y: 0.7, confidence: 0.6)
        )

        let frame = LandmarkFrame(
            hands: [rightHand, leftHand],
            timestamp: 12.5,
            sourceIsMirrored: true
        )

        XCTAssertEqual(frame.values.count, LandmarkFrame.valueCount)
        XCTAssertEqual(frame.timestamp, 12.5)
        XCTAssertEqual(frame.values[0], 0.8, accuracy: 0.0001)
        XCTAssertEqual(frame.values[1], 0.7, accuracy: 0.0001)
        XCTAssertEqual(frame.values[2], 1, accuracy: 0.0001)
        let rightWristOffset = LandmarkHandSide.right.rawValue * LandmarkFrame.jointCount * 3
        XCTAssertEqual(frame.values[rightWristOffset], 0.2, accuracy: 0.0001)
        XCTAssertEqual(frame.values[rightWristOffset + 1], 0.3, accuracy: 0.0001)
        XCTAssertEqual(frame.values[rightWristOffset + 2], 0.6, accuracy: 0.0001)
        XCTAssertEqual(frame.visibleJointCountByHand, [1, 1])
    }

    func testLandmarkFrameZeroFillsMissingHandsAndJointsAndClampsCoordinates() {
        let hand = fixtureHand(
            side: .left,
            wrist: LandmarkPoint(x: -0.2, y: 1.4, confidence: 0.5)
        )

        let frame = LandmarkFrame(hands: [hand], timestamp: 1, sourceIsMirrored: false)

        XCTAssertEqual(frame.values[0], 0)
        XCTAssertEqual(frame.values[1], 0)
        XCTAssertEqual(frame.values[2], 0.5)
        XCTAssertTrue(frame.values.dropFirst(LandmarkFrame.jointCount * 3).allSatisfy { $0 == 0 })
        XCTAssertTrue(frame.values.dropFirst(3).allSatisfy { $0 == 0 })
        XCTAssertEqual(frame.visibleJointCountByHand, [1, 0])
    }

    func testLandmarkFrameSelectsDuplicateHandByConfidenceDeterministically() {
        let lowerConfidence = fixtureHand(
            side: .left,
            wrist: LandmarkPoint(x: 0.2, y: 0.5, confidence: 0.4)
        )
        let higherConfidence = fixtureHand(
            side: .left,
            wrist: LandmarkPoint(x: 0.8, y: 0.5, confidence: 0.9)
        )

        let first = LandmarkFrame(
            hands: [lowerConfidence, higherConfidence],
            timestamp: 1,
            sourceIsMirrored: false
        )
        let reversed = LandmarkFrame(
            hands: [higherConfidence, lowerConfidence],
            timestamp: 1,
            sourceIsMirrored: false
        )

        XCTAssertEqual(first.values, reversed.values)
        XCTAssertEqual(first.values[0], 0.8, accuracy: 0.0001)
        XCTAssertEqual(first.values[2], 0.9, accuracy: 0.0001)
    }

    func testVisionChiralityUsesAnatomicalSlotsWithoutGuessingUnknownAsRight() throws {
        XCTAssertEqual(try LandmarkHandSide(chirality: .left), .left)
        XCTAssertEqual(try LandmarkHandSide(chirality: .right), .right)
        XCTAssertThrowsError(try LandmarkHandSide(chirality: .unknown)) { error in
            guard case HandPoseGeometryError.unknownChirality = error else {
                return XCTFail("Unknown chirality must surface an explicit geometry error.")
            }
        }
    }

    func testUprightUnmirroredPalmPreservesHorizontalDirectionAndFingerAboveWrist() {
        var points = Array<LandmarkPoint?>(repeating: nil, count: LandmarkFrame.jointCount)
        points[0] = LandmarkPoint(x: 0.4, y: 0.2, confidence: 1)
        points[8] = LandmarkPoint(x: 0.4, y: 0.8, confidence: 1)
        let frame = LandmarkFrame(
            hands: [LandmarkHand(side: .left, points: points)],
            timestamp: 1,
            sourceIsMirrored: false
        )

        XCTAssertEqual(frame.values[0], 0.4, accuracy: 0.0001)
        XCTAssertEqual(frame.values[1], 0.8, accuracy: 0.0001)
        XCTAssertEqual(frame.values[8 * 3], 0.4, accuracy: 0.0001)
        XCTAssertEqual(frame.values[8 * 3 + 1], 0.2, accuracy: 0.0001)
        XCTAssertLessThan(frame.values[8 * 3 + 1], frame.values[1])
        XCTAssertEqual(frame.visibleJointCountByHand, [2, 0])
    }

    private func fixtureHand(
        side: LandmarkHandSide,
        wrist: LandmarkPoint
    ) -> LandmarkHand {
        var points = Array<LandmarkPoint?>(repeating: nil, count: LandmarkFrame.jointCount)
        points[0] = wrist
        return LandmarkHand(side: side, points: points)
    }

    func testFailedFrontendLoadShowsRetryInsteadOfBlackScreen() async throws {
        let coordinator = NativeBridgeCoordinator()
        let controller = WKUserContentController()
        controller.add(coordinator, name: "aslBridge")
        defer { controller.removeScriptMessageHandler(forName: "aslBridge") }

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        let webView = WKWebView(frame: .zero, configuration: configuration)
        defer { webView.stopLoading() }
        webView.navigationDelegate = self
        navigationFinished = expectation(description: "Retry screen loaded")
        webView.loadHTMLString(
            "<html><body>Initial page</body></html>",
            baseURL: URL(string: "http://localhost:5173")
        )
        await fulfillment(of: [navigationFinished!], timeout: 10)
        coordinator.attach(webView: webView)

        navigationFinished = expectation(description: "Connection error screen displayed")
        coordinator.frontendLoadDidFail(NSError(
            domain: NSURLErrorDomain,
            code: NSURLErrorCannotConnectToHost,
            userInfo: [NSLocalizedDescriptionKey: "Could not connect to 10.0.0.132:5173"]
        ))
        await fulfillment(of: [navigationFinished!], timeout: 10)

        let content = try await webView.evaluateJavaScript("document.body.innerText") as? String
        XCTAssertTrue(content?.contains("Can't connect to Signify") == true)
        XCTAssertTrue(content?.contains("Retry") == true)
        XCTAssertTrue(content?.contains("Could not connect to 10.0.0.132:5173") == true)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        navigationFinished?.fulfill()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        receivedEvent = message.body as? [String: Any]
        eventReceived?.fulfill()
    }
}
