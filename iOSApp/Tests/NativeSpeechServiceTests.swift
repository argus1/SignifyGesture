import AVFoundation
import XCTest
@testable import SignifyGesture

private final class TestSpeechSynthesizer: SpeechSynthesizing {
    weak var delegate: AVSpeechSynthesizerDelegate?
    var utterances: [AVSpeechUtterance] = []
    var stopCount = 0
    var onSpeak: (() -> Void)?

    func speak(_ utterance: AVSpeechUtterance) {
        onSpeak?()
        utterances.append(utterance)
    }

    func stopSpeaking(at boundary: AVSpeechBoundary) -> Bool {
        stopCount += 1
        return true
    }
}

private final class TestSpeechAudioSession: SpeechAudioSessionManaging {
    var fails = false
    var endCount = 0
    func beginSpeaking() throws {
        if fails { throw NSError(domain: "SpeechTest", code: 1) }
    }
    func endSpeaking() { endCount += 1 }
}

@MainActor
final class NativeSpeechServiceTests: XCTestCase {
    private func drainMainQueue() async {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { continuation.resume() }
        }
    }

    func testBlankTextDoesNotSubmitPlayback() async {
        let synth = TestSpeechSynthesizer()
        let service = NativeSpeechService(audioSession: TestSpeechAudioSession(), synthesizer: synth)
        XCTAssertThrowsError(try service.speak(" \n "))
        await drainMainQueue()
        XCTAssertTrue(synth.utterances.isEmpty)
    }

    func testCaptureSuppressionPrecedesAudioAndStopDoesNotWaitForDelegate() async throws {
        let synth = TestSpeechSynthesizer()
        let audio = TestSpeechAudioSession()
        let service = NativeSpeechService(audioSession: audio, synthesizer: synth)
        var states: [Bool] = []
        service.setPlaybackStateChangeHandler { states.append($0) }
        synth.onSpeak = { XCTAssertEqual(states, [true]) }
        try service.speak("Hello")
        await drainMainQueue()
        XCTAssertEqual(synth.utterances.count, 1)
        service.stop()
        await drainMainQueue()
        XCTAssertEqual(states, [true, false])
        XCTAssertEqual(audio.endCount, 1)
        XCTAssertEqual(synth.stopCount, 1)
        let old = try XCTUnwrap(synth.utterances.first)
        service.speechSynthesizer(AVSpeechSynthesizer(), didCancel: old)
        await drainMainQueue()
        XCTAssertEqual(states, [true, false])
    }

    func testAudioSessionFailureReportsErrorWithoutSpeaking() async throws {
        let synth = TestSpeechSynthesizer()
        let audio = TestSpeechAudioSession()
        audio.fails = true
        let service = NativeSpeechService(audioSession: audio, synthesizer: synth)
        var message: String?
        service.setErrorHandler { message = $0 }
        try service.speak("Hello")
        await drainMainQueue()
        XCTAssertTrue(synth.utterances.isEmpty)
        XCTAssertTrue(message?.contains("Couldn't start spoken playback") == true)
    }

    func testInterruptionStopsWithoutAutomaticallyResuming() async throws {
        let synth = TestSpeechSynthesizer()
        let service = NativeSpeechService(audioSession: TestSpeechAudioSession(), synthesizer: synth)
        var states: [Bool] = []
        service.setPlaybackStateChangeHandler { states.append($0) }
        try service.speak("Hello")
        await drainMainQueue()
        NotificationCenter.default.post(
            name: AVAudioSession.interruptionNotification, object: nil,
            userInfo: [AVAudioSessionInterruptionTypeKey: AVAudioSession.InterruptionType.began.rawValue]
        )
        await drainMainQueue()
        XCTAssertEqual(states, [true, false])
        XCTAssertEqual(synth.stopCount, 1)
    }

    func testReplacementIgnoresOldCompletionAndForwardsWordProgress() async throws {
        let synth = TestSpeechSynthesizer()
        let service = NativeSpeechService(audioSession: TestSpeechAudioSession(), synthesizer: synth)
        var states: [Bool] = []
        var progress: SpeechProgress?
        service.setPlaybackStateChangeHandler { states.append($0) }
        service.setProgressHandler { progress = $0 }
        try service.speak("First")
        await drainMainQueue()
        let old = try XCTUnwrap(synth.utterances.first)
        try service.speak("Second message")
        await drainMainQueue()
        let current = try XCTUnwrap(synth.utterances.last)
        let nativeSynth = AVSpeechSynthesizer()
        service.speechSynthesizer(nativeSynth, didCancel: old)
        service.speechSynthesizer(
            nativeSynth, willSpeakRangeOfSpeechString: NSRange(location: 7, length: 7), utterance: current
        )
        await drainMainQueue()
        XCTAssertEqual(states, [true, true])
        XCTAssertEqual(progress, SpeechProgress(text: "Second message", location: 7, length: 7))
        service.speechSynthesizer(nativeSynth, didFinish: current)
        await drainMainQueue()
        XCTAssertEqual(states, [true, true, false])
    }
}
