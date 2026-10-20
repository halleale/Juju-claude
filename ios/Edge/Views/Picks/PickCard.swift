import SwiftUI

struct PickCard: View {
    let pick: Pick
    @AppStorage(SettingsKey.bankroll) private var bankroll = 1000.0
    @AppStorage(SettingsKey.riskLevel) private var risk = RiskLevel.standard

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("\(pick.sportTitle) · \(pick.market.title)")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                Spacer()
                VerdictBadge(verdict: pick.analysis.verdict)
            }

            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(pick.betLabel)
                        .font(.title3.weight(.bold))
                    Text(pick.matchup)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                OddsChip(americanOdds: pick.bestAmericanOdds, book: pick.bestBookTitle)
            }

            Text(pick.analysis.headline)
                .font(.callout)
                .lineLimit(2)

            HStack(spacing: 18) {
                MetricView(title: "Edge", value: OddsFormatter.signedPercent(pick.expectedValue), tint: .green)
                MetricView(title: "Win prob", value: OddsFormatter.percent(pick.fairProbability, digits: 0))
                MetricView(title: "Stake", value: OddsFormatter.currency(StakeCalculator.stake(for: pick, bankroll: bankroll, risk: risk)))
                Spacer()
                ConfidenceRing(value: pick.analysis.confidence)
            }

            HStack(spacing: 4) {
                Image(systemName: "clock")
                Text(pick.commenceTime, format: .dateTime.weekday(.abbreviated).hour().minute())
                if pick.isAIResearched {
                    Spacer()
                    Label("Researched", systemImage: "sparkles")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
        .contentShape(RoundedRectangle(cornerRadius: 16))
    }
}
