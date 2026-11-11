import Messages
import SwiftUI

private final class MessagePresentation: ObservableObject {
    @Published var isExpanded = false
}

final class MessagesViewController: MSMessagesAppViewController {
    private let draft = MessageDraft()
    private let presentation = MessagePresentation()

    override func viewDidLoad() {
        super.viewDidLoad()
        let content = MessageComposerView(
            draft: draft,
            presentation: presentation,
            expand: { [weak self] in self?.requestPresentationStyle(.expanded) },
            insert: { [weak self] in self?.insertDraft() }
        )
        let host = UIHostingController(rootView: content)
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        host.didMove(toParent: self)
    }

    override func didTransition(to presentationStyle: MSMessagesAppPresentationStyle) {
        super.didTransition(to: presentationStyle)
        presentation.isExpanded = presentationStyle == .expanded
    }

    override func willBecomeActive(with conversation: MSConversation) {
        super.willBecomeActive(with: conversation)
        presentation.isExpanded = presentationStyle == .expanded
    }

    private func insertDraft() {
        guard let conversation = activeConversation else {
            draft.reportUnavailableConversation()
            return
        }
        draft.insert(using: { text, completion in
            conversation.insertText(text, completionHandler: completion)
        }, onSuccess: { [weak self] in
            self?.dismiss()
        })
    }
}

private struct MessageComposerView: View {
    @ObservedObject var draft: MessageDraft
    @ObservedObject var presentation: MessagePresentation
    let expand: () -> Void
    let insert: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Compose with Signify")
                .font(.headline)
            if presentation.isExpanded {
                Text("Review your text, then insert it. Send it from Messages when you're ready.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                TextEditor(text: $draft.text)
                    .accessibilityLabel("Message text")
                    .frame(minHeight: 100)
                    .padding(4)
                    .background(.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                    .disabled(draft.isInserting)
                if let error = draft.errorMessage {
                    Text(error)
                        .foregroundStyle(.red)
                        .accessibilityLabel("Error: \(error)")
                }
                Button(action: insert) {
                    Text(draft.isInserting ? "Inserting…" : "Insert into Messages")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(draft.isInserting)
            } else {
                Text("Write and review text to insert into this conversation.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button("Open composer", action: expand)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }
}
