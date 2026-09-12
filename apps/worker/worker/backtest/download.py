"""Download a pinned dataset object from the Railway bucket."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path


def download_dataset(
    dest: Path,
    *,
    key: str | None = None,
    sha256: str | None = None,
) -> dict:
    """GET `key` from the backtest bucket. Credentials from the environment.

    BACKTEST_S3_ENDPOINT, BACKTEST_S3_ACCESS_KEY, BACKTEST_S3_SECRET_KEY,
    BACKTEST_S3_BUCKET. Optional BACKTEST_S3_REGION (default auto).
    """
    try:
        import boto3
        from botocore.config import Config
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("boto3 is required for dataset download") from e

    endpoint = os.environ.get("BACKTEST_S3_ENDPOINT")
    access = os.environ.get("BACKTEST_S3_ACCESS_KEY")
    secret = os.environ.get("BACKTEST_S3_SECRET_KEY")
    bucket = os.environ.get("BACKTEST_S3_BUCKET") or "outpick-backtest"
    region = os.environ.get("BACKTEST_S3_REGION") or "auto"
    if not all([endpoint, access, secret]):
        raise RuntimeError(
            "BACKTEST_S3_ENDPOINT / ACCESS_KEY / SECRET_KEY must be set "
            f"(bucket defaults to {bucket})"
        )
    key = key or dest.name
    dest.parent.mkdir(parents=True, exist_ok=True)
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access,
        aws_secret_access_key=secret,
        region_name=region,
        config=Config(signature_version="s3v4"),
    )
    client.download_file(bucket, key, str(dest))
    digest = _sha256(dest)
    if sha256 and digest != sha256:
        dest.unlink(missing_ok=True)
        raise RuntimeError(
            f"dataset hash mismatch: got {digest}, expected {sha256}"
        )
    return {"bucket": bucket, "key": key, "bytes": dest.stat().st_size, "sha256": digest}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()
