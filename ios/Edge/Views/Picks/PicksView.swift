import SwiftUI

struct PicksView: View {
    @Environment(PicksViewModel.self) private var model
    @AppStorage(SettingsKey.showPasses) private var showPasses = true
    @AppStorage(SettingsKey.selectedBooks) private var selectedBooks = ""

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    SportPicker(sports: model.sports, selection: $model.selectedSportKey)
                    content
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Today's Edge")
            .navigationDestination(for: Pick.self) { PickDetailView(pick: $0) }
            .refreshable { await model.load(force: true) }
            .task {
                await model.loadSports()
                await model.load()
            }
            .onChange(of: model.selectedSportKey) {
                Task { await model.load() }
            }
            .onChange(of: selectedBooks) {
                model.invalidate()
                Task { await model.load() }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let board = model.currentBoard {
            BoardHeader(board: board, isRefreshing: model.isLoading)
            if board.picks.isEmpty {
                ContentUnavailableView(
                    "No edges right now",
                    systemImage: "scope",
                    description: Text("Nothing on this board beats the market by enough to recommend. Passing is a winning strategy too. Check back as lines move.")
                )
                .padding(.top, 24)
            } else {
                ForEach(board.picks) { pick in
                    NavigationLink(value: pick) { PickCard(pick: pick) }
                        .buttonStyle(.plain)
                }
            }
            if showPasses && !board.passes.isEmpty {
                Text("Reviewed and passed")
                    .font(.headline)
                    .padding(.top, 8)
                Text("The numbers flagged these, but the analyst found a reason not to bet them.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                ForEach(board.passes) { pick in
                    NavigationLink(value: pick) { PickCard(pick: pick).opacity(0.7) }
                        .buttonStyle(.plain)
                }
            }
            DisclaimerFooter(text: board.disclaimer)
        } else if let error = model.errorMessage, !model.isLoading {
            ContentUnavailableView {
                Label("Couldn't load picks", systemImage: "wifi.exclamationmark")
            } description: {
                Text(error)
            } actions: {
                Button("Try again") { Task { await model.load(force: true) } }
                    .buttonStyle(.borderedProminent)
            }
            .padding(.top, 24)
        } else {
            LoadingBoardView()
        }
    }
}

private struct SportPicker: View {
    let sports: [Sport]
    @Binding var selection: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(sports) { sport in
                    let isSelected = sport.key == selection
                    Button {
                        selection = sport.key
                    } label: {
                        Label(sport.title, systemImage: sport.symbol)
                            .font(.subheadline.weight(.medium))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .foregroundStyle(isSelected ? Color.white : (sport.active ? Color.primary : Color.secondary))
                            .background(isSelected ? Color.accentColor : Color(.secondarySystemGroupedBackground), in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
            .padding(.vertical, 4)
        }
    }
}

private struct BoardHeader: View {
    let board: PicksResponse
    let isRefreshing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if board.isDemo {
                Label("Demo data. Connect an odds feed on the server for live lines.", systemImage: "info.circle")
                    .font(.footnote)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.yellow.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
            }
            HStack {
                Text("\(board.picks.count) recommended · updated \(board.generatedAt, style: .relative) ago")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Spacer()
                if isRefreshing { ProgressView().controlSize(.small) }
            }
        }
    }
}

private struct LoadingBoardView: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Scanning every sportsbook and researching the best prices…")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Text("A fresh board can take a minute or two.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
}
