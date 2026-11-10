import AVFoundation
import SwiftUI

struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession
    let onError: (String) -> Void

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.onError = onError
        view.setSession(session)
        view.previewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {
        view.onError = onError
        view.setSession(session)
    }
}

final class PreviewView: UIView {
    var onError: ((String) -> Void)?
    private var rotationCoordinator: AVCaptureDevice.RotationCoordinator?
    private var rotationObservation: NSKeyValueObservation?
    private var reportedUnsupportedRotation = false

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
        updateRotation()
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
