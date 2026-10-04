import SwiftUI

extension Color {
    /// Creates a color from a 24-bit RGB hex value, e.g. `0xE3C07F`.
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

/// Candlelight-at-midnight palette used throughout Emmaus.
enum Theme {
    static let ink = Color(hex: 0x07090F)
    static let midnight = Color(hex: 0x0E1220)
    static let surface = Color(hex: 0x141A2B)
    static let surfaceHigh = Color(hex: 0x1C2338)
    static let gold = Color(hex: 0xE3C07F)
    static let goldSoft = Color(hex: 0xF2D9A6)
    static let ember = Color(hex: 0xD67A43)
    static let parchment = Color(hex: 0xF3EAD8)
    static let mist = Color(hex: 0xF3EAD8, opacity: 0.62)
    static let faint = Color(hex: 0xF3EAD8, opacity: 0.38)
    static let hairline = Color.white.opacity(0.08)
    static let sage = Color(hex: 0x9CC3A0)
    static let river = Color(hex: 0x6C9BD2)

    static let goldGradient = LinearGradient(
        colors: [goldSoft, gold, ember],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let cardBorder = LinearGradient(
        colors: [gold.opacity(0.45), Color.white.opacity(0.04), gold.opacity(0.18)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

extension Font {
    /// New York serif at a Dynamic Type text style.
    static func serif(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .serif, weight: weight)
    }
}

extension View {
    /// Elevated candle-lit card surface with a subtle gold hairline.
    func emmausCard(cornerRadius: CGFloat = 24) -> some View {
        self
            .background(Theme.surface.opacity(0.78), in: .rect(cornerRadius: cornerRadius))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius)
                    .strokeBorder(Theme.cardBorder, lineWidth: 1)
            }
    }

    /// Liquid glass on iOS 26+, material fallback on earlier versions.
    @ViewBuilder
    func glassSurface(cornerRadius: CGFloat) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular.tint(Theme.surface.opacity(0.35)), in: .rect(cornerRadius: cornerRadius))
        } else {
            self
                .background(.ultraThinMaterial, in: .rect(cornerRadius: cornerRadius))
                .overlay {
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .strokeBorder(Theme.hairline, lineWidth: 1)
                }
        }
    }

    /// Staggered fade-and-rise entrance.
    func entrance(_ index: Int, isVisible: Bool) -> some View {
        self
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 18)
            .animation(.spring(response: 0.7, dampingFraction: 0.85).delay(Double(index) * 0.08), value: isVisible)
    }
}

/// Small-caps style eyebrow label.
struct EyebrowText: View {
    let text: String
    var color: Color = Theme.gold

    var body: some View {
        Text(text.uppercased())
            .font(.caption2.weight(.semibold))
            .tracking(2.2)
            .foregroundStyle(color)
    }
}

/// Gentle press-down feedback for tappable cards.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: configuration.isPressed)
    }
}
