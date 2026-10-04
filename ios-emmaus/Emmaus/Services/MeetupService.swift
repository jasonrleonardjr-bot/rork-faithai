import CoreLocation
import Foundation
import Observation

/// Realtime meetup client. Connects to the Gather hub over WebSocket, pings
/// location, applies spot state, and fires local notifications on the key
/// transitions: a spot going live, and two or more people selecting one.
@Observable
final class MeetupService: NSObject, URLSessionWebSocketDelegate {
    enum ConnectionState: Equatable {
        case idle
        case connecting
        case connected
        case failed(String)
    }

    private(set) var connection: ConnectionState = .idle
    private(set) var spots: [MeetupSpot] = []
    private(set) var members: [MeetupMember] = []
    private(set) var myId: String
    private(set) var myName: String
    let location: LocationService

    private let notifier: NotificationService
    private let session = URLSession(configuration: .default)
    private var socket: URLSessionWebSocketTask?
    private var receiveLoop: Task<Void, Never>?
    private var pingLoop: Task<Void, Never>?
    private var isRunning = false
    private var reconnectAttempt = 0
    private var previousSpots: [String: MeetupSpot] = [:]

    init(notifier: NotificationService = NotificationService()) {
        self.notifier = notifier
        self.location = LocationService()
        let defaults = UserDefaults.standard
        let savedId = defaults.string(forKey: "meetup.userId") ?? UUID().uuidString
        let savedName = defaults.string(forKey: "meetup.displayName") ?? "Pilgrim \(Int.random(in: 10...99))"
        defaults.set(savedId, forKey: "meetup.userId")
        defaults.set(savedName, forKey: "meetup.displayName")
        myId = savedId
        myName = savedName
        super.init()
    }

    /// Idempotent: requests permissions once, then keeps the socket alive so
    /// notifications keep arriving from other tabs.
    func start() {
        guard !isRunning else { return }
        isRunning = true
        Task {
            await notifier.requestAuthorization()
            location.requestPermission()
            await connect()
        }
    }

    func toggleSelection(on spot: MeetupSpot) {
        guard connection == .connected else { return }
        let isMine = spot.selections.contains(myId)
        // Optimistic update; the next server state overwrites it.
        if let index = spots.firstIndex(where: { $0.id == spot.id }) {
            let current = spots[index]
            let selections = isMine
                ? current.selections.filter { $0 != myId }
                : current.selections + [myId]
            spots[index] = MeetupSpot(
                id: current.id, name: current.name, lat: current.lat, lng: current.lng,
                memberIds: current.memberIds, selections: selections, createdAt: current.createdAt
            )
        }
        send(["type": isMine ? "deselect" : "select", "spotId": spot.id])
    }

    // MARK: - Connection

    private func connect() async {
        guard isRunning else { return }
        let raw = Config.EXPO_PUBLIC_RORK_FUNCTIONS_URL
        guard !raw.isEmpty, let base = URL(string: raw),
              var components = URLComponents(url: base, resolvingAgainstBaseURL: false) else {
            connection = .failed("Realtime backend is not configured yet.")
            return
        }
        components.scheme = "wss"
        components.path = "/gather"
        components.queryItems = [
            URLQueryItem(name: "userId", value: myId),
            URLQueryItem(name: "name", value: myName),
        ]
        guard let url = components.url else {
            connection = .failed("Could not form the gather URL.")
            return
        }

        connection = .connecting
        let task = session.webSocketTask(with: url)
        task.delegate = self
        task.resume()
        socket = task

        receiveLoop?.cancel()
        receiveLoop = Task { [weak self] in await self?.receiveLoop() }
        pingLoop?.cancel()
        pingLoop = Task { [weak self] in await self?.pingLoop() }
    }

    private func receiveLoop() async {
        while !Task.isCancelled, let socket {
            do {
                let message = try await socket.receive()
                if case .string(let text) = message {
                    handle(text)
                }
            } catch {
                scheduleReconnect()
                return
            }
        }
    }

    private func pingLoop() async {
        while !Task.isCancelled {
            if connection == .connected, let socket, let current = location.location {
                let ping = MeetupLocationPing(lat: current.coordinate.latitude, lng: current.coordinate.longitude)
                if let data = try? JSONEncoder().encode(ping), let text = String(data: data, encoding: .utf8) {
                    try? await socket.send(.string(text))
                }
            }
            try? await Task.sleep(for: .seconds(5))
        }
    }

    private func handle(_ text: String) {
        guard let data = text.data(using: .utf8) else { return }
        if let state = try? JSONDecoder().decode(MeetupStateMessage.self, from: data), state.type == "state" {
            apply(state)
        } else if let welcome = try? JSONDecoder().decode(MeetupWelcomeMessage.self, from: data), welcome.type == "welcome" {
            reconnectAttempt = 0
            connection = .connected
        }
    }

    private func apply(_ state: MeetupStateMessage) {
        var seen: [String: MeetupSpot] = [:]
        for spot in state.spots {
            let old = previousSpots[spot.id]
            if old == nil, spot.memberIds.contains(myId) {
                notifier.post(
                    title: "A meetup spot is live",
                    body: "\(spot.name) appeared nearby — open Gather to see who's around."
                )
            }
            if let old, old.selections.count < 2, spot.selections.count >= 2 {
                notifier.post(
                    title: "Two or more picked \(spot.name)",
                    body: "\(spot.selections.count) people selected the same spot. It's on — meet there!"
                )
            }
            seen[spot.id] = spot
        }
        previousSpots = seen
        spots = state.spots
        members = state.members
    }

    private func scheduleReconnect() {
        guard isRunning else { return }
        socket = nil
        connection = .connecting
        reconnectAttempt += 1
        let delay = min(15, pow(2, Double(min(reconnectAttempt, 4))))
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard let self, self.isRunning else { return }
            await self.connect()
        }
    }

    private func send(_ payload: [String: String]) {
        guard let socket,
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let text = String(data: data, encoding: .utf8) else { return }
        let sender = SendableSocket(socket)
        Task { try? await sender.send(text) }
    }

    // MARK: - URLSessionWebSocketDelegate

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        Task { @MainActor in
            self.reconnectAttempt = 0
            self.connection = .connected
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        Task { @MainActor in
            self.scheduleReconnect()
        }
    }

    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: (any Error)?) {
        guard error != nil else { return }
        Task { @MainActor in
            self.scheduleReconnect()
        }
    }
}

/// Sendable wrapper so the WebSocket task can cross isolation from `send(_:)`.
private struct SendableSocket: @unchecked Sendable {
    let task: URLSessionWebSocketTask
    init(_ task: URLSessionWebSocketTask) { self.task = task }
    func send(_ text: String) async throws {
        try await task.send(.string(text))
    }
}
