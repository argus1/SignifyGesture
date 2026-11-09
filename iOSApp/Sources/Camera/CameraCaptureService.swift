import AVFoundation
import Combine
import Vision

enum CameraTrackingState: String, Equatable {
    case idle
    case tracking
    case lost
}

struct LandmarkFrame {
    static let handCount = 2
    static let jointCount = 21
    static let valueCount = handCount * jointCount * 3

    let values: [Float]
    let timestamp: TimeInterval
}

enum CameraCaptureError: LocalizedError {
    case permissionDenied
    case cameraUnavailable

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Camera permission was denied."
        case .cameraUnavailable:
            return "A front-facing camera is unavailable."
        }
    }
}

final class CameraCaptureService: NSObject, ObservableObject {
    let session = AVCaptureSession()

    private let sessionQueue = DispatchQueue(label: "com.argussun.signifygesture.camera-session")
    private let frameQueue = DispatchQueue(label: "com.argussun.signifygesture.camera-frames", qos: .userInitiated)
    private let videoOutput = AVCaptureVideoDataOutput()
    private var isConfigured = false
    private var lastVisionTime: TimeInterval = 0
    private let minimumFrameInterval: TimeInterval = 1.0 / 12.0

    var onTrackingStateChange: ((CameraTrackingState) -> Void)?
    var onPoseFrame: ((LandmarkFrame) -> Void)?
    var onError: ((String) -> Void)?

    @Published private(set) var trackingState: CameraTrackingState = .idle

    func start(completion: @escaping (Result<Void, Error>) -> Void) {
        AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
            guard let self else { return }
            guard granted else {
                DispatchQueue.main.async {
                    completion(.failure(CameraCaptureError.permissionDenied))
                }
                return
            }

            self.sessionQueue.async {
                do {
                    try self.configureIfNeeded()
                    if !self.session.isRunning {
                        self.session.startRunning()
                    }
                    DispatchQueue.main.async {
                        completion(.success(()))
                    }
                } catch {
                    DispatchQueue.main.async {
                        completion(.failure(error))
                    }
                }
            }
        }
    }

    func stop(completion: (() -> Void)? = nil) {
        sessionQueue.async {
            if self.session.isRunning {
                self.session.stopRunning()
            }
            DispatchQueue.main.async {
                self.setTrackingState(.idle)
                completion?()
            }
        }
    }

    private func configureIfNeeded() throws {
        guard !isConfigured else { return }
        guard let camera = AVCaptureDevice.default(
            .builtInWideAngleCamera,
            for: .video,
            position: .front
        ) else {
            throw CameraCaptureError.cameraUnavailable
        }

        let input = try AVCaptureDeviceInput(device: camera)
        session.beginConfiguration()
        session.sessionPreset = .vga640x480
        defer { session.commitConfiguration() }

        guard session.canAddInput(input), session.canAddOutput(videoOutput) else {
            throw CameraCaptureError.cameraUnavailable
        }
        session.addInput(input)

        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        videoOutput.setSampleBufferDelegate(self, queue: frameQueue)
        session.addOutput(videoOutput)

        if let connection = videoOutput.connection(with: .video),
           connection.isVideoMirroringSupported {
            connection.isVideoMirrored = true
        }
        isConfigured = true
    }

    private func setTrackingState(_ state: CameraTrackingState) {
        guard trackingState != state else { return }
        trackingState = state
        onTrackingStateChange?(state)
    }

    private func handPoseFrame(
        from observations: [VNHumanHandPoseObservation],
        timestamp: TimeInterval
    ) throws -> LandmarkFrame {
        let joints: [VNHumanHandPoseObservation.JointName] = [
            .wrist,
            .thumbCMC, .thumbMP, .thumbIP, .thumbTip,
            .indexMCP, .indexPIP, .indexDIP, .indexTip,
            .middleMCP, .middlePIP, .middleDIP, .middleTip,
            .ringMCP, .ringPIP, .ringDIP, .ringTip,
            .littleMCP, .littlePIP, .littleDIP, .littleTip
        ]
        var values = Array(repeating: Float.zero, count: LandmarkFrame.valueCount)
        var assignedHands = Set<Int>()

        for observation in observations {
            let handIndex = observation.chirality == .left ? 0 : 1
            guard assignedHands.insert(handIndex).inserted else { continue }
            let recognizedPoints = try observation.recognizedPoints(.all)
            for (jointIndex, joint) in joints.enumerated() {
                guard let point = recognizedPoints[joint], point.confidence > 0 else { continue }
                let offset = (handIndex * LandmarkFrame.jointCount + jointIndex) * 3
                values[offset] = Float(point.location.x)
                values[offset + 1] = Float(point.location.y)
                values[offset + 2] = Float(point.confidence)
            }
        }

        return LandmarkFrame(values: values, timestamp: timestamp)
    }
}

extension CameraCaptureService: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer).seconds
        guard timestamp - lastVisionTime >= minimumFrameInterval else { return }
        lastVisionTime = timestamp

        let request = VNDetectHumanHandPoseRequest()
        request.maximumHandCount = LandmarkFrame.handCount
        do {
            try VNImageRequestHandler(cmSampleBuffer: sampleBuffer, orientation: .up).perform([request])
            guard let observations = request.results, !observations.isEmpty else {
                DispatchQueue.main.async { self.setTrackingState(.lost) }
                return
            }

            let frame = try handPoseFrame(from: observations, timestamp: timestamp)
            onPoseFrame?(frame)
            DispatchQueue.main.async { self.setTrackingState(.tracking) }
        } catch {
            DispatchQueue.main.async {
                self.setTrackingState(.lost)
                self.onError?(error.localizedDescription)
            }
        }
    }
}
