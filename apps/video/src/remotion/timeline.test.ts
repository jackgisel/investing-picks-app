import { describe, expect, it } from "vitest";
import { LEAD_IN_SEC, TAIL_SEC } from "../theme";
import type { AudioManifest, Script } from "../types";
import { buildTimeline, estimateNarrationDurationSec, totalDurationInFrames } from "./timeline";

const FPS = 30;

function makeScript(sceneIds: string[]): Script {
  return {
    schemaVersion: 1,
    episodeId: "test-episode",
    title: "Test",
    subtitle: "Test",
    scenes: sceneIds.map((id) => ({
      id,
      chapter: "the week",
      accent: "mint",
      narration: `Narration for ${id} with a handful of words in it.`,
      slide: { type: "bullets", heading: "Heading", items: ["one", "two"] },
    })),
  };
}

function makeAudio(entries: { id: string; durationSec: number }[]): AudioManifest {
  return {
    schemaVersion: 1,
    episodeId: "test-episode",
    voiceId: "voice-1",
    model: "eleven_v3",
    scenes: entries.map((e) => ({
      id: e.id,
      file: `audio/${e.id}.mp3`,
      durationSec: e.durationSec,
      fingerprint: "fp",
      chars: 100,
    })),
    totalDurationSec: entries.reduce((sum, e) => sum + e.durationSec, 0),
  };
}

describe("buildTimeline", () => {
  it("sizes each scene as LEAD_IN + audio + TAIL, in whole frames", () => {
    const script = makeScript(["a", "b"]);
    const audio = makeAudio([
      { id: "a", durationSec: 4 },
      { id: "b", durationSec: 6 },
    ]);
    const timeline = buildTimeline(script, audio, FPS);

    expect(timeline).toHaveLength(2);
    expect(timeline[0].durationInFrames).toBe(Math.round((LEAD_IN_SEC + 4 + TAIL_SEC) * FPS));
    expect(timeline[1].durationInFrames).toBe(Math.round((LEAD_IN_SEC + 6 + TAIL_SEC) * FPS));
    for (const t of timeline) {
      expect(Number.isInteger(t.durationInFrames)).toBe(true);
      expect(Number.isInteger(t.startFrame)).toBe(true);
    }
  });

  it("lays scenes back to back with no gaps and no overlaps", () => {
    const script = makeScript(["a", "b", "c", "d"]);
    const audio = makeAudio([
      { id: "a", durationSec: 3.2 },
      { id: "b", durationSec: 5.7 },
      { id: "c", durationSec: 2.1 },
      { id: "d", durationSec: 8.4 },
    ]);
    const timeline = buildTimeline(script, audio, FPS);

    expect(timeline[0].startFrame).toBe(0);
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      expect(timeline[i].startFrame).toBe(prev.startFrame + prev.durationInFrames);
    }

    const sum = timeline.reduce((acc, t) => acc + t.durationInFrames, 0);
    expect(totalDurationInFrames(timeline)).toBe(sum);
  });

  it("falls back to a word-count estimate rather than throwing when audio is missing a scene", () => {
    const script = makeScript(["a", "b"]);
    // Only "a" has a manifest entry — "b" is missing entirely.
    const audio = makeAudio([{ id: "a", durationSec: 4 }]);

    expect(() => buildTimeline(script, audio, FPS)).not.toThrow();

    const timeline = buildTimeline(script, audio, FPS);
    expect(timeline[0].source).toBe("audio");
    expect(timeline[1].source).toBe("estimated");
    expect(timeline[1].audioFile).toBeNull();
    expect(timeline[1].audioDurationSec).toBeGreaterThan(0);
    // Still contiguous even though one scene's duration was estimated.
    expect(timeline[1].startFrame).toBe(timeline[0].startFrame + timeline[0].durationInFrames);
  });

  it("falls back gracefully when the whole audio manifest is empty (no pipeline run yet)", () => {
    const script = makeScript(["a", "b", "c"]);
    const audio = makeAudio([]);
    const timeline = buildTimeline(script, audio, FPS);

    expect(timeline).toHaveLength(3);
    expect(timeline.every((t) => t.source === "estimated")).toBe(true);
    expect(timeline.every((t) => t.durationInFrames > 0)).toBe(true);
  });
});

describe("estimateNarrationDurationSec", () => {
  it("scales roughly with word count at the given words-per-minute", () => {
    const short = estimateNarrationDurationSec("one two three four five", 150);
    const long = estimateNarrationDurationSec(Array(50).fill("word").join(" "), 150);
    expect(long).toBeGreaterThan(short);
  });

  it("never returns a duration below the sane floor, even for empty text", () => {
    expect(estimateNarrationDurationSec("", 165)).toBeGreaterThan(0);
    expect(estimateNarrationDurationSec("hi", 165)).toBeGreaterThanOrEqual(2.5);
  });
});
