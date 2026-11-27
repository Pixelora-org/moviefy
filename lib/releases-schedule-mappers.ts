import type { ScheduleItem } from "@/lib/releases-schedule-types";
import type { ReleaseWatchlistRow } from "@/lib/supabase/release-watchlist-service";
import { tmdbPosterUrl } from "@/lib/tmdb-image";
import type { Genre, Movie } from "@/lib/types";

/** Minimal `Movie` for detail route + enrich prefetch from a schedule row. */
export function scheduleItemToMovie(item: ScheduleItem): Movie {
  const year = Number(item.releaseDate.slice(0, 4)) || 0;
  const posterImage = item.posterPath
    ? tmdbPosterUrl(item.posterPath, "w342")
    : "";
  return {
    id: `tmdb-${item.tmdbId}`,
    title: item.title,
    year,
    genre: "Drama" as Genre,
    posterClass: "from-zinc-700 to-zinc-900",
    posterImage,
    director: "—",
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
  };
}

/** Rehydrate a DB row into the same shape as the radar for detail navigation. */
export function releaseWatchlistRowToScheduleItem(
  row: ReleaseWatchlistRow,
): ScheduleItem {
  return {
    mediaType: row.mediaType,
    tmdbId: row.tmdbId,
    title: row.title,
    posterPath: row.posterPath,
    releaseDate: row.releaseDate,
    voteAverage: 0,
    voteCount: 0,
    popularity: 0,
    kindLabel: row.mediaType === "tv" ? "Show" : "Film",
    releaseVenueLabel: "Your coming-up list",
  };
}
