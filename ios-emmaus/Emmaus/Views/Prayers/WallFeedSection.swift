import SwiftUI

/// The shared wall section: composer on top, everyone's prayers below.
struct WallFeedSection: View {
    @Environment(WallService.self) private var wall
    @Environment(ChatViewModel.self) private var chat
    @Environment(SettingsStore.self) private var settings
    @Environment(AppRouter.self) private var router

    @Binding var answering: WallPrayer?
    @Binding var deleting: WallPrayer?

    @State private var isCasting: Bool = false
    @State private var celebrate: Int = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            WallComposerView(isPending: isCasting) { text, anonymous in
                Task {
                    isCasting = true
                    let ok = await wall.cast(text, name: settings.displayName, anonymous: anonymous)
                    isCasting = false
                    if ok { celebrate += 1 }
                }
            }
            .sensoryFeedback(.success, trigger: celebrate)

            if wall.isLoading && wall.prayers.isEmpty {
                loadingState
            } else if let error = wall.errorMessage, wall.prayers.isEmpty {
                errorState(error)
            } else if wall.prayers.isEmpty {
                quietState
            } else {
                feed
            }
        }
        .transition(.opacity)
    }

    private var feed: some View {
        LazyVStack(spacing: 12) {
            ForEach(wall.prayers) { prayer in
                WallPrayerRow(
                    prayer: prayer,
                    mine: wall.isMine(prayer),
                    iPrayed: wall.hasPrayed(prayer),
                    onPray: { Task { await wall.togglePray(prayer) } },
                    onPrayWithEmmaus: {
                        chat.startConversation(
                            prompt: "Please pray with me about this: \(prayer.text) Write a heartfelt prayer I can pray in my own words, and share one Scripture that speaks to it.",
                            settings: settings,
                        )
                        router.tab = .companion
                    },
                    onAnswer: { answering = prayer },
                    onReopen: { Task { await wall.reopen(prayer.id) } },
                    onDelete: { deleting = prayer },
                )
                .transition(.asymmetric(insertion: .scale(scale: 0.96).combined(with: .opacity), removal: .opacity))
            }
        }
    }

    private var loadingState: some View {
        HStack(spacing: 10) {
            ProgressView()
                .tint(Theme.gold)
            Text("Listening for prayers…")
                .font(.subheadline)
                .foregroundStyle(Theme.mist)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .emmausCard()
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 38))
                .foregroundStyle(Theme.goldGradient)
            Text(message)
                .font(.serif(.subheadline))
                .foregroundStyle(Theme.mist)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await wall.refresh() }
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .background(Theme.goldGradient, in: .capsule)
            .buttonStyle(PressableStyle())
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .emmausCard()
        .padding(.top, 12)
    }

    private var quietState: some View {
        VStack(spacing: 14) {
            Image(systemName: "hands.and.sparkles")
                .font(.system(size: 38))
                .foregroundStyle(Theme.goldGradient)
            Text("The wall is quiet")
                .font(.serif(.title3, weight: .semibold))
                .foregroundStyle(Theme.parchment)
            Text("“Cast thy burden upon the LORD, and he shall sustain thee.” — Ps. 55:22")
                .font(.serif(.subheadline).italic())
                .foregroundStyle(Theme.mist)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .emmausCard()
        .padding(.top, 12)
    }
}
