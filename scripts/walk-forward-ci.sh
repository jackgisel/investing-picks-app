#!/bin/sh
# Nightly walk-forward: extend the pinned dataset from live Postgres, score the
# newest complete evaluation Friday, fail on snapshot holes or engine drift
# (live-score replay vs the live ledger). Dataset-vs-live trade diffs go in
# the step summary and do not fail. Re-upload and rewrite the pin when the
# hash changes.
#
# Env: DATABASE_URL, FMP_API_KEY, BACKTEST_DATASET_URL / TOKEN or BACKTEST_S3_*.
# Skip (exit 0) when DATABASE_URL or dataset credentials are missing.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PYTHONPATH="$ROOT/apps/api:$ROOT/apps/worker:$ROOT/packages/strategy/src${PYTHONPATH:+:$PYTHONPATH}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "walk-forward skipped: DATABASE_URL not set"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "changed=false" >> "$GITHUB_OUTPUT"
    echo "parity=false" >> "$GITHUB_OUTPUT"
  fi
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "## Walk-forward skipped"
      echo ""
      echo "Add GitHub Actions secret \`DATABASE_URL\` (production Postgres) plus dataset credentials."
    } >> "$GITHUB_STEP_SUMMARY"
  fi
  exit 0
fi

MANIFEST="${MANIFEST:-$ROOT/datasets/manifest.json}"
DATASET="${DATASET:-$ROOT/datasets/dataset-v1.sqlite}"
CONFIG="${CONFIG:-$ROOT/backtests/run120.toml}"
BASELINE="${BASELINE:-$ROOT/backtests/baselines/run120.json}"

python3 -m worker.backtest download --dataset "$DATASET" --manifest "$MANIFEST"

FLAGS="--config $CONFIG --dataset $DATASET --manifest $MANIFEST --baseline $BASELINE"
if [ -n "${BACKTEST_S3_ACCESS_KEY:-}" ] || [ -n "${BACKTEST_S3_SECRET_KEY:-}" ]; then
  FLAGS="$FLAGS --upload"
fi

# shellcheck disable=SC2086
python3 -m worker.backtest walk-forward $FLAGS
