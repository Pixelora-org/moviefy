"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  Compass,
  Film,
  Flame,
  Languages,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { AppUserButton } from "@/components/app-user-button";
import { MobileAppNavSheet } from "@/components/mobile-app-nav-sheet";
import { MoviefyBrandLoaderRow } from "@/components/moviefy-brand-loader";
import { PosterImage } from "@/components/poster-image";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GENRES, type Genre } from "@/lib/types";
import { cn } from "@/lib/utils";
import { tmdbPosterUrl } from "@/lib/tmdb-image";
import { movieToDetailPageHref } from "@/lib/movie-detail-nav";
import { prefetchMovieEnrich } from "@/lib/movie-enrich-prefetch";
import { formatScheduleHype } from "@/lib/releases-schedule-display";
import { scheduleItemToMovie } from "@/lib/releases-schedule-mappers";
import { useSupabaseApp } from "@/components/supabase-app-provider";
import {
  addUserReleaseWatchlist,
  dispatchReleaseWatchlistChanged,
  fetchUserReleaseWatchlist,
  removeUserReleaseWatchlist,
} from "@/lib/supabase/release-watchlist-service";
import type {
  ScheduleItem,
  ScheduleMedia,
  ScheduleResponse,
  ScheduleWindow,
} from "@/lib/releases-schedule-types";

const RELEASE_LANGS = [
  { value: "all", label: "Any language" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
] as const;

const EMPTY_TRACKED_IDS = new Set<string>();

function dateBadgeParts(iso: string): { dow: string; dom: string; mon: string } {
  const t = Date.parse(`${iso}T12:00:00Z`);
  if (!Number.isFinite(t)) {
    return { dow: "—", dom: "—", mon: "" };
  }
  const d = new Date(t);
  const dow = new Intl.DateTimeFormat("en-GB", { weekday: "short" })
    .format(d)
    .toUpperCase();
  const dom = new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(d);
  const mon = new Intl.DateTimeFormat("en-GB", { month: "short" })
    .format(d)
    .toUpperCase();
  return { dow, dom, mon };
}

function watchlistKey(item: ScheduleItem): string {
  return `${item.mediaType}-${item.tmdbId}`;
}

function groupByDate(items: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const m = new Map<string, ScheduleItem[]>();
  for (const it of items) {
    const k = it.releaseDate;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return m;
}

export function ReleasesPage() {
  const router = useRouter();
  const { client, dbUserId } = useSupabaseApp();
  const [windowKey, setWindowKey] = useState<ScheduleWindow>("today");
  const [typeFilter, setTypeFilter] = useState<"all" | ScheduleMedia>("all");
  const [genreFilter, setGenreFilter] = useState<"all" | Genre>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const queryKey = JSON.stringify([
    windowKey,
    typeFilter,
    genreFilter,
    langFilter,
  ]);
  const loading = loadedQuery !== queryKey;
  const [trackedWatchlist, setTrackedWatchlist] = useState<{
    userId: string;
    ids: Set<string>;
  } | null>(null);
  const trackedIds =
    dbUserId && trackedWatchlist?.userId === dbUserId
      ? trackedWatchlist.ids
      : EMPTY_TRACKED_IDS;
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 2600);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (!client || !dbUserId) return;
    let cancelled = false;
    void fetchUserReleaseWatchlist(client, dbUserId).then((rows) => {
      if (cancelled) return;
      setTrackedWatchlist({
        userId: dbUserId,
        ids: new Set(rows.map((r) => `${r.mediaType}-${r.tmdbId}`)),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [client, dbUserId]);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams();
    q.set("window", windowKey);
    q.set("type", typeFilter);
    if (genreFilter !== "all") q.set("genre", genreFilter);
    if (langFilter !== "all") q.set("lang", langFilter);
    void fetch(`/api/releases/schedule?${q.toString()}`)
      .then((r) => r.json() as Promise<ScheduleResponse>)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadedQuery(queryKey);
      });
    return () => {
      cancelled = true;
    };
  }, [windowKey, typeFilter, genreFilter, langFilter, queryKey]);

  const grouped = useMemo(() => {
    if (!data?.items.length) return new Map<string, ScheduleItem[]>();
    return groupByDate(data.items);
  }, [data]);

  const sortedDates = useMemo(
    () => [...grouped.keys()].sort((a, b) => a.localeCompare(b)),
    [grouped],
  );

  async function openItem(item: ScheduleItem) {
    const movie = scheduleItemToMovie(item);
    const href = movieToDetailPageHref(
      movie,
      "releases",
      item.mediaType === "tv" ? "tv" : "movie",
    );
    if (!href) return;
    await prefetchMovieEnrich(movie, item.mediaType === "tv" ? "tv" : "movie");
    router.push(href);
  }

  async function toggleReleaseWatch(item: ScheduleItem) {
    if (!client || !dbUserId) {
      setToastMsg("Sign in to save titles for your theatre.");
      return;
    }
    const key = watchlistKey(item);
    const uid = dbUserId;
    if (trackedIds.has(key)) {
      const ok = await removeUserReleaseWatchlist(
        client,
        uid,
        item.tmdbId,
        item.mediaType,
      );
      if (!ok) {
        setToastMsg("Could not remove from Coming up.");
        return;
      }
      setTrackedWatchlist((prev) => {
        const next = new Set(
          prev?.userId === uid ? prev.ids : EMPTY_TRACKED_IDS,
        );
        next.delete(key);
        return { userId: uid, ids: next };
      });
      setToastMsg("Removed from Coming up");
    } else {
      const ok = await addUserReleaseWatchlist(client, uid, item);
      if (!ok) {
        setToastMsg("Could not save — run the release-watchlist DB migration?");
        return;
      }
      setTrackedWatchlist((prev) => {
        const next = new Set(
          prev?.userId === uid ? prev.ids : EMPTY_TRACKED_IDS,
        );
        next.add(key);
        return { userId: uid, ids: next };
      });
      setToastMsg("Saved to Coming up in Your theatre");
    }
    dispatchReleaseWatchlistChanged();
  }

  return (
    <div className="min-h-dvh text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/45 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/35">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <MobileAppNavSheet />
            <Link
              href="/app"
              aria-label="Your theatre"
              className="hidden min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground/90 transition hover:bg-muted/50 lg:flex"
            >
              <ArrowLeft className="size-4 shrink-0" />
              <span>Your theatre</span>
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
                <CalendarDays className="size-4" />
              </div>
              <div>
                <p className="font-heading text-sm font-semibold text-foreground">
                  Release radar
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-1.5 lg:flex">
              <Link
                href="/app/explore"
                aria-label="Explore"
                title="Explore"
                className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
              >
                <Compass className="size-4 shrink-0" />
                Explore
              </Link>
              <Link
                href="/app/reels"
                aria-label="Meme reels"
                title="Meme reels"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
              >
                <Film className="size-4 shrink-0" />
                Meme reels
              </Link>
            </div>
            <AppUserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1500px] flex-col gap-6 px-3 py-6 pb-[max(2rem,calc(1.25rem+env(safe-area-inset-bottom)))] sm:gap-8 sm:px-6 sm:py-10 sm:pb-10 lg:flex-row lg:items-start lg:gap-10">
        <aside className="-mx-1 shrink-0 overflow-hidden px-1 lg:mx-0 lg:w-52 lg:overflow-visible lg:px-0">
          <div className="app-panel flex max-lg:snap-x max-lg:snap-mandatory max-lg:touch-pan-x flex-row gap-1 overflow-x-auto overscroll-x-contain p-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:p-3 lg:snap-none lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            {(
              [
                {
                  key: "today" as const,
                  label: "Today",
                  icon: CalendarDays,
                  hint: "Releases dated today",
                },
                {
                  key: "upcoming" as const,
                  label: "Upcoming",
                  icon: Sparkles,
                  hint: "Next ~8 weeks",
                },
                {
                  key: "announced" as const,
                  label: "Announced",
                  icon: Megaphone,
                  hint: "Further out",
                },
              ] as const
            ).map(({ key, label, icon: Icon, hint }) => (
              <button
                key={key}
                type="button"
                title={hint}
                onClick={() => setWindowKey(key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition max-lg:min-h-11 max-lg:snap-start lg:w-full",
                  windowKey === key
                    ? "bg-primary/20 text-foreground ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Dates from TMDB (US theatrical window for films).
          </p>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-wrap items-center gap-2 gap-y-2.5">
            {(["all", "movie", "tv"] as const).map((f) => (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={typeFilter === f ? "secondary" : "outline"}
                className={cn(
                  "rounded-full border-border/70",
                  typeFilter === f && "border-transparent",
                )}
                onClick={() => setTypeFilter(f)}
              >
                {f === "all" ? "All" : f === "movie" ? "Movies" : "Shows"}
              </Button>
            ))}
            <span
              className="hidden h-6 w-px shrink-0 bg-border/50 sm:block"
              aria-hidden
            />
            <Select
              value={genreFilter}
              onValueChange={(v) => {
                const val = v ?? "all";
                setGenreFilter(
                  val === "all" || (GENRES as readonly string[]).includes(val)
                    ? (val as "all" | Genre)
                    : "all",
                );
              }}
            >
              <SelectTrigger
                className="h-8 w-[min(100%,10.5rem)] border-border/60 bg-background/70 text-xs"
                aria-label="Filter by genre"
              >
                <SelectValue
                  placeholder="Genre"
                  className="truncate"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genres</SelectItem>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={langFilter}
              onValueChange={(v) => setLangFilter(v ?? "all")}
            >
              <SelectTrigger
                className="h-8 w-[min(100%,10.5rem)] border-border/60 bg-background/70 text-xs"
                aria-label="Filter by original language"
              >
                <Languages className="mr-1.5 size-3.5 shrink-0 opacity-70" aria-hidden />
                <SelectValue className="truncate" />
              </SelectTrigger>
              <SelectContent>
                {RELEASE_LANGS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="py-14">
              <MoviefyBrandLoaderRow
                size="md"
                className="border-border/50 bg-muted/25"
                labelClassName="text-muted-foreground"
                label="Building your release calendar — dates and posters are on the way."
              />
            </div>
          ) : !data?.configured ? (
            <p className="rounded-2xl border border-border/60 bg-card/80 px-4 py-10 text-center text-sm text-muted-foreground">
              {data?.warning ??
                "Release radar isn’t available on this server yet — check back once it’s configured."}
            </p>
          ) : data.warning && !data.items.length ? (
            <p className="text-sm text-muted-foreground">{data.warning}</p>
          ) : sortedDates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing in this window for this filter. Try another tab or widen
              the type filter.
            </p>
          ) : (
            <div className="space-y-10">
              {sortedDates.map((date) => {
                const items = grouped.get(date) ?? [];
                const { dow, dom, mon } = dateBadgeParts(date);
                return (
                  <section key={date} className="flex gap-4 sm:gap-6">
                    <div className="flex w-11 shrink-0 flex-col items-center border-r border-border/50 pr-3 text-center sm:w-14 sm:pr-4">
                      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                        {dow}
                      </span>
                      <span className="font-heading text-2xl font-bold leading-none text-foreground sm:text-3xl">
                        {dom}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {mon}
                      </span>
                    </div>
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {items.map((item) => {
                        const tracked = trackedIds.has(watchlistKey(item));
                        return (
                          <div
                            key={`${item.mediaType}-${item.tmdbId}`}
                            className="group w-full text-left"
                          >
                            <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-border/60 transition group-hover:ring-primary/40">
                              <button
                                type="button"
                                onClick={() => void openItem(item)}
                                className="absolute inset-0 z-0 block text-left"
                                aria-label={`Open ${item.title}`}
                              >
                                <PosterImage
                                  src={
                                    item.posterPath
                                      ? tmdbPosterUrl(item.posterPath, "w342")
                                      : ""
                                  }
                                  alt=""
                                  fill
                                  placeholderGradient="from-zinc-700 to-zinc-900"
                                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                                  sizes="(max-width:640px) 42vw, 160px"
                                />
                              </button>
                              <div className="pointer-events-none absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-orange-950/85 px-1.5 py-0.5 text-[10px] font-semibold text-orange-100 ring-1 ring-orange-400/35 backdrop-blur-sm">
                                <Flame className="size-3 shrink-0 text-orange-400" />
                                {formatScheduleHype(item)}
                              </div>
                              <div className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/90">
                                {item.mediaType === "tv" ? "Show" : "Film"}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant={tracked ? "secondary" : "outline"}
                              size="sm"
                              className={cn(
                                "mt-2 flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium sm:text-[13px]",
                                tracked &&
                                  "border-violet-400/40 bg-violet-500/15 text-foreground",
                              )}
                              title={
                                tracked
                                  ? "Remove from Coming up in Your theatre"
                                  : "Save to Coming up in Your theatre"
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void toggleReleaseWatch(item);
                              }}
                            >
                              <Bookmark
                                className={cn("size-3.5 shrink-0", tracked && "fill-current")}
                                aria-hidden
                              />
                              <span className="truncate">
                                {tracked ? "Remove from Coming up" : "Save to Coming up"}
                              </span>
                            </Button>
                            <button
                              type="button"
                              onClick={() => void openItem(item)}
                              className="mt-2 w-full text-left"
                            >
                              <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                                {item.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {item.kindLabel} · ★ {item.voteAverage.toFixed(1)}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground/90">
                                {item.releaseVenueLabel}
                              </p>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
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
