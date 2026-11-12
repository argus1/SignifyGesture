import SwiftUI
import WebKit

struct NativeShellView: View {
    @StateObject private var bridge = NativeBridgeCoordinator()
    @Environment(\.scenePhase) private var scenePhase
    #if DEBUG
    private let showsCameraDebugBar = ProcessInfo.processInfo.arguments.contains("-SignifyShowCameraDebugBar")
    @State private var showsLandmarkInspector = false
    @State private var showsTrialRecorder = false
    #endif

    var body: some View {
        ZStack {
            if bridge.cameraActive {
                #if DEBUG && targetEnvironment(simulator)
                MockCameraPreview(camera: bridge.camera)
                    .ignoresSafeArea()
                #else
                CameraPreview(camera: bridge.camera) { message in
                    bridge.camera.onError?(message)
                }
                    .ignoresSafeArea()
                #endif
            }

            NativeWebView(coordinator: bridge)
                .background(Color.clear)
                .ignoresSafeArea()
        }
        .background(Color.black)
        .statusBarHidden(true)
        #if DEBUG
        .overlay(alignment: .topTrailing) {
            if bridge.cameraActive && showsCameraDebugBar {
                // Falls back to icon-only controls on narrow screens (iPhone, larger text) so nothing is pushed off screen.
                ViewThatFits(in: .horizontal) {
                    cameraControls(iconOnly: false)
                    cameraControls(iconOnly: true)
                }
                .padding(.top, 12)
                .padding(.horizontal, 12)
            }
        }
        #endif
        .overlay(alignment: .bottomTrailing) {
            if bridge.cameraActive {
                SignTranscriptionModelMenu()
                    .padding(16)
            }
        }
        .overlay(alignment: .bottomLeading) {
            Button {
                bridge.showsPrivacyAndAccount = true
            } label: {
                Image(systemName: "hand.raised")
                    .font(.title2)
                    .frame(width: 48, height: 48)
                    .glassBackground(in: Circle())
            }
            .accessibilityLabel("Privacy & account")
            .accessibilityIdentifier("privacyAccountButton")
            .padding(16)
        }
        .sheet(isPresented: $bridge.showsPrivacyAndAccount) {
            #if DEBUG
            PrivacyAndAccountView(consent: bridge.captureConsent, authService: bridge.cognitoAuth, recorder: bridge.trialRecorder)
            #else
            PrivacyAndAccountView(consent: bridge.captureConsent, authService: bridge.cognitoAuth)
            #endif
        }
        #if DEBUG
        .sheet(isPresented: $showsLandmarkInspector) {
            LandmarkFrameInspector(camera: bridge.camera)
        }
        .fullScreenCover(isPresented: $showsTrialRecorder) {
            DebugTrialRecorderView(
                recorder: bridge.trialRecorder,
                authService: bridge.cognitoAuth,
                captureConsent: bridge.captureConsent,
                cameraActive: bridge.cameraActive
            )
        }
        #endif
        .modifier(NativePermissionAlerts(bridge: bridge))
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                bridge.sceneDidBecomeActive()
            } else if phase == .background {
                bridge.sceneDidEnterBackground()
            }
        }
        .onDisappear {
            bridge.stopCamera()
            bridge.stopSpeechCaptions()
        }
        #if DEBUG && targetEnvironment(simulator)
        .onAppear { bridge.startMockCameraIfRequested() }
        #endif
    }

    #if DEBUG
    private func cameraControls(iconOnly: Bool) -> some View {
        HStack(spacing: iconOnly ? 18 : 12) {
            Label("Camera active", systemImage: "camera.fill")
            Button(action: bridge.stopCamera) {
                Label("Stop camera", systemImage: "stop.fill")
            }
            .accessibilityHint("Stops camera capture immediately.")
            Menu {
                Button {
                    showsLandmarkInspector = true
                } label: {
                    Label("Landmarks", systemImage: "viewfinder")
                }
                .accessibilityHint("Inspect the latest hand landmarks in memory.")
                Button {
                    showsTrialRecorder = true
                } label: {
                    Label("Capture trials", systemImage: "record.circle")
                }
            } label: {
                Label("Debug", systemImage: "ladybug")
            }
            .accessibilityIdentifier("debugMenu")
        }
        .labelStyle(iconOnly ? AnyLabelStyle(.iconOnly) : AnyLabelStyle(.titleAndIcon))
        .font(.subheadline.weight(.semibold))
        .fixedSize()
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .glassBackground(in: Capsule())
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("cameraDebugBar")
    }
    #endif
}

#if DEBUG
private struct AnyLabelStyle: LabelStyle {
    private let make: (Configuration) -> AnyView

    init<S: LabelStyle>(_ style: S) {
        make = { AnyView(Label($0).labelStyle(style)) }
    }

    func makeBody(configuration: Configuration) -> some View {
        make(configuration)
    }
}
#endif

#if DEBUG && targetEnvironment(simulator)
private struct MockCameraPreview: View {
    let camera: CameraCaptureService

    var body: some View {
        LinearGradient(colors: [.teal, .indigo, .orange], startPoint: .topLeading, endPoint: .bottomTrailing)
            .overlay {
                Label("Simulated camera", systemImage: "camera.metering.unknown")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)
            }
            .overlay {
                TimelineView(.periodic(from: .now, by: 1.0 / 12.0)) { _ in
                    HandLandmarkOverlay(snapshot: camera.latestPreviewSnapshot, previewRotation: 0, mirrored: true)
                }
            }
            .accessibilityIdentifier("mockCameraPreview")
    }
}
#endif

extension View {
    /// Liquid Glass on iOS 26+, translucent material earlier, so the camera preview stays visible behind controls.
    @ViewBuilder
    func glassBackground<S: Shape>(in shape: S) -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(.regular, in: shape)
        } else {
            background(.ultraThinMaterial, in: shape)
        }
    }

    @ViewBuilder
    func transparentNavigationContainer() -> some View {
        if #available(iOS 18.0, *) {
            containerBackground(.clear, for: .navigation)
        } else {
            self
        }
    }
}

struct NativePermissionAlerts: ViewModifier {
    @ObservedObject var bridge: NativeBridgeCoordinator

    func body(content: Content) -> some View {
        // Capture the presented item so its dismissal cannot clear the next queued prompt.
        let presented = bridge.permissionPrompt
        content
            .alert(
                item: Binding(
                    get: { bridge.permissionPrompt },
                    set: { prompt in
                        if prompt == nil, let presented {
                            bridge.clearPermissionPrompt(presented)
                        }
                    }
                )
            ) { prompt in
                switch prompt {
                case .camera(let prompt):
                    cameraAlert(prompt)
                case .microphone(let prompt):
                    microphoneAlert(prompt)
                }
            }
    }

    private func cameraAlert(_ prompt: CameraPermissionPrompt) -> Alert {
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

    private func microphoneAlert(_ prompt: MicrophonePermissionPrompt) -> Alert {
        switch prompt {
        case .rationale:
            Alert(
                title: Text(prompt.title),
                message: Text(prompt.message),
                primaryButton: .default(Text("Continue"), action: bridge.confirmMicrophonePermission),
                secondaryButton: .cancel(Text("Not now"), action: bridge.cancelSpeechCaptions)
            )
        case .denied:
            Alert(
                title: Text(prompt.title),
                message: Text(prompt.message),
                primaryButton: .default(Text("Open Settings"), action: bridge.openMicrophoneSettings),
                secondaryButton: .cancel(Text("Type instead"), action: bridge.cancelSpeechCaptions)
            )
        case .restricted:
            Alert(
                title: Text(prompt.title),
                message: Text(prompt.message),
                dismissButton: .default(Text("OK"), action: bridge.cancelSpeechCaptions)
            )
        }
    }
}

#if DEBUG
private struct LandmarkFrameInspector: View {
    @Environment(\.dismiss) private var dismiss
    let camera: CameraCaptureService

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
                                for (startIndex, endIndex) in HandLandmarkGeometry.bones {
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
