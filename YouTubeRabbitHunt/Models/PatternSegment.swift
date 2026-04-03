import Foundation

enum PatternSegmentKind: String, Codable {
    case literal
    case digits
    case date_ymd
}

struct PatternSegment: Codable, Identifiable, Hashable {
    var id: String { "\(kind.rawValue)-\(stableKey)" }

    let kind: PatternSegmentKind

    /// When `kind == .literal`
    var text: String?

    /// When `kind == .digits`: how many digits wide (for padding)
    var count: Int?
    /// Inclusive lower bound
    var min: Int?
    /// Inclusive upper bound
    var max: Int?
    /// Pad with leading zeros to `count` width
    var padZeros: Bool?

    /// When `kind == .date_ymd`: inclusive Gregorian year bounds; emits random valid YYYYMMDD.
    var yearMin: Int?
    var yearMax: Int?

    private var stableKey: String {
        switch kind {
        case .literal:
            return text ?? ""
        case .digits:
            return "\(count ?? 0)-\(min ?? 0)-\(max ?? 0)-\(padZeros == true)"
        case .date_ymd:
            return "\(yearMin ?? 0)-\(yearMax ?? 0)"
        }
    }

    private enum CodingKeys: String, CodingKey {
        case kind
        case text
        case count
        case min
        case max
        case padZeros
        case yearMin
        case yearMax
    }
}

struct ElementCategory: Codable, Identifiable, Hashable {
    let id: String
    let title: String
}

struct RandomElementDefinition: Codable, Identifiable, Hashable {
    let id: String
    /// References ``ElementCategory/id`` in the same JSON file.
    let categoryId: String
    let title: String
    let segments: [PatternSegment]
}

struct ElementCatalogFile: Codable {
    let version: Int
    let categories: [ElementCategory]
    let elements: [RandomElementDefinition]
}
