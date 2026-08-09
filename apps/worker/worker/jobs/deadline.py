"""Cooperative wall-clock deadlines for worker jobs."""

from __future__ import annotations

import time
from dataclasses import dataclass


class JobDeadlineExceeded(TimeoutError):
    """Raised when a worker job exhausts its total runtime budget."""


@dataclass(frozen=True)
class JobDeadline:
    job_name: str
    timeout_seconds: float
    expires_at: float

    @classmethod
    def after(cls, job_name: str, timeout_seconds: float) -> "JobDeadline":
        return cls(
            job_name=job_name,
            timeout_seconds=timeout_seconds,
            expires_at=time.monotonic() + timeout_seconds,
        )

    def remaining_seconds(self) -> float:
        remaining = self.expires_at - time.monotonic()
        if remaining <= 0:
            raise JobDeadlineExceeded(
                f"{self.job_name} timed out after "
                f"{self.timeout_seconds / 60:g} minutes"
            )
        return remaining

    def check(self) -> None:
        self.remaining_seconds()

    def sleep(self, seconds: float) -> None:
        """Sleep only when the whole delay fits inside the remaining budget."""
        remaining = self.remaining_seconds()
        if seconds >= remaining:
            raise JobDeadlineExceeded(
                f"{self.job_name} timed out after "
                f"{self.timeout_seconds / 60:g} minutes"
            )
        time.sleep(seconds)
