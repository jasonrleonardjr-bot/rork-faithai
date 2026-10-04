import SwiftUI

/// Testimony sheet for marking one of your wall prayers as answered.
struct WallAnswerSheet: View {
    let prayer: WallPrayer
    let onConfirm: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var testimony: String = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(prayer.text)
                        .font(.serif(.body))
                        .foregroundStyle(Theme.parchment)
                        .lineSpacing(4)

                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowText(text: "How did God answer?", color: Theme.sage)
                        TextField(
                            "Write your testimony (optional — shared with the wall)",
                            text: $testimony,
                            axis: .vertical,
                        )
                        .font(.serif(.body))
                        .foregroundStyle(Theme.parchment)
                        .lineLimit(3 ... 6)
                        .padding(14)
                        .emmausCard(cornerRadius: 16)
                    }
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .background { CandleBackground(intensity: 0.4) }
            .navigationTitle("Mark as answered")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .tint(Theme.mist)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Give thanks") {
                        onConfirm(testimony.trimmingCharacters(in: .whitespacesAndNewlines))
                        dismiss()
                    }
                    .tint(Theme.sage)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
