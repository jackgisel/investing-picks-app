#!/bin/sh
# Fetch the pinned dataset, replay the shipped engine, write result + report + curve.
#
# Env: BACKTEST_DATASET_URL / BACKTEST_DATASET_TOKEN, or BACKTEST_S3_*.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PYTHONPATH="$ROOT/apps/api:$ROOT/apps/worker:$ROOT/packages/strategy/src${PYTHONPATH:+:$PYTHONPATH}"

MANIFEST="${MANIFEST:-$ROOT/datasets/manifest.json}"
DATASET="${DATASET:-$ROOT/datasets/dataset-v1.sqlite}"
CONFIG="${CONFIG:-$ROOT/backtests/run118.toml}"
OUT="${OUT:-/tmp/backtest-result.json}"
REPORT="${REPORT:-/tmp/backtest-report.md}"
CSV="${CSV:-/tmp/backtest-equity.csv}"

python3 -m worker.backtest download --dataset "$DATASET" --manifest "$MANIFEST"

# A derivation fix is a no-op if we only replay already-materialised scores.
# Re-derive any Friday whose pit rows carry an older or missing deriveVersion,
# then skip the pin check because the sqlite bytes (and hash) changed.
RESCORE="$(
  python3 - <<PY
from pathlib import Path

from worker.backtest.config import load_config
from worker.backtest.score import earliest_stale_derive_date
from worker.backtest.store import open_dataset

cfg = load_config(Path("$CONFIG"), dataset_override="$DATASET")
db = open_dataset(cfg.dataset)
try:
    stale = earliest_stale_derive_date(db, cfg.start, cfg.end)
finally:
    db.close()
if stale is None:
    print("no")
else:
    print(f"{cfg.start.isoformat()} {cfg.end.isoformat()} {stale.isoformat()}")
PY
)"

SKIP_HASH=""
if [ "$RESCORE" != "no" ]; then
  FROM=$(echo "$RESCORE" | awk '{print $1}')
  TO=$(echo "$RESCORE" | awk '{print $2}')
  echo "Re-scoring stale tape $FROM → $TO"
  python3 -m worker.backtest score --dataset "$DATASET" --from "$FROM" --to "$TO"
  python3 -m worker.backtest hash --dataset "$DATASET" --manifest /tmp/backtest-manifest.json
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "## Tape re-score"
      echo ""
      echo "Pit rows were older than \`DERIVE_VERSION\`. Re-derived \`$FROM\` → \`$TO\`."
      echo ""
      echo "\`\`\`"
      cat /tmp/backtest-manifest.json
      echo "\`\`\`"
    } >> "$GITHUB_STEP_SUMMARY"
  fi
  if [ -n "${BACKTEST_S3_ACCESS_KEY:-}" ] || [ -n "${BACKTEST_S3_SECRET_KEY:-}" ]; then
    python3 -m worker.backtest upload --dataset "$DATASET"
  fi
  SKIP_HASH="--skip-hash"
fi

# shellcheck disable=SC2086
python3 -m worker.backtest run --config "$CONFIG" --out "$OUT" $SKIP_HASH
python3 -m worker.backtest report "$OUT" --out "$REPORT"
python3 -m worker.backtest equity-csv "$OUT" --out "$CSV"
