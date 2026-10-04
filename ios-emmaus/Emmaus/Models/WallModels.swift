import Foundation

/// A prayer cast on the shared wall, visible to every Emmaus user on every platform.
nonisolated struct WallPrayer: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let userId: String
    var name: String
    var anonymous: Bool
    var text: String
    /// Epoch milliseconds, straight from the server.
    let createdAt: Double
    var prayedBy: [String]
    var answeredAt: Double?
    var testimony: String

    var createdAtDate: Date { Date(timeIntervalSince1970: createdAt / 1000) }
    var answeredDate: Date? { answeredAt.map { Date(timeIntervalSince1970: $0 / 1000) } }
    var isAnswered: Bool { answeredAt != nil }
    var displayName: String { anonymous ? "A quiet pilgrim" : name }
}

/// Response for GET /wall.
nonisolated struct WallListResponse: Codable, Sendable {
    let prayers: [WallPrayer]
    let now: Double
}

/// Error body returned by failed wall requests.
nonisolated struct WallErrorResponse: Codable, Sendable {
    let ok: Bool?
    let error: String?
}
