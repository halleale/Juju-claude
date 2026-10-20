import SwiftUI

struct PickDetailView: View {
    let pick: Pick
    @AppStorage(SettingsKey.bankroll) private var bankroll = 1000.0
    @AppStorage(SettingsKey.riskLevel) private var risk = RiskLevel.standard
    @AppStorage(SettingsKey.oddsFormat) private var oddsFormat = OddsFormat.american
    @State private var showingTrackSheet = false

    private var stake: Double { StakeCalculator.stake(for: pick, bankroll: bankroll, risk: risk) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                numbers
                section("Why this bet") {
                    MarkdownText(pick.analysis.reasoning)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                    if !pick.isAIResearched {
                        Label("Price-only analysis. News and injuries were not checked.", systemImage: "exclamationmark.triangle")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
                if !pick.analysis.keyFactors.isEmpty {
                    section("Key factors") {
                        ForEach(pick.analysis.keyFactors) { factor in
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: factor.impact.symbol)
                                    .foregroundStyle(factor.impact.color)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(factor.label).font(.subheadline.weight(.semibold))
                                    Text(factor.detail).font(.subheadline).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
                if !pick.analysis.risks.isEmpty {
                    section("What could go wrong") {
                        ForEach(pick.analysis.risks, id: \.self) { risk in
                            Label(risk, systemImage: "exclamationmark.circle")
                                .font(.subheadline)
                        }
                    }
                }
                section("Prices across books") {
                    ForEach(pick.prices) { price in
                        HStack {
                            Text(price.bookTitle)
                                .fontWeight(price.book == pick.bestBook ? .semibold : .regular)
                            if price.book == pick.bestBook {
                                Text("BEST").font(.caption2.bold()).foregroundStyle(.green)
                            }
                            Spacer()
                            Text(OddsFormatter.format(price.americanOdds, as: oddsFormat))
                                .monospacedDigit()
                        }
                        .font(.subheadline)
                    }
                }
                if !pick.analysis.sources.isEmpty {
                    section("Sources") {
                        ForEach(pick.analysis.sources) { source in
                            if let url = URL(string: source.url) {
                                Link(destination: url) {
                                    Label(source.title, systemImage: "link").font(.subheadline)
                                }
                            }
                        }
                    }
                }
                DisclaimerFooter(text: "Estimates, not guarantees. Odds change quickly; confirm the price at your book before betting. 21+. Gambling problem? Call 1-800-GAMBLER.")
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(pick.betLabel)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            Button {
                showingTrackSheet = true
            } label: {
                Label("Track this bet", systemImage: "plus.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding()
            .background(.bar)
        }
        .sheet(isPresented: $showingTrackSheet) {
            TrackBetSheet(pick: pick, suggestedStake: stake)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VerdictBadge(verdict: pick.analysis.verdict)
                Spacer()
                ConfidenceRing(value: pick.analysis.confidence, size: 56)
            }
            Text(pick.betLabel).font(.largeTitle.weight(.bold))
            Text(pick.matchup).font(.headline).foregroundStyle(.secondary)
            Text(pick.commenceTime, format: .dateTime.weekday(.wide).month().day().hour().minute())
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(pick.analysis.headline)
                .font(.title3)
                .padding(.top, 4)
        }
    }

    private var numbers: some View {
        let columns = [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)]
        return LazyVGrid(columns: columns, spacing: 14) {
            MetricView(title: "Best odds", value: OddsFormatter.format(pick.bestAmericanOdds, as: oddsFormat))
            MetricView(title: "Fair odds", value: OddsFormatter.format(pick.fairAmericanOdds, as: oddsFormat))
            MetricView(title: "Edge (EV)", value: OddsFormatter.signedPercent(pick.expectedValue), tint: .green)
            MetricView(title: "True win %", value: OddsFormatter.percent(pick.fairProbability))
            MetricView(title: "Book", value: pick.bestBookTitle)
            MetricView(title: "Stake", value: OddsFormatter.currency(stake))
            MetricView(title: "Books compared", value: "\(pick.booksCompared)")
            MetricView(title: "Sharp books", value: "\(pick.sharpBooksCompared)")
            MetricView(title: "Model score", value: "\(pick.modelConfidence)")
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct TrackBetSheet: View {
    let pick: Pick
    let suggestedStake: Double
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var stake: Double
    @State private var odds: Int
    @State private var book: String

    init(pick: Pick, suggestedStake: Double) {
        self.pick = pick
        self.suggestedStake = suggestedStake
        _stake = State(initialValue: max(suggestedStake, 1))
        _odds = State(initialValue: pick.bestAmericanOdds)
        _book = State(initialValue: pick.bestBookTitle)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Bet", value: pick.betLabel)
                    LabeledContent("Game", value: pick.matchup)
                }
                Section {
                    LabeledContent("Stake") {
                        TextField("Stake", value: $stake, format: .currency(code: Locale.current.currency?.identifier ?? "USD"))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                    LabeledContent("Odds (American)") {
                        TextField("Odds", value: $odds, format: .number.grouping(.never))
                            .keyboardType(.numbersAndPunctuation)
                            .multilineTextAlignment(.trailing)
                    }
                    LabeledContent("Book") {
                        TextField("Book", text: $book).multilineTextAlignment(.trailing)
                    }
                } footer: {
                    Text("Suggested stake: \(OddsFormatter.currency(suggestedStake)). Enter the odds you actually got if the line moved.")
                }
            }
            .navigationTitle("Track bet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        modelContext.insert(TrackedBet(pick: pick, stake: stake, americanOdds: odds, book: book))
                        dismiss()
                    }
                    .disabled(stake <= 0 || abs(odds) < 100)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
