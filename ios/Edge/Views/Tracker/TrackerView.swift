import SwiftData
import SwiftUI

struct TrackerView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \TrackedBet.placedAt, order: .reverse) private var bets: [TrackedBet]

    var body: some View {
        NavigationStack {
            Group {
                if bets.isEmpty {
                    ContentUnavailableView(
                        "No tracked bets",
                        systemImage: "list.bullet.clipboard",
                        description: Text("Tap \"Track this bet\" on any pick to log it here and see how your results compare with the expected edge.")
                    )
                } else {
                    List {
                        Section { SummaryCard(bets: bets) }
                        Section("Bets") {
                            ForEach(bets) { bet in
                                BetRow(bet: bet)
                                    .swipeActions(edge: .leading) {
                                        Button("Won") { bet.result = .won }.tint(.green)
                                        Button("Lost") { bet.result = .lost }.tint(.red)
                                    }
                                    .contextMenu {
                                        ForEach(BetResult.allCases) { result in
                                            Button(result.title) { bet.result = result }
                                        }
                                    }
                            }
                            .onDelete { offsets in
                                for index in offsets { modelContext.delete(bets[index]) }
                            }
                        }
                    }
                }
            }
            .navigationTitle("My Bets")
        }
    }
}

private struct SummaryCard: View {
    let bets: [TrackedBet]

    private var settled: [TrackedBet] { bets.filter { $0.result != .pending } }
    private var profit: Double { settled.reduce(0) { $0 + $1.profit } }
    private var staked: Double { settled.filter { $0.result != .push }.reduce(0) { $0 + $1.stake } }
    private var expected: Double { settled.reduce(0) { $0 + $1.expectedProfit } }
    private var roi: Double { staked > 0 ? profit / staked : 0 }

    private func count(_ result: BetResult) -> Int { bets.filter { $0.result == result }.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                MetricView(title: "Record", value: "\(count(.won))-\(count(.lost))-\(count(.push))")
                Spacer()
                MetricView(title: "Profit", value: OddsFormatter.currency(profit), tint: profit >= 0 ? .green : .red)
                Spacer()
                MetricView(title: "ROI", value: OddsFormatter.signedPercent(roi))
            }
            HStack {
                MetricView(title: "Expected profit", value: OddsFormatter.currency(expected))
                Spacer()
                MetricView(title: "Pending", value: "\(count(.pending))")
            }
            Text("Results swing a lot over small samples. Judge the strategy on hundreds of bets, and on whether actual profit tracks expected profit.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

private struct BetRow: View {
    let bet: TrackedBet
    @AppStorage(SettingsKey.oddsFormat) private var oddsFormat = OddsFormat.american

    private var resultColor: Color {
        switch bet.result {
        case .won: .green
        case .lost: .red
        case .push, .pending: .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(bet.betLabel).font(.headline)
                Spacer()
                Text(bet.result.title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(resultColor)
            }
            Text(bet.matchup).font(.subheadline).foregroundStyle(.secondary)
            HStack {
                Text("\(OddsFormatter.currency(bet.stake)) at \(OddsFormatter.format(bet.americanOdds, as: oddsFormat)) · \(bet.book)")
                Spacer()
                if bet.result != .pending {
                    Text(OddsFormatter.currency(bet.profit))
                        .foregroundStyle(bet.profit >= 0 ? Color.green : Color.red)
                }
            }
            .font(.caption.monospacedDigit())
        }
    }
}
