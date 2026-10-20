import Foundation

enum APIError: LocalizedError {
    case badStatus(Int, String?)
    case invalidBaseURL

    var errorDescription: String? {
        switch self {
        case .badStatus(let code, let message): message ?? "The server returned an error (\(code))."
        case .invalidBaseURL: "The server address in Settings isn't a valid URL."
        }
    }
}

struct ChatTurn: Codable, Hashable {
    let role: String
    let content: String
}

/// Talks to the Edge backend. API keys for odds data and Claude live on the
/// server, never in the app binary.
struct APIClient {
    let baseURL: URL
    let token: String?

    static var current: APIClient {
        get throws {
            guard let url = URL(string: AppConfig.apiBaseURL), url.scheme != nil else { throw APIError.invalidBaseURL }
            return APIClient(baseURL: url, token: AppConfig.apiToken)
        }
    }

    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        // A freshly researched board can take a couple of minutes on a cold cache.
        config.timeoutIntervalForRequest = 300
        config.timeoutIntervalForResource = 300
        return URLSession(configuration: config)
    }()

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = ISO8601DateFormatter.withFractionalSeconds.date(from: string)
                ?? ISO8601DateFormatter.standard.date(from: string) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Bad date: \(string)")
        }
        return decoder
    }()

    func sports() async throws -> [Sport] {
        let response: SportsResponse = try await get("v1/sports")
        return response.sports
    }

    func picks(sport: String, books: [String]) async throws -> PicksResponse {
        var query = [URLQueryItem(name: "sport", value: sport)]
        if !books.isEmpty { query.append(URLQueryItem(name: "books", value: books.joined(separator: ","))) }
        return try await get("v1/picks", query: query)
    }

    func ask(question: String, history: [ChatTurn]) async throws -> AskResponse {
        struct Body: Encodable { let question: String; let history: [ChatTurn] }
        var request = makeRequest("v1/ask")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(Body(question: question, history: history))
        return try await send(request)
    }

    private func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        try await send(makeRequest(path, query: query))
    }

    private func makeRequest(_ path: String, query: [URLQueryItem] = []) -> URLRequest {
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        var request = URLRequest(url: components.url!)
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await Self.session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw APIError.badStatus(status, try? JSONDecoder().decode(ErrorBody.self, from: data).error)
        }
        return try Self.decoder.decode(T.self, from: data)
    }
}

private struct ErrorBody: Decodable {
    let error: String
}

extension ISO8601DateFormatter {
    static let withFractionalSeconds: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static let standard: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}
