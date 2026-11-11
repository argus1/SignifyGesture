#!/usr/bin/env python3
"""Fail if likely ASL Citizen data or model artifacts are tracked in Git."""

import subprocess
import sys
from pathlib import PurePosixPath


ASL_CITIZEN_MARKER = "asl-citizen"
ASL_CITIZEN_UNDERSCORE_MARKER = "asl_citizen"
GUARD_INFRASTRUCTURE_PATHS = {
    ".github/workflows/asl-citizen-data-guard.yml",
    "scripts/check-asl-citizen-data.py",
}
BLOCKED_SUFFIXES = {
    ".avi",
    ".csv",
    ".gz",
    ".h5",
    ".keras",
    ".mkv",
    ".mlmodel",
    ".mlmodelc",
    ".mov",
    ".mp4",
    ".npz",
    ".npy",
    ".onnx",
    ".parquet",
    ".pkl",
    ".pickle",
    ".pt",
    ".pth",
    ".safetensors",
    ".7z",
    ".tar",
    ".tflite",
    ".tsv",
    ".webm",
    ".zip",
}


def find_blocked_paths(paths: list[str]) -> list[str]:
    blocked = []
    for path in paths:
        if path in GUARD_INFRASTRUCTURE_PATHS:
            continue
        normalized = path.lower()
        path_parts = PurePosixPath(normalized).parts
        if (
            ASL_CITIZEN_MARKER in normalized
            or ASL_CITIZEN_UNDERSCORE_MARKER in normalized
            or any(PurePosixPath(part).suffix in BLOCKED_SUFFIXES for part in path_parts)
            or any(part.endswith(".mlpackage") for part in path_parts)
        ):
            blocked.append(path)
    return blocked


def main() -> int:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        check=True,
        capture_output=True,
    )
    paths = [path.decode("utf-8", errors="replace") for path in result.stdout.split(b"\0") if path]
    blocked = find_blocked_paths(paths)
    if blocked:
        print(
            "Error: likely dataset/media/model artifacts must remain local and untracked:",
            file=sys.stderr,
        )
        for path in blocked:
            print(f"  {path}", file=sys.stderr)
        print(
            "Keep ASL Citizen source data, derived data, and trained artifacts under "
            "local-data/asl-citizen/.",
            file=sys.stderr,
        )
        return 1
    print("No blocked ASL Citizen paths or media/model artifacts are tracked.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
