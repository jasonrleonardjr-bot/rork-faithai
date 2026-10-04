import Foundation

/// A pilgrim currently sharing presence on the Gather map.
nonisolated struct MeetupMember: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let lat: Double
    let lng: Double
}

/// A live meetup spot. State derives from how many members selected it:
/// 0 = open (red), 1 = confirmed (green), 2+ = crowned (blue).
nonisolated struct MeetupSpot: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let lat: Double
    let lng: Double
    let memberIds: [String]
    let selections: [String]
    let createdAt: Double

    var state: MeetupSpotState {
        switch selections.count {
        case 0: .open
        case 1: .confirmed
        default: .crowned
        }
    }
}

nonisolated enum MeetupSpotState: Hashable, Sendable {
    /// Live and waiting — nobody has selected it.
    case open
    /// One person selected it.
    case confirmed
    /// Two or more people selected it — the whole cluster is notified.
    case crowned
}

// MARK: - Wire protocol

nonisolated struct MeetupStateMessage: Codable, Sendable {
    let type: String
    let spots: [MeetupSpot]
    let members: [MeetupMember]
    let serverTime: Double
}

nonisolated struct MeetupWelcomeMessage: Codable, Sendable {
    let type: String
    let you: String
    let radius: Double
    let now: Double
}

nonisolated struct MeetupLocationPing: Codable, Sendable {
    let type = "location"
    let lat: Double
    let lng: Double
}
