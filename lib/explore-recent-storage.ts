import type { Genre, Movie } from "@/lib/types";

const STORAGE_KEY = "moviefy_explore_recent_v1";
const STORAGE_EVENT = "moviefy:explore-recent-storage-change";
const MAX = 24;

type Stored = Pick<
  Movie,
  "id" | "title" | "year" | "genre" | "posterClass" | "posterImage"
> & {
  tmdbId?: number;
  openedAt: number;
};

function parseStored(raw: unknown): Stored[] {
  if (!Array.isArray(raw)) return [];
  const out: Stored[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.title !== "string") continue;
    out.push({
      id: o.id,
      title: o.title,
      year: typeof o.year === "number" ? o.year : 0,
      genre: (typeof o.genre === "string" ? o.genre : "Drama") as Genre,
      posterClass:
        typeof o.posterClass === "string" ? o.posterClass : "from-zinc-700 to-zinc-900",
      posterImage: typeof o.posterImage === "string" ? o.posterImage : "",
      tmdbId: typeof o.tmdbId === "number" ? o.tmdbId : undefined,
      openedAt: typeof o.openedAt === "number" ? o.openedAt : 0,
    });
  }
  return out;
}

function toMovie(s: Stored): Movie {
  return {
    id: s.id,
    title: s.title,
    year: s.year,
    genre: s.genre,
    posterClass: s.posterClass,
    posterImage: s.posterImage,
    director: "—",
    tmdbId: s.tmdbId,
  };
}

export type ExploreRecentOpen = {
  movie: Movie;
  openedAtMs: number;
};

export function subscribeToExploreRecentStorage(
  onStoreChange: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
}

export function getExploreRecentStorageSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getServerExploreRecentStorageSnapshot(): null {
  return null;
}

export function parseExploreRecentStorageSnapshot(
  snapshot: string | null,
): ExploreRecentOpen[] {
  try {
    const prev = parseStored(JSON.parse(snapshot ?? "null"));
    return prev
      .map((s) => ({ movie: toMovie(s), openedAtMs: s.openedAt }))
      .sort((a, b) => b.openedAtMs - a.openedAtMs);
  } catch {
    return [];
  }
}

function notifyExploreRecentStorageChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }
}

export function pushExploreRecent(movie: Movie): void {
  if (typeof window === "undefined") return;
  try {
    const prev = parseStored(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
    const tid =
      movie.tmdbId ??
      (movie.id.startsWith("tmdb-") ? Number(movie.id.slice(5)) : NaN);
    const entry: Stored = {
      id: movie.id,
      title: movie.title,
      year: movie.year,
      genre: movie.genre,
      posterClass: movie.posterClass,
      posterImage: movie.posterImage,
      tmdbId: Number.isFinite(tid) ? tid : undefined,
      openedAt: Date.now(),
    };
    const next = [
      entry,
      ...prev.filter((p) => p.id !== entry.id && p.tmdbId !== entry.tmdbId),
    ].slice(0, MAX);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notifyExploreRecentStorageChange();
  } catch {
    /* ignore */
  }
}

export function readExploreRecentMovies(): Movie[] {
  return readExploreRecentOpens().map((r) => r.movie);
}

export function readExploreRecentOpens(): ExploreRecentOpen[] {
  return parseExploreRecentStorageSnapshot(getExploreRecentStorageSnapshot());
}

export function clearExploreRecentLocal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    notifyExploreRecentStorageChange();
  } catch {
    /* ignore */
  }
}

/** Dedupe by TMDB id (or movie id), keep the latest `openedAtMs`, cap at `max`. */
export function mergeExploreRecentMovies(
  server: ExploreRecentOpen[],
  local: ExploreRecentOpen[],
  max = MAX,
): Movie[] {
  const best = new Map<string, ExploreRecentOpen>();

  const keyOf = (m: Movie): string => {
    const tid =
      m.tmdbId ??
      (m.id.startsWith("tmdb-") ? Number(m.id.slice(5)) : NaN);
    if (Number.isFinite(tid)) return `tmdb:${tid}`;
    return `id:${m.id}`;
  };

  const put = (r: ExploreRecentOpen) => {
    const k = keyOf(r.movie);
    const prev = best.get(k);
    if (!prev || r.openedAtMs >= prev.openedAtMs) best.set(k, r);
  };

  for (const r of server) put(r);
  for (const r of local) put(r);

  return [...best.values()]
    .sort((a, b) => b.openedAtMs - a.openedAtMs)
    .slice(0, max)
    .map((r) => r.movie);
}
