import SwiftUI

extension Verdict {
    var color: Color {
        switch self {
        case .strong: .green
        case .lean: .orange
        case .pass: .secondary
        }
    }

    var symbol: String {
        switch self {
        case .strong: "bolt.fill"
        case .lean: "arrow.up.right"
        case .pass: "hand.raised.fill"
        }
    }
}

extension KeyFactor.Impact {
    var color: Color {
        switch self {
        case .positive: .green
        case .negative: .red
        case .neutral: .secondary
        }
    }

    var symbol: String {
        switch self {
        case .positive: "plus.circle.fill"
        case .negative: "minus.circle.fill"
        case .neutral: "circle.fill"
        }
    }
}

struct VerdictBadge: View {
    let verdict: Verdict

    var body: some View {
        Label(verdict.title, systemImage: verdict.symbol)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundStyle(verdict.color)
            .background(verdict.color.opacity(0.15), in: Capsule())
    }
}

struct ConfidenceRing: View {
    let value: Int
    var size: CGFloat = 44

    private var color: Color {
        switch value {
        case 70...: .green
        case 50..<70: .orange
        default: .red
        }
    }

    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.2), lineWidth: 5)
            Circle()
                .trim(from: 0, to: CGFloat(value) / 100)
                .stroke(color, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(value)")
                .font(.system(size: size * 0.32, weight: .bold, design: .rounded))
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Confidence \(value) out of 100")
    }
}

struct MetricView: View {
    let title: String
    let value: String
    var tint: Color = .primary

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text(value)
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(tint)
        }
    }
}

struct OddsChip: View {
    let americanOdds: Int
    let book: String
    @AppStorage(SettingsKey.oddsFormat) private var oddsFormat = OddsFormat.american

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(OddsFormatter.format(americanOdds, as: oddsFormat))
                .font(.title3.weight(.bold).monospacedDigit())
            Text(book)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

struct DisclaimerFooter: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
    }
}

/// Renders the light Markdown the model writes (bold, italics, links), keeping line breaks.
struct MarkdownText: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        if let attributed = try? AttributedString(markdown: text, options: options) {
            Text(attributed)
        } else {
            Text(text)
        }
    }
}

enum StakeCalculator {
    /// Dollar stake for a pick given the user's bankroll and risk level, rounded to whole dollars.
    static func stake(for pick: Pick, bankroll: Double, risk: RiskLevel) -> Double {
        (bankroll * pick.suggestedStakeFraction * risk.stakeMultiplier).rounded()
    }
}
