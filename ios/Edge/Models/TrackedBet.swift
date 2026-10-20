import Foundation
import SwiftData

enum BetResult: String, Codable, CaseIterable, Identifiable {
    case pending, won, lost, push

    var id: String { rawValue }

    var title: String { rawValue.capitalized }
}

/// A bet the user chose to track. Stored on device only.
@Model
final class TrackedBet {
    var pickId: String
    var placedAt: Date
    var commenceTime: Date
    var sportTitle: String
    var matchup: String
    var betLabel: String
    var book: String
    var americanOdds: Int
    var stake: Double
    /// EV at the time of tracking, so expected and actual profit can be compared.
    var expectedValue: Double
    var resultRaw: String

    init(pick: Pick, stake: Double, americanOdds: Int? = nil, book: String? = nil) {
        self.pickId = pick.id
        self.placedAt = .now
        self.commenceTime = pick.commenceTime
        self.sportTitle = pick.sportTitle
        self.matchup = pick.matchup
        self.betLabel = pick.betLabel
        self.book = book ?? pick.bestBookTitle
        self.americanOdds = americanOdds ?? pick.bestAmericanOdds
        self.stake = stake
        self.expectedValue = pick.expectedValue
        self.resultRaw = BetResult.pending.rawValue
    }

    var result: BetResult {
        get { BetResult(rawValue: resultRaw) ?? .pending }
        set { resultRaw = newValue.rawValue }
    }

    var profit: Double {
        switch result {
        case .won: stake * (OddsFormatter.decimal(fromAmerican: americanOdds) - 1)
        case .lost: -stake
        case .pending, .push: 0
        }
    }

    var expectedProfit: Double { stake * expectedValue }
}
