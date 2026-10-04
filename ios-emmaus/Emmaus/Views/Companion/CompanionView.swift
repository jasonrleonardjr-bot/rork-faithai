import SwiftUI

struct CompanionView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(ChatViewModel.self) private var chat
    @Environment(AppRouter.self) private var router

    @State private var draft: String = ""
    @State private var isShowingHistory: Bool = false
    @State private var sendTrigger: Int = 0
    @FocusState private var isComposerFocused: Bool

    private let suggestions: [String] = [
        "What does it mean to abide in Christ?",
        "Explain the Beatitudes simply",
        "How do I forgive someone who hurt me?",
        "Give me a reading plan for anxiety",
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                CandleBackground(intensity: chat.messages.isEmpty ? 1 : 0.55)

                if chat.messages.isEmpty {
                    emptyState
                } else {
                    thread
                }
            }
            .safeAreaInset(edge: .bottom) { composer }
            .navigationTitle("Companion")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        isShowingHistory = true
                    } label: {
                        Image(systemName: "clock.arrow.circlepath")
                    }
                    .accessibilityLabel("Conversation history")
                }
                ToolbarItem(placement: .principal) {
                    Button {
                        router.tab = .settings
                    } label: {
                        StatusPill()
                    }
                    .buttonStyle(.plain)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        withAnimation(.snappy) { chat.newConversation() }
                    } label: {
                        Image(systemName: "square.and.pencil")
                    }
                    .disabled(chat.messages.isEmpty)
                    .accessibilityLabel("New conversation")
                }
            }
            .sheet(isPresented: $isShowingHistory) {
                HistorySheet()
                    .presentationDetents([.medium, .large])
                    .presentationContentInteraction(.scrolls)
                    .presentationBackground(Theme.midnight)
            }
        }
        .sensoryFeedback(.impact(weight: .medium), trigger: sendTrigger)
    }

    private var emptyState: some View {
        ScrollView {
            VStack(spacing: 22) {
                Spacer(minLength: 40)
                FlameMark(size: 52)
                    .padding(.bottom, 8)
                VStack(spacing: 10) {
                    Text("Walk with me")
                        .font(.serif(.largeTitle, weight: .semibold))
                        .foregroundStyle(Theme.parchment)
                    Text("Ask about Scripture, bring a burden,\nor wrestle with a hard question.")
                        .font(.serif(.body))
                        .foregroundStyle(Theme.mist)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 10) {
                    ForEach(suggestions, id: \.self) { suggestion in
                        Button {
                            submit(suggestion)
                        } label: {
                            HStack {
                                Text(suggestion)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.parchment)
                                    .multilineTextAlignment(.leading)
                                Spacer(minLength: 8)
                                Image(systemName: "arrow.up.right")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Theme.gold)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                            .emmausCard(cornerRadius: 16)
                        }
                        .buttonStyle(PressableStyle())
                    }
                }
                .padding(.top, 10)

                if !settings.isReady {
                    Button {
                        router.tab = .settings
                    } label: {
                        Label("Connect your model server first", systemImage: "bolt.horizontal.circle")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.gold)
                            .frame(minHeight: 44)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
    }

    private var thread: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    ForEach(chat.messages) { message in
                        MessageRow(
                            message: message,
                            isStreaming: chat.isStreaming && message.id == chat.messages.last?.id
                        )
                        .id(message.id)
                        .transition(.opacity.combined(with: .offset(y: 10)))
                    }

                    if let error = chat.errorMessage {
                        ErrorCard(message: error) {
                            chat.retry(settings: settings)
                        } onSettings: {
                            router.tab = .settings
                        }
                    }

                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: chat.messages.last?.content) { _, _ in
                proxy.scrollTo("bottom", anchor: .bottom)
            }
            .onChange(of: chat.messages.count) { _, _ in
                withAnimation(.snappy) { proxy.scrollTo("bottom", anchor: .bottom) }
            }
            .onChange(of: chat.errorMessage) { _, _ in
                withAnimation(.snappy) { proxy.scrollTo("bottom", anchor: .bottom) }
            }
            .onAppear { proxy.scrollTo("bottom", anchor: .bottom) }
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Ask, share, or seek…", text: $draft, axis: .vertical)
                .font(.body)
                .foregroundStyle(Theme.parchment)
                .lineLimit(1...6)
                .focused($isComposerFocused)
                .padding(.leading, 18)
                .padding(.vertical, 13)
                .submitLabel(.send)

            Button {
                if chat.isStreaming {
                    chat.stop()
                } else {
                    submit(draft)
                }
            } label: {
                Image(systemName: chat.isStreaming ? "stop.fill" : "arrow.up")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.ink)
                    .frame(width: 38, height: 38)
                    .background(Theme.goldGradient, in: .circle)
                    .opacity(canSend || chat.isStreaming ? 1 : 0.35)
                    .contentTransition(.symbolEffect(.replace))
            }
            .disabled(!canSend && !chat.isStreaming)
            .accessibilityLabel(chat.isStreaming ? "Stop" : "Send")
            .padding(.trailing, 6)
            .padding(.bottom, 6)
        }
        .glassSurface(cornerRadius: 26)
        .padding(.horizontal, 14)
        .padding(.bottom, 8)
    }

    private var canSend: Bool { !draft.trimmed.isEmpty }

    private func submit(_ text: String) {
        guard !text.trimmed.isEmpty else { return }
        sendTrigger += 1
        withAnimation(.snappy) {
            chat.send(text, settings: settings)
        }
        draft = ""
    }
}

struct MessageRow: View {
    let message: ChatMessage
    let isStreaming: Bool

    var body: some View {
        if message.role == .user {
            HStack {
                Spacer(minLength: 48)
                Text(message.content)
                    .font(.body)
                    .foregroundStyle(Theme.parchment)
                    .textSelection(.enabled)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Theme.surfaceHigh, in: .rect(cornerRadius: 20))
                    .overlay {
                        RoundedRectangle(cornerRadius: 20)
                            .strokeBorder(Theme.gold.opacity(0.18), lineWidth: 1)
                    }
            }
        } else {
            HStack(alignment: .top, spacing: 12) {
                FlameAvatar()
                VStack(alignment: .leading, spacing: 8) {
                    let visible = message.visibleContent
                    if visible.isEmpty {
                        ThinkingIndicator(label: message.isReasoning ? "Reflecting" : "Listening")
                    } else {
                        Text(visible.inlineMarkdown)
                            .font(.serif(.body))
                            .foregroundStyle(Theme.parchment)
                            .lineSpacing(5)
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                        if isStreaming && message.isReasoning {
                            ThinkingIndicator(label: "Reflecting")
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)
            }
            .contextMenu {
                if !message.visibleContent.isEmpty {
                    Button("Copy", systemImage: "doc.on.doc") {
                        UIPasteboard.general.string = message.visibleContent
                    }
                    ShareLink(item: message.visibleContent)
                }
            }
        }
    }
}

struct ThinkingIndicator: View {
    let label: String
    @State private var isAnimating: Bool = false

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Theme.gold)
                        .frame(width: 6, height: 6)
                        .opacity(isAnimating ? 1 : 0.25)
                        .scaleEffect(isAnimating ? 1 : 0.7)
                        .animation(
                            .easeInOut(duration: 0.6).repeatForever().delay(Double(index) * 0.18),
                            value: isAnimating
                        )
                }
            }
            Text(label)
                .font(.serif(.subheadline).italic())
                .foregroundStyle(Theme.faint)
        }
        .padding(.vertical, 4)
        .onAppear { isAnimating = true }
        .accessibilityLabel("\(label)…")
    }
}

struct ErrorCard: View {
    let message: String
    let onRetry: () -> Void
    let onSettings: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Something went wrong", systemImage: "exclamationmark.triangle.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.ember)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(Theme.mist)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 10) {
                Button("Try again", action: onRetry)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 14)
                    .frame(height: 36)
                    .background(Theme.goldGradient, in: .capsule)
                Button("Settings", action: onSettings)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.parchment)
                    .padding(.horizontal, 14)
                    .frame(height: 36)
                    .background(Theme.surfaceHigh, in: .capsule)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.ember.opacity(0.08), in: .rect(cornerRadius: 18))
        .overlay {
            RoundedRectangle(cornerRadius: 18)
                .strokeBorder(Theme.ember.opacity(0.3), lineWidth: 1)
        }
    }
}
