import type { TmdbDiscoverItem } from "@/lib/movie-enrich-types";

export async function fetchPopularLandingMovies(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<TmdbDiscoverItem[]> {
  const url = new URL("https://api.themoviedb.org/3/movie/popular");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("page", "1");

  const response = await fetcher(url.toString(), {
    next: { revalidate: 3600 },
  });
  if (!response.ok) return [];

  const data = (await response.json()) as { results?: TmdbDiscoverItem[] };
  return data.results ?? [];
}
