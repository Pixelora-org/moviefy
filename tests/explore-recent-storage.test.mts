import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseExploreRecentStorageSnapshot } from "../lib/explore-recent-storage.ts";

describe("parseExploreRecentStorageSnapshot", () => {
  it("returns valid recent movies newest first", () => {
    const snapshot = JSON.stringify([
      {
        id: "tmdb-1",
        title: "Older title",
        year: 2001,
        genre: "Drama",
        posterClass: "from-zinc-700 to-zinc-900",
        posterImage: "/older.jpg",
        tmdbId: 1,
        openedAt: 10,
      },
      {
        id: "tmdb-2",
        title: "Newer title",
        year: 2002,
        genre: "Comedy",
        posterClass: "from-zinc-700 to-zinc-900",
        posterImage: "/newer.jpg",
        tmdbId: 2,
        openedAt: 20,
      },
      { title: "Missing id", openedAt: 30 },
    ]);

    const recent = parseExploreRecentStorageSnapshot(snapshot);

    assert.deepEqual(
      recent.map(({ movie, openedAtMs }) => [movie.title, openedAtMs]),
      [
        ["Newer title", 20],
        ["Older title", 10],
      ],
    );
    assert.equal(recent[0]?.movie.director, "—");
  });

  it("returns an empty list for malformed or non-array snapshots", () => {
    assert.deepEqual(parseExploreRecentStorageSnapshot("{"), []);
    assert.deepEqual(
      parseExploreRecentStorageSnapshot(JSON.stringify({ title: "Not a list" })),
      [],
    );
  });
});
