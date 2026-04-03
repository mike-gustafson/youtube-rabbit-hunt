import Foundation

enum SearchTermGeneratorError: LocalizedError {
    case noCategoriesSelected
    case noMatchingPatterns
    case invalidDefinition(RandomElementDefinition)

    var errorDescription: String? {
        switch self {
        case .noCategoriesSelected:
            return "Select at least one category."
        case .noMatchingPatterns:
            return "No patterns match your category and pattern filters."
        case .invalidDefinition(let def):
            return "Invalid pattern: \(def.title)"
        }
    }
}

enum SearchTermGenerator {
    /// Elements in any selected category, optionally narrowed to selected pattern ids (empty pattern set = all in categories).
    static func eligibleElements(
        categoryIds: Set<String>,
        patternIds: Set<String>,
        catalog: ElementCatalogFile
    ) -> [RandomElementDefinition] {
        let inCategory = catalog.elements.filter { categoryIds.contains($0.categoryId) }
        if patternIds.isEmpty { return inCategory }
        return inCategory.filter { patternIds.contains($0.id) }
    }

    static func generate(
        categoryIds: Set<String>,
        patternIds: Set<String>,
        catalog: ElementCatalogFile,
        rng: inout RandomNumberGenerator
    ) throws -> (definition: RandomElementDefinition, term: String) {
        if categoryIds.isEmpty { throw SearchTermGeneratorError.noCategoriesSelected }
        let pool = eligibleElements(categoryIds: categoryIds, patternIds: patternIds, catalog: catalog)
        guard let definition = pool.randomElement(using: &rng) else {
            throw SearchTermGeneratorError.noMatchingPatterns
        }
        let term = try generateTerm(for: definition, rng: &rng)
        return (definition, term)
    }

    static func generateTerm(for definition: RandomElementDefinition, rng: inout RandomNumberGenerator) throws -> String {
        var parts: [String] = []
        parts.reserveCapacity(definition.segments.count)

        for segment in definition.segments {
            switch segment.kind {
            case .literal:
                guard let text = segment.text else { throw SearchTermGeneratorError.invalidDefinition(definition) }
                parts.append(text)
            case .digits:
                guard
                    let count = segment.count, count > 0,
                    let min = segment.min,
                    let max = segment.max,
                    min <= max
                else { throw SearchTermGeneratorError.invalidDefinition(definition) }
                let value = Int.random(in: min...max, using: &rng)
                let pad = segment.padZeros ?? false
                if pad {
                    parts.append(String(format: "%0*d", locale: nil, count, value))
                } else {
                    parts.append(String(value))
                }
            case .date_ymd:
                guard
                    let y0 = segment.yearMin,
                    let y1 = segment.yearMax,
                    y0 <= y1
                else { throw SearchTermGeneratorError.invalidDefinition(definition) }
                parts.append(randomDateYMD(yearMin: y0, yearMax: y1, rng: &rng))
            }
        }

        return parts.joined()
    }

    /// Random `YYYYMMDD` with a valid calendar day in `[yearMin, yearMax]` (Gregorian, UTC).
    private static func randomDateYMD(yearMin: Int, yearMax: Int, rng: inout RandomNumberGenerator) -> String {
        let y = Int.random(in: yearMin...yearMax, using: &rng)
        let m = Int.random(in: 1...12, using: &rng)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(secondsFromGMT: 0)!
        guard
            let start = cal.date(from: DateComponents(year: y, month: m, day: 1)),
            let dayRange = cal.range(of: .day, in: .month, for: start)
        else {
            return String(format: "%04d0101", y)
        }
        let d = Int.random(in: dayRange, using: &rng)
        return String(format: "%04d%02d%02d", y, m, d)
    }
}
