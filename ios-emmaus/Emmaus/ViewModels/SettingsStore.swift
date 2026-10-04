import Foundation
import Observation

nonisolated enum ConnectionState: Equatable, Sendable {
    case idle
    case testing
    case connected(modelCount: Int)
    case failed(String)
}

/// Server connection and companion preferences, persisted in UserDefaults (API key in Keychain).
@Observable
final class SettingsStore {
    private enum Keys {
        static let server = "settings.server"
        static let model = "settings.model"
        static let temperature = "settings.temperature"
        static let persona = "settings.persona"
        static let tradition = "settings.tradition"
        static let translation = "settings.translation"
        static let name = "settings.name"
        static let apiKey = "apiKey"
    }

    @ObservationIgnored private let defaults = UserDefaults.standard
    @ObservationIgnored private let client = LLMClient()

    var serverAddress: String {
        didSet {
            defaults.set(serverAddress, forKey: Keys.server)
            if oldValue != serverAddress {
                connectionState = .idle
                availableModels = []
            }
        }
    }
    var apiKey: String { didSet { KeychainService.save(apiKey, for: Keys.apiKey) } }
    var model: String { didSet { defaults.set(model, forKey: Keys.model) } }
    var temperature: Double { didSet { defaults.set(temperature, forKey: Keys.temperature) } }
    var persona: Persona { didSet { defaults.set(persona.rawValue, forKey: Keys.persona) } }
    var tradition: Tradition { didSet { defaults.set(tradition.rawValue, forKey: Keys.tradition) } }
    var translation: BibleTranslation { didSet { defaults.set(translation.rawValue, forKey: Keys.translation) } }
    var displayName: String { didSet { defaults.set(displayName, forKey: Keys.name) } }

    var availableModels: [String] = []
    var connectionState: ConnectionState = .idle

    init() {
        let store = UserDefaults.standard
        serverAddress = store.string(forKey: Keys.server) ?? ""
        apiKey = KeychainService.read(Keys.apiKey)
        model = store.string(forKey: Keys.model) ?? ""
        temperature = store.object(forKey: Keys.temperature) as? Double ?? 0.7
        persona = Persona(rawValue: store.string(forKey: Keys.persona) ?? "") ?? .shepherd
        tradition = Tradition(rawValue: store.string(forKey: Keys.tradition) ?? "") ?? .ecumenical
        translation = BibleTranslation(rawValue: store.string(forKey: Keys.translation) ?? "") ?? .esv
        displayName = store.string(forKey: Keys.name) ?? ""
    }

    var baseURL: URL? { LLMClient.normalizedBaseURL(serverAddress) }

    var hasServer: Bool { baseURL != nil }

    var isReady: Bool { requestConfig != nil }

    var requestConfig: LLMRequestConfig? {
        guard let baseURL, !model.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        return LLMRequestConfig(baseURL: baseURL, apiKey: apiKey, model: model, temperature: temperature)
    }

    var isConnected: Bool {
        if case .connected = connectionState { return true }
        return false
    }

    /// Short label for status pills.
    var statusLabel: String {
        switch connectionState {
        case .connected: model.isEmpty ? "Connected" : model
        case .testing: "Connecting…"
        case .failed: "Offline"
        case .idle: hasServer ? (model.isEmpty ? "Choose a model" : model) : "Not connected"
        }
    }

    func testConnection() async {
        guard let baseURL else {
            connectionState = .failed("Enter a valid server address.")
            return
        }
        connectionState = .testing
        do {
            let models = try await client.fetchModels(baseURL: baseURL, apiKey: apiKey)
            availableModels = models
            if model.isEmpty, let first = models.first {
                model = first
            }
            connectionState = .connected(modelCount: models.count)
        } catch {
            print("Connection test failed: \(error.localizedDescription)")
            connectionState = .failed(LLMClient.friendlyMessage(for: error))
        }
    }

    /// Builds the scripture-grounded system prompt from the user's preferences.
    func systemPrompt() -> String {
        var sections: [String] = [
            "You are Emmaus, a Christian AI companion named after the road to Emmaus (Luke 24), where the risen Jesus walked alongside two disciples and opened the Scriptures to them.",
            "Your purpose is to help people understand the Bible, grow in faith, pray, and bring their real lives before God.",
            "Theological stance: historic, orthodox Christianity as summarized in the Apostles' and Nicene Creeds. The person's tradition is \(tradition.rawValue); respect its emphases. On disputed matters (baptism, sacraments, end times, church governance, spiritual gifts) fairly present the major Christian views rather than declaring one the only answer.",
            "Quote Scripture from the \(translation.rawValue) when you are confident of the wording, and always give the reference (e.g. John 15:5). Never invent verses or misattribute quotations; if unsure of exact wording, paraphrase and say so.",
            persona.promptStyle,
            "Be warm, humble, and concise. Use short paragraphs and light Markdown (bold, italics) sparingly. No headings unless asked.",
            "You are not a replacement for a pastor, church community, or professional counselor; gently encourage those connections when appropriate.",
            "If someone mentions self-harm, suicide, abuse, or danger, respond with compassion, urge them to contact local emergency services or a crisis line (in the US, call or text 988), and encourage them to reach out to a trusted person right away.",
        ]
        let name = displayName.trimmingCharacters(in: .whitespaces)
        if !name.isEmpty {
            sections.append("The person you are speaking with is named \(name).")
        }
        sections.append("Today is \(Date.now.formatted(date: .complete, time: .omitted)).")
        return sections.joined(separator: "\n\n")
    }
}
