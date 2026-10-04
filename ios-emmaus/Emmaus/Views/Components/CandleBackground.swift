import SwiftUI

/// Deep midnight backdrop with a slowly breathing candle glow.
struct CandleBackground: View {
    var intensity: Double = 1
    @State private var isGlowing: Bool = false

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.midnight, Theme.ink], startPoint: .top, endPoint: .bottom)

            RadialGradient(
                colors: [Theme.ember.opacity(0.30 * intensity), Theme.gold.opacity(0.08 * intensity), .clear],
                center: UnitPoint(x: 0.5, y: -0.05),
                startRadius: 10,
                endRadius: 460
            )
            .scaleEffect(isGlowing ? 1.1 : 0.92, anchor: .top)
            .opacity(isGlowing ? 1 : 0.7)

            RadialGradient(
                colors: [Theme.gold.opacity(0.08 * intensity), .clear],
                center: UnitPoint(x: 0.95, y: 0.9),
                startRadius: 0,
                endRadius: 320
            )
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .onAppear {
            withAnimation(.easeInOut(duration: 4.5).repeatForever(autoreverses: true)) {
                isGlowing = true
            }
        }
    }
}

/// Glowing candle flame mark.
struct FlameMark: View {
    var size: CGFloat = 44

    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.ember.opacity(0.35))
                .frame(width: size * 1.6, height: size * 1.6)
                .blur(radius: size * 0.45)
            Image(systemName: "flame.fill")
                .font(.system(size: size, weight: .regular))
                .foregroundStyle(Theme.goldGradient)
                .symbolEffect(.breathe, options: .repeating)
        }
        .accessibilityHidden(true)
    }
}

/// Small circular flame avatar for companion messages.
struct FlameAvatar: View {
    var body: some View {
        Image(systemName: "flame.fill")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.goldGradient)
            .frame(width: 30, height: 30)
            .background(Theme.surfaceHigh, in: .circle)
            .overlay { Circle().strokeBorder(Theme.gold.opacity(0.35), lineWidth: 1) }
            .accessibilityHidden(true)
    }
}
