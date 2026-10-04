import SwiftUI

struct PrayerEditorSheet: View {
    let prayer: Prayer?

    @Environment(PrayerStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var title: String = ""
    @State private var details: String = ""
    @State private var category: PrayerCategory = .personal
    @State private var didSave: Bool = false
    @FocusState private var isTitleFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        EyebrowText(text: "What’s on your heart")
                        TextField("e.g. Wisdom for a new job", text: $title, axis: .vertical)
                            .font(.serif(.title2, weight: .medium))
                            .foregroundStyle(Theme.parchment)
                            .focused($isTitleFocused)
                            .lineLimit(1...3)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        EyebrowText(text: "Details")
                        TextField("Write freely — this stays on your device.", text: $details, axis: .vertical)
                            .font(.serif(.body))
                            .foregroundStyle(Theme.parchment)
                            .lineLimit(4...12)
                            .padding(14)
                            .emmausCard(cornerRadius: 16)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowText(text: "Category")
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 10)], spacing: 10) {
                            ForEach(PrayerCategory.allCases) { item in
                                Button {
                                    category = item
                                } label: {
                                    Label(item.title, systemImage: item.symbol)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(category == item ? Theme.ink : Theme.parchment)
                                        .frame(maxWidth: .infinity, minHeight: 44)
                                        .background {
                                            if category == item {
                                                Capsule().fill(Theme.goldGradient)
                                            } else {
                                                Capsule().fill(Theme.surface)
                                            }
                                        }
                                        .overlay { Capsule().strokeBorder(Theme.hairline, lineWidth: 1) }
                                }
                                .buttonStyle(PressableStyle())
                            }
                        }
                    }
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .background { CandleBackground(intensity: 0.5) }
            .navigationTitle(prayer == nil ? "New Prayer" : "Edit Prayer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .tint(Theme.mist)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .fontWeight(.semibold)
                        .tint(Theme.gold)
                        .disabled(title.trimmed.isEmpty)
                }
            }
            .sensoryFeedback(.success, trigger: didSave)
            .onAppear {
                if let prayer {
                    title = prayer.title
                    details = prayer.details
                    category = prayer.category
                } else {
                    isTitleFocused = true
                }
            }
        }
    }

    private func save() {
        var updated = prayer ?? Prayer(title: "", details: "", category: category)
        updated.title = title.trimmed
        updated.details = details.trimmed
        updated.category = category
        store.save(updated)
        didSave = true
        dismiss()
    }
}
