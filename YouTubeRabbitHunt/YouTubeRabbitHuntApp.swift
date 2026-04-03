import SwiftUI

@main
struct YouTubeRabbitHuntApp: App {
    @StateObject private var catalogStore = ElementCatalogStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(catalogStore)
        }
    }
}
