import SwiftUI

/// Inline composer at the top of the prayer wall feed — cast a care in a sentence or two.
struct WallComposerView: View {
    let isPending: Bool
    let onCast: (String, Bool) -> Void

    @State private var text: String = ""
    @State private var isAnonymous: Bool = false
    @FocusState private var isFocused: Bool

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField(
                "What’s on your heart? Everyone who opens Emmaus will see it here.",
                text: $text,
                axis: .vertical,
            )
            .font(.serif(.body))
            .foregroundStyle(Theme.parchment)
            .lineLimit(3 ... 8)
            .focused($isFocused)
            .onChange(of: text) { _, newValue in
                if newValue.count > 480 { text = String(newValue.prefix(480)) }
            }

            HStack(spacing: 10) {
                Button {
                    isAnonymous.toggle()
                } label: {
                    Label(isAnonymous ? "Quietly" : "As yourself", systemImage: isAnonymous ? "eye.slash" : "eye")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(isAnonymous ? Theme.gold : Theme.mist)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(isAnonymous ? Theme.gold.opacity(0.1) : Theme.surface, in: .capsule)
                        .overlay {
                            Capsule().strokeBorder(Theme.gold.opacity(isAnonymous ? 0.4 : 0), lineWidth: 1)
                        }
                }
                .buttonStyle(PressableStyle())

                Spacer(minLength: 0)

                if !text.isEmpty {
                    Text("\(text.count)/480")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(Theme.faint)
                }

                Button {
                    let payload = trimmed
                    let quiet = isAnonymous
                    onCast(payload, quiet)
                    text = ""
                    isAnonymous = false
                    isFocused = false
                } label: {
                    Label("Cast it", systemImage: "flame.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Theme.goldGradient, in: .capsule)
                }
                .buttonStyle(PressableStyle())
                .disabled(trimmed.isEmpty || isPending)
                .opacity(trimmed.isEmpty || isPending ? 0.4 : 1)
            }
        }
        .padding(16)
        .emmausCard(cornerRadius: 22)
    }
}
