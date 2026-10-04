import SwiftUI

struct SettingsView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(ChatViewModel.self) private var chat

    @State private var isConfirmingClear: Bool = false
    @State private var testTrigger: Int = 0

    var body: some View {
        @Bindable var settings = settings

        NavigationStack {
            Form {
                Section {
                    serverHeader
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                }

                Section {
                    LabeledField(title: "Server address", symbol: "server.rack") {
                        TextField("https://my-server.ts.net", text: $settings.serverAddress)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .textContentType(.URL)
                    }
                    LabeledField(title: "API key", symbol: "key.fill") {
                        SecureField("Optional", text: $settings.apiKey)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }

                    Button {
                        testTrigger += 1
                        Task { await settings.testConnection() }
                    } label: {
                        HStack {
                            Label("Test connection", systemImage: "bolt.horizontal.fill")
                            Spacer()
                            connectionAccessory
                        }
                    }
                    .tint(Theme.gold)
                    .disabled(!settings.hasServer || settings.connectionState == .testing)
                } header: {
                    Text("Model server")
                } footer: {
                    connectionFooter
                }
                .listRowBackground(Theme.surface)

                Section {
                    if settings.availableModels.isEmpty {
                        LabeledField(title: "Model", symbol: "cpu") {
                            TextField("e.g. llama3.1:8b", text: $settings.model)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }
                    } else {
                        Picker(selection: $settings.model) {
                            if !settings.availableModels.contains(settings.model), !settings.model.isEmpty {
                                Text(settings.model).tag(settings.model)
                            }
                            ForEach(settings.availableModels, id: \.self) { model in
                                Text(model).tag(model)
                            }
                        } label: {
                            Label("Model", systemImage: "cpu")
                        }
                        .tint(Theme.gold)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Label("Creativity", systemImage: "wand.and.stars")
                            Spacer()
                            Text(settings.temperature, format: .number.precision(.fractionLength(1)))
                                .monospacedDigit()
                                .foregroundStyle(Theme.gold)
                        }
                        Slider(value: $settings.temperature, in: 0...1.5, step: 0.1)
                            .tint(Theme.gold)
                        HStack {
                            Text("Faithful")
                            Spacer()
                            Text("Expressive")
                        }
                        .font(.caption2)
                        .foregroundStyle(Theme.faint)
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("Model")
                }
                .listRowBackground(Theme.surface)

                Section {
                    ForEach(Persona.allCases) { persona in
                        Button {
                            settings.persona = persona
                        } label: {
                            HStack(spacing: 14) {
                                Image(systemName: persona.symbol)
                                    .font(.body)
                                    .foregroundStyle(Theme.goldGradient)
                                    .frame(width: 34, height: 34)
                                    .background(Theme.gold.opacity(0.1), in: .rect(cornerRadius: 10))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(persona.title)
                                        .font(.serif(.body, weight: .semibold))
                                        .foregroundStyle(Theme.parchment)
                                    Text(persona.subtitle)
                                        .font(.caption)
                                        .foregroundStyle(Theme.mist)
                                }
                                Spacer()
                                if settings.persona == persona {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Theme.gold)
                                        .transition(.scale.combined(with: .opacity))
                                }
                            }
                            .contentShape(.rect)
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("Companion voice")
                }
                .listRowBackground(Theme.surface)
                .sensoryFeedback(.selection, trigger: settings.persona)
                .animation(.snappy, value: settings.persona)

                Section {
                    LabeledField(title: "Your name", symbol: "person.fill") {
                        TextField("Optional", text: $settings.displayName)
                            .textContentType(.givenName)
                    }
                    Picker(selection: $settings.tradition) {
                        ForEach(Tradition.allCases) { tradition in
                            Text(tradition.rawValue).tag(tradition)
                        }
                    } label: {
                        Label("Tradition", systemImage: "building.columns.fill")
                    }
                    Picker(selection: $settings.translation) {
                        ForEach(BibleTranslation.allCases) { translation in
                            Text(translation.rawValue).tag(translation)
                        }
                    } label: {
                        Label("Preferred translation", systemImage: "text.book.closed.fill")
                    }
                } header: {
                    Text("Personalize")
                } footer: {
                    Text("Emmaus holds to historic Christian faith (the Apostles’ and Nicene Creeds) and presents major views fairly on disputed questions.")
                }
                .listRowBackground(Theme.surface)
                .tint(Theme.gold)

                Section {
                    Button("Clear conversation history", systemImage: "trash", role: .destructive) {
                        isConfirmingClear = true
                    }
                    .disabled(chat.conversations.isEmpty)
                } header: {
                    Text("Privacy")
                } footer: {
                    Text("Conversations and prayers are stored only on this device. Messages are sent only to the server you configure above.")
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background { CandleBackground(intensity: 0.5) }
            .navigationTitle("Settings")
            .foregroundStyle(Theme.parchment)
            .sensoryFeedback(.impact(weight: .light), trigger: testTrigger)
            .sensoryFeedback(trigger: settings.connectionState) { _, newValue in
                switch newValue {
                case .connected: .success
                case .failed: .error
                default: nil
                }
            }
            .confirmationDialog("Delete all conversations?", isPresented: $isConfirmingClear, titleVisibility: .visible) {
                Button("Delete all", role: .destructive) { chat.deleteAll() }
            } message: {
                Text("This can’t be undone. Your prayer journal is not affected.")
            }
        }
    }

    private var serverHeader: some View {
        HStack(spacing: 16) {
            FlameMark(size: 30)
                .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 4) {
                Text("Your own AI, kept close")
                    .font(.serif(.title3, weight: .semibold))
                    .foregroundStyle(Theme.parchment)
                Text("Works with any OpenAI-compatible server — Ollama, LM Studio, llama.cpp, vLLM, or your own hybrid.")
                    .font(.footnote)
                    .foregroundStyle(Theme.mist)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var connectionAccessory: some View {
        switch settings.connectionState {
        case .testing:
            ProgressView().tint(Theme.gold)
        case .connected:
            Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.sage)
        case .failed:
            Image(systemName: "xmark.octagon.fill").foregroundStyle(Theme.ember)
        case .idle:
            EmptyView()
        }
    }

    @ViewBuilder
    private var connectionFooter: some View {
        switch settings.connectionState {
        case .connected(let count):
            Text("Connected · \(count) model\(count == 1 ? "" : "s") available at \(settings.baseURL?.absoluteString ?? "")")
                .foregroundStyle(Theme.sage)
        case .failed(let message):
            Text(message)
                .foregroundStyle(Theme.ember)
        default:
            if let url = settings.baseURL {
                Text("Requests go to \(url.absoluteString)/chat/completions")
            } else {
                Text("Use an https address (Tailscale, Cloudflare Tunnel, or ngrok work great). “/v1” is added automatically if no path is given.")
            }
        }
    }
}

/// Settings row with an icon, title, and a trailing input.
struct LabeledField<Content: View>: View {
    let title: String
    let symbol: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.mist)
            content
                .foregroundStyle(Theme.parchment)
        }
        .padding(.vertical, 4)
    }
}
