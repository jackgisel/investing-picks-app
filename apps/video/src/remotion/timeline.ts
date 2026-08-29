/**
 * Turns a `Script` plus an `AudioManifest` into a frame-accurate schedule.
 * Pure and framework-free on purpose (no `remotion` import here) so it is
 * unit-testable without a renderer, and so `src/cli/render.ts` can reuse it
 * to size a silent (audio-less) render identically to how `Deck.tsx` lays
 * scenes out on screen.
 *
 * Each scene gets `LEAD_IN_SEC` before its audio and `TAIL_SEC` after it
 * (`theme.ts`), so a scene never starts talking on the frame it appears or
 * cuts away on the frame the narrator stops. Scenes are laid back to back —
 * scene `i + 1` starts on the frame scene `i` ends — so there are never gaps
 * or overlaps by construction.
 */

import { LEAD_IN_SEC, TAIL_SEC } from "../theme";
import type { AudioManifest, Script } from "../types";

/** Assumed narration pace for a scene whose audio hasn't been synthesized yet. */
export const FALLBACK_WORDS_PER_MINUTE = 165;

/** No scene is shorter than this even if its narration is a single word. */
const MIN_NARRATION_SEC = 2.5;

/**
 * Estimates how long ElevenLabs would take to read `text` aloud, for
 * previewing a deck before spending characters on it (see DESIGN.md,
 * "Voice", and the `render` stage's silent-render fallback).
 */
export function estimateNarrationDurationSec(
  text: string,
  wpm: number = FALLBACK_WORDS_PER_MINUTE,
): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_NARRATION_SEC, (words / wpm) * 60);
}

export interface SceneTiming {
  sceneId: string;
  /** Whether this scene's duration came from a real `AudioManifest` entry or an estimate. */
  source: "audio" | "estimated";
  audioFile: string | null;
  audioDurationSec: number;
  startFrame: number;
  durationInFrames: number;
}

/**
 * Builds the frame schedule for every scene in `script`, in order. A scene
 * with no matching entry in `audio.scenes` falls back to an estimate from
 * its narration's word count rather than throwing — the render stage is
 * explicitly meant to be usable before `voice` has ever run (DESIGN.md's
 * "being able to preview the deck before spending ElevenLabs characters is
 * the point").
 */
export function buildTimeline(script: Script, audio: AudioManifest, fps: number): SceneTiming[] {
  const audioById = new Map(audio.scenes.map((s) => [s.id, s]));

  let cursor = 0;
  return script.scenes.map((scene): SceneTiming => {
    const match = audioById.get(scene.id);
    const audioDurationSec = match ? match.durationSec : estimateNarrationDurationSec(scene.narration);
    const totalSec = LEAD_IN_SEC + audioDurationSec + TAIL_SEC;
    const durationInFrames = Math.max(1, Math.round(totalSec * fps));

    const timing: SceneTiming = {
      sceneId: scene.id,
      source: match ? "audio" : "estimated",
      audioFile: match ? match.file : null,
      audioDurationSec,
      startFrame: cursor,
      durationInFrames,
    };
    cursor += durationInFrames;
    return timing;
  });
}

export function totalDurationInFrames(timeline: SceneTiming[]): number {
  return timeline.reduce((sum, t) => sum + t.durationInFrames, 0);
}
