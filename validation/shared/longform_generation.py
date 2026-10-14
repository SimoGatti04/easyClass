"""Implementation-neutral bounded longform generation with deterministic section repair."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from difflib import SequenceMatcher
import hashlib
import json
import re
from typing import Any, Callable, Protocol

from validation.shared.evidence import EvidencePack, EvidenceView

LONGFORM_SCHEMA_VERSION = "longform-generation-v1"
REQUEST_SCHEMA_VERSION = "longform-request-v1"
ATTRIBUTION_CONTRACT_VERSION = "epistemic-attribution-v1"
ATTRIBUTION_CONTRACT = (
    "Distinguish SOURCE_FACT (verified source statement), GENERAL_DOMAIN_KNOWLEDGE "
    "(disciplinary knowledge not attributed to the source), PEDAGOGICAL_PROPOSAL "
    "(a suggested teaching choice), and expected/example classroom responses. "
    "Phrase simulated responses as a possible or expected response, or as something "
    "a student might say; never present them as observed events."
)


class LongformContractError(ValueError):
    """A task, plan, or request violates the longform contract."""


class LongformBindingError(ValueError):
    """A section artifact is not bound to the exact plan being assembled."""


def _plain(value: Any) -> Any:
    if isinstance(value, Mapping):
        if any(not isinstance(key, str) for key in value):
            raise LongformContractError("object keys must be strings")
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    return value


def canonical_json(value: Any) -> str:
    try:
        return json.dumps(
            _plain(value), sort_keys=True, separators=(",", ":"),
            ensure_ascii=False, allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        raise LongformContractError(f"value is not strict JSON data: {exc}") from exc


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def _string(value: Any, label: str, *, allow_blank: bool = False) -> str:
    if not isinstance(value, str) or (not allow_blank and not value.strip()):
        raise LongformContractError(f"{label} must be a non-blank string")
    return value


def _string_tuple(value: Sequence[Any], label: str) -> tuple[str, ...]:
    if isinstance(value, (str, bytes)) or not isinstance(value, Sequence):
        raise LongformContractError(f"{label} must be a list of strings")
    result = tuple(_string(item, label) for item in value)
    return result


@dataclass(frozen=True)
class LongformTaskContract:
    task_id: str
    version: str
    duration_minutes: int
    total_target_words: int
    minimum_total_words: int
    maximum_total_words: int
    minimum_sections: int = 4
    maximum_sections: int = 6
    section_minimum_ratio: float = 0.78
    section_maximum_ratio: float = 1.30
    maximum_repair_token_edit_ratio: float = 1.0
    max_repair_calls_per_section: int = 1
    request_version: str = REQUEST_SCHEMA_VERSION
    attribution_contract_version: str = ATTRIBUTION_CONTRACT_VERSION

    def __post_init__(self) -> None:
        for name in ("task_id", "version", "request_version", "attribution_contract_version"):
            object.__setattr__(self, name, _string(getattr(self, name), name))
        for name in (
            "duration_minutes", "total_target_words", "minimum_total_words",
            "maximum_total_words", "minimum_sections", "maximum_sections",
        ):
            value = getattr(self, name)
            if type(value) is not int or value <= 0:
                raise LongformContractError(f"{name} must be a positive integer")
        if self.minimum_sections < 4 or self.maximum_sections > 6:
            raise LongformContractError("the plan must require between four and six sections")
        if self.minimum_sections > self.maximum_sections:
            raise LongformContractError("minimum_sections exceeds maximum_sections")
        if not self.minimum_total_words <= self.total_target_words <= self.maximum_total_words:
            raise LongformContractError("total target must be within the configured word budget")
        if not 0 < self.section_minimum_ratio <= 1:
            raise LongformContractError("section_minimum_ratio must be in (0, 1]")
        if self.section_maximum_ratio < 1:
            raise LongformContractError("section_maximum_ratio must be at least 1")
        if not 0 <= self.maximum_repair_token_edit_ratio <= 1:
            raise LongformContractError("maximum_repair_token_edit_ratio must be in [0, 1]")
        if self.max_repair_calls_per_section != 1:
            raise LongformContractError("the contract permits at most one repair call per section")

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": LONGFORM_SCHEMA_VERSION,
            "task_id": self.task_id,
            "version": self.version,
            "duration_minutes": self.duration_minutes,
            "total_target_words": self.total_target_words,
            "minimum_total_words": self.minimum_total_words,
            "maximum_total_words": self.maximum_total_words,
            "minimum_sections": self.minimum_sections,
            "maximum_sections": self.maximum_sections,
            "section_minimum_ratio": self.section_minimum_ratio,
            "section_maximum_ratio": self.section_maximum_ratio,
            "maximum_repair_token_edit_ratio": self.maximum_repair_token_edit_ratio,
            "max_repair_calls_per_section": self.max_repair_calls_per_section,
            "request_version": self.request_version,
            "attribution_contract_version": self.attribution_contract_version,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "LongformTaskContract":
        if data.get("schema_version") != LONGFORM_SCHEMA_VERSION:
            raise LongformContractError("unsupported task contract schema")
        return cls(**{key: data[key] for key in cls.__dataclass_fields__ if key in data})

    def section_word_range(self, target_words: int) -> tuple[int, int]:
        if type(target_words) is not int or target_words <= 0:
            raise LongformContractError("section target_words must be positive")
        return (
            max(1, int(target_words * self.section_minimum_ratio)),
            max(1, int(target_words * self.section_maximum_ratio)),
        )


@dataclass(frozen=True)
class LongformSectionSpec:
    section_id: str
    title: str
    start_minute: int
    end_minute: int
    target_words: int
    focus: str
    objective: str
    source_anchors: tuple[str, ...] = ()
    evidence_requirements: tuple[str, ...] = ()
    teacher_moves: tuple[str, ...] = ()
    student_practice_feedback: str = ""
    transition_to_next: str = ""

    def __post_init__(self) -> None:
        for name in ("section_id", "title", "focus", "objective"):
            object.__setattr__(self, name, _string(getattr(self, name), name))
        if type(self.start_minute) is not int or type(self.end_minute) is not int:
            raise LongformContractError("section times must be integers")
        if type(self.target_words) is not int or self.target_words <= 0:
            raise LongformContractError("section target_words must be a positive integer")
        for name in ("source_anchors", "evidence_requirements", "teacher_moves"):
            object.__setattr__(self, name, _string_tuple(getattr(self, name), name))
        object.__setattr__(self, "student_practice_feedback", _string(self.student_practice_feedback, "student_practice_feedback", allow_blank=True))
        object.__setattr__(self, "transition_to_next", _string(self.transition_to_next, "transition_to_next", allow_blank=True))

    def to_dict(self) -> dict[str, Any]:
        return {
            "section_id": self.section_id,
            "title": self.title,
            "start_minute": self.start_minute,
            "end_minute": self.end_minute,
            "target_words": self.target_words,
            "focus": self.focus,
            "objective": self.objective,
            "source_anchors": list(self.source_anchors),
            "evidence_requirements": list(self.evidence_requirements),
            "teacher_moves": list(self.teacher_moves),
            "student_practice_feedback": self.student_practice_feedback,
            "transition_to_next": self.transition_to_next,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "LongformSectionSpec":
        required = set(cls.__dataclass_fields__)
        if set(data) != required:
            raise LongformContractError("section fields do not match the versioned plan contract")
        return cls(**dict(data))


@dataclass(frozen=True)
class LongformPlan:
    title: str
    duration_minutes: int
    total_target_words: int
    sections: tuple[LongformSectionSpec, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "title", _string(self.title, "plan title"))
        object.__setattr__(self, "sections", tuple(self.sections))
        if type(self.duration_minutes) is not int or type(self.total_target_words) is not int:
            raise LongformContractError("plan duration and total target must be integers")
        if any(not isinstance(section, LongformSectionSpec) for section in self.sections):
            raise LongformContractError("plan sections must use LongformSectionSpec")

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "duration_minutes": self.duration_minutes,
            "total_target_words": self.total_target_words,
            "sections": [section.to_dict() for section in self.sections],
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "LongformPlan":
        if set(data) != {"title", "duration_minutes", "total_target_words", "sections"}:
            raise LongformContractError("plan top-level fields do not match the contract")
        if not isinstance(data["sections"], list):
            raise LongformContractError("plan sections must be a list")
        return cls(
            title=data["title"],
            duration_minutes=data["duration_minutes"],
            total_target_words=data["total_target_words"],
            sections=tuple(LongformSectionSpec.from_dict(item) for item in data["sections"]),
        )


@dataclass(frozen=True)
class PlanValidationResult:
    status: str
    schema_valid: bool
    semantic_valid: bool
    errors: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "schema_valid": self.schema_valid,
            "semantic_valid": self.semantic_valid,
            "errors": list(self.errors),
        }


def validate_plan(plan: LongformPlan, contract: LongformTaskContract) -> PlanValidationResult:
    errors: list[str] = []
    if len(plan.sections) < contract.minimum_sections or len(plan.sections) > contract.maximum_sections:
        errors.append("section_count_outside_contract")
    if plan.duration_minutes != contract.duration_minutes:
        errors.append("duration_does_not_match_contract")
    if plan.total_target_words != contract.total_target_words:
        errors.append("total_target_does_not_match_contract")
    if not contract.minimum_total_words <= plan.total_target_words <= contract.maximum_total_words:
        errors.append("total_target_outside_configured_budget")
    if sum(section.target_words for section in plan.sections) != plan.total_target_words:
        errors.append("section_targets_do_not_sum_to_total")
    identifiers = [section.section_id for section in plan.sections]
    if len(identifiers) != len(set(identifiers)):
        errors.append("section_ids_not_unique")
    if plan.sections:
        if plan.sections[0].start_minute != 0:
            errors.append("coverage_does_not_start_at_zero")
        if plan.sections[-1].end_minute != contract.duration_minutes:
            errors.append("coverage_does_not_end_at_duration")
        for index, section in enumerate(plan.sections):
            if section.start_minute >= section.end_minute:
                errors.append(f"invalid_interval:{section.section_id}")
            if index and plan.sections[index - 1].end_minute != section.start_minute:
                errors.append(f"gap_or_overlap:{section.section_id}")
    semantic_valid = not errors
    return PlanValidationResult(
        status="PASS" if semantic_valid else "FAIL",
        schema_valid=True,
        semantic_valid=semantic_valid,
        errors=tuple(errors),
    )


def parse_plan_json(text: str) -> LongformPlan:
    def strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise LongformContractError(f"duplicate JSON key: {key}")
            result[key] = value
        return result
    try:
        data = json.loads(text, object_pairs_hook=strict_object, parse_constant=lambda value: (_ for _ in ()).throw(LongformContractError(f"invalid JSON constant: {value}")))
        return LongformPlan.from_dict(data)
    except (json.JSONDecodeError, TypeError, KeyError) as exc:
        raise LongformContractError(f"invalid plan JSON: {exc}") from exc


@dataclass(frozen=True)
class FrozenLongformPlan:
    plan: LongformPlan
    plan_id: str
    plan_hash: str
    task_contract: Mapping[str, Any]
    source_context_hash: str
    prompt_evidence_hash: str | None
    request_hash: str
    validation_result: PlanValidationResult

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": LONGFORM_SCHEMA_VERSION,
            "plan_id": self.plan_id,
            "plan_hash": self.plan_hash,
            "plan": self.plan.to_dict(),
            "task_contract": _plain(self.task_contract),
            "source_context_hash": self.source_context_hash,
            "prompt_evidence_hash": self.prompt_evidence_hash,
            "request_hash": self.request_hash,
            "validation_result": self.validation_result.to_dict(),
        }

    @classmethod
    def build(
        cls, plan: LongformPlan, contract: LongformTaskContract, *,
        source_context_hash: str, prompt_evidence_hash: str | None,
        request_hash: str, validation_result: PlanValidationResult,
    ) -> "FrozenLongformPlan":
        identity = {
            "schema_version": LONGFORM_SCHEMA_VERSION,
            "plan": plan.to_dict(),
            "task_contract": contract.to_dict(),
            "source_context_hash": source_context_hash,
            "prompt_evidence_hash": prompt_evidence_hash,
            "request_hash": request_hash,
            "validation_result": validation_result.to_dict(),
        }
        digest = sha256_json(identity)
        return cls(
            plan=plan, plan_id=f"lfp_{digest[:24]}", plan_hash=digest,
            task_contract=contract.to_dict(), source_context_hash=source_context_hash,
            prompt_evidence_hash=prompt_evidence_hash, request_hash=request_hash,
            validation_result=validation_result,
        )


@dataclass(frozen=True)
class LongformPlanRequest:
    task_contract: Mapping[str, Any]
    task_context: Mapping[str, Any]
    source_context: str
    prompt_evidence: Mapping[str, Any]
    instructions: str
    request_hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "request_type": "plan",
            "task_contract": _plain(self.task_contract),
            "task_context": _plain(self.task_context),
            "source_context": self.source_context,
            "prompt_evidence": _plain(self.prompt_evidence),
            "instructions": self.instructions,
            "request_hash": self.request_hash,
        }


@dataclass(frozen=True)
class LongformSectionRequest:
    frozen_plan_reference: Mapping[str, str]
    section_index: int
    section_spec: Mapping[str, Any]
    task_context: Mapping[str, Any]
    source_context: str
    prompt_evidence: Mapping[str, Any]
    instructions: str
    target_word_budget: Mapping[str, int]
    request_hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "request_type": "section",
            "frozen_plan_reference": _plain(self.frozen_plan_reference),
            "section_index": self.section_index,
            "section_spec": _plain(self.section_spec),
            "task_context": _plain(self.task_context),
            "source_context": self.source_context,
            "prompt_evidence": _plain(self.prompt_evidence),
            "instructions": self.instructions,
            "target_word_budget": _plain(self.target_word_budget),
            "request_hash": self.request_hash,
        }


@dataclass(frozen=True)
class LongformRepairRequest:
    frozen_plan_reference: Mapping[str, str]
    section_spec: Mapping[str, Any]
    exact_section_text: str
    structured_issues: tuple[Mapping[str, Any], ...]
    supporting_evidence: tuple[Mapping[str, Any], ...]
    instructions: str
    target_word_budget: Mapping[str, int]
    request_hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "request_type": "repair",
            "frozen_plan_reference": _plain(self.frozen_plan_reference),
            "section_spec": _plain(self.section_spec),
            "exact_section_text": self.exact_section_text,
            "structured_issues": [_plain(item) for item in self.structured_issues],
            "supporting_evidence": [_plain(item) for item in self.supporting_evidence],
            "instructions": self.instructions,
            "target_word_budget": _plain(self.target_word_budget),
            "request_hash": self.request_hash,
        }


@dataclass(frozen=True)
class LongformGenerationResponse:
    technical_complete: bool
    finish_reason: str
    content: str


class LongformBackend(Protocol):
    def generate_plan(self, request: LongformPlanRequest) -> LongformGenerationResponse: ...
    def generate_section(self, request: LongformSectionRequest) -> LongformGenerationResponse: ...
    def repair_section(self, request: LongformRepairRequest) -> LongformGenerationResponse: ...


@dataclass(frozen=True)
class SectionIssue:
    issue_code: str
    message: str
    offending_span: str | None = None
    supporting_evidence_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "issue_code", _string(self.issue_code, "issue_code"))
        object.__setattr__(self, "message", _string(self.message, "issue message"))
        if self.offending_span is not None:
            object.__setattr__(self, "offending_span", _string(self.offending_span, "offending_span"))
        object.__setattr__(self, "supporting_evidence_ids", tuple(sorted(set(_string_tuple(self.supporting_evidence_ids, "supporting_evidence_ids")))) )

    @property
    def fingerprint(self) -> str:
        return sha256_json({
            "issue_code": self.issue_code,
            "supporting_evidence_ids": list(self.supporting_evidence_ids),
        })

    def to_dict(self) -> dict[str, Any]:
        """Return the full local audit record; do not pass directly to a model."""
        return {
            "issue_id": self.fingerprint,
            "issue_code": self.issue_code,
            "message": self.message,
            "offending_span": self.offending_span,
            "supporting_evidence_ids": list(self.supporting_evidence_ids),
        }

    def to_repair_record(self, prompt_visible_evidence_ids: Sequence[str]) -> dict[str, Any]:
        """Return a model-safe issue projection without validator-private message text."""
        allowed_ids = set(prompt_visible_evidence_ids)
        required_ids = set(self.supporting_evidence_ids)
        if not required_ids.issubset(allowed_ids):
            raise LongformContractError("repair issue cites evidence outside the prompt-visible view")
        public_identity = {
            "issue_code": self.issue_code,
            "offending_span": self.offending_span,
            "supporting_evidence_ids": sorted(required_ids),
        }
        return {
            "issue_id": f"rpi_{sha256_json(public_identity)}",
            "issue_code": self.issue_code,
            "offending_span": self.offending_span,
            "supporting_evidence_ids": sorted(required_ids),
        }


@dataclass(frozen=True)
class SectionValidationResult:
    hard_issues: tuple[SectionIssue, ...] = ()
    warnings: tuple[SectionIssue, ...] = ()
    validator_version: str = "1.0.0"

    def __post_init__(self) -> None:
        if any(not isinstance(issue, SectionIssue) for issue in self.hard_issues + self.warnings):
            raise LongformContractError("validator results must contain SectionIssue instances")
        object.__setattr__(self, "validator_version", _string(self.validator_version, "validator_version"))

    def to_dict(self) -> dict[str, Any]:
        return {
            "hard_issues": [issue.to_dict() for issue in self.hard_issues],
            "warnings": [issue.to_dict() for issue in self.warnings],
            "validator_version": self.validator_version,
        }


class SectionValidator(Protocol):
    def validate(
        self, section_text: str, section_spec: LongformSectionSpec,
        validation_evidence: EvidenceView,
    ) -> SectionValidationResult: ...


class NoOpSectionValidator:
    """A replay adapter used only where no typed factual rule is declared."""
    version = "noop-1.0.0"

    def validate(self, section_text: str, section_spec: LongformSectionSpec, validation_evidence: EvidenceView) -> SectionValidationResult:
        return SectionValidationResult(validator_version=self.version)


@dataclass(frozen=True)
class RepairDecision:
    attempted: bool
    selected: bool
    reason: str
    token_edit_ratio: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "attempted": self.attempted,
            "selected": self.selected,
            "reason": self.reason,
            "token_edit_ratio": self.token_edit_ratio,
        }


@dataclass(frozen=True)
class SectionDraft:
    section_id: str
    plan_hash: str
    text: str
    section_index: int
    validation: SectionValidationResult
    word_count: int
    repair_decision: RepairDecision = RepairDecision(False, False, "not_needed")
    initial_text: str | None = None
    initial_validation: SectionValidationResult | None = None
    repair_request: Mapping[str, Any] | None = None
    repair_response: LongformGenerationResponse | None = None
    repair_validation: SectionValidationResult | None = None
    repair_visibility_blocked_evidence_ids: tuple[str, ...] = ()
    state: str = "SECTION_VALIDATED"

    def to_dict(self) -> dict[str, Any]:
        return {
            "section_id": self.section_id,
            "plan_hash": self.plan_hash,
            "section_index": self.section_index,
            "initial_text": self.initial_text if self.initial_text is not None else self.text,
            "initial_validation": (self.initial_validation or self.validation).to_dict(),
            "repair_request": _plain(self.repair_request) if self.repair_request is not None else None,
            "repair_response": None if self.repair_response is None else {
                "technical_complete": self.repair_response.technical_complete,
                "finish_reason": self.repair_response.finish_reason,
                "content": self.repair_response.content,
            },
            "repair_validation": self.repair_validation.to_dict() if self.repair_validation else None,
            "repair_visibility_blocked_evidence_ids": list(self.repair_visibility_blocked_evidence_ids),
            "repair_decision": self.repair_decision.to_dict(),
            "final_text": self.text,
            "final_validation": self.validation.to_dict(),
            "word_count": self.word_count,
            "state": self.state,
        }


def _word_count(text: str) -> int:
    return len(text.split())


def _with_budget_issues(
    result: SectionValidationResult, text: str, section: LongformSectionSpec,
    contract: LongformTaskContract,
) -> SectionValidationResult:
    count = _word_count(text)
    minimum, maximum = contract.section_word_range(section.target_words)
    issues = list(result.hard_issues)
    if count < minimum:
        issues.append(SectionIssue("SECTION_WORD_BUDGET_LOW", f"Observed {count} words; minimum is {minimum}.", f"word_count={count}"))
    if count > maximum:
        issues.append(SectionIssue("SECTION_WORD_BUDGET_HIGH", f"Observed {count} words; maximum is {maximum}.", f"word_count={count}"))
    return SectionValidationResult(tuple(issues), result.warnings, result.validator_version)


def _validate(
    validator: SectionValidator, text: str, section: LongformSectionSpec,
    pack: EvidencePack | None, contract: LongformTaskContract,
) -> SectionValidationResult:
    view = pack.for_validation() if pack is not None else EvidencePack.build([]).for_validation()
    result = validator.validate(text, section, view)
    if not isinstance(result, SectionValidationResult):
        raise LongformContractError("validator returned an invalid result type")
    allowed_ids = {item.evidence_id for item in view.items}
    for issue in result.hard_issues + result.warnings:
        if not set(issue.supporting_evidence_ids).issubset(allowed_ids):
            raise LongformContractError("validator cited evidence outside the scoped validation view")
    return _with_budget_issues(result, text, section, contract)


def _tokens(text: str) -> list[str]:
    return re.findall(r"\w+", text.casefold(), flags=re.UNICODE)


def _token_edit_ratio(before: str, after: str) -> float:
    left, right = _tokens(before), _tokens(after)
    if not left and not right:
        return 0.0
    return round(1.0 - SequenceMatcher(a=left, b=right, autojunk=False).ratio(), 6)


def _build_plan_request(
    contract: LongformTaskContract, task_context: Mapping[str, Any],
    source_context: str, evidence: EvidencePack | None, instructions: str,
) -> LongformPlanRequest:
    evidence_view = evidence.for_prompt().to_dict() if evidence is not None else {
        "view_schema_version": "evidence-pack-v1", "scope": "PROMPT_VISIBLE", "items": []
    }
    base = {
        "request_type": "plan", "task_contract": contract.to_dict(),
        "task_context": _plain(task_context), "source_context": source_context,
        "prompt_evidence": evidence_view, "instructions": instructions,
    }
    return LongformPlanRequest(
        task_contract=contract.to_dict(), task_context=_plain(task_context),
        source_context=source_context, prompt_evidence=evidence_view,
        instructions=f"{instructions}\n\n{ATTRIBUTION_CONTRACT}", request_hash=sha256_json({**base, "instructions": f"{instructions}\n\n{ATTRIBUTION_CONTRACT}"}),
    )


def _build_section_request(
    frozen: FrozenLongformPlan, section: LongformSectionSpec, index: int,
    contract: LongformTaskContract, task_context: Mapping[str, Any],
    source_context: str, evidence: EvidencePack | None, instructions: str,
) -> LongformSectionRequest:
    prompt_view = evidence.for_prompt().to_dict() if evidence is not None else {
        "view_schema_version": "evidence-pack-v1", "scope": "PROMPT_VISIBLE", "items": []
    }
    minimum, maximum = contract.section_word_range(section.target_words)
    base = {
        "request_type": "section",
        "frozen_plan_reference": {"plan_id": frozen.plan_id, "plan_hash": frozen.plan_hash},
        "section_index": index, "section_spec": section.to_dict(),
        "task_context": _plain(task_context), "source_context": source_context,
        "prompt_evidence": prompt_view,
        "instructions": f"{instructions}\n\n{ATTRIBUTION_CONTRACT}",
        "target_word_budget": {"target": section.target_words, "minimum": minimum, "maximum": maximum},
    }
    return LongformSectionRequest(
        frozen_plan_reference=base["frozen_plan_reference"],
        section_index=base["section_index"], section_spec=base["section_spec"],
        task_context=base["task_context"], source_context=base["source_context"],
        prompt_evidence=base["prompt_evidence"], instructions=base["instructions"],
        target_word_budget=base["target_word_budget"], request_hash=sha256_json(base),
    )


def _build_repair_request(
    frozen: FrozenLongformPlan, section: LongformSectionSpec, text: str,
    issues: tuple[SectionIssue, ...], pack: EvidencePack | None,
    contract: LongformTaskContract,
) -> LongformRepairRequest:
    allowed = pack.for_prompt().items if pack is not None else ()
    allowed_ids = {item.evidence_id for item in allowed}
    requested_ids = {evidence_id for issue in issues for evidence_id in issue.supporting_evidence_ids}
    if not requested_ids.issubset(allowed_ids):
        raise LongformContractError("repair evidence request exceeds the prompt-visible section view")
    by_id = {item.evidence_id: item for item in allowed}
    selected_evidence = tuple(
        by_id[evidence_id].to_model_record() for evidence_id in sorted(requested_ids)
    )
    structured = tuple(issue.to_repair_record(allowed_ids) for issue in issues)
    minimum, maximum = contract.section_word_range(section.target_words)
    base = {
        "request_type": "repair",
        "frozen_plan_reference": {"plan_id": frozen.plan_id, "plan_hash": frozen.plan_hash},
        "section_spec": section.to_dict(), "exact_section_text": text,
        "structured_issues": [_plain(item) for item in structured],
        "supporting_evidence": [_plain(item) for item in selected_evidence],
        "instructions": "Correct only the indicated issue using the supplied prompt-visible evidence; preserve all unrelated wording and structure. Return only the corrected section.\n\n" + ATTRIBUTION_CONTRACT,
        "target_word_budget": {"target": section.target_words, "minimum": minimum, "maximum": maximum},
    }
    return LongformRepairRequest(
        frozen_plan_reference=base["frozen_plan_reference"],
        section_spec=base["section_spec"], exact_section_text=base["exact_section_text"],
        structured_issues=structured, supporting_evidence=selected_evidence,
        instructions=base["instructions"], target_word_budget=base["target_word_budget"],
        request_hash=sha256_json(base),
    )


def _validation_has_hard_issues(result: SectionValidationResult) -> bool:
    return bool(result.hard_issues)


def _response_usable(response: LongformGenerationResponse) -> bool:
    return (
        isinstance(response, LongformGenerationResponse)
        and response.technical_complete is True
        and response.finish_reason == "stop"
        and isinstance(response.content, str)
        and bool(response.content.strip())
    )


def run_longform(
    *, contract: LongformTaskContract, backend: LongformBackend,
    validator: SectionValidator, task_context: Mapping[str, Any],
    plan_source_context: str, section_source_contexts: Mapping[str, str],
    plan_evidence_pack: EvidencePack | None = None,
    section_evidence_packs: Mapping[str, EvidencePack] | None = None,
    section_evidence_resolver: Callable[[LongformSectionSpec], EvidencePack | None] | None = None,
    plan_instructions: str = "Create one declarative plan; do not draft the sections.",
    section_instructions: str = "Write only the requested bounded section as a spoken draft.",
) -> dict[str, Any]:
    """Run the canonical plan/sections/assembly path with one repair at most."""
    if not isinstance(contract, LongformTaskContract):
        raise LongformContractError("contract must be LongformTaskContract")
    task_context = _plain(task_context)
    if not isinstance(task_context, dict):
        raise LongformContractError("task_context must be a JSON object")
    if not isinstance(section_source_contexts, Mapping):
        raise LongformContractError("section_source_contexts must be a mapping")
    packs = dict(section_evidence_packs or {})
    if any(not isinstance(value, EvidencePack) for value in packs.values()):
        raise LongformContractError("section evidence entries must be EvidencePack instances")
    if plan_evidence_pack is not None and not isinstance(plan_evidence_pack, EvidencePack):
        raise LongformContractError("plan_evidence_pack must be EvidencePack or None")
    source_context_hash = sha256_json({
        "plan": plan_source_context,
        "sections": {key: section_source_contexts[key] for key in sorted(section_source_contexts)},
    })
    plan_request = _build_plan_request(
        contract, task_context, plan_source_context, plan_evidence_pack, plan_instructions,
    )
    plan_prompt_evidence_hash = sha256_json(plan_request.prompt_evidence)
    result: dict[str, Any] = {
        "state": None, "technical_pass": False, "plan_validation": None,
        "frozen_plan": None, "sections": [], "assembled_text": None,
        "review_item": None, "backend_call_count": 0, "canonical_plan_request": plan_request.to_dict(),
    }
    try:
        plan_response = backend.generate_plan(plan_request)
        result["backend_call_count"] += 1
    except Exception as exc:
        result.update(state="PLAN_TECHNICAL_FAILURE", failure_code=f"backend_exception:{type(exc).__name__}")
        return result
    if not _response_usable(plan_response):
        result.update(
            state="PLAN_TECHNICAL_FAILURE", failure_code="plan_technical_completion_failed",
            plan_response={"technical_complete": getattr(plan_response, "technical_complete", False),
                           "finish_reason": getattr(plan_response, "finish_reason", "unknown")},
        )
        return result
    try:
        plan = parse_plan_json(plan_response.content)
    except Exception as exc:
        result.update(state="PLAN_SCHEMA_FAILURE", failure_code=f"plan_parse_or_schema_failure:{type(exc).__name__}")
        return result
    validation = validate_plan(plan, contract)
    result["plan_validation"] = validation.to_dict()
    if not validation.semantic_valid:
        result.update(state="PLAN_VALIDATION_FAILURE", failure_code="plan_validation_failed")
        return result
    frozen = FrozenLongformPlan.build(
        plan, contract, source_context_hash=source_context_hash,
        prompt_evidence_hash=plan_prompt_evidence_hash,
        request_hash=plan_request.request_hash, validation_result=validation,
    )
    result["frozen_plan"] = frozen.to_dict()
    section_drafts: list[SectionDraft] = []
    for index, section in enumerate(plan.sections):
        source_context = section_source_contexts.get(section.section_id, "")
        # Optional resolver is a domain-neutral hook for callers that bind evidence
        # after the model plan is frozen. It receives the declared section contract,
        # never section order or a benchmark-specific section ID.
        pack = section_evidence_resolver(section) if section_evidence_resolver is not None else packs.get(section.section_id)
        if pack is not None and not isinstance(pack, EvidencePack):
            raise LongformContractError("section evidence resolver must return EvidencePack or None")
        request = _build_section_request(
            frozen, section, index, contract, task_context, source_context,
            pack, section_instructions,
        )
        try:
            response = backend.generate_section(request)
            result["backend_call_count"] += 1
        except Exception as exc:
            result["sections"].append({
                "section_id": section.section_id, "section_index": index,
                "state": "SECTION_TECHNICAL_FAILURE", "failure_code": f"backend_exception:{type(exc).__name__}",
                "initial_text": None, "final_text": None,
            })
            result.update(state="LONGFORM_INCOMPLETE", failure_code="section_generation_failed")
            return result
        if not _response_usable(response):
            result["sections"].append({
                "section_id": section.section_id, "section_index": index,
                "state": "SECTION_TECHNICAL_FAILURE", "failure_code": "section_technical_completion_failed",
                "finish_reason": getattr(response, "finish_reason", "unknown"),
                "initial_text": getattr(response, "content", None), "final_text": None,
            })
            result.update(state="LONGFORM_INCOMPLETE", failure_code="section_generation_failed")
            return result
        initial_text = response.content
        try:
            initial_validation = _validate(validator, initial_text, section, pack, contract)
        except Exception as exc:
            result["sections"].append({
                "section_id": section.section_id, "section_index": index,
                "state": "SECTION_VALIDATION_ISSUES", "failure_code": f"validator_exception:{type(exc).__name__}",
                "initial_text": initial_text, "final_text": initial_text,
            })
            result.update(state="LONGFORM_INCOMPLETE", failure_code="section_validation_failed")
            return result
        final_text = initial_text
        final_validation = initial_validation
        repair_request = None
        repair_response = None
        repair_validation = None
        repair_visibility_blocked_ids: tuple[str, ...] = ()
        repair_decision = RepairDecision(False, False, "no_repair_required")
        section_state = "SECTION_VALIDATED"
        if _validation_has_hard_issues(initial_validation):
            prompt_ids = {
                item.evidence_id
                for item in (pack.for_prompt().items if pack is not None else ())
            }
            required_ids = {
                evidence_id
                for issue in initial_validation.hard_issues
                for evidence_id in issue.supporting_evidence_ids
            }
            repair_visibility_blocked_ids = tuple(sorted(required_ids - prompt_ids))
            if repair_visibility_blocked_ids:
                repair_decision = RepairDecision(
                    False, False, "REPAIR_BLOCKED_BY_EVIDENCE_VISIBILITY",
                )
                section_state = "SECTION_REPAIR_BLOCKED_BY_EVIDENCE_VISIBILITY"
            else:
                repair_request = _build_repair_request(
                    frozen, section, initial_text, initial_validation.hard_issues,
                    pack, contract,
                )
                try:
                    repair_response = backend.repair_section(repair_request)
                    result["backend_call_count"] += 1
                except Exception as exc:
                    repair_decision = RepairDecision(True, False, f"repair_backend_exception:{type(exc).__name__}")
                    section_state = "SECTION_REPAIR_FAILED"
                else:
                    if _response_usable(repair_response):
                        try:
                            repair_validation = _validate(validator, repair_response.content, section, pack, contract)
                        except Exception as exc:
                            repair_decision = RepairDecision(True, False, f"repair_validation_exception:{type(exc).__name__}")
                            section_state = "SECTION_REPAIR_FAILED"
                        else:
                            before = {issue.fingerprint for issue in initial_validation.hard_issues}
                            after = {issue.fingerprint for issue in repair_validation.hard_issues}
                            resolved = before.isdisjoint(after)
                            no_new_hard_issues = after.issubset(before)
                            drift = _token_edit_ratio(initial_text, repair_response.content)
                            drift_ok = drift <= contract.maximum_repair_token_edit_ratio
                            accepted = resolved and no_new_hard_issues and drift_ok
                            if accepted:
                                final_text = repair_response.content
                                final_validation = repair_validation
                                section_state = "SECTION_REPAIRED"
                                reason = "targeted_issues_resolved_revalidated_and_drift_within_limit"
                            else:
                                section_state = "SECTION_REPAIR_FAILED"
                                reasons = []
                                if not resolved:
                                    reasons.append("targeted_issue_remains")
                                if not no_new_hard_issues:
                                    reasons.append("new_hard_issue_introduced")
                                if not drift_ok:
                                    reasons.append("repair_drift_exceeds_configured_limit")
                                reason = reasons[0] if reasons else "repair_rejected"
                                for reason_part in reasons[1:]:
                                    reason += ";" + reason_part
                            repair_decision = RepairDecision(True, accepted, reason, drift)
                    else:
                        repair_decision = RepairDecision(True, False, "repair_technical_completion_failed")
                        section_state = "SECTION_REPAIR_FAILED"
        draft = SectionDraft(
            section_id=section.section_id, plan_hash=frozen.plan_hash,
            text=final_text, section_index=index, validation=final_validation,
            word_count=_word_count(final_text), repair_decision=repair_decision,
            initial_text=initial_text, initial_validation=initial_validation,
            repair_request=repair_request.to_dict() if repair_request else None,
            repair_response=repair_response, repair_validation=repair_validation,
            repair_visibility_blocked_evidence_ids=repair_visibility_blocked_ids,
            state=section_state,
        )
        section_drafts.append(draft)
        result["sections"].append(draft.to_dict())

    if len(section_drafts) != len(plan.sections):
        result.update(state="LONGFORM_INCOMPLETE", failure_code="section_set_incomplete")
        return result
    try:
        assembled = assemble_sections(frozen, section_drafts)
    except LongformBindingError as exc:
        result.update(state="LONGFORM_INCOMPLETE", failure_code=f"assembly_rejected:{exc}")
        return result
    total_words = _word_count(assembled)
    total_issue = None
    if not contract.minimum_total_words <= total_words <= contract.maximum_total_words:
        total_issue = SectionIssue(
            "TOTAL_WORD_BUDGET_OUTSIDE_RANGE",
            f"Observed {total_words} assembled words; configured range is {contract.minimum_total_words}–{contract.maximum_total_words}.",
        )
    unresolved = [
        issue.to_dict()
        for draft in section_drafts
        for issue in draft.validation.hard_issues
    ]
    if total_issue is not None:
        unresolved.append(total_issue.to_dict())
    technical_pass = not unresolved
    state = "LONGFORM_COMPLETE_PENDING_REVIEW" if technical_pass else "LONGFORM_COMPLETE_WITH_ISSUES"
    result.update(
        state=state, technical_pass=technical_pass, assembled_text=assembled,
        assembled_word_count=total_words,
        unresolved_hard_issues=unresolved,
        sections=[draft.to_dict() for draft in section_drafts],
        review_item={
            "artifact_state": "DRAFT", "review_state": "PENDING_L3_REVIEW",
            "requires_human_review": True, "apply_state": "NOT_APPLIED",
            "publish_state": "NOT_PUBLISHED",
        },
    )
    return result


def assemble_sections(
    frozen: FrozenLongformPlan, sections: Sequence[SectionDraft],
) -> str:
    expected_ids = [item.section_id for item in frozen.plan.sections]
    actual_ids = [item.section_id for item in sections]
    if actual_ids != expected_ids:
        raise LongformBindingError("section set or order differs from the frozen plan")
    if any(item.plan_hash != frozen.plan_hash for item in sections):
        raise LongformBindingError("section is bound to a different frozen plan")
    if any(not item.text.strip() for item in sections):
        raise LongformBindingError("section text is empty")
    assembled = ""
    for item in sections:
        if assembled:
            assembled += "\n\n"
        assembled += item.text.strip()
    return assembled
