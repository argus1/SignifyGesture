#if DEBUG
import Combine
import Foundation

struct CapturedTrialFrame: Codable {
    let elapsedMs: Double
    let values: [Float]
}

struct CapturedSignTrial: Codable, Identifiable {
    let id: UUID
    let signerID: String
    let split: String
    let gloss: String
    let frames: [CapturedTrialFrame]
}

struct CapturedTrialExport: Codable {
    let schemaVersion: Int
    let purpose: String
    let coordinateContract: String
    let handOrder: [String]
    let jointOrder: [String]
    let channels: [String]
    let deviceModel: String
    let operatingSystem: String
    let trials: [CapturedSignTrial]
}

enum TrialCaptureError: LocalizedError {
    case invalid(String)

    var errorDescription: String? {
        switch self {
        case .invalid(let message): return message
        }
    }
}

final class DebugTrialRecorder: ObservableObject {
    static let glosses = ["RESEARCH1", "DEVELOP1", "CLOUD1", "EDIT1", "DECIDE1"]
    static let splits = ["train", "validation", "test"]
    static let maximumFrames = 120
    static let maximumTrials = 75

    @Published private(set) var isRecording = false
    @Published private(set) var frameCount = 0
    @Published private(set) var pendingTrial: CapturedSignTrial?
    @Published private(set) var trials: [CapturedSignTrial] = []
    @Published private(set) var exportURL: URL?
    @Published var errorMessage: String?

    private var frames: [CapturedTrialFrame] = []
    private var firstTimestamp: TimeInterval?
    private var trialMetadata: (signer: String, split: String, gloss: String)?
    private var sessionStartedAt: Date?
    private var recordingStartedAt: Date?

    init() {
        do {
            try Self.deleteExpiredExports(in: FileManager.default.temporaryDirectory)
        } catch {
            errorMessage = "Could not remove expired exports: \(error.localizedDescription)"
        }
    }

    static func deleteExpiredExports(in directory: URL, now: Date = Date()) throws {
        let files = try FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: [.contentModificationDateKey]
        )
        for file in files where file.lastPathComponent.hasPrefix("signify-debug-trials-") &&
            file.pathExtension == "json" {
            let values = try file.resourceValues(forKeys: [.contentModificationDateKey])
            guard let modified = values.contentModificationDate else {
                throw TrialCaptureError.invalid("Cannot determine export age for retention cleanup.")
            }
            if now.timeIntervalSince(modified) >= 24 * 60 * 60 {
                try FileManager.default.removeItem(at: file)
            }
        }
    }

    func start(signerID: String, split: String, gloss: String, consent: Bool, cameraActive: Bool) throws {
        guard consent else { throw TrialCaptureError.invalid("Confirm informed consent before recording.") }
        guard cameraActive else { throw TrialCaptureError.invalid("Start the camera before recording.") }
        guard !isRecording, pendingTrial == nil else {
            throw TrialCaptureError.invalid("Review or discard the current trial first.")
        }
        guard exportURL == nil else {
            throw TrialCaptureError.invalid("Delete the prepared export before changing this session.")
        }
        let signer = signerID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard signer.range(of: "^S[0-9]{2}$", options: .regularExpression) != nil else {
            throw TrialCaptureError.invalid("Use a pseudonymous code S01–S99, not a name.")
        }
        guard Self.splits.contains(split), Self.glosses.contains(gloss) else {
            throw TrialCaptureError.invalid("Select a supported split and gloss.")
        }
        guard trials.count < Self.maximumTrials else {
            throw TrialCaptureError.invalid("Session limit reached: export or discard these 75 trials.")
        }
        guard !trials.contains(where: { $0.signerID == signer && $0.split != split }) else {
            throw TrialCaptureError.invalid("Keep every trial from this signer in the same split.")
        }
        guard trials.filter({ $0.signerID == signer && $0.gloss == gloss }).count < 5 else {
            throw TrialCaptureError.invalid("Five trials already accepted for this signer/gloss.")
        }
        sessionStartedAt = sessionStartedAt ?? Date()
        recordingStartedAt = Date()
        trialMetadata = (signer, split, gloss)
        frames = []
        firstTimestamp = nil
        frameCount = 0
        errorMessage = nil
        isRecording = true
    }

    func append(_ frame: LandmarkFrame) {
        guard isRecording else { return }
        guard frame.timestamp.isFinite,
              frame.values.count == LandmarkFrame.valueCount,
              frame.values.allSatisfy({ $0.isFinite && (0...1).contains($0) }),
              stride(from: 2, to: frame.values.count, by: 3).contains(where: { frame.values[$0] > 0 }) else {
            interrupt("Invalid or empty landmark frame. Trial discarded; please retry.")
            return
        }
        let start = firstTimestamp ?? frame.timestamp
        let elapsed = (frame.timestamp - start) * 1_000
        guard elapsed >= 0, frames.last.map({ elapsed > $0.elapsedMs }) ?? true else {
            interrupt("Landmark timestamps are not increasing. Trial discarded; please retry.")
            return
        }
        guard elapsed <= 10_000 else {
            stop()
            return
        }
        firstTimestamp = start
        frames.append(CapturedTrialFrame(elapsedMs: elapsed, values: frame.values))
        frameCount = frames.count
        if frames.count == Self.maximumFrames { stop() }
    }

    func stop() {
        guard isRecording, let metadata = trialMetadata else { return }
        isRecording = false
        trialMetadata = nil
        guard frames.count >= 16 else {
            frames = []
            frameCount = 0
            errorMessage = "Fewer than 16 landmark frames captured. Trial discarded; please retry."
            return
        }
        pendingTrial = CapturedSignTrial(
            id: UUID(), signerID: metadata.signer, split: metadata.split,
            gloss: metadata.gloss, frames: frames
        )
        frames = []
    }

    func accept() throws {
        guard let pendingTrial else { throw TrialCaptureError.invalid("No trial is ready for review.") }
        trials.append(pendingTrial)
        discardPending()
    }

    func discardPending() {
        pendingTrial = nil
        frameCount = 0
    }

    func interrupt(_ message: String) {
        guard isRecording else { return }
        isRecording = false
        frames = []
        frameCount = 0
        firstTimestamp = nil
        trialMetadata = nil
        errorMessage = message
    }

    func export(deviceModel: String, operatingSystem: String, directory: URL) throws {
        guard !isRecording, pendingTrial == nil, !trials.isEmpty else {
            throw TrialCaptureError.invalid("Accept or discard the current trial and capture at least one trial before exporting.")
        }
        guard exportURL == nil else { return }
        let payload = CapturedTrialExport(
            schemaVersion: 1,
            purpose: "Consented pilot capture; not evidence of model accuracy or sufficient training data.",
            coordinateContract: "Variable-length frames; each 126 floats: anatomical left then right, 21 Vision joints, x/y/confidence; top-left origin, unmirrored, normalized 0...1; absent joints zero. elapsedMs is relative to first frame. No depth, video or audio.",
            handOrder: ["left", "right"],
            jointOrder: LandmarkFrame.joints.map { $0.rawValue.rawValue },
            channels: ["x", "y", "confidence"],
            deviceModel: deviceModel, operatingSystem: operatingSystem, trials: trials
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(payload)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var url = directory.appendingPathComponent("signify-debug-trials-\(UUID().uuidString).json")
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        exportURL = url
        var resources = URLResourceValues()
        resources.isExcludedFromBackup = true
        try url.setResourceValues(resources)
    }

    func deleteExport() throws {
        if let exportURL {
            try FileManager.default.removeItem(at: exportURL)
            self.exportURL = nil
        }
    }

    func clear() throws {
        interrupt("Capture stopped.")
        try deleteExport()
        trials = []
        discardPending()
        sessionStartedAt = nil
    }

    func expireIfNeeded(now: Date = Date()) throws {
        if isRecording, let recordingStartedAt, now.timeIntervalSince(recordingStartedAt) >= 10 {
            stop()
        }
        if let sessionStartedAt, now.timeIntervalSince(sessionStartedAt) >= 24 * 60 * 60 {
            try clear()
            errorMessage = "The 24-hour session retention limit was reached. Local trials and export deleted."
        }
    }
}
#endif
