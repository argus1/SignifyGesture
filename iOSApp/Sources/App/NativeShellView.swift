import SwiftUI
import WebKit

struct NativeShellView: View {
    @StateObject private var bridge = NativeBridgeCoordinator()

    var body: some View {
        ZStack {
            if bridge.cameraActive {
                CameraPreview(session: bridge.camera.session)
                    .ignoresSafeArea()
            }

            NativeWebView(coordinator: bridge)
                .background(Color.clear)
                .ignoresSafeArea()
        }
        .background(Color.black)
        .statusBarHidden(true)
    }
}

struct NativeWebView: UIViewRepresentable {
    let coordinator: NativeBridgeCoordinator

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.add(coordinator, name: "aslBridge")
        contentController.addUserScript(
            WKUserScript(
                source: NativeBridgeCoordinator.webBridgeBootstrap,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = coordinator
        coordinator.attach(webView: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        coordinator.attach(webView: webView)
    }
}
