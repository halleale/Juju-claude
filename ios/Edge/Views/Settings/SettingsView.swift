import SwiftUI

struct SettingsView: View {
    @AppStorage(SettingsKey.bankroll) private var bankroll = 1000.0
    @AppStorage(SettingsKey.riskLevel) private var risk = RiskLevel.standard
    @AppStorage(SettingsKey.oddsFormat) private var oddsFormat = OddsFormat.american
    @AppStorage(SettingsKey.selectedBooks) private var selectedBooks = ""
    @AppStorage(SettingsKey.showPasses) private var showPasses = true
    @AppStorage(SettingsKey.apiBaseURLOverride) private var apiBaseURLOverride = ""

    private var bookCount: Int { selectedBooks.split(separator: ",").count }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Bankroll") {
                        TextField("Bankroll", value: $bankroll, format: .currency(code: Locale.current.currency?.identifier ?? "USD"))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                    Picker("Risk level", selection: $risk) {
                        ForEach(RiskLevel.allCases) { Text($0.title).tag($0) }
                    }
                } header: {
                    Text("Bankroll")
                } footer: {
                    Text("Money set aside only for betting. \(risk.explanation) Stakes are capped at a few percent of bankroll per bet.")
                }

                Section {
                    NavigationLink {
                        BooksPicker(selection: $selectedBooks)
                    } label: {
                        LabeledContent("My sportsbooks", value: bookCount == 0 ? "All" : "\(bookCount) selected")
                    }
                    Picker("Odds format", selection: $oddsFormat) {
                        ForEach(OddsFormat.allCases) { Text($0.title).tag($0) }
                    }
                    Toggle("Show passed bets", isOn: $showPasses)
                } header: {
                    Text("Picks")
                } footer: {
                    Text("Choose the books you have accounts with so every pick is a price you can actually get.")
                }

                Section("How Edge picks bets") {
                    Text("""
                    1. Edge compares prices for every game across many sportsbooks.
                    2. It removes each book's margin and blends the books, weighting sharp books most, into a fair probability.
                    3. Prices that pay more than that fair probability are +EV: profitable over the long run.
                    4. An AI analyst researches each one (injuries, lineups, weather, news) and passes on any edge the news explains away.
                    """)
                    .font(.footnote)
                }

                Section {
                    Link(destination: URL(string: "tel:18004264237")!) {
                        Label("Call 1-800-GAMBLER", systemImage: "phone.fill")
                    }
                    Link(destination: URL(string: "https://www.ncpgambling.org/help-treatment/")!) {
                        Label("National Council on Problem Gambling", systemImage: "heart.text.square")
                    }
                } header: {
                    Text("Responsible gambling")
                } footer: {
                    Text("Edge gives information, not guarantees, and doesn't take bets. Never bet more than you can afford to lose. Betting must be legal where you are, and you must be 21+.")
                }

                Section {
                    TextField(AppConfig.apiBaseURL, text: $apiBaseURLOverride)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Server")
                } footer: {
                    Text("Leave blank to use the default. Useful for pointing a test device at your development machine.")
                }
            }
            .navigationTitle("Settings")
        }
    }
}

private struct BooksPicker: View {
    @Binding var selection: String

    private var selected: Set<String> { Set(selection.split(separator: ",").map(String.init)) }

    var body: some View {
        List {
            Section {
                ForEach(Sportsbook.all, id: \.key) { book in
                    Button {
                        toggle(book.key)
                    } label: {
                        HStack {
                            Text(book.title).foregroundStyle(Color.primary)
                            Spacer()
                            if selected.contains(book.key) {
                                Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
                            }
                        }
                    }
                }
            } footer: {
                Text("With none selected, picks may come from any book.")
            }
        }
        .navigationTitle("My sportsbooks")
        .toolbar {
            if !selection.isEmpty { Button("Clear") { selection = "" } }
        }
    }

    private func toggle(_ key: String) {
        var set = selected
        if set.contains(key) { set.remove(key) } else { set.insert(key) }
        selection = Sportsbook.all.map(\.key).filter(set.contains).joined(separator: ",")
    }
}
