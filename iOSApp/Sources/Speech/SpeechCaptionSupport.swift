import AVFoundation
import Foundation

/// Assembles one caption bubble ("utterance") from recognizer results.
///
/// Recognizers report finalized segments plus a volatile (still-changing) tail. The web UI wants one
/// growing partial caption per utterance that is finalized once after the speaker pauses.
struct UtteranceAssembler: Equatable {
    private(set) var committed = ""
    private(set) var volatile = ""

    var displayText: String {
        Self.join(committed, volatile)
    }

    var hasVolatileText: Bool { !volatile.isEmpty }
    var isEmpty: Bool { committed.isEmpty && volatile.isEmpty }

    /// Applies a recognizer result and returns the text to show as a partial caption.
    @discardableResult
    mutating func apply(text: String, isFinal: Bool) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if isFinal {
            committed = Self.join(committed, trimmed)
            volatile = ""
        } else {
            volatile = trimmed
        }
        return displayText
    }

    /// Ends the utterance. Returns the final caption text, or nil when nothing was heard.
    mutating func commit() -> String? {
        let text = displayText
        committed = ""
        volatile = ""
        return text.isEmpty ? nil : text
    }

    mutating func reset() {
        committed = ""
        volatile = ""
    }

    private static func join(_ lhs: String, _ rhs: String) -> String {
        if lhs.isEmpty { return rhs }
        if rhs.isEmpty { return lhs }
        return "\(lhs) \(rhs)"
    }
}

enum AudioLevelMeter {
    static let floorDecibels: Float = -50

    /// Maps the buffer's RMS power to 0…1 for the visual waveform (−50 dBFS or quieter is 0).
    static func normalizedLevel(of buffer: AVAudioPCMBuffer) -> Float {
        guard let channels = buffer.floatChannelData, buffer.frameLength > 0 else { return 0 }
        return normalizedLevel(samples: UnsafeBufferPointer(start: channels[0], count: Int(buffer.frameLength)))
    }

    static func normalizedLevel<S: Collection>(samples: S) -> Float where S.Element == Float {
        guard !samples.isEmpty else { return 0 }
        let meanSquare = samples.reduce(Float(0)) { $0 + $1 * $1 } / Float(samples.count)
        let rms = sqrt(meanSquare)
        guard rms > 0 else { return 0 }
        let decibels = 20 * log10(rms)
        return min(1, max(0, (decibels - floorDecibels) / -floorDecibels))
    }
}
