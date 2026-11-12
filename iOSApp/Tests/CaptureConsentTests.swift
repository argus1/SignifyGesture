import XCTest
@testable import SignifyGesture

final class CaptureConsentTests: XCTestCase {
    func testFailedCleanupRevokesConsentAndBlocksRegrantUntilRetrySucceeds() {
        let consent = CaptureConsentState()
        var notifications: [Bool] = []
        consent.onChange = { notifications.append($0) }
        consent.setConsent(true)
        consent.onWithdraw = { throw CocoaError(.fileWriteNoPermission) }

        consent.setConsent(false)
        XCTAssertFalse(consent.isGranted)
        XCTAssertNotNil(consent.errorMessage)
        consent.setConsent(true)
        XCTAssertFalse(consent.isGranted)
        XCTAssertEqual(notifications, [true, false])

        consent.onWithdraw = {}
        consent.setConsent(false)
        XCTAssertNil(consent.errorMessage)
        consent.setConsent(true)
        XCTAssertTrue(consent.isGranted)
    }

    #if DEBUG
    func testWithdrawalClearsAcceptedPendingAndActiveCapture() throws {
        let recorder = DebugTrialRecorder()
        let consent = CaptureConsentState()
        consent.onWithdraw = { try recorder.clear() }
        consent.setConsent(true)
        try recorder.start(signerID: "S01", split: "train", gloss: "RESEARCH1",
                           consent: consent.isGranted, cameraActive: true)
        for index in 0..<16 {
            recorder.append(LandmarkFrame(
                hands: [LandmarkHand(side: .left, points: [LandmarkPoint(x: 0.2, y: 0.3, confidence: 0.9)])],
                timestamp: 100 + Double(index) / 12,
                sourceIsMirrored: false
            ))
        }
        recorder.stop()
        try recorder.accept()
        try recorder.start(signerID: "S01", split: "train", gloss: "RESEARCH1",
                           consent: consent.isGranted, cameraActive: true)
        consent.setConsent(false)

        XCTAssertFalse(recorder.isRecording)
        XCTAssertNil(recorder.pendingTrial)
        XCTAssertTrue(recorder.trials.isEmpty)
        XCTAssertThrowsError(try recorder.start(signerID: "S01", split: "train", gloss: "RESEARCH1",
                                               consent: consent.isGranted, cameraActive: true))
        XCTAssertThrowsError(try recorder.accept())
    }
    #endif
}
