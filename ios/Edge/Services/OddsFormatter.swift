import Foundation

enum OddsFormat: String, CaseIterable, Identifiable {
    case american, decimal

    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

enum OddsFormatter {
    static func decimal(fromAmerican american: Int) -> Double {
        american > 0 ? 1 + Double(american) / 100 : 1 + 100 / Double(-american)
    }

    static func american(_ american: Int) -> String {
        american > 0 ? "+\(american)" : "\(american)"
    }

    static func format(_ american: Int, as format: OddsFormat) -> String {
        switch format {
        case .american: Self.american(american)
        case .decimal: String(format: "%.2f", decimal(fromAmerican: american))
        }
    }

    /// 3.0 -> "3", 221.5 -> "221.5"
    static func point(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    /// Spread points always carry a sign; a pick'em reads "PK".
    static func signedPoint(_ value: Double) -> String {
        if value == 0 { return "PK" }
        return value > 0 ? "+\(point(value))" : point(value)
    }

    static func percent(_ fraction: Double, digits: Int = 1) -> String {
        String(format: "%.\(digits)f%%", fraction * 100)
    }

    static func signedPercent(_ fraction: Double, digits: Int = 1) -> String {
        (fraction >= 0 ? "+" : "") + percent(fraction, digits: digits)
    }

    static func currency(_ amount: Double) -> String {
        amount.formatted(.currency(code: Locale.current.currency?.identifier ?? "USD"))
    }
}
