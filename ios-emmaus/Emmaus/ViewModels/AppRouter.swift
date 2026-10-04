import Observation

/// Shared tab selection so any screen can hand off to another (e.g. Today → Companion).
@Observable
final class AppRouter {
    var tab: AppTab = .today
}
