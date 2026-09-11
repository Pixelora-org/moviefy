"use client";

import { useCallback, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { PosterImage } from "@/components/poster-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PICK_FOR_ME_ERAS,
  PICK_FOR_ME_ERA_LABEL,
  PICK_FOR_ME_LANGUAGES,
  PICK_FOR_ME_VIBES,
  PICK_FOR_ME_VIBE_LABEL,
  type PickForMeEra,
  type PickForMeVibe,
} from "@/lib/pick-for-me";
import { GENRES, type Genre, type Movie } from "@/lib/types";

type ApiResponse = {
  configured?: boolean;
  movies?: Movie[];
  usedPromptInterpretation?: boolean;
  usedFallback?: boolean;
  warning?: string;
  effective?: {
    genres: Genre[];
    language: string | null;
    era: PickForMeEra;
    vibe: PickForMeVibe;
  };
};

export type PickForMePanelProps = {
  onPickMovie: (movie: Movie) => void;
};

/** Base UI Select disallows empty `value`; map to state `""` for the API. */
const LANGUAGE_SELECT_ANY = "__any__";

function languageTriggerLabel(selectValue: unknown): string {
  if (selectValue === LANGUAGE_SELECT_ANY || selectValue == null || selectValue === "") {
    return "Any language";
  }
  const code = String(selectValue);
  return PICK_FOR_ME_LANGUAGES.find((o) => o.code === code)?.label ?? code;
}

export function PickForMePanel({ onPickMovie }: PickForMePanelProps) {
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [language, setLanguage] = useState("");
  const [era, setEra] = useState<PickForMeEra>("any");
  const [vibe, setVibe] = useState<PickForMeVibe>("crowd");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Movie[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  const toggleGenre = useCallback((g: Genre) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }, []);

  const runPick = useCallback(async () => {
    setLoading(true);
    setHint(null);
    try {
      const res = await fetch("/api/pick-for-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genres: selectedGenres,
          language,
          era,
          vibe,
          prompt: prompt.trim() || undefined,
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) {
        setResults([]);
        setHint("Could not load picks. Try again.");
        return;
      }
      setResults(data.movies ?? []);
      setUsedAi(Boolean(data.usedPromptInterpretation));
      setUsedFallback(Boolean(data.usedFallback));
      if (data.warning) setHint(data.warning);
      else if (!(data.movies?.length)) {
        setHint(
          data.configured === false
            ? "The film catalogue isn't connected on this server yet."
            : "No titles matched — loosen genres or language.",
        );
      }
    } catch {
      setResults([]);
      setHint("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }, [era, language, prompt, selectedGenres, vibe]);

  return (
    <section
      id="explore-section-pick-for-me"
      className="relative scroll-mt-28 rounded-[1.75rem] border border-violet-400/25 bg-gradient-to-br from-violet-950/35 via-background/95 to-fuchsia-950/25 p-5 shadow-[var(--app-shadow-card)] sm:p-7"
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem] opacity-90"
        aria-hidden
      >
        <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-violet-500/12 blur-3xl" />
      </div>

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-600/20 text-violet-200 ring-1 ring-white/10">
                <Wand2 className="size-5" aria-hidden />
              </div>
              <div>
                <h2 className="type-section-title">Pick for me</h2>
                <p className="type-section-sub mt-0 max-w-xl">
                  Five picks from TMDB.
                </p>
              </div>
            </div>
          </div>
          {usedAi ? (
            <Badge
              className={cn(
                "shrink-0 border-0 text-violet-100",
                usedFallback
                  ? "bg-amber-500/30"
                  : "bg-violet-500/25",
              )}
            >
              <Sparkles className="mr-1 size-3" />
              {usedFallback
                ? "Used keyword hints"
                : "Used Gemini text hints"}
            </Badge>
          ) : null}
        </div>

        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="min-w-0 space-y-5">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Genres (optional — tap several for OR mix)
              </p>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => {
                  const on = selectedGenres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      className={cn(
                        "min-h-10 rounded-full border px-3.5 py-2 text-xs font-medium transition",
                        on
                          ? "border-violet-400/60 bg-violet-500/20 text-foreground shadow-[0_0_24px_-10px_rgba(139,92,246,0.9)]"
                          : "border-border/60 bg-muted/25 text-muted-foreground hover:border-border hover:bg-muted/45 hover:text-foreground",
                      )}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Language
                </label>
                <Select
                  value={language || LANGUAGE_SELECT_ANY}
                  onValueChange={(v) =>
                    setLanguage(
                      v == null || v === LANGUAGE_SELECT_ANY ? "" : v,
                    )
                  }
                >
                  <SelectTrigger className="h-10 w-full border-border/60 bg-background/50">
                    <SelectValue placeholder="Any language">
                      {(v) => languageTriggerLabel(v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PICK_FOR_ME_LANGUAGES.map((o) => (
                      <SelectItem
                        key={o.code || LANGUAGE_SELECT_ANY}
                        value={o.code || LANGUAGE_SELECT_ANY}
                      >
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Era
                </label>
                <Select
                  value={era}
                  onValueChange={(v) => setEra(v as PickForMeEra)}
                >
                  <SelectTrigger className="h-10 w-full border-border/60 bg-background/50">
                    <SelectValue>
                      {(v) =>
                        PICK_FOR_ME_ERA_LABEL[v as PickForMeEra] ??
                        (v != null ? String(v) : "")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PICK_FOR_ME_ERAS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {PICK_FOR_ME_ERA_LABEL[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Curve
                </label>
                <Select
                  value={vibe}
                  onValueChange={(v) => setVibe(v as PickForMeVibe)}
                >
                  <SelectTrigger className="h-10 w-full border-border/60 bg-background/50">
                    <SelectValue>
                      {(v) =>
                        PICK_FOR_ME_VIBE_LABEL[v as PickForMeVibe] ??
                        (v != null ? String(v) : "")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PICK_FOR_ME_VIBES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {PICK_FOR_ME_VIBE_LABEL[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label
                htmlFor="pick-for-me-prompt"
                className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                <Sparkles className="size-3 text-violet-300" aria-hidden />
                Describe it (optional)
              </label>
              <textarea
                id="pick-for-me-prompt"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='e.g. "slow-burn thriller in Hindi" or "feel-good 90s comedy"'
                className="w-full resize-y rounded-xl border border-border/60 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus-visible:border-violet-400/50 focus-visible:ring-2 focus-visible:ring-violet-500/25"
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Dropdowns win over the note when both apply.
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              disabled={loading}
              onClick={() => void runPick()}
              className="h-11 w-full gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:from-violet-500 hover:to-fuchsia-500 sm:w-auto sm:min-w-[12rem]"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="size-4" aria-hidden />
              )}
              {loading ? "Searching…" : "Give me 5 picks"}
            </Button>
          </div>

          <div className="min-w-0 max-w-full rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Your shortlist
            </p>
            {results.length === 0 && !loading ? (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Results land here — five posters you can open into full detail and save to your
                theatre.
              </p>
            ) : null}
            {loading ? (
              <div className="mt-6 flex min-w-0 gap-3 overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-44 w-28 shrink-0 animate-pulse rounded-xl bg-white/5"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 flex min-w-0 touch-pan-x gap-3 overflow-x-auto overflow-y-visible overscroll-x-contain pb-1 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onPickMovie(m)}
                    className="group w-[7.25rem] shrink-0 text-left transition hover:opacity-95 active:scale-[0.98]"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition group-hover:ring-violet-400/40">
                      <PosterImage
                        src={m.posterImage}
                        alt={m.title}
                        fill
                        placeholderGradient={m.posterClass}
                        className="object-cover"
                        sizes="116px"
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-snug text-foreground">
                      {m.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.year || "—"} · {m.genre}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {hint ? (
              <p className="mt-3 text-xs text-amber-200/90">{hint}</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
