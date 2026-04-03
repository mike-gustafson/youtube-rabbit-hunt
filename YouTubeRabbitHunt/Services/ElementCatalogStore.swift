import Foundation
import Combine

@MainActor
final class ElementCatalogStore: ObservableObject {
    @Published private(set) var catalog: ElementCatalogFile
    @Published private(set) var loadError: String?

    init(bundle: Bundle = .main) {
        var loaded: ElementCatalogFile?
        var err: String?

        if let url = bundle.url(forResource: "element_catalog", withExtension: "json") {
            do {
                let data = try Data(contentsOf: url)
                let decoded = try JSONDecoder().decode(ElementCatalogFile.self, from: data)
                loaded = decoded
            } catch {
                err = error.localizedDescription
            }
        } else {
            err = "element_catalog.json not found in bundle."
        }

        self.catalog = loaded ?? ElementCatalogFile(version: 0, categories: [], elements: [])
        self.loadError = err
    }

    var elements: [RandomElementDefinition] { catalog.elements }

    var categories: [ElementCategory] { catalog.categories }
}
