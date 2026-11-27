"use client";

import { useEffect, useState } from "react";
import { PosterImage } from "@/components/poster-image";
import type { TmdbDiscoverResponse } from "@/lib/movie-enrich-types";
import { movieFromTmdbDiscoverItem } from "@/lib/tmdb-genre-map";
import { tmdbGenreLabels } from "@/lib/tmdb-genre-labels";
import type { Movie } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ExploreMovieRailAccent = "default" | "orbit" | "signal" | "pulse";

const ACCENT_PANEL: Record<ExploreMovieRailAccent, string> = {
  default: "app-panel overflow-hidden p-3 sm:p-4",
  orbit:
    "overflow-hidden rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-950/45 via-card/95 to-sky-950/25 p-3 shadow-[0_22px_55px_-32px_rgba(139,92,246,0.38)] sm:p-4",
  signal:
    "overflow-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-r from-amber-950/40 via-card/92 to-orange-950/30 p-3 sm:p-4",
  pulse:
    "overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/35 to-card/95 p-3 ring-1 ring-emerald-500/20 sm:p-4",
};

const ACCENT_BAR: Record<ExploreMovieRailAccent, string | null> = {
  default: null,
  orbit: "bg-gradient-to-b from-violet-400 to-sky-400",
  signal: "bg-gradient-to-b from-amber-400 to-orange-500",
  pulse: "bg-gradient-to-b from-emerald-400 to-teal-500",
};

export function ExplorePosterSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "aspect-[2/3] w-[104px] shrink-0 animate-pulse rounded-xl bg-white/[0.06] sm:w-[118px]",
        className,
      )}
    />
  );
}

type ExploreMovieRailProps = {
  title: string;
  subtitle?: string;
  /** Full path including query, e.g. `/api/discover/preset?key=hidden_gems` */
  endpoint: string | null;
  onSelectMovie: (movie: Movie) => void;
  limit?: number;
  className?: string;
  /** For in-page jump navigation + scroll margin */
  sectionId?: string;
  accent?: ExploreMovieRailAccent;
};

export function ExploreMovieRail({
  title,
  subtitle,
  endpoint,
  onSelectMovie,
  limit = 14,
  className,
  sectionId,
  accent = "default",
}: ExploreMovieRailProps) {
  const [loadedEndpoint, setLoadedEndpoint] = useState<string | null>(null);
  const [items, setItems] = useState<TmdbDiscoverResponse["results"]>([]);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    if (!endpoint) return;
    const ctrl = new AbortController();
    void fetch(endpoint, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<TmdbDiscoverResponse>)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setConfigured(d.configured !== false);
        setItems(d.results ?? []);
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setItems([]);
        setConfigured(false);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadedEndpoint(endpoint);
      });
    return () => ctrl.abort();
  }, [endpoint]);

  if (!endpoint) return null;

  const slice = items.slice(0, limit);
  const loading = loadedEndpoint !== endpoint;
  const showSkeleton = loading && slice.length === 0;

  return (
    <section
      id={sectionId}
      className={cn(
        "scroll-mt-28 animate-in fade-in duration-300 fill-mode-both motion-reduce:animate-none",
        className,
      )}
    >
      <div className="mb-3.5 flex items-start gap-3">
        {ACCENT_BAR[accent] ? (
          <span
            className={cn(
              "mt-1 hidden h-8 w-1 shrink-0 rounded-full sm:block",
              ACCENT_BAR[accent],
            )}
            aria-hidden
          />
        ) : null}
        <div className="min-w-0">
          <h2 className="type-section-title">{title}</h2>
          {subtitle ? <p className="type-section-sub">{subtitle}</p> : null}
        </div>
      </div>
      <div className={ACCENT_PANEL[accent]}>
        {showSkeleton ? (
          <div className="flex gap-3 overflow-x-auto pb-1 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ExplorePosterSkeleton key={i} />
            ))}
          </div>
        ) : !configured ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            This shelf isn&apos;t available on this server yet.
          </p>
        ) : slice.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing here yet — check back later.
          </p>
        ) : (
          <div
            className={cn(
              "flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] sm:gap-4 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full",
              accent === "orbit" &&
                "[scrollbar-color:rgba(167,139,250,0.45)_transparent] [&::-webkit-scrollbar-thumb]:bg-violet-400/35",
              accent === "signal" &&
                "[scrollbar-color:rgba(251,191,36,0.45)_transparent] [&::-webkit-scrollbar-thumb]:bg-amber-400/35",
              accent === "pulse" &&
                "[scrollbar-color:rgba(52,211,153,0.45)_transparent] [&::-webkit-scrollbar-thumb]:bg-emerald-400/35",
              accent === "default" &&
                "[scrollbar-color:rgba(255,255,255,0.15)_transparent] [&::-webkit-scrollbar-thumb]:bg-white/20",
            )}
          >
            {slice.map((item) => {
              const movie = movieFromTmdbDiscoverItem(item);
              const genres = tmdbGenreLabels(item.genre_ids);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectMovie(movie)}
                  className="group relative w-[104px] shrink-0 text-left motion-safe:transition motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 sm:w-[118px]"
                >
                  <div
                    className={cn(
                      "relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 transition duration-200",
                      accent === "orbit" &&
                        "ring-violet-400/30 group-hover:ring-violet-300/55",
                      accent === "signal" &&
                        "ring-amber-400/25 group-hover:ring-amber-300/50",
                      accent === "pulse" &&
                        "ring-emerald-500/30 group-hover:ring-emerald-300/50",
                      accent === "default" &&
                        "ring-border/60 group-hover:ring-primary/45",
                    )}
                  >
                    <PosterImage
                      src={movie.posterImage}
                      alt={movie.title}
                      fill
                      placeholderGradient={movie.posterClass}
                      className="object-cover transition duration-300 group-hover:scale-[1.05]"
                      sizes="118px"
                    />
                    <div
                      className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/40 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
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
                  <p className="mt-2 line-clamp-2 text-[10px] font-medium leading-tight text-foreground/95 sm:text-[11px]">
                    {movie.title}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
