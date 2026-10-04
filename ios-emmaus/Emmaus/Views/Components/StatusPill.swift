import SwiftUI

/// Compact indicator of the model server connection.
struct StatusPill: View {
    @Environment(SettingsStore.self) private var settings

    private var dotColor: Color {
        switch settings.connectionState {
        case .connected: Theme.sage
        case .failed: Theme.ember
        case .testing: Theme.gold
        case .idle: settings.isReady ? Theme.gold : Theme.faint
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(dotColor)
                .frame(width: 7, height: 7)
                .shadow(color: dotColor.opacity(0.8), radius: 4)
            Text(settings.statusLabel)
                .font(.caption.weight(.medium))
                .foregroundStyle(Theme.mist)
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Theme.surface.opacity(0.8), in: .capsule)
        .overlay { Capsule().strokeBorder(Theme.hairline, lineWidth: 1) }
    }
}
