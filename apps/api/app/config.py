"""Shared settings for API and worker."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# The historical default. Treated as "unset" everywhere outside local dev so a
# missing OPS_API_KEY can never leave the ops surface wide open in production.
DEV_OPS_KEY = "dev-ops-key"

LOCAL_ENVS = {"local", "dev", "development", "test", "testing"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./outpick.db"
    # Also accept DATABASE_URL without driver prefix
    fmp_api_key: str = ""
    # `/api/v3` is retired and 403s for non-legacy keys; `/stable` is current.
    fmp_base_url: str = "https://financialmodelingprep.com/stable"
    # Requests per minute. The plan allows 280; the client's own default of 60
    # made a full refresh take ~29 minutes instead of ~7, and every extra minute
    # is another minute a redeploy can kill the run mid-flight.
    fmp_rate_limit: int = 280
    # A normal refresh is roughly seven minutes at the configured FMP rate.
    # Bound pathological upstream slowness well before it can consume an
    # entire worker day. The same value is the age at which a redeploy-orphaned
    # JobRun is reaped, so WEEKLY_REFRESH_TIMEOUT_MINUTES is the single knob.
    weekly_refresh_timeout_minutes: float = 60.0
    initial_cash: float = 100_000.0
    # No fail-open default. Local dev falls back to DEV_OPS_KEY via
    # `effective_ops_key`; anywhere else an unset key disables ops entirely.
    ops_api_key: str = ""
    cors_origins: str = "http://localhost:3000"
    # Set APP_ENV=production (or ENVIRONMENT=production) on real deployments.
    app_env: str = "development"
    # Where the worker reaches the Next.js app to ask it to draft research
    # notes. Both of these unset means the drafting sweep is skipped and logged
    # rather than erroring — the API itself never calls the web app, so a
    # deployment without them is a perfectly valid one.
    web_app_url: str = ""
    internal_api_secret: str = ""

    @property
    def is_local_dev(self) -> bool:
        return self.app_env.strip().lower() in LOCAL_ENVS

    @property
    def ops_key_config_error(self) -> str | None:
        """Human-readable reason the ops key is unusable, or None if it's fine."""
        key = (self.ops_api_key or "").strip()
        if key and key != DEV_OPS_KEY:
            return None
        if self.is_local_dev:
            return None
        reason = "unset" if not key else "still the shared dev default"
        return (
            f"OPS_API_KEY is {reason} while APP_ENV={self.app_env!r}. "
            "Set OPS_API_KEY to a strong random secret (and the same value on "
            "the web app) or set APP_ENV to a local value."
        )

    @property
    def effective_ops_key(self) -> str:
        """The key ops requests must present. Empty string means ops is disabled."""
        key = (self.ops_api_key or "").strip()
        if key and (key != DEV_OPS_KEY or self.is_local_dev):
            return key
        if self.is_local_dev:
            return DEV_OPS_KEY
        return ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


def assert_ops_key_configured() -> None:
    """Raise at import/startup time when the ops key would fail open."""
    problem = get_settings().ops_key_config_error
    if problem:
        raise RuntimeError(problem)
