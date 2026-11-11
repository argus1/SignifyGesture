import AVFoundation
import Foundation
import OSLog

protocol SpeechAudioSessionManaging: AnyObject {
    func beginSpeaking() throws
    func endSpeaking()
}

/// Owns the app's single AVAudioSession so live captions and spoken playback don't fight over it.
/// Listening needs `.playAndRecord`; playback alone uses `.playback` so it isn't routed to the receiver.
final class SpeechAudioSession: SpeechAudioSessionManaging, @unchecked Sendable {
    static let shared = SpeechAudioSession()

    private let lock = NSLock()
    private var listening = false
    private var speaking = false
    private let logger = Logger(subsystem: "com.argussun.signifygesture", category: "SpeechAudioSession")

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
        do {
            try configure()
        } catch {
            logger.error("Could not release microphone session: \(error.localizedDescription, privacy: .public)")
        }
    }

    func beginSpeaking() throws {
        lock.lock()
        defer { lock.unlock() }
        speaking = true
        do {
            try configure()
        } catch {
            speaking = false
            throw error
        }
    }

    func endSpeaking() {
        lock.lock()
        defer { lock.unlock() }
        speaking = false
        do {
            try configure()
        } catch {
            logger.error("Could not release playback session: \(error.localizedDescription, privacy: .public)")
        }
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
