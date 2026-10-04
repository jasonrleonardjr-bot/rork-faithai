import SwiftUI

struct PrayerDetailSheet: View {
    let prayerID: UUID

    @Environment(PrayerStore.self) private var store
    @Environment(SettingsStore.self) private var settings
    @Environment(ChatViewModel.self) private var chat
    @Environment(AppRouter.self) private var router
    @Environment(\.dismiss) private var dismiss

    @State private var testimony: String = ""
    @State private var isMarkingAnswered: Bool = false
    @State private var isEditing: Bool = false
    @State private var celebrate: Int = 0

    var body: some View {
        NavigationStack {
            Group {
                if let prayer = store.prayer(with: prayerID) {
                    content(for: prayer)
                } else {
                    ContentUnavailableView("Prayer removed", systemImage: "trash")
                }
            }
            .background { CandleBackground(intensity: 0.5) }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .tint(Theme.gold)
                }
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button("Edit", systemImage: "pencil") { isEditing = true }
                        if store.prayer(with: prayerID)?.isAnswered == true {
                            Button("Move back to active", systemImage: "arrow.uturn.backward") {
                                store.reopen(prayerID)
                            }
                        }
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            store.delete(prayerID)
                            dismiss()
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .tint(Theme.mist)
                }
            }
            .sheet(isPresented: $isEditing) {
                PrayerEditorSheet(prayer: store.prayer(with: prayerID))
                    .presentationBackground(Theme.midnight)
            }
            .sensoryFeedback(.success, trigger: celebrate)
        }
    }

    private func content(for prayer: Prayer) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Label(prayer.category.title, systemImage: prayer.category.symbol)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.gold)
                    Text(prayer.title)
                        .font(.serif(.title, weight: .semibold))
                        .foregroundStyle(Theme.parchment)
                    Text("Lifted up \(prayer.createdAt.formatted(date: .long, time: .omitted))")
                        .font(.caption)
                        .foregroundStyle(Theme.faint)
                }

                if !prayer.details.isEmpty {
                    Text(prayer.details)
                        .font(.serif(.body))
                        .foregroundStyle(Theme.mist)
                        .lineSpacing(4)
                        .textSelection(.enabled)
                }

                if prayer.isAnswered {
                    answeredCard(prayer)
                } else if isMarkingAnswered {
                    testimonyComposer
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                } else {
                    actions(for: prayer)
                }
            }
            .padding(20)
            .animation(.spring(response: 0.45, dampingFraction: 0.85), value: isMarkingAnswered)
            .animation(.spring(response: 0.45, dampingFraction: 0.85), value: prayer.isAnswered)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func actions(for prayer: Prayer) -> some View {
        VStack(spacing: 10) {
            Button {
                let details = prayer.details.isEmpty ? "" : " Here’s more: \(prayer.details)"
                chat.startConversation(
                    prompt: "Please pray with me about this: \(prayer.title).\(details) Write a heartfelt prayer I can pray in my own words, and share one Scripture that speaks to it.",
                    settings: settings
                )
                router.tab = .companion
                dismiss()
            } label: {
                Label("Pray this with Emmaus", systemImage: "flame.fill")
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Theme.goldGradient, in: .rect(cornerRadius: 16))
            }
            .buttonStyle(PressableStyle())

            Button {
                isMarkingAnswered = true
            } label: {
                Label("Mark as answered", systemImage: "checkmark.seal")
                    .font(.headline)
                    .foregroundStyle(Theme.sage)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Theme.sage.opacity(0.1), in: .rect(cornerRadius: 16))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(Theme.sage.opacity(0.3), lineWidth: 1)
                    }
            }
            .buttonStyle(PressableStyle())
        }
        .padding(.top, 8)
    }

    private var testimonyComposer: some View {
        VStack(alignment: .leading, spacing: 12) {
            EyebrowText(text: "How did God answer?", color: Theme.sage)
            TextField("Write your testimony (optional)", text: $testimony, axis: .vertical)
                .font(.serif(.body))
                .foregroundStyle(Theme.parchment)
                .lineLimit(3...8)
                .padding(14)
                .emmausCard(cornerRadius: 16)
            HStack(spacing: 10) {
                Button("Cancel") { isMarkingAnswered = false }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.mist)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(Theme.surface, in: .rect(cornerRadius: 14))
                Button {
                    store.markAnswered(prayerID, testimony: testimony)
                    celebrate += 1
                    isMarkingAnswered = false
                } label: {
                    Text("Give thanks")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(Theme.sage, in: .rect(cornerRadius: 14))
                }
            }
        }
    }

    private func answeredCard(_ prayer: Prayer) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.seal.fill")
                    .symbolEffect(.bounce, value: celebrate)
                Text("Answered \(prayer.answeredAt?.formatted(date: .long, time: .omitted) ?? "")")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Theme.sage)

            Text(prayer.testimony.isEmpty ? "“Great is thy faithfulness.” — Lam. 3:23" : prayer.testimony)
                .font(.serif(.body).italic())
                .foregroundStyle(Theme.parchment)
                .lineSpacing(4)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.sage.opacity(0.08), in: .rect(cornerRadius: 20))
        .overlay {
            RoundedRectangle(cornerRadius: 20)
                .strokeBorder(Theme.sage.opacity(0.3), lineWidth: 1)
        }
    }
}
