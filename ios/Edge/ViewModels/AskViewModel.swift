import Foundation
import Observation

struct ChatMessage: Identifiable, Hashable {
    enum Role: String { case user, assistant }

    let id = UUID()
    let role: Role
    let text: String
    var sources: [SourceLink] = []
    var isError = false
}

@Observable
@MainActor
final class AskViewModel {
    var messages: [ChatMessage] = []
    var draft = ""
    private(set) var isSending = false

    static let suggestions = [
        "What's the best bet on the board today and why?",
        "Explain expected value like I'm new to betting.",
        "How much of my bankroll should I bet per game?",
        "Any injury news I should know before tonight's games?",
    ]

    func send(_ text: String? = nil) async {
        let question = (text ?? draft).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !isSending else { return }
        draft = ""
        // Only successful exchanges are sent back as context.
        let history = messages.filter { !$0.isError }.suffix(12).map { ChatTurn(role: $0.role.rawValue, content: $0.text) }
        messages.append(ChatMessage(role: .user, text: question))
        isSending = true
        defer { isSending = false }
        do {
            let response = try await APIClient.current.ask(question: question, history: Array(history))
            messages.append(ChatMessage(role: .assistant, text: response.answer, sources: response.sources))
        } catch {
            messages.append(ChatMessage(role: .assistant, text: error.localizedDescription, isError: true))
        }
    }

    func reset() {
        messages.removeAll()
    }
}
