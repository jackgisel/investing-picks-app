/**
 * A short sha256 fingerprint over exactly the inputs that change the audio
 * ElevenLabs would produce for a scene: the narration text, the voice, the
 * model, and the voice settings. Deliberately excludes everything about the
 * slide (heading, stats, chart caption, chapter, accent) — those change on a
 * purely visual edit, and if they fed the fingerprint a visual-only edit
 * would look like a narration change and re-trigger (and re-bill) synthesis
 * for a scene whose spoken words never moved. `render.ts` compares this
 * against the fingerprint recorded in the previous manifest to decide which
 * scenes actually need a new ElevenLabs request.
 */

import { createHash } from "node:crypto";

const FINGERPRINT_LENGTH = 16;

export function fingerprintScene(
  scene: { narration: string },
  voiceId: string,
  model: string,
  stability: number,
): string {
  const payload = JSON.stringify({
    narration: scene.narration,
    voiceId,
    model,
    stability,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, FINGERPRINT_LENGTH);
}
