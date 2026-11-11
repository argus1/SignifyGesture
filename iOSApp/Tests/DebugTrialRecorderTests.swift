#if DEBUG
import XCTest
@testable import SignifyGesture

final class DebugTrialRecorderTests: XCTestCase {
    private func frame(_ index: Int) -> LandmarkFrame {
        LandmarkFrame(
            hands: [LandmarkHand(side: .left, points: [
                LandmarkPoint(x: 0.2, y: 0.3, confidence: 0.9)
            ])],
            timestamp: 100 + Double(index) / 12,
            sourceIsMirrored: false
        )
    }

    private func capture(_ recorder: DebugTrialRecorder, signer: String = "S01",
                         split: String = "train", count: Int = 16) throws {
        try recorder.start(signerID: signer, split: split, gloss: "RESEARCH1",
                           consent: true, cameraActive: true)
        for index in 0..<count { recorder.append(frame(index)) }
        recorder.stop()
    }

    func testRequiresConsentCameraAndPseudonym() {
        let recorder = DebugTrialRecorder()
        XCTAssertThrowsError(try recorder.start(signerID: "S01", split: "train", gloss: "RESEARCH1",
                                               consent: false, cameraActive: true))
        XCTAssertThrowsError(try recorder.start(signerID: "S01", split: "train", gloss: "RESEARCH1",
                                               consent: true, cameraActive: false))
        XCTAssertThrowsError(try recorder.start(signerID: "a name", split: "train", gloss: "RESEARCH1",
                                               consent: true, cameraActive: true))
        XCTAssertThrowsError(try recorder.start(signerID: "S01", split: "unknown", gloss: "RESEARCH1",
                                               consent: true, cameraActive: true))
    }

    func testReviewAndAcceptPreservesFullSequenceAndRelativeTimes() throws {
        let recorder = DebugTrialRecorder()
        try capture(recorder)
        XCTAssertTrue(recorder.trials.isEmpty)
        let pending = try XCTUnwrap(recorder.pendingTrial)
        XCTAssertEqual(pending.frames.count, 16)
        XCTAssertEqual(pending.frames[0].elapsedMs, 0)
        XCTAssertEqual(pending.frames[15].elapsedMs, 1_250, accuracy: 0.001)
        XCTAssertEqual(pending.frames[0].values.count, 126)
        try recorder.accept()
        XCTAssertNil(recorder.pendingTrial)
        XCTAssertEqual(recorder.trials.count, 1)
    }

    func testRejectsSignerLeakageAndSixthTrial() throws {
        let recorder = DebugTrialRecorder()
        for _ in 0..<5 {
            try capture(recorder)
            try recorder.accept()
        }
        XCTAssertThrowsError(try capture(recorder, split: "test"))
        XCTAssertThrowsError(try capture(recorder))
        XCTAssertEqual(recorder.trials.count, 5)
    }

    func testShortInterruptedAndNonMonotonicTrialsAreDiscarded() throws {
        let recorder = DebugTrialRecorder()
        try capture(recorder, count: 15)
        XCTAssertNil(recorder.pendingTrial)
        XCTAssertNotNil(recorder.errorMessage)
        try recorder.start(signerID: "S01", split: "test", gloss: "CLOUD1",
                           consent: true, cameraActive: true)
        recorder.append(frame(0))
        recorder.append(frame(0))
        XCTAssertFalse(recorder.isRecording)
        XCTAssertNil(recorder.pendingTrial)
        try recorder.start(signerID: "S01", split: "test", gloss: "CLOUD1",
                           consent: true, cameraActive: true)
        recorder.interrupt("Camera stopped")
        recorder.append(frame(1))
        XCTAssertEqual(recorder.frameCount, 0)
        XCTAssertEqual(recorder.errorMessage, "Camera stopped")
    }

    func testFrameAndTimeLimitsStopCapture() throws {
        let recorder = DebugTrialRecorder()
        try capture(recorder, count: 121)
        XCTAssertFalse(recorder.isRecording)
        XCTAssertEqual(recorder.pendingTrial?.frames.count, 120)
        recorder.discardPending()
        try recorder.start(signerID: "S01", split: "test", gloss: "CLOUD1",
                           consent: true, cameraActive: true)
        try recorder.expireIfNeeded(now: Date().addingTimeInterval(11))
        XCTAssertFalse(recorder.isRecording)
        XCTAssertNil(recorder.pendingTrial)
    }

    func testPilotTargetAccepts75TrialsAndRejectsMore() throws {
        let recorder = DebugTrialRecorder()
        for signer in ["S01", "S02", "S03"] {
            for gloss in DebugTrialRecorder.glosses {
                for _ in 0..<5 {
                    try recorder.start(signerID: signer, split: "train", gloss: gloss,
                                       consent: true, cameraActive: true)
                    for index in 0..<16 { recorder.append(frame(index)) }
                    recorder.stop()
                    try recorder.accept()
                }
            }
        }
        XCTAssertEqual(recorder.trials.count, 75)
        XCTAssertThrowsError(try capture(recorder, signer: "S04"))
    }

    func testEmptyHandFrameIsNotAccepted() throws {
        let recorder = DebugTrialRecorder()
        try recorder.start(signerID: "S01", split: "train", gloss: "CLOUD1",
                           consent: true, cameraActive: true)
        recorder.append(LandmarkFrame(hands: [], timestamp: 100, sourceIsMirrored: false))
        XCTAssertFalse(recorder.isRecording)
        XCTAssertNil(recorder.pendingTrial)
        XCTAssertNotNil(recorder.errorMessage)
    }

    func testExportRoundTripAndExplicitDeletion() throws {
        let recorder = DebugTrialRecorder()
        let directory = FileManager.default.temporaryDirectory
        XCTAssertThrowsError(try recorder.export(deviceModel: "synthetic", operatingSystem: "test",
                                                 directory: directory))
        try capture(recorder)
        try recorder.accept()
        try recorder.export(deviceModel: "synthetic", operatingSystem: "test", directory: directory)
        let url = try XCTUnwrap(recorder.exportURL)
        defer { try? FileManager.default.removeItem(at: url) }
        let data = try Data(contentsOf: url)
        let payload = try JSONDecoder().decode(CapturedTrialExport.self, from: data)
        XCTAssertEqual(payload.schemaVersion, 1)
        XCTAssertEqual(payload.trials.count, 1)
        XCTAssertEqual(payload.trials[0].frames.count, 16)
        XCTAssertEqual(payload.deviceModel, "synthetic")
        XCTAssertEqual(payload.handOrder, ["left", "right"])
        XCTAssertEqual(payload.jointOrder.count, 21)
        XCTAssertEqual(payload.channels, ["x", "y", "confidence"])
        XCTAssertEqual(try url.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup, true)
        XCTAssertThrowsError(try capture(recorder, signer: "S02"))
        try recorder.clear()
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        XCTAssertNil(recorder.exportURL)
        XCTAssertTrue(recorder.trials.isEmpty)
    }

    func testRetentionExpiresSessionAndOnlyOwnOldExports() throws {
        let recorder = DebugTrialRecorder()
        try capture(recorder)
        try recorder.accept()
        try recorder.expireIfNeeded(now: Date().addingTimeInterval(86_401))
        XCTAssertTrue(recorder.trials.isEmpty)

        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let own = directory.appendingPathComponent("signify-debug-trials-test.json")
        let unrelated = directory.appendingPathComponent("unrelated.json")
        try Data().write(to: own)
        try Data().write(to: unrelated)
        defer {
            try? FileManager.default.removeItem(at: unrelated)
            try? FileManager.default.removeItem(at: directory)
        }
        try DebugTrialRecorder.deleteExpiredExports(in: directory, now: Date().addingTimeInterval(86_401))
        XCTAssertFalse(FileManager.default.fileExists(atPath: own.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: unrelated.path))
    }

    func testCognitoConfigurationRequiresHTTPSAndBuildsPKCEAuthorizationRequest() throws {
        XCTAssertThrowsError(try CognitoAuthConfiguration(
            hostedUIDomain: "http://example.auth.us-west-2.amazoncognito.com",
            clientID: "public-client"
        ))
        XCTAssertThrowsError(try CognitoAuthConfiguration(
            hostedUIDomain: "https://example.auth.us-west-2.amazoncognito.com",
            clientID: " "
        ))

        let configuration = try CognitoAuthConfiguration(
            hostedUIDomain: "https://example.auth.us-west-2.amazoncognito.com",
            clientID: "public-client"
        )
        let url = try configuration.authorizationURL(state: "random-state", codeChallenge: "pkce-challenge")
        let components = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
        let query = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).compactMap {
            item in item.value.map { (item.name, $0) }
        })

        XCTAssertEqual(components.path, "/oauth2/authorize")
        XCTAssertEqual(query["client_id"], "public-client")
        XCTAssertEqual(query["response_type"], "code")
        XCTAssertEqual(query["redirect_uri"], "signifygesture://auth/callback")
        XCTAssertEqual(query["scope"], "openid offline_access")
        XCTAssertEqual(query["state"], "random-state")
        XCTAssertEqual(query["code_challenge"], "pkce-challenge")
        XCTAssertEqual(query["code_challenge_method"], "S256")
    }
}
#endif
