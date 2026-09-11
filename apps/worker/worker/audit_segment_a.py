"""Print the Segment A revisions-window audit against the configured database.

    python -m worker.audit_segment_a
"""

from __future__ import annotations

import json
import sys

from app.db.session import SessionLocal
from worker.services.backtest_audit import audit_segment_a, format_segment_a_markdown


def main() -> int:
    db = SessionLocal()
    try:
        audit = audit_segment_a(db)
    finally:
        db.close()
    if "--json" in sys.argv:
        print(json.dumps(audit, indent=2))
    else:
        print(format_segment_a_markdown(audit))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
