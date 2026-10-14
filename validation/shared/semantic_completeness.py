"""Deterministic, contract-driven completeness checks for structured text outputs."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import re
import unicodedata
from collections.abc import Mapping, Sequence
from typing import Any


CONTRACT_VERSION = "1.0"
CHECKER_VERSION = "1.0.0"
_MISSING = object()
_WORD_RE = re.compile(r"[^\W_]+", re.UNICODE)
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+|\n+")
_EXPLICIT_MARKER_RE = re.compile(
    r"\b(?:todo|tbd|placeholder|omissis)\b|\[\s*\.\.\.\s*\]",
    re.IGNORECASE,
)
_DEFAULT_PLACEHOLDER_MARKERS = (
    "inserire qui",
    "aggiungere qui",
    "da compilare",
    "da completare",
    "to be completed",
    "insert here",
    "add here",
)


class GateStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"


class CheckSeverity(str, Enum):
    ERROR = "ERROR"
    WARN = "WARN"


@dataclass(frozen=True)
class RequiredElement:
    """An element class declared by the caller; any phrase may satisfy it."""

    name: str
    any_of: tuple[str, ...]


@dataclass(frozen=True)
class DeliverableCompletenessContract:
    """Task-declared requirements; no subject or provider assumptions are built in."""

    deliverable_type: str
    content_path: str = "content"
    required_paths: tuple[str, ...] = ()
    minimum_items_by_path: Mapping[str, int] = field(default_factory=dict)
    minimum_word_count: int = 8
    minimum_distinct_tokens: int = 5
    required_elements: tuple[RequiredElement, ...] = ()
    placeholder_markers: tuple[str, ...] = ()
    placeholder_sentence_ratio: float = 0.4
    distinct_from: tuple[str, ...] = ()
    near_duplicate_threshold: float = 0.82
    contract_version: str = CONTRACT_VERSION

    def __post_init__(self) -> None:
        if not self.deliverable_type.strip():
            raise ValueError("deliverable_type must not be blank")
        if self.minimum_word_count < 0 or self.minimum_distinct_tokens < 0:
            raise ValueError("content thresholds must not be negative")
        if not 0 < self.placeholder_sentence_ratio <= 1:
            raise ValueError("placeholder_sentence_ratio must be in (0, 1]")
        if not 0 <= self.near_duplicate_threshold <= 1:
            raise ValueError("near_duplicate_threshold must be in [0, 1]")
        if any(count < 0 for count in self.minimum_items_by_path.values()):
            raise ValueError("minimum item counts must not be negative")
        if any(not item.any_of for item in self.required_elements):
            raise ValueError("each required element needs at least one match phrase")


@dataclass(frozen=True)
class CheckResult:
    check_id: str
    passed: bool
    severity: CheckSeverity
    reason_code: str | None = None
    detail: str = ""
    metrics: Mapping[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "check_id": self.check_id,
            "passed": self.passed,
            "severity": self.severity.value,
            "reason_code": self.reason_code,
            "detail": self.detail,
            "metrics": dict(self.metrics),
        }


@dataclass(frozen=True)
class CompletenessResult:
    status: GateStatus
    deliverable_type: str
    checks: tuple[CheckResult, ...]
    failure_codes: tuple[str, ...]
    metrics: Mapping[str, Any]
    contract_version: str
    checker_version: str = CHECKER_VERSION

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "deliverable_type": self.deliverable_type,
            "checks": [check.to_dict() for check in self.checks],
            "failure_codes": list(self.failure_codes),
            "metrics": dict(self.metrics),
            "contract_version": self.contract_version,
            "checker_version": self.checker_version,
        }


def evaluate_deliverable(
    document: Mapping[str, Any], contract: DeliverableCompletenessContract
) -> CompletenessResult:
    """Evaluate one document against caller-declared requirements."""

    return _evaluate_base(document, contract)


def evaluate_bundle(
    deliverables: Mapping[str, Mapping[str, Any]],
    contracts: Sequence[DeliverableCompletenessContract],
) -> dict[str, CompletenessResult]:
    """Evaluate documents and any contract-declared distinctness relationships."""

    by_type = {contract.deliverable_type: contract for contract in contracts}
    if len(by_type) != len(contracts):
        raise ValueError("deliverable_type values must be unique")

    results: dict[str, CompletenessResult] = {}
    for contract in contracts:
        document = deliverables.get(contract.deliverable_type)
        if not isinstance(document, Mapping):
            result = _evaluate_base({}, contract)
            result = _add_failure(
                result,
                CheckResult(
                    check_id="deliverable_present",
                    passed=False,
                    severity=CheckSeverity.ERROR,
                    reason_code="MISSING_REQUIRED_STRUCTURE",
                    detail="The contract-declared deliverable was not provided.",
                ),
            )
            results[contract.deliverable_type] = result
            continue
        results[contract.deliverable_type] = _evaluate_base(document, contract)

    for contract in contracts:
        current_doc = deliverables.get(contract.deliverable_type)
        if not isinstance(current_doc, Mapping):
            continue
        current_value = _get_path(current_doc, contract.content_path)
        current_text = _text_from_value(current_value)
        for peer_type in contract.distinct_from:
            peer_doc = deliverables.get(peer_type)
            peer_contract = by_type.get(peer_type)
            if not isinstance(peer_doc, Mapping) or peer_contract is None:
                results[contract.deliverable_type] = _add_failure(
                    results[contract.deliverable_type],
                    CheckResult(
                        check_id=f"distinct_from:{peer_type}",
                        passed=False,
                        severity=CheckSeverity.ERROR,
                        reason_code="MISSING_REQUIRED_STRUCTURE",
                        detail="A contract-declared comparison deliverable is unavailable.",
                    ),
                )
                continue
            peer_value = _get_path(peer_doc, peer_contract.content_path)
            peer_text = _text_from_value(peer_value)
            similarity = _shingle_containment(current_text, peer_text)
            is_distinct = similarity < contract.near_duplicate_threshold
            check = CheckResult(
                check_id=f"distinct_from:{peer_type}",
                passed=is_distinct,
                severity=CheckSeverity.ERROR,
                reason_code=None if is_distinct else "NEAR_DUPLICATE_DELIVERABLE",
                detail=(
                    "Text differs beyond the configured near-copy threshold."
                    if is_distinct
                    else "Text overlap exceeds the configured near-copy threshold."
                ),
                metrics={
                    "shared_shingle_containment": round(similarity, 6),
                    "threshold": contract.near_duplicate_threshold,
                },
            )
            results[contract.deliverable_type] = _add_check(
                results[contract.deliverable_type], check
            )

    return results


def _evaluate_base(
    document: Mapping[str, Any], contract: DeliverableCompletenessContract
) -> CompletenessResult:
    checks: list[CheckResult] = []
    metrics: dict[str, Any] = {}

    for path in contract.required_paths:
        value = _get_path(document, path)
        present = value is not _MISSING and value is not None
        checks.append(
            CheckResult(
                check_id=f"required_path:{path}",
                passed=present,
                severity=CheckSeverity.ERROR,
                reason_code=None if present else "MISSING_REQUIRED_STRUCTURE",
                detail="Required path is present." if present else "Required path is absent.",
            )
        )

    for path, minimum in contract.minimum_items_by_path.items():
        value = _get_path(document, path)
        count = len(value) if isinstance(value, (Sequence, Mapping)) and not isinstance(value, str) else 0
        enough = value is not _MISSING and count >= minimum
        metrics[f"items:{path}"] = count
        checks.append(
            CheckResult(
                check_id=f"minimum_items:{path}",
                passed=enough,
                severity=CheckSeverity.ERROR,
                reason_code=None if enough else "MISSING_REQUIRED_STRUCTURE",
                detail=(
                    f"Observed {count}; contract requires at least {minimum}."
                ),
                metrics={"observed": count, "minimum": minimum},
            )
        )

    value = _get_path(document, contract.content_path)
    path_present = value is not _MISSING and value is not None
    text = _text_from_value(value) if path_present else ""
    tokens = _tokens(text)
    distinct_tokens = {token for token in tokens if len(token) > 2}
    metrics.update(
        {
            "word_count": len(tokens),
            "distinct_token_count": len(distinct_tokens),
            "content_character_count": len(text),
        }
    )

    if not path_present:
        checks.append(
            CheckResult(
                check_id="content_path_present",
                passed=False,
                severity=CheckSeverity.ERROR,
                reason_code="MISSING_REQUIRED_STRUCTURE",
                detail="The contract-declared content path is absent.",
            )
        )
    else:
        checks.append(
            CheckResult(
                check_id="content_path_present",
                passed=True,
                severity=CheckSeverity.ERROR,
                detail="The contract-declared content path is present.",
            )
        )

    word_count = len(tokens)
    if word_count <= 2:
        checks.append(
            CheckResult(
                check_id="nonempty_content",
                passed=False,
                severity=CheckSeverity.ERROR,
                reason_code="EMPTY_OR_NEAR_EMPTY",
                detail="Content contains at most two tokens.",
                metrics={"word_count": word_count},
            )
        )
    else:
        checks.append(
            CheckResult(
                check_id="nonempty_content",
                passed=True,
                severity=CheckSeverity.ERROR,
                detail="Content exceeds the near-empty safety floor.",
                metrics={"word_count": word_count},
            )
        )

    enough_words = word_count >= contract.minimum_word_count
    enough_distinct = len(distinct_tokens) >= contract.minimum_distinct_tokens
    substance_passed = enough_words and enough_distinct
    checks.append(
        CheckResult(
            check_id="substantive_content",
            passed=substance_passed,
            severity=CheckSeverity.ERROR,
            reason_code=None if substance_passed else "INSUFFICIENT_SUBSTANCE",
            detail=(
                "Configured content thresholds are met."
                if substance_passed
                else "Configured word-count or lexical-variety threshold is not met."
            ),
            metrics={
                "word_count": word_count,
                "minimum_word_count": contract.minimum_word_count,
                "distinct_token_count": len(distinct_tokens),
                "minimum_distinct_tokens": contract.minimum_distinct_tokens,
            },
        )
    )

    placeholder_metrics = _placeholder_metrics(text, contract.placeholder_markers)
    metrics.update(placeholder_metrics)
    ratio = float(placeholder_metrics["placeholder_sentence_ratio"])
    if placeholder_metrics["placeholder_sentence_count"] == 0:
        checks.append(
            CheckResult(
                check_id="placeholder_dominance",
                passed=True,
                severity=CheckSeverity.ERROR,
                detail="No configured placeholder or meta-template marker was found.",
                metrics=placeholder_metrics,
            )
        )
    elif ratio >= contract.placeholder_sentence_ratio:
        checks.append(
            CheckResult(
                check_id="placeholder_dominance",
                passed=False,
                severity=CheckSeverity.ERROR,
                reason_code="PLACEHOLDER_DOMINATED",
                detail="Placeholder/meta-template markers dominate the content sentences.",
                metrics=placeholder_metrics,
            )
        )
    else:
        checks.append(
            CheckResult(
                check_id="placeholder_signal",
                passed=False,
                severity=CheckSeverity.WARN,
                reason_code="PLACEHOLDER_SIGNAL",
                detail="A marker was found, but it is not dominant enough to prove incompleteness.",
                metrics=placeholder_metrics,
            )
        )

    for requirement in contract.required_elements:
        found = [phrase for phrase in requirement.any_of if _contains_phrase(text, phrase)]
        passed = bool(found)
        checks.append(
            CheckResult(
                check_id=f"required_element:{requirement.name}",
                passed=passed,
                severity=CheckSeverity.ERROR,
                reason_code=None if passed else "MISSING_REQUIRED_ELEMENT",
                detail=(
                    f"Matched a declared phrase for {requirement.name}."
                    if passed
                    else f"No declared phrase matched for {requirement.name}."
                ),
                metrics={"matched_phrases": found},
            )
        )

    failure_codes = _failure_codes(checks)
    return CompletenessResult(
        status=GateStatus.FAIL if failure_codes else GateStatus.PASS,
        deliverable_type=contract.deliverable_type,
        checks=tuple(checks),
        failure_codes=tuple(failure_codes),
        metrics=metrics,
        contract_version=contract.contract_version,
    )


def _placeholder_metrics(text: str, declared_markers: Sequence[str]) -> dict[str, Any]:
    sentences = [item for item in _SENTENCE_RE.split(text.strip()) if item.strip()]
    if not sentences:
        return {
            "sentence_count": 0,
            "placeholder_sentence_count": 0,
            "placeholder_sentence_ratio": 0.0,
            "matched_placeholder_markers": [],
        }

    markers = list(_DEFAULT_PLACEHOLDER_MARKERS)
    markers.extend(declared_markers)
    hit_sentences = 0
    matched: list[str] = []
    for sentence in sentences:
        found = False
        if _EXPLICIT_MARKER_RE.search(sentence):
            found = True
            explicit = _EXPLICIT_MARKER_RE.findall(sentence)
            for marker in explicit:
                if marker not in matched:
                    matched.append(marker)
        for marker in markers:
            if _contains_phrase(sentence, marker):
                found = True
                if marker not in matched:
                    matched.append(marker)
        if found:
            hit_sentences += 1

    return {
        "sentence_count": len(sentences),
        "placeholder_sentence_count": hit_sentences,
        "placeholder_sentence_ratio": round(hit_sentences / len(sentences), 6),
        "matched_placeholder_markers": matched,
    }


def _shingle_containment(left: str, right: str, size: int = 3) -> float:
    left_tokens = _tokens(left)
    right_tokens = _tokens(right)
    if not left_tokens or not right_tokens:
        return 0.0
    if left_tokens == right_tokens:
        return 1.0
    if min(len(left_tokens), len(right_tokens)) < size:
        return 0.0

    left_shingles = {tuple(left_tokens[index : index + size]) for index in range(len(left_tokens) - size + 1)}
    right_shingles = {tuple(right_tokens[index : index + size]) for index in range(len(right_tokens) - size + 1)}
    denominator = min(len(left_shingles), len(right_shingles))
    if denominator == 0:
        return 0.0
    common = len(left_shingles.intersection(right_shingles))
    return common / denominator


def _contains_phrase(text: str, phrase: str) -> bool:
    text_tokens = _tokens(text)
    phrase_tokens = _tokens(phrase)
    if not phrase_tokens or len(phrase_tokens) > len(text_tokens):
        return False
    width = len(phrase_tokens)
    for index in range(len(text_tokens) - width + 1):
        if text_tokens[index : index + width] == phrase_tokens:
            return True
    return False


def _tokens(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", text).casefold()
    return _WORD_RE.findall(normalized)


def _text_from_value(value: Any) -> str:
    if value is _MISSING or value is None:
        return ""
    parts: list[str] = []
    pending = [value]
    while pending:
        current = pending.pop()
        if isinstance(current, str):
            parts.append(current)
        elif isinstance(current, Mapping):
            pending.extend(reversed(list(current.values())))
        elif isinstance(current, Sequence) and not isinstance(current, (str, bytes, bytearray)):
            pending.extend(reversed(list(current)))
    output = ""
    for part in parts:
        if output:
            output += " "
        output += part
    return output


def _get_path(document: Any, path: str) -> Any:
    current = document
    for component in path.split(".") if path else ():
        if isinstance(current, Mapping):
            if component not in current:
                return _MISSING
            current = current[component]
        elif isinstance(current, Sequence) and not isinstance(current, (str, bytes, bytearray)):
            if not component.isdigit() or int(component) >= len(current):
                return _MISSING
            current = current[int(component)]
        else:
            return _MISSING
    return current


def _failure_codes(checks: Sequence[CheckResult]) -> list[str]:
    output: list[str] = []
    for check in checks:
        if not check.passed and check.severity is CheckSeverity.ERROR and check.reason_code:
            if check.reason_code not in output:
                output.append(check.reason_code)
    return output


def _add_failure(result: CompletenessResult, check: CheckResult) -> CompletenessResult:
    return _add_check(result, check)


def _add_check(result: CompletenessResult, check: CheckResult) -> CompletenessResult:
    checks = result.checks + (check,)
    failure_codes = _failure_codes(checks)
    return CompletenessResult(
        status=GateStatus.FAIL if failure_codes else GateStatus.PASS,
        deliverable_type=result.deliverable_type,
        checks=checks,
        failure_codes=tuple(failure_codes),
        metrics=result.metrics,
        contract_version=result.contract_version,
        checker_version=result.checker_version,
    )
