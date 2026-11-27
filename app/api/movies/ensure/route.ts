import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkAuthActive } from "@/lib/clerk/auth-mode";
import { readLimitedJson } from "@/lib/http/read-limited-json";
import { genreFromTmdbIds } from "@/lib/tmdb-genre-map";
import { consumeApiRateLimit } from "@/lib/supabase/api-rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TMDB_KEY = process.env.TMDB_API_KEY?.trim();

type TmdbDetails = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  genres?: { id: number }[];
  credits?: { crew?: { job: string; name: string }[] };
  created_by?: { name: string }[];
};

export async function POST(request: Request) {
  if (!isClerkAuthActive()) {
    return NextResponse.json(
      { error: "Authentication is not configured for this service." },
      { status: 503 },
    );
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const token = await getToken({ template: "supabase" });
  if (!token) {
    return NextResponse.json(
      { error: "Supabase authentication is not configured." },
      { status: 503 },
    );
  }
  const allowed = await consumeApiRateLimit(token, "movie_catalog");
  if (allowed === null) {
    return NextResponse.json(
      { error: "Could not verify request limits." },
      { status: 503 },
    );
  }
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many movie requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const parsed = await readLimitedJson(request, 1024);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.reason === "too_large" ? "Request too large." : "Invalid JSON." },
      { status: parsed.reason === "too_large" ? 413 : 400 },
    );
  }
  if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return NextResponse.json({ error: "Invalid movie request." }, { status: 400 });
  }

  const body = parsed.value as { tmdbId?: unknown; mediaType?: unknown };
  const tmdbId = Number(body.tmdbId);
  const mediaType =
    body.mediaType === "tv" ? "tv" : body.mediaType === "movie" || body.mediaType == null
      ? "movie"
      : null;
  if (!Number.isSafeInteger(tmdbId) || tmdbId < 1 || !mediaType) {
    return NextResponse.json({ error: "Invalid movie identifier." }, { status: 400 });
  }
  if (!TMDB_KEY) {
    return NextResponse.json(
      { error: "Movie catalog is not configured." },
      { status: 503 },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Movie catalog writes are not configured." },
      { status: 503 },
    );
  }

  const { data: existing, error: existingError } = await admin
    .from("movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
    .maybeSingle();
  if (existingError) {
    console.error("[movies/ensure] Catalog lookup failed:", existingError);
    return NextResponse.json({ error: "Could not load movie." }, { status: 500 });
  }
  if (existing?.id) return NextResponse.json({ id: existing.id });

  const detailsUrl = new URL(
    `https://api.themoviedb.org/3/${mediaType}/${tmdbId}`,
  );
  detailsUrl.searchParams.set("api_key", TMDB_KEY);
  detailsUrl.searchParams.set("append_to_response", "credits");
  const detailsResponse = await fetch(detailsUrl, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!detailsResponse.ok) {
    return NextResponse.json(
      { error: "Could not verify this title with TMDB." },
      { status: 502 },
    );
  }

  const details = (await detailsResponse.json()) as TmdbDetails;
  const title = (details.title ?? details.name)?.trim();
  if (!title || details.id !== tmdbId) {
    return NextResponse.json({ error: "TMDB returned an invalid title." }, { status: 502 });
  }
  const releaseDate = details.release_date ?? details.first_air_date ?? "";
  const director =
    details.credits?.crew?.find((person) => person.job === "Director")?.name ??
    details.created_by?.[0]?.name ??
    "—";

  const { data: inserted, error: insertError } = await admin
    .from("movies")
    .insert({
      tmdb_id: tmdbId,
      media_type: mediaType,
      title,
      year: Number(releaseDate.slice(0, 4)) || 0,
      genre: genreFromTmdbIds(details.genres?.map((genre) => genre.id)),
      director,
      poster_path: details.poster_path ?? null,
      poster_class: "from-zinc-700 to-zinc-900",
    })
    .select("id")
    .single();

  if (insertError?.code === "23505") {
    const { data: raced, error: raceError } = await admin
      .from("movies")
      .select("id")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();
    if (!raceError && raced?.id) return NextResponse.json({ id: raced.id });
  }
  if (insertError || !inserted?.id) {
    console.error("[movies/ensure] Catalog insert failed:", insertError);
    return NextResponse.json({ error: "Could not save movie." }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id });
}
