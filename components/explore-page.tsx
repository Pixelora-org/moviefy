"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clapperboard,
  Compass,
  Film,
  Globe,
  Heart,
  Loader2,
  Megaphone,
  Plus,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { PosterImage } from "@/components/poster-image";
import { ExploreCuratedMoods } from "@/components/explore-curated-moods";
import {
  ExploreMovieRail,
  ExplorePosterSkeleton,
} from "@/components/explore-movie-rail";
import { ExplorePersonalRails } from "@/components/explore-personal-rails";
import { ExploreStreamingRails } from "@/components/explore-streaming-rails";
import { ExploreTop10Sidebar } from "@/components/explore-top-10-sidebar";
import { TmdbDiscoverSection } from "@/components/tmdb-discover-section";
import { prefetchMovieEnrich } from "@/lib/movie-enrich-prefetch";
import { movieToDetailPageHref } from "@/lib/movie-detail-nav";
import { discoverItemFromSuggestMovie } from "@/lib/search-suggest-mappers";
import type {
  SearchSuggestMovieRow,
  SearchSuggestResponse,
} from "@/lib/search-suggest-types";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSupabaseApp } from "@/components/supabase-app-provider";
import {
  mergeExploreRecentMovies,
  pushExploreRecent,
  getExploreRecentStorageSnapshot,
  getServerExploreRecentStorageSnapshot,
  parseExploreRecentStorageSnapshot,
  subscribeToExploreRecentStorage,
  type ExploreRecentOpen,
} from "@/lib/explore-recent-storage";
import {
  fetchExploreRecentOpens,
  upsertExploreRecentOpen,
} from "@/lib/supabase/explore-recent-service";
import {
  clonePublicPlaylistForUser,
  fetchFollowedPlaylistIds,
  fetchLikedPlaylistIds,
  fetchPublicCommunityPlaylists,
  fetchSavedMoviesForUser,
  setPlaylistFollowedDb,
  setPlaylistLikedDb,
} from "@/lib/supabase/playlist-service";
import {
  GENRES,
  type CommunityPlaylist,
  type Genre,
  type Movie,
} from "@/lib/types";

type BrowseGenre = "all" | Genre;
import type {
  TmdbDiscoverItem,
  TmdbDiscoverResponse,
} from "@/lib/movie-enrich-types";
import { movieFromTmdbDiscoverItem } from "@/lib/tmdb-genre-map";
import { tmdbGenreLabels } from "@/lib/tmdb-genre-labels";
import { cn } from "@/lib/utils";
import { AppUserButton } from "@/components/app-user-button";
import { SearchSuggestDropdown } from "@/components/search-suggest-dropdown";
import { ExploreJumpNav, type ExploreJumpLink } from "@/components/explore-jump-nav";
import { ExploreSpotlightRails } from "@/components/explore-spotlight-rails";
import { MobileAppNavSheet } from "@/components/mobile-app-nav-sheet";
import { PickForMePanel } from "@/components/pick-for-me-panel";
import { clearExploreRecentLocal } from "@/lib/explore-recent-storage";
import { clearAllExploreRecentOpens } from "@/lib/supabase/explore-recent-service";

const WATCHLIST_SESSION_CACHE_PREFIX = "moviefy_explore_watchlist_v1_";
const WATCHLIST_CACHE_EVENT = "moviefy:explore-watchlist-cache-change";

function subscribeToWatchlistCache(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(WATCHLIST_CACHE_EVENT, onStoreChange);
  return () => window.removeEventListener(WATCHLIST_CACHE_EVENT, onStoreChange);
}

function getWatchlistCacheSnapshot(userId: string | null): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(
      `${WATCHLIST_SESSION_CACHE_PREFIX}${userId}`,
    );
  } catch {
    return null;
  }
}

function parseWatchlistCache(snapshot: string | null): Movie[] | null {
  if (!snapshot) return null;
  try {
    const parsed = JSON.parse(snapshot) as unknown;
    return Array.isArray(parsed) && parsed.length ? (parsed as Movie[]) : null;
  } catch {
    return null;
  }
}

function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function talkOfTownLabel(item: TmdbDiscoverItem): string {
  const rd = item.release_date;
  if (rd) {
    const t0 = Date.parse(`${rd}T12:00:00Z`);
    if (Number.isFinite(t0)) {
      const days = (t0 - Date.now()) / 86400000;
      if (days > 0 && days < 120) return "Coming soon";
      if (days <= 0 && days > -28) return "Just dropped";
    }
  }
  if (item.vote_count >= 5000) return "Hot";
  if (item.vote_average >= 8) return "Buzzing";
  return "This week";
}

const GENRE_PAGE_SORT_LABEL: Record<
  "popularity.desc" | "vote_average.desc" | "primary_release_date.desc",
  string
> = {
  "popularity.desc": "Popular",
  "vote_average.desc": "Top rated",
  "primary_release_date.desc": "Newest",
};

function CommunityPlaylistCard({
  item,
  following,
  liked,
  onToggleFollow,
  onToggleLike,
  onSaveToLibrary,
}: {
  item: CommunityPlaylist;
  following: boolean;
  liked: boolean;
  onToggleFollow: () => void;
  onToggleLike: () => void;
  onSaveToLibrary: () => Promise<void>;
}) {
  const cover = item.movies[0];
  return (
    <div className="group flex w-[min(280px,calc(100vw-2.5rem))] max-w-[min(300px,calc(100vw-1.5rem))] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-[var(--app-shadow-card)] transition hover:border-border hover:shadow-[var(--app-shadow-card)] sm:w-[300px] sm:max-w-none">
      <div className="relative aspect-[16/10] overflow-hidden bg-zinc-900">
        {cover ? (
          <PosterImage
            src={cover.posterImage}
            alt={cover.title}
            fill
            placeholderGradient={cover.posterClass}
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            sizes="300px"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
          <Badge className="border-0 bg-white/15 text-[10px] text-white backdrop-blur">
            <Globe className="mr-1 size-3" />
            Public
          </Badge>
          <span className="text-[10px] text-white/80">
            {item.likeCount.toLocaleString()} likes ·{" "}
            {item.followerCount.toLocaleString()} followers
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div>
          <h3 className="font-heading text-base font-semibold leading-snug text-foreground line-clamp-2">
            {item.name}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          By <span className="text-foreground/90">{item.ownerName}</span>{" "}
          <span className="text-primary">{item.ownerHandle}</span>
        </p>
        <p className="text-[11px] text-muted-foreground/90">{item.movies.length} films</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant={liked ? "secondary" : "outline"}
            className={cn(
              "h-10 min-w-10 shrink-0 border-border/80 px-3 text-xs sm:h-8 sm:min-w-0",
              liked && "border-transparent text-rose-200",
            )}
            title={liked ? "Unlike" : "Like"}
            onClick={() => {
              void onToggleLike();
            }}
          >
            <Heart
              className={cn("size-3.5", liked && "fill-current")}
            />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={following ? "secondary" : "outline"}
            className={cn(
              "h-10 min-h-10 min-w-0 flex-1 border-border/80 text-xs sm:h-8 sm:min-h-0",
              following && "border-transparent",
            )}
            onClick={() => {
              void onToggleFollow();
            }}
          >
            <UserPlus className="size-3.5 shrink-0" />
            {following ? "Following" : "Follow"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-10 min-h-10 min-w-0 flex-1 text-xs sm:h-8 sm:min-h-0"
            onClick={() => {
              void onSaveToLibrary();
            }}
          >
            <Plus className="size-3.5 shrink-0" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ExplorePage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const genreFromUrlApplied = useRef<Genre | null>(null);
  const { client, appUser, dbUserId, ready } = useSupabaseApp();
  const [communityPlaylists, setCommunityPlaylists] = useState<
    CommunityPlaylist[]
  >([]);
  const [communityLoadedFor, setCommunityLoadedFor] = useState<string | null>(
    null,
  );
  const communityLoading =
    !ready ||
    Boolean(
      client &&
        appUser &&
        dbUserId &&
        communityLoadedFor !== dbUserId,
    );
  const [searchQuery, setSearchQuery] = useState("");
  const routeGenreValue = searchParams.get("genre");
  const routeGenre =
    routeGenreValue && (GENRES as readonly string[]).includes(routeGenreValue)
      ? (routeGenreValue as Genre)
      : null;
  const [genreSelection, setGenreSelection] = useState<{
    routeValue: string | null;
    genre: BrowseGenre;
  } | null>(null);
  const genre =
    genreSelection?.routeValue === routeGenreValue
      ? genreSelection.genre
      : routeGenre ?? genreSelection?.genre ?? "all";
  const [genreSort, setGenreSort] = useState<
    "popularity.desc" | "vote_average.desc" | "primary_release_date.desc"
  >("popularity.desc");
  const genreQueryKey = JSON.stringify([genre, genreSort]);
  const [genreResult, setGenreResult] = useState<{
    query: string;
    configured: boolean;
    results: TmdbDiscoverResponse["results"];
  } | null>(null);
  const genreLoading = genreResult?.query !== genreQueryKey;
  const genreResults =
    genreResult?.query === genreQueryKey ? genreResult.results : [];
  const genreConfigured =
    genreResult?.query === genreQueryKey ? genreResult.configured : true;
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [townItems, setTownItems] = useState<TmdbDiscoverItem[]>([]);
  const [townLoading, setTownLoading] = useState(true);
  const [topChartWindow, setTopChartWindow] = useState<"week" | "day">("week");
  const [dayTrending, setDayTrending] = useState<TmdbDiscoverItem[]>([]);
  const [dayTrendingLoading, setDayTrendingLoading] = useState(false);
  const [watchlistData, setWatchlistData] = useState<{
    userId: string;
    movies: Movie[];
  } | null>(null);
  const watchlistCacheSnapshot = useSyncExternalStore(
    subscribeToWatchlistCache,
    () => getWatchlistCacheSnapshot(dbUserId),
    () => null,
  );
  const cachedWatchlistMovies = useMemo(
    () => parseWatchlistCache(watchlistCacheSnapshot),
    [watchlistCacheSnapshot],
  );
  const watchlistMovies =
    dbUserId && watchlistData?.userId === dbUserId
      ? watchlistData.movies
      : cachedWatchlistMovies ?? [];
  const [watchlistLoadedFor, setWatchlistLoadedFor] = useState<string | null>(
    null,
  );
  const watchlistLoading =
    ready &&
    Boolean(client && dbUserId && watchlistLoadedFor !== dbUserId);
  const [serverExploreRecentData, setServerExploreRecentData] = useState<{
    userId: string;
    opens: ExploreRecentOpen[];
  } | null>(null);
  const serverExploreRecentOpens = useMemo(
    () =>
      ready &&
      dbUserId &&
      serverExploreRecentData?.userId === dbUserId
        ? serverExploreRecentData.opens
        : [],
    [ready, dbUserId, serverExploreRecentData],
  );
  const [exploreRecentLoadedFor, setExploreRecentLoadedFor] = useState<
    string | null
  >(null);
  const exploreRecentLoading =
    ready &&
    Boolean(
      client &&
        dbUserId &&
        exploreRecentLoadedFor !== dbUserId,
    );
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [suggestResult, setSuggestResult] = useState<{
    query: string;
    data: SearchSuggestResponse | null;
  } | null>(null);
  const suggestQuery = searchQuery.trim() ? debouncedSearch.trim() : "";
  const suggestData =
    suggestResult?.query === suggestQuery ? suggestResult.data : null;
  const suggestLoading =
    Boolean(suggestQuery) && suggestResult?.query !== suggestQuery;
  const personId = searchParams.get("personId");
  const personName = searchParams.get("personName");
  const castPerson =
    personId && Number.isFinite(Number(personId))
      ? {
          id: Number(personId),
          name: personName
            ? decodeQueryComponent(personName)
            : "Performer",
        }
      : null;

  const toast = useCallback((m: string) => setToastMsg(m), []);

  const clearExploreRecent = useCallback(async () => {
    clearExploreRecentLocal();
    if (client && dbUserId) {
      const userId = dbUserId;
      const ok = await clearAllExploreRecentOpens(client, userId);
      if (!ok) {
        toast("Could not clear server history — device list was cleared.");
      } else {
        setServerExploreRecentData((current) =>
          current?.userId === userId ? { userId, opens: [] } : current,
        );
      }
    }
    toast("Recently viewed cleared");
  }, [client, dbUserId, toast]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 2600);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (!ready || !client || !appUser?.id || !dbUserId) return;
    let cancelled = false;
    const userId = dbUserId;
    void fetchPublicCommunityPlaylists(client)
      .then((rows) => {
        if (cancelled) return;
        setCommunityPlaylists(rows.filter((p) => p.ownerUserId !== userId));
      })
      .finally(() => {
        if (!cancelled) setCommunityLoadedFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, client, appUser?.id, dbUserId]);

  useEffect(() => {
    if (!ready || !client || !dbUserId) return;
    void fetchFollowedPlaylistIds(client, dbUserId).then(setFollowedIds);
  }, [ready, client, dbUserId]);

  useEffect(() => {
    if (!ready || !client || !dbUserId) return;
    void fetchLikedPlaylistIds(client, dbUserId).then(setLikedIds);
  }, [ready, client, dbUserId]);

  useEffect(() => {
    if (!ready || !client || !dbUserId) return;
    const uid = dbUserId;
    let cancelled = false;
    void fetchSavedMoviesForUser(client, uid)
      .then((rows) => {
        if (!cancelled) {
          setWatchlistData({ userId: uid, movies: rows });
          try {
            sessionStorage.setItem(
              `${WATCHLIST_SESSION_CACHE_PREFIX}${uid}`,
              JSON.stringify(rows),
            );
            window.dispatchEvent(new Event(WATCHLIST_CACHE_EVENT));
          } catch {
            /* ignore */
          }
        }
      })
      .finally(() => {
        if (!cancelled) setWatchlistLoadedFor(uid);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, client, dbUserId]);

  useEffect(() => {
    if (!ready || !client || !dbUserId) return;
    let cancelled = false;
    const userId = dbUserId;
    void fetchExploreRecentOpens(client, userId)
      .then((rows) => {
        if (!cancelled) setServerExploreRecentData({ userId, opens: rows });
      })
      .finally(() => {
        if (!cancelled) setExploreRecentLoadedFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, client, dbUserId]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/trending/week")
      .then((r) => r.json() as Promise<TmdbDiscoverResponse>)
      .then((d) => {
        if (!cancelled) setTownItems(d.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setTownItems([]);
      })
      .finally(() => {
        if (!cancelled) setTownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (topChartWindow !== "day") return;
    let cancelled = false;
    void fetch("/api/trending/day")
      .then((r) => r.json() as Promise<TmdbDiscoverResponse>)
      .then((d) => {
        if (!cancelled) setDayTrending(d.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setDayTrending([]);
      })
      .finally(() => {
        if (!cancelled) setDayTrendingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topChartWindow]);

  const topChartItems =
    topChartWindow === "week" ? townItems : dayTrending;
  const topChartLoading =
    topChartWindow === "week" ? townLoading : dayTrendingLoading;

  function changeTopChartWindow(nextWindow: "week" | "day") {
    if (nextWindow === "day" && nextWindow !== topChartWindow) {
      setDayTrendingLoading(true);
    }
    setTopChartWindow(nextWindow);
  }

  useEffect(() => {
    const ctrl = new AbortController();
    const url =
      genre === "all"
        ? `/api/discover/top?sort=${encodeURIComponent(genreSort)}`
        : `/api/discover/genre?genre=${encodeURIComponent(genre)}&sort=${encodeURIComponent(genreSort)}`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<TmdbDiscoverResponse>)
      .then((data) => {
        if (!ctrl.signal.aborted) {
          setGenreResult({
            query: genreQueryKey,
            configured: data.configured,
            results: data.results ?? [],
          });
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setGenreResult({
            query: genreQueryKey,
            configured: false,
            results: [],
          });
        }
      });
    return () => ctrl.abort();
  }, [genre, genreSort, genreQueryKey]);

  useEffect(() => {
    if (!routeGenre || genreFromUrlApplied.current === routeGenre) return;
    genreFromUrlApplied.current = routeGenre;
    window.requestAnimationFrame(() => {
      document.getElementById("explore-browse-genre")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [routeGenre]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (!q) return;
    const ctrl = new AbortController();
    void fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json() as Promise<SearchSuggestResponse>)
      .then((d) => {
        if (!ctrl.signal.aborted) setSuggestResult({ query: q, data: d });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setSuggestResult({ query: q, data: null });
      });
    return () => ctrl.abort();
  }, [debouncedSearch]);

  const playlistSearchHits = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return communityPlaylists;
    return communityPlaylists.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.ownerHandle.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q),
    );
  }, [debouncedSearch, communityPlaylists]);

  const followedPlaylists = useMemo(
    () => communityPlaylists.filter((p) => followedIds.has(p.id)),
    [communityPlaylists, followedIds],
  );

  const hasCastPerson = Boolean(castPerson);
  const hasFollowedPlaylists = followedPlaylists.length > 0;
  const exploreJumpLinks = useMemo<ExploreJumpLink[]>(() => {
    const links: ExploreJumpLink[] = [];
    if (hasCastPerson) {
      links.push({ id: "explore-section-cast", label: "Cast picks" });
    }
    links.push(
      { id: "explore-section-watchlist", label: "Watchlist" },
      { id: "explore-section-recent", label: "Recent" },
      { id: "explore-section-moods", label: "Moods" },
      { id: "explore-section-pick-for-me", label: "Pick for me" },
      { id: "explore-section-spotlights", label: "Awards · ≤90m" },
      { id: "explore-section-buzzing", label: "Buzzing" },
      { id: "explore-stream-netflix", label: "Netflix" },
      { id: "explore-stream-prime", label: "Prime" },
      { id: "explore-stream-hulu", label: "Hulu" },
      { id: "explore-stream-disney", label: "Disney+" },
      { id: "explore-browse-genre", label: "Genres" },
      { id: "explore-section-editor-picks", label: "TMDB picks" },
    );
    if (hasFollowedPlaylists) {
      links.push({ id: "explore-section-followed", label: "Following" });
    }
    links.push({ id: "explore-public-playlists", label: "Playlists" });
    return links;
  }, [hasCastPerson, hasFollowedPlaylists]);

  const localExploreRecentSnapshot = useSyncExternalStore(
    subscribeToExploreRecentStorage,
    getExploreRecentStorageSnapshot,
    getServerExploreRecentStorageSnapshot,
  );
  const localExploreRecentOpens = useMemo(
    () => parseExploreRecentStorageSnapshot(localExploreRecentSnapshot),
    [localExploreRecentSnapshot],
  );

  const mergedExploreRecentMovies = useMemo(
    () =>
      mergeExploreRecentMovies(
        serverExploreRecentOpens,
        localExploreRecentOpens,
      ),
    [serverExploreRecentOpens, localExploreRecentOpens],
  );

  function selectMovie(movie: Movie) {
    pushExploreRecent(movie);
    if (client && dbUserId) {
      void upsertExploreRecentOpen(client, dbUserId, movie);
    }
    const href = movieToDetailPageHref(movie, "explore");
    if (!href) {
      toast("Could not open this title — missing TMDB id.");
      return;
    }
    void (async () => {
      await prefetchMovieEnrich(movie);
      router.push(href);
    })();
  }

  function selectMovieFromSuggestRow(row: SearchSuggestMovieRow) {
    const item = discoverItemFromSuggestMovie(row);
    selectMovie(movieFromTmdbDiscoverItem(item));
    setSearchQuery("");
    setSuggestResult(null);
  }

  function selectGenre(nextGenre: BrowseGenre) {
    setGenreSelection({ routeValue: routeGenreValue, genre: nextGenre });
  }

  function applyGenreFromSearch(g: Genre) {
    selectGenre(g);
    setSearchQuery("");
    setSuggestResult(null);
    window.requestAnimationFrame(() => {
      document.getElementById("explore-browse-genre")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function applyPersonFromSearch(id: number, name: string) {
    setSearchQuery("");
    setSuggestResult(null);
    router.replace(
      `/app/explore?personId=${id}&personName=${encodeURIComponent(name)}`,
      { scroll: false },
    );
  }

  function clearCastPerson() {
    router.replace("/app/explore", { scroll: false });
  }

  async function toggleFollow(id: string) {
    if (!client || !dbUserId) return;
    const was = followedIds.has(id);
    const next = !was;
    const ok = await setPlaylistFollowedDb(
      client,
      dbUserId,
      id,
      next,
    );
    if (!ok) {
      toast("Could not update follow");
      return;
    }
    const fresh = await fetchFollowedPlaylistIds(client, dbUserId);
    setFollowedIds(fresh);
    toast(was ? "Unfollowed playlist" : "Following this playlist");
  }

  async function toggleLike(id: string) {
    if (!client || !dbUserId) return;
    const was = likedIds.has(id);
    const next = !was;
    const delta = next ? 1 : -1;
    setLikedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
    setCommunityPlaylists((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, likeCount: Math.max(0, p.likeCount + delta) }
          : p,
      ),
    );
    const ok = await setPlaylistLikedDb(client, dbUserId, id, next);
    if (!ok) {
      setLikedIds((prev) => {
        const s = new Set(prev);
        if (was) s.add(id);
        else s.delete(id);
        return s;
      });
      setCommunityPlaylists((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, likeCount: Math.max(0, p.likeCount - delta) }
            : p,
        ),
      );
      toast("Could not update like");
      return;
    }
    toast(was ? "Removed like" : "Liked playlist");
  }

  return (
    <div className="min-h-dvh text-foreground motion-safe:transition-opacity motion-safe:duration-200">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/45 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/35">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <MobileAppNavSheet />
            <Link
              href="/app"
              aria-label="Your theatre"
              className="hidden min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground/90 transition hover:bg-muted/50 lg:inline-flex"
            >
              <ArrowLeft className="size-4 shrink-0" />
              <span>Your theatre</span>
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Compass className="size-4" />
              </div>
              <div>
                <p className="type-kicker">Explore</p>
                <p className="type-micro">Discovery hub</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 lg:hidden">
              <Link
                href="/app"
                aria-label="Your theatre"
                title="Your theatre"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "icon" }),
                  "size-10 shrink-0 border-0 bg-muted/50",
                  (pathname === "/app" || pathname === "/app/") &&
                    "bg-muted/70 ring-1 ring-violet-400/40",
                )}
              >
                <Clapperboard className="size-4" aria-hidden />
              </Link>
              <Link
                href="/app/releases"
                aria-label="Release radar"
                title="Release radar"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "icon" }),
                  "size-10 shrink-0 border-0 bg-muted/50 text-foreground hover:bg-muted/70",
                  pathname.startsWith("/app/releases") &&
                    "bg-muted/70 ring-1 ring-violet-400/40",
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
                  pathname.startsWith("/app/reels") &&
                    "bg-muted/70 ring-1 ring-violet-400/40",
                )}
              >
                <Film className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="hidden items-center gap-1.5 lg:flex">
              <Link
                href="/app/releases"
                aria-label="Release radar"
                title="Release radar"
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground",
                  pathname.startsWith("/app/releases") &&
                    "bg-muted/50 text-foreground ring-1 ring-violet-400/30",
                )}
              >
                <CalendarDays className="size-4 shrink-0" aria-hidden />
                Release radar
              </Link>
              <Link
                href="/app/reels"
                aria-label="Meme reels"
                title="Meme reels"
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground",
                  pathname.startsWith("/app/reels") &&
                    "bg-muted/50 text-foreground ring-1 ring-violet-400/30",
                )}
              >
                <Film className="size-4 shrink-0" aria-hidden />
                Meme reels
              </Link>
            </div>
            <AppUserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-3 py-8 pb-[max(2rem,calc(1.25rem+env(safe-area-inset-bottom)))] sm:px-6 sm:py-14 sm:pb-14">
        <section className="relative z-[25] rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-950/50 via-emerald-950/25 to-red-950/35 p-4 pb-7 shadow-[var(--app-shadow-card)] sm:p-10 sm:pb-10">
          {/* Clip only glows — search dropdown must not be clipped by overflow-hidden */}
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
            aria-hidden
          >
            <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
            <div className="absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>
          <div className="relative max-w-2xl">
            <h1 className="type-hero">Find your next obsession</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
              Search creators’ public lists, like and follow playlists you love, save them
              to your library — same energy as Spotify, built for film. Your own lists and
              saved titles stay on{" "}
              <Link
                href="/app"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Your theatre
              </Link>{" "}
              (Home).
            </p>
            <div ref={searchWrapRef} className="relative z-[60] mt-6 max-w-xl">
              <Search className="absolute left-3 top-1/2 z-[1] size-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Movies, actors, genres, playlists…"
                className="h-11 border-border/60 bg-background/40 pl-10 pr-10 text-foreground placeholder:text-muted-foreground/70"
                aria-autocomplete="list"
                aria-expanded={Boolean(searchQuery.trim())}
              />
              {searchQuery.trim() ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 z-[1] flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                  onClick={() => {
                    setSearchQuery("");
                    setSuggestResult(null);
                  }}
                >
                  <X className="size-4" />
                </button>
              ) : null}
              <SearchSuggestDropdown
                open={Boolean(searchQuery.trim())}
                variant="explore"
                query={searchQuery}
                loading={suggestLoading}
                data={suggestData}
                playlistHits={playlistSearchHits.slice(0, 10).map((p) => ({
                  id: p.id,
                  name: p.name,
                  hint: `${p.movies.length} films · @${p.ownerHandle}`,
                  onPick: () => {
                    setSearchQuery("");
                    setSuggestResult(null);
                    window.requestAnimationFrame(() => {
                      document
                        .getElementById("explore-public-playlists")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    });
                  },
                }))}
                onPickMovie={selectMovieFromSuggestRow}
                onPickPerson={applyPersonFromSearch}
                onPickGenre={applyGenreFromSearch}
                onPickPlaylist={(hit) => hit.onPick()}
              />
            </div>
          </div>
        </section>

        <div className="relative z-0">
        <ExploreJumpNav links={exploreJumpLinks} />

        <div className="mt-10">
          <PickForMePanel onPickMovie={selectMovie} />
        </div>

        {castPerson ? (
          <section
            id="explore-section-cast"
            className="mt-12 scroll-mt-28 rounded-2xl border border-violet-400/30 bg-violet-950/20 p-5 shadow-[var(--app-shadow-card)] sm:p-6"
          >
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="type-section-title">With {castPerson.name}</h2>
                <p className="type-section-sub">
                  Discover titles featuring this performer (TMDB cast filter).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-border/70 text-foreground hover:bg-muted/40"
                onClick={() => clearCastPerson()}
              >
                Clear
              </Button>
            </div>
            <ExploreMovieRail
              title="Filmography picks"
              endpoint={`/api/discover/by-cast?personId=${castPerson.id}`}
              onSelectMovie={selectMovie}
              limit={16}
            />
          </section>
        ) : null}

        <div className="mt-10 flex flex-col gap-10 lg:mt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,320px)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="order-2 min-w-0 space-y-14 lg:order-1">
        <ExplorePersonalRails
          watchlistMovies={watchlistMovies}
          watchlistLoading={watchlistLoading}
          recentMovies={mergedExploreRecentMovies}
          recentLoading={exploreRecentLoading}
          onSelectMovie={selectMovie}
          onClearRecent={clearExploreRecent}
          canClearRecent={mergedExploreRecentMovies.length > 0}
        />

        <div id="explore-section-moods" className="scroll-mt-28">
          <ExploreCuratedMoods onSelectMovie={selectMovie} />
        </div>

        <ExploreSpotlightRails onSelectMovie={selectMovie} />

        <section id="explore-section-buzzing" className="scroll-mt-28">
          <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
            <Megaphone className="size-5 shrink-0 text-sky-400" aria-hidden />
            <div>
              <h2 className="type-section-title">What’s buzzing</h2>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-b from-sky-950/35 via-card/90 to-background/80 p-4 shadow-[var(--app-shadow-card)] sm:p-5">
            {townLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2 pt-1 sm:gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <ExplorePosterSkeleton key={i} />
                ))}
              </div>
            ) : townItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Add TMDB_API_KEY to show the trending rail.
              </p>
            ) : (
              <div className="relative">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
                    backgroundSize: "14px 14px",
                  }}
                />
                <div className="relative flex gap-3 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin] [scrollbar-color:rgba(56,189,248,0.4)_transparent] snap-x snap-mandatory sm:gap-4 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-sky-500/40">
                  {townItems.slice(0, 14).map((item, idx) => {
                    const movie = movieFromTmdbDiscoverItem(item);
                    const tag = talkOfTownLabel(item);
                    const rank = idx + 1;
                    const genres = tmdbGenreLabels(item.genre_ids);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectMovie(movie)}
                        className="group w-[104px] shrink-0 snap-start text-left motion-safe:transition motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 sm:w-[118px]"
                      >
                        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 shadow-lg shadow-black/40 ring-1 ring-white/10 transition duration-200 group-hover:ring-sky-400/50 group-hover:shadow-sky-950/25">
                          <PosterImage
                            src={movie.posterImage}
                            alt={movie.title}
                            fill
                            placeholderGradient={movie.posterClass}
                            className="object-cover transition duration-300 group-hover:scale-[1.04]"
                            sizes="118px"
                          />
                          <div
                            className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/35 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            aria-hidden
                          >
                            <p className="text-[10px] font-semibold text-amber-100/95">
                              ★ {item.vote_average.toFixed(1)}
                            </p>
                            {genres ? (
                              <p className="mt-0.5 line-clamp-3 text-[9px] leading-snug text-white/85">
                                {genres}
                              </p>
                            ) : null}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-2 pb-2 pt-8">
                            <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-white drop-shadow-md sm:text-[11px]">
                              {movie.title}
                            </p>
                            <p className="mt-0.5 text-[9px] text-white/55">
                              ★ {item.vote_average.toFixed(1)}
                            </p>
                          </div>
                          <span className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/75 text-[11px] font-bold tabular-nums text-white ring-1 ring-sky-400/45 backdrop-blur-sm">
                            {rank}
                          </span>
                          <div className="absolute right-2 top-2 max-w-[calc(100%-3rem)]">
                            <Badge className="border-0 bg-black/60 px-1 py-0 text-[8px] font-medium uppercase leading-tight tracking-wide text-white/90 backdrop-blur">
                              {tag}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3.5">
            <h2 className="type-section-title">What&apos;s trending where you watch</h2>
          </div>
          <ExploreStreamingRails onSelectMovie={selectMovie} />
        </section>

        <section id="explore-browse-genre" className="scroll-mt-28">
          <div className="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="type-section-title">Browse by genre</h2>
            </div>
            <Select
              value={genreSort}
              onValueChange={(v) => {
                if (
                  v === "popularity.desc" ||
                  v === "vote_average.desc" ||
                  v === "primary_release_date.desc"
                ) {
                  setGenreSort(v);
                }
              }}
            >
              <SelectTrigger className="h-9 w-full border-border/60 bg-muted/35 text-xs sm:w-[200px]">
                <SelectValue>
                  {GENRE_PAGE_SORT_LABEL[genreSort] ?? "Sort"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popularity.desc">Popular</SelectItem>
                <SelectItem value="vote_average.desc">Top rated</SelectItem>
                <SelectItem value="primary_release_date.desc">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={genre === "all" ? "secondary" : "outline"}
              className={cn(
                "rounded-full border-border/70",
                genre === "all" && "border-transparent",
              )}
              onClick={() => selectGenre("all")}
            >
              All
            </Button>
            {GENRES.map((g) => (
              <Button
                key={g}
                type="button"
                size="sm"
                variant={genre === g ? "secondary" : "outline"}
                className={cn(
                  "rounded-full border-border/70",
                  genre === g && "border-transparent",
                )}
                onClick={() => selectGenre(genre === g ? "all" : g)}
              >
                {g}
              </Button>
            ))}
          </div>

          <div className="mt-6 min-h-[120px] rounded-2xl border border-border/70 bg-card/85 p-4 shadow-[var(--app-shadow-card)] sm:p-6">
            {genreLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-muted/35" />
                    <div className="h-3 w-[75%] animate-pulse rounded bg-muted/30" />
                    <div className="h-2 w-[45%] animate-pulse rounded bg-muted/25" />
                  </div>
                ))}
              </div>
            ) : !genreConfigured ? (
              <p className="text-center text-sm text-amber-200/80">
                Add TMDB_API_KEY to load genre results.
              </p>
            ) : genreResults.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No titles matched. Try another genre or sort.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {genreResults.slice(0, 15).map((item) => {
                  const movie = movieFromTmdbDiscoverItem(item);
                  const genres = tmdbGenreLabels(item.genre_ids);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectMovie(movie)}
                      className="group text-left motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-0.5"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition duration-200 group-hover:ring-primary/40">
                        <PosterImage
                          src={movie.posterImage}
                          alt={movie.title}
                          fill
                          placeholderGradient={movie.posterClass}
                          className="object-cover transition duration-300 group-hover:scale-[1.03]"
                          sizes="(max-width: 640px) 45vw, 180px"
                        />
                        <div
                          className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/30 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                          aria-hidden
                        >
                          <p className="text-[10px] font-semibold text-amber-100/95">
                            ★ {item.vote_average.toFixed(1)}
                          </p>
                          {genres ? (
                            <p className="mt-0.5 line-clamp-3 text-[9px] leading-snug text-white/85">
                              {genres}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground">
                        {movie.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        ★ {item.vote_average.toFixed(1)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="app-panel p-4 sm:p-6">
          <TmdbDiscoverSection
            sectionId="explore-section-editor-picks"
            selectedMovieId={null}
            onSelectMovie={selectMovie}
          />
        </section>

        {followedPlaylists.length > 0 ? (
          <section id="explore-section-followed" className="scroll-mt-28">
            <h2 className="type-section-title">Creators you follow</h2>
            <div className="mt-3.5 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {followedPlaylists.map((p) => (
                <CommunityPlaylistCard
                  key={p.id}
                  item={p}
                  following={followedIds.has(p.id)}
                  liked={likedIds.has(p.id)}
                  onToggleFollow={() => void toggleFollow(p.id)}
                  onToggleLike={() => void toggleLike(p.id)}
                  onSaveToLibrary={async () => {
                    if (!client || !dbUserId) return;
                    const pl = await clonePublicPlaylistForUser(
                      client,
                      dbUserId,
                      p.id,
                    );
                    toast(
                      pl
                        ? "Saved to your library — open Your theatre to see it"
                        : "Could not copy playlist",
                    );
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section id="explore-public-playlists" className="scroll-mt-28">
          <h2 className="type-section-title">Public playlists</h2>
          <ScrollArea className="mt-3.5 w-full">
            <div className="flex w-max gap-4 pb-2">
              {communityLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading public playlists…
                </div>
              ) : communityPlaylists.length === 0 ? (
                <p className="py-8 text-sm text-muted-foreground">
                  No public playlists yet. Mark a list as Public in your Library to share it
                  here.
                </p>
              ) : (
                communityPlaylists.map((p) => (
                  <CommunityPlaylistCard
                    key={p.id}
                    item={p}
                    following={followedIds.has(p.id)}
                    liked={likedIds.has(p.id)}
                    onToggleFollow={() => void toggleFollow(p.id)}
                    onToggleLike={() => void toggleLike(p.id)}
                    onSaveToLibrary={async () => {
                      if (!client || !dbUserId) return;
                      const pl = await clonePublicPlaylistForUser(
                        client,
                        dbUserId,
                        p.id,
                      );
                      toast(
                        pl
                          ? "Saved to your library — open Your theatre to see it"
                          : "Could not copy playlist",
                      );
                    }}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </section>
          </div>
          <div className="order-1 mt-0 w-full shrink-0 lg:order-2 lg:mt-0 lg:sticky lg:top-[calc(5.25rem+env(safe-area-inset-top,0px))] lg:self-start">
            <ExploreTop10Sidebar
              loading={topChartLoading}
              items={topChartItems}
              chartWindow={topChartWindow}
              onChartWindowChange={changeTopChartWindow}
              onSelectMovie={selectMovie}
            />
          </div>
        </div>
        </div>
      </main>

      {toastMsg ? (
        <div
          className="fixed left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border border-border/70 bg-popover px-4 py-2.5 text-center text-sm text-popover-foreground shadow-[var(--app-shadow-card)] [bottom:max(1.25rem,calc(0.75rem+env(safe-area-inset-bottom)))]"
          role="status"
        >
          {toastMsg}
        </div>
      ) : null}
    </div>
  );
}
