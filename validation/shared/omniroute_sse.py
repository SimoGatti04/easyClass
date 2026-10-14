"""Strict SSE transport helpers for Teacher Service OmniRoute validation.

This module is provider-independent and contains no credential loading. The
caller supplies only the requested model ID and sanitized live catalog rows.
"""
from __future__ import annotations

import json
import socket
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable


def is_keepalive_event(event: Any) -> bool:
    """Recognize OmniRoute heartbeat frames, never treating them as model data."""
    if isinstance(event, bytes):
        event = event.decode("utf-8", "replace")
    if isinstance(event, str):
        text = event.strip()
        if text.lower().startswith("data:"):
            text = text[5:].strip()
        return text.lower() == "keepalive"
    if not isinstance(event, dict):
        return False

    if event.get("model") == "keepalive" or event.get("id") == "chatcmpl-keepalive":
        return True

    choices = event.get("choices")
    if not isinstance(choices, list) or not choices:
        return False
    if any(not isinstance(choice, dict) for choice in choices):
        return False
    if any(choice.get("finish_reason") is not None for choice in choices):
        return False

    # Structural heartbeat form: an empty completion chunk, with no real model
    # or response identity. Real model events with empty deltas remain real.
    empty_deltas = all(not (choice.get("delta") or {}) for choice in choices)
    identity_absent = not event.get("model") and not event.get("id")
    heartbeat_timestamp = event.get("created") in (None, 0)
    return (
        event.get("object") == "chat.completion.chunk"
        and empty_deltas
        and identity_absent
        and heartbeat_timestamp
    )


def resolve_model_identity(
    returned_model_id: str,
    requested_model_id: str,
    catalog_models: Iterable[dict[str, Any]],
) -> tuple[bool, str]:
    """Resolve an actual response model by exact ID or a unique root/name alias."""
    if returned_model_id == requested_model_id:
        return True, "exact"
    if not returned_model_id:
        return False, "missing"
    matches = [
        str(model.get("id"))
        for model in catalog_models
        if returned_model_id in {model.get("id"), model.get("root"), model.get("name")}
        and model.get("id")
    ]
    if len(matches) == 1 and matches[0] == requested_model_id:
        return True, "unique_catalog_alias"
    if len(matches) > 1:
        return False, "ambiguous_catalog_alias"
    return False, "mismatch_or_ambiguous"


@dataclass
class SSEAccumulator:
    requested_model_id: str | None = None
    catalog_models: tuple[dict[str, Any], ...] = ()
    clock: Callable[[], float] = time.monotonic
    content_parts: list[str] = field(default_factory=list)
    actual_model_ids_seen: list[str] = field(default_factory=list)
    model_identity_checks: list[dict[str, Any]] = field(default_factory=list)
    heartbeat_events: int = 0
    heartbeat_ids: list[str] = field(default_factory=list)
    response_id: str | None = None
    finish_reason: str | None = None
    usage: dict[str, Any] | None = None
    first_output_text_at: float | None = None
    wire_data_events: int = 0
    actual_events: int = 0
    done: bool = False
    identity_failure: dict[str, Any] | None = None
    parsed_json_body: bool = False

    @property
    def returned_model_id(self) -> str | None:
        return self.actual_model_ids_seen[0] if self.actual_model_ids_seen else None

    @property
    def identity_verified(self) -> bool:
        return bool(self.actual_model_ids_seen) and not self.identity_failure and all(
            item["verified"] for item in self.model_identity_checks
        )

    @property
    def content(self) -> str:
        return "".join(self.content_parts)

    def accept_data(self, data: str, sse_id: str | None = None) -> None:
        self.wire_data_events += 1
        stripped = data.strip()
        if stripped == "[DONE]":
            self.done = True
            return
        if is_keepalive_event(stripped):
            self.heartbeat_events += 1
            heartbeat_id = sse_id
            if not heartbeat_id:
                try:
                    payload = json.loads(stripped)
                    heartbeat_id = payload.get("id") if isinstance(payload, dict) else None
                except (json.JSONDecodeError, TypeError):
                    pass
            if heartbeat_id and heartbeat_id not in self.heartbeat_ids:
                self.heartbeat_ids.append(heartbeat_id)
            return
        try:
            event = json.loads(stripped)
        except json.JSONDecodeError:
            return
        if not isinstance(event, dict):
            return
        self._accept_event(event, arrival_time=self.clock())

    def accept_json_body(self, payload: dict[str, Any]) -> None:
        self.parsed_json_body = True
        self._accept_event(payload, arrival_time=self.clock())

    def _accept_event(self, event: dict[str, Any], arrival_time: float) -> None:
        if is_keepalive_event(event):
            self.heartbeat_events += 1
            hb_id = event.get("id")
            if hb_id and hb_id not in self.heartbeat_ids:
                self.heartbeat_ids.append(hb_id)
            return

        self.actual_events += 1
        model_id = event.get("model")
        if isinstance(model_id, str) and model_id:
            if model_id not in self.actual_model_ids_seen:
                self.actual_model_ids_seen.append(model_id)
            if self.requested_model_id is not None:
                verified, resolution = resolve_model_identity(
                    model_id, self.requested_model_id, self.catalog_models
                )
                check = {
                    "returned_model_id": model_id,
                    "requested_model_id": self.requested_model_id,
                    "verified": verified,
                    "resolution": resolution,
                }
                self.model_identity_checks.append(check)
                if not verified:
                    self.identity_failure = check
                    return

        event_id = event.get("id")
        if isinstance(event_id, str) and event_id and event_id != "chatcmpl-keepalive" and self.response_id is None:
            self.response_id = event_id
        if isinstance(event.get("usage"), dict):
            self.usage = event["usage"]

        for choice in event.get("choices") or []:
            if not isinstance(choice, dict):
                continue
            if choice.get("finish_reason") is not None:
                self.finish_reason = choice["finish_reason"]
            delta = choice.get("delta") or {}
            content = delta.get("content") if isinstance(delta, dict) else None
            # OpenAI-compatible non-stream JSON completions expose message.content,
            # while SSE chunks expose delta.content. Keep one shared parser for both.
            if content is None:
                message = choice.get("message") or {}
                content = message.get("content") if isinstance(message, dict) else None
            if isinstance(content, list):
                content = "".join(
                    str(piece.get("text", ""))
                    for piece in content
                    if isinstance(piece, dict)
                )
            if isinstance(content, str) and content:
                self.content_parts.append(content)
                if self.first_output_text_at is None:
                    self.first_output_text_at = arrival_time


class SSEFrameParser:
    """Incrementally assemble SSE data frames from response.readline()."""

    def __init__(self, accumulator: SSEAccumulator):
        self.accumulator = accumulator
        self.data_lines: list[str] = []
        self.event_id: str | None = None

    def feed_line(self, line: bytes | str) -> bool:
        text = line.decode("utf-8", "replace") if isinstance(line, bytes) else line
        text = text.rstrip("\r\n")
        if text == "":
            self._flush()
            return self.accumulator.done or self.accumulator.identity_failure is not None
        if text.startswith(":"):
            return False
        field, sep, value = text.partition(":")
        if not sep:
            value = ""
        elif value.startswith(" "):
            value = value[1:]
        if field == "data":
            self.data_lines.append(value)
        elif field == "id":
            self.event_id = value
        return False

    def flush_eof(self) -> None:
        self._flush()

    def _flush(self) -> None:
        if self.data_lines:
            self.accumulator.accept_data("\n".join(self.data_lines), self.event_id)
        self.data_lines.clear()
        self.event_id = None


def parse_sse_payload(
    raw: bytes | str,
    *,
    requested_model_id: str | None = None,
    catalog_models: Iterable[dict[str, Any]] = (),
    clock: Callable[[], float] = time.monotonic,
) -> dict[str, Any]:
    """Parse buffered SSE/JSON without allowing heartbeat fields to overwrite data."""
    text = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else raw
    acc = SSEAccumulator(
        requested_model_id=requested_model_id,
        catalog_models=tuple(catalog_models),
        clock=clock,
    )
    try:
        body = json.loads(text)
    except json.JSONDecodeError:
        body = None
    if isinstance(body, dict) and ("choices" in body or "model" in body):
        acc.accept_json_body(body)
    else:
        parser = SSEFrameParser(acc)
        for line in text.splitlines():
            parser.feed_line(line)
            if acc.done or acc.identity_failure:
                break
        if not acc.done and not acc.identity_failure:
            parser.flush_eof()
    return accumulator_result(acc, termination="done" if acc.done else "eof")


def accumulator_result(acc: SSEAccumulator, *, termination: str) -> dict[str, Any]:
    return {
        "content": acc.content,
        "usage": acc.usage,
        "finish_reason": acc.finish_reason,
        "returned_model_id": acc.returned_model_id,
        "actual_model_ids_seen": list(acc.actual_model_ids_seen),
        "model_identity_checks": list(acc.model_identity_checks),
        "identity_verified": acc.identity_verified,
        "identity_failure": acc.identity_failure,
        "response_id": acc.response_id,
        "heartbeat_events": acc.heartbeat_events,
        "heartbeat_ids": list(acc.heartbeat_ids),
        "wire_data_events": acc.wire_data_events,
        "actual_events": acc.actual_events,
        "first_output_text_at": acc.first_output_text_at,
        "parsed_json_body": acc.parsed_json_body,
        "termination": termination,
    }


def _socket_timeout_setter(response: Any) -> Callable[[float], None] | None:
    sock = None
    try:
        sock = response.fp.raw._sock
    except Exception:
        try:
            sock = response.fp._sock
        except Exception:
            pass
    return (lambda remaining: sock.settimeout(max(0.01, remaining))) if sock else None


def read_sse_stream(
    response: Any,
    *,
    requested_model_id: str,
    catalog_models: Iterable[dict[str, Any]],
    timeout_seconds: float = 120.0,
    clock: Callable[[], float] = time.monotonic,
    set_read_timeout: Callable[[float], None] | None = None,
) -> tuple[bytes, dict[str, Any]]:
    """Read through heartbeat frames to a terminal state or an overall deadline."""
    start = clock()
    deadline = start + timeout_seconds
    setter = set_read_timeout or _socket_timeout_setter(response)
    acc = SSEAccumulator(
        requested_model_id=requested_model_id,
        catalog_models=tuple(catalog_models),
        clock=clock,
    )
    parser = SSEFrameParser(acc)
    chunks: list[bytes] = []
    termination = "eof"
    while True:
        remaining = deadline - clock()
        if remaining <= 0:
            termination = "heartbeat_only_timeout" if acc.heartbeat_events and not acc.actual_model_ids_seen and not acc.content else "timeout"
            break
        if setter:
            try:
                setter(remaining)
            except Exception:
                pass
        try:
            line = response.readline()
        except (TimeoutError, socket.timeout):
            termination = "heartbeat_only_timeout" if acc.heartbeat_events and not acc.actual_model_ids_seen and not acc.content else "timeout"
            break
        except Exception:
            termination = "transport_failure"
            break
        if not line:
            parser.flush_eof()
            termination = "done" if acc.done else "eof"
            break
        if isinstance(line, str):
            encoded = line.encode("utf-8")
            line_for_parser: bytes | str = line
        else:
            encoded = line
            line_for_parser = line
        chunks.append(encoded)
        parser.feed_line(line_for_parser)
        if acc.identity_failure:
            termination = "identity_failure"
            break
        if acc.done:
            termination = "done"
            break
    result = accumulator_result(acc, termination=termination)
    if termination in {"timeout", "heartbeat_only_timeout", "transport_failure", "identity_failure"}:
        result["stream_failure"] = termination
    return b"".join(chunks), result
