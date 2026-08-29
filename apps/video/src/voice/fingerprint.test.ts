import { describe, expect, it } from "vitest";

import { fingerprintScene } from "./fingerprint.js";

describe("fingerprintScene", () => {
  it("is stable across repeated calls with the same inputs", () => {
    const scene = { narration: "The book fell 0.45% on the week." };
    const a = fingerprintScene(scene, "voice-1", "eleven_v3", 1);
    const b = fingerprintScene(scene, "voice-1", "eleven_v3", 1);
    expect(a).toBe(b);
  });

  it("changes when the narration text changes", () => {
    const a = fingerprintScene({ narration: "The book fell 0.45% on the week." }, "voice-1", "eleven_v3", 1);
    const b = fingerprintScene({ narration: "The book rose 0.45% on the week." }, "voice-1", "eleven_v3", 1);
    expect(a).not.toBe(b);
  });

  it("changes when the voice id changes", () => {
    const scene = { narration: "Eleven open positions this week." };
    const a = fingerprintScene(scene, "voice-1", "eleven_v3", 1);
    const b = fingerprintScene(scene, "voice-2", "eleven_v3", 1);
    expect(a).not.toBe(b);
  });

  it("changes when the model changes", () => {
    const scene = { narration: "Eleven open positions this week." };
    const a = fingerprintScene(scene, "voice-1", "eleven_v3", 1);
    const b = fingerprintScene(scene, "voice-1", "eleven_multilingual_v2", 1);
    expect(a).not.toBe(b);
  });

  it("changes when stability changes", () => {
    const scene = { narration: "Eleven open positions this week." };
    const a = fingerprintScene(scene, "voice-1", "eleven_v3", 1);
    const b = fingerprintScene(scene, "voice-1", "eleven_v3", 0.5);
    expect(a).not.toBe(b);
  });

  it("does NOT change when unrelated slide content changes", () => {
    // Two scenes with identical narration but different slide specs (as if
    // the same line of narration were re-bound from a `stat` slide to a
    // `bullets` slide, or a heading/caption were edited) must fingerprint
    // identically — slide content is not part of the fingerprint's inputs,
    // by design, so a purely visual edit never re-bills ElevenLabs.
    const narration = "Six of eleven positions sit in financial services.";
    const sceneA = {
      narration,
      slide: { type: "stat", heading: "Sector mix", stats: [{ label: "Financials", value: "6" }] },
    };
    const sceneB = {
      narration,
      slide: { type: "bullets", heading: "What changed", items: ["More concentration in financials"] },
    };
    const a = fingerprintScene(sceneA, "voice-1", "eleven_v3", 1);
    const b = fingerprintScene(sceneB, "voice-1", "eleven_v3", 1);
    expect(a).toBe(b);
  });

  it("produces a short hex string", () => {
    const fp = fingerprintScene({ narration: "hi" }, "voice-1", "eleven_v3", 1);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });
});
