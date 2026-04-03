export function youtubeResultsUrl(searchTerm: string): string {
  const base = new URL("https://www.youtube.com/results");
  base.searchParams.set("search_query", searchTerm);
  return base.toString();
}
