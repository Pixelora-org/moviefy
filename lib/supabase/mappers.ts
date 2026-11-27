import { tmdbPosterUrl } from "@/lib/tmdb-image";
import { GENRES, type CommunityPlaylist, type Genre, type Movie, type Playlist, type PlaylistMovie } from "@/lib/types";

type MovieRow = {
  id: string;
  tmdb_id: number | null;
  title: string;
  year: number;
  genre: string;
  director: string;
  poster_path: string | null;
  poster_class: string;
  media_type?: "movie" | "tv" | null;
};

function normalizeGenre(g: string): Genre {
  return (GENRES as readonly string[]).includes(g) ? (g as Genre) : "Drama";
}

export function movieRowToMovie(row: MovieRow): Movie {
  return {
    id: row.id,
    title: row.title,
    year: row.year,
    genre: normalizeGenre(row.genre),
    posterClass: row.poster_class || "from-zinc-700 to-zinc-900",
    posterImage: row.poster_path ? tmdbPosterUrl(row.poster_path, "w342") : "",
    director: row.director || "—",
    tmdbId: row.tmdb_id ?? undefined,
    mediaType: row.media_type === "tv" ? "tv" : "movie",
  };
}

export function playlistMovieFromRow(
  row: MovieRow,
  rank: number,
): PlaylistMovie {
  return { ...movieRowToMovie(row), rank };
}

type PlaylistRow = {
  id: string;
  name: string;
  description: string;
  is_public: boolean;
  kind: "collection" | "watched";
  follower_count?: number | null;
};

type ProfileRow = {
  display_name: string | null;
  handle: string | null;
};

export function toPlaylist(
  p: PlaylistRow,
  movies: PlaylistMovie[],
): Playlist {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    isPublic: p.is_public,
    kind: p.kind,
    movies,
  };
}

export function toCommunityPlaylist(
  p: PlaylistRow & { user_id?: string },
  movies: PlaylistMovie[],
  profile: ProfileRow | null,
  followerCount: number,
  likeCount: number,
): CommunityPlaylist {
  return {
    ...toPlaylist(p, movies),
    ownerUserId: (p as { user_id: string }).user_id,
    ownerName: profile?.display_name?.trim() || "Creator",
    ownerHandle: profile?.handle?.trim()
      ? profile.handle.startsWith("@")
        ? profile.handle
        : `@${profile.handle}`
      : "",
    followerCount,
    likeCount,
  };
}
