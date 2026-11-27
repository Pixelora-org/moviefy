import type { CommunityPlaylist, Movie, Playlist, PlaylistMovie } from "@/lib/types";
import {
  movieRowToMovie,
  playlistMovieFromRow,
  toCommunityPlaylist,
  toPlaylist,
} from "@/lib/supabase/mappers";
import type { SupabaseClient } from "@supabase/supabase-js";

type MovieRow = Parameters<typeof movieRowToMovie>[0];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Persist TMDB-backed or existing rows; returns `movies.id` (uuid). */
export async function ensureMovieRow(
  client: SupabaseClient,
  movie: Movie,
): Promise<string | null> {
  if (UUID_RE.test(movie.id)) {
    const { data, error } = await client
      .from("movies")
      .select("id")
      .eq("id", movie.id)
      .maybeSingle();
    if (error) {
      console.error("[playlist-service] Existing movie lookup failed:", error);
      return null;
    }
    if (data?.id) return String(data.id);
  }

  const tmdbId =
    movie.tmdbId ??
    (movie.id.startsWith("tmdb-") ? Number(movie.id.slice(5)) : NaN);
  if (!Number.isSafeInteger(tmdbId) || tmdbId < 1) return null;

  const response = await fetch("/api/movies/ensure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tmdbId,
      mediaType: movie.mediaType ?? "movie",
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { id?: unknown };
  return typeof data.id === "string" ? data.id : null;
}

export function movieTmdbKey(
  movie: Pick<Movie, "id" | "tmdbId" | "mediaType">,
): string | null {
  const tmdbId =
    movie.tmdbId ??
    (movie.id.startsWith("tmdb-") ? Number(movie.id.slice(5)) : NaN);
  if (!Number.isSafeInteger(tmdbId) || tmdbId < 1) return null;
  return `tmdb-${movie.mediaType ?? "movie"}-${tmdbId}`;
}

async function itemsForPlaylists(
  client: SupabaseClient,
  playlistIds: string[],
): Promise<Map<string, PlaylistMovie[]>> {
  const map = new Map<string, PlaylistMovie[]>();
  if (!playlistIds.length) return map;

  const { data: rows, error } = await client
    .from("playlist_items")
    .select("playlist_id, sort_order, movies(*)")
    .in("playlist_id", playlistIds);

  if (error || !rows) return map;

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const pid = row.playlist_id as string;
    if (!grouped.has(pid)) grouped.set(pid, []);
    grouped.get(pid)!.push(row);
  }

  for (const [pid, list] of grouped) {
    list.sort(
      (a, b) => (a.sort_order as number) - (b.sort_order as number),
    );
    const movies = list.map((r, i) =>
      playlistMovieFromRow(r.movies as unknown as MovieRow, i + 1),
    );
    map.set(pid, movies);
  }
  return map;
}

export async function fetchUserPlaylists(
  client: SupabaseClient,
  userId: string,
): Promise<Playlist[]> {
  const { data: playlists, error } = await client
    .from("playlists")
    .select("id, name, description, is_public, kind")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !playlists?.length) return [];

  const ids = playlists.map((p) => p.id as string);
  const byId = await itemsForPlaylists(client, ids);

  return playlists.map((p) =>
    toPlaylist(
      {
        id: p.id as string,
        name: p.name as string,
        description: (p.description as string) ?? "",
        is_public: p.is_public as boolean,
        kind: p.kind as "collection" | "watched",
      },
      byId.get(p.id as string) ?? [],
    ),
  );
}

export async function fetchPublicCommunityPlaylists(
  client: SupabaseClient,
): Promise<CommunityPlaylist[]> {
  const { data: playlists, error } = await client
    .from("playlists")
    .select(
      "id, name, description, is_public, kind, follower_count, like_count, user_id",
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(48);

  if (error || !playlists?.length) return [];

  const ids = playlists.map((p) => p.id as string);
  const userIds = [...new Set(playlists.map((p) => p.user_id as string))];

  const [itemsMap, profilesRes] = await Promise.all([
    itemsForPlaylists(client, ids),
    client.from("profiles").select("id, display_name, handle").in("id", userIds),
  ]);

  const profileByUser = new Map(
    (profilesRes.data ?? []).map((pr) => [pr.id as string, pr]),
  );

  return playlists.map((p) => {
    const uid = p.user_id as string;
    const prof = profileByUser.get(uid) ?? null;
    const movies = itemsMap.get(p.id as string) ?? [];
    return toCommunityPlaylist(
      {
        id: p.id as string,
        name: p.name as string,
        description: (p.description as string) ?? "",
        is_public: true,
        kind: p.kind as "collection" | "watched",
        follower_count: p.follower_count as number | null,
        user_id: uid,
      },
      movies,
      prof
        ? {
            display_name: prof.display_name as string | null,
            handle: prof.handle as string | null,
          }
        : null,
      Number(p.follower_count ?? 0),
      Number((p as { like_count?: number | null }).like_count ?? 0),
    );
  });
}

export async function createPlaylist(
  client: SupabaseClient,
  userId: string,
  input: {
    name: string;
    description: string;
    kind: "collection" | "watched";
  },
): Promise<Playlist | null> {
  const { data, error } = await client
    .from("playlists")
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description,
      kind: input.kind,
      is_public: false,
    })
    .select("id, name, description, is_public, kind")
    .single();

  if (error || !data) return null;
  return toPlaylist(
    {
      id: data.id as string,
      name: data.name as string,
      description: (data.description as string) ?? "",
      is_public: data.is_public as boolean,
      kind: data.kind as "collection" | "watched",
    },
    [],
  );
}

export async function updatePlaylistMeta(
  client: SupabaseClient,
  playlistId: string,
  patch: Partial<{
    name: string;
    description: string;
    is_public: boolean;
  }>,
) {
  const { error } = await client
    .from("playlists")
    .update(patch)
    .eq("id", playlistId);
  return !error;
}

/** Deletes all items then the playlist row (cascades follows/likes). Owner-only via RLS. */
export async function deletePlaylistDb(
  client: SupabaseClient,
  userId: string,
  playlistId: string,
): Promise<boolean> {
  const { data: row, error: selErr } = await client
    .from("playlists")
    .select("id")
    .eq("id", playlistId)
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr || !row) return false;

  await client.from("playlist_items").delete().eq("playlist_id", playlistId);
  const { error } = await client
    .from("playlists")
    .delete()
    .eq("id", playlistId)
    .eq("user_id", userId);
  return !error;
}

export async function addMovieToPlaylistDb(
  client: SupabaseClient,
  playlistId: string,
  movie: Movie,
): Promise<boolean> {
  const movieId = await ensureMovieRow(client, movie);
  if (!movieId) return false;

  const { count } = await client
    .from("playlist_items")
    .select("*", { count: "exact", head: true })
    .eq("playlist_id", playlistId);

  const sort_order = count ?? 0;

  const { error } = await client.from("playlist_items").insert({
    playlist_id: playlistId,
    movie_id: movieId,
    sort_order,
  });

  return !error;
}

/** Same title in a playlist row vs detail `Movie` (TMDB / id variants). */
export function movieMatchesInPlaylistRow(row: Movie, movie: Movie): boolean {
  if ((row.mediaType ?? "movie") !== (movie.mediaType ?? "movie")) return false;
  if (row.id === movie.id) return true;
  const a = row.tmdbId ?? (row.id.startsWith("tmdb-") ? Number(row.id.slice(5)) : NaN);
  const b = movie.tmdbId ?? (movie.id.startsWith("tmdb-") ? Number(movie.id.slice(5)) : NaN);
  if (Number.isFinite(a) && Number.isFinite(b) && a === b) return true;
  return false;
}

export async function removeMovieFromPlaylistDb(
  client: SupabaseClient,
  playlistId: string,
  movie: Movie,
): Promise<boolean> {
  const movieId = await ensureMovieRow(client, movie);
  if (!movieId) return false;
  const { error } = await client
    .from("playlist_items")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("movie_id", movieId);
  return !error;
}

/** First watched-log list, or a new private “Watched” playlist. */
export async function getOrCreatePrimaryWatchedPlaylist(
  client: SupabaseClient,
  userId: string,
): Promise<Playlist | null> {
  const all = await fetchUserPlaylists(client, userId);
  const watched = all.find((p) => p.kind === "watched");
  if (watched) return watched;
  return createPlaylist(client, userId, {
    name: "Watched",
    description: "Films you've marked as seen.",
    kind: "watched",
  });
}

export async function reorderPlaylistMoviesDb(
  client: SupabaseClient,
  playlistId: string,
  orderedMovieIds: string[],
) {
  await Promise.all(
    orderedMovieIds.map((movieId, i) =>
      client
        .from("playlist_items")
        .update({ sort_order: i })
        .eq("playlist_id", playlistId)
        .eq("movie_id", movieId),
    ),
  );
}

export async function duplicatePlaylistDb(
  client: SupabaseClient,
  userId: string,
  source: Playlist,
): Promise<Playlist | null> {
  const { data: row, error } = await client
    .from("playlists")
    .insert({
      user_id: userId,
      name: `${source.name} (copy)`,
      description: source.description,
      kind: source.kind,
      is_public: false,
    })
    .select("id, name, description, is_public, kind")
    .single();

  if (error || !row) return null;

  const newId = row.id as string;
  const items = source.movies.map((m, i) => ({
    playlist_id: newId,
    movie_id: m.id,
    sort_order: i,
  }));

  if (items.length) {
    await client.from("playlist_items").insert(items);
  }

  return toPlaylist(
    {
      id: newId,
      name: row.name as string,
      description: (row.description as string) ?? "",
      is_public: false,
      kind: row.kind as "collection" | "watched",
    },
    source.movies.map((m, i) => ({ ...m, rank: i + 1 })),
  );
}

export async function clonePublicPlaylistForUser(
  client: SupabaseClient,
  userId: string,
  sourcePlaylistId: string,
): Promise<Playlist | null> {
  const { data: src, error: e1 } = await client
    .from("playlists")
    .select("name, description, kind")
    .eq("id", sourcePlaylistId)
    .eq("is_public", true)
    .maybeSingle();

  if (e1 || !src) return null;

  const { data: itemRows, error: e2 } = await client
    .from("playlist_items")
    .select("movie_id, sort_order")
    .eq("playlist_id", sourcePlaylistId)
    .order("sort_order", { ascending: true });

  if (e2) return null;

  const { data: newPl, error: e3 } = await client
    .from("playlists")
    .insert({
      user_id: userId,
      name: `${src.name as string} (from Explore)`,
      description: (src.description as string) ?? "",
      kind: src.kind as "collection" | "watched",
      is_public: false,
    })
    .select("id, name, description, is_public, kind")
    .single();

  if (e3 || !newPl) return null;

  const newId = newPl.id as string;
  if (itemRows?.length) {
    await client.from("playlist_items").insert(
      itemRows.map((r, i) => ({
        playlist_id: newId,
        movie_id: r.movie_id as string,
        sort_order: i,
      })),
    );
  }

  const byId = await itemsForPlaylists(client, [newId]);
  return toPlaylist(
    {
      id: newId,
      name: newPl.name as string,
      description: (newPl.description as string) ?? "",
      is_public: false,
      kind: newPl.kind as "collection" | "watched",
    },
    byId.get(newId) ?? [],
  );
}

/** UUIDs plus `tmdb-{id}` aliases so TMDB discover picks match saved rows. */
/** Saved films for the library “Saved” view (newest first). */
export async function fetchSavedMoviesForUser(
  client: SupabaseClient,
  userId: string,
): Promise<Movie[]> {
  const { data: links, error } = await client
    .from("saved_movies")
    .select("movie_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !links?.length) return [];

  const ids = links.map((r) => r.movie_id as string);
  const { data: rows } = await client
    .from("movies")
    .select("*")
    .in("id", ids);

  const byId = new Map(
    (rows ?? []).map((r) => [
      r.id as string,
      movieRowToMovie(r as unknown as MovieRow),
    ]),
  );
  return ids
    .map((id) => byId.get(id))
    .filter((m): m is Movie => m != null);
}

export async function fetchSavedMovieKeys(
  client: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await client
    .from("saved_movies")
    .select("movie_id, movies(tmdb_id, media_type)")
    .eq("user_id", userId);

  const s = new Set<string>();
  for (const r of data ?? []) {
    s.add(r.movie_id as string);
    const m = r.movies as unknown as {
      tmdb_id: number | null;
      media_type: "movie" | "tv" | null;
    } | null;
    const tid = m?.tmdb_id;
    if (tid != null) {
      s.add(`tmdb-${m?.media_type === "tv" ? "tv" : "movie"}-${tid}`);
    }
  }
  return s;
}

export async function setMovieSavedDb(
  client: SupabaseClient,
  userId: string,
  movie: Movie,
  saved: boolean,
): Promise<boolean> {
  const movieId = await ensureMovieRow(client, movie);
  if (!movieId) return false;

  if (saved) {
    const { error } = await client.from("saved_movies").upsert(
      { user_id: userId, movie_id: movieId },
      { onConflict: "user_id,movie_id" },
    );
    return !error;
  }
  const { error } = await client
    .from("saved_movies")
    .delete()
    .eq("user_id", userId)
    .eq("movie_id", movieId);
  return !error;
}

export async function fetchFollowedPlaylistIds(
  client: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await client
    .from("playlist_follows")
    .select("playlist_id")
    .eq("user_id", userId);

  return new Set((data ?? []).map((r) => r.playlist_id as string));
}

export async function setPlaylistFollowedDb(
  client: SupabaseClient,
  userId: string,
  playlistId: string,
  follow: boolean,
): Promise<boolean> {
  if (follow) {
    const { error } = await client.from("playlist_follows").upsert(
      { user_id: userId, playlist_id: playlistId },
      { onConflict: "user_id,playlist_id" },
    );
    return !error;
  }
  const { error } = await client
    .from("playlist_follows")
    .delete()
    .eq("user_id", userId)
    .eq("playlist_id", playlistId);
  return !error;
}

export async function fetchLikedPlaylistIds(
  client: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await client
    .from("playlist_likes")
    .select("playlist_id")
    .eq("user_id", userId);

  return new Set((data ?? []).map((r) => r.playlist_id as string));
}

export async function setPlaylistLikedDb(
  client: SupabaseClient,
  userId: string,
  playlistId: string,
  liked: boolean,
): Promise<boolean> {
  if (liked) {
    const { error } = await client.from("playlist_likes").upsert(
      { user_id: userId, playlist_id: playlistId },
      { onConflict: "user_id,playlist_id" },
    );
    return !error;
  }
  const { error } = await client
    .from("playlist_likes")
    .delete()
    .eq("user_id", userId)
    .eq("playlist_id", playlistId);
  return !error;
}

export async function fetchProfileDisplayName(
  client: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const n = data?.display_name;
  return typeof n === "string" && n.trim() ? n.trim() : null;
}
