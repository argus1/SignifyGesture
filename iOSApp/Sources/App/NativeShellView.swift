import SwiftUI
import WebKit

struct NativeShellView: View {
    @StateObject private var bridge = NativeBridgeCoordinator()
    @Environment(\.scenePhase) private var scenePhase

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
        .overlay(alignment: .topTrailing) {
            if bridge.cameraActive {
                HStack(spacing: 12) {
                    Label("Camera active", systemImage: "camera.fill")
                    Button(action: bridge.stopCamera) {
                        Label("Stop camera", systemImage: "stop.fill")
                    }
                    .accessibilityHint("Stops camera capture immediately.")
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(.regularMaterial, in: Capsule())
                .padding(.top, 12)
                .padding(.trailing, 12)
            }
        }
        .alert(
            item: Binding(
                get: { bridge.cameraPermissionPrompt },
                set: { prompt in
                    if prompt == nil {
                        bridge.clearCameraPermissionPrompt()
                    }
                }
            )
        ) { prompt in
            switch prompt {
            case .rationale:
                Alert(
                    title: Text(prompt.title),
                    message: Text(prompt.message),
                    primaryButton: .default(Text("Continue"), action: bridge.confirmCameraPermission),
                    secondaryButton: .cancel(Text("Not now"), action: bridge.cancelCameraActivation)
                )
            case .denied:
                Alert(
                    title: Text(prompt.title),
                    message: Text(prompt.message),
                    primaryButton: .default(Text("Open Settings"), action: bridge.openCameraSettings),
                    secondaryButton: .cancel(Text("Not now"), action: bridge.cancelCameraActivation)
                )
            case .restricted, .unavailable:
                Alert(
                    title: Text(prompt.title),
                    message: Text(prompt.message),
                    dismissButton: .default(Text("OK"), action: bridge.cancelCameraActivation)
                )
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                bridge.sceneDidBecomeActive()
            } else if phase == .background {
                bridge.sceneDidEnterBackground()
            }
        }
        .onDisappear {
            bridge.stopCamera()
        }
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
