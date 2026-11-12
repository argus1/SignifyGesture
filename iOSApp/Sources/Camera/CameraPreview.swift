import AVFoundation
import SwiftUI

struct CameraPreview: UIViewRepresentable {
    let camera: CameraCaptureService
    let onError: (String) -> Void

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.onError = onError
        view.landmarkSnapshot = { [weak camera] in camera?.latestPreviewSnapshot }
        view.setSession(camera.session)
        view.previewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {
        view.onError = onError
        view.landmarkSnapshot = { [weak camera] in camera?.latestPreviewSnapshot }
        view.setSession(camera.session)
    }

    static func dismantleUIView(_ view: PreviewView, coordinator: ()) {
        view.stopLandmarkUpdates()
    }
}

final class PreviewView: UIView {
    var onError: ((String) -> Void)?
    var landmarkSnapshot: (() -> LandmarkPreviewSnapshot?)?
    private var rotationCoordinator: AVCaptureDevice.RotationCoordinator?
    private var rotationObservation: NSKeyValueObservation?
    private var reportedUnsupportedRotation = false
    private var landmarkTimer: Timer?
    private let landmarkOverlay = UIHostingController(
        rootView: HandLandmarkOverlay(snapshot: nil, previewRotation: 0, mirrored: true)
    )

    override init(frame: CGRect) {
        super.init(frame: frame)
        landmarkOverlay.safeAreaRegions = []
        landmarkOverlay.view.backgroundColor = .clear
        landmarkOverlay.view.isUserInteractionEnabled = false
        addSubview(landmarkOverlay.view)
        clipsToBounds = true
    }

    required init?(coder: NSCoder) {
        fatalError("PreviewView must be created programmatically.")
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        stopLandmarkUpdates()
        guard window != nil else { return }
        let timer = Timer(timeInterval: 1.0 / 12.0, repeats: true) { [weak self] _ in
            self?.refreshLandmarks()
        }
        landmarkTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    func stopLandmarkUpdates() {
        landmarkTimer?.invalidate()
        landmarkTimer = nil
        landmarkOverlay.rootView = HandLandmarkOverlay(snapshot: nil, previewRotation: 0, mirrored: true)
    }

    private func refreshLandmarks() {
        landmarkOverlay.rootView = HandLandmarkOverlay(
            snapshot: landmarkSnapshot?(),
            previewRotation: previewLayer.connection?.videoRotationAngle ?? 0,
            mirrored: previewLayer.connection?.isVideoMirrored == true
        )
    }

    override class var layerClass: AnyClass {
        AVCaptureVideoPreviewLayer.self
    }

    var previewLayer: AVCaptureVideoPreviewLayer {
        layer as! AVCaptureVideoPreviewLayer
    }

    func setSession(_ session: AVCaptureSession) {
        if previewLayer.session !== session {
            rotationObservation = nil
            rotationCoordinator = nil
            previewLayer.session = session
        }
        guard let device = session.inputs.compactMap({ $0 as? AVCaptureDeviceInput }).first?.device,
              rotationCoordinator?.device !== device else { return }

        let coordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: previewLayer)
        rotationCoordinator = coordinator
        rotationObservation = coordinator.observe(
            \.videoRotationAngleForHorizonLevelPreview,
            options: [.initial, .new]
        ) { [weak self] _, _ in
            self?.updateRotation()
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        landmarkOverlay.view.frame = bounds
        updateRotation()
        refreshLandmarks()
    }

    private func updateRotation() {
        guard let coordinator = rotationCoordinator,
              let connection = previewLayer.connection else { return }
        let angle = coordinator.videoRotationAngleForHorizonLevelPreview
        guard connection.isVideoRotationAngleSupported(angle) else {
            if !reportedUnsupportedRotation {
                reportedUnsupportedRotation = true
                onError?("The camera preview cannot rotate to the current device orientation.")
            }
            return
        }
        reportedUnsupportedRotation = false
        connection.videoRotationAngle = angle
        if connection.isVideoMirroringSupported {
            connection.automaticallyAdjustsVideoMirroring = false
            connection.isVideoMirrored = coordinator.device?.position == .front
        }
    }
}
