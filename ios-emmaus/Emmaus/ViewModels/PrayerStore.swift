import Foundation
import Observation

/// On-device prayer journal.
@Observable
final class PrayerStore {
    private(set) var prayers: [Prayer] = []

    @ObservationIgnored private let store = JSONFileStore<[Prayer]>(filename: "prayers.json")

    init() {
        prayers = store.load() ?? []
    }

    var active: [Prayer] {
        prayers.filter { !$0.isAnswered }.sorted { $0.createdAt > $1.createdAt }
    }

    var answered: [Prayer] {
        prayers.filter(\.isAnswered).sorted { ($0.answeredAt ?? .distantPast) > ($1.answeredAt ?? .distantPast) }
    }

    func prayer(with id: UUID) -> Prayer? {
        prayers.first { $0.id == id }
    }

    func save(_ prayer: Prayer) {
        if let index = prayers.firstIndex(where: { $0.id == prayer.id }) {
            prayers[index] = prayer
        } else {
            prayers.append(prayer)
        }
        store.save(prayers)
    }

    func markAnswered(_ id: UUID, testimony: String) {
        guard let index = prayers.firstIndex(where: { $0.id == id }) else { return }
        prayers[index].answeredAt = .now
        prayers[index].testimony = testimony.trimmingCharacters(in: .whitespacesAndNewlines)
        store.save(prayers)
    }

    func reopen(_ id: UUID) {
        guard let index = prayers.firstIndex(where: { $0.id == id }) else { return }
        prayers[index].answeredAt = nil
        store.save(prayers)
    }

    func delete(_ id: UUID) {
        prayers.removeAll { $0.id == id }
        store.save(prayers)
    }
}
