# Agent-trust rearchitecture plan

Plan only. No application code was changed for this document. Method: Lauren Tan / @poteto “trust your agents” pyramid: make the bad pattern impossible in the codebase first, then static analysis, then a little prose, then human review.

Repo: [jackgisel/investing-picks-app](https://github.com/jackgisel/investing-picks-app). Snapshot: `main` at `4f65e66` (2026-10-16), 125 PRs (120 merged, 5 closed unmerged), 0 GitHub issues, no Slack.

---

## Top 5 changes to do first

Plain language for a non-specialist owner.

1. **Stop blog posts fighting over one shared art list.** Most agent work right now is SEO posts. Each post has to edit the same two files (`art-pool.ts` and its test) to “claim” a cover image, so two posts in flight always collide, even when they pick different pictures. A follow-up agent was needed just to unstick PR #124. Fix: each cover claim is its own tiny file, and tests stop pinning “the next unused cover is spare-27.” Parallel blog agents then only conflict if they actually grab the same picture.

2. **Make GitHub build the website the same way production does.** CI today runs unit tests and a few scripts. It does not run `next build`. That is why #110/#109 merged and then production died, and why #111 and #112 were same-day hotfixes. A missing import, a missing blog sub-category, or a tool that talks to the wrong database should fail the pull request, not Railway.

3. **Lock the stock-picking rules so agents cannot quietly retune them.** The live engine is supposed to buy exactly one name per evaluation, live in `packages/strategy`, and ignore a stored “full snapshot” of an old version. Agents have already shipped the opposite: a params row that pinned the live book to run118 after run119 deployed (#105), rejected one-knob experiments with no evidence (#33, #34), then a later run119 that was a different design (#104). Fix: the “buy one” cap raises if anything else is passed in; stored JSON can only hold real overrides, not a copy of the whole model; renaming `RUN118_PARAMS` so docs and code agree.

4. **Put marks, splits, and evaluation behind one door.** The stock-split bug (#118) was a 75% paper loss because a post-split quote was applied to a pre-split share count. The fix exists, but a new job can still call `refresh_marks` or `score_universe` without running splits first (the weekly refresh still scores before restating bars). One pipeline object that cannot mark or trade until splits have been applied makes that class of bug unwritable.

5. **Make the numbers on the marketing site come from a recorded run.** Landing-page figures in `constants.ts` (`+250.39%`, Sharpe `1.14`, …) still describe a configuration the live engine replaced. Agents copy those constants onto new pages. Wire the public claims to the committed baseline (or a clearly labelled “historical, not this engine” object) so a drift fails CI the way `test-constants.mjs` already fails a mismatched winners-circle count.

Do these five before writing more `AGENTS.md`. The current notes are already correct and already ignored when the easy path is a shared file or a skipped build.

---

## How Jack actually pushes back

Formal GitHub review comments are almost absent. Every PR is authored as `jackgisel` (cloud agents commit as the owner), so there is no reviewer identity. There are **0 issues**. Slack does not exist.

What exists instead, and what it says he cares about:

| Signal | What it shows |
|---|---|
| One human PR comment, [#66](https://github.com/jackgisel/investing-picks-app/pull/66#issuecomment-5917270354): “7-12 need unique colors” | Spare art must be visually distinct. Agents then shipped `f1d6da8` (unique inks) and tests that assert unique hex values. |
| Closed unmerged PRs | [#33](https://github.com/jackgisel/investing-picks-app/pull/33) run119 valuation-gate experiment, **null decision-diff, not merging**. [#34](https://github.com/jackgisel/investing-picks-app/pull/34) run120 QR floor, cursor[bot]: “Reject criterion 1… Not merging.” [#51](https://github.com/jackgisel/investing-picks-app/pull/51) backing out unrelated complimentary-grant work swept into the copy audit (build-breaking import of a file that was never committed). [#21](https://github.com/jackgisel/investing-picks-app/pull/21) ISR stale prerender (the fix landed on main as `c6d007e` another way). [#86](https://github.com/jackgisel/investing-picks-app/pull/86) was superseded by a retarget, not a taste reject. |
| Same-day hotfix PRs after agent merges | [#111](https://github.com/jackgisel/investing-picks-app/pull/111) (missing blog sub-category, production `next build` failed; commit body: “CI does not run next build”). [#112](https://github.com/jackgisel/investing-picks-app/pull/112) (challenge/calculator looked at the web DB, not the API). [#96](https://github.com/jackgisel/investing-picks-app/pull/96) (worker import crash). |
| Follow-up commits that undo or complete agent work | `462e43c` back out complimentary-grant from the copy audit. `e6cb75e` drop an invented em dash. `8cefb5e` fix spare-pool unique-ink assertion after claiming spare-21. Two-commit split fix: `7e6a44a` then `53eded4` (“gate every evaluation, fail closed on bad FMP shape”). |
| Standing rules he keeps restating | `AGENTS.md` / `STRATEGY_CHANGELOG.md`: no Alpaca, do not duplicate `evaluate()`, `max_adds_per_evaluation=1`, version bump must include golden + baseline + changelog. Copy: no em/en dashes, no “firm”, do not lead with AI (`marketing-copy.test.ts`, `HOUSE_WRITING_RULES`). Honest published numbers (`docs/BUG_REPORT.md`, `test_published_numbers_audit.py`). |
| Recurring “put the Google tag back in `<head>`” | [#36](https://github.com/jackgisel/investing-picks-app/pull/36) adds conversion tracking → `3e2b0de` puts gtag in head → [#55](https://github.com/jackgisel/investing-picks-app/pull/55) takes it off first paint for LCP → [#76](https://github.com/jackgisel/investing-picks-app/pull/76) puts it back so Google can verify. Agents optimize LCP by moving a tag Google requires in head. |

Themes, in his words and actions: **fail closed, one concern per PR, do not ship a strategy change without a decision-diff, do not mix in-progress modules into unrelated PRs, published numbers must be the number on screen, covers must be unique, production build is the real test.**

---

## Pitfall catalog (with evidence)

Counts are from git history and the GitHub PR list on 2026-10-16. “Agent-authored” here means Cursor/cloud branches (`cursor/…`), `Co-authored-by: Cursor/Claude`, or commit authors `Cursor Agent` / `cursor[bot]`. A large share of `jackgisel` commits are the same agents.

### P1. Shared art-pool bookkeeping (highest frequency)

**What happens.** `SPARE_CLAIMED` in `apps/web/src/lib/art-pool.ts` is a single dict. `nextSpareCover()` walks it. `art-pool.test.ts` pins `nextSpareCover() === spare-27` and lists every claimed spare. Every new post updates both files.

**Evidence.**

- `art-pool.ts`: **31 commits**; `art-pool.test.ts`: **30**; `blog.ts`: **32**. These are 2nd–4th hottest files in the repo (after `ops.py`).
- **26** of **43** posts are in `SPARE_CLAIMED`. The other 15 older posts have covers under `/art/covers/{slug}.png` and never entered the dict, so the dict is not even a complete registry.
- Blog-ish PRs: **29 / 125**. Sequential claims: #54 spare-04, #59 spare-05, #61 spare-06, #65/#66 spare-07 (merge from main to pick up the pool), then #67–#125 almost all touch the same two files.
- Jack on [#66](https://github.com/jackgisel/investing-picks-app/pull/66): unique colors. Tests later encoded a growing exception list (`spare.id !== "spare-07" && …`) that every claim PR must edit.
- Cloud agent [Resolve PR #124 conflicts](https://cursor.com/agents/bc-65dab753-38e6-5176-bbaa-2f8f8795e4ca) on the postmortem post while #123/#125 were in flight.
- `8cefb5e` “Fix spare-pool unique-ink assertion after claiming spare-21”.

**Why comments cannot fix it.** Two agents both read `nextSpareCover()` from `main`, both claim `spare-27`, and even when they claim *different* spares they still merge-conflict on the same dict and the same pinned test.

### P2. Manual blog registry + missing sub-category

**What happens.** Adding a post means: new `content/blog/<slug>.tsx`, import + array entry in `blog.ts`, claim a spare, copy a PNG. Drop any step and production breaks. `subcategory` is a plain `string`.

**Evidence.**

- [#111](https://github.com/jackgisel/investing-picks-app/pull/111) / `2eb480a`: “#109 and an earlier post landed without a subcategory, so next build failed… **CI does not run next build**.”
- `blog.ts` has a circular import: every post `import type { Article } from "@/lib/blog"` while `blog.ts` imports every post. That blocks glob-style discovery without a type split.
- Near-duplicate slugs agents re-create: `when-to-sell-a-stock` vs `when-to-sell-a-stock-thesis-broken`; two newsletter posts; two membership-worth-it posts.

### P3. CI does not run the production web build

**What happens.** `.github/workflows/test.yml` web job runs `pnpm check` = vitest + four node scripts. No `tsc`, no `next lint`, no `next build`.

**Evidence.**

- #111 (misfiled posts), #112 (prod lookups), #51/#50 (import of uncommitted `lib/complimentary-grant`), Railway as the first typechecker.
- `blog.test.ts` exists *because* of this gap (comments in that file say so).
- Prototype confirmed the workflow file contains none of `next build` / `tsc` / `next lint`.

### P4. Stock-split position math

**What happens.** A split changes the quote, not the value of the holding. Marks written in post-split dollars against a pre-split share count read as a ~75% loss; sell rules then fire on a phantom drawdown. Unadjusted bars fabricate ±3x momentum.

**Evidence.**

- [#118](https://github.com/jackgisel/investing-picks-app/pull/118) ([`fix/stock-splits`](https://github.com/jackgisel/investing-picks-app/tree/fix/stock-splits)): 12 files, +1068 lines, two commits (`7e6a44a`, then `53eded4` “gate every evaluation, fail closed on bad FMP shape”).
- `run_evaluation` now raises `SplitReviewPending` for every caller (daily, biweekly, ops). Daily marks skip the sell pass when `hold_sells`.
- Remaining hole: `job_weekly_refresh` still calls `score_universe` *before* `refresh_marks` / `restate_price_bars`. A new agent job can call `refresh_marks` directly. Worker ingest still has two writers that historically disagreed on `adjClose` vs `close` (`docs/BUG_REPORT.md` BUG-W7/W8).

### P5. Stored params snapshot pins the live book to a dead version

**What happens.** `ensure_default_portfolio` used to write a full `RUN118_PARAMS.to_dict()` into `params_json`. After run119 shipped, the public API still reported run118 and kept run118’s sector-cap basis.

**Evidence.** [#105](https://github.com/jackgisel/investing-picks-app/pull/105) / `a89166e`. `params_from_portfolio` now treats the row as overrides and ignores `version_label`. Tests in `test_params_json_overrides.py`. The type is still “any JSON object.” Agents can write a full snapshot again.

### P6. Strategy experiments without a decision-diff; then a name collision

**What happens.** Agents treat `version_label` as a sticker and change one knob.

**Evidence.**

- [#33](https://github.com/jackgisel/investing-picks-app/pull/33) closed: valuation C- → D, **null decision-diff**.
- [#34](https://github.com/jackgisel/investing-picks-app/pull/34) closed: QR 4.0 → 3.5, binding gate was revisions, not QR.
- [#104](https://github.com/jackgisel/investing-picks-app/pull/104) later shipped a *different* run119 (funded book, max-loss stop, drop cash management). The rejected label was reused. `RUN118_PARAMS` is now an alias of run119 defaults (`params.py:250-254`). `AGENTS.md` and `CLAUDE.md` still say “Run 118”. `README.md` says run119.

### P7. Fail-open on missing / malformed data

**What happens.** `x or 0`, `.get(key, 0)`, truthiness on `None`. Gates disappear; the ledger still says they passed.

**Evidence.** `docs/BUG_REPORT.md` (opened 2026-07-27) and the follow-up commits:

| ID | Class | Status |
|---|---|---|
| S6 | Unknown `min_grade` → F’s rank → every name passes | Fixed in `grades.py` (fail closed + log) |
| S8 | `initial_investment` truthiness skips winners-circle trim | Documented; executor backfills engine buys, hand-seeded rows still risky |
| S3/S1 | Trim + full sell double-count sim_cash | Executor clamps; planner still over-counts |
| W3 | NULL sector drops a ticker with no trace | Partial fix (`294252e` market_cap was incomplete) |
| W6 | Missing price skips the $5 floor | Open in the audit |
| W7/W8 | `adjClose` present-and-null; two price-bar writers | Open; split-adjacent |
| P3 | Z-floor dead because caller omitted the arg | Later fixed live in #41 / `3dc05e3` |
| A4 | Unknown P&L published as 0.00% | Tests now; agents still coerce null → 0 |
| A8 | Evaluation not idempotent | Guard added in `run_evaluation`; `extra_buy.py` is the explicit side door |

### P8. Published-number drift

**What happens.** Marketing constants, API fields, and dashboard tiles disagree. Agents copy whichever they see.

**Evidence.**

- `BACKTEST` in `apps/web/src/lib/constants.ts`: `+250.39%` / Sharpe `1.14` / max DD `-27.38%` over Jun 2022–Apr 2026. `docs/BUG_REPORT.md` BUG-P1/P2: those figures describe the configuration Run 118 *replaced*. The committed `backtests/baselines/run119.json` is a 3-Friday tape (FIX, GOOG, LLY), not a 3.8-year path.
- [#2](https://github.com/jackgisel/investing-picks-app/pull/2) annualize the return the homepage actually displays.
- [#23](https://github.com/jackgisel/investing-picks-app/pull/23) stop publishing a trim and a sell for the same name.
- `test-constants.mjs` already exists because `yearsCovered` and `winnersCircle` had drifted once. It does not check the headline return against any recorded run.
- QQQ comparison series: [#6](https://github.com/jackgisel/investing-picks-app/pull/6), [#8](https://github.com/jackgisel/investing-picks-app/pull/8), [#9](https://github.com/jackgisel/investing-picks-app/pull/9), [#10](https://github.com/jackgisel/investing-picks-app/pull/10) — three follow-ups to “stop publishing Nasdaq-100 without QQQ history.”

### P9. Unrelated work swept into a PR; missing modules

**Evidence.** [#50](https://github.com/jackgisel/investing-picks-app/pull/50) copy audit imported in-progress complimentary-grant code that was never committed. Production build failed. [#51](https://github.com/jackgisel/investing-picks-app/pull/51) closed; `462e43c` backed it out; the real grant landed as [#52](https://github.com/jackgisel/investing-picks-app/pull/52). `tsc` / `next build` in CI would have caught it.

### P10. House copy rules not applied to the blog

**What happens.** Marketing pages are checked for em/en dashes. Blog posts are not.

**Evidence.** Prototype: **29 / 43** blog files contain em or en dashes (**326** characters). `draft-blog.mjs` and `HOUSE_WRITING_RULES` already ban them. `e6cb75e` had to drop an invented em dash from an FAQ. Agents writing posts by hand skip the draft script and skip the lint.

### P11. Google Ads tag vs LCP

**Evidence.** Cycle listed under “How Jack pushes back.” `GoogleAdsScript` is currently imported from `layout.tsx`. Nothing stops the next performance agent from moving it again.

### P12. Stale agent memory in the repo

**What happens.** Agents imitate what they open.

**Evidence.**

- `.claude/.../memory/user_profile.md`: still “Convex” and “Paddle”. The app is Postgres + Stripe.
- Bundled Convex skills under `.claude/skills/`, `.agents/skills/`, `skills/` (create-component, migration-helper, performance-audit, quickstart, setup-auth). Unused. They teach the wrong backend.
- `AGENTS.md` / `CLAUDE.md`: “Run 118” while `version_label` is `run119`.
- `evaluate_friday` in `apps/worker/worker/backtest/factor_ic.py` sits next to the real `evaluate()` naming.

### P13. Side doors around `max_adds_per_evaluation=1`

**Evidence.** The default is 1 and `test_version_bump.py` asserts it. `with_overrides(max_adds_per_evaluation=2)` still works at runtime (dataclass `int`). `extra_buy.py` is the intentional ops side door and records the failed `max_adds` rule. Agents who do not find it will raise the cap. Prototype: a frozen dataclass `__post_init__` that raises on `!= 1` works, and **no current test** uses `with_overrides` on that field.

---

## Prototype results (scratch branch, not for merge)

Run on `cursor/agent-trust-plan-5fde`. No application code kept.

| Question | Answer |
|---|---|
| Can parallel blog PRs avoid `art-pool.ts`? | **Yes.** Put `apps/web/src/content/art-claims/spare-NN.json = {"slug":"…"}`. Different spares = different files = no merge conflict. Same spare = conflict on that one file (the conflict you actually want). Cover path stays `/art/covers/{slug}.png`. Derive `SPARE_CLAIMED` / `nextSpareCover()` from the claims directory. Stop pinning `next === spare-27` in tests; assert bijection, unique inks, file exists. **Do not MOVE pool files** to claim them: two agents deleting the same `spare-27.png` merge cleanly and silently share art. |
| Can `blog.ts` auto-discover posts? | **Yes, after splitting types.** Today every post imports `Article` from `blog.ts` while `blog.ts` imports every post (cycle). Move types to `src/lib/article.ts`. Next.js has no `import.meta.glob`; `require.context` breaks vitest. A 20-line `scripts/generate-blog-index.mjs` run from `pnpm check` that writes static imports is the path that matches the bundler. `layout.tsx` already imports `{ articles }` for nav, so the list must stay static. |
| Can `max_adds_per_evaluation` be un-overridable? | **Yes.** Frozen dataclass `__post_init__` raises. Also drop the key from `params_from_portfolio`’s known fields so JSON cannot set it. Keep `extra_buy.py` as the only second-pick path. |
| Can the dash lint cover the blog today? | **Not without a cleanup.** 29 files / 326 dashes would go red. Mechanical replace + lint in one PR, or lint second. |
| Does CI already run worker tests? | **Yes**, they live under `apps/api/tests/` (`test_splits.py`, `test_worker_ingest.py`, …). The gap is the web *build*, not Python coverage. |
| Is `import.meta.glob` available? | **No.** Codegen, not Vite-style globs. |

---

## Prioritized work (pyramid order)

Size: **S** = one tight PR, local. **M** = a few files / one subsystem. **L** = rename or pipeline reshape, still mechanical.

### Layer 1 — Codebase (make the wrong path unwritable)

Do these first. Each row names the pitfall it kills.

| # | Change | Kills | Size | Notes |
|---|---|---|---|---|
| 1.1 | Per-spare claim files + derive pool state; rewrite `art-pool.test.ts` to invariants (unique inks, 1:1 slug, file exists, `nextSpareCover` is “any unclaimed”, not a pinned id) | P1 | M | Highest leverage for the actual agent workload. Keep unique-ink assertion (Jack’s only review comment). |
| 1.2 | Split `Article` / `ArticleMeta` into `article.ts`; generate `blog.generated.ts` from `content/blog/*.tsx`; `pnpm check` fails if the generated file is stale | P2 | M | Adding a file in `content/blog/` becomes sufficient (plus a claim file + cover PNG). |
| 1.3 | `subcategory` becomes a union generated from `blog-taxonomy.json` (the draft script already has this enum). Pair type: `filing` as `` `${Category}/${slug}` `` | P2, #111 | S | `filingErrors` stays as the runtime/build guard. |
| 1.4 | `StrategyParams.__post_init__`: `max_adds_per_evaluation != 1` raises. Remove that key from `params_from_portfolio`. Rename `RUN118_PARAMS` → `DEFAULT_PARAMS` only (keep a deprecated alias for one version if needed) | P6, P13 | S | Alias already exists; the name is what agents copy into AGENTS.md. |
| 1.5 | `ParamsOverrides` TypedDict / pydantic model: only live knobs (`position_size_usd`, research switches). `ensure_default_portfolio` already writes `{}` — make the column type match. Reject unknown keys. | P5 | S | Extends #105. |
| 1.6 | One `BookSession` (or `DailyTape`) in the worker: `check_splits` → restated bars → marks → scores → optional `run_evaluation`. `refresh_marks` / `score_universe` are not public job entry points. Weekly refresh must not score on unrestated bars. | P4 | M | Evaluation already gates on `SplitReviewPending`. Close the back door. |
| 1.7 | Single price-bar writer; `adjClose` null falls through to `close`; fail the job if FMP split JSON lacks the fields `parse_split_rows` reads (already in #118 for splits; extend to EOD) | P4, W7/W8 | M | |
| 1.8 | `BACKTEST` marketing object is loaded from a committed artifact, or renamed `HISTORICAL_CLAIM` and forbidden on pages that talk about the live book. `test-constants.mjs` diffs headline figures against that artifact. | P8 | M | Product decision: keep the 250% claim as labelled history, or stop publishing it. Do not leave a silent mismatch. |
| 1.9 | `GoogleAdsScript` lives only in `app/layout.tsx` `<head>`. Delete any alternate mount. | P11 | S | |
| 1.10 | Delete unused Convex skill trees and rewrite `user_profile.md` (Stripe, Postgres, BetterAuth, virtual book). | P12 | S | Codebase-as-memory. Agents will otherwise scaffold Convex. |
| 1.11 | Null-safe money helpers: `unknown_pnl` is `None`, never `0`. Ban `x or 0` on prices/grades in strategy + API via the typed helpers, not a style note. | P7, A4 | M | Same class as S6/W6. |
| 1.12 | Blog `slug` uniqueness plus a “too-similar slug” check (prefix / token overlap) against existing posts | P2 duplicates | S | Would have flagged the second when-to-sell and the second newsletter post. |

### Layer 2 — Static analysis (make CI red)

| # | Change | Kills | Size |
|---|---|---|---|
| 2.1 | Web CI: `pnpm exec tsc --noEmit` and `pnpm build` (or `next build`) on pull requests. Cache `.next`. This is the #111/#51 class. | P3, P9 | S–M (build time on the runner; 15 min job already) |
| 2.2 | After a dash cleanup, add `src/content/blog/**` to `marketing-copy.test.ts` (or a dedicated `blog-copy.test.ts`) | P10 | S + cleanup PR |
| 2.3 | Import/boundary check: no second `def evaluate(` outside `packages/strategy`; `apps/web` must not hardcode buy-grade thresholds; `evaluate_friday` renamed to `score_friday_ic` | P6, P12 | S |
| 2.4 | `rg` (or a tiny pytest) that `refresh_marks(` call sites all go through `BookSession` once 1.6 lands | P4 | S |
| 2.5 | Version-bump job: if `params.py` / `signals.py` / worker `scoring.py` change, require changelog section, golden, and baseline path for the *current* `version_label`. Fail on empty/null decision-diff (the #33/#34 reject, automated). | P6 | M (partially present in `test_version_bump.py`) |
| 2.6 | Unique-ink and unique-spare-id already tested; keep them. Drop the pinned `spare-27` and the exception-list `if (spare.id !== "spare-07" && …)`. | P1 | S (part of 1.1) |

### Layer 3 — Minimal prose (only after 1 and 2)

Keep `AGENTS.md` short. Replace the stale “Run 118” line. Add three bullets, not a novel:

- New blog post: add `content/blog/<slug>.tsx` (types from `article.ts`), add `content/art-claims/spare-NN.json`, copy cover. Do not edit `art-pool.ts` or `blog.ts`.
- Strategy change: one PR that bumps `version_label`, golden, baseline, changelog. Null decision-diff = do not open a PR.
- Do not move `GoogleAdsScript`. Do not set `max_adds_per_evaluation`. Do not write a full params snapshot.

A verification skill is worth one file: “run `pnpm --dir apps/web build` and `scripts/pytest.sh packages/strategy/tests apps/api/tests`; for UI, click the route, do not screenshot only.” That matches Jack’s existing hotfix pattern and the user-facing browser-verification rule. Do **not** add Convex/Paddle/Alpaca skills.

### Layer 4 — Human review last

Review for taste (voice, whether a strategy experiment is *worth* promoting) and for the product call on the 250% marketing claim. Do not use review to catch missing sub-categories, shared art-pool edits, or `next build` failures.

---

## Suggested sequence

1. **1.1 + 2.6** (art claims) and **1.2 + 1.3** (blog types + codegen) as two PRs. Unblocks the current parallel-agent firehose.
2. **2.1** (real web build on CI). Catches the next #111 before Railway.
3. **1.4 + 1.5 + 2.5** (strategy lock + experiment gate).
4. **1.6 + 1.7 + 2.4** (tape/splits pipeline).
5. **1.8 + 1.9 + 1.10 + 1.12** (numbers, gtag, memory, slug similarity).
6. Dash cleanup + **2.2**. **1.11** null-safe money as a dedicated pass over strategy/API.
7. Then the three-bullet `AGENTS.md` refresh.

Do not start with a longer `AGENTS.md`. The standing notes already say the right things; the easy path still does the wrong things.

---

## Out of scope / already in good shape

- `packages/strategy` as a pure `evaluate()` package is the right shape. Live and backtest already call it. Do not split it further.
- `extra_buy.py` is a deliberate, logged override. Keep it; do not delete it in the name of purity.
- Python tests for splits, published numbers, params overrides, and version bump are real and should be extended, not replaced.
- `grade_meets_minimum` already fails closed (#S6). Copy that pattern; do not re-document it.
- No Alpaca remnants in runtime code (comments and `import_positions.py` only).
- Worker tests are already collected via `apps/api/tests`.

---

## Sources

- PRs: https://github.com/jackgisel/investing-picks-app/pulls?q=is%3Apr
- Jack’s only review comment: https://github.com/jackgisel/investing-picks-app/pull/66#issuecomment-5917270354
- Closed rejects: #33, #34, #51, #21
- Split fix: https://github.com/jackgisel/investing-picks-app/pull/118
- Params pin: https://github.com/jackgisel/investing-picks-app/pull/105
- Deploy hotfixes: #111, #112, #96
- Audit: `docs/BUG_REPORT.md`
- Method: Lauren Tan, “How I Shipped 2000 PRs Last Month — Trusting AI Agents”
