"""Current `version_label` must have a changelog entry and a golden snapshot."""

from __future__ import annotations

from pathlib import Path

from outpick_strategy import RUN118_PARAMS

_ROOT = Path(__file__).resolve().parents[3]
_CHANGELOG = _ROOT / "STRATEGY_CHANGELOG.md"
_GOLDEN = Path(__file__).parent / "golden" / f"{RUN118_PARAMS.version_label}_evaluate.json"


def test_max_adds_per_evaluation_stays_one():
    assert RUN118_PARAMS.max_adds_per_evaluation == 1


def test_changelog_covers_current_version():
    text = _CHANGELOG.read_text()
    label = RUN118_PARAMS.version_label
    assert f"## {label}" in text, (
        f"{_CHANGELOG} must have a '## {label}' section. Bump version_label "
        "and add the changelog entry in the same PR."
    )
    assert "run119" in text
    assert "version_label" in text
    assert "max_adds_per_evaluation" in text


def test_golden_snapshot_filename_matches_version_label():
    assert _GOLDEN.exists(), (
        f"missing {_GOLDEN.name}; regenerate with UPDATE_GOLDEN=1 after a "
        "version bump and commit it next to STRATEGY_CHANGELOG.md"
    )
