import AVFoundation
import Foundation
import UIKit

/// Distinct haptics at the start and end of spoken playback so Deaf/HoH users can feel when the phone is talking.
enum SpeechHaptics {
    enum Event {
        case started
        case finished
        case stopped
    }

    static func play(_ event: Event) {
        DispatchQueue.main.async {
            switch event {
            case .started:
                let generator = UIImpactFeedbackGenerator(style: .heavy)
                generator.prepare()
                generator.impactOccurred(intensity: 1)
            case .finished:
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            case .stopped:
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
            }
        }
    }
}

struct SpeechProgress: Equatable {
    let text: String
    let location: Int
    let length: Int
}

final class NativeSpeechService: NSObject, AVSpeechSynthesizerDelegate, @unchecked Sendable {
    // Synthesizer access and handler state are confined to this queue.
    private let speechQueue = DispatchQueue(label: "com.argussun.signifygesture.speech")
    private let synthesizer = AVSpeechSynthesizer()
    private let audioSession: SpeechAudioSession
    private var playbackStateHandler: ((Bool) -> Void)?
    private var progressHandler: ((SpeechProgress) -> Void)?
    private var activeUtterance: AVSpeechUtterance?

    init(audioSession: SpeechAudioSession = .shared) {
        self.audioSession = audioSession
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

    func setProgressHandler(_ handler: ((SpeechProgress) -> Void)?) {
        speechQueue.async { [weak self] in
            self?.progressHandler = handler
        }
    }

    func speak(_ text: String, voiceIdentifier: String? = nil) throws {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else {
            throw SpeechError.emptyText
        }

        speechQueue.async { [weak self] in
            guard let self else { return }
            let utterance = AVSpeechUtterance(string: trimmedText)
            utterance.voice = Self.voice(for: voiceIdentifier)
            // Honour the user's VoiceOver/Spoken Content voice and rate when they have set one.
            utterance.prefersAssistiveTechnologySettings = true
            // Replacing an utterance must not report a stop/start pair for the old one.
            self.activeUtterance = utterance
            if self.synthesizer.isSpeaking {
                self.synthesizer.stopSpeaking(at: .immediate)
            }
            self.audioSession.beginSpeaking()
            self.synthesizer.speak(utterance)
        }
    }

    func stop() {
        speechQueue.async { [weak self] in
            self?.synthesizer.stopSpeaking(at: .immediate)
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        speechQueue.async { [weak self] in
            guard let self, utterance === self.activeUtterance else { return }
            SpeechHaptics.play(.started)
            self.playbackStateHandler?(true)
        }
    }

    func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        willSpeakRangeOfSpeechString characterRange: NSRange,
        utterance: AVSpeechUtterance
    ) {
        speechQueue.async { [weak self] in
            guard let self, utterance === self.activeUtterance else { return }
            self.progressHandler?(SpeechProgress(
                text: utterance.speechString,
                location: characterRange.location,
                length: characterRange.length
            ))
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        finish(utterance, haptic: .finished)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        finish(utterance, haptic: .stopped)
    }

    private func finish(_ utterance: AVSpeechUtterance, haptic: SpeechHaptics.Event) {
        speechQueue.async { [weak self] in
            guard let self, utterance === self.activeUtterance else { return }
            self.activeUtterance = nil
            self.audioSession.endSpeaking()
            SpeechHaptics.play(haptic)
            self.playbackStateHandler?(false)
        }
    }

    /// The requested voice, else the highest-quality installed non-novelty voice for the device language.
    static func voice(for identifier: String?) -> AVSpeechSynthesisVoice? {
        if let identifier, let voice = AVSpeechSynthesisVoice(identifier: identifier) {
            return voice
        }
        let language = AVSpeechSynthesisVoice.currentLanguageCode()
        let candidates = AVSpeechSynthesisVoice.speechVoices().filter {
            $0.language == language && !$0.voiceTraits.contains(.isNoveltyVoice)
        }
        return candidates.max { $0.quality.rawValue < $1.quality.rawValue }
            ?? AVSpeechSynthesisVoice(language: language)
    }
}

enum SpeechError: LocalizedError {
    case emptyText

    var errorDescription: String? {
        "There is no text to speak."
    }
}
