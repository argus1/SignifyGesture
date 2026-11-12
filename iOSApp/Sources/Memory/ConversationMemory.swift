import Foundation
import GRDB

struct MemoryTurn: Codable, Equatable {
    let id: String
    let sequence: Int
    let speaker: String
    let modality: String
    let text: String
    let gloss: String?
    let timestamp: Double
}

struct MemoryCorrection: Codable, Equatable {
    let heard: String
    let meant: String
}

struct MemoryConversation: Codable, Equatable {
    let id: String
    let title: String
    let context: String
    let startedAt: Double
    let endedAt: Double
    let recallAllowed: Bool
    let turns: [MemoryTurn]
    let corrections: [MemoryCorrection]
}

struct MemorySummary: Codable {
    let id: String
    let title: String
    let context: String
    let startedAt: Double
    let endedAt: Double
    let recallAllowed: Bool
    let preview: String
    let turnCount: Int
}

struct MemoryHit: Codable {
    let conversationId: String
    let turnId: String
    let title: String
    let speaker: String
    let timestamp: Double
    let text: String
    let rank: Int
}

struct MemoryRequest: Decodable {
    let version: Int
    let requestId: String
    let action: String
    var expectedGeneration: Int?
    var conversation: MemoryConversation?
    var conversationId: String?
    var enabled: Bool?
    var offset: Int?
    var query: String?
    var excludingConversationId: String?
}

struct MemoryData: Codable {
    var generation: Int
    var recallEnabled: Bool
    var conversations: [MemorySummary] = []
    var conversation: MemoryConversation?
    var hits: [MemoryHit] = []
    var hasMore = false

    enum CodingKeys: String, CodingKey {
        case generation, recallEnabled, conversations, conversation, hits, hasMore
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(generation, forKey: .generation)
        try values.encode(recallEnabled, forKey: .recallEnabled)
        try values.encode(conversations, forKey: .conversations)
        try values.encode(conversation, forKey: .conversation)
        try values.encode(hits, forKey: .hits)
        try values.encode(hasMore, forKey: .hasMore)
    }
}

enum MemoryFailure: String, Error {
    case invalidRequest, changed, notFound, recallDisabled, storage

    var message: String {
        switch self {
        case .invalidRequest: return "Invalid memory request or conversation."
        case .changed: return "Memory changed. Refresh before trying again."
        case .notFound: return "This saved conversation no longer exists."
        case .recallDisabled: return "Enable saved conversation recall in Memory first."
        case .storage: return "Could not access conversation memory. Please try again."
        }
    }
}

/// All operations are called on the bridge's serial memory queue.
final class ConversationMemory {
    private let queue: DatabaseQueue

    init(path: String?) throws {
        var configuration = Configuration()
        configuration.foreignKeysEnabled = true
        queue = try path.map { try DatabaseQueue(path: $0, configuration: configuration) }
            ?? DatabaseQueue(configuration: configuration)
        var migrator = DatabaseMigrator()
        migrator.registerMigration("conversationMemoryV1") { db in
            try db.execute(sql: """
                CREATE TABLE memoryState (
                    id INTEGER PRIMARY KEY CHECK(id = 1),
                    generation INTEGER NOT NULL,
                    recallEnabled BOOLEAN NOT NULL
                );
                INSERT INTO memoryState VALUES (1, 0, 0);
                CREATE TABLE conversation (
                    id TEXT PRIMARY KEY NOT NULL,
                    title TEXT NOT NULL, context TEXT NOT NULL,
                    startedAt DOUBLE NOT NULL, endedAt DOUBLE NOT NULL,
                    recallAllowed BOOLEAN NOT NULL, corrections BLOB NOT NULL
                );
                CREATE INDEX conversation_date ON conversation(endedAt DESC, id);
                CREATE TABLE conversationTurn (
                    id TEXT PRIMARY KEY NOT NULL,
                    conversationId TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
                    sequence INTEGER NOT NULL, speaker TEXT NOT NULL, modality TEXT NOT NULL,
                    text TEXT NOT NULL, gloss TEXT, timestamp DOUBLE NOT NULL,
                    UNIQUE(conversationId, sequence)
                );
                CREATE VIRTUAL TABLE memorySearch USING fts5(
                    turnId UNINDEXED, text, tokenize = 'unicode61'
                );
                CREATE TRIGGER memory_insert AFTER INSERT ON conversationTurn BEGIN
                    INSERT INTO memorySearch(turnId, text) VALUES (new.id, new.text);
                END;
                CREATE TRIGGER memory_delete AFTER DELETE ON conversationTurn BEGIN
                    DELETE FROM memorySearch WHERE turnId = old.id;
                END;
                CREATE TRIGGER memory_update AFTER UPDATE ON conversationTurn BEGIN
                    UPDATE memorySearch SET text = new.text WHERE turnId = new.id;
                END;
                """)
        }
        try migrator.migrate(queue)
    }

    static func open() throws -> ConversationMemory {
        let files = FileManager.default
        let base = try files.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                 appropriateFor: nil, create: true)
        var directory = base.appendingPathComponent("SignifyMemory", isDirectory: true)
        try files.createDirectory(at: directory, withIntermediateDirectories: true,
                                  attributes: [.protectionKey: FileProtectionType.complete])
        var resources = URLResourceValues()
        resources.isExcludedFromBackup = true
        try directory.setResourceValues(resources)
        return try ConversationMemory(path: directory.appendingPathComponent("conversations.sqlite").path)
    }

    func perform(_ request: MemoryRequest) throws -> MemoryData {
        guard request.version == 1, UUID(uuidString: request.requestId) != nil else {
            throw MemoryFailure.invalidRequest
        }
        return try queue.write { db in
            guard let row = try Row.fetchOne(db, sql: "SELECT * FROM memoryState WHERE id = 1") else {
                throw MemoryFailure.storage
            }
            var result = MemoryData(generation: row["generation"], recallEnabled: row["recallEnabled"])
            let mutations = ["save", "delete", "erase", "setGlobalRecall", "setRecall"]
            if mutations.contains(request.action), request.expectedGeneration != result.generation {
                throw MemoryFailure.changed
            }
            switch request.action {
            case "state": break
            case "save":
                guard let conversation = request.conversation else { throw MemoryFailure.invalidRequest }
                try validate(conversation)
                try db.execute(sql: """
                    INSERT INTO conversation VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET title=excluded.title, context=excluded.context,
                    startedAt=excluded.startedAt, endedAt=excluded.endedAt,
                    recallAllowed=excluded.recallAllowed, corrections=excluded.corrections
                    """, arguments: [conversation.id, conversation.title, conversation.context,
                                     conversation.startedAt, conversation.endedAt, conversation.recallAllowed,
                                     try JSONEncoder().encode(conversation.corrections)])
                try db.execute(sql: "DELETE FROM conversationTurn WHERE conversationId = ?",
                               arguments: [conversation.id])
                for turn in conversation.turns {
                    try db.execute(sql: "INSERT INTO conversationTurn VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                                   arguments: [turn.id, conversation.id, turn.sequence, turn.speaker,
                                               turn.modality, turn.text, turn.gloss, turn.timestamp])
                }
                result.conversation = conversation
            case "list":
                guard let offset = request.offset, (0...1_000_000).contains(offset) else {
                    throw MemoryFailure.invalidRequest
                }
                let rows = try Row.fetchAll(db, sql: """
                    SELECT c.*, (SELECT text FROM conversationTurn WHERE conversationId = c.id
                      ORDER BY sequence LIMIT 1) AS preview,
                      (SELECT COUNT(*) FROM conversationTurn WHERE conversationId = c.id) AS turnCount
                    FROM conversation c ORDER BY endedAt DESC, id LIMIT 21 OFFSET ?
                    """, arguments: [offset])
                result.hasMore = rows.count > 20
                result.conversations = rows.prefix(20).map {
                    MemorySummary(id: $0["id"], title: $0["title"], context: $0["context"],
                                  startedAt: $0["startedAt"], endedAt: $0["endedAt"],
                                  recallAllowed: $0["recallAllowed"],
                                  preview: clipped($0["preview"], limit: 200), turnCount: $0["turnCount"])
                }
            case "detail":
                result.conversation = try detail(id: validID(request.conversationId), db: db)
            case "delete":
                let id = try validID(request.conversationId)
                guard try Row.fetchOne(db, sql: "SELECT id FROM conversation WHERE id = ?", arguments: [id]) != nil else {
                    throw MemoryFailure.notFound
                }
                try db.execute(sql: "DELETE FROM conversation WHERE id = ?", arguments: [id])
            case "erase":
                try db.execute(sql: "DELETE FROM conversation")
                try db.execute(sql: "UPDATE memoryState SET recallEnabled = 0 WHERE id = 1")
                result.recallEnabled = false
            case "setGlobalRecall":
                guard let enabled = request.enabled else { throw MemoryFailure.invalidRequest }
                try db.execute(sql: "UPDATE memoryState SET recallEnabled = ? WHERE id = 1", arguments: [enabled])
                result.recallEnabled = enabled
            case "setRecall":
                let id = try validID(request.conversationId)
                guard let enabled = request.enabled else { throw MemoryFailure.invalidRequest }
                _ = try detail(id: id, db: db)
                try db.execute(sql: "UPDATE conversation SET recallAllowed = ? WHERE id =  ?",
                               arguments: [enabled, id])
            case "search":
                guard result.recallEnabled else { throw MemoryFailure.recallDisabled }
                guard let query = request.query, query.utf16.count <= 300 else { throw MemoryFailure.invalidRequest }
                let excluded = try validID(request.excludingConversationId)
                if let pattern = Self.searchPattern(query) {
                    result.hits = try Row.fetchAll(db, sql: """
                        SELECT t.*, c.title FROM memorySearch
                        JOIN conversationTurn t ON t.id = memorySearch.turnId
                        JOIN conversation c ON c.id = t.conversationId
                        WHERE memorySearch MATCH ? AND c.recallAllowed = 1 AND c.id <> ?
                        ORDER BY bm25(memorySearch), c.endedAt DESC, t.id LIMIT 30
                        """, arguments: [pattern, excluded]).reduce(into: [MemoryHit]()) { hits, row in
                            let text = clipped(row["text"], limit: 500)
                            guard hits.count < 5, !hits.contains(where: { $0.text == text }) else { return }
                            hits.append(MemoryHit(conversationId: row["conversationId"], turnId: row["id"],
                                                  title: row["title"], speaker: row["speaker"],
                                                  timestamp: row["timestamp"], text: text, rank: hits.count + 1))
                        }
                }
            default: throw MemoryFailure.invalidRequest
            }
            if mutations.contains(request.action) {
                try db.execute(sql: "UPDATE memoryState SET generation = generation + 1 WHERE id = 1")
                result.generation += 1
            }
            return result
        }
    }

    private func validID(_ value: String?) throws -> String {
        guard let value, UUID(uuidString: value) != nil else { throw MemoryFailure.invalidRequest }
        return value
    }

    private func validate(_ conversation: MemoryConversation) throws {
        _ = try validID(conversation.id)
        guard !conversation.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              conversation.title.utf16.count <= 120, conversation.context.utf16.count <= 200,
              conversation.startedAt.isFinite, conversation.startedAt >= 0,
              conversation.endedAt.isFinite, conversation.endedAt >= conversation.startedAt,
              (1...1000).contains(conversation.turns.count), conversation.corrections.count <= 1000,
              conversation.corrections.allSatisfy({ $0.heard.utf16.count <= 200 && $0.meant.utf16.count <= 200 }),
              Set(conversation.turns.map(\.id)).count == conversation.turns.count else {
            throw MemoryFailure.invalidRequest
        }
        for (index, turn) in conversation.turns.enumerated() {
            _ = try validID(turn.id)
            guard turn.sequence == index, ["sam", "other"].contains(turn.speaker),
                  (turn.speaker == "other" ? turn.modality == "speech" : ["signed", "typed"].contains(turn.modality)),
                  !turn.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  turn.text.utf16.count <= 4000, (turn.gloss?.utf16.count ?? 0) <= 4000,
                  turn.timestamp.isFinite, turn.timestamp >= conversation.startedAt,
                  turn.timestamp <= conversation.endedAt else { throw MemoryFailure.invalidRequest }
        }
    }

    private func detail(id: String, db: Database) throws -> MemoryConversation {
        guard let row = try Row.fetchOne(db, sql: "SELECT * FROM conversation WHERE id = ?", arguments: [id]) else {
            throw MemoryFailure.notFound
        }
        let turns = try Row.fetchAll(db, sql: "SELECT * FROM conversationTurn WHERE conversationId = ? ORDER BY sequence",
                                     arguments: [id]).map {
            MemoryTurn(id: $0["id"], sequence: $0["sequence"], speaker: $0["speaker"], modality: $0["modality"],
                       text: $0["text"], gloss: $0["gloss"], timestamp: $0["timestamp"])
        }
        return MemoryConversation(id: row["id"], title: row["title"], context: row["context"],
                                  startedAt: row["startedAt"], endedAt: row["endedAt"],
                                  recallAllowed: row["recallAllowed"], turns: turns,
                                  corrections: try JSONDecoder().decode([MemoryCorrection].self, from: row["corrections"]))
    }

    private func clipped(_ text: String, limit: Int) -> String {
        // Match JavaScript string limits without splitting a Unicode scalar.
        var output = ""
        for scalar in text.unicodeScalars {
            if output.utf16.count + scalar.utf16.count > limit { break }
            output.unicodeScalars.append(scalar)
        }
        return output
    }

    static func searchPattern(_ query: String) -> String? {
        let stops: Set<String> = ["a", "an", "the", "i", "to", "and", "or", "is", "it", "of", "for", "my", "me"]
        let tokens = query.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty && !stops.contains($0) }.prefix(12)
        guard !tokens.isEmpty else { return nil }
        return tokens.map { "\"\($0)\"*" }.joined(separator: " AND ")
    }
}
