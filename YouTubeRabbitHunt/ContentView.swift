import SwiftUI
import UIKit

struct ContentView: View {
    @EnvironmentObject private var catalogStore: ElementCatalogStore
    @Environment(\.openURL) private var openURL

    @State private var selectedCategoryIds: Set<String> = []
    @State private var selectedPatternIds: Set<String> = []
    @State private var lastTerm: String?
    @State private var lastDefinitionTitle: String?
    @State private var errorMessage: String?
    @State private var didCopy = false

    private var visibleElements: [RandomElementDefinition] {
        catalogStore.elements.filter { selectedCategoryIds.contains($0.categoryId) }
    }

    private var rollPoolCount: Int {
        SearchTermGenerator.eligibleElements(
            categoryIds: selectedCategoryIds,
            patternIds: selectedPatternIds,
            catalog: catalogStore.catalog
        ).count
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                if let loadError = catalogStore.loadError, catalogStore.elements.isEmpty {
                    Text(loadError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(.horizontal)
                }

                Text(patternHint)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)

                List {
                    Section("Categories") {
                        ForEach(catalogStore.categories) { category in
                            Toggle(isOn: categoryBinding(category.id)) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(category.title)
                                    Text(category.id)
                                        .font(.caption2)
                                        .foregroundStyle(.tertiary)
                                }
                            }
                        }
                    }

                    Section("Patterns") {
                        if selectedCategoryIds.isEmpty {
                            Text("Choose at least one category to list patterns.")
                                .foregroundStyle(.secondary)
                        } else if visibleElements.isEmpty {
                            Text("No patterns in the selected categories.")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(visibleElements) { element in
                                Toggle(isOn: patternBinding(element.id)) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(element.title)
                                            .font(.body)
                                        Text("\(element.id) · \(element.categoryId)")
                                            .font(.caption2)
                                            .foregroundStyle(.tertiary)
                                    }
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)

                if let term = lastTerm {
                    VStack(alignment: .leading, spacing: 8) {
                        if let title = lastDefinitionTitle {
                            Text(title)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text(term)
                            .font(.headline.monospaced())
                            .textSelection(.enabled)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal)
                }

                HStack(spacing: 12) {
                    Button {
                        generateAndPrepare()
                    } label: {
                        Label("Roll search", systemImage: "dice.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(selectedCategoryIds.isEmpty || rollPoolCount == 0 || catalogStore.elements.isEmpty)

                    if lastTerm != nil {
                        Button {
                            copyLastTerm()
                        } label: {
                            Label(didCopy ? "Copied" : "Copy", systemImage: didCopy ? "checkmark" : "doc.on.doc")
                                .frame(minWidth: 72)
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding(.horizontal)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(.horizontal)
                }
            }
            .navigationTitle("YouTube Rabbit Hunt")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        openYouTube()
                    } label: {
                        Label("Open YouTube", systemImage: "safari")
                    }
                    .disabled(lastTerm == nil)
                }
            }
        }
    }

    private var patternHint: String {
        if selectedCategoryIds.isEmpty {
            return "Select categories (e.g. body cameras, webcams). Leave patterns unselected to roll across every pattern in those categories."
        }
        if selectedPatternIds.isEmpty {
            return "Rolling among all \(visibleElements.count) pattern(s) in the selected categories."
        }
        return "Rolling only among \(selectedPatternIds.count) selected pattern(s)."
    }

    private func categoryBinding(_ id: String) -> Binding<Bool> {
        Binding(
            get: { selectedCategoryIds.contains(id) },
            set: { isOn in
                if isOn {
                    selectedCategoryIds = selectedCategoryIds.union([id])
                } else {
                    var cats = selectedCategoryIds
                    cats.remove(id)
                    selectedCategoryIds = cats
                    let allowed = Set(catalogStore.elements.filter { cats.contains($0.categoryId) }.map(\.id))
                    selectedPatternIds = selectedPatternIds.intersection(allowed)
                }
            }
        )
    }

    private func patternBinding(_ id: String) -> Binding<Bool> {
        Binding(
            get: { selectedPatternIds.contains(id) },
            set: { isOn in
                if isOn {
                    selectedPatternIds = selectedPatternIds.union([id])
                } else {
                    var ids = selectedPatternIds
                    ids.remove(id)
                    selectedPatternIds = ids
                }
            }
        )
    }

    private func generateAndPrepare() {
        errorMessage = nil
        didCopy = false

        do {
            var rng = SystemRandomNumberGenerator()
            let (definition, term) = try SearchTermGenerator.generate(
                categoryIds: selectedCategoryIds,
                patternIds: selectedPatternIds,
                catalog: catalogStore.catalog,
                rng: &rng
            )
            lastDefinitionTitle = definition.title
            lastTerm = term
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func openYouTube() {
        guard let term = lastTerm, let url = YouTubeSearchURL.resultsURL(for: term) else { return }
        openURL(url)
    }

    private func copyLastTerm() {
        guard let term = lastTerm else { return }
        UIPasteboard.general.string = term
        didCopy = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            didCopy = false
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(ElementCatalogStore())
}
