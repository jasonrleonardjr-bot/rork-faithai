import Foundation

nonisolated enum PrayerCategory: String, Codable, CaseIterable, Identifiable, Sendable {
    case personal
    case family
    case healing
    case guidance
    case thanksgiving
    case world

    var id: String { rawValue }

    var title: String {
        switch self {
        case .personal: "Personal"
        case .family: "Family & Friends"
        case .healing: "Healing"
        case .guidance: "Guidance"
        case .thanksgiving: "Thanksgiving"
        case .world: "The World"
        }
    }

    var symbol: String {
        switch self {
        case .personal: "person.fill"
        case .family: "person.2.fill"
        case .healing: "cross.case.fill"
        case .guidance: "signpost.right.fill"
        case .thanksgiving: "sparkles"
        case .world: "globe.europe.africa.fill"
        }
    }
}

nonisolated struct Prayer: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var title: String
    var details: String
    var category: PrayerCategory
    let createdAt: Date
    var answeredAt: Date?
    var testimony: String

    var isAnswered: Bool { answeredAt != nil }

    init(
        id: UUID = UUID(),
        title: String,
        details: String,
        category: PrayerCategory,
        createdAt: Date = .now,
        answeredAt: Date? = nil,
        testimony: String = ""
    ) {
        self.id = id
        self.title = title
        self.details = details
        self.category = category
        self.createdAt = createdAt
        self.answeredAt = answeredAt
        self.testimony = testimony
    }
}
