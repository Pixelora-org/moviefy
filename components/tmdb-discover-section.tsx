"use client";

import { useEffect, useState } from "react";
import { PosterImage } from "@/components/poster-image";
import type { TmdbDiscoverResponse } from "@/lib/movie-enrich-types";
import { movieFromTmdbDiscoverItem } from "@/lib/tmdb-genre-map";
import type { Movie } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MoviefyBrandLoader } from "@/components/moviefy-brand-loader";

const SORT_OPTIONS = [
  { value: "vote_average.desc", label: "Highest rated" },
  { value: "popularity.desc", label: "Most popular" },
  { value: "primary_release_date.desc", label: "Newest releases" },
] as const;

type Props = {
  selectedMovieId: string | null;
  onSelectMovie: (movie: Movie) => void;
  sectionId?: string;
};

export function TmdbDiscoverSection({
  selectedMovieId,
  onSelectMovie,
  sectionId = "explore-section-editor-picks",
}: Props) {
  const [sort, setSort] =
    useState<(typeof SORT_OPTIONS)[number]["value"]>("vote_average.desc");
  const [minVotes, setMinVotes] = useState("250");
  const [data, setData] = useState<TmdbDiscoverResponse | null>(null);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const queryKey = `${sort}:${minVotes}`;
  const loading = loadedQuery !== queryKey;

  useEffect(() => {
    const controller = new AbortController();
    const votes = Number(minVotes) || 250;
    fetch(
      `/api/discover/top?sort=${encodeURIComponent(sort)}&minVotes=${votes}`,
      { signal: controller.signal },
    )
      .then((res) => res.json() as Promise<TmdbDiscoverResponse>)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setData({
          configured: false,
          sort,
          results: [],
          page: 1,
          warning: "Request failed",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedQuery(queryKey);
      });
    return () => controller.abort();
  }, [sort, minVotes, queryKey]);

  return (
    <section id={sectionId} className="scroll-mt-28">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-xl">TMDB top picks</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Sort
            </Label>
            <Select
              value={sort}
              onValueChange={(v) => {
                const next = SORT_OPTIONS.find((o) => o.value === v)?.value;
                if (next) setSort(next);
              }}
            >
              <SelectTrigger className="h-8 w-[200px] border-white/10 bg-[#252525] text-xs">
                <SelectValue>
                  {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Min votes
            </Label>
            <Select
              value={minVotes}
              onValueChange={(v) => {
                if (v === "100" || v === "250" || v === "500" || v === "1000") {
                  setMinVotes(v);
                }
              }}
            >
              <SelectTrigger className="h-8 w-[120px] border-white/10 bg-[#252525] text-xs">
                <SelectValue>{`${minVotes}+`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100+</SelectItem>
                <SelectItem value="250">250+</SelectItem>
                <SelectItem value="500">500+</SelectItem>
                <SelectItem value="1000">1000+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-10">
          <MoviefyBrandLoader
            size="md"
            label="Finding standout picks for this shelf…"
            className="text-white/60 [&_p]:text-white/50"
          />
        </div>
      ) : !data?.configured ? (
        <div className="rounded-lg border border-white/10 bg-[#1f1f1f] px-4 py-6 text-sm text-muted-foreground">
          {data?.warning ??
            "Discovery isn’t available on this server right now — check back after it’s configured."}
        </div>
      ) : (
        <>
          {data.warning ? (
            <p className="mb-3 text-xs text-amber-200/90">{data.warning}</p>
          ) : null}
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {data.results.slice(0, 14).map((item) => {
              const movie = movieFromTmdbDiscoverItem(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectMovie(movie)}
                  className={cn(
                    "w-[120px] shrink-0 snap-start text-left transition hover:opacity-95",
                    selectedMovieId === movie.id &&
                      "ring-2 ring-primary/50 ring-offset-2 ring-offset-[#151515]",
                  )}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800">
                    <PosterImage
                      src={movie.posterImage}
                      alt={movie.title}
                      fill
                      placeholderGradient={movie.posterClass}
                      className="object-cover"
                      sizes="120px"
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-tight">
                    {movie.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    ★ {item.vote_average.toFixed(1)} · {item.vote_count} votes
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
