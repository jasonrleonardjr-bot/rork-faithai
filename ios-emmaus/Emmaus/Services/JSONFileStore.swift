import Foundation

/// Persists a Codable value as a JSON file in the app's Documents directory.
nonisolated struct JSONFileStore<Value: Codable & Sendable>: Sendable {
    let filename: String

    private var url: URL { URL.documentsDirectory.appending(path: filename) }

    func load() -> Value? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        do {
            return try JSONDecoder().decode(Value.self, from: data)
        } catch {
            print("Failed to decode \(filename): \(error.localizedDescription)")
            return nil
        }
    }

    func save(_ value: Value) {
        do {
            let data = try JSONEncoder().encode(value)
            try data.write(to: url, options: [.atomic, .completeFileProtection])
        } catch {
            print("Failed to save \(filename): \(error.localizedDescription)")
        }
    }
}
