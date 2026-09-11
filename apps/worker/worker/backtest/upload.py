"""Upload a dataset object to the Railway S3-compatible bucket."""

from __future__ import annotations

import os
from pathlib import Path


def upload_dataset(path: Path, key: str | None = None) -> dict:
    """PUT `path` to the backtest bucket. Credentials from the environment.

    BACKTEST_S3_ENDPOINT, BACKTEST_S3_ACCESS_KEY, BACKTEST_S3_SECRET_KEY,
    BACKTEST_S3_BUCKET. Optional BACKTEST_S3_REGION (default auto).
    """
    try:
        import boto3
        from botocore.config import Config
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("boto3 is required for dataset upload") from e

    endpoint = os.environ.get("BACKTEST_S3_ENDPOINT")
    access = os.environ.get("BACKTEST_S3_ACCESS_KEY")
    secret = os.environ.get("BACKTEST_S3_SECRET_KEY")
    bucket = os.environ.get("BACKTEST_S3_BUCKET")
    region = os.environ.get("BACKTEST_S3_REGION") or "auto"
    if not all([endpoint, access, secret, bucket]):
        raise RuntimeError(
            "BACKTEST_S3_ENDPOINT / ACCESS_KEY / SECRET_KEY / BUCKET must be set"
        )
    key = key or path.name
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access,
        aws_secret_access_key=secret,
        region_name=region,
        config=Config(signature_version="s3v4"),
    )
    client.upload_file(str(path), bucket, key)
    return {"bucket": bucket, "key": key, "bytes": path.stat().st_size}
