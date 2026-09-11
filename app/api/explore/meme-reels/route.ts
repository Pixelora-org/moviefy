import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import type {
  MemeReelsApiResponse,
  MemeReelApiItem,
} from "@/lib/meme-reels-types";
import type { Movie } from "@/lib/types";
import { identifyMovieFromReelWithRetry } from "@/lib/identify-movie-from-reel";
import { searchTmdbMovie } from "@/lib/tmdb-movie-search";

export const runtime = "nodejs";
export const revalidate = 0;

type SampleReelData = {
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  thumbnail: string | null;
  memeTag: string;
};

/**
 * Sample meme reel data for demonstration.
 * In production, this could be replaced with actual YouTube Data API fetches.
 */
const SAMPLE_REELS: SampleReelData[] = [
  {
    videoId: "sample_1",
    videoTitle: "That Interstellar Docking Scene - Best Movie Moment Ever",
    channelTitle: "Cinema Memes",
    thumbnail: "https://img.youtube.com/vi/a3lcGnMhvsA/mqdefault.jpg",
    memeTag: "iconic",
  },
  {
    videoId: "sample_2",
    videoTitle:
      "The Dark Knight Joker 'Why So Serious?' - Legendary Performance",
    channelTitle: "Movie Clips HD",
    thumbnail: "https://img.youtube.com/vi/xnOLhXmhkyA/mqdefault.jpg",
    memeTag: "legendary",
  },
  {
    videoId: "sample_3",
    videoTitle: "Inception BRAAAAM Sound Effect Compilation",
    channelTitle: "Film Edits",
    thumbnail: "https://img.youtube.com/vi/G2jUhnCU9iA/mqdefault.jpg",
    memeTag: "sound",
  },
  {
    videoId: "sample_4",
    videoTitle: "The Matrix Red Pill Blue Pill Choice Scene Explained",
    channelTitle: "Sci-Fi Breakdowns",
    thumbnail: "https://img.youtube.com/vi/zE7PKRjrid4/mqdefault.jpg",
    memeTag: "philosophy",
  },
  {
    videoId: "sample_5",
    videoTitle: "Avengers Endgame 'I Am Iron Man' - Most Emotional MCU Moment",
    channelTitle: "Marvel Fans",
    thumbnail: "https://img.youtube.com/vi/eXcmOFDPP3c/mqdefault.jpg",
    memeTag: "emotional",
  },
];

type IdentifyResult = {
  movie: Movie | null;
  rateLimited?: boolean;
};

/**
 * Known movie franchises and titles to extract from video titles heuristically.
 * Covers the sample reels to avoid Gemini API calls for obvious cases.
 */
const KNOWN_MOVIES = [
  { patterns: ["interstellar"], title: "Interstellar", year: 2014 },
  { patterns: ["dark knight", "tdk"], title: "The Dark Knight", year: 2008 },
  { patterns: ["inception"], title: "Inception", year: 2010 },
  { patterns: ["matrix", "the matrix"], title: "The Matrix", year: 1999 },
  {
    patterns: ["avengers endgame", "endgame"],
    title: "Avengers: Endgame",
    year: 2019,
  },
];

/**
 * Try to extract a movie title from video metadata heuristically.
 * Returns { title, year } if high confidence, null otherwise.
 */
function extractMovieTitleHeuristic(reel: SampleReelData): {
  title: string;
  year?: number;
} | null {
  const text = `${reel.videoTitle} ${reel.channelTitle} ${reel.memeTag || ""}`.toLowerCase();

  for (const movie of KNOWN_MOVIES) {
    for (const pattern of movie.patterns) {
      if (text.includes(pattern)) {
        return { title: movie.title, year: movie.year };
      }
    }
  }

  return null;
}

async function identifyAndResolveMovie(
  reel: SampleReelData,
  useGemini: boolean,
): Promise<IdentifyResult> {
  try {
    // Try heuristic extraction first
    const heuristic = extractMovieTitleHeuristic(reel);
    if (heuristic) {
      const movie = await searchTmdbMovie({
        title: heuristic.title,
        year: heuristic.year,
      });
      if (movie) {
        return { movie };
      }
    }

    // Fall back to Gemini only if allowed
    if (!useGemini) {
      return { movie: null };
    }

    const result = await identifyMovieFromReelWithRetry(
      {
        videoTitle: reel.videoTitle,
        channelTitle: reel.channelTitle,
        memeTag: reel.memeTag,
      },
      3,
    );

    if (!result.success) {
      return { movie: null, rateLimited: result.rateLimited };
    }

    if (result.data.confidence === "low") {
      return { movie: null };
    }

    const movie = await searchTmdbMovie({
      title: result.data.title,
      year: result.data.year,
    });

    return { movie };
  } catch {
    return { movie: null };
  }
}

/**
 * Process reels sequentially with heuristic-first approach.
 * Only calls Gemini for reels the heuristic misses, up to a cap.
 * Returns array of successful identifications and whether rate limiting occurred.
 */
async function identifyReelsSequential(
  reels: SampleReelData[],
  hasGeminiKey: boolean,
): Promise<{ items: MemeReelApiItem[]; rateLimited: boolean }> {
  const items: MemeReelApiItem[] = [];
  let rateLimited = false;
  let geminiCallsUsed = 0;
  const MAX_GEMINI_CALLS = hasGeminiKey ? 2 : 0;

  for (const reel of reels) {
    const useGemini = geminiCallsUsed < MAX_GEMINI_CALLS;
    const result = await identifyAndResolveMovie(reel, useGemini);

    if (result.rateLimited) {
      rateLimited = true;
    }

    // Track if we actually called Gemini (heuristic miss + useGemini was true)
    if (useGemini && !extractMovieTitleHeuristic(reel)) {
      geminiCallsUsed++;
    }

    if (result.movie) {
      items.push({
        videoId: reel.videoId,
        videoTitle: reel.videoTitle,
        channelTitle: reel.channelTitle,
        thumbnail: reel.thumbnail,
        memeTag: reel.memeTag,
        movie: result.movie,
      });
    }
  }

  return { items, rateLimited };
}

/**
 * Cached function that performs the actual identification work.
 * Uses heuristic extraction first, then sequential Gemini calls (capped at 2, or 0 if no key).
 * Cache key bumped to v5 after adding heuristic-first approach to reduce Gemini quota usage.
 */
const identifyReelsCached = (hasGeminiKey: boolean) =>
  unstable_cache(
    async (): Promise<{ items: MemeReelApiItem[]; rateLimited: boolean }> => {
      return await identifyReelsSequential(SAMPLE_REELS, hasGeminiKey);
    },
    [`explore-meme-reels-v5-gemini-${hasGeminiKey}`],
    { revalidate: 3600 },
  );

export async function GET() {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const configured = {
    tmdb: Boolean(process.env.TMDB_API_KEY?.trim()),
    youtube: Boolean(
      process.env.YOUTUBE_API_KEY?.trim() ||
        process.env.YOUTUBE_DATA_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim(),
    ),
    gemini: hasGemini,
  };

  // Return early only if TMDB is missing (required for heuristic path)
  if (!configured.tmdb) {
    return NextResponse.json({
      configured,
      items: [],
      warning: "Set TMDB_API_KEY to enable meme reels movie identification.",
    } satisfies MemeReelsApiResponse);
  }

  // Run identification with or without Gemini (heuristics work without it)
  const result = await identifyReelsCached(hasGemini)();

  // Don't cache empty results - retry fresh to avoid sticky failures
  if (result.items.length === 0) {
    const freshResult = await identifyReelsSequential(SAMPLE_REELS, hasGemini);
    if (freshResult.items.length > 0) {
      // Fresh call succeeded; return it (next request will cache it)
      return NextResponse.json({
        configured,
        items: freshResult.items,
      } satisfies MemeReelsApiResponse);
    }
    // Still empty - return emptyHint without caching for next time
    const hint = freshResult.rateLimited
      ? "Gemini API rate limited. Try again shortly or upgrade your API tier."
      : "Could not identify movies from sample reels. Check API keys and try again.";

    return NextResponse.json({
      configured,
      items: [],
      emptyHint: hint,
    } satisfies MemeReelsApiResponse);
  }

  return NextResponse.json({
    configured,
    items: result.items,
  } satisfies MemeReelsApiResponse);
}
