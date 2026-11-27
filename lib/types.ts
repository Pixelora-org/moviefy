export const GENRES = [
  "Sci-Fi",
  "Drama",
  "Thriller",
  "Comedy",
  "Horror",
  "Animation",
  "Action",
  "Romance",
] as const;

export type Genre = (typeof GENRES)[number];

export interface Movie {
  id: string;
  title: string;
  year: number;
  genre: Genre;
  /** Tailwind gradient classes for a poster placeholder */
  posterClass: string;
  /** Poster image URL (e.g. TMDB `image.tmdb.org`) */
  posterImage: string;
  director: string;
  /** TMDB id for streaming / discover APIs */
  tmdbId?: number;
  mediaType?: "movie" | "tv";
}

export interface PlaylistMovie extends Movie {
  rank: number;
}

export type PlaylistKind = "collection" | "watched";

export interface Playlist {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  kind: PlaylistKind;
  movies: PlaylistMovie[];
}

/** Public playlist card on Explore (backed by Supabase). */
export type CommunityPlaylist = Playlist & {
  ownerUserId: string;
  ownerName: string;
  ownerHandle: string;
  followerCount: number;
  likeCount: number;
};
