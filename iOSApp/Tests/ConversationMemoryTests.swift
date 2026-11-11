import XCTest
@testable import SignifyGesture

final class ConversationMemoryTests: XCTestCase {
    private var store: ConversationMemory!
    private let excluded = UUID().uuidString

    override func setUpWithError() throws {
        store = try ConversationMemory(path: nil)
    }

    private func request(_ action: String, conversation: MemoryConversation? = nil,
                         id: String? = nil, enabled: Bool? = nil, offset: Int? = nil,
                         query: String? = nil, generation: Int? = nil,
                         target: ConversationMemory? = nil) throws -> MemoryData {
        let target = target ?? store!
        let current = try target.perform(MemoryRequest(version: 1, requestId: UUID().uuidString, action: "state"))
        return try target.perform(MemoryRequest(
            version: 1, requestId: UUID().uuidString, action: action,
            expectedGeneration: generation ?? current.generation,
            conversation: conversation, conversationId: id, enabled: enabled, offset: offset,
            query: query, excludingConversationId: excluded
        ))
    }

    private func conversation(id: String = UUID().uuidString, text: String = "Oat milk latte please",
                              recall: Bool = true, turnID: String = UUID().uuidString,
                              speaker: String = "sam") -> MemoryConversation {
        MemoryConversation(id: id, title: "Coffee order", context: "Cafe", startedAt: 1000, endedAt: 3000,
                           recallAllowed: recall, turns: [
                            MemoryTurn(id: turnID, sequence: 0, speaker: speaker,
                                       modality: speaker == "sam" ? "typed" : "speech", text: text,
                                       gloss: nil, timestamp: 2000)
                           ], corrections: [MemoryCorrection(heard: "LATTE", meant: "MILK")])
    }

    private func enableRecall() throws {
        _ = try request("setGlobalRecall", enabled: true)
    }

    func testFreshStateAndJSONContractIncludesNullDetail() throws {
        let data = try request("state")
        XCTAssertFalse(data.recallEnabled)
        XCTAssertEqual(data.generation, 0)
        XCTAssertTrue(data.conversations.isEmpty)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(data)) as? [String: Any])
        XCTAssertTrue(json["conversation"] is NSNull)
        XCTAssertEqual(Set(json.keys), ["generation", "recallEnabled", "conversations", "conversation", "hits", "hasMore"])
    }

    func testRoundTripAndIdempotentSavePreservesOtherSessions() throws {
        let first = conversation()
        let second = conversation(text: "Train ticket please")
        _ = try request("save", conversation: first)
        _ = try request("save", conversation: second)
        _ = try request("save", conversation: first)
        XCTAssertEqual(try request("list", offset: 0).conversations.count, 2)
        XCTAssertEqual(try request("detail", id: first.id).conversation, first)
        XCTAssertEqual(try request("detail", id: second.id).conversation, second)
    }

    func testFileReopenMigratesNondestructively() throws {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".sqlite").path
        defer {
            // These are the exact test-owned files, not a shared directory.
            for file in [path, path + "-wal", path + "-shm"] where FileManager.default.fileExists(atPath: file) {
                do { try FileManager.default.removeItem(atPath: file) }
                catch { XCTFail("Could not clean test database: \(error)") }
            }
        }
        let saved = conversation()
        do {
            let fileStore = try ConversationMemory(path: path)
            _ = try request("save", conversation: saved, target: fileStore)
        }
        let reopened = try ConversationMemory(path: path)
        XCTAssertEqual(try request("detail", id: saved.id, target: reopened).conversation, saved)
    }

    func testSaveFailureRollsBackConversationAndSearchIndex() throws {
        let first = conversation()
        _ = try request("save", conversation: first)
        let conflict = conversation(text: "Should not survive", turnID: first.turns[0].id)
        XCTAssertThrowsError(try request("save", conversation: conflict))
        XCTAssertEqual(try request("list", offset: 0).conversations.count, 1)
        XCTAssertThrowsError(try request("detail", id: conflict.id))
        try enableRecall()
        XCTAssertTrue(try request("search", query: "survive").hits.isEmpty)
        XCTAssertEqual(try request("search", query: "latte").hits.count, 1)
    }

    func testRecallRequiresGlobalAndPerConversationConsent() throws {
        let allowed = conversation()
        let denied = conversation(text: "Private latte", recall: false)
        _ = try request("save", conversation: allowed)
        _ = try request("save", conversation: denied)
        XCTAssertThrowsError(try request("search", query: "latte")) {
            XCTAssertEqual($0 as? MemoryFailure, .recallDisabled)
        }
        try enableRecall()
        XCTAssertEqual(try request("search", query: "latte").hits.map(\.conversationId), [allowed.id])
        _ = try request("setRecall", id: allowed.id, enabled: false)
        XCTAssertTrue(try request("search", query: "latte").hits.isEmpty)
    }

    func testFTSUpdatesAndDeletesTrackSavedText() throws {
        let saved = conversation()
        _ = try request("save", conversation: saved)
        try enableRecall()
        XCTAssertEqual(try request("search", query: "latte").hits.count, 1)
        let edited = conversation(id: saved.id, text: "Green tea", turnID: saved.turns[0].id)
        _ = try request("save", conversation: edited)
        XCTAssertTrue(try request("search", query: "latte").hits.isEmpty)
        XCTAssertEqual(try request("search", query: "tea").hits.map(\.text), ["Green tea"])
        _ = try request("delete", id: saved.id)
        XCTAssertTrue(try request("search", query: "tea").hits.isEmpty)
        XCTAssertThrowsError(try request("detail", id: saved.id))
    }

    func testEraseResetsRecallAndRejectsLateSaveOrPermissionChanges() throws {
        let saved = conversation()
        _ = try request("save", conversation: saved)
        try enableRecall()
        let generation = try request("state").generation
        _ = try request("erase")
        XCTAssertTrue(try request("list", offset: 0).conversations.isEmpty)
        XCTAssertFalse(try request("state").recallEnabled)
        XCTAssertThrowsError(try request("save", conversation: saved, generation: generation)) {
            XCTAssertEqual($0 as? MemoryFailure, .changed)
        }
        XCTAssertThrowsError(try request("setGlobalRecall", enabled: true, generation: generation))
        try enableRecall()
        XCTAssertTrue(try request("search", query: "latte").hits.isEmpty)
    }

    func testDeletionAndConsentChangesRejectQueuedOldWrites() throws {
        let saved = conversation()
        _ = try request("save", conversation: saved)
        let beforeDelete = try request("state").generation
        _ = try request("delete", id: saved.id)
        XCTAssertThrowsError(try request("save", conversation: saved, generation: beforeDelete))
        XCTAssertTrue(try request("list", offset: 0).conversations.isEmpty)
    }

    func testPaginationIsBoundedAndDeterministic() throws {
        for _ in 0..<23 { _ = try request("save", conversation: conversation()) }
        let first = try request("list", offset: 0)
        let second = try request("list", offset: 20)
        XCTAssertEqual(first.conversations.count, 20)
        XCTAssertTrue(first.hasMore)
        XCTAssertEqual(second.conversations.count, 3)
        XCTAssertFalse(second.hasMore)
        XCTAssertTrue(Set(first.conversations.map(\.id)).isDisjoint(with: second.conversations.map(\.id)))
        XCTAssertEqual(try request("list", offset: 0).conversations.map(\.id), first.conversations.map(\.id))
    }

    func testSearchLimitsDeduplicationAndSourceAttribution() throws {
        for index in 0..<8 {
            _ = try request("save", conversation: conversation(text: "latte \(index) " + String(repeating: "☕", count: 600),
                                                              speaker: index % 2 == 0 ? "sam" : "other"))
        }
        try enableRecall()
        let hits = try request("search", query: "lat").hits
        XCTAssertEqual(hits.count, 5)
        XCTAssertLessThanOrEqual(hits.map { $0.text.utf16.count }.reduce(0, +), 2500)
        for hit in hits {
            XCTAssertLessThanOrEqual(hit.text.utf16.count, 500)
            let source = try XCTUnwrap(request("detail", id: hit.conversationId).conversation)
            XCTAssertEqual(source.turns[0].id, hit.turnId)
            XCTAssertEqual(source.turns[0].speaker, hit.speaker)
            XCTAssertTrue(source.turns[0].text.hasPrefix(hit.text))
        }
    }

    func testQueryEscapingUnicodeStopWordsAndNoMatch() throws {
        _ = try request("save", conversation: conversation(text: "café latte"))
        try enableRecall()
        XCTAssertEqual(try request("search", query: "café lat").hits.count, 1)
        for query in ["the and i", "", "\"* ()", "unrelated", "latte OR secret", "NOT NEAR"] {
            XCTAssertTrue(try request("search", query: query).hits.isEmpty, query)
        }
        XCTAssertThrowsError(try request("search", query: String(repeating: "a", count: 301)))
    }

    func testCurrentConversationIsExcludedAndDuplicatesAreRemoved() throws {
        let current = conversation(id: excluded)
        _ = try request("save", conversation: current)
        _ = try request("save", conversation: conversation())
        _ = try request("save", conversation: conversation())
        try enableRecall()
        let hits = try request("search", query: "latte").hits
        XCTAssertEqual(hits.count, 1)
        XCTAssertNotEqual(hits[0].conversationId, excluded)
    }

    func testMalformedRequestsAndEmptyConversationsFailExplicitly() throws {
        XCTAssertThrowsError(try request("unknown"))
        XCTAssertThrowsError(try request("list", offset: -1))
        XCTAssertThrowsError(try request("detail", id: "invalid"))
        XCTAssertThrowsError(try request("setGlobalRecall"))
        XCTAssertThrowsError(try request("save", conversation: conversation(text: " ")))
        let empty = MemoryConversation(id: UUID().uuidString, title: "Empty", context: "",
                                       startedAt: 0, endedAt: 1, recallAllowed: false, turns: [], corrections: [])
        XCTAssertThrowsError(try request("save", conversation: empty))
    }

    func testMemoryOriginRequiresTrustedMainFrameAndExactOrigin() {
        let frontend = URL(string: "https://signify.example/app")!
        XCTAssertTrue(NativeBridgeCoordinator.trustsMemoryOrigin(
            frontend: frontend, source: URL(string: "https://signify.example:443/memory"), isMainFrame: true))
        for source in ["http://signify.example", "https://evil.example", "https://signify.example:444", "file:///tmp/page.html"] {
            XCTAssertFalse(NativeBridgeCoordinator.trustsMemoryOrigin(
                frontend: frontend, source: URL(string: source), isMainFrame: true))
        }
        XCTAssertFalse(NativeBridgeCoordinator.trustsMemoryOrigin(frontend: frontend, source: frontend, isMainFrame: false))
        XCTAssertFalse(NativeBridgeCoordinator.trustsMemoryOrigin(frontend: nil, source: frontend, isMainFrame: true))
    }
}
