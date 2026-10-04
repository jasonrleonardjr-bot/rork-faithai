import SwiftUI
import MapKit
import CoreLocation

private extension MeetupSpot {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

private extension MeetupMember {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

private extension MeetupSpotState {
    var color: Color {
        switch self {
        case .open: Theme.ember
        case .confirmed: Theme.sage
        case .crowned: Theme.river
        }
    }

    var label: String {
        switch self {
        case .open: "Waiting for someone to pick it"
        case .confirmed: "One pilgrim is heading there"
        case .crowned: "Two or more picked it — it's on!"
        }
    }
}

struct GatherView: View {
    @Environment(MeetupService.self) private var meetup
    @State private var camera: MapCameraPosition = .userLocation(fallback: .automatic)

    private var mySelectionCount: Int {
        meetup.spots.filter { $0.selections.contains(meetup.myId) }.count
    }

    var body: some View {
        Map(position: $camera) {
            UserAnnotation()
            ForEach(meetup.members) { member in
                Annotation(member.name, coordinate: member.coordinate) {
                    Circle()
                        .fill(Theme.gold)
                        .frame(width: 11, height: 11)
                        .overlay { Circle().strokeBorder(Theme.ink, lineWidth: 1.5) }
                        .shadow(color: Theme.gold.opacity(0.6), radius: 4)
                        .allowsHitTesting(false)
                }
            }
            ForEach(meetup.spots) { spot in
                Annotation(spot.name, coordinate: spot.coordinate) {
                    SpotBadge(spot: spot, isMine: spot.selections.contains(meetup.myId))
                        .onTapGesture { meetup.toggleSelection(on: spot) }
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
            MapScaleView()
        }
        .overlay(alignment: .top) {
            ConnectionBadge(connection: meetup.connection, memberCount: meetup.members.count)
                .padding(.top, 4)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            panel
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
        }
        .task { meetup.start() }
        .sensoryFeedback(.success, trigger: mySelectionCount)
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 14) {
            EyebrowText(text: "Meetup spots")
                .padding(.horizontal, 18)
            content
        }
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassSurface(cornerRadius: 24)
    }

    @ViewBuilder
    private var content: some View {
        switch meetup.location.authorization {
        case .notDetermined:
            PermissionCard(
                symbol: "location.slash.fill",
                title: "Location needed",
                message: "Emmaus uses your location to find pilgrims close by and light up meetup spots."
            ) {
                meetup.location.requestPermission()
            } label: { Text("Share my location") }

        case .denied:
            PermissionCard(
                symbol: "location.slash.fill",
                title: "Location is off",
                message: "Enable location for Emmaus in Settings to join nearby gatherings."
            ) {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            } label: { Text("Open Settings") }

        case .authorized:
            if meetup.location.location == nil {
                HStack(spacing: 12) {
                    ProgressView().tint(Theme.gold)
                    Text("Finding you…")
                        .font(.serif(.callout))
                        .foregroundStyle(Theme.mist)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
            } else if meetup.spots.isEmpty {
                EmptySpotsCard()
            } else {
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(meetup.spots) { spot in
                            SpotRow(
                                spot: spot,
                                isMine: spot.selections.contains(meetup.myId),
                                distance: meetup.location.location.map {
                                    CLLocation(latitude: spot.lat, longitude: spot.lng).distance(from: $0)
                                }
                            ) {
                                meetup.toggleSelection(on: spot)
                            }
                        }
                    }
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(maxHeight: 280)
            }
        }
    }
}

// MARK: - Pieces

private struct SpotBadge: View {
    let spot: MeetupSpot
    let isMine: Bool

    private var color: Color { spot.state.color }

    var body: some View {
        ZStack {
            Circle()
                .fill(color.opacity(0.22))
                .frame(width: 46, height: 46)
                .modifier(CrownPulse(active: spot.state == .crowned))
            Circle()
                .fill(color)
                .frame(width: 30, height: 30)
                .overlay {
                    if isMine {
                        Circle().strokeBorder(.white, lineWidth: 2).frame(width: 34, height: 34)
                    }
                }
            Text("\(spot.selections.count)")
                .font(.caption.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(.white)
        }
        .shadow(color: color.opacity(0.65), radius: 7)
        .contentShape(.rect)
    }
}

/// Gentle breathing scale for crowned (blue) spots.
private struct CrownPulse: ViewModifier {
    let active: Bool
    @State private var pulsing = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(active && pulsing ? 1.18 : 1)
            .animation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true), value: pulsing)
            .onAppear { pulsing = true }
    }
}

private struct SpotRow: View {
    let spot: MeetupSpot
    let isMine: Bool
    let distance: CLLocationDistance?
    let onSelect: () -> Void

    private var distanceText: String? {
        guard let distance else { return nil }
        if distance < 1_000 {
            return "\(Int(distance.rounded())) m"
        }
        return String(format: "%.1f km", distance / 1_000)
    }

    private var buttonLabel: String {
        if isMine { return "You're set" }
        switch spot.state {
        case .open: return "Meet here"
        case .confirmed: return "1 ready"
        case .crowned: return "\(spot.selections.count) ready!"
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(spot.state.color)
                .frame(width: 10, height: 10)
                .shadow(color: spot.state.color.opacity(0.8), radius: 4)
            VStack(alignment: .leading, spacing: 2) {
                Text(spot.name)
                    .font(.serif(.callout, weight: .semibold))
                    .foregroundStyle(Theme.parchment)
                Text(spot.state.label + (distanceText.map { " · \($0) away" } ?? ""))
                    .font(.caption)
                    .foregroundStyle(Theme.mist)
                    .lineLimit(1)
            }
            Spacer()
            Button(action: onSelect) {
                Text(buttonLabel)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        isMine || spot.state == .crowned
                            ? AnyShapeStyle(spot.state.color.opacity(0.22))
                            : AnyShapeStyle(spot.state.color.opacity(0.12)),
                        in: .capsule
                    )
                    .overlay { Capsule().strokeBorder(spot.state.color.opacity(0.5), lineWidth: 1) }
                    .foregroundStyle(isMine ? spot.state.color : Theme.parchment)
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(Theme.surface.opacity(0.6), in: .rect(cornerRadius: 16))
        .contentShape(.rect)
        .onTapGesture(perform: onSelect)
    }
}

private struct ConnectionBadge: View {
    let connection: MeetupService.ConnectionState
    let memberCount: Int

    private var dotColor: Color {
        switch connection {
        case .connected: Theme.sage
        case .connecting, .idle: Theme.gold
        case .failed: Theme.ember
        }
    }

    private var label: String {
        switch connection {
        case .connected: "\(memberCount) nearby"
        case .connecting: "Connecting…"
        case .idle: "Ready"
        case .failed: "Offline"
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(dotColor)
                .frame(width: 7, height: 7)
                .shadow(color: dotColor.opacity(0.8), radius: 4)
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundStyle(Theme.parchment)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .glassSurface(cornerRadius: 16)
    }
}

private struct PermissionCard<Label: View>: View {
    let symbol: String
    let title: String
    let message: String
    let action: () -> Void
    @ViewBuilder let label: Label

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.title2)
                .foregroundStyle(Theme.gold)
            Text(title)
                .font(.serif(.headline, weight: .semibold))
                .foregroundStyle(Theme.parchment)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Theme.mist)
                .multilineTextAlignment(.center)
            Button(action: action) { label }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(Theme.gold.opacity(0.16), in: .capsule)
                .overlay { Capsule().strokeBorder(Theme.gold.opacity(0.5), lineWidth: 1) }
                .foregroundStyle(Theme.gold)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }
}

private struct EmptySpotsCard: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "figure.2.and.figure.walk")
                .font(.title2)
                .foregroundStyle(Theme.gold)
            Text("No gatherings nearby yet")
                .font(.serif(.callout, weight: .semibold))
                .foregroundStyle(Theme.parchment)
            Text("Spots go live when two or more of you are within 150 meters. Keep this open and get close.")
                .font(.footnote)
                .foregroundStyle(Theme.mist)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }
}
