import SwiftUI

/// First-launch gate: age confirmation and the ground rules.
struct AgeGateView: View {
    @AppStorage(SettingsKey.ageConfirmed) private var ageConfirmed = false
    @State private var isOfAge = false
    @State private var understands = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(Color.accentColor)
                    .padding(.top, 40)
                Text("Welcome to Edge")
                    .font(.largeTitle.bold())
                Text("Edge finds sports bets priced better than their true odds and explains why, so you can bet smarter.")
                    .font(.title3)
                    .foregroundStyle(.secondary)

                VStack(alignment: .leading, spacing: 14) {
                    point("scope", "Finds value", "Compares prices across sportsbooks to find bets that pay more than they should.")
                    point("sparkles", "Explains every pick", "An AI analyst checks injuries, lineups and news, and tells you what could go wrong.")
                    point("shield.lefthalf.filled", "Bets responsibly", "Suggests stake sizes for your bankroll. No pick is ever a sure thing.")
                }

                VStack(alignment: .leading, spacing: 12) {
                    Toggle("I am 21 or older", isOn: $isOfAge)
                    Toggle("I understand recommendations are estimates, not guarantees, and that I'm responsible for following the law where I live", isOn: $understands)
                }
                .font(.subheadline)
                .padding()
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))

                Button {
                    ageConfirmed = true
                } label: {
                    Text("Get started").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!(isOfAge && understands))

                Text("Gambling problem? Call 1-800-GAMBLER.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
            }
            .padding(24)
        }
        .background(Color(.systemGroupedBackground))
    }

    private func point(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.title2)
                .foregroundStyle(Color.accentColor)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }
}
