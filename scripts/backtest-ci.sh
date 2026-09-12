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
CONFIG="${CONFIG:-$ROOT/backtests/run120.toml}"
OUT="${OUT:-/tmp/backtest-result.json}"
REPORT="${REPORT:-/tmp/backtest-report.md}"
CSV="${CSV:-/tmp/backtest-equity.csv}"

python3 -m worker.backtest download --dataset "$DATASET" --manifest "$MANIFEST"
python3 -m worker.backtest run --config "$CONFIG" --out "$OUT"
python3 -m worker.backtest report "$OUT" --out "$REPORT"
python3 -m worker.backtest equity-csv "$OUT" --out "$CSV"
