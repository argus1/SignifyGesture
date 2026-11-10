import WebKit
import XCTest
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
          onNativeError: payload => window.webkit.messageHandlers.testEvents.postMessage({method: "error", payload})
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
