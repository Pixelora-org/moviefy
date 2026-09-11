"use client";

import { useEffect, useState } from "react";
import { Film, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { MoviefyTeaseMark } from "@/components/moviefy-brand-loader";
import { Badge } from "@/components/ui/badge";
import type { Movie } from "@/lib/types";
import type { MemeReelsApiResponse } from "@/lib/meme-reels-types";

export type MemeReelsSectionProps = {
  onOpenMovie: (_movie: Movie) => void;
  /** Anchor id for jump links (standalone page uses `reels-page-root`). */
  sectionId?: string;
};

export function MemeReelsSection({
  onOpenMovie,
  sectionId = "reels-page-root",
}: MemeReelsSectionProps) {
  const [data, setData] = useState<MemeReelsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReels() {
      try {
        const res = await fetch("/api/explore/meme-reels");
        if (!res.ok) throw new Error("Failed to fetch meme reels");
        const json = (await res.json()) as MemeReelsApiResponse;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void fetchReels();
  }, []);

  const hasReels = data && data.items.length > 0;
  const showComingSoon = !loading && (!data || !hasReels);

  return (
    <section id={sectionId} className="scroll-mt-28">
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/25 to-amber-500/20 text-amber-200 ring-1 ring-white/10">
            <Film className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="type-section-title">Meme reels</h2>
            <p className="type-section-sub mt-0 max-w-2xl">
              {hasReels
                ? "Iconic movie moments identified by AI"
                : "A reel of iconic movie moments — we're still on set, lining up the next laugh-out-loud cut."}
            </p>
          </div>
        </div>
        {!hasReels && (
          <Badge className="shrink-0 border-0 bg-amber-500/15 text-amber-100">
            <Sparkles className="mr-1 size-3" aria-hidden />
            Coming soon
          </Badge>
        )}
      </div>

      {loading && (
        <div className="app-panel flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="app-panel border-destructive/20 bg-destructive/5">
          <p className="text-sm text-destructive">Failed to load reels: {error}</p>
        </div>
      )}

      {showComingSoon && (
        <div className="app-panel overflow-hidden border-amber-500/15 bg-gradient-to-b from-amber-500/[0.07] via-card to-card p-0 sm:p-0">
          <div className="relative px-4 py-12 sm:px-8 sm:py-14">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              aria-hidden
            >
              <div className="absolute -left-20 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-rose-500/20 blur-3xl" />
              <div className="absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl" />
            </div>

            <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
              <MoviefyTeaseMark className="mb-8" />

              <p className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Something good is in the edit bay
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {data?.warning ||
                  data?.emptyHint ||
                  "Picture this reel like a scene still shooting: lights, cameras, and a few perfect memes almost ready for their close-up. When we yell \"That's a wrap!\", you'll get the first seat."}
              </p>

              <div className="mt-8 w-full max-w-md rounded-2xl border border-border/60 bg-muted/25 px-4 py-3.5 sm:px-5">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Meanwhile
                </p>
                <p className="mt-1.5 text-sm leading-snug text-foreground/90">
                  Explore any film on{" "}
                  <span className="font-medium text-primary">Explore</span> or{" "}
                  <span className="font-medium text-primary">Your theatre</span> — trailers,
                  takes, and video picks are already rolling there.
                </p>
              </div>

              <p className="mt-6 text-xs italic text-muted-foreground/90">
                Popcorn optional. Excitement included.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasReels && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((reel) => (
            <div
              key={reel.videoId}
              className="group app-panel overflow-hidden p-0 transition-all hover:shadow-lg"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted/30">
                {reel.thumbnail ? (
                  <img
                    src={reel.thumbnail}
                    alt={reel.videoTitle}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Film className="size-12 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <Badge className="absolute bottom-2 left-2 border-0 bg-black/70 text-white backdrop-blur-sm">
                  {reel.memeTag}
                </Badge>
              </div>

              <div className="p-4">
                <h3 className="mb-2 line-clamp-2 text-sm font-medium text-foreground">
                  {reel.videoTitle}
                </h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  {reel.channelTitle}
                </p>

                <div className="flex items-center gap-3 border-t border-border/40 pt-3">
                  <div className="min-w-0 flex-1">
                    {reel.movie.posterImage && (
                      <img
                        src={reel.movie.posterImage}
                        alt={reel.movie.title}
                        className="mb-2 h-16 w-auto rounded-md object-cover"
                      />
                    )}
                    <p className="text-xs font-medium text-foreground">
                      {reel.movie.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reel.movie.year} • {reel.movie.genre}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenMovie(reel.movie)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                  >
                    Open
                    <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
