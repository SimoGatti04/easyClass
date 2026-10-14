#!/usr/bin/env python3
"""Verify the dedicated Teacher Service OmniRoute credential without exposing it."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

VALIDATION_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VALIDATION_DIR))

from shared.runtime_config import RuntimeConfigError, load_teacher_service_omniroute_config


def main() -> int:
    try:
        config = load_teacher_service_omniroute_config()
    except RuntimeConfigError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    req = urllib.request.Request(
        f"{config.base_url}/models",
        headers={
            "Authorization": f"Bearer {config.api_key}",
            "Accept": "application/json",
            "User-Agent": "teacher-service-validation",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10.0) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        print(f"TEACHER_SERVICE_OMNIROUTE: HTTP_{exc.code}", file=sys.stderr)
        return 3
    except (urllib.error.URLError, TimeoutError) as exc:
        print(
            f"TEACHER_SERVICE_OMNIROUTE: UNREACHABLE ({type(exc).__name__})",
            file=sys.stderr,
        )
        return 4
    except (UnicodeDecodeError, json.JSONDecodeError):
        print("TEACHER_SERVICE_OMNIROUTE: INVALID_CATALOG_RESPONSE", file=sys.stderr)
        return 5

    models = payload.get("data", []) if isinstance(payload, dict) else payload
    if not isinstance(models, list):
        print("TEACHER_SERVICE_OMNIROUTE: INVALID_CATALOG_SHAPE", file=sys.stderr)
        return 6

    print("TEACHER_SERVICE_OMNIROUTE: READY")
    print(f"models_visible_to_teacher_service: {len(models)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
