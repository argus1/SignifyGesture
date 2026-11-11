import AVFoundation
import Foundation

/// Owns the app's single AVAudioSession so live captions and spoken playback don't fight over it.
/// Listening needs `.playAndRecord`; playback alone uses `.playback` so it isn't routed to the receiver.
final class SpeechAudioSession: @unchecked Sendable {
    static let shared = SpeechAudioSession()

    private let lock = NSLock()
    private var listening = false
    private var speaking = false

    func beginListening() throws {
        lock.lock()
        defer { lock.unlock() }
        listening = true
        do {
            try configure()
        } catch {
            listening = false
            throw error
        }
    }

    func endListening() {
        lock.lock()
        defer { lock.unlock() }
        listening = false
        try? configure()
    }

    func beginSpeaking() {
        lock.lock()
        defer { lock.unlock() }
        speaking = true
        try? configure()
    }

    func endSpeaking() {
        lock.lock()
        defer { lock.unlock() }
        speaking = false
        try? configure()
    }

    private func configure() throws {
        let session = AVAudioSession.sharedInstance()
        if listening {
            try session.setCategory(
                .playAndRecord,
                mode: .default,
                options: [.defaultToSpeaker, .allowBluetoothHFP, .duckOthers]
            )
            // Haptics are muted while recording unless explicitly allowed; Deaf users rely on them for TTS start/end.
            try session.setAllowHapticsAndSystemSoundsDuringRecording(true)
            try session.setActive(true)
        } else if speaking {
            try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try session.setActive(true)
        } else {
            try session.setActive(false, options: .notifyOthersOnDeactivation)
        }
    }
}
