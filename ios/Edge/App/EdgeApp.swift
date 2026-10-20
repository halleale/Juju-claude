import SwiftData
import SwiftUI

@main
struct EdgeApp: App {
    @State private var picks = PicksViewModel()
    @State private var ask = AskViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(picks)
                .environment(ask)
        }
        .modelContainer(for: TrackedBet.self)
    }
}

struct RootView: View {
    @AppStorage(SettingsKey.ageConfirmed) private var ageConfirmed = false

    var body: some View {
        if ageConfirmed {
            TabView {
                PicksView()
                    .tabItem { Label("Picks", systemImage: "chart.line.uptrend.xyaxis") }
                AskView()
                    .tabItem { Label("Ask Edge", systemImage: "sparkles") }
                TrackerView()
                    .tabItem { Label("My Bets", systemImage: "list.bullet.clipboard") }
                SettingsView()
                    .tabItem { Label("Settings", systemImage: "gearshape") }
            }
        } else {
            AgeGateView()
        }
    }
}
