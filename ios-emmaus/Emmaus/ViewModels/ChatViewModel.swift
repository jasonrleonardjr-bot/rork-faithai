import Foundation
import Observation

/// Manages the active conversation, streaming replies, and saved conversation history.
@Observable
final class ChatViewModel {
    private(set) var conversations: [Conversation] = []
    private(set) var messages: [ChatMessage] = []
    private(set) var isStreaming: Bool = false
    private(set) var currentID: UUID?
    var errorMessage: String?

    @ObservationIgnored private var streamTask: Task<Void, Never>?
    @ObservationIgnored private let store = JSONFileStore<[Conversation]>(filename: "conversations.json")
    @ObservationIgnored private let client = LLMClient()

    init() {
        conversations = store.load() ?? []
    }

    func send(_ text: String, settings: SettingsStore) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isStreaming else { return }
        errorMessage = nil
        messages.append(ChatMessage(role: .user, content: trimmed))
        runCompletion(settings: settings)
    }

    /// Starts a fresh conversation seeded with a prompt (used by Today quick actions).
    func startConversation(prompt: String, settings: SettingsStore) {
        newConversation()
        send(prompt, settings: settings)
    }

    func retry(settings: SettingsStore) {
        guard !isStreaming else { return }
        if let last = messages.last, last.role == .assistant, last.visibleContent.isEmpty {
            messages.removeLast()
        }
        guard messages.last?.role == .user else { return }
        errorMessage = nil
        runCompletion(settings: settings)
    }

    func stop() {
        streamTask?.cancel()
    }

    func newConversation() {
        streamTask?.cancel()
        streamTask = nil
        isStreaming = false
        errorMessage = nil
        messages = []
        currentID = nil
    }

    func open(_ conversation: Conversation) {
        newConversation()
        currentID = conversation.id
        messages = conversation.messages
    }

    func delete(_ conversation: Conversation) {
        conversations.removeAll { $0.id == conversation.id }
        if currentID == conversation.id { newConversation() }
        store.save(conversations)
    }

    func deleteAll() {
        newConversation()
        conversations = []
        store.save(conversations)
    }

    private func runCompletion(settings: SettingsStore) {
        guard let config = settings.requestConfig else {
            errorMessage = LLMError.notConfigured.errorDescription
            persist()
            return
        }

        let history = messages.suffix(24).compactMap { message -> WireMessage? in
            let text = message.role == .assistant ? message.visibleContent : message.content
            return text.isEmpty ? nil : WireMessage(role: message.role.rawValue, content: text)
        }
        let wire = [WireMessage(role: ChatRole.system.rawValue, content: settings.systemPrompt())] + history

        let reply = ChatMessage(role: .assistant, content: "")
        let replyID = reply.id
        messages.append(reply)
        isStreaming = true

        streamTask = Task { [client] in
            do {
                for try await delta in client.streamChat(config: config, messages: wire) {
                    appendDelta(delta, to: replyID)
                }
                if !Task.isCancelled, messages.first(where: { $0.id == replyID })?.visibleContent.isEmpty ?? true {
                    throw LLMError.emptyResponse
                }
            } catch {
                let wasCancelled = Task.isCancelled || (error as? URLError)?.code == .cancelled || error is CancellationError
                if !wasCancelled {
                    print("Chat stream failed: \(error.localizedDescription)")
                    errorMessage = LLMClient.friendlyMessage(for: error)
                }
            }
            if let index = messages.firstIndex(where: { $0.id == replyID }), messages[index].visibleContent.isEmpty {
                messages.remove(at: index)
            }
            isStreaming = false
            persist()
        }
    }

    private func appendDelta(_ delta: String, to id: UUID) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[index].content += delta
    }

    private func persist() {
        guard let firstUser = messages.first(where: { $0.role == .user }) else { return }
        let id = currentID ?? UUID()
        currentID = id
        let title = String(firstUser.content.prefix(60))
        let conversation = Conversation(id: id, title: title, messages: messages, updatedAt: .now)
        conversations.removeAll { $0.id == id }
        conversations.insert(conversation, at: 0)
        store.save(conversations)
    }
}
