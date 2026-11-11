import Combine
import Foundation

@MainActor
final class MessageDraft: ObservableObject {
    @Published var text = ""
    @Published private(set) var isInserting = false
    @Published private(set) var errorMessage: String?

    typealias Insert = (String, @escaping (Error?) -> Void) -> Void

    func insert(using insert: Insert, onSuccess: @escaping () -> Void) {
        guard !isInserting else { return }
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Enter a message before inserting it."
            return
        }

        let reviewedText = text
        errorMessage = nil
        isInserting = true
        insert(reviewedText) { [weak self] error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isInserting = false
                if let error {
                    self.errorMessage = "Could not insert the message: \(error.localizedDescription)"
                } else {
                    self.text = ""
                    onSuccess()
                }
            }
        }
    }

    func reportUnavailableConversation() {
        errorMessage = "Open a conversation in Messages and try again."
    }
}
