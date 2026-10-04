import Foundation

nonisolated struct Verse: Identifiable, Hashable, Sendable {
    let reference: String
    let text: String
    let theme: String

    var id: String { reference }

    var shareText: String { "“\(text)”\n— \(reference) (KJV)" }
}
