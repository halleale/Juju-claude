import SwiftUI

struct AskView: View {
    @Environment(AskViewModel.self) private var model
    @FocusState private var inputFocused: Bool

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if model.messages.isEmpty {
                            EmptyAskView { question in
                                Task { await model.send(question) }
                            }
                        }
                        ForEach(model.messages) { message in
                            MessageBubble(message: message).id(message.id)
                        }
                        if model.isSending {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Researching…").font(.footnote).foregroundStyle(.secondary)
                            }
                            .id("typing")
                        }
                    }
                    .padding()
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: model.messages.count) {
                    if let last = model.messages.last?.id {
                        withAnimation { proxy.scrollTo(last, anchor: .bottom) }
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Ask Edge")
            .toolbar {
                if !model.messages.isEmpty {
                    Button("New chat", systemImage: "square.and.pencil") { model.reset() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                HStack(alignment: .bottom, spacing: 8) {
                    TextField("Ask about a game, a bet, or strategy", text: $model.draft, axis: .vertical)
                        .lineLimit(1...5)
                        .focused($inputFocused)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
                    Button {
                        Task { await model.send() }
                    } label: {
                        Image(systemName: "arrow.up.circle.fill").font(.system(size: 32))
                    }
                    .disabled(model.isSending || model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityLabel("Send")
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(.bar)
            }
        }
    }
}

private struct EmptyAskView: View {
    let onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: "sparkles").font(.largeTitle).foregroundStyle(Color.accentColor)
            Text("Your betting analyst").font(.title2.bold())
            Text("Ask about matchups, injuries, odds or bankroll strategy. Edge searches the latest news and knows today's board.")
                .foregroundStyle(.secondary)
            ForEach(AskViewModel.suggestions, id: \.self) { suggestion in
                Button {
                    onSelect(suggestion)
                } label: {
                    Text(suggestion)
                        .font(.subheadline)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 24)
    }
}

private struct MessageBubble: View {
    let message: ChatMessage

    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 40) }
            VStack(alignment: .leading, spacing: 8) {
                MarkdownText(message.text)
                    .foregroundStyle(isUser ? Color.white : (message.isError ? Color.red : Color.primary))
                    .textSelection(.enabled)
                if !message.sources.isEmpty {
                    Divider()
                    ForEach(message.sources.prefix(5)) { source in
                        if let url = URL(string: source.url) {
                            Link(destination: url) {
                                Label(source.title, systemImage: "link").font(.caption).lineLimit(1)
                            }
                        }
                    }
                }
            }
            .padding(12)
            .background(
                isUser ? Color.accentColor : Color(.secondarySystemGroupedBackground),
                in: RoundedRectangle(cornerRadius: 16)
            )
            if !isUser { Spacer(minLength: 40) }
        }
    }
}
