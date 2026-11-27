import type { TmdbDiscoverItem } from "@/lib/movie-enrich-types";
import type { Movie } from "@/lib/types";
import { fetchPopularLandingMovies } from "@/lib/landing-movie-feed";
import { movieFromTmdbDiscoverItem } from "@/lib/tmdb-genre-map";

/** Gradient-only tiles for marketing layout when TMDB is off or still loading — not real titles. */
const LANDING_DECOR_GRADIENTS = [
  "from-violet-950 via-indigo-900 to-slate-950",
  "from-emerald-950 via-zinc-900 to-black",
  "from-rose-900 via-pink-950 to-violet-950",
  "from-orange-950 via-amber-950 to-neutral-950",
  "from-teal-950 via-cyan-950 to-slate-950",
  "from-slate-800 via-blue-950 to-black",
  "from-red-950 via-orange-950 to-stone-950",
  "from-stone-900 via-neutral-950 to-black",
] as const;

/** Neutral poster slots (empty title) for landing visuals only. */
export function landingDecorMovies(count: number): Movie[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `decor-${i}`,
    title: "",
    year: 0,
    genre: "Drama",
    posterClass: LANDING_DECOR_GRADIENTS[i % LANDING_DECOR_GRADIENTS.length]!,
    posterImage: "",
    director: "",
  }));
}

export async function getLandingMovies(): Promise<Movie[]> {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) return [];
  try {
    const results = await fetchPopularLandingMovies(key);
    const mapped = results.slice(0, 12).map((row) => movieFromTmdbDiscoverItem(row));
    return mapped.length ? mapped : [];
  } catch {
    return [];
  }
}

export function buildLandingPosterWall(movies: Movie[]): Movie[] {
  if (!movies.length) return [];
  const out: Movie[] = [];
  while (out.length < 28) {
    out.push(...movies);
  }
  return out.slice(0, 28);
}

export function landingHeroFocus(movies: Movie[], n = 6): Movie[] {
  if (!movies.length) return [];
  const idx = [7, 3, 0, 4, 9, 2].map((i) => i % movies.length);
  return idx.map((i) => movies[i]!);
}
