/**
 * Server-only: Search TMDB for movies by title and optional year.
 * Used to resolve movie identifications from LLM to TMDB movie objects.
 */

import type { Movie } from "@/lib/types";
import { movieFromTmdbDiscoverItem } from "@/lib/tmdb-genre-map";

type TmdbMovieSearchResult = {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  poster_path: string | null;
  overview: string;
  genre_ids: number[];
  popularity?: number;
};

export type TmdbMovieSearchResponse = {
  results?: TmdbMovieSearchResult[];
};

/**
 * Search TMDB for a movie by title and optional year.
 * Returns the best match or null if no results.
 */
export async function searchTmdbMovie(params: {
  title: string;
  year?: number;
}): Promise<Movie | null> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) return null;

  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", params.title);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("page", "1");

  if (params.year) {
    url.searchParams.set("year", String(params.year));
  }

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = (await res.json()) as TmdbMovieSearchResponse;
    const results = data.results ?? [];

    if (results.length === 0) return null;

    // Return the first result (TMDB ranks by relevance)
    const topResult = results[0];

    // Convert to Movie type using existing mapper
    const movie = movieFromTmdbDiscoverItem(topResult, []);

    return movie;
  } catch {
    return null;
  }
}

/**
 * Search TMDB for multiple movies in parallel.
 * Returns an array of results (null for failed searches).
 */
export async function searchTmdbMovieBatch(
  queries: Array<{ title: string; year?: number }>,
): Promise<Array<Movie | null>> {
  return Promise.all(queries.map((q) => searchTmdbMovie(q)));
}
