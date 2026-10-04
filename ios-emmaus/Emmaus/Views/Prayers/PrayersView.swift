import SwiftUI

nonisolated enum PrayerFilter: String, CaseIterable, Identifiable, Sendable {
    case together = "Together"
    case active = "Lifted up"
    case answered = "Answered"

    var id: String { rawValue }
}

struct PrayersView: View {
    @Environment(PrayerStore.self) private var store
    @Environment(WallService.self) private var wall

    @State private var filter: PrayerFilter = .together
    @State private var isComposing: Bool = false
    @State private var selectedID: UUID?
    @State private var answering: WallPrayer?
    @State private var deleting: WallPrayer?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header

                    Picker("View", selection: $filter) {
                        ForEach(PrayerFilter.allCases) { item in
                            Text(item.rawValue).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)

                    switch filter {
                    case .together:
                        WallFeedSection(answering: $answering, deleting: $deleting)
                    case .active:
                        journalList(store.active, emptyIcon: "hands.and.sparkles", emptyTitle: "Nothing on your heart yet", emptyText: "“In every thing by prayer and supplication with thanksgiving let your requests be made known unto God.” — Phil. 4:6")
                    case .answered:
                        journalList(store.answered, emptyIcon: "sun.max", emptyTitle: "Answers will gather here", emptyText: "When God answers a prayer, mark it answered and write down how. Over time this becomes a record of His faithfulness.")
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 100)
                .animation(.spring(response: 0.45, dampingFraction: 0.85), value: filter)
                .animation(.spring(response: 0.45, dampingFraction: 0.85), value: store.prayers)
            }
            .scrollIndicators(.hidden)
            .background { CandleBackground(intensity: 0.7) }
            .toolbar(.hidden, for: .navigationBar)
            .overlay(alignment: .bottomTrailing) {
                if filter != .together { addButton }
            }
            .refreshable { await wall.refresh() }
            .task { await wall.refresh() }
            .sheet(isPresented: $isComposing) {
                PrayerEditorSheet(prayer: nil)
                    .presentationBackground(Theme.midnight)
            }
            .sheet(item: $selectedID) { id in
                PrayerDetailSheet(prayerID: id)
                    .presentationDetents([.medium, .large])
                    .presentationContentInteraction(.scrolls)
                    .presentationBackground(Theme.midnight)
            }
            .sheet(item: $answering) { prayer in
                WallAnswerSheet(prayer: prayer) { testimony in
                    Task { await wall.markAnswered(prayer.id, testimony: testimony) }
                }
                .presentationDetents([.medium])
                .presentationContentInteraction(.scrolls)
                .presentationBackground(Theme.midnight)
            }
            .alert(
                "Remove this prayer?",
                isPresented: Binding(
                    get: { deleting != nil },
                    set: { if !$0 { deleting = nil } },
                ),
            ) {
                Button("Remove", role: .destructive) {
                    if let prayer = deleting {
                        Task { await wall.remove(prayer.id) }
                    }
                    deleting = nil
                }
                Button("Keep it", role: .cancel) { deleting = nil }
            } message: {
                Text("It will be taken down from the wall for everyone.")
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            EyebrowText(text: filter == .together ? "Prayer wall" : "Prayer journal", color: Theme.faint)
            Text("Cast your cares")
                .font(.serif(.largeTitle, weight: .semibold))
                .foregroundStyle(Theme.parchment)
            HStack(spacing: 18) {
                if filter == .together {
                    let lifted = wall.prayers.filter { !$0.isAnswered }.count
                    statBlock(value: lifted, label: "lifted up")
                    statBlock(value: wall.prayers.count - lifted, label: "answered")
                } else {
                    statBlock(value: store.active.count, label: "lifted up")
                    statBlock(value: store.answered.count, label: "answered")
                }
            }
            .padding(.top, 6)
        }
        .padding(.top, 12)
    }

    private func statBlock(value: Int, label: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text("\(value)")
                .font(.serif(.title, weight: .semibold))
                .foregroundStyle(Theme.goldGradient)
                .contentTransition(.numericText())
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Theme.mist)
        }
    }

    @ViewBuilder
    private func journalList(_ items: [Prayer], emptyIcon: String, emptyTitle: String, emptyText: String) -> some View {
        if items.isEmpty {
            VStack(spacing: 14) {
                Image(systemName: emptyIcon)
                    .font(.system(size: 38))
                    .foregroundStyle(Theme.goldGradient)
                Text(emptyTitle)
                    .font(.serif(.title3, weight: .semibold))
                    .foregroundStyle(Theme.parchment)
                Text(emptyText)
                    .font(.serif(.subheadline).italic())
                    .foregroundStyle(Theme.mist)
                    .multilineTextAlignment(.center)
            }
            .padding(28)
            .frame(maxWidth: .infinity)
            .emmausCard()
            .padding(.top, 12)
            .transition(.opacity)
        } else {
            LazyVStack(spacing: 12) {
                ForEach(items) { prayer in
                    Button {
                        selectedID = prayer.id
                    } label: {
                        PrayerRow(prayer: prayer)
                    }
                    .buttonStyle(PressableStyle())
                    .transition(.asymmetric(insertion: .scale(scale: 0.96).combined(with: .opacity), removal: .opacity))
                }
            }
        }
    }

    private var addButton: some View {
        Button {
            isComposing = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .frame(width: 58, height: 58)
                .background(Theme.goldGradient, in: .circle)
                .shadow(color: Theme.ember.opacity(0.45), radius: 18, y: 8)
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("New prayer")
        .padding(.trailing, 20)
        .padding(.bottom, 16)
        .sensoryFeedback(.impact(weight: .light), trigger: isComposing)
    }
}

extension UUID: @retroactive Identifiable {
    public var id: UUID { self }
}

struct PrayerRow: View {
    let prayer: Prayer

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: prayer.isAnswered ? "checkmark.seal.fill" : prayer.category.symbol)
                .font(.body)
                .foregroundStyle(prayer.isAnswered ? AnyShapeStyle(Theme.sage) : AnyShapeStyle(Theme.goldGradient))
                .frame(width: 40, height: 40)
                .background((prayer.isAnswered ? Theme.sage : Theme.gold).opacity(0.12), in: .rect(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 5) {
                Text(prayer.title)
                    .font(.serif(.headline, weight: .semibold))
                    .foregroundStyle(Theme.parchment)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                if prayer.isAnswered, !prayer.testimony.isEmpty {
                    Text(prayer.testimony)
                        .font(.subheadline.italic())
                        .foregroundStyle(Theme.mist)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                } else if !prayer.details.isEmpty {
                    Text(prayer.details)
                        .font(.subheadline)
                        .foregroundStyle(Theme.mist)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                Text(caption)
                    .font(.caption)
                    .foregroundStyle(Theme.faint)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .emmausCard(cornerRadius: 20)
    }

    private var caption: String {
        if let answered = prayer.answeredAt {
            let days = max(Calendar.current.dateComponents([.day], from: prayer.createdAt, to: answered).day ?? 0, 0)
            return "Answered \(answered.formatted(date: .abbreviated, time: .omitted)) · after \(days) day\(days == 1 ? "" : "s")"
        }
        return "\(prayer.category.title) · \(prayer.createdAt.formatted(.relative(presentation: .named)))"
    }
}
