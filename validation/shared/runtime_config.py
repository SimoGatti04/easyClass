"""Strict runtime configuration for Teacher Service validation.

This loader intentionally reads ONLY the project-local .env.local file and
ONLY Teacher Service-specific OmniRoute variables. It never reads or falls
back to the host-wide OMNIROUTE_API_KEY, ~/.omniroute/.env, Codex config, or
provider API keys.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = PROJECT_ROOT / ".env.local"

_ALLOWED_KEYS = {
    "TEACHER_SERVICE_OMNIROUTE_API_KEY",
    "TEACHER_SERVICE_OMNIROUTE_BASE_URL",
}

_FORBIDDEN_KEYS = {
    "OMNIROUTE_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
}


class RuntimeConfigError(RuntimeError):
    """Raised when the dedicated Teacher Service runtime config is invalid."""


@dataclass(frozen=True)
class OmniRouteConfig:
    api_key: str
    base_url: str


def _parse_env_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        raise RuntimeConfigError(
            "AUTH_REQUIRED_TEACHER_SERVICE: project .env.local not found"
        )

    values: dict[str, str] = {}
    for lineno, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise RuntimeConfigError(
                f"Invalid .env.local entry at line {lineno}: expected KEY=VALUE"
            )

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if key in _FORBIDDEN_KEYS:
            raise RuntimeConfigError(
                f"Forbidden shared/provider credential name in project .env.local: {key}"
            )
        if key not in _ALLOWED_KEYS:
            raise RuntimeConfigError(
                f"Unsupported key in project .env.local: {key}"
            )

        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]

        values[key] = value

    return values


def load_teacher_service_omniroute_config() -> OmniRouteConfig:
    values = _parse_env_file(ENV_FILE)

    api_key = values.get("TEACHER_SERVICE_OMNIROUTE_API_KEY", "").strip()
    if not api_key:
        raise RuntimeConfigError(
            "AUTH_REQUIRED_TEACHER_SERVICE: "
            "TEACHER_SERVICE_OMNIROUTE_API_KEY is missing or empty in .env.local"
        )

    base_url = values.get("TEACHER_SERVICE_OMNIROUTE_BASE_URL", "").strip().rstrip("/")
    if not base_url:
        raise RuntimeConfigError(
            "TEACHER_SERVICE_OMNIROUTE_BASE_URL is missing or empty in .env.local"
        )

    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeConfigError(
            "TEACHER_SERVICE_OMNIROUTE_BASE_URL must be an absolute http(s) URL"
        )

    return OmniRouteConfig(api_key=api_key, base_url=base_url)
