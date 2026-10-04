import SwiftUI

/// A single prayer on the shared wall: author line, text, answered testimony,
/// and the "I prayed this" / "With Emmaus" actions.
struct WallPrayerRow: View {
    let prayer: WallPrayer
    let mine: Bool
    let iPrayed: Bool
    let onPray: () -> Void
    let onPrayWithEmmaus: () -> Void
    let onAnswer: () -> Void
    let onReopen: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            authorLine

            Text(prayer.text)
                .font(.serif(.body))
                .foregroundStyle(Theme.parchment)
                .lineSpacing(4)

            if prayer.isAnswered { answeredCard }

            HStack(spacing: 8) {
                prayButton
                withEmmausButton
                Spacer(minLength: 0)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .emmausCard(cornerRadius: 20)
    }

    private var authorLine: some View {
        HStack(spacing: 10) {
            avatar

            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(prayer.displayName)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.parchment)
                        .lineLimit(1)
                    if mine {
                        Text("you")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Theme.gold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.gold.opacity(0.1), in: .capsule)
                    }
                }
                Text(prayer.createdAtDate.formatted(.relative(presentation: .named)))
                    .font(.caption2)
                    .foregroundStyle(Theme.faint)
            }

            Spacer(minLength: 0)

            if mine { menu }
        }
    }

    private var avatar: some View {
        Group {
            if prayer.anonymous {
                Image(systemName: "sparkles")
                    .font(.footnote)
                    .foregroundStyle(Theme.mist)
            } else {
                Text(String(prayer.name.prefix(1)).uppercased())
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.ink)
            }
        }
        .frame(width: 34, height: 34)
        .background(
            prayer.anonymous ? AnyShapeStyle(Theme.surface) : AnyShapeStyle(Theme.goldGradient),
            in: .circle,
        )
    }

    private var menu: some View {
        Menu {
            if prayer.isAnswered {
                Button("Move back to lifted up", systemImage: "arrow.uturn.backward") { onReopen() }
            } else {
                Button("Mark as answered", systemImage: "checkmark.seal") { onAnswer() }
            }
            Button("Remove from wall", systemImage: "trash", role: .destructive) { onDelete() }
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.body)
                .foregroundStyle(Theme.mist)
                .frame(width: 34, height: 34)
        }
    }

    private var prayButton: some View {
        let count = prayer.prayedBy.count
        return Button(action: onPray) {
            Label(
                count > 0 || iPrayed ? "Prayed · \(max(count, iPrayed ? 1 : 0))" : "Pray",
                systemImage: iPrayed ? "hand.raised.fill" : "hand.raised",
            )
            .font(.footnote.weight(.semibold))
            .foregroundStyle(iPrayed ? Theme.gold : Theme.mist)
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(iPrayed ? Theme.gold.opacity(0.1) : Theme.surface, in: .capsule)
            .overlay {
                Capsule().strokeBorder(Theme.gold.opacity(iPrayed ? 0.4 : 0), lineWidth: 1)
            }
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(iPrayed ? "You prayed this" : "Pray for this")
    }

    private var withEmmausButton: some View {
        Button(action: onPrayWithEmmaus) {
            Label("With Emmaus", systemImage: "flame")
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.mist)
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(Theme.surface, in: .capsule)
        }
        .buttonStyle(PressableStyle())
    }

    private var answeredCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(
                "Answered \(prayer.answeredDate?.formatted(.relative(presentation: .named)) ?? "")",
                systemImage: "checkmark.seal.fill",
            )
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.sage)

            if !prayer.testimony.isEmpty {
                Text(prayer.testimony)
                    .font(.serif(.subheadline).italic())
                    .foregroundStyle(Theme.parchment)
                    .lineSpacing(3)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.sage.opacity(0.08), in: .rect(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Theme.sage.opacity(0.3), lineWidth: 1)
        }
    }
}
