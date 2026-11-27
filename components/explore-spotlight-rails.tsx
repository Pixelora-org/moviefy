"use client";

import { useEffect, useState } from "react";
import { Award, Clock } from "lucide-react";
import { MoviefyBrandLoader } from "@/components/moviefy-brand-loader";
import { PosterImage } from "@/components/poster-image";
import type { TmdbDiscoverItem, TmdbDiscoverResponse } from "@/lib/movie-enrich-types";
import { movieFromTmdbDiscoverItem } from "@/lib/tmdb-genre-map";
import { tmdbGenreLabels } from "@/lib/tmdb-genre-labels";
import type { Movie } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  onSelectMovie: (movie: Movie) => void;
};

export function ExploreSpotlightRails({ onSelectMovie }: Props) {
  const [awards, setAwards] = useState<TmdbDiscoverItem[]>([]);
  const [quick, setQuick] = useState<TmdbDiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/discover/special?kind=awards").then(
        (r) => r.json() as Promise<TmdbDiscoverResponse>,
      ),
      fetch("/api/discover/special?kind=under_90").then(
        (r) => r.json() as Promise<TmdbDiscoverResponse>,
      ),
    ])
      .then(([a, q]) => {
        if (cancelled) return;
        setConfigured(a.configured !== false && q.configured !== false);
        setAwards(a.results ?? []);
        setQuick(q.results ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setAwards([]);
          setQuick([]);
          setConfigured(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section
        id="explore-section-spotlights"
        className="scroll-mt-28 rounded-3xl border border-border/50 bg-card/40 px-4 py-12 text-center sm:px-6"
      >
        <MoviefyBrandLoader
          size="md"
          label="Spotlight rails are warming up — award picks and quick watches on the way."
          className="[&_p]:text-muted-foreground"
        />
      </section>
    );
  }

  if (!configured || (awards.length === 0 && quick.length === 0)) {
    return (
      <section
        id="explore-section-spotlights"
        className="scroll-mt-28 rounded-3xl border border-amber-500/20 bg-amber-950/10 px-4 py-8 text-center text-sm text-muted-foreground sm:px-6"
      >
        Spotlight picks aren&apos;t available on this server yet — check back once discovery
        is enabled.
      </section>
    );
  }

  const [hero, ...awardRest] = awards;
  const heroMovie = hero ? movieFromTmdbDiscoverItem(hero) : null;

  return (
    <section
      id="explore-section-spotlights"
      className="scroll-mt-28 space-y-10"
    >
      {hero && heroMovie ? (
        <div className="overflow-hidden rounded-[1.75rem] border border-amber-500/25 bg-gradient-to-br from-amber-950/50 via-zinc-950/80 to-zinc-950 shadow-[0_24px_80px_-40px_rgba(245,158,11,0.35)]">
          <div className="flex flex-col gap-1 border-b border-amber-500/15 px-5 pb-3 pt-5 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:pt-6">
            <div className="flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30">
                <Award className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-heading text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  Award circuit &amp; laurels
                </h2>
                <p className="text-xs text-amber-100/70 sm:text-sm">
                  Oscar, Emmy, and festival-tagged picks — then a fallback of all-time
                  standouts if TMDB tags are thin.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-stretch lg:gap-8">
            <button
              type="button"
              onClick={() => onSelectMovie(heroMovie)}
              className="group relative mx-auto w-full max-w-[260px] shrink-0 overflow-hidden rounded-2xl border border-amber-400/25 bg-zinc-950 text-left shadow-[0_20px_60px_-24px_rgba(0,0,0,0.85)] ring-1 ring-amber-500/20 transition hover:border-amber-300/40 hover:ring-amber-400/35 lg:mx-0 lg:max-w-[min(100%,320px)] lg:self-stretch"
            >
              <div className="relative aspect-[2/3] w-full">
                <PosterImage
                  src={heroMovie.posterImage}
                  alt={heroMovie.title}
                  fill
                  placeholderGradient={heroMovie.posterClass}
                  className="object-cover transition duration-700 group-hover:scale-[1.02]"
                  sizes="(max-width:1024px) 260px, 320px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                  <p className="font-heading text-xl font-semibold leading-tight text-white sm:text-2xl">
                    {heroMovie.title}
                  </p>
                  <p className="mt-1 text-sm text-amber-100/85">
                    ★ {hero.vote_average.toFixed(1)} ·{" "}
                    {hero.vote_count.toLocaleString()} votes
                  </p>
                  {tmdbGenreLabels(hero.genre_ids) ? (
                    <p className="mt-2 line-clamp-2 text-xs text-white/80">
                      {tmdbGenreLabels(hero.genre_ids)}
                    </p>
                  ) : null}
                </div>
              </div>
            </button>
            <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2 gap-2 sm:gap-3 lg:auto-rows-min lg:grid-cols-2 lg:gap-3">
              {awardRest.slice(0, 6).map((item) => {
                const m = movieFromTmdbDiscoverItem(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectMovie(m)}
                    className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-left transition hover:border-amber-400/35 hover:bg-white/[0.07]"
                  >
                    <div className="relative h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                      <PosterImage
                        src={m.posterImage}
                        alt=""
                        fill
                        placeholderGradient={m.posterClass}
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className="line-clamp-2 text-xs font-semibold leading-snug text-white">
                        {m.title}
                      </p>
                      <p className="mt-1 text-[10px] text-amber-100/65">
                        ★ {item.vote_average.toFixed(1)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {quick.length ? (
        <div className="relative overflow-hidden rounded-[1.75rem] border border-teal-500/25 bg-gradient-to-r from-teal-950/40 via-card/90 to-cyan-950/25 p-1 shadow-[var(--app-shadow-card)]">
          <div
            className="pointer-events-none absolute -right-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-teal-500/15 blur-3xl"
            aria-hidden
          />
          <div className="relative rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-5 sm:px-6 sm:py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-teal-500/20 text-teal-100 ring-1 ring-teal-400/25">
                  <Clock className="size-4" aria-hidden />
                </span>
                <div>
                  <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    90 minutes &amp; under
                  </h2>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Tight runtimes for weeknights — popularity-sorted from TMDB discover.
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-teal-500/35 bg-teal-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-100/90">
                ≤ 90 min
              </span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {quick.slice(0, 14).map((item, i) => {
                const m = movieFromTmdbDiscoverItem(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectMovie(m)}
                    className={cn(
                      "group relative w-[108px] shrink-0 overflow-hidden rounded-xl border text-left transition sm:w-[122px]",
                      i % 3 === 0
                        ? "border-teal-500/30 bg-teal-950/25 hover:border-teal-400/45"
                        : i % 3 === 1
                          ? "border-cyan-500/25 bg-cyan-950/20 hover:border-cyan-400/40"
                          : "border-border/60 bg-muted/20 hover:border-primary/35",
                    )}
                  >
                    <div className="relative aspect-[2/3] w-full bg-zinc-900">
                      <PosterImage
                        src={m.posterImage}
                        alt={m.title}
                        fill
                        placeholderGradient={m.posterClass}
                        className="object-cover transition duration-500 group-hover:scale-[1.05]"
                        sizes="122px"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-2 pt-6">
                        <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-white">
                          {m.title}
                        </p>
                        <p className="text-[9px] text-teal-100/80">
                          ★ {item.vote_average.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
