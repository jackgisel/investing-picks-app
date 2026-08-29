/**
 * Motion primitives shared by every slide. DESIGN.md, "Look": content
 * arrives on a spring, holds still while it is narrated, and cuts on the
 * scene boundary — nothing loops, nothing pulses, nothing moves while the
 * narrator is explaining it. So there is deliberately no exit animation
 * here: a scene's <Sequence> unmounting on the frame after `TAIL_SEC` is
 * the cut.
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface EnterStyle {
  opacity: number;
  transform: string;
}

/**
 * One spring-in used everywhere: a slight rise plus a fade, offset by
 * `delayFrames` so a list or table can stagger its rows (~3 frames apart per
 * DESIGN.md) by passing `index * STAGGER_FRAMES`.
 */
export function useEnter(delayFrames = 0, distancePx = 22): EnterStyle {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delayFrames);
  const progress = spring({ frame: local, fps, config: { damping: 200, mass: 0.7 } });
  return {
    opacity: progress,
    transform: `translateY(${(1 - progress) * distancePx}px)`,
  };
}

/** Frames between one staggered row/item and the next. */
export const STAGGER_FRAMES = 3;

/**
 * A 0..1 draw progress for a chart or bar, driven off the current frame
 * rather than off audio playback — the data reveal is meant to finish well
 * before the scene's tail hold, not to track narration word-for-word.
 */
export function useDrawProgress(startFrame: number, drawFrames: number): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + drawFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
