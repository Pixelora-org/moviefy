import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import type {
  MemeReelsApiResponse,
  MemeReelApiItem,
} from "@/lib/meme-reels-types";
import type { Movie } from "@/lib/types";
import {
  identifyMovieFromReel,
  identifyMovieFromReelWithRetry,
} from "@/lib/identify-movie-from-reel";
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

async function identifyAndResolveMovie(
  reel: SampleReelData,
): Promise<IdentifyResult> {
  try {
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
 * Process reels sequentially to avoid Gemini free-tier rate limits.
 * Returns array of successful identifications and whether rate limiting occurred.
 */
async function identifyReelsSequential(
  reels: SampleReelData[],
): Promise<{ items: MemeReelApiItem[]; rateLimited: boolean }> {
  const items: MemeReelApiItem[] = [];
  let rateLimited = false;

  for (const reel of reels) {
    const result = await identifyAndResolveMovie(reel);

    if (result.rateLimited) {
      rateLimited = true;
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
 * Only called when both TMDB and Gemini keys are configured.
 * Uses sequential processing to avoid Gemini free-tier rate limits.
 * Cache key bumped to v3 to clear stale results from parallel/thinking issues.
 */
const identifyReelsCached = unstable_cache(
  async (): Promise<{ items: MemeReelApiItem[]; rateLimited: boolean }> => {
    return await identifyReelsSequential(SAMPLE_REELS);
  },
  ["explore-meme-reels-v3"],
  { revalidate: 3600 },
);

export async function GET() {
  const configured = {
    tmdb: Boolean(process.env.TMDB_API_KEY?.trim()),
    youtube: Boolean(
      process.env.YOUTUBE_API_KEY?.trim() ||
        process.env.YOUTUBE_DATA_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim(),
    ),
  };

  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());

  // Return early for unconfigured cases without caching
  if (!configured.tmdb) {
    return NextResponse.json({
      configured,
      items: [],
      warning: "Set TMDB_API_KEY to enable meme reels movie identification.",
    } satisfies MemeReelsApiResponse);
  }

  if (!hasGemini) {
    return NextResponse.json({
      configured,
      items: [],
      warning:
        "Set GEMINI_API_KEY to enable AI-powered movie identification for meme reels.",
    } satisfies MemeReelsApiResponse);
  }

  // Only cache when fully configured
  const result = await identifyReelsCached();

  if (result.items.length === 0) {
    const hint = result.rateLimited
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
