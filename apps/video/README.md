# apps/video

Renders narrated animated slide-deck videos from Outpick blog posts, using
Remotion. See `DESIGN.md` for the full design — this file is just the
mechanics of running it.

Runs locally only, on Jack's Mac. Nothing here deploys, and nothing here
publishes; the pipeline ends at an mp4 in `out/<episode-id>/`.

## Install

```bash
cd apps/video
pnpm install
cp .env.example .env.local
```

Fill in `.env.local` (see `.env.example` for the full list and comments —
this file is never checked in and this README never repeats real values):

- `ELEVENLABS_API_KEY`, `OUTPICK_ELEVENLABS_VOICE_ID` — narration. There is
  deliberately no fallback voice; `voice` fails fast rather than narrating
  in the wrong one. If `OUTPICK_ELEVENLABS_VOICE_ID` isn't chosen yet, run
  `pnpm episode voices` to list the account's voices, or listen to the
  candidates already recorded in `out/voice-samples/` (git-ignored).
- `ANTHROPIC_API_KEY` — script generation. Optional: when unset, `script`
  shells out to the local `claude` CLI instead (see PROGRESS.md).
- `OUTPICK_API_URL` — the FastAPI app (defaults to `http://localhost:8000`).
- `WEB_DATABASE_URL` — read-only access to the web app's Postgres.
- `VIDEO_PICK_EMBARGO_DAYS` — defaults to 14.
- `SITE_URL` — defaults to `https://outpick.io`.

## The five stages

```
pack   ->  pack.json     facts + post body + redaction decisions
script ->  script.json   scenes: narration + slide type + data bindings
gate   ->  (assertion)   every figure traced to the pack; nothing embargoed leaks
voice  ->  audio/*.mp3   one file per scene, content-fingerprinted
render ->  video.mp4     Remotion, 1920x1080 @ 30fps
```

`gate` isn't a separate step you have to remember to run — `script` runs it
automatically on whatever it generates and refuses to write `script.json` or
`script.md` if it fails, so a leaked draft never lands on disk in the first
place. It's also exposed as its own subcommand, for re-checking a script you
hand-edited, or an episode whose pack changed underneath it.

## The one-liner

```bash
pnpm episode make --kind=weekly-review
```

Runs `pack -> script -> gate -> voice -> render` for the most recently
published post of that kind. Every stage is resumable: rerunning the same
command is nearly instant and prints
`skipped (cached): <path>` for each stage whose artifact already exists,
because `script` spends Anthropic tokens and `voice` spends ElevenLabs
characters and this pipeline should never re-bill either by accident. A
stage that actually rebuilds forces every stage after it to rebuild too,
even if its own file is still sitting on disk — that file was built from an
input that just changed.

Useful variants:

```bash
# Preview the deck's slides and timing before spending anything on voice —
# render falls back to a silent, word-count-estimated pace per scene.
pnpm episode make --kind=weekly-review --skip-voice

# Re-render only, after tweaking a slide component — reuses the existing
# pack, script, and audio, no gate re-run, no ElevenLabs call.
pnpm episode render --episode=weekly-review-2026-w34

# See what a voice pass would cost (billable characters, no request sent).
pnpm episode voice --episode=weekly-review-2026-w34 --dry-run

# Force everything to rebuild regardless of what's cached.
pnpm episode make --kind=weekly-review --force

# Build a market-note episode from a markdown file, since this database
# has no market_note_issue rows locally (see PROGRESS.md).
pnpm episode make --kind=market-note --from-file=/path/to/note.md
```

Or run a stage on its own — every stage reads the previous stage's output
file from `out/<episode-id>/` and is safe to re-run independently:

```bash
pnpm episode pack --kind=weekly-review
pnpm episode script --episode=<id>
pnpm episode gate --episode=<id>
pnpm episode voice --episode=<id>
pnpm episode render --episode=<id>
```

`pnpm episode voices` lists the ElevenLabs account's available voices.

`make` accepts `--kind=`, `--as-of=`, `--week=`, `--from-file=`,
`--episode=`, `--skip-voice`, `--force`, `--concurrency=`, and `--quality=`;
each is forwarded to whichever stage understands it.

## How the claims gate works

Two independent hard failures, not warnings — see DESIGN.md, "The claims
gate," for the full rationale.

**Embargo.** A holding is embargoed until `VIDEO_PICK_EMBARGO_DAYS` (default
14, matching the biweekly evaluation cadence) have passed since its
`entry_date`, or until its pick note is `approved` — whichever is later. On
the current book this withholds exactly one position.

Stripping happens in `pack`, *before* the model ever sees the payload: the
ticker, the company name, and every distinctive token of that name are
stripped out of the source post's body, and the holding row is replaced with
`{ redacted: true, sector, entryDate: <month only> }`. The `Holdings` slide
renders it as "New position · held back." `gate` then re-scans the finished
narration and every on-screen string for the same embargoed ticker and name
as a second, independent check — stripping is the control, the scan is the
proof, and the two only prove anything if they agree on what counts as a
mention. Both halves call the exact same function, `embargoTerms` in
`src/lib/embargo-terms.ts` — `src/pack/redact.ts` uses it to strip,
`src/gate/leaks.ts` uses it to scan, and an agreement test in
`src/lib/embargo-terms.test.ts` exists specifically so the two rules can
never drift apart. If they ever did, a name the stripper missed could be a
name the scanner also misses, and a withheld position would reach a
rendered video with nothing having caught it.

This is the one place the video deliberately diverges from its source post:
the paywalled weekly review *does* name that week's new pick, and the video
does not. Diffing the two will make that asymmetry look like a bug — it
isn't. Different audiences, different rules.

**Evidence.** Every number the narration speaks or a slide shows must trace
back to a value in `pack.facts`, within rounding. The gate also rejects
`editorial.forbiddenPatterns` from
`~/Youtube/Library/_tools/channels/outpick.yaml`, which already encodes the
channel's editorial rules.

## Other commands

- `pnpm studio` — opens Remotion Studio against the checked-in fixtures
  (`src/__fixtures__/pack.sample.json`,
  `src/remotion/__fixtures__/script.sample.json`) for iterating on slides
  without running the pipeline or paying for anything.
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm test` — Vitest.

See `PROGRESS.md` for build history and known gaps.
