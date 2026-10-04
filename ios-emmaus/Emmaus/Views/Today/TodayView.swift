import SwiftUI

struct QuickAction: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let symbol: String
    let prompt: String
}

struct TodayView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(ChatViewModel.self) private var chat
    @Environment(PrayerStore.self) private var prayers
    @Environment(AppRouter.self) private var router

    @State private var verse: Verse = VerseLibrary.verseOfTheDay()
    @State private var isVisible: Bool = false
    @State private var actionTrigger: Int = 0

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let base: String
        switch hour {
        case 5..<12: base = "Good morning"
        case 12..<17: base = "Good afternoon"
        case 17..<22: base = "Good evening"
        default: base = "Peace be with you"
        }
        let name = settings.displayName.trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? base : "\(base), \(name)"
    }

    private var actions: [QuickAction] {
        [
            QuickAction(
                id: "devotional",
                title: "Devotional",
                subtitle: "A reflection on today’s verse",
                symbol: "book.pages.fill",
                prompt: "Write me a short devotional for today based on \(verse.reference): a brief reflection, one question to sit with, and a closing prayer."
            ),
            QuickAction(
                id: "pray",
                title: "Help me pray",
                subtitle: "Guided, step by step",
                symbol: "hands.and.sparkles.fill",
                prompt: "I’d like to pray but I don’t know where to begin. Would you gently guide me through a simple prayer, one step at a time?"
            ),
            QuickAction(
                id: "struggle",
                title: "I’m struggling",
                subtitle: "Talk through what’s heavy",
                symbol: "cloud.drizzle.fill",
                prompt: "I’m going through a hard time right now. Can we talk about it?"
            ),
            QuickAction(
                id: "question",
                title: "Hard questions",
                subtitle: "Doubt, honestly explored",
                symbol: "questionmark.bubble.fill",
                prompt: "I have questions about my faith that feel difficult to ask. Can you help me think them through honestly?"
            ),
        ]
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header
                        .entrance(0, isVisible: isVisible)

                    if !settings.isReady {
                        connectBanner
                            .entrance(1, isVisible: isVisible)
                    }

                    VerseCard(
                        verse: verse,
                        onReflect: { start("Help me reflect on \(verse.reference): “\(verse.text)” What was happening when this was written, and what might it mean for my life today?") },
                        onShuffle: {
                            withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) {
                                verse = VerseLibrary.random(excluding: verse)
                            }
                        }
                    )
                    .entrance(2, isVisible: isVisible)

                    VStack(alignment: .leading, spacing: 12) {
                        EyebrowText(text: "Walk with me")
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                            ForEach(actions) { action in
                                QuickActionTile(action: action) { start(action.prompt) }
                            }
                        }
                    }
                    .entrance(3, isVisible: isVisible)

                    prayerSummary
                        .entrance(4, isVisible: isVisible)
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .scrollIndicators(.hidden)
            .background { CandleBackground() }
            .toolbar(.hidden, for: .navigationBar)
        }
        .sensoryFeedback(.impact(weight: .light), trigger: actionTrigger)
        .onAppear { isVisible = true }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                EyebrowText(text: Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day()), color: Theme.faint)
                Text(greeting)
                    .font(.serif(.largeTitle, weight: .semibold))
                    .foregroundStyle(Theme.parchment)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 12)
            FlameMark(size: 26)
                .padding(.top, 10)
        }
        .padding(.top, 12)
    }

    private var connectBanner: some View {
        Button {
            router.tab = .settings
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "server.rack")
                    .font(.title3)
                    .foregroundStyle(Theme.gold)
                    .frame(width: 44, height: 44)
                    .background(Theme.gold.opacity(0.12), in: .rect(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Connect your model")
                        .font(.headline)
                        .foregroundStyle(Theme.parchment)
                    Text("Point Emmaus at your local AI server to begin.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.mist)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.faint)
            }
            .padding(14)
            .emmausCard(cornerRadius: 20)
        }
        .buttonStyle(PressableStyle())
    }

    private var prayerSummary: some View {
        Button {
            router.tab = .prayers
        } label: {
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    EyebrowText(text: "Prayer journal")
                    if prayers.prayers.isEmpty {
                        Text("Begin a record of what you bring before God — and watch for His answers.")
                            .font(.serif(.body))
                            .foregroundStyle(Theme.mist)
                            .multilineTextAlignment(.leading)
                    } else {
                        Text("\(prayers.active.count) lifted up · \(prayers.answered.count) answered")
                            .font(.serif(.title3, weight: .medium))
                            .foregroundStyle(Theme.parchment)
                        if let latest = prayers.active.first {
                            Text(latest.title)
                                .font(.subheadline)
                                .foregroundStyle(Theme.mist)
                                .lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.faint)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .emmausCard()
        }
        .buttonStyle(PressableStyle())
    }

    private func start(_ prompt: String) {
        actionTrigger += 1
        chat.startConversation(prompt: prompt, settings: settings)
        router.tab = .companion
    }
}

struct VerseCard: View {
    let verse: Verse
    let onReflect: () -> Void
    let onShuffle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                EyebrowText(text: "Verse of the day · \(verse.theme)")
                Spacer()
                Button(action: onShuffle) {
                    Image(systemName: "shuffle")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.mist)
                        .frame(width: 44, height: 44)
                        .contentShape(.rect)
                }
                .accessibilityLabel("Another verse")
                .padding(-12)
            }

            Text("“\(verse.text)”")
                .font(.serif(.title2).italic())
                .foregroundStyle(Theme.parchment)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)
                .contentTransition(.opacity)
                .id(verse.id)
                .transition(.opacity.combined(with: .offset(y: 8)))

            Text(verse.reference)
                .font(.serif(.headline, weight: .semibold))
                .foregroundStyle(Theme.goldGradient)

            Rectangle()
                .fill(Theme.hairline)
                .frame(height: 1)

            HStack(spacing: 10) {
                Button(action: onReflect) {
                    Label("Reflect", systemImage: "sparkles")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .padding(.horizontal, 16)
                        .frame(height: 40)
                        .background(Theme.goldGradient, in: .capsule)
                }
                .buttonStyle(PressableStyle())

                ShareLink(item: verse.shareText) {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.parchment)
                        .padding(.horizontal, 16)
                        .frame(height: 40)
                        .background(Theme.surfaceHigh, in: .capsule)
                        .overlay { Capsule().strokeBorder(Theme.hairline, lineWidth: 1) }
                }
                Spacer(minLength: 0)
            }
        }
        .padding(22)
        .background(alignment: .topTrailing) {
            Text("”")
                .font(.system(size: 180, weight: .bold, design: .serif))
                .foregroundStyle(Theme.gold.opacity(0.06))
                .offset(x: -8, y: -30)
                .accessibilityHidden(true)
        }
        .background {
            LinearGradient(
                colors: [Theme.surfaceHigh.opacity(0.95), Theme.surface.opacity(0.85)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .clipShape(.rect(cornerRadius: 28))
        .overlay {
            RoundedRectangle(cornerRadius: 28)
                .strokeBorder(Theme.cardBorder, lineWidth: 1)
        }
        .shadow(color: Theme.ember.opacity(0.15), radius: 30, y: 12)
    }
}

struct QuickActionTile: View {
    let action: QuickAction
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 14) {
                Image(systemName: action.symbol)
                    .font(.title3)
                    .foregroundStyle(Theme.goldGradient)
                    .frame(width: 42, height: 42)
                    .background(Theme.gold.opacity(0.1), in: .rect(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 3) {
                    Text(action.title)
                        .font(.serif(.headline, weight: .semibold))
                        .foregroundStyle(Theme.parchment)
                    Text(action.subtitle)
                        .font(.caption)
                        .foregroundStyle(Theme.mist)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 138, alignment: .topLeading)
            .emmausCard(cornerRadius: 22)
        }
        .buttonStyle(PressableStyle())
    }
}
