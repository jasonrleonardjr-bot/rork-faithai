import Foundation

nonisolated enum Persona: String, CaseIterable, Identifiable, Codable, Sendable {
    case shepherd
    case scholar
    case friend

    var id: String { rawValue }

    var title: String {
        switch self {
        case .shepherd: "Shepherd"
        case .scholar: "Scholar"
        case .friend: "Friend"
        }
    }

    var subtitle: String {
        switch self {
        case .shepherd: "Warm, pastoral encouragement"
        case .scholar: "History, context & original languages"
        case .friend: "Honest, down-to-earth conversation"
        }
    }

    var symbol: String {
        switch self {
        case .shepherd: "heart.text.square.fill"
        case .scholar: "book.closed.fill"
        case .friend: "figure.2"
        }
    }

    var promptStyle: String {
        switch self {
        case .shepherd:
            "Speak like a gentle, experienced pastor: compassionate, encouraging, patient. Offer comfort first, then Scripture, then a small practical step or a short prayer when fitting."
        case .scholar:
            "Speak like a careful biblical scholar and teacher: explain historical and literary context, authorship, and key Hebrew or Greek words when helpful, and note how the passage has been read across church history."
        case .friend:
            "Speak like a wise, faithful friend: warm, honest, plain-spoken and brief. Ask a thoughtful follow-up question when it helps the person reflect."
        }
    }
}

nonisolated enum Tradition: String, CaseIterable, Identifiable, Codable, Sendable {
    case ecumenical = "Ecumenical"
    case nondenominational = "Non-denominational"
    case catholic = "Catholic"
    case orthodox = "Orthodox"
    case evangelical = "Evangelical"
    case reformed = "Reformed"
    case baptist = "Baptist"
    case methodist = "Methodist"
    case lutheran = "Lutheran"
    case anglican = "Anglican"
    case pentecostal = "Pentecostal"

    var id: String { rawValue }
}

nonisolated enum BibleTranslation: String, CaseIterable, Identifiable, Codable, Sendable {
    case esv = "ESV"
    case niv = "NIV"
    case kjv = "KJV"
    case nkjv = "NKJV"
    case nlt = "NLT"
    case nasb = "NASB"
    case csb = "CSB"
    case nrsv = "NRSV"

    var id: String { rawValue }
}

nonisolated enum AppTab: Hashable, Sendable {
    case today
    case gather
    case companion
    case prayers
    case settings
}
