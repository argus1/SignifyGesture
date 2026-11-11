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

protocol SpeechSynthesizing: AnyObject {
    var delegate: AVSpeechSynthesizerDelegate? { get set }
    func speak(_ utterance: AVSpeechUtterance)
    @discardableResult func stopSpeaking(at boundary: AVSpeechBoundary) -> Bool
}

extension AVSpeechSynthesizer: SpeechSynthesizing {}

final class NativeSpeechService: NSObject, AVSpeechSynthesizerDelegate, @unchecked Sendable {
    // Keep AVSpeechSynthesizer and capture suppression ordered on the main queue.
    private let speechQueue = DispatchQueue.main
    private let synthesizer: SpeechSynthesizing
    private let audioSession: SpeechAudioSessionManaging
    private var playbackStateHandler: ((Bool) -> Void)?
    private var progressHandler: ((SpeechProgress) -> Void)?
    private var activeUtterance: AVSpeechUtterance?
    private var errorHandler: ((String) -> Void)?
    private var interruptionObserver: NSObjectProtocol?

    init(
        audioSession: SpeechAudioSessionManaging = SpeechAudioSession.shared,
        synthesizer: SpeechSynthesizing = AVSpeechSynthesizer()
    ) {
        self.audioSession = audioSession
        self.synthesizer = synthesizer
        super.init()
        speechQueue.async { [weak self] in
            self?.synthesizer.delegate = self
        }
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  raw == AVAudioSession.InterruptionType.began.rawValue else { return }
            self?.stop()
        }
    }

    deinit {
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
        }
    }

    func setErrorHandler(_ handler: @escaping (String) -> Void) {
        speechQueue.async { [weak self] in self?.errorHandler = handler }
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
            guard let voice = Self.voice(for: voiceIdentifier) else {
                self.errorHandler?("No speech voice is available. Install a voice in iOS Settings.")
                return
            }
            let utterance = AVSpeechUtterance(string: trimmedText)
            utterance.voice = voice
            // Honour the user's VoiceOver/Spoken Content voice and rate when they have set one.
            utterance.prefersAssistiveTechnologySettings = true
            // Replacing an utterance must not report a stop/start pair for the old one.
            if self.activeUtterance != nil {
                self.activeUtterance = nil
                self.synthesizer.stopSpeaking(at: .immediate)
            }
            do {
                try self.audioSession.beginSpeaking()
            } catch {
                self.audioSession.endSpeaking()
                self.playbackStateHandler?(false)
                self.errorHandler?("Couldn't start spoken playback. \(error.localizedDescription)")
                return
            }
            self.activeUtterance = utterance
            // Mute the microphone before submitting audio, not after didStart.
            self.playbackStateHandler?(true)
            self.synthesizer.speak(utterance)
        }
    }

    func stop() {
        speechQueue.async { [weak self] in
            guard let self, self.activeUtterance != nil else { return }
            self.activeUtterance = nil
            self.synthesizer.stopSpeaking(at: .immediate)
            self.audioSession.endSpeaking()
            SpeechHaptics.play(.stopped)
            self.playbackStateHandler?(false)
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        speechQueue.async { [weak self] in
            guard let self, utterance === self.activeUtterance else { return }
            SpeechHaptics.play(.started)
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
