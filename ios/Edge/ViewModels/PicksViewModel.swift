import Foundation
import Observation

@Observable
@MainActor
final class PicksViewModel {
    var sports: [Sport] = []
    var selectedSportKey = "americanfootball_nfl"

    private(set) var boards: [String: PicksResponse] = [:]
    private(set) var loadingSports: Set<String> = []
    private(set) var errors: [String: String] = [:]

    var currentBoard: PicksResponse? { boards[selectedSportKey] }
    var isLoading: Bool { loadingSports.contains(selectedSportKey) }
    var errorMessage: String? { errors[selectedSportKey] }
    var selectedSport: Sport? { sports.first { $0.key == selectedSportKey } }

    func loadSports() async {
        guard sports.isEmpty else { return }
        do {
            let all = try await APIClient.current.sports()
            // In-season sports first, keeping the server's order otherwise.
            sports = all.filter(\.active) + all.filter { !$0.active }
            if let first = sports.first, !sports.contains(where: { $0.key == selectedSportKey && $0.active }) {
                selectedSportKey = first.key
            }
        } catch {
            errors[selectedSportKey] = error.localizedDescription
        }
    }

    /// Loads the board for the selected sport. Cached boards are kept on screen while refreshing.
    func load(force: Bool = false) async {
        let sport = selectedSportKey
        if !force, boards[sport] != nil { return }
        guard !loadingSports.contains(sport) else { return }
        loadingSports.insert(sport)
        defer { loadingSports.remove(sport) }
        do {
            boards[sport] = try await APIClient.current.picks(sport: sport, books: AppConfig.selectedBooks)
            errors[sport] = nil
        } catch {
            errors[sport] = error.localizedDescription
        }
    }

    /// Call when settings that change the board (such as the user's books) change.
    func invalidate() {
        boards.removeAll()
    }

    var allLoadedPicks: [Pick] { boards.values.flatMap(\.picks) }
}
