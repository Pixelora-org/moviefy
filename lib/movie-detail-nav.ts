import { GENRES, type Genre, type Movie } from "@/lib/types";
import { posterPathFromTmdbPosterUrl, tmdbPosterUrl } from "@/lib/tmdb-image";

function tmdbIdFromMovie(movie: Movie): number | null {
  if (movie.tmdbId != null && Number.isFinite(movie.tmdbId)) return movie.tmdbId;
  if (movie.id.startsWith("tmdb-")) {
    const n = Number(movie.id.slice(5));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Path under `/app` for the full-screen movie detail (TMDB-backed). Empty string if not linkable. */
export function movieToDetailPageHref(
  movie: Movie,
  from?: "explore" | "releases" | "reels",
  media?: "movie" | "tv",
): string {
  const tid = tmdbIdFromMovie(movie);
  if (tid == null) return "";
  const q = new URLSearchParams();
  q.set("title", movie.title);
  q.set("year", String(movie.year));
  q.set("genre", movie.genre);
  q.set("director", movie.director);
  const pp = posterPathFromTmdbPosterUrl(movie.posterImage);
  if (pp) q.set("pp", pp);
  if (from) q.set("from", from);
  if ((media ?? movie.mediaType) === "tv") q.set("media", "tv");
  return `/app/movie/${tid}?${q.toString()}`;
}

export function movieFromDetailPageParams(
  tmdbId: number,
  sp: URLSearchParams,
): Movie | null {
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;
  const title = sp.get("title")?.trim() || "Film";
  const year = Number(sp.get("year")) || 0;
  const g = sp.get("genre")?.trim() || "";
  const genre: Genre = (GENRES as readonly string[]).includes(g)
    ? (g as Genre)
    : "Drama";
  const director = sp.get("director")?.trim() || "—";
  const pp = sp.get("pp")?.trim();
  const posterImage =
    pp && pp.length > 1 ? tmdbPosterUrl(pp.startsWith("/") ? pp : `/${pp}`, "w342") : "";
  return {
    id: `tmdb-${tmdbId}`,
    title,
    year,
    genre,
    posterClass: "from-zinc-700 to-zinc-900",
    posterImage,
    director,
    tmdbId,
    mediaType: sp.get("media") === "tv" ? "tv" : "movie",
  };
}
