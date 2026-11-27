"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PosterImage } from "@/components/poster-image";
import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Compass,
  Film,
  Globe,
  Heart,
  Home,
  Link2,
  ListOrdered,
  SquareStack,
  Lock,
  Plus,
  Search,
  Trash2,
  MoreVertical,
  X,
} from "lucide-react";
import { MoviefyBrandLoader } from "@/components/moviefy-brand-loader";
import { useSupabaseApp } from "@/components/supabase-app-provider";
import { movieFromTmdbDiscoverItem } from "@/lib/tmdb-genre-map";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  addMovieToPlaylistDb,
  createPlaylist as createPlaylistDb,
  deletePlaylistDb,
  duplicatePlaylistDb,
  fetchProfileDisplayName,
  fetchSavedMovieKeys,
  fetchSavedMoviesForUser,
  fetchUserPlaylists,
  getOrCreatePrimaryWatchedPlaylist,
  movieTmdbKey,
  movieMatchesInPlaylistRow,
  removeMovieFromPlaylistDb,
  reorderPlaylistMoviesDb,
  setMovieSavedDb,
  updatePlaylistMeta,
} from "@/lib/supabase/playlist-service";
import { greetingFirstName } from "@/lib/display-name";
import type { TmdbDiscoverResponse } from "@/lib/movie-enrich-types";
import type { Genre, Movie, Playlist, PlaylistMovie } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { prefetchMovieEnrich } from "@/lib/movie-enrich-prefetch";
import { movieToDetailPageHref } from "@/lib/movie-detail-nav";
import { AddToPlaylistDialog } from "@/components/add-to-playlist-dialog";
import { AppUserButton } from "@/components/app-user-button";
import { MobileAppNavSheet } from "@/components/mobile-app-nav-sheet";
import { MovieDetailDialog } from "@/components/movie-detail-dialog";
import {
  fetchUserReleaseWatchlist,
  RELEASE_WATCHLIST_CHANGED_EVENT,
  removeUserReleaseWatchlist,
  type ReleaseWatchlistRow,
} from "@/lib/supabase/release-watchlist-service";
import {
  releaseWatchlistRowToScheduleItem,
  scheduleItemToMovie,
} from "@/lib/releases-schedule-mappers";
import { tmdbPosterUrl } from "@/lib/tmdb-image";

type ListSort = "rank" | "year" | "title" | "genre";
type LibraryNav = "playlists" | "saved" | "coming";

type LibraryKindFilter = "all" | "collection" | "watched";

function renumber(movies: PlaylistMovie[]): PlaylistMovie[] {
  return movies.map((m, i) => ({ ...m, rank: i + 1 }));
}

function GenrePill({
  genre,
  active,
  onClick,
}: {
  genre: Genre | "all";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
      className={cn(
        "rounded-full border border-border/70",
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
      )}
    >
      {genre === "all" ? "All" : genre}
    </Button>
  );
}

export function MoviefyApp() {
  const pathname = usePathname();
  const router = useRouter();
  const { client, appUser, dbUserId, ready, authError } = useSupabaseApp();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeId, setActiveId] = useState("");
  const [genreFilter, setGenreFilter] = useState<Genre | "all">("all");
  const [listSort, setListSort] = useState<ListSort>("rank");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newKind, setNewKind] = useState<Playlist["kind"]>("collection");
  const [addMovieOpen, setAddMovieOpen] = useState(false);
  const [movieToAdd, setMovieToAdd] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [savedMovies, setSavedMovies] = useState<Movie[]>([]);
  const [libraryNav, setLibraryNav] = useState<LibraryNav>("playlists");
  const [releaseWatchlist, setReleaseWatchlist] = useState<
    ReleaseWatchlistRow[]
  >([]);
  const [pickListOpen, setPickListOpen] = useState(false);
  const [pickListMovie, setPickListMovie] = useState<Movie | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [libraryKindFilter, setLibraryKindFilter] =
    useState<LibraryKindFilter>("all");
  const [recentMovieIds, setRecentMovieIds] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [pickPool, setPickPool] = useState<Movie[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [watchedDialogBusy, setWatchedDialogBusy] = useState(false);
  const [deletePlaylistOpen, setDeletePlaylistOpen] = useState(false);

  const loadLibrary = useCallback(async () => {
    if (!client || !dbUserId) return;
    setLibraryLoading(true);
    try {
      const uid = dbUserId;
      const [pl, saved, name, savedList, coming] = await Promise.all([
        fetchUserPlaylists(client, uid),
        fetchSavedMovieKeys(client, uid),
        fetchProfileDisplayName(client, uid),
        fetchSavedMoviesForUser(client, uid),
        fetchUserReleaseWatchlist(client, uid),
      ]);
      setPlaylists(pl);
      setSavedIds(saved);
      setDisplayName(name);
      setSavedMovies(savedList);
      setReleaseWatchlist(coming);
      setActiveId((prev) => {
        if (typeof window !== "undefined") {
          const fromUrl = new URLSearchParams(window.location.search).get(
            "list",
          );
          if (fromUrl && pl.some((p) => p.id === fromUrl)) return fromUrl;
        }
        if (prev && pl.some((p) => p.id === prev)) return prev;
        return pl[0]?.id ?? "";
      });
    } finally {
      setLibraryLoading(false);
    }
  }, [client, dbUserId]);

  useEffect(() => {
    if (!ready || !client || !dbUserId) return;
    void loadLibrary();
  }, [ready, client, dbUserId, loadLibrary]);

  useEffect(() => {
    const on = () => {
      void loadLibrary();
    };
    window.addEventListener(RELEASE_WATCHLIST_CHANGED_EVENT, on);
    return () =>
      window.removeEventListener(RELEASE_WATCHLIST_CHANGED_EVENT, on);
  }, [loadLibrary]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/discover/top?sort=popularity.desc", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: TmdbDiscoverResponse) => {
        const rows = d.results ?? [];
        setPickPool(rows.slice(0, 40).map((row) => movieFromTmdbDiscoverItem(row)));
      })
      .catch(() => setPickPool([]));
    return () => ctrl.abort();
  }, []);

  const active = useMemo(
    () => playlists.find((p) => p.id === activeId) ?? null,
    [playlists, activeId],
  );

  const primaryWatchedPlaylist = useMemo(
    () => playlists.find((p) => p.kind === "watched"),
    [playlists],
  );

  const selectedInWatched = useMemo(() => {
    if (!selectedMovie || !primaryWatchedPlaylist) return false;
    return primaryWatchedPlaylist.movies.some((m) =>
      movieMatchesInPlaylistRow(m, selectedMovie),
    );
  }, [selectedMovie, primaryWatchedPlaylist]);

  const signInNextPath = pathname || "/app";

  const toggleDetailWatched = useCallback(async () => {
    if (!client || !dbUserId || !selectedMovie) return;
    setWatchedDialogBusy(true);
    try {
      const pl = await getOrCreatePrimaryWatchedPlaylist(client, dbUserId);
      if (!pl) {
        pushToast("Could not open Watched list");
        return;
      }
      if (selectedInWatched) {
        const ok = await removeMovieFromPlaylistDb(client, pl.id, selectedMovie);
        if (!ok) pushToast("Could not remove from Watched");
        else pushToast("Removed from Watched");
      } else {
        const ok = await addMovieToPlaylistDb(client, pl.id, selectedMovie);
        if (!ok) pushToast("Could not add to Watched");
        else pushToast("Added to Watched");
      }
      await loadLibrary();
    } finally {
      setWatchedDialogBusy(false);
    }
  }, [client, dbUserId, selectedMovie, selectedInWatched, loadLibrary]);

  async function openComingRow(row: ReleaseWatchlistRow) {
    const item = releaseWatchlistRowToScheduleItem(row);
    const movie = scheduleItemToMovie(item);
    const media = row.mediaType === "tv" ? "tv" : "movie";
    const href = movieToDetailPageHref(movie, "releases", media);
    if (!href) {
      pushToast("Could not open this title.");
      return;
    }
    await prefetchMovieEnrich(movie, media);
    router.push(href);
  }

  async function removeComingRow(row: ReleaseWatchlistRow) {
    if (!client || !dbUserId) return;
    const ok = await removeUserReleaseWatchlist(
      client,
      dbUserId,
      row.tmdbId,
      row.mediaType,
    );
    if (!ok) {
      pushToast("Could not remove from Coming up");
      return;
    }
    setReleaseWatchlist((prev) =>
      prev.filter(
        (r) =>
          !(r.tmdbId === row.tmdbId && r.mediaType === row.mediaType),
      ),
    );
    pushToast("Removed from Coming up");
  }

  function selectMovie(movie: Movie) {
    setSelectedMovie(movie);
    const href = movieToDetailPageHref(movie);
    if (href) {
      setDetailOpen(false);
      void (async () => {
        await prefetchMovieEnrich(movie);
        router.push(href);
      })();
    } else {
      setDetailOpen(true);
    }
    setRecentMovieIds((prev) => {
      const next = [movie.id, ...prev.filter((id) => id !== movie.id)];
      return next.slice(0, 10);
    });
  }

  useEffect(() => {
    if (typeof window === "undefined" || !activeId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("list") === activeId) return;
    url.searchParams.set("list", activeId);
    window.history.replaceState({}, "", url.toString());
  }, [activeId]);

  const filteredMovies = useMemo(() => {
    if (!active) return [];
    const base =
      genreFilter === "all"
        ? [...active.movies]
        : active.movies.filter((m) => m.genre === genreFilter);
    const list = [...base];
    switch (listSort) {
      case "rank":
        list.sort((a, b) => a.rank - b.rank);
        break;
      case "year":
        list.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
        break;
      case "title":
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "genre":
        list.sort(
          (a, b) =>
            a.genre.localeCompare(b.genre) || a.title.localeCompare(b.title),
        );
        break;
      default:
        break;
    }
    return list;
  }, [active, genreFilter, listSort]);

  const sidebarPlaylists = useMemo(() => {
    let list = playlists;
    if (libraryKindFilter === "collection") {
      list = list.filter((p) => p.kind === "collection");
    } else if (libraryKindFilter === "watched") {
      list = list.filter((p) => p.kind === "watched");
    }
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [playlists, libraryQuery, libraryKindFilter]);

  /** Titles in your lists + saved (e.g. recents / local hints). */
  const allKnownMovies = useMemo(() => {
    const m = new Map<string, Movie>();
    for (const p of playlists) {
      for (const mv of p.movies) m.set(mv.id, mv);
    }
    for (const mv of savedMovies) m.set(mv.id, mv);
    return m;
  }, [playlists, savedMovies]);

  const recentMovies = useMemo(() => {
    return recentMovieIds
      .map((id) => allKnownMovies.get(id))
      .filter((m): m is Movie => m != null);
  }, [recentMovieIds, allKnownMovies]);

  const activeGenreCount = useMemo(() => {
    if (!active) return 0;
    return new Set(active.movies.map((m) => m.genre)).size;
  }, [active]);

  const playlistGenres = useMemo(() => {
    if (!active) return [];
    return Array.from(new Set(active.movies.map((m) => m.genre))).sort();
  }, [active]);

  const catalogForAdd = useMemo(() => {
    if (!active) return pickPool;
    const inList = new Set(active.movies.map((m) => m.id));
    return pickPool.filter((m) => !inList.has(m.id));
  }, [active, pickPool]);

  const inActiveList = useMemo(() => {
    if (!selectedMovie) return false;
    return playlists.some((p) =>
      p.movies.some((m) => movieMatchesInPlaylistRow(m, selectedMovie)),
    );
  }, [playlists, selectedMovie]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  function pushToast(message: string) {
    setToast(message);
  }

  async function createPlaylist() {
    if (!client || !dbUserId) return;
    const pl = await createPlaylistDb(client, dbUserId, {
      name: newName.trim() || "Untitled playlist",
      description: newDesc.trim() || "No description yet.",
      kind: newKind,
    });
    if (!pl) {
      pushToast("Could not create playlist");
      return;
    }
    pushToast("Playlist created");
    setNewName("");
    setNewDesc("");
    setNewPlaylistOpen(false);
    await loadLibrary();
    setActiveId(pl.id);
    setLibraryNav("playlists");
  }

  async function addMovieFromCatalog() {
    if (!client || !active || !movieToAdd) return;
    const movie = pickPool.find((m) => m.id === movieToAdd);
    if (!movie) return;
    const ok = await addMovieToPlaylistDb(client, active.id, movie);
    if (!ok) {
      pushToast("Could not add movie");
      return;
    }
    setMovieToAdd("");
    setAddMovieOpen(false);
    await loadLibrary();
    pushToast(`Added “${movie.title}” to ${active.name}`);
  }

  async function addMovieToActive(movie: Movie) {
    if (!client || !active) return;
    if (
      active.movies.some(
        (m) =>
          m.id === movie.id ||
          (m.tmdbId != null &&
            m.tmdbId === movie.tmdbId &&
            movie.tmdbId != null &&
            (m.mediaType ?? "movie") === (movie.mediaType ?? "movie")),
      )
    ) {
      pushToast("Already in this list");
      return;
    }
    const ok = await addMovieToPlaylistDb(client, active.id, movie);
    if (!ok) {
      pushToast("Could not add movie");
      return;
    }
    await loadLibrary();
    pushToast(`Added “${movie.title}” to ${active.name}`);
  }

  async function moveMovie(index: number, direction: -1 | 1) {
    if (!client || !active) return;
    const next = [...active.movies];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const orderedIds = renumber(next).map((m) => m.id);
    await reorderPlaylistMoviesDb(client, active.id, orderedIds);
    await loadLibrary();
  }

  function copyShareLink() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("list", activeId);
    void navigator.clipboard.writeText(url.toString());
    pushToast("Share link copied");
  }

  async function duplicateActivePlaylist() {
    if (!client || !dbUserId || !active) return;
    const copy = await duplicatePlaylistDb(client, dbUserId, active);
    if (!copy) {
      pushToast("Could not duplicate list");
      return;
    }
    await loadLibrary();
    setActiveId(copy.id);
    pushToast("Duplicated list");
  }

  async function deleteActivePlaylist() {
    if (!client || !dbUserId || !active) return;
    const ok = await deletePlaylistDb(client, dbUserId, active.id);
    if (!ok) {
      pushToast("Could not delete playlist");
      return;
    }
    setDeletePlaylistOpen(false);
    await loadLibrary();
    pushToast("Playlist deleted");
  }

  async function removeMovieFromActiveList(movie: Movie) {
    if (!client || !active) return;
    const ok = await removeMovieFromPlaylistDb(client, active.id, movie);
    if (!ok) {
      pushToast("Could not remove from list");
      return;
    }
    await loadLibrary();
    pushToast(`Removed “${movie.title}”`);
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-black/35 px-6 text-center text-white backdrop-blur-md">
        <p className="max-w-md text-sm text-white/80">
          Add{" "}
          <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and{" "}
          <code className="rounded bg-white/10 px-1">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          or{" "}
          <code className="rounded bg-white/10 px-1">
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          </code>{" "}
          to <code className="rounded bg-white/10 px-1">.env.local</code>, then
          restart the dev server.
        </p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-black/35 px-6 text-center text-white backdrop-blur-md">
        <p className="max-w-md text-sm text-amber-200/90">{authError}</p>
        <p className="max-w-md text-xs text-white/50">
          Check your Supabase URL and anon key, then refresh.
        </p>
      </div>
    );
  }

  if (!ready || !appUser || !dbUserId || libraryLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black/35 px-6 text-white backdrop-blur-md">
        <MoviefyBrandLoader
          size="lg"
          label="Opening your theatre — playlists and saved films are almost ready."
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground">
      <div className="mx-auto flex max-w-[1600px] gap-2 p-2 pt-[max(0.25rem,env(safe-area-inset-top,0px))]">
        <aside className="hidden w-[300px] shrink-0 rounded-xl bg-card p-3 lg:block">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Clapperboard className="size-4" />
              </div>
              <div>
                <p className="font-heading text-base font-semibold">Moviefy</p>
                <p className="text-xs text-muted-foreground">Home &amp; lists</p>
              </div>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={() => setNewPlaylistOpen(true)}>
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="mt-3 grid gap-1 px-2">
            <Link
              href="/app"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "justify-start gap-2 text-sm",
                pathname === "/app" &&
                  libraryNav === "playlists" &&
                  "bg-muted/70 text-foreground",
              )}
              onClick={() => setLibraryNav("playlists")}
            >
              <Home className="size-4" />
              Your theatre
            </Link>
            <Link
              href="/app/explore"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "justify-start gap-2 text-sm",
                pathname?.startsWith("/app/explore") && "bg-muted/70 text-foreground",
              )}
            >
              <Compass className="size-4" />
              Explore
            </Link>
            <Link
              href="/app/releases"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "justify-start gap-2 text-sm",
                pathname?.startsWith("/app/releases") && "bg-muted/70 text-foreground",
              )}
            >
              <CalendarDays className="size-4" />
              Release radar
            </Link>
            <Link
              href="/app/reels"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "justify-start gap-2 text-sm",
                pathname?.startsWith("/app/reels") && "bg-muted/70 text-foreground",
              )}
            >
              <Film className="size-4" />
              Meme reels
            </Link>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-start gap-2 text-sm",
                libraryNav === "saved" && "bg-muted/70 text-foreground",
              )}
              onClick={() => {
                setLibraryNav("saved");
                void loadLibrary();
              }}
            >
              <Heart className="size-4" />
              Saved
            </button>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-start gap-2 text-sm",
                libraryNav === "coming" && "bg-muted/70 text-foreground",
              )}
              onClick={() => {
                setLibraryNav("coming");
                if (pathname !== "/app") router.push("/app");
                void loadLibrary();
              }}
            >
              <Bookmark className="size-4" />
              Coming up
            </button>
          </div>

          {libraryNav === "playlists" ? (
          <div className="mt-3 flex flex-wrap gap-1 px-2">
            {(
              [
                { id: "all" as const, label: "All" },
                { id: "collection" as const, label: "Lists" },
                { id: "watched" as const, label: "Watched" },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="xs"
                variant={libraryKindFilter === tab.id ? "secondary" : "ghost"}
                className="h-7 rounded-full px-2.5 text-xs"
                onClick={() => setLibraryKindFilter(tab.id)}
              >
                {tab.id === "watched" ? (
                  <ListOrdered className="mr-1 size-3" />
                ) : null}
                {tab.label}
              </Button>
            ))}
          </div>
          ) : null}

          {libraryNav === "playlists" ? (
          <div className="mt-4 px-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                placeholder="Filter playlists in the sidebar…"
                className="border-0 bg-[#212121] pl-8"
              />
            </div>
          </div>
          ) : null}

          <ScrollArea className="mt-3 h-[calc(100dvh_-_240px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] min-h-[12rem] px-1">
            <div className="space-y-1">
              {sidebarPlaylists.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setLibraryNav("playlists");
                    setActiveId(p.id);
                    setGenreFilter("all");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                    p.id === activeId ? "bg-[#2a2a2a]" : "hover:bg-[#212121]",
                  )}
                >
                  <div className="relative h-11 w-11 overflow-hidden rounded-md bg-zinc-800">
                    <PosterImage
                      src={p.movies[0]?.posterImage ?? ""}
                      alt={p.movies[0]?.title ?? "Playlist"}
                      fill
                      placeholderGradient={
                        p.movies[0]?.posterClass ?? "from-zinc-700 to-zinc-900"
                      }
                      className="object-cover"
                      sizes="44px"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.isPublic ? "Public" : "Private"} · {p.movies.length} movies
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <main className="min-w-0 flex-1 rounded-xl bg-card">
          <header className="sticky top-0 z-10 flex w-full min-w-0 items-center gap-2 rounded-t-xl border-b border-border/50 bg-card/95 px-2 py-2.5 backdrop-blur sm:gap-3 sm:px-4 sm:py-3">
            <div className="flex shrink-0 items-center lg:hidden">
              <MobileAppNavSheet
                theatreLibrary={{
                  active: libraryNav,
                  onSelect: (nav) => {
                    setLibraryNav(nav);
                    if (nav === "saved" || nav === "coming") void loadLibrary();
                  },
                }}
              />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-1.5 lg:hidden">
              <Link
                href="/app/explore"
                aria-label="Explore"
                title="Explore"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "icon" }),
                  "size-10 shrink-0 border-0 bg-muted/50 text-foreground hover:bg-muted/70",
                )}
              >
                <Compass className="size-4" aria-hidden />
              </Link>
              <Link
                href="/app/releases"
                aria-label="Release radar"
                title="Release radar"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "icon" }),
                  "size-10 shrink-0 border-0 bg-muted/50 text-foreground hover:bg-muted/70",
                )}
              >
                <CalendarDays className="size-4" aria-hidden />
              </Link>
              <Link
                href="/app/reels"
                aria-label="Meme reels"
                title="Meme reels"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "icon" }),
                  "size-10 shrink-0 border-0 bg-muted/50 text-foreground hover:bg-muted/70",
                )}
              >
                <Film className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 lg:flex">
              <Link
                href="/app/explore"
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
              >
                <Compass className="size-4 shrink-0" aria-hidden />
                Explore
              </Link>
              <Link
                href="/app/releases"
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
              >
                <CalendarDays className="size-4 shrink-0" aria-hidden />
                Release radar
              </Link>
              <Link
                href="/app/reels"
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
              >
                <Film className="size-4 shrink-0" aria-hidden />
                Meme reels
              </Link>
            </div>
            <div className="ml-auto flex shrink-0 items-center">
              <div className="shrink-0">
                <AppUserButton />
              </div>
            </div>
          </header>

          <ScrollArea
            key={libraryNav}
            className="h-[calc(100dvh_-_4.125rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] min-h-[50dvh]"
          >
            <div className="space-y-10 p-3 pb-[max(2.5rem,calc(1.5rem+env(safe-area-inset-bottom)))] sm:p-5 sm:pb-10">
              {libraryNav === "saved" ? (
                <section className="rounded-xl border border-border/60 bg-card/90 p-5 shadow-[var(--app-shadow-card)]">
                  <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="type-section-title">Saved for later</h2>
                      <p className="text-sm text-muted-foreground">
                        Titles you saved from movie details.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setLibraryNav("playlists")}
                    >
                      Playlists
                    </Button>
                  </div>
                  {savedMovies.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Nothing saved yet. Open a film and tap{" "}
                      <Heart className="mx-0.5 inline size-3.5 align-text-bottom text-primary" />{" "}
                      Save.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {savedMovies.map((movie) => (
                        <button
                          key={movie.id}
                          type="button"
                          onClick={() => selectMovie(movie)}
                          className={cn(
                            "rounded-lg border border-transparent bg-muted/35 p-2 text-left transition hover:border-border/50 hover:bg-muted/50",
                            selectedMovie?.id === movie.id && "ring-1 ring-primary/50",
                          )}
                        >
                          <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-zinc-800">
                            <PosterImage
                              src={movie.posterImage}
                              alt={movie.title}
                              fill
                              placeholderGradient={movie.posterClass}
                              className="object-cover"
                              sizes="160px"
                            />
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs font-medium">{movie.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {movie.year} · {movie.genre}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ) : libraryNav === "coming" ? (
                <section className="rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-950/20 via-card/95 to-card p-5 shadow-[var(--app-shadow-card)]">
                  <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="type-section-title">Coming up</h2>
                      <p className="text-sm text-muted-foreground">
                        Saved from Release radar — bookmark a title to remember its drop date.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/app/releases"
                        className={cn(
                          buttonVariants({ size: "sm", variant: "secondary" }),
                        )}
                      >
                        Release radar
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLibraryNav("playlists")}
                      >
                        Playlists
                      </Button>
                    </div>
                  </div>
                  {releaseWatchlist.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Nothing here yet. Open{" "}
                      <Link
                        href="/app/releases"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Release radar
                      </Link>{" "}
                      and tap the bookmark on a poster.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {releaseWatchlist.map((row) => (
                        <div
                          key={`${row.mediaType}-${row.tmdbId}`}
                          className="relative rounded-lg border border-border/40 bg-muted/35 p-2"
                        >
                          <button
                            type="button"
                            onClick={() => void openComingRow(row)}
                            className="w-full text-left"
                          >
                            <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-zinc-800">
                              <PosterImage
                                src={
                                  row.posterPath
                                    ? tmdbPosterUrl(row.posterPath, "w342")
                                    : ""
                                }
                                alt=""
                                fill
                                placeholderGradient="from-zinc-700 to-zinc-900"
                                className="object-cover"
                                sizes="160px"
                              />
                              <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium uppercase text-white/90">
                                {row.mediaType === "tv" ? "Show" : "Film"}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs font-medium">
                              {row.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Releases {row.releaseDate}
                            </p>
                          </button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="absolute right-1 top-1 text-muted-foreground hover:text-rose-300"
                            aria-label={`Remove ${row.title} from Coming up`}
                            onClick={() => void removeComingRow(row)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : (
              <>
              <section className="rounded-xl border border-border/60 bg-gradient-to-b from-card via-card/95 to-muted/25 p-5 shadow-[var(--app-shadow-card)] sm:p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Welcome back
                </p>
                <h1 className="type-hero mt-1">
                  {greetingFirstName(displayName, appUser)}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  This space is your playlists, saved films, and coming-up bookmarks. Trending,
                  genres, meme reels, and community lists live on{" "}
                  <Link
                    href="/app/explore"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Explore
                  </Link>
                  .
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="border-border/50 bg-muted/50 text-foreground">
                    {playlists.length} playlists
                  </Badge>
                  <Badge variant="secondary" className="border-border/50 bg-muted/50 text-foreground">
                    {savedIds.size} saved
                  </Badge>
                  <Badge variant="secondary" className="border-border/50 bg-muted/50 text-foreground">
                    {releaseWatchlist.length} coming up
                  </Badge>
                  <Badge variant="secondary" className="border-border/50 bg-muted/50 text-foreground">
                    {active
                      ? `${active.movies.length} in “${active.name}”`
                      : "No list open"}
                  </Badge>
                  <Badge variant="secondary" className="border-border/50 bg-muted/50 text-foreground">
                    {active ? `${activeGenreCount} genres this list` : "—"}
                  </Badge>
                </div>
              </section>

              {recentMovies.length > 0 ? (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="type-section-title">Recently viewed</h2>
                    <span className="text-xs text-muted-foreground">This session</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {recentMovies.map((movie) => (
                      <button
                        key={movie.id}
                        type="button"
                        onClick={() => selectMovie(movie)}
                        className={cn(
                          "w-[100px] shrink-0 text-left",
                          selectedMovie?.id === movie.id && "opacity-100",
                        )}
                      >
                        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-white/10">
                          <PosterImage
                            src={movie.posterImage}
                            alt={movie.title}
                            fill
                            placeholderGradient={movie.posterClass}
                            className="object-cover"
                            sizes="100px"
                          />
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight">
                          {movie.title}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="type-section-title">Your Playlists</h2>
                  <Button variant="ghost" size="sm" onClick={() => setNewPlaylistOpen(true)}>
                    <Plus className="size-4" />
                    Create
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setLibraryNav("playlists");
                        setActiveId(p.id);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-transparent bg-muted/35 p-2 text-left transition hover:border-border/50 hover:bg-muted/50 hover:shadow-[var(--app-shadow-card)]",
                        p.id === activeId && "ring-1 ring-primary/40",
                      )}
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                        <PosterImage
                          src={p.movies[0]?.posterImage ?? ""}
                          alt={p.movies[0]?.title ?? "Playlist"}
                          fill
                          placeholderGradient={
                            p.movies[0]?.posterClass ?? "from-zinc-700 to-zinc-900"
                          }
                          className="object-cover"
                          sizes="56px"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.kind === "watched" ? "Watched log" : "Playlist"} · {p.movies.length} titles
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-card/90 p-5 shadow-[var(--app-shadow-card)]">
                {!active ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Create a playlist to start ranking films. Everything syncs to Supabase.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => setNewPlaylistOpen(true)}
                    >
                      <Plus className="size-4" />
                      New playlist
                    </Button>
                  </div>
                ) : null}
                {active ? (
                <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="type-section-title">{active.name}</h2>
                      <Badge variant="secondary" className="border-border/50 bg-muted/50 text-foreground">
                        {active.kind === "watched" ? "Watched log" : "Playlist"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{active.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/40 px-2 py-1.5">
                      <Switch
                        id="public"
                        checked={active.isPublic}
                        onCheckedChange={async (checked) => {
                          if (!client) return;
                          await updatePlaylistMeta(client, active.id, {
                            is_public: checked,
                          });
                          await loadLibrary();
                        }}
                      />
                      <Label htmlFor="public" className="text-xs">
                        {active.isPublic ? (
                          <span className="flex items-center gap-1">
                            <Globe className="size-3.5" />
                            Public
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Lock className="size-3.5" />
                            Private
                          </span>
                        )}
                      </Label>
                    </div>
                    <Select
                      value={listSort}
                      onValueChange={(v) => setListSort((v ?? "rank") as ListSort)}
                    >
                      <SelectTrigger className="h-8 w-[140px] border-white/10 bg-[#252525] text-xs">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rank">Your order</SelectItem>
                        <SelectItem value="year">Year (newest)</SelectItem>
                        <SelectItem value="title">Title A–Z</SelectItem>
                        <SelectItem value="genre">Genre</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hidden gap-1 text-white/80 sm:inline-flex"
                      onClick={copyShareLink}
                    >
                      <Link2 className="size-4" />
                      Share
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hidden gap-1 text-white/80 sm:inline-flex"
                      onClick={duplicateActivePlaylist}
                    >
                      <SquareStack className="size-4" />
                      Duplicate
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(
                          buttonVariants({ size: "sm", variant: "ghost" }),
                          "gap-1 text-white/80",
                        )}
                        aria-label="Playlist menu"
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletePlaylistOpen(true)}
                        >
                          <Trash2 className="size-4" />
                          Delete playlist…
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" variant="secondary" onClick={() => setAddMovieOpen(true)}>
                      <Plus className="size-4" />
                      Add movie
                    </Button>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <GenrePill
                    genre="all"
                    active={genreFilter === "all"}
                    onClick={() => setGenreFilter("all")}
                  />
                  {playlistGenres.map((g) => (
                    <GenrePill
                      key={g}
                      genre={g}
                      active={genreFilter === g}
                      onClick={() => setGenreFilter(g)}
                    />
                  ))}
                </div>

                <div className="space-y-2">
                  {filteredMovies.map((movie) => {
                    const index = active.movies.findIndex((m) => m.id === movie.id);
                    return (
                      <div
                        key={movie.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectMovie(movie)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectMovie(movie);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md bg-[#242424] p-2.5 transition hover:bg-[#2c2c2c]",
                          selectedMovie?.id === movie.id && "ring-1 ring-primary/50",
                        )}
                      >
                        <div className="w-5 text-right text-sm tabular-nums text-muted-foreground">
                          {movie.rank}
                        </div>
                        <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-sm bg-zinc-800">
                          <PosterImage
                            src={movie.posterImage}
                            alt={movie.title}
                            fill
                            placeholderGradient={movie.posterClass}
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{movie.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {movie.year} · {movie.director}
                          </p>
                        </div>
                        <Badge variant="outline" className="hidden border-white/15 sm:inline-flex">
                          {movie.genre}
                        </Badge>
                        <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={index <= 0}
                            onClick={() => moveMovie(index, -1)}
                            aria-label="Move up"
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={index >= active.movies.length - 1}
                            onClick={() => moveMovie(index, 1)}
                            aria-label="Move down"
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-rose-300/90 hover:text-rose-200"
                            aria-label={`Remove ${movie.title} from list`}
                            onClick={() => void removeMovieFromActiveList(movie)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
                ) : null}
              </section>
              </>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>

      <Dialog open={deletePlaylistOpen} onOpenChange={setDeletePlaylistOpen}>
        <DialogContent className="border-border/80 bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this playlist?</DialogTitle>
            <DialogDescription>
              {active
                ? `“${active.name}” and its order will be removed. This cannot be undone.`
                : "This list will be removed. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletePlaylistOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void deleteActivePlaylist()}
            >
              Delete playlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MovieDetailDialog
        movie={selectedMovie}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        supabase={client}
        userId={dbUserId}
        viewerDisplayName={
          displayName?.trim() ||
          appUser?.email?.split("@")[0] ||
          null
        }
        inActiveList={inActiveList}
        saved={
          selectedMovie
            ? savedIds.has(selectedMovie.id) ||
              (movieTmdbKey(selectedMovie) != null &&
                savedIds.has(movieTmdbKey(selectedMovie)!))
            : false
        }
        onToggleSave={async () => {
          if (!client || !dbUserId || !selectedMovie) return;
          const was =
            savedIds.has(selectedMovie.id) ||
            (movieTmdbKey(selectedMovie) != null &&
              savedIds.has(movieTmdbKey(selectedMovie)!));
          const ok = await setMovieSavedDb(
            client,
            dbUserId,
            selectedMovie,
            !was,
          );
          if (!ok) {
            pushToast("Could not update saved");
            return;
          }
          const [keys, list] = await Promise.all([
            fetchSavedMovieKeys(client, dbUserId),
            fetchSavedMoviesForUser(client, dbUserId),
          ]);
          setSavedIds(keys);
          setSavedMovies(list);
          pushToast(was ? "Removed from saved" : "Saved for later");
        }}
        onAddToList={() => {
          if (!selectedMovie) return;
          setPickListMovie(selectedMovie);
          setPickListOpen(true);
        }}
        watched={selectedInWatched}
        onToggleWatched={dbUserId ? toggleDetailWatched : undefined}
        watchedBusy={watchedDialogBusy}
      />

      <AddToPlaylistDialog
        open={pickListOpen}
        onOpenChange={(o) => {
          setPickListOpen(o);
          if (!o) setPickListMovie(null);
        }}
        movie={pickListMovie}
        client={client}
        userId={dbUserId}
        onNotify={pushToast}
        onUpdated={async () => {
          await loadLibrary();
          setLibraryNav("playlists");
        }}
        onAddedToPlaylist={(id) => setActiveId(id)}
        signInNextPath={signInNextPath}
      />

      {toast && (
        <div
          className="fixed left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border border-white/10 bg-zinc-900 px-4 py-2.5 text-center text-sm text-white shadow-lg [bottom:max(1.25rem,calc(0.75rem+env(safe-area-inset-bottom)))]"
          role="status"
        >
          {toast}
        </div>
      )}

      <Dialog open={newPlaylistOpen} onOpenChange={setNewPlaylistOpen}>
        <DialogContent className="border-border/80 bg-[#1e1e1e] text-white">
          <DialogHeader>
            <DialogTitle>Create playlist</DialogTitle>
            <DialogDescription>Start a list for moods, genres, or yearly logs.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Weekend classics"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-desc">Description</Label>
              <Input
                id="new-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="A short line about this list"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={newKind}
                onValueChange={(v) => setNewKind((v ?? "collection") as Playlist["kind"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collection">Playlist</SelectItem>
                  <SelectItem value="watched">Watched log</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPlaylistOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createPlaylist}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMovieOpen} onOpenChange={setAddMovieOpen}>
        <DialogContent className="border-border/80 bg-[#1e1e1e] text-white">
          <DialogHeader>
            <DialogTitle>Add movie</DialogTitle>
            <DialogDescription>
              Quick picks from a TMDB pool (for adding to your list). Browse the full
              catalog on Explore.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Movie</Label>
            <Select value={movieToAdd} onValueChange={(v) => setMovieToAdd(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a movie..." />
              </SelectTrigger>
              <SelectContent>
                {catalogForAdd.map((movie) => (
                  <SelectItem key={movie.id} value={movie.id}>
                    {movie.title} ({movie.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={addMovieFromCatalog} disabled={!movieToAdd}>
              Add to list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
