#!/bin/sh
# Run pytest from the repo virtualenv.
#
# `pnpm test` used to invoke bare `pytest`, which is only on PATH if you have
# already activated .venv — so the suite looked broken to anyone who hadn't,
# and "tests don't run here" was easy to mistake for "there are no tests".
set -e
for PY in "$(dirname "$0")/../.venv/bin/python" python3 python; do
  if [ -x "$PY" ] || command -v "$PY" >/dev/null 2>&1; then
    if "$PY" -c "import pytest" >/dev/null 2>&1; then
      exec "$PY" -m pytest "$@"
    fi
  fi
done
echo "pytest not found. Create the venv and install dev deps, or run:" >&2
echo "  python3 -m pip install pytest" >&2
exit 1
