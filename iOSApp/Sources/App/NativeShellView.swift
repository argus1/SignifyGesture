import SwiftUI
import WebKit

struct NativeShellView: View {
    @StateObject private var bridge = NativeBridgeCoordinator()
    @Environment(\.scenePhase) private var scenePhase
    #if DEBUG
    @State private var showsLandmarkInspector = false
    @State private var showsTrialRecorder = false
    #endif

    var body: some View {
        ZStack {
            if bridge.cameraActive {
                CameraPreview(session: bridge.camera.session) { message in
                    bridge.camera.onError?(message)
                }
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
                    #if DEBUG
                    Menu("Debug") {
                        Button {
                            showsLandmarkInspector = true
                        } label: {
                            Label("Landmarks", systemImage: "viewfinder")
                        }
                        .accessibilityHint("Inspect the latest hand landmarks in memory.")
                        Button("Capture trials") { showsTrialRecorder = true }
                    }
                    #endif
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(.regularMaterial, in: Capsule())
                .padding(.top, 12)
                .padding(.trailing, 12)
            }
        }
        #if DEBUG
        .sheet(isPresented: $showsLandmarkInspector) {
            LandmarkFrameInspector(camera: bridge.camera)
        }
        .sheet(isPresented: $showsTrialRecorder) {
            DebugTrialRecorderView(
                recorder: bridge.trialRecorder,
                authService: bridge.cognitoAuth,
                cameraActive: bridge.cameraActive
            )
        }
        #endif
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

#if DEBUG
private struct LandmarkFrameInspector: View {
    @Environment(\.dismiss) private var dismiss
    let camera: CameraCaptureService

    private static let bones = [
        (0, 1), (1, 2), (2, 3), (3, 4),
        (0, 5), (5, 6), (6, 7), (7, 8),
        (0, 9), (9, 10), (10, 11), (11, 12),
        (0, 13), (13, 14), (14, 15), (15, 16),
        (0, 17), (17, 18), (18, 19), (19, 20)
    ]

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 0.25)) { _ in
                let frame = camera.latestLandmarkFrame
                VStack(alignment: .leading, spacing: 16) {
                    Text("Live landmark preview is opt-in and kept in memory only. It is cleared when capture stops.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Text("Mirrored to match the selfie preview. Blue: your left hand. Orange: your right hand. Model coordinates remain unmirrored.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    if let frame {
                        Canvas { context, size in
                            for handIndex in 0..<LandmarkFrame.handCount {
                                let color: Color = handIndex == LandmarkHandSide.left.rawValue ? .blue : .orange
                                for (startIndex, endIndex) in Self.bones {
                                    guard let start = point(startIndex, handIndex: handIndex, frame: frame, size: size),
                                          let end = point(endIndex, handIndex: handIndex, frame: frame, size: size) else {
                                        continue
                                    }
                                    var path = Path()
                                    path.move(to: start)
                                    path.addLine(to: end)
                                    context.stroke(path, with: .color(color.opacity(0.65)), lineWidth: 2)
                                }
                                for jointIndex in 0..<LandmarkFrame.jointCount {
                                    guard let joint = point(jointIndex, handIndex: handIndex, frame: frame, size: size) else {
                                        continue
                                    }
                                    context.fill(
                                        Path(ellipseIn: CGRect(x: joint.x - 3, y: joint.y - 3, width: 6, height: 6)),
                                        with: .color(color)
                                    )
                                }
                            }
                        }
                        .scaleEffect(x: -1, y: 1)
                        .frame(height: 240)
                        .background(.black.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))

                        HStack {
                            Label("Left: \(frame.visibleJointCountByHand[0]) / 21", systemImage: "hand.wave")
                                .foregroundStyle(.blue)
                            Spacer()
                            Label("Right: \(frame.visibleJointCountByHand[1]) / 21", systemImage: "hand.wave")
                                .foregroundStyle(.orange)
                        }
                        .font(.subheadline.monospacedDigit())
                        Text("Capture timestamp: \(frame.timestamp, specifier: "%.3f")")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    } else {
                        ContentUnavailableView(
                            "No hand landmarks",
                            systemImage: "viewfinder",
                            description: Text("Start camera capture and place a hand in view.")
                        )
                    }
                    Spacer(minLength: 0)
                }
                .padding()
            }
            .navigationTitle("Landmark Inspector")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func point(
        _ jointIndex: Int,
        handIndex: Int,
        frame: LandmarkFrame,
        size: CGSize
    ) -> CGPoint? {
        let offset = (handIndex * LandmarkFrame.jointCount + jointIndex) * 3
        guard frame.values[offset + 2] > 0 else { return nil }
        return CGPoint(
            x: CGFloat(frame.values[offset]) * size.width,
            y: CGFloat(frame.values[offset + 1]) * size.height
        )
    }
}
#endif

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
