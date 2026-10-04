import SwiftUI

struct ContentView: View {
    @State private var settings = SettingsStore()
    @State private var chat = ChatViewModel()
    @State private var prayers = PrayerStore()
    @State private var wall = WallService()
    @State private var meetup = MeetupService()
    @State private var router = AppRouter()

    var body: some View {
        @Bindable var router = router

        TabView(selection: $router.tab) {
            Tab("Today", systemImage: "sun.horizon.fill", value: AppTab.today) {
                TodayView()
            }
            Tab("Companion", systemImage: "flame.fill", value: AppTab.companion) {
                CompanionView()
            }
            Tab("Gather", systemImage: "map.fill", value: AppTab.gather) {
                GatherView()
            }
            Tab("Prayers", systemImage: "hands.and.sparkles.fill", value: AppTab.prayers) {
                PrayersView()
            }
            Tab("Settings", systemImage: "slider.horizontal.3", value: AppTab.settings) {
                SettingsView()
            }
        }
        .tint(Theme.gold)
        .environment(settings)
        .environment(chat)
        .environment(prayers)
        .environment(wall)
        .environment(meetup)
        .environment(router)
        .preferredColorScheme(.dark)
        .sensoryFeedback(.selection, trigger: router.tab)
        .task {
            if settings.hasServer {
                await settings.testConnection()
            }
        }
    }
}

#Preview {
    ContentView()
}
