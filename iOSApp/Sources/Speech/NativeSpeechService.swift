import AVFoundation
import Foundation

final class NativeSpeechService: NSObject, AVSpeechSynthesizerDelegate, @unchecked Sendable {
    // Synthesizer access and playback-handler state are confined to this queue.
    private let speechQueue = DispatchQueue(label: "com.argussun.signifygesture.speech")
    private let synthesizer = AVSpeechSynthesizer()
    private var playbackStateHandler: ((Bool) -> Void)?

    override init() {
        super.init()
        speechQueue.async { [weak self] in
            self?.synthesizer.delegate = self
        }
    }

    func setPlaybackStateChangeHandler(_ handler: ((Bool) -> Void)?) {
        speechQueue.async { [weak self] in
            self?.playbackStateHandler = handler
        }
    }

    func speak(_ text: String, voiceIdentifier: String? = nil) throws {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else {
            throw SpeechError.emptyText
        }

        speechQueue.async { [weak self] in
            guard let self else { return }
            if self.synthesizer.isSpeaking {
                self.synthesizer.stopSpeaking(at: .immediate)
            }
            let utterance = AVSpeechUtterance(string: trimmedText)
            if let voiceIdentifier, let voice = AVSpeechSynthesisVoice(identifier: voiceIdentifier) {
                utterance.voice = voice
            }
            self.synthesizer.speak(utterance)
        }
    }

    func stop() {
        speechQueue.async { [weak self] in
            self?.synthesizer.stopSpeaking(at: .immediate)
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        notifyPlaybackState(isPlaying: true)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        notifyPlaybackState(isPlaying: false)
    }

    func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        didCancel utterance: AVSpeechUtterance
    ) {
        notifyPlaybackState(isPlaying: false)
    }

    private func notifyPlaybackState(isPlaying: Bool) {
        speechQueue.async { [weak self] in
            self?.playbackStateHandler?(isPlaying)
        }
    }
}

enum SpeechError: LocalizedError {
    case emptyText

    var errorDescription: String? {
        "There is no text to speak."
    }
}
