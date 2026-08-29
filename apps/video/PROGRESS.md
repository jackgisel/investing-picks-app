# apps/video build progress

All six chunks are built and the pipeline runs end to end —
`pack -> script -> gate -> voice -> render`. 83 tests pass (`pnpm test`) and
`pnpm typecheck` is clean. This file is now a resume point for *changes*,
not a build checklist — see DESIGN.md for the design and README.md for how
to run it. Kept per-chunk below so a future session can find which file
answers which question.

- [x] **A — scaffold.** `package.json`, `tsconfig.json`, `.gitignore`,
      `.env.example`, `src/types.ts`, `src/theme.ts`, `src/lib/paths.ts`,
      `src/lib/env.ts`, the `src/cli/index.ts` dispatcher with seven
      subcommands (`pack`, `script`, `gate`, `voice`, `render`, `make`,
      `voices`).

- [x] **B — pack + redaction.** `src/cli/pack.ts` + `src/pack/build.ts` pull
      the source post (`market_note_issue` or `insight` row) from
      `WEB_DATABASE_URL` and portfolio facts from `OUTPICK_API_URL`
      (`src/pack/sources.ts`), apply the embargo rule
      (`src/pack/redact.ts`, `src/lib/embargo-terms.ts`), and write
      `out/<id>/pack.json`. `pack` is now also the pipeline's cache anchor
      (see F below) — once `pack.json` exists for an episode it is never
      silently refreshed with live numbers short of `--force`.

- [x] **C — script + gate.** `src/script/generate.ts` prompts Claude
      (Anthropic SDK when `ANTHROPIC_API_KEY` is set, otherwise shells out to
      the `claude` CLI — see "Open questions" below) to turn a pack into
      `script.json` (narration + slide bindings), validated both ways
      through the same zod schema. `src/gate/{index,figures,leaks,phrases,
      text}.ts` traces every narrated number back to `pack.facts`, re-scans
      for embargoed tickers/names, and rejects
      `editorial.forbiddenPatterns` from
      `~/Youtube/Library/_tools/channels/outpick.yaml`. `src/cli/script.ts`
      runs the gate automatically and refuses to write `script.json` or
      `script.md` on a failure — a leaked draft on disk is a leaked draft.

  Two redaction bugs turned up while building B and C, and both are fixed
  now — noted here so neither gets re-discovered as if it were still open.
  First, `pack` was stripping embargoed names out of `pack.facts` but not out
  of the source post's `bodyMd`, which was still handed to the script model
  verbatim — the model could read the withheld name straight out of the post
  text regardless of what the structured facts said. `redactSource` in
  `src/pack/redact.ts` now runs the same stripping over the post's title,
  lede, tl;dr, body, and key takeaway before either ever reaches `generateScript`.
  Second, the strip side (`pack/redact.ts`) and the scan side (`gate/leaks.ts`)
  each started out with their own idea of what counted as a mention of an
  embargoed name, which meant they could silently disagree. The matching rule
  was pulled out into the one function both now call,
  `embargoTerms` in `src/lib/embargo-terms.ts`, with an agreement test in
  `src/lib/embargo-terms.test.ts` so the two can't drift apart again without a
  test failing.

- [x] **D — voice.** `src/voice/{elevenlabs,render,fingerprint,duration,
      opts}.ts` + `src/cli/voice.ts`: ElevenLabs `eleven_v3`, one request per
      scene, content-fingerprinted so an edited line only re-bills that
      scene. Writes `out/<id>/audio/*.mp3` and `audio/manifest.json`, with
      real per-scene duration measured via `ffprobe`
      (`src/voice/duration.ts`) rather than trusted from ElevenLabs.

- [x] **E — slides + charts.** The `Deck` Remotion composition
      (`src/remotion/Deck.tsx`, `Root.tsx`, `timeline.ts`) and the ten slide
      components under `src/remotion/slides/` (`Title`, `Stat`, `PicksChart`,
      `PeriodBars`, `Holdings`, `Sectors`, `Events`, `Bullets`, `Quote`,
      `Outro`), built on `theme.ts` and the Recharts wrappers in
      `src/remotion/charts/` with `isAnimationActive={false}`. Checked-in
      fixtures (`src/__fixtures__/pack.sample.json`,
      `src/remotion/__fixtures__/script.sample.json`) back `pnpm studio` so
      slides can be iterated on without running the pipeline.

- [x] **F — wire-up + docs.** `src/cli/render.ts` (bundles + renders `Deck`
      via `@remotion/bundler`/`@remotion/renderer`, with a silent
      word-count-estimated fallback when no `audio/manifest.json` exists)
      and `src/cli/voices.ts` (lists the ElevenLabs account's voices) were
      already real going into this chunk. This chunk implemented
      `src/cli/make.ts` — the `pack -> script -> voice -> render` one-liner —
      and corrected this file and README.md.

  `make` is resumable stage by stage: each stage is skipped, printing
  `skipped (cached): <path>`, when its artifact already exists — *unless* an
  earlier stage in the same run actually rebuilt (not a cache hit), in which
  case every stage after it reruns too, since its cached artifact was built
  from an input that just changed underneath it. `--force` starts the run
  already in that "everything reruns" state. `--skip-voice` skips `voice`
  unconditionally (not just when cached) for a free, silent preview of the
  deck's slides and timing; `render` already has a silent fallback path
  (word-count-estimated scene durations) for exactly this case, so `make`
  doesn't reimplement it.

  Verified end-to-end against a real local episode, twice: a silent pass
  first (`pnpm episode make --kind=weekly-review --skip-voice`, 6m26s of
  word-count-estimated timing, no model call, no ElevenLabs spend), then a
  fully narrated pass over the same pack and script. The narrated run —
  `weekly-review-2026-w34`, 10 scenes, 6m45s of `eleven_v3` narration,
  1920x1080 h264 — is the pipeline's first real output end to end. Rerunning
  either command against an unchanged episode reports every stage `skipped
  (cached)` and finishes in well under a second.

## Open questions / next steps

- **The ElevenLabs voice id is still unresolved.** `OUTPICK_ELEVENLABS_VOICE_ID`
  isn't set anywhere on this machine — not in `apps/video/.env.local`, not in
  `~/Youtube/Library/_tools/.env` (which holds only the API key). Five
  candidate voices are recorded at `apps/video/out/voice-samples/*.mp3`
  (git-ignored; see the README there) for the user to listen to and pick one
  by ear. The narrated episode above used `j0kZcHfSpAyvmG1dSQ5N` as a
  placeholder, passed one-off with `--voice=` rather than saved anywhere —
  that's a value that happened to work, not a decision that this is the
  channel's voice. Until `OUTPICK_ELEVENLABS_VOICE_ID` is actually set, every
  other `voice` run (and any `make` run without `--skip-voice`) fails fast
  with a message pointing here rather than silently reusing the placeholder —
  see the comment on `resolveVoiceId` in `src/cli/voice.ts`.

- **`market-note` has no source rows locally.** The prod-clone allowlist
  that seeds the local `outpick_web_dev` database copies only the `insight`
  table, so `market_note_issue` is always empty here. `pnpm episode pack
  --kind=market-note` will fail with "no sent market note found" against
  this database no matter the date. `--from-file=<markdown path>` is
  currently the only way to build a `market-note` episode on this machine —
  see `loadFromFile` in `src/pack/sources.ts`.

- **The Anthropic API path in `src/script/generate.ts` is untested.** There
  is no `ANTHROPIC_API_KEY` in `apps/video/.env.local` on this machine, so
  every `script` run so far — including the end-to-end verification above —
  has gone through `generateViaCli` (the `claude -p` shell-out), never
  `generateViaApi`. Both are validated through the same `ScriptSchema`
  before anything downstream sees the result, so this isn't a correctness
  risk, but the API path's actual behavior (prompt caching hit rate,
  `thinking: adaptive` cost/latency, `output_config.effort: "high"` quality)
  has never been observed. Worth a real run once a key is added.

- The `claude` CLI path is meaningfully slower than the API path would be —
  the verification run's `script` stage took ~128s for a 10-scene episode.
  Fine for a weekly local job; worth keeping in mind if this ever needs to
  run more than once in a sitting.
