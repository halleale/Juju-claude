import XCTest
@testable import Edge

final class OddsFormatterTests: XCTestCase {
    func testAmericanToDecimal() {
        XCTAssertEqual(OddsFormatter.decimal(fromAmerican: 150), 2.5, accuracy: 1e-9)
        XCTAssertEqual(OddsFormatter.decimal(fromAmerican: -200), 1.5, accuracy: 1e-9)
    }

    func testFormatting() {
        XCTAssertEqual(OddsFormatter.american(120), "+120")
        XCTAssertEqual(OddsFormatter.american(-110), "-110")
        XCTAssertEqual(OddsFormatter.format(-110, as: .decimal), "1.91")
        XCTAssertEqual(OddsFormatter.signedPoint(3), "+3")
        XCTAssertEqual(OddsFormatter.signedPoint(-4.5), "-4.5")
        XCTAssertEqual(OddsFormatter.signedPoint(0), "PK")
        XCTAssertEqual(OddsFormatter.point(221.5), "221.5")
    }
}

final class DecodingTests: XCTestCase {
    func testDecodesPicksResponseFromServer() throws {
        let json = """
        {
          "sportKey": "basketball_nba",
          "generatedAt": "2026-10-20T12:00:00.123Z",
          "dataSource": "demo",
          "disclaimer": "Every bet can lose.",
          "passes": [],
          "picks": [{
            "id": "evt:spreads:Boston Celtics:-4.5",
            "eventId": "evt",
            "sportKey": "basketball_nba",
            "sportTitle": "NBA",
            "commenceTime": "2026-10-21T00:00:00Z",
            "homeTeam": "Boston Celtics",
            "awayTeam": "New York Knicks",
            "market": "spreads",
            "selection": "Boston Celtics",
            "point": -4.5,
            "bestBook": "fanduel",
            "bestBookTitle": "FanDuel",
            "bestAmericanOdds": 105,
            "fairProbability": 0.51,
            "fairAmericanOdds": -104,
            "expectedValue": 0.0455,
            "suggestedStakeFraction": 0.011,
            "booksCompared": 6,
            "sharpBooksCompared": 1,
            "marketDisagreement": 0.008,
            "modelConfidence": 72,
            "prices": [{"book": "fanduel", "bookTitle": "FanDuel", "americanOdds": 105, "noVigProbability": 0.47}],
            "analysis": {
              "verdict": "strong",
              "confidence": 70,
              "headline": "FanDuel is a point behind the market.",
              "reasoning": "Because...",
              "keyFactors": [{"label": "Sharp consensus", "impact": "positive", "detail": "Pinnacle -110"}],
              "risks": ["Line could move"],
              "sources": [{"title": "Injury report", "url": "https://example.com"}]
            },
            "analysisSource": "claude"
          }]
        }
        """
        let response = try APIClient.decoder.decode(PicksResponse.self, from: Data(json.utf8))
        let pick = try XCTUnwrap(response.picks.first)
        XCTAssertEqual(pick.betLabel, "Boston Celtics -4.5")
        XCTAssertEqual(pick.analysis.verdict, .strong)
        XCTAssertTrue(pick.isAIResearched)
        XCTAssertTrue(response.isDemo)
    }
}
