import Foundation

enum YouTubeSearchURL {
    static func resultsURL(for searchTerm: String) -> URL? {
        var components = URLComponents(string: "https://www.youtube.com/results")
        components?.queryItems = [
            URLQueryItem(name: "search_query", value: searchTerm)
        ]
        return components?.url
    }
}
