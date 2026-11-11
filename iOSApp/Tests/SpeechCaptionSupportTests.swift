import XCTest
@testable import SignifyGesture

final class SpeechCaptionSupportTests: XCTestCase {
    func testAssemblerShowsVolatileTextAfterCommittedText() {
        var assembler = UtteranceAssembler()
        XCTAssertEqual(assembler.apply(text: "Hi there.", isFinal: true), "Hi there.")
        XCTAssertEqual(assembler.apply(text: "what can", isFinal: false), "Hi there. what can")
        XCTAssertTrue(assembler.hasVolatileText)
        XCTAssertEqual(assembler.apply(text: "What can I get you?", isFinal: true), "Hi there. What can I get you?")
        XCTAssertFalse(assembler.hasVolatileText)
    }

    func testAssemblerCommitReturnsWholeUtteranceAndResets() {
        var assembler = UtteranceAssembler()
        _ = assembler.apply(text: "Oat milk", isFinal: false)
        XCTAssertEqual(assembler.commit(), "Oat milk")
        XCTAssertTrue(assembler.isEmpty)
        XCTAssertNil(assembler.commit())
    }

    func testAssemblerIgnoresWhitespaceOnlyResults() {
        var assembler = UtteranceAssembler()
        _ = assembler.apply(text: "   ", isFinal: true)
        XCTAssertNil(assembler.commit())
    }

    func testAudioLevelMeterMapsSilenceAndLoudSignal() {
        XCTAssertEqual(AudioLevelMeter.normalizedLevel(samples: [Float](repeating: 0, count: 256)), 0)
        XCTAssertEqual(AudioLevelMeter.normalizedLevel(samples: []), 0)
        let loud = AudioLevelMeter.normalizedLevel(samples: [Float](repeating: 1, count: 256))
        XCTAssertEqual(loud, 1, accuracy: 0.001)
        let quiet = AudioLevelMeter.normalizedLevel(samples: [Float](repeating: 0.01, count: 256))
        XCTAssertGreaterThan(quiet, 0)
        XCTAssertLessThan(quiet, loud)
    }
}
