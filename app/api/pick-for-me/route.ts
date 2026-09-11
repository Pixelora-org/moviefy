import { NextRequest, NextResponse } from "next/server";
import type { TmdbDiscoverItem } from "@/lib/movie-enrich-types";
import { movieFromTmdbDiscoverItem } from "@/lib/tmdb-genre-map";
import { tmdbGenreIdFor } from "@/lib/tmdb-genre-ids";
import type { Genre } from "@/lib/types";
import { GENRES } from "@/lib/types";
import {
  eraToReleaseRange,
  isGenre,
  pickFiveDiverse,
  type PickForMeEra,
  type PickForMeRequest,
  type PickForMeVibe,
} from "@/lib/pick-for-me";

export const runtime = "nodejs";

const TMDB_KEY = process.env.TMDB_API_KEY;

type AiHints = {
  genres?: string[];
  language?: string;
  era?: string;
};

function normalizeEra(s: string | undefined): PickForMeEra {
  const e = (s ?? "any").toLowerCase();
  if (
    e === "2020s" ||
    e === "2010s" ||
    e === "2000s" ||
    e === "1990s" ||
    e === "classics" ||
    e === "any"
  ) {
    return e;
  }
  return "any";
}

function normalizeVibe(s: string | undefined): PickForMeVibe {
  const v = (s ?? "crowd").toLowerCase();
  if (v === "critics" || v === "wild" || v === "crowd") return v;
  return "crowd";
}

function safeGeminiModelId(raw: string | undefined): string {
  const d = (raw ?? "gemini-3.5-flash").trim();
  return /^[a-zA-Z0-9._-]+$/.test(d) ? d : "gemini-3.5-flash";
}

function parseAiHintsJson(text: string): AiHints | null {
  const t = text.trim();
  try {
    return JSON.parse(t) as AiHints;
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as AiHints;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Google AI Studio / Gemini API — key as `GEMINI_API_KEY`. */
async function interpretPromptWithGemini(
  body: PickForMeRequest,
): Promise<AiHints | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  const prompt = body.prompt?.trim() ?? "";
  if (!key || !prompt) return null;

  const model = safeGeminiModelId(process.env.GEMINI_PICK_MODEL);
  const uiGenres = body.genres.length ? body.genres.join(", ") : "none";
  const uiLang = body.language.trim() || "any (no filter)";
  const uiEra = body.era;
  const system = `You help TMDB movie discover. Output JSON only (no markdown).

Allowed genre names (exact spelling): ${GENRES.join(", ")}.

Fields:
- genres: subset of allowed names that match the user's wish. If the UI already selected genres, INCLUDE those same names in your array when they still fit the wish; you may ADD more from the allowed list. Never output a genre name not in the allowed list.
- language: ISO 639-1 two-letter code, or "" if not implied. Examples: en, hi, es, fr, ja, ko, zh, ta, ml.
- era: one of: any, 2020s, 2010s, 2000s, 1990s, classics — only if the wish implies a time period; otherwise "any".

The server merges your JSON with UI toggles: UI language and era win when the user already set them; genres are combined with UI selections.`;

  const userText = `Current UI filters (respect these; the user's text may refine or extend them):
- genres toggled on: ${uiGenres}
- language: ${uiLang}
- era: ${body.era}

User wish:
${prompt.slice(0, 800)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            role: "user",
            parts: [{ text: userText }],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 320,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    return parseAiHintsJson(raw);
  } catch {
    return null;
  }
}

function mergeRequestWithAi(
  body: PickForMeRequest,
  ai: AiHints | null,
): PickForMeRequest {
  if (!ai) return body;

  const aiGenres = (ai.genres ?? [])
    .map((g) => (typeof g === "string" && isGenre(g) ? g : null))
    .filter((g): g is Genre => g != null);

  const merged: Genre[] = [];
  const seen = new Set<string>();
  for (const g of [...body.genres, ...aiGenres]) {
    if (seen.has(g)) continue;
    seen.add(g);
    merged.push(g);
  }
  const genres = merged.slice(0, 4);

  const language =
    body.language.trim() !== ""
      ? body.language.trim()
      : typeof ai.language === "string"
        ? ai.language.trim().slice(0, 8)
        : "";

  const era = body.era !== "any" ? body.era : normalizeEra(ai.era);
  const vibe = body.vibe;

  return {
    genres,
    language,
    era,
    vibe,
    prompt: body.prompt,
  };
}

async function fetchDiscoverPage(
  page: number,
  params: {
    withGenresPipe: string | null;
    language: string;
    range: ReturnType<typeof eraToReleaseRange>;
    sortBy: string;
    minVotes: number;
    minRating: number;
  },
): Promise<TmdbDiscoverItem[]> {
  if (!TMDB_KEY) return [];
  const u = new URL("https://api.themoviedb.org/3/discover/movie");
  u.searchParams.set("api_key", TMDB_KEY);
  u.searchParams.set("include_adult", "false");
  u.searchParams.set("page", String(page));
  u.searchParams.set("sort_by", params.sortBy);
  u.searchParams.set("vote_count.gte", String(params.minVotes));
  u.searchParams.set("vote_average.gte", String(params.minRating));
  if (params.withGenresPipe) {
    u.searchParams.set("with_genres", params.withGenresPipe);
  }
  if (params.language) {
    u.searchParams.set("with_original_language", params.language);
  }
  if (params.range.gte) {
    u.searchParams.set("primary_release_date.gte", params.range.gte);
  }
  if (params.range.lte) {
    u.searchParams.set("primary_release_date.lte", params.range.lte);
  }

  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: TmdbDiscoverItem[] };
  return data.results ?? [];
}

export async function POST(request: NextRequest) {
  let body: PickForMeRequest;
  try {
    body = (await request.json()) as PickForMeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const genres = Array.isArray(body.genres)
    ? body.genres.filter((g): g is Genre => isGenre(String(g)))
    : [];
  const language = typeof body.language === "string" ? body.language : "";
  const era = normalizeEra(body.era);
  const vibe = normalizeVibe(body.vibe);
  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, 800) : "";

  let effective: PickForMeRequest = {
    genres,
    language,
    era,
    vibe,
    prompt,
  };

  let usedAi = false;
  if (prompt && process.env.GEMINI_API_KEY) {
    const hints = await interpretPromptWithGemini(effective);
    if (hints) {
      effective = mergeRequestWithAi(effective, hints);
      usedAi = true;
    }
  }

  if (!TMDB_KEY) {
    return NextResponse.json({
      configured: false,
      movies: [],
      usedPromptInterpretation: usedAi,
      warning: "Add TMDB_API_KEY for Pick-for-me.",
    });
  }

  const range = eraToReleaseRange(effective.era);
  const withGenresPipe =
    effective.genres.length > 0
      ? effective.genres.map((g) => tmdbGenreIdFor(g)).join("|")
      : null;

  const minVotes = effective.vibe === "critics" ? 500 : 200;
  const minRating = effective.vibe === "critics" ? 6.8 : 5.5;
  const sortBy =
    effective.vibe === "critics"
      ? "vote_average.desc"
      : effective.vibe === "wild"
        ? "popularity.desc"
        : "popularity.desc";

  const pagesToFetch =
    effective.vibe === "wild"
      ? [1, 2, Math.floor(Math.random() * 4) + 2]
      : [1, 2];

  const merged = new Map<number, TmdbDiscoverItem>();
  for (const p of pagesToFetch) {
    const rows = await fetchDiscoverPage(p, {
      withGenresPipe,
      language: effective.language,
      range,
      sortBy,
      minVotes,
      minRating,
    });
    for (const r of rows) merged.set(r.id, r);
  }

  let pool = [...merged.values()];
  if (pool.length < 8 && !withGenresPipe) {
    const extra = await fetchDiscoverPage(3, {
      withGenresPipe: null,
      language: effective.language,
      range,
      sortBy,
      minVotes: 100,
      minRating: 5.2,
    });
    for (const r of extra) merged.set(r.id, r);
    pool = [...merged.values()];
  }

  if (pool.length < 8 && withGenresPipe) {
    const extra = await fetchDiscoverPage(2, {
      withGenresPipe,
      language: "",
      range,
      sortBy,
      minVotes: Math.max(80, minVotes - 80),
      minRating: 5.2,
    });
    for (const r of extra) merged.set(r.id, r);
    pool = [...merged.values()];
  }

  if (effective.genres.length > 0) {
    const wanted = new Set(effective.genres.map((g) => tmdbGenreIdFor(g)));
    pool = pool.filter((m) =>
      (m.genre_ids ?? []).some((id) => wanted.has(id)),
    );
  }

  const five = pickFiveDiverse(pool, effective.vibe);
  const movies = five.map((item) =>
    movieFromTmdbDiscoverItem(item, effective.genres),
  );

  return NextResponse.json({
    configured: true,
    movies,
    usedPromptInterpretation: usedAi,
    effective: {
      genres: effective.genres,
      language: effective.language || null,
      era: effective.era,
      vibe: effective.vibe,
    },
    warning:
      movies.length < 5
        ? "Few matches for these filters — try broader genres or Any language."
        : undefined,
  });
}
