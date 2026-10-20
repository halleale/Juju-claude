import Foundation

/// UserDefaults keys, shared by @AppStorage and non-view code.
enum SettingsKey {
    static let ageConfirmed = "ageConfirmed"
    static let bankroll = "bankroll"
    static let riskLevel = "riskLevel"
    static let oddsFormat = "oddsFormat"
    static let selectedBooks = "selectedBooks"
    static let showPasses = "showPasses"
    static let apiBaseURLOverride = "apiBaseURLOverride"
}

enum RiskLevel: String, CaseIterable, Identifiable {
    case conservative, standard, aggressive

    var id: String { rawValue }
    var title: String { rawValue.capitalized }

    /// Multiplier on the server's quarter-Kelly stake.
    var stakeMultiplier: Double {
        switch self {
        case .conservative: 0.5
        case .standard: 1
        case .aggressive: 1.5
        }
    }

    var explanation: String {
        switch self {
        case .conservative: "Eighth-Kelly. Smaller swings, slower growth."
        case .standard: "Quarter-Kelly. The usual choice for bettors with a real but uncertain edge."
        case .aggressive: "Three-eighths Kelly. Bigger swings; only if you trust the edge."
        }
    }
}

/// Sportsbooks a user can pick as "books I bet at". Keys match The Odds API.
enum Sportsbook {
    static let all: [(key: String, title: String)] = [
        ("draftkings", "DraftKings"),
        ("fanduel", "FanDuel"),
        ("betmgm", "BetMGM"),
        ("williamhill_us", "Caesars"),
        ("espnbet", "ESPN BET"),
        ("fanatics", "Fanatics"),
        ("betrivers", "BetRivers"),
        ("hardrockbet", "Hard Rock Bet"),
        ("ballybet", "Bally Bet"),
        ("betparx", "betPARX"),
        ("fliff", "Fliff"),
        ("bovada", "Bovada"),
        ("betonlineag", "BetOnline.ag"),
        ("lowvig", "LowVig.ag"),
        ("mybookieag", "MyBookie.ag"),
        ("betus", "BetUS"),
    ]
}

enum AppConfig {
    /// Server address: a Settings override if present, else the build setting
    /// EDGE_API_BASE_URL (see project.yml), else localhost for the simulator.
    static var apiBaseURL: String {
        if let override = UserDefaults.standard.string(forKey: SettingsKey.apiBaseURLOverride),
           !override.trimmingCharacters(in: .whitespaces).isEmpty {
            return override.trimmingCharacters(in: .whitespaces)
        }
        if let fromPlist = Bundle.main.object(forInfoDictionaryKey: "EdgeAPIBaseURL") as? String, !fromPlist.isEmpty {
            return fromPlist
        }
        return "http://localhost:8787"
    }

    /// Optional shared secret matching the server's APP_TOKEN.
    static var apiToken: String? {
        Bundle.main.object(forInfoDictionaryKey: "EdgeAPIToken") as? String
    }

    static var selectedBooks: [String] {
        (UserDefaults.standard.string(forKey: SettingsKey.selectedBooks) ?? "")
            .split(separator: ",")
            .map(String.init)
    }
}
