import Foundation
import Observation

/// Client for the shared prayer wall. Talks REST to the project's Cloudflare
/// backend with a device-local author identity (id + secret token) so only the
/// author can answer or remove their prayer. The "I prayed this" toggle flips
/// optimistically and reconciles with the server.
@Observable
final class WallService {
    private(set) var prayers: [WallPrayer] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    @ObservationIgnored private let userId: String
    @ObservationIgnored private let token: String
    @ObservationIgnored private let session = URLSession.shared
    @ObservationIgnored private let decoder = JSONDecoder()

    init() {
        let defaults = UserDefaults.standard
        let id = defaults.string(forKey: "wall.userId") ?? UUID().uuidString
        let secret = defaults.string(forKey: "wall.token") ?? UUID().uuidString
        defaults.set(id, forKey: "wall.userId")
        defaults.set(secret, forKey: "wall.token")
        userId = id
        token = secret
    }

    func isMine(_ prayer: WallPrayer) -> Bool { prayer.userId == userId }
    func hasPrayed(_ prayer: WallPrayer) -> Bool { prayer.prayedBy.contains(userId) }

    func refresh() async {
        guard let url = endpoint("") else {
            errorMessage = "The wall backend is not configured yet."
            return
        }
        isLoading = prayers.isEmpty
        defer { isLoading = false }
        do {
            let (data, _) = try await session.data(from: url)
            prayers = try decoder.decode(WallListResponse.self, from: data).prayers
            errorMessage = nil
        } catch {
            errorMessage = "Could not reach the wall. Check your connection."
        }
    }

    func cast(_ text: String, name: String, anonymous: Bool) async -> Bool {
        let ok = await post("/cast", payload: [
            "userId": userId, "token": token, "text": text, "name": name, "anonymous": anonymous,
        ])
        if ok { await refresh() }
        return ok
    }

    func togglePray(_ prayer: WallPrayer) async {
        guard let index = prayers.firstIndex(where: { $0.id == prayer.id }) else { return }
        let already = prayers[index].prayedBy.contains(userId)
        prayers[index].prayedBy = already
            ? prayers[index].prayedBy.filter { $0 != userId }
            : prayers[index].prayedBy + [userId]

        let ok = await post("/pray", payload: ["userId": userId, "prayerId": prayer.id])
        if ok {
            await refresh()
        } else if let rollback = prayers.firstIndex(where: { $0.id == prayer.id }) {
            prayers[rollback].prayedBy = already
                ? prayers[rollback].prayedBy.filter { $0 != userId }
                : prayers[rollback].prayedBy + [userId]
        }
    }

    func markAnswered(_ id: String, testimony: String) async {
        let ok = await post("/answer", payload: [
            "userId": userId, "token": token, "prayerId": id, "testimony": testimony,
        ])
        if ok { await refresh() }
    }

    func reopen(_ id: String) async {
        let ok = await post("/reopen", payload: ["userId": userId, "token": token, "prayerId": id])
        if ok { await refresh() }
    }

    func remove(_ id: String) async {
        let ok = await post("/delete", payload: ["userId": userId, "token": token, "prayerId": id])
        if ok { prayers.removeAll { $0.id == id } }
    }

    // MARK: - Plumbing

    private func endpoint(_ path: String) -> URL? {
        let raw = Config.EXPO_PUBLIC_RORK_FUNCTIONS_URL
        guard !raw.isEmpty, let base = URL(string: raw),
              var components = URLComponents(url: base, resolvingAgainstBaseURL: false) else { return nil }
        components.path = "/wall\(path)"
        return components.url
    }

    private func post(_ path: String, payload: [String: Any]) async -> Bool {
        guard let url = endpoint(path) else {
            errorMessage = "The wall backend is not configured yet."
            return false
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
                errorMessage = (try? decoder.decode(WallErrorResponse.self, from: data))?.error ?? "The wall is unreachable."
                return false
            }
            errorMessage = nil
            return true
        } catch {
            errorMessage = "The wall is unreachable. Check your connection."
            return false
        }
    }
}
