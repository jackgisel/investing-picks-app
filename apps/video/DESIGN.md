# Outpick episode videos

Turns a published Outpick post into a narrated, animated slide deck.

Two recurring posts get an episode:

| Episode kind    | Source post                                   | Cadence          |
|-----------------|-----------------------------------------------|------------------|
| `market-note`   | `market_note_issue` row (the free weekly note) | Monday morning   |
| `weekly-review` | `insight` row, `post_type = 'weekly_review'`   | Friday           |

Runs on Jack's Mac only. Nothing here deploys, and nothing here publishes.

## Why a pipeline of files

Five stages, each writing one artifact into `out/<episode-id>/`. Every stage is
resumable and independently re-runnable, because the expensive ones cost real
money (ElevenLabs characters, Anthropic tokens) and the cheap one (render) is
the one you iterate on.

```
pack   ->  pack.json     facts + post body + redaction decisions
script ->  script.json   scenes: narration + slide type + data bindings
gate   ->  (assertion)   every figure traced to the pack; nothing embargoed leaks
voice  ->  audio/*.mp3   one file per scene, content-fingerprinted
render ->  video.mp4     Remotion, 1920x1080 @ 30fps
```

`pnpm episode <kind>` runs all five. Each stage is also its own subcommand.

The pack is the single source of truth downstream. Once it exists the API can be
down, the database can be gone, and the episode still renders identically. That
is deliberate: a render three weeks later must produce the same numbers it
produced on the day, or the video is not a record of anything.

## The claims gate

Two independent rules, both enforced in `gate` as hard failures rather than
warnings.

**Embargo.** A position is embargoed when its `entry_date` falls within
`VIDEO_PICK_EMBARGO_DAYS` (default 14, matching the biweekly evaluation cadence)
of the episode's as-of date, or when its pick note is not yet `approved`. The
strategy publishes one pick per evaluation and subscribers pay for it; by the
time the next one lands, the previous is fair game. Everything older is a
holding the site already shows in public, and is free to name.

Embargoed names never reach the model. `pack` strips the ticker and the company
name before `script` ever sees the payload, and replaces the row with
`{ redacted: true, sector, entryDate }` — the date truncated to `YYYY-MM`, so
the month survives and the day, which would identify the evaluation, does not.
The slide renders it as `New position · held back`. The gate then re-scans the
finished narration and every on-screen string for the embargoed ticker and
company name, and fails the build on a hit. Stripping is the control; the scan
is the proof.

Both halves ask the same question — "is this a mention?" — so both call the same
`embargoTerms()` in `src/lib/embargo-terms.ts`. They were briefly two copies of
the rule, which is worth naming here because the failure mode is quiet: if the
copies drift, the scan stops proving anything about the strip, and the proof
would still pass. `src/lib/embargo-terms.test.ts` asserts the two agree.

The source post is redacted the same way, not just the facts. `source.bodyMd` is
what the model is handed, and the published review names the new pick in prose —
so `redactSource` runs over the body, lede, title, tldr and key takeaway before
the pack is ever serialized. The prose reads awkwardly at the seams. That is the
right trade: the model is rewriting this material into narration rather than
quoting it, and an awkward sentence that is safe beats a fluent one that leaks.

Note that the source post *does* name the new pick - the weekly review is behind
the paywall, the video is not. The two surfaces have different audiences and the
redaction is the whole difference between them.

**Evidence.** Every number spoken or shown must appear in the pack. The gate
extracts numeric tokens from the narration and requires each to match a value
reachable in `pack.facts`, within rounding. It also rejects the phrase list in
`editorial.forbiddenPatterns`. Both lists come from
`~/Youtube/Library/_tools/channels/outpick.yaml`, which already encodes the
channel's editorial rules - this package mirrors them rather than reinventing
them.

## Look

The deck is the website, moving. Tokens are lifted verbatim from
`apps/web/src/styles/globals.css` (`.dark`) and from the Recharts series colors
in `apps/web/src/components/ui/picks-benchmark-chart.tsx`, so a frame of video
and a screenshot of the dashboard are the same product.

- Ground `#0A0A0A`, panels `#141414`, borders `#262626`.
- Outfit for everything that is words. IBM Plex Mono for everything that is a
  number or a ticker. Two faces, no more - the same rule the site follows.
- The eyebrow rule from `.section-label`: an 11px uppercase label with a short
  coloured bar, one accent per chapter, drawn from the site's pastels
  (mint / cyan / lilac / peach / yellow).
- Green `#22C55E` up, red `#EF4444` down, benchmarks in their site colours and
  their site dash patterns.

Motion is slide-deck, not music-video: elements arrive on a spring, hold still
while they are being read, and leave on a cut. Nothing loops, nothing pulses,
nothing moves while the narrator is explaining it.

## Charts

The site's charts are Recharts, so the deck's charts are the same Recharts
components with `isAnimationActive={false}` and the row array sliced by frame.
Animating the data rather than the SVG is what keeps the video chart and the
dashboard chart the same chart - a hand-drawn SVG lookalike drifts the first
time someone restyles the dashboard.

Slides:

| Slide            | What it shows                                              |
|------------------|------------------------------------------------------------|
| `Title`          | Episode title, period, logo                                |
| `Stat`           | One to four figures, counting up, mono numerals            |
| `PicksChart`     | Picks vs deployment-matched benchmarks, drawn left to right |
| `PeriodBars`     | Day / week / month, book against SPY                       |
| `Holdings`       | Open book, rows staggering in, redacted rows held back      |
| `Sectors`        | Sector weights, bars growing                                |
| `Events`         | Key market events from the post body                       |
| `Bullets`        | What we are watching                                       |
| `Quote`          | The key takeaway, large                                     |
| `Outro`          | Where to read the full note                                |

## Voice

ElevenLabs, `eleven_v3`, one request per scene, stitched by duration rather than
by file - the render reads each scene's real duration out of `ffprobe` and sizes
the slide to it, so narration and animation cannot drift.

Credentials come from `apps/video/.env.local`, which is git-ignored:

```
ELEVENLABS_API_KEY=...
OUTPICK_ELEVENLABS_VOICE_ID=...
```

Re-runs are content-fingerprinted per scene, so editing one line of narration
re-bills one scene rather than the episode.

## What is deliberately not here

- No upload, no YouTube API, no scheduling. The pipeline ends at an mp4.
- No dollar figures, ever - the same rule the site and the email follow. The
  pack carries percentages only, so a leaky render cannot invent one.
- No strategy parameters. Factor weights and buy thresholds are never spoken or
  shown.
