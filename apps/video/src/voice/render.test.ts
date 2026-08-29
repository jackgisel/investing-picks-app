import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Script } from "@/types";

// No network and no real ffprobe binary: both ElevenLabs synthesis and
// duration measurement are mocked, so these tests exercise only the
// skip/force logic and the manifest read-modify-write cycle in render.ts.
vi.mock("./elevenlabs.js", () => ({
  synthesize: vi.fn(async () => Buffer.from("fake-mp3-bytes")),
}));
vi.mock("./duration.js", () => ({
  measureDurationSec: vi.fn(async () => 4.2),
}));

import { measureDurationSec } from "./duration.js";
import { synthesize } from "./elevenlabs.js";
import { renderVoiceover } from "./render.js";

const synthesizeMock = vi.mocked(synthesize);
const measureDurationSecMock = vi.mocked(measureDurationSec);

function makeScript(overrides?: Partial<Script>): Script {
  return {
    schemaVersion: 1,
    episodeId: "test-episode",
    title: "Test episode",
    subtitle: "A test",
    scenes: [
      {
        id: "intro",
        chapter: "the week",
        accent: "mint",
        narration: "The book fell 0.45% on the week.",
        slide: { type: "title", title: "Test episode", subtitle: "A test", periodLabel: "This week" },
      },
      {
        id: "holdings",
        chapter: "the book",
        accent: "cyan",
        narration: "Eleven open positions, six in financial services.",
        slide: { type: "holdings", heading: "Open book" },
      },
    ],
    ...overrides,
  };
}

const OPTS = {
  apiKey: "test-key",
  voiceId: "voice-123",
  model: "eleven_v3",
  outputFormat: "mp3_44100_128",
  stability: 1,
};

describe("renderVoiceover", () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), "voice-render-test-"));
    synthesizeMock.mockClear();
    measureDurationSecMock.mockClear();
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("synthesizes every scene on a first run", async () => {
    const manifest = await renderVoiceover({ script: makeScript(), outDir, opts: OPTS });

    expect(synthesizeMock).toHaveBeenCalledTimes(2);
    expect(manifest.scenes).toHaveLength(2);
    expect(manifest.scenes.map((s) => s.id)).toEqual(["intro", "holdings"]);
    expect(manifest.scenes[0]!.file).toBe("audio/scene-01-intro.mp3");
    expect(manifest.scenes[1]!.file).toBe("audio/scene-02-holdings.mp3");
    expect(manifest.totalDurationSec).toBeCloseTo(8.4);

    const onDisk = JSON.parse(await readFile(join(outDir, "audio", "manifest.json"), "utf8"));
    expect(onDisk.scenes).toHaveLength(2);
  });

  it("re-synthesizes nothing on an unchanged re-run", async () => {
    await renderVoiceover({ script: makeScript(), outDir, opts: OPTS });
    synthesizeMock.mockClear();

    const manifest = await renderVoiceover({ script: makeScript(), outDir, opts: OPTS });

    expect(synthesizeMock).not.toHaveBeenCalled();
    expect(manifest.scenes).toHaveLength(2);
  });

  it("re-synthesizes exactly the scene whose narration changed, and no others", async () => {
    await renderVoiceover({ script: makeScript(), outDir, opts: OPTS });
    synthesizeMock.mockClear();

    const editedScript = makeScript();
    editedScript.scenes[1]!.narration = "Eleven open positions, seven in financial services.";

    await renderVoiceover({ script: editedScript, outDir, opts: OPTS });

    expect(synthesizeMock).toHaveBeenCalledTimes(1);
    expect(synthesizeMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Eleven open positions, seven in financial services." }),
    );
  });

  it("does not re-synthesize when only slide content changes", async () => {
    await renderVoiceover({ script: makeScript(), outDir, opts: OPTS });
    synthesizeMock.mockClear();

    const editedScript = makeScript();
    editedScript.scenes[1]!.slide = { type: "holdings", heading: "The book today", limit: 5 };

    await renderVoiceover({ script: editedScript, outDir, opts: OPTS });

    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("--force re-synthesizes every scene even when nothing changed", async () => {
    await renderVoiceover({ script: makeScript(), outDir, opts: OPTS });
    synthesizeMock.mockClear();

    await renderVoiceover({ script: makeScript(), outDir, opts: { ...OPTS, force: true } });

    expect(synthesizeMock).toHaveBeenCalledTimes(2);
  });

  it("--force-scenes re-synthesizes only the selected scene numbers", async () => {
    await renderVoiceover({ script: makeScript(), outDir, opts: OPTS });
    synthesizeMock.mockClear();

    await renderVoiceover({
      script: makeScript(),
      outDir,
      opts: { ...OPTS, forceScenes: new Set([1]) },
    });

    expect(synthesizeMock).toHaveBeenCalledTimes(1);
    expect(synthesizeMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "The book fell 0.45% on the week." }),
    );
  });

  it("dry run calls neither synthesize nor measureDurationSec", async () => {
    await renderVoiceover({ script: makeScript(), outDir, opts: { ...OPTS, dryRun: true } });

    expect(synthesizeMock).not.toHaveBeenCalled();
    expect(measureDurationSecMock).not.toHaveBeenCalled();
  });
});
