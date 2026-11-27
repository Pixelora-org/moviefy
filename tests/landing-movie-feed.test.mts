import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchPopularLandingMovies } from "../lib/landing-movie-feed.ts";

describe("fetchPopularLandingMovies", () => {
  it("fetches TMDB popular titles and retains timed data caching", async () => {
    let requestedUrl = "";
    let revalidate: number | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      requestedUrl = input instanceof Request ? input.url : input.toString();
      revalidate = (
        init as RequestInit & { next?: { revalidate?: number } }
      ).next?.revalidate;
      return Response.json({
        results: [
          {
            id: 603,
            title: "The Matrix",
            release_date: "1999-03-31",
            vote_average: 8.2,
            vote_count: 10000,
            poster_path: "/matrix.jpg",
            overview: "A test movie",
            genre_ids: [878],
          },
        ],
      });
    };

    const movies = await fetchPopularLandingMovies("test-tmdb-key", fetcher);

    assert.equal(new URL(requestedUrl).pathname, "/3/movie/popular");
    assert.equal(new URL(requestedUrl).searchParams.get("api_key"), "test-tmdb-key");
    assert.equal(revalidate, 3600);
    assert.equal(movies[0]?.title, "The Matrix");
  });

  it("returns no movies when TMDB responds with an error", async () => {
    const fetcher: typeof fetch = async () =>
      new Response("unavailable", { status: 503 });

    assert.deepEqual(await fetchPopularLandingMovies("test-tmdb-key", fetcher), []);
  });
});
