import Foundation

// Mirrors backend/src/lib/types.ts. Keep the two in sync.

enum Market: String, Codable, Hashable {
    case h2h, spreads, totals

    var title: String {
        switch self {
        case .h2h: "Moneyline"
        case .spreads: "Spread"
        case .totals: "Total"
        }
    }
}

enum Verdict: String, Codable, Hashable {
    case strong, lean, pass

    var title: String {
        switch self {
        case .strong: "Strong play"
        case .lean: "Lean"
        case .pass: "Pass"
        }
    }
}

struct BookPrice: Codable, Hashable, Identifiable {
    let book: String
    let bookTitle: String
    let americanOdds: Int
    let noVigProbability: Double

    var id: String { book }
}

struct KeyFactor: Codable, Hashable, Identifiable {
    enum Impact: String, Codable, Hashable { case positive, negative, neutral }

    let label: String
    let impact: Impact
    let detail: String

    var id: String { label + detail }
}

struct SourceLink: Codable, Hashable, Identifiable {
    let title: String
    let url: String

    var id: String { url }
}

struct Analysis: Codable, Hashable {
    let verdict: Verdict
    let confidence: Int
    let headline: String
    let reasoning: String
    let keyFactors: [KeyFactor]
    let risks: [String]
    let sources: [SourceLink]
}

struct Pick: Codable, Hashable, Identifiable {
    let id: String
    let eventId: String
    let sportKey: String
    let sportTitle: String
    let commenceTime: Date
    let homeTeam: String
    let awayTeam: String
    let market: Market
    let selection: String
    let point: Double?
    let bestBook: String
    let bestBookTitle: String
    let bestAmericanOdds: Int
    let fairProbability: Double
    let fairAmericanOdds: Int
    let expectedValue: Double
    let suggestedStakeFraction: Double
    let booksCompared: Int
    let sharpBooksCompared: Int
    let marketDisagreement: Double
    let modelConfidence: Int
    let prices: [BookPrice]
    let analysis: Analysis
    /// "ai" when researched by the AI analyst, "rules" for offline analysis.
    let analysisSource: String

    var matchup: String { "\(awayTeam) @ \(homeTeam)" }

    var isAIResearched: Bool { analysisSource != "rules" }

    /// e.g. "Celtics -4.5", "Over 221.5", "Knicks ML".
    var betLabel: String {
        switch market {
        case .h2h:
            return selection == "Draw" ? "Draw" : "\(selection) ML"
        case .spreads:
            guard let point else { return selection }
            return "\(selection) \(OddsFormatter.signedPoint(point))"
        case .totals:
            guard let point else { return selection }
            return "\(selection) \(OddsFormatter.point(point))"
        }
    }
}

struct PicksResponse: Codable, Hashable {
    let sportKey: String
    let generatedAt: Date
    let dataSource: String
    let picks: [Pick]
    let passes: [Pick]
    let disclaimer: String

    var isDemo: Bool { dataSource == "demo" }
}

struct Sport: Codable, Hashable, Identifiable {
    let key: String
    let title: String
    let group: String
    let active: Bool

    var id: String { key }

    var symbol: String {
        switch group {
        case "American Football": "football.fill"
        case "Basketball": "basketball.fill"
        case "Baseball": "baseball.fill"
        case "Ice Hockey": "hockey.puck.fill"
        case "Soccer": "soccerball"
        case "Mixed Martial Arts": "figure.boxing"
        default: "sportscourt.fill"
        }
    }
}

struct SportsResponse: Codable {
    let sports: [Sport]
}

struct AskResponse: Codable {
    let answer: String
    let sources: [SourceLink]
}
