import XCTest
@testable import SignifyGesture

@MainActor
final class MessageDraftTests: XCTestCase {
    func testBlankDraftIsNotInserted() {
        let draft = MessageDraft()
        draft.text = " \n "
        var inserted = false

        draft.insert(using: { _, _ in inserted = true }, onSuccess: {})

        XCTAssertFalse(inserted)
        XCTAssertEqual(draft.errorMessage, "Enter a message before inserting it.")
        XCTAssertEqual(draft.text, " \n ")
    }

    func testSuccessfulInsertionClearsDraftOnlyAfterCompletion() async {
        let draft = MessageDraft()
        draft.text = "  Hello!\n"
        var completion: ((Error?) -> Void)?
        var insertedText: String?
        let succeeded = expectation(description: "Insertion completed")

        draft.insert(using: { text, callback in
            insertedText = text
            completion = callback
        }, onSuccess: { succeeded.fulfill() })

        XCTAssertEqual(insertedText, "  Hello!\n")
        XCTAssertEqual(draft.text, "  Hello!\n")
        XCTAssertTrue(draft.isInserting)
        completion?(nil)
        await fulfillment(of: [succeeded], timeout: 1)
        XCTAssertEqual(draft.text, "")
        XCTAssertFalse(draft.isInserting)
        XCTAssertNil(draft.errorMessage)
    }

    func testFailedInsertionPreservesDraftAndAllowsRetry() async {
        let draft = MessageDraft()
        draft.text = "Try again"
        let failure = NSError(domain: "test", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Messages is unavailable."
        ])
        let processed = expectation(description: "Failure processed")
        draft.insert(using: { _, completion in
            completion(failure)
            DispatchQueue.main.async { processed.fulfill() }
        }, onSuccess: { XCTFail("Failure must not report success") })

        await fulfillment(of: [processed], timeout: 1)
        XCTAssertEqual(draft.text, "Try again")
        XCTAssertFalse(draft.isInserting)
        XCTAssertEqual(draft.errorMessage, "Could not insert the message: Messages is unavailable.")

        draft.reportUnavailableConversation()
        XCTAssertEqual(draft.errorMessage, "Open a conversation in Messages and try again.")
    }

    func testDuplicateInsertionIsIgnoredWhilePending() {
        let draft = MessageDraft()
        draft.text = "Hello"
        var count = 0
        let insert: MessageDraft.Insert = { _, _ in count += 1 }
        draft.insert(using: insert, onSuccess: {})
        draft.insert(using: insert, onSuccess: {})
        XCTAssertEqual(count, 1)
    }
}
