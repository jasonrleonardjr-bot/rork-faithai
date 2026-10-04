import Foundation

nonisolated struct LLMRequestConfig: Sendable {
    let baseURL: URL
    let apiKey: String
    let model: String
    let temperature: Double
}

nonisolated struct WireMessage: Codable, Sendable {
    let role: String
    let content: String
}

nonisolated struct ChatCompletionRequest: Encodable, Sendable {
    let model: String
    let messages: [WireMessage]
    let temperature: Double
    let stream: Bool
}

nonisolated struct CompletionDelta: Decodable, Sendable {
    let content: String?
}

nonisolated struct CompletionChoice: Decodable, Sendable {
    let delta: CompletionDelta?
    let message: CompletionDelta?
}

nonisolated struct CompletionChunk: Decodable, Sendable {
    let choices: [CompletionChoice]
}

nonisolated struct ModelEntry: Decodable, Sendable {
    let id: String
}

nonisolated struct ModelList: Decodable, Sendable {
    let data: [ModelEntry]
}

nonisolated enum LLMError: LocalizedError, Sendable {
    case notConfigured
    case badStatus(Int, String)
    case emptyResponse

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            "Connect your model server in Settings to begin."
        case .badStatus(let code, let body):
            body.isEmpty ? "The server responded with status \(code)." : "Server error \(code): \(body)"
        case .emptyResponse:
            "The model returned an empty reply. Try again."
        }
    }
}

/// Client for any OpenAI-compatible server (Ollama, LM Studio, llama.cpp, vLLM, or a custom hybrid).
nonisolated struct LLMClient: Sendable {

    /// Normalizes user input like `my-server.ts.net` into `https://my-server.ts.net/v1`.
    /// An explicit `http://` scheme is respected.
    static func normalizedBaseURL(_ input: String) -> URL? {
        var value = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return nil }
        if !value.contains("://") { value = "https://" + value }
        while value.hasSuffix("/") { value.removeLast() }
        guard var components = URLComponents(string: value),
              let host = components.host, !host.isEmpty else { return nil }
        if components.path.isEmpty { components.path = "/v1" }
        return components.url
    }

    /// Human-friendly message for network and server errors.
    static func friendlyMessage(for error: Error) -> String {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .cannotConnectToHost, .cannotFindHost, .networkConnectionLost, .dnsLookupFailed:
                return "Couldn't reach your model server. Check the address and make sure it's running on your network."
            case .timedOut:
                return "The model took too long to respond. It may still be loading — try again."
            case .notConnectedToInternet:
                return "You're offline. Connect to the same network as your model server."
            case .appTransportSecurityRequiresSecureConnection:
                return "iOS requires a secure (https) address. Expose your server over https — e.g. with Tailscale, a Cloudflare Tunnel, or ngrok."
            default:
                return urlError.localizedDescription
            }
        }
        return (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }

    private func makeRequest(url: URL, apiKey: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    /// Lists model IDs from `GET /models`.
    func fetchModels(baseURL: URL, apiKey: String) async throws -> [String] {
        var request = makeRequest(url: baseURL.appending(path: "models"), apiKey: apiKey)
        request.timeoutInterval = 10
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw LLMError.badStatus(http.statusCode, String(data: data.prefix(300), encoding: .utf8) ?? "")
        }
        return try JSONDecoder().decode(ModelList.self, from: data).data.map(\.id).sorted()
    }

    /// Streams assistant text deltas from `POST /chat/completions`.
    /// Falls back to a non-streamed JSON body if the server ignores `stream: true`.
    func streamChat(config: LLMRequestConfig, messages: [WireMessage]) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    var request = makeRequest(url: config.baseURL.appending(path: "chat/completions"), apiKey: config.apiKey)
                    request.httpMethod = "POST"
                    request.timeoutInterval = 180
                    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    request.httpBody = try JSONEncoder().encode(
                        ChatCompletionRequest(model: config.model, messages: messages, temperature: config.temperature, stream: true)
                    )

                    let (bytes, response) = try await URLSession.shared.bytes(for: request)

                    if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                        var body = ""
                        for try await line in bytes.lines {
                            body += line
                            if body.count > 300 { break }
                        }
                        throw LLMError.badStatus(http.statusCode, body)
                    }

                    let decoder = JSONDecoder()
                    var didYield = false
                    var rawBody = ""

                    for try await line in bytes.lines {
                        try Task.checkCancellation()
                        guard line.hasPrefix("data:") else {
                            rawBody += line
                            continue
                        }
                        let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
                        if payload == "[DONE]" { break }
                        guard let data = payload.data(using: .utf8),
                              let chunk = try? decoder.decode(CompletionChunk.self, from: data),
                              let text = chunk.choices.first?.delta?.content ?? chunk.choices.first?.message?.content,
                              !text.isEmpty else { continue }
                        didYield = true
                        continuation.yield(text)
                    }

                    if !didYield, let data = rawBody.data(using: .utf8),
                       let full = try? decoder.decode(CompletionChunk.self, from: data),
                       let text = full.choices.first?.message?.content, !text.isEmpty {
                        continuation.yield(text)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
