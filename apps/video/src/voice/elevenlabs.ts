/**
 * Thin wrapper over the two ElevenLabs endpoints this pipeline needs. No SDK
 * dependency — the surface area is one POST and one GET, and a hand-rolled
 * `fetch` call keeps the retry and error-surfacing behaviour (ported from
 * `~/Youtube/Library/_tools/generate_voiceover.py`, which this package's
 * ElevenLabs usage is a straight port of) fully visible in one place.
 */

export interface SynthesizeParams {
  text: string;
  voiceId: string;
  apiKey: string;
  model: string;
  outputFormat: string;
  stability: number;
}

export interface VoiceInfo {
  id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
}

const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Synthesizes one chunk of narration into an mp3 `Buffer`.
 *
 * Retries on 429 (rate limit) and 5xx (ElevenLabs-side failure) with
 * exponential backoff, up to `MAX_ATTEMPTS` total attempts. A 4xx other than
 * 429 is not retried — it means the request itself is wrong (bad voice id,
 * bad model, malformed body) and trying again would just waste attempts — so
 * it's surfaced immediately with the response body attached, because
 * ElevenLabs puts the actual reason there ("voice_not_found", "quota
 * exceeded", etc.) and a bare status code would send the operator digging.
 */
export async function synthesize(params: SynthesizeParams): Promise<Buffer> {
  const { text, voiceId, apiKey, model, outputFormat, stability } = params;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
  const body = JSON.stringify({
    text,
    model_id: model,
    voice_settings: { stability },
  });

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body,
      });
    } catch (err) {
      // Network-level failure (DNS, connection reset, etc.) — retryable the
      // same as a 5xx, since it says nothing about whether the request itself
      // was valid.
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_ATTEMPTS) throw lastError;
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
      continue;
    }

    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) {
        throw new Error("ElevenLabs returned an empty audio response");
      }
      return buffer;
    }

    const responseText = await response.text().catch(() => "");
    const error = new Error(`ElevenLabs returned HTTP ${response.status}: ${responseText}`);

    if (!isRetryableStatus(response.status) || attempt === MAX_ATTEMPTS) {
      throw error;
    }
    lastError = error;
    await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
  }

  // Unreachable in practice — the loop above always either returns or
  // throws on its final attempt — but keeps the function's return type
  // honest for the compiler.
  throw lastError ?? new Error("ElevenLabs synthesis failed for an unknown reason");
}

/** Lists the account's available voices, for `pnpm episode voices`. */
export async function listVoices(apiKey: string): Promise<VoiceInfo[]> {
  const response = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
    headers: { "xi-api-key": apiKey },
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(`ElevenLabs returned HTTP ${response.status}: ${responseText}`);
  }

  const data = (await response.json()) as {
    voices?: Array<{
      voice_id: string;
      name: string;
      category?: string;
      labels?: Record<string, string>;
    }>;
  };

  return (data.voices ?? []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    category: voice.category ?? "unknown",
    labels: voice.labels ?? {},
  }));
}
