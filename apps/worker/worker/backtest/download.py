"""Download a pinned dataset from HTTP (CI) or the Railway S3 bucket."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path

ZSTD_MAGIC = b"\x28\xb5\x2f\xfd"


def has_dataset_credentials() -> bool:
    if os.environ.get("BACKTEST_DATASET_URL"):
        return True
    return all(
        os.environ.get(k)
        for k in (
            "BACKTEST_S3_ENDPOINT",
            "BACKTEST_S3_ACCESS_KEY",
            "BACKTEST_S3_SECRET_KEY",
        )
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_pinned_dataset(
    dest: Path,
    *,
    manifest: Path | None = None,
    key: str | None = None,
    sha256: str | None = None,
) -> dict:
    """Resolve credentials, download, decompress if needed, verify the pin."""
    expected = sha256
    source = None
    if manifest is not None:
        payload = json.loads(manifest.read_text())
        expected = expected or payload.get("sha256")
        key = key or payload.get("dataset")
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and expected and sha256_file(dest) == expected:
        return {
            "cached": True,
            "path": str(dest),
            "sha256": expected,
            "bytes": dest.stat().st_size,
        }
    url = os.environ.get("BACKTEST_DATASET_URL")
    token = os.environ.get("BACKTEST_DATASET_TOKEN")
    if url:
        staging = dest.with_suffix(dest.suffix + ".download")
        _http_get(url, staging, token)
        _maybe_decompress(staging, dest)
        staging.unlink(missing_ok=True)
        source = "url"
    else:
        download_dataset(dest, key=key, sha256=None)
        source = "s3"
    digest = sha256_file(dest)
    if expected and digest != expected:
        dest.unlink(missing_ok=True)
        raise RuntimeError(f"dataset hash mismatch: got {digest}, expected {expected}")
    return {
        "cached": False,
        "source": source,
        "path": str(dest),
        "sha256": digest,
        "bytes": dest.stat().st_size,
    }


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
        raise RuntimeError("boto3 is required for dataset upload/download") from e

    endpoint = os.environ.get("BACKTEST_S3_ENDPOINT")
    access = os.environ.get("BACKTEST_S3_ACCESS_KEY")
    secret = os.environ.get("BACKTEST_S3_SECRET_KEY")
    bucket = os.environ.get("BACKTEST_S3_BUCKET") or "outpick-backtest"
    region = os.environ.get("BACKTEST_S3_REGION") or "auto"
    if not all([endpoint, access, secret]):
        raise RuntimeError(
            "Set BACKTEST_DATASET_URL (+ optional BACKTEST_DATASET_TOKEN) "
            "or BACKTEST_S3_ENDPOINT / ACCESS_KEY / SECRET_KEY "
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
    digest = sha256_file(dest)
    if sha256 and digest != sha256:
        dest.unlink(missing_ok=True)
        raise RuntimeError(
            f"dataset hash mismatch: got {digest}, expected {sha256}"
        )
    return {"bucket": bucket, "key": key, "bytes": dest.stat().st_size, "sha256": digest}


def _http_get(url: str, dest: Path, token: str | None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=600) as resp, dest.open("wb") as out:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)


def _maybe_decompress(src: Path, dest: Path) -> None:
    """Copy `src` to `dest`, decompressing zstd if the file is a zstd frame."""
    with src.open("rb") as fh:
        magic = fh.read(4)
    if magic != ZSTD_MAGIC and not str(src).endswith(".zst"):
        if src.resolve() != dest.resolve():
            shutil.copyfile(src, dest)
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["zstd", "-d", "-f", "-o", str(dest), str(src)],
        check=True,
        capture_output=True,
    )


# Back-compat alias used by Phase 2 tests / older callers.
_sha256 = sha256_file
