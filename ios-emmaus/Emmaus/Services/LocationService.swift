import CoreLocation
import Observation

/// Wraps CoreLocation for the Gather feature: requests when-in-use
/// permission and publishes the freshest location.
@Observable
final class LocationService: NSObject, CLLocationManagerDelegate {
    enum AuthorizationState: Equatable {
        case notDetermined
        case denied
        case authorized
    }

    private let manager = CLLocationManager()
    private(set) var authorization: AuthorizationState
    private(set) var location: CLLocation?
    private(set) var isLocating = false

    override init() {
        authorization = Self.resolve(manager.authorizationStatus)
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.distanceFilter = 8
        if authorization == .authorized { start() }
    }

    func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    func start() {
        guard authorization == .authorized, !isLocating else { return }
        manager.startUpdatingLocation()
        isLocating = true
    }

    func stop() {
        manager.stopUpdatingLocation()
        isLocating = false
    }

    private static func resolve(_ status: CLAuthorizationStatus) -> AuthorizationState {
        switch status {
        case .authorizedAlways, .authorizedWhenInUse: .authorized
        case .denied, .restricted: .denied
        case .notDetermined: .notDetermined
        @unknown default: .notDetermined
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let state = Self.resolve(manager.authorizationStatus)
        Task { @MainActor in
            self.authorization = state
            if state == .authorized { self.start() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last else { return }
        Task { @MainActor in
            self.location = latest
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            print("location error: \(error.localizedDescription)")
        }
    }
}
