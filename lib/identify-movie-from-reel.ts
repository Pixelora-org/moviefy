/**
 * Server-only: Identifies which movie a meme reel is about using Gemini LLM.
 * Reuses the Gemini API integration pattern from pick-for-me.
 */

export type ReelMovieIdentification = {
  title: string;
  year?: number;
  confidence: "high" | "medium" | "low";
  reasoning?: string;
};

type GeminiMovieIdentification = {
  title: string;
  year?: number;
  confidence?: string;
  reasoning?: string;
};

function parseGeminiJson(text: string): GeminiMovieIdentification | null {
  const t = text.trim();
  try {
    return JSON.parse(t) as GeminiMovieIdentification;
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as GeminiMovieIdentification;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeConfidence(
  conf: string | undefined,
): "high" | "medium" | "low" {
  const c = (conf ?? "medium").toLowerCase();
  if (c === "high" || c === "medium" || c === "low") return c;
  return "medium";
}

function safeGeminiModelId(raw: string | undefined): string {
  const d = (raw ?? "gemini-3.5-flash").trim();
  return /^[a-zA-Z0-9._-]+$/.test(d) ? d : "gemini-3.5-flash";
}

/**
 * Calls Gemini to identify which movie a reel is about.
 * Returns null if API key is missing or call fails.
 */
export async function identifyMovieFromReel(params: {
  videoTitle: string;
  channelTitle: string;
  memeTag?: string;
}): Promise<ReelMovieIdentification | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const model = safeGeminiModelId(process.env.GEMINI_PICK_MODEL);

  const system = `You are a movie identification expert. Given metadata about a YouTube video (title, channel, optional meme tag), identify which movie it is about or referencing.

Output JSON only (no markdown) with these fields:
- title: The movie title (string, required)
- year: Release year (number, optional if uncertain)
- confidence: "high", "medium", or "low" based on how certain you are
- reasoning: Brief explanation of why you identified this movie (optional, 1-2 sentences)

Rules:
- If the video title or metadata clearly mentions a movie name, extract it
- Consider movie memes, quotes, scenes, or references in the context
- Be conservative: if you're unsure, mark confidence as "low" or "medium"
- Output valid JSON only`;

  const userText = `Video Title: ${params.videoTitle.slice(0, 200)}
Channel: ${params.channelTitle.slice(0, 100)}${params.memeTag ? `\nMeme Tag: ${params.memeTag}` : ""}

Identify the movie this video is about.`;

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
          temperature: 0.2,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      console.error(
        `[identifyMovieFromReel] Gemini API failed: ${res.status} ${res.statusText}`,
      );
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;

    const parsed = parseGeminiJson(raw);
    if (!parsed || !parsed.title) return null;

    return {
      title: parsed.title.trim(),
      year: typeof parsed.year === "number" ? parsed.year : undefined,
      confidence: normalizeConfidence(parsed.confidence),
      reasoning: parsed.reasoning?.trim(),
    };
  } catch {
    return null;
  }
}
