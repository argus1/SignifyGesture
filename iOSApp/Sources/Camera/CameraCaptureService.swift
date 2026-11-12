import AVFoundation
import Combine
import Vision

enum CameraTrackingState: String, Equatable {
    case idle
    case tracking
    case lost
}

enum LandmarkHandSide: Int, Hashable {
    case left = 0
    case right = 1

    init(chirality: VNChirality) throws {
        switch chirality {
        case .left:
            self = .left
        case .right:
            self = .right
        case .unknown:
            throw HandPoseGeometryError.unknownChirality
        @unknown default:
            throw HandPoseGeometryError.unknownChirality
        }
    }
}

enum HandPoseGeometryError: LocalizedError {
    case unknownChirality
    case rotationUnsupported

    var errorDescription: String? {
        switch self {
        case .unknownChirality:
            return "Vision could not determine the hand's left/right side. Face an open palm toward the camera."
        case .rotationUnsupported:
            return "This camera cannot provide upright hand-pose frames."
        }
    }
}

struct LandmarkPoint {
    let x: Float
    let y: Float
    let confidence: Float
}

struct LandmarkHand {
    let side: LandmarkHandSide
    let points: [LandmarkPoint?]
}

struct LandmarkFrame {
    static let handCount = 2
    static let jointCount = 21
    static let valueCount = handCount * jointCount * 3

    static let joints: [VNHumanHandPoseObservation.JointName] = [
        .wrist,
        .thumbCMC, .thumbMP, .thumbIP, .thumbTip,
        .indexMCP, .indexPIP, .indexDIP, .indexTip,
        .middleMCP, .middlePIP, .middleDIP, .middleTip,
        .ringMCP, .ringPIP, .ringDIP, .ringTip,
        .littleMCP, .littlePIP, .littleDIP, .littleTip
    ]

    let values: [Float]
    let timestamp: TimeInterval

    #if DEBUG && targetEnvironment(simulator)
    init(mockValues: [Float], timestamp: TimeInterval) {
        values = mockValues
        self.timestamp = timestamp
    }
    #endif

    init(hands: [LandmarkHand], timestamp: TimeInterval, sourceIsMirrored: Bool) {
        var values = Array(repeating: Float.zero, count: Self.valueCount)
        for side in [LandmarkHandSide.left, .right] {
            let candidates = hands
                .filter { $0.side == side }
                .sorted {
                    Self.isPreferred($0, over: $1, sourceIsMirrored: sourceIsMirrored)
                }
            guard let hand = candidates.first else { continue }

            let handValues = Self.normalizedValues(for: hand, sourceIsMirrored: sourceIsMirrored)
            let offset = side.rawValue * Self.jointCount * 3
            values.replaceSubrange(offset..<(offset + handValues.count), with: handValues)
        }

        self.values = values
        self.timestamp = timestamp
    }

    private static func normalizedValues(
        for hand: LandmarkHand,
        sourceIsMirrored: Bool
    ) -> [Float] {
        (0..<jointCount).flatMap { jointIndex -> [Float] in
            guard hand.points.indices.contains(jointIndex),
                  let point = hand.points[jointIndex],
                  point.x.isFinite,
                  point.y.isFinite,
                  point.confidence.isFinite,
                  point.confidence > 0 else {
                return [0, 0, 0]
            }

            let x = sourceIsMirrored ? 1 - point.x : point.x
            return [
                min(max(x, 0), 1),
                min(max(1 - point.y, 0), 1),
                min(max(point.confidence, 0), 1)
            ]
        }
    }

    private static func isPreferred(
        _ lhs: LandmarkHand,
        over rhs: LandmarkHand,
        sourceIsMirrored: Bool
    ) -> Bool {
        let lhsValues = normalizedValues(for: lhs, sourceIsMirrored: sourceIsMirrored)
        let rhsValues = normalizedValues(for: rhs, sourceIsMirrored: sourceIsMirrored)
        let confidenceIndices = stride(from: 2, to: valueCount / handCount, by: 3)
        let lhsConfidence = confidenceIndices.reduce(Float.zero) { $0 + lhsValues[$1] }
        let rhsConfidence = confidenceIndices.reduce(Float.zero) { $0 + rhsValues[$1] }
        if lhsConfidence != rhsConfidence { return lhsConfidence > rhsConfidence }

        for index in lhsValues.indices where lhsValues[index] != rhsValues[index] {
            return lhsValues[index] < rhsValues[index]
        }
        return false
    }

    #if DEBUG
    var visibleJointCountByHand: [Int] {
        (0..<Self.handCount).map { handIndex in
            (0..<Self.jointCount).filter { jointIndex in
                let confidenceIndex = (handIndex * Self.jointCount + jointIndex) * 3 + 2
                return values[confidenceIndex] > 0
            }.count
        }
    }
    #endif
}

enum CameraCaptureError: LocalizedError {
    case permissionDenied
    case permissionRestricted
    case cameraUnavailable

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Camera access is off. Allow it in Settings to use hand-pose tracking."
        case .permissionRestricted:
            return "Camera access is restricted on this device."
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
    private var rotationCoordinator: AVCaptureDevice.RotationCoordinator?
    private var rotationObservation: NSKeyValueObservation?
    private var isConfigured = false
    private var lastVisionTime: TimeInterval = 0
    private let minimumFrameInterval: TimeInterval = 1.0 / 12.0
    #if DEBUG
    private let latestLandmarkFrameLock = NSLock()
    private var storedLatestLandmarkFrame: LandmarkFrame?

    var latestLandmarkFrame: LandmarkFrame? {
        latestLandmarkFrameLock.lock()
        defer { latestLandmarkFrameLock.unlock() }
        return storedLatestLandmarkFrame
    }

    private func storeLatestLandmarkFrame(_ frame: LandmarkFrame?) {
        latestLandmarkFrameLock.lock()
        storedLatestLandmarkFrame = frame
        latestLandmarkFrameLock.unlock()
    }
    #endif

    var onTrackingStateChange: ((CameraTrackingState) -> Void)?
    var onPoseFrame: ((LandmarkFrame) -> Void)?
    var onError: ((String) -> Void)?

    @Published private(set) var trackingState: CameraTrackingState = .idle

    var authorizationStatus: AVAuthorizationStatus {
        AVCaptureDevice.authorizationStatus(for: .video)
    }

    func start(completion: @escaping (Result<Void, Error>) -> Void) {
        switch authorizationStatus {
        case .authorized:
            startAuthorizedCapture(completion: completion)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                guard let self else { return }
                guard granted else {
                    DispatchQueue.main.async {
                        completion(.failure(CameraCaptureError.permissionDenied))
                    }
                    return
                }
                self.startAuthorizedCapture(completion: completion)
            }
        case .denied:
            DispatchQueue.main.async {
                completion(.failure(CameraCaptureError.permissionDenied))
            }
        case .restricted:
            DispatchQueue.main.async {
                completion(.failure(CameraCaptureError.permissionRestricted))
            }
        @unknown default:
            DispatchQueue.main.async {
                completion(.failure(CameraCaptureError.permissionRestricted))
            }
        }
    }

    private func startAuthorizedCapture(completion: @escaping (Result<Void, Error>) -> Void) {
        sessionQueue.async {
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

    func stop(completion: (() -> Void)? = nil) {
        sessionQueue.async {
            if self.session.isRunning {
                self.session.stopRunning()
            }
            #if DEBUG
            self.storeLatestLandmarkFrame(nil)
            #endif
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

        guard let connection = videoOutput.connection(with: .video) else {
            throw CameraCaptureError.cameraUnavailable
        }
        if connection.isVideoMirroringSupported {
            connection.automaticallyAdjustsVideoMirroring = false
            // Vision must classify anatomical handedness before any selfie mirroring.
            connection.isVideoMirrored = false
        }
        let coordinator = AVCaptureDevice.RotationCoordinator(device: camera, previewLayer: nil)
        try applyCaptureRotation(coordinator.videoRotationAngleForHorizonLevelCapture)
        rotationCoordinator = coordinator
        rotationObservation = coordinator.observe(
            \.videoRotationAngleForHorizonLevelCapture,
            options: [.new]
        ) { [weak self] coordinator, _ in
            let angle = coordinator.videoRotationAngleForHorizonLevelCapture
            self?.sessionQueue.async { [weak self] in
                guard let self else { return }
                do {
                    try self.applyCaptureRotation(angle)
                } catch {
                    self.stop {
                        self.onError?(error.localizedDescription)
                    }
                }
            }
        }
        isConfigured = true
    }

    private func applyCaptureRotation(_ angle: CGFloat) throws {
        guard let connection = videoOutput.connection(with: .video),
              connection.isVideoRotationAngleSupported(angle) else {
            throw HandPoseGeometryError.rotationUnsupported
        }
        // AVFoundation rotates the pixel buffer, so Vision's .up now matches its pixels.
        connection.videoRotationAngle = angle
    }

    private func setTrackingState(_ state: CameraTrackingState) {
        guard trackingState != state else { return }
        trackingState = state
        onTrackingStateChange?(state)
    }

    private func handPoseFrame(
        from observations: [VNHumanHandPoseObservation],
        timestamp: TimeInterval,
        sourceIsMirrored: Bool
    ) throws -> LandmarkFrame {
        let hands = try observations.map { observation in
            let recognizedPoints = try observation.recognizedPoints(.all)
            let points = LandmarkFrame.joints.map { joint -> LandmarkPoint? in
                guard let point = recognizedPoints[joint] else { return nil }
                return LandmarkPoint(
                    x: Float(point.location.x),
                    y: Float(point.location.y),
                    confidence: Float(point.confidence)
                )
            }
            let side = try LandmarkHandSide(chirality: observation.chirality)
            return LandmarkHand(side: side, points: points)
        }

        return LandmarkFrame(
            hands: hands,
            timestamp: timestamp,
            sourceIsMirrored: sourceIsMirrored
        )
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
                #if DEBUG
                storeLatestLandmarkFrame(nil)
                #endif
                DispatchQueue.main.async { self.setTrackingState(.lost) }
                return
            }

            let frame = try handPoseFrame(
                from: observations,
                timestamp: timestamp,
                sourceIsMirrored: connection.isVideoMirrored
            )
            #if DEBUG
            storeLatestLandmarkFrame(frame)
            #endif
            onPoseFrame?(frame)
            DispatchQueue.main.async { self.setTrackingState(.tracking) }
        } catch {
            #if DEBUG
            storeLatestLandmarkFrame(nil)
            #endif
            DispatchQueue.main.async {
                self.setTrackingState(.lost)
                self.onError?(error.localizedDescription)
            }
        }
    }
}
