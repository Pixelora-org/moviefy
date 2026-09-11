import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import type {
  MemeReelsApiResponse,
  MemeReelApiItem,
} from "@/lib/meme-reels-types";
import type { Movie } from "@/lib/types";
import { identifyMovieFromReel } from "@/lib/identify-movie-from-reel";
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
    thumbnail:
      "https://img.youtube.com/vi/a3lcGnMhvsA/mqdefault.jpg",
    memeTag: "iconic",
  },
  {
    videoId: "sample_2",
    videoTitle: "The Dark Knight Joker 'Why So Serious?' - Legendary Performance",
    channelTitle: "Movie Clips HD",
    thumbnail:
      "https://img.youtube.com/vi/xnOLhXmhkyA/mqdefault.jpg",
    memeTag: "legendary",
  },
  {
    videoId: "sample_3",
    videoTitle: "Inception BRAAAAM Sound Effect Compilation",
    channelTitle: "Film Edits",
    thumbnail:
      "https://img.youtube.com/vi/G2jUhnCU9iA/mqdefault.jpg",
    memeTag: "sound",
  },
  {
    videoId: "sample_4",
    videoTitle: "The Matrix Red Pill Blue Pill Choice Scene Explained",
    channelTitle: "Sci-Fi Breakdowns",
    thumbnail:
      "https://img.youtube.com/vi/zE7PKRjrid4/mqdefault.jpg",
    memeTag: "philosophy",
  },
  {
    videoId: "sample_5",
    videoTitle: "Avengers Endgame 'I Am Iron Man' - Most Emotional MCU Moment",
    channelTitle: "Marvel Fans",
    thumbnail:
      "https://img.youtube.com/vi/eXcmOFDPP3c/mqdefault.jpg",
    memeTag: "emotional",
  },
];

async function identifyAndResolveMovie(
  reel: SampleReelData,
): Promise<Movie | null> {
  try {
    const identification = await identifyMovieFromReel({
      videoTitle: reel.videoTitle,
      channelTitle: reel.channelTitle,
      memeTag: reel.memeTag,
    });

    if (!identification) return null;

    if (identification.confidence === "low") {
      return null;
    }

    const movie = await searchTmdbMovie({
      title: identification.title,
      year: identification.year,
    });

    return movie;
  } catch {
    return null;
  }
}

const getMemeReels = unstable_cache(
  async (): Promise<MemeReelsApiResponse> => {
    const configured = {
      tmdb: Boolean(process.env.TMDB_API_KEY?.trim()),
      youtube: Boolean(
        process.env.YOUTUBE_API_KEY?.trim() ||
          process.env.YOUTUBE_DATA_API_KEY?.trim() ||
          process.env.GOOGLE_API_KEY?.trim(),
      ),
    };

    if (!configured.tmdb) {
      return {
        configured,
        items: [],
        warning: "Set TMDB_API_KEY to enable meme reels movie identification.",
      };
    }

    const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());

    if (!hasGemini) {
      return {
        configured,
        items: [],
        warning:
          "Set GEMINI_API_KEY to enable AI-powered movie identification for meme reels.",
      };
    }

    const identificationResults = await Promise.all(
      SAMPLE_REELS.map((reel) => identifyAndResolveMovie(reel)),
    );

    const items: MemeReelApiItem[] = [];

    for (let i = 0; i < SAMPLE_REELS.length; i++) {
      const reel = SAMPLE_REELS[i];
      const movie = identificationResults[i];

      if (movie) {
        items.push({
          videoId: reel.videoId,
          videoTitle: reel.videoTitle,
          channelTitle: reel.channelTitle,
          thumbnail: reel.thumbnail,
          memeTag: reel.memeTag,
          movie,
        });
      }
    }

    if (items.length === 0) {
      return {
        configured,
        items: [],
        emptyHint:
          "Could not identify movies from sample reels. Check API keys and try again.",
      };
    }

    return {
      configured,
      items,
    };
  },
  ["explore-meme-reels-v1"],
  { revalidate: 3600 },
);

export async function GET() {
  const body = await getMemeReels();
  return NextResponse.json(body);
}
