import Foundation

nonisolated enum ChatRole: String, Codable, Sendable {
    case system
    case user
    case assistant
}

nonisolated struct ChatMessage: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let role: ChatRole
    var content: String
    let createdAt: Date

    init(id: UUID = UUID(), role: ChatRole, content: String, createdAt: Date = .now) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
    }

    /// Content with any `<think>…</think>` reasoning blocks from hybrid/reasoning models removed.
    var visibleContent: String { content.strippingReasoning }

    /// True while the model is inside an unclosed `<think>` block.
    var isReasoning: Bool { content.isInsideReasoning }
}

extension String {
    /// Removes `<think>…</think>` blocks (including an unclosed trailing one) emitted by reasoning models.
    nonisolated var strippingReasoning: String {
        var text = self
        while let start = text.range(of: "<think>") {
            if let end = text.range(of: "</think>", range: start.upperBound..<text.endIndex) {
                text.removeSubrange(start.lowerBound..<end.upperBound)
            } else {
                text.removeSubrange(start.lowerBound..<text.endIndex)
            }
        }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    nonisolated var isInsideReasoning: Bool {
        guard let start = range(of: "<think>", options: .backwards) else { return false }
        return range(of: "</think>", range: start.upperBound..<endIndex) == nil
    }
}

nonisolated struct Conversation: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var title: String
    var messages: [ChatMessage]
    var updatedAt: Date
}
