"use client";

import { useEffect, useState } from "react";
import { PosterImage } from "@/components/poster-image";
import type { StreamingHighlightRail } from "@/lib/explore-streaming-types";
import { movieFromTmdbDiscoverItem } from "@/lib/tmdb-genre-map";
import type { Movie } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Props = {
  onSelectMovie: (movie: Movie) => void;
};

const ACCENT: Record<
  StreamingHighlightRail["accent"],
  { bar: string; chip: string; glow: string }
> = {
  netflix: {
    bar: "from-red-600/90 to-red-900/50",
    chip: "bg-red-600/20 text-red-100 ring-red-500/25",
    glow: "shadow-[0_0_40px_-8px_rgba(220,38,38,0.35)]",
  },
  prime: {
    bar: "from-sky-500/90 to-sky-950/50",
    chip: "bg-sky-600/20 text-sky-100 ring-sky-500/25",
    glow: "shadow-[0_0_40px_-8px_rgba(14,165,233,0.3)]",
  },
  hulu: {
    bar: "from-emerald-500/90 to-emerald-950/50",
    chip: "bg-emerald-600/20 text-emerald-100 ring-emerald-500/25",
    glow: "shadow-[0_0_40px_-8px_rgba(16,185,129,0.28)]",
  },
  disney: {
    bar: "from-indigo-400/90 to-indigo-950/50",
    chip: "bg-indigo-600/25 text-indigo-100 ring-indigo-400/25",
    glow: "shadow-[0_0_40px_-8px_rgba(129,140,248,0.3)]",
  },
};

function RailHeader({
  label,
  accent,
}: {
  label: string;
  accent: StreamingHighlightRail["accent"];
}) {
  const a = ACCENT[accent];
  return (
    <div className="mb-3 flex items-center gap-3">
      <span
        className={cn(
          "h-9 w-1.5 shrink-0 rounded-full bg-gradient-to-b",
          a.bar,
        )}
      />
      <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        {label}
      </h3>
    </div>
  );
}

function CarouselRail({
  rail,
  onSelectMovie,
  sectionId,
}: {
  rail: StreamingHighlightRail;
  onSelectMovie: (m: Movie) => void;
  sectionId?: string;
}) {
  const a = ACCENT[rail.accent];
  return (
    <div
      id={sectionId}
      className={cn(
        "scroll-mt-28 rounded-2xl border border-border/70 bg-card/90 p-3 shadow-[var(--app-shadow-card)] sm:p-4",
        a.glow,
      )}
    >
      <RailHeader label={rail.label} accent={rail.accent} />
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rail.results.map((item) => {
          const movie = movieFromTmdbDiscoverItem(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectMovie(movie)}
              className="group w-[108px] shrink-0 text-left sm:w-[118px]"
            >
              <div
                className={cn(
                  "relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition group-hover:ring-white/25",
                )}
              >
                <PosterImage
                  src={movie.posterImage}
                  alt={movie.title}
                  fill
                  placeholderGradient={movie.posterClass}
                  className="object-cover transition group-hover:scale-[1.03]"
                  sizes="118px"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-snug text-foreground">
                {movie.title}
              </p>
              <p className="text-[10px] text-muted-foreground">
                ★ {item.vote_average.toFixed(1)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HeroSplitRail({
  rail,
  onSelectMovie,
  sectionId,
}: {
  rail: StreamingHighlightRail;
  onSelectMovie: (m: Movie) => void;
  sectionId?: string;
}) {
  const a = ACCENT[rail.accent];
  const [first, ...rest] = rail.results;
  if (!first) return null;
  const hero = movieFromTmdbDiscoverItem(first);
  const side = rest.slice(0, 4);
  return (
    <div
      id={sectionId}
      className="scroll-mt-28 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--app-shadow-card)] sm:p-5"
    >
      <RailHeader label={rail.label} accent={rail.accent} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <button
          type="button"
          onClick={() => onSelectMovie(hero)}
          className={cn(
            "group relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-muted/25 text-left ring-1 ring-border/40 transition hover:border-border",
            a.glow,
          )}
        >
          <div className="relative aspect-[16/10] w-full sm:aspect-[2.2/1] lg:aspect-auto lg:min-h-[220px] lg:w-[52%]">
            <PosterImage
              src={hero.posterImage}
              alt={hero.title}
              fill
              placeholderGradient={hero.posterClass}
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
              sizes="(max-width:1024px) 100vw, 380px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-black/25 lg:to-black/80" />
          </div>
          <div className="flex flex-1 flex-col justify-end p-4 lg:justify-center lg:py-6 lg:pl-2 lg:pr-6">
            <span
              className={cn(
                "mb-2 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                a.chip,
              )}
            >
              Featured pick
            </span>
            <p className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {hero.title}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              ★ {first.vote_average.toFixed(1)} · {first.vote_count.toLocaleString()}{" "}
              votes
            </p>
          </div>
        </button>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3 lg:w-[240px] lg:grid-cols-1 xl:w-[260px]">
          {side.map((item) => {
            const movie = movieFromTmdbDiscoverItem(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectMovie(movie)}
                className="group flex gap-2 rounded-xl border border-border/50 bg-muted/20 p-2 text-left transition hover:border-border/80 hover:bg-muted/35"
              >
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                  <PosterImage
                    src={movie.posterImage}
                    alt=""
                    fill
                    placeholderGradient={movie.posterClass}
                    className="object-cover"
                    sizes="44px"
                  />
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                    {movie.title}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    ★ {item.vote_average.toFixed(1)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TightStripRail({
  rail,
  onSelectMovie,
  sectionId,
}: {
  rail: StreamingHighlightRail;
  onSelectMovie: (m: Movie) => void;
  sectionId?: string;
}) {
  return (
    <div
      id={sectionId}
      className="scroll-mt-28 rounded-2xl border border-dashed border-border/60 bg-muted/15 px-3 py-4 sm:px-5"
    >
      <RailHeader label={rail.label} accent={rail.accent} />
      <div className="flex gap-2 overflow-x-auto pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rail.results.map((item) => {
          const movie = movieFromTmdbDiscoverItem(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectMovie(movie)}
              className="group flex w-[200px] shrink-0 gap-2.5 rounded-xl border border-border/50 bg-muted/20 p-2 text-left transition hover:bg-muted/35 sm:w-[220px]"
            >
              <div className="relative h-[5.25rem] w-[3.5rem] shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                <PosterImage
                  src={movie.posterImage}
                  alt=""
                  fill
                  placeholderGradient={movie.posterClass}
                  className="object-cover"
                  sizes="56px"
                />
              </div>
              <div className="min-w-0 flex-1 py-1">
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                  {movie.title}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {movie.year || "—"} · ★ {item.vote_average.toFixed(1)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PosterGridRail({
  rail,
  onSelectMovie,
  sectionId,
}: {
  rail: StreamingHighlightRail;
  onSelectMovie: (m: Movie) => void;
  sectionId?: string;
}) {
  const slice = rail.results.slice(0, 8);
  return (
    <div
      id={sectionId}
      className="scroll-mt-28 rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card/90 to-muted/20 p-4 shadow-[var(--app-shadow-card)] sm:p-6"
    >
      <RailHeader label={rail.label} accent={rail.accent} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {slice.map((item) => {
          const movie = movieFromTmdbDiscoverItem(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectMovie(movie)}
              className="group text-left"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition group-hover:ring-white/30">
                <PosterImage
                  src={movie.posterImage}
                  alt={movie.title}
                  fill
                  placeholderGradient={movie.posterClass}
                  className="object-cover transition group-hover:scale-[1.02]"
                  sizes="(max-width:768px) 45vw, 160px"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] font-medium text-foreground">
                {movie.title}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ExploreStreamingRails({ onSelectMovie }: Props) {
  const [rails, setRails] = useState<StreamingHighlightRail[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/explore/streaming-highlights")
      .then((r) => r.json() as Promise<{ rails?: StreamingHighlightRail[] }>)
      .then((d) => {
        if (!cancelled) setRails(d.rails ?? []);
      })
      .catch(() => {
        if (!cancelled) setRails([]);
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
      <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-4 py-10 text-sm text-muted-foreground shadow-[var(--app-shadow-card)]">
        <Loader2 className="size-5 animate-spin" />
        Loading streaming charts…
      </div>
    );
  }

  if (!rails?.length) {
    return (
      <p className="rounded-2xl border border-border/70 bg-card/80 px-4 py-8 text-center text-sm text-muted-foreground shadow-[var(--app-shadow-card)]">
        Add TMDB_API_KEY to show Netflix, Prime, Hulu, and Disney+ highlights.
      </p>
    );
  }

  return (
    <div id="explore-section-streaming" className="scroll-mt-28 space-y-12">
      {rails.map((rail, i) => {
        if (!rail.results.length) return null;
        const variant = i % 4;
        const sectionId = `explore-stream-${rail.id}`;
        if (variant === 0) {
          return (
            <CarouselRail
              key={rail.id}
              rail={rail}
              sectionId={sectionId}
              onSelectMovie={onSelectMovie}
            />
          );
        }
        if (variant === 1) {
          return (
            <HeroSplitRail
              key={rail.id}
              rail={rail}
              sectionId={sectionId}
              onSelectMovie={onSelectMovie}
            />
          );
        }
        if (variant === 2) {
          return (
            <TightStripRail
              key={rail.id}
              rail={rail}
              sectionId={sectionId}
              onSelectMovie={onSelectMovie}
            />
          );
        }
        return (
          <PosterGridRail
            key={rail.id}
            rail={rail}
            sectionId={sectionId}
            onSelectMovie={onSelectMovie}
          />
        );
      })}
    </div>
  );
}
