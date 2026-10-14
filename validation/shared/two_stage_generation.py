"""Provider-neutral, local-verifiable two-stage draft generation contract."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json
from pathlib import Path
from types import MappingProxyType
from typing import Any, Protocol

from validation.shared.evidence import EvidencePack
from validation.shared.semantic_completeness import (
    DeliverableCompletenessContract,
    GateStatus,
    RequiredElement,
    evaluate_bundle,
    evaluate_deliverable,
)


PIPELINE_SCHEMA_VERSION = "two-stage-generation-v1"
REQUEST_SCHEMA_VERSION = "generation-request-v1"
STAGE1_FREEZE_SCHEMA_VERSION = "frozen-stage1-v1"
STAGE2_FREEZE_SCHEMA_VERSION = "frozen-stage2-v1"


class PipelineContractError(ValueError):
    """Invalid task contract or request payload."""


class PipelineArtifactConflictError(RuntimeError):
    """A deterministic artifact path already holds different content."""


class StageStatus(str, Enum):
    STAGE1_VALIDATED = "STAGE1_VALIDATED"
    STAGE1_TECHNICAL_FAILURE = "STAGE1_TECHNICAL_FAILURE"
    STAGE1_SCHEMA_FAILURE = "STAGE1_SCHEMA_FAILURE"
    STAGE1_COMPLETENESS_FAILURE = "STAGE1_COMPLETENESS_FAILURE"
    STAGE2_NOT_RUN = "STAGE2_NOT_RUN"
    STAGE2_VALIDATED = "STAGE2_VALIDATED"
    STAGE2_TECHNICAL_FAILURE = "STAGE2_TECHNICAL_FAILURE"
    STAGE2_SCHEMA_FAILURE = "STAGE2_SCHEMA_FAILURE"
    STAGE2_COMPLETENESS_FAILURE = "STAGE2_COMPLETENESS_FAILURE"
    ASSEMBLY_BLOCKED = "ASSEMBLY_BLOCKED"
    COMPLETE_PENDING_REVIEW = "COMPLETE_PENDING_REVIEW"


class BindingMismatchError(ValueError):
    """A second-stage result is not bound to the exact frozen first stage."""


def _canonical_json(value: Any) -> str:
    try:
        return json.dumps(
            _thaw_json(value),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        raise PipelineContractError(f"value is not strict JSON data: {exc}") from exc


def _sha256_json(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _snapshot_json(value: Any) -> Any:
    return json.loads(_canonical_json(value))


def _freeze_json(value: Any) -> Any:
    copied = _snapshot_json(value)
    if isinstance(copied, dict):
        return MappingProxyType({key: _freeze_json(item) for key, item in copied.items()})
    if isinstance(copied, list):
        return tuple(_freeze_json(item) for item in copied)
    return copied


def _thaw_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        if any(not isinstance(key, str) for key in value):
            raise PipelineContractError("JSON object keys must be strings")
        return {key: _thaw_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_thaw_json(item) for item in value]
    return value


def _nonblank(value: str, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PipelineContractError(f"{label} must be a non-blank string")
    return value.strip()


def _completeness_contract_dict(contract: DeliverableCompletenessContract) -> dict[str, Any]:
    return {
        "deliverable_type": contract.deliverable_type,
        "content_path": contract.content_path,
        "required_paths": list(contract.required_paths),
        "minimum_items_by_path": dict(contract.minimum_items_by_path),
        "minimum_word_count": contract.minimum_word_count,
        "minimum_distinct_tokens": contract.minimum_distinct_tokens,
        "required_elements": [
            {"name": element.name, "any_of": list(element.any_of)}
            for element in contract.required_elements
        ],
        "placeholder_markers": list(contract.placeholder_markers),
        "placeholder_sentence_ratio": contract.placeholder_sentence_ratio,
        "distinct_from": list(contract.distinct_from),
        "near_duplicate_threshold": contract.near_duplicate_threshold,
        "contract_version": contract.contract_version,
    }


@dataclass(frozen=True)
class GenerationTaskContract:
    """Caller-declared outputs, metadata policy, and C2 deliverable contracts."""

    task_id: str
    version: str
    required_metadata_keys: tuple[str, ...]
    optional_metadata_keys: tuple[str, ...]
    metadata_property_schemas: Mapping[str, Mapping[str, Any]]
    stage1_completeness: DeliverableCompletenessContract
    stage2_completeness: DeliverableCompletenessContract
    lesson_plan_min_characters: int = 60
    student_material_min_characters: int = 60
    request_version: str = REQUEST_SCHEMA_VERSION

    def __post_init__(self) -> None:
        object.__setattr__(self, "task_id", _nonblank(self.task_id, "task_id"))
        object.__setattr__(self, "version", _nonblank(self.version, "version"))
        object.__setattr__(self, "request_version", _nonblank(self.request_version, "request_version"))
        required = tuple(_nonblank(key, "required metadata key") for key in self.required_metadata_keys)
        optional = tuple(_nonblank(key, "optional metadata key") for key in self.optional_metadata_keys)
        if len(set(required)) != len(required) or len(set(optional)) != len(optional):
            raise PipelineContractError("metadata key lists must not contain duplicates")
        if set(required) & set(optional):
            raise PipelineContractError("metadata keys cannot be both required and optional")
        schemas = _snapshot_json(self.metadata_property_schemas)
        if not isinstance(schemas, dict) or set(schemas) != set(required) | set(optional):
            raise PipelineContractError("each required/optional metadata key needs exactly one schema")
        if any(not isinstance(schema, dict) or not schema for schema in schemas.values()):
            raise PipelineContractError("metadata property schemas must be non-empty JSON Schema objects")
        if not isinstance(self.stage1_completeness, DeliverableCompletenessContract):
            raise PipelineContractError("stage1_completeness must be a C2 contract")
        if not isinstance(self.stage2_completeness, DeliverableCompletenessContract):
            raise PipelineContractError("stage2_completeness must be a C2 contract")
        if self.stage1_completeness.content_path != "lesson_plan":
            raise PipelineContractError("Stage 1 C2 content_path must be lesson_plan")
        if self.stage2_completeness.content_path != "student_material":
            raise PipelineContractError("Stage 2 C2 content_path must be student_material")
        if self.stage1_completeness.deliverable_type not in self.stage2_completeness.distinct_from:
            raise PipelineContractError("Stage 2 C2 contract must compare against the Stage 1 deliverable")
        if self.lesson_plan_min_characters < 1 or self.student_material_min_characters < 1:
            raise PipelineContractError("minimum output lengths must be positive")
        object.__setattr__(self, "required_metadata_keys", required)
        object.__setattr__(self, "optional_metadata_keys", optional)
        object.__setattr__(self, "metadata_property_schemas", _freeze_json(schemas))

    @property
    def stage1_output_schema(self) -> dict[str, Any]:
        return {
            "schema_version": "local-json-schema-subset-v1",
            "type": "object",
            "properties": {
                "lesson_plan": {"type": "string", "minLength": self.lesson_plan_min_characters},
                "metadata": {
                    "type": "object",
                    "properties": _thaw_json(self.metadata_property_schemas),
                    "required": list(self.required_metadata_keys),
                    "additionalProperties": False,
                },
            },
            "required": ["lesson_plan", "metadata"],
            "additionalProperties": False,
        }

    @property
    def stage2_output_schema(self) -> dict[str, Any]:
        return {
            "schema_version": "local-json-schema-subset-v1",
            "type": "object",
            "properties": {
                "student_material": {
                    "type": "string",
                    "minLength": self.student_material_min_characters,
                }
            },
            "required": ["student_material"],
            "additionalProperties": False,
        }

    def request_contract_dict(self) -> dict[str, Any]:
        """Expose generation constraints without leaking validator-only policy details."""
        return {
            "task_id": self.task_id,
            "version": self.version,
            "required_metadata_keys": list(self.required_metadata_keys),
            "optional_metadata_keys": list(self.optional_metadata_keys),
            "stage1_output_schema": self.stage1_output_schema,
            "stage2_output_schema": self.stage2_output_schema,
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "task_id": self.task_id,
            "version": self.version,
            "request_version": self.request_version,
            "lesson_plan_min_characters": self.lesson_plan_min_characters,
            "student_material_min_characters": self.student_material_min_characters,
            "required_metadata_keys": list(self.required_metadata_keys),
            "optional_metadata_keys": list(self.optional_metadata_keys),
            "metadata_property_schemas": _thaw_json(self.metadata_property_schemas),
            "stage1_output_schema": self.stage1_output_schema,
            "stage2_output_schema": self.stage2_output_schema,
            "stage1_completeness": _completeness_contract_dict(self.stage1_completeness),
            "stage2_completeness": _completeness_contract_dict(self.stage2_completeness),
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "GenerationTaskContract":
        def make_c2(raw: Mapping[str, Any]) -> DeliverableCompletenessContract:
            return DeliverableCompletenessContract(
                deliverable_type=raw["deliverable_type"],
                content_path=raw.get("content_path", "content"),
                required_paths=tuple(raw.get("required_paths", ())),
                minimum_items_by_path=raw.get("minimum_items_by_path", {}),
                minimum_word_count=raw.get("minimum_word_count", 8),
                minimum_distinct_tokens=raw.get("minimum_distinct_tokens", 5),
                required_elements=tuple(
                    RequiredElement(name=item["name"], any_of=tuple(item["any_of"]))
                    for item in raw.get("required_elements", ())
                ),
                placeholder_markers=tuple(raw.get("placeholder_markers", ())),
                placeholder_sentence_ratio=raw.get("placeholder_sentence_ratio", 0.4),
                distinct_from=tuple(raw.get("distinct_from", ())),
                near_duplicate_threshold=raw.get("near_duplicate_threshold", 0.82),
                contract_version=raw.get("contract_version", "1.0"),
            )

        return cls(
            task_id=data["task_id"],
            version=data["version"],
            request_version=data.get("request_version", REQUEST_SCHEMA_VERSION),
            required_metadata_keys=tuple(data.get("required_metadata_keys", ())),
            optional_metadata_keys=tuple(data.get("optional_metadata_keys", ())),
            metadata_property_schemas=data.get("metadata_property_schemas", {}),
            stage1_completeness=make_c2(data["stage1_completeness"]),
            stage2_completeness=make_c2(data["stage2_completeness"]),
            lesson_plan_min_characters=data.get("lesson_plan_min_characters", 60),
            student_material_min_characters=data.get("student_material_min_characters", 60),
        )


@dataclass(frozen=True)
class Stage1Request:
    """Structured first-stage request; prompt data remains separable and inspectable."""

    request_version: str
    task_id: str
    task_contract_version: str
    task_contract: Mapping[str, Any]
    task_context: Any
    source_context: Any
    evidence_prompt_view: Mapping[str, Any] | None
    output_schema: Mapping[str, Any]
    instructions: tuple[str, ...]

    def __post_init__(self) -> None:
        for name in ("request_version", "task_id", "task_contract_version"):
            object.__setattr__(self, name, _nonblank(getattr(self, name), name))
        for name in ("task_contract", "task_context", "source_context", "evidence_prompt_view", "output_schema"):
            value = getattr(self, name)
            object.__setattr__(self, name, _freeze_json(value) if value is not None else None)
        object.__setattr__(self, "instructions", tuple(_nonblank(text, "instruction") for text in self.instructions))

    def to_canonical_dict(self) -> dict[str, Any]:
        return {
            "request_schema_version": self.request_version,
            "stage": "STAGE1_PLAN_AND_METADATA",
            "task_id": self.task_id,
            "task_contract_version": self.task_contract_version,
            "task_contract": _thaw_json(self.task_contract),
            "task_context": _thaw_json(self.task_context),
            "source_context": _thaw_json(self.source_context),
            "evidence_prompt_view": _thaw_json(self.evidence_prompt_view),
            "output_schema": _thaw_json(self.output_schema),
            "instructions": list(self.instructions),
        }

    @property
    def request_sha256(self) -> str:
        return _sha256_json(self.to_canonical_dict())


@dataclass(frozen=True)
class Stage2Request:
    """Second-stage request bound to the exact persisted first-stage draft."""

    request_version: str
    task_id: str
    task_contract_version: str
    task_contract: Mapping[str, Any]
    task_context: Any
    source_context: Any
    evidence_prompt_view: Mapping[str, Any] | None
    output_schema: Mapping[str, Any]
    instructions: tuple[str, ...]
    frozen_stage1_payload: Mapping[str, Any]
    stage1_draft_id: str
    stage1_hash: str

    def __post_init__(self) -> None:
        for name in ("request_version", "task_id", "task_contract_version", "stage1_draft_id", "stage1_hash"):
            object.__setattr__(self, name, _nonblank(getattr(self, name), name))
        for name in ("task_contract", "task_context", "source_context", "evidence_prompt_view", "output_schema", "frozen_stage1_payload"):
            value = getattr(self, name)
            object.__setattr__(self, name, _freeze_json(value) if value is not None else None)
        object.__setattr__(self, "instructions", tuple(_nonblank(text, "instruction") for text in self.instructions))

    def to_canonical_dict(self) -> dict[str, Any]:
        return {
            "request_schema_version": self.request_version,
            "stage": "STAGE2_STUDENT_MATERIAL",
            "task_id": self.task_id,
            "task_contract_version": self.task_contract_version,
            "task_contract": _thaw_json(self.task_contract),
            "task_context": _thaw_json(self.task_context),
            "source_context": _thaw_json(self.source_context),
            "evidence_prompt_view": _thaw_json(self.evidence_prompt_view),
            "output_schema": _thaw_json(self.output_schema),
            "instructions": list(self.instructions),
            "stage1_binding": {
                "stage1_draft_id": self.stage1_draft_id,
                "stage1_hash": self.stage1_hash,
                "frozen_payload": _thaw_json(self.frozen_stage1_payload),
            },
        }

    @property
    def request_sha256(self) -> str:
        return _sha256_json(self.to_canonical_dict())


@dataclass(frozen=True)
class GenerationResponse:
    """One backend completion; metadata is opaque and never forwarded to a later stage."""

    content: str
    finish_reason: str | None
    technical_complete: bool = True
    backend_metadata: Mapping[str, Any] | None = None


class GenerationBackend(Protocol):
    """Injected generation port. Implementations are outside this module."""

    def generate(self, request: Stage1Request | Stage2Request) -> GenerationResponse:
        """Return exactly one completion for the supplied structured request."""


@dataclass(frozen=True)
class FrozenStage1Draft:
    payload: Mapping[str, Any]
    payload_sha256: str
    draft_id: str
    task_id: str
    task_contract_version: str
    request_sha256: str
    schema_validation: Mapping[str, Any]
    completeness_validation: Mapping[str, Any]
    evidence_pack_sha256: str | None
    evidence_prompt_view_sha256: str | None
    source_context_sha256: str

    def __post_init__(self) -> None:
        for name in ("payload_sha256", "draft_id", "task_id", "task_contract_version", "request_sha256", "source_context_sha256"):
            object.__setattr__(self, name, _nonblank(getattr(self, name), name))
        object.__setattr__(self, "payload", _freeze_json(self.payload))
        object.__setattr__(self, "schema_validation", _freeze_json(self.schema_validation))
        object.__setattr__(self, "completeness_validation", _freeze_json(self.completeness_validation))
        if self.evidence_pack_sha256 is not None:
            object.__setattr__(self, "evidence_pack_sha256", _nonblank(self.evidence_pack_sha256, "evidence_pack_sha256"))
        if self.evidence_prompt_view_sha256 is not None:
            object.__setattr__(self, "evidence_prompt_view_sha256", _nonblank(self.evidence_prompt_view_sha256, "evidence_prompt_view_sha256"))
        if _sha256_json(self.payload) != self.payload_sha256:
            raise BindingMismatchError("frozen Stage 1 payload hash does not match its contents")
        if self.draft_id != f"stage1_{self.payload_sha256}":
            raise BindingMismatchError("frozen Stage 1 draft ID does not match its payload hash")

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": STAGE1_FREEZE_SCHEMA_VERSION,
            "status": "FROZEN_STAGE1_DRAFT",
            "task_id": self.task_id,
            "task_contract_version": self.task_contract_version,
            "stage1_draft_id": self.draft_id,
            "stage1_hash": self.payload_sha256,
            "payload": _thaw_json(self.payload),
            "request_sha256": self.request_sha256,
            "schema_validation": _thaw_json(self.schema_validation),
            "completeness_validation": _thaw_json(self.completeness_validation),
            "evidence_pack_sha256": self.evidence_pack_sha256,
            "evidence_prompt_view_sha256": self.evidence_prompt_view_sha256,
            "source_context_sha256": self.source_context_sha256,
        }

    def verify(self) -> None:
        if _sha256_json(self.payload) != self.payload_sha256:
            raise BindingMismatchError("Stage 1 frozen payload changed after validation")


@dataclass(frozen=True)
class FrozenStage2Draft:
    payload: Mapping[str, Any]
    payload_sha256: str
    depends_on_stage1_hash: str
    request_sha256: str
    schema_validation: Mapping[str, Any]
    completeness_validation: Mapping[str, Any]

    def __post_init__(self) -> None:
        for name in ("payload_sha256", "depends_on_stage1_hash", "request_sha256"):
            object.__setattr__(self, name, _nonblank(getattr(self, name), name))
        object.__setattr__(self, "payload", _freeze_json(self.payload))
        object.__setattr__(self, "schema_validation", _freeze_json(self.schema_validation))
        object.__setattr__(self, "completeness_validation", _freeze_json(self.completeness_validation))
        expected = _sha256_json({"payload": self.payload, "depends_on_stage1_hash": self.depends_on_stage1_hash})
        if expected != self.payload_sha256:
            raise BindingMismatchError("frozen Stage 2 hash does not match its contents/binding")

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": STAGE2_FREEZE_SCHEMA_VERSION,
            "status": "FROZEN_STAGE2_DRAFT",
            "payload": _thaw_json(self.payload),
            "stage2_hash": self.payload_sha256,
            "depends_on_stage1_hash": self.depends_on_stage1_hash,
            "request_sha256": self.request_sha256,
            "schema_validation": _thaw_json(self.schema_validation),
            "completeness_validation": _thaw_json(self.completeness_validation),
        }


@dataclass(frozen=True)
class ReviewItem:
    item_id: str
    state: str
    artifact_hash: str
    reason: str
    requires_human_decision: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "item_id": self.item_id,
            "state": self.state,
            "artifact_hash": self.artifact_hash,
            "reason": self.reason,
            "requires_human_decision": self.requires_human_decision,
            "applied": False,
            "published": False,
        }


@dataclass(frozen=True)
class CanonicalGenerationDraft:
    payload: Mapping[str, Any]
    artifact_hash: str
    stage1_hash: str
    stage2_hash: str
    task_id: str
    task_contract_version: str
    evidence_pack_sha256: str | None
    evidence_prompt_view_sha256: str | None
    source_context_sha256: str
    stage1_request_sha256: str
    stage2_request_sha256: str
    status: StageStatus = StageStatus.COMPLETE_PENDING_REVIEW
    review_state: str = "DRAFT"

    def __post_init__(self) -> None:
        object.__setattr__(self, "payload", _freeze_json(self.payload))
        if _sha256_json(self.payload) != self.artifact_hash:
            raise BindingMismatchError("assembled artifact hash does not match its canonical payload")
        if set(self.payload) != {"lesson_plan", "student_material", "metadata"}:
            raise PipelineContractError("canonical payload must retain the three-field generation shape")

    @property
    def review_item(self) -> ReviewItem:
        digest = _sha256_json({"artifact_hash": self.artifact_hash, "task_id": self.task_id})
        return ReviewItem(
            item_id=f"review_{digest}",
            state="OPEN",
            artifact_hash=self.artifact_hash,
            reason="Generated draft requires L3 teacher review before any application or publication.",
        )

    def deliverable_dict(self) -> dict[str, Any]:
        """Backward-compatible final payload only; no hidden mutation metadata."""
        return _thaw_json(self.payload)

    def audit_dict(self) -> dict[str, Any]:
        return {
            "schema_version": PIPELINE_SCHEMA_VERSION,
            "status": self.status.value,
            "review_state": self.review_state,
            "task_id": self.task_id,
            "task_contract_version": self.task_contract_version,
            "artifact_hash": self.artifact_hash,
            "stage1_hash": self.stage1_hash,
            "stage2_hash": self.stage2_hash,
            "depends_on_stage1_hash": self.stage1_hash,
            "stage1_request_sha256": self.stage1_request_sha256,
            "stage2_request_sha256": self.stage2_request_sha256,
            "source_context_sha256": self.source_context_sha256,
            "evidence_pack_sha256": self.evidence_pack_sha256,
            "evidence_prompt_view_sha256": self.evidence_prompt_view_sha256,
            "review_item": self.review_item.to_dict(),
            "application_state": "NOT_APPLIED",
            "publication_state": "NOT_PUBLISHED",
        }


@dataclass(frozen=True)
class PipelineRunResult:
    stage1_status: StageStatus
    stage2_status: StageStatus
    final_status: StageStatus
    stage1_draft: FrozenStage1Draft | None
    stage2_draft: FrozenStage2Draft | None
    final_draft: CanonicalGenerationDraft | None
    failure_code: str | None = None


class _ArtifactStore:
    def __init__(self, root: Path | None) -> None:
        self.root = root
        if root is not None:
            root.mkdir(parents=True, exist_ok=True)

    def write_json(self, relative_path: str, value: Any) -> None:
        if self.root is None:
            return
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        rendered = json.dumps(_thaw_json(value), sort_keys=True, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
        if path.exists():
            if path.read_text(encoding="utf-8") != rendered:
                raise PipelineArtifactConflictError(f"refusing to replace incompatible artifact: {relative_path}")
            return
        temporary = path.with_name(path.name + ".tmp")
        temporary.write_text(rendered, encoding="utf-8")
        temporary.replace(path)


def _parse_json_strict(content: str) -> Any:
    def no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        output: dict[str, Any] = {}
        for key, value in pairs:
            if key in output:
                raise ValueError(f"duplicate_key:{key}")
            output[key] = value
        return output

    def reject_constant(value: str) -> None:
        raise ValueError(f"non_json_constant:{value}")

    return json.loads(content, object_pairs_hook=no_duplicates, parse_constant=reject_constant)


def _schema_errors(value: Any, schema: Mapping[str, Any], path: str = "$root") -> list[str]:
    errors: list[str] = []
    schema_type = schema.get("type")
    type_match = True
    if isinstance(schema_type, str):
        type_match = _matches_json_type(value, schema_type)
    elif isinstance(schema_type, list):
        type_match = any(_matches_json_type(value, item) for item in schema_type)
    if schema_type is not None and not type_match:
        return [f"{path}:type_mismatch:{schema_type}"]
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}:const_mismatch")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}:enum_mismatch")
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}:min_length")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errors.append(f"{path}:max_length")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}:minimum")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}:maximum")
    if isinstance(value, Mapping):
        required = schema.get("required", [])
        properties = schema.get("properties", {})
        for key in required:
            if key not in value:
                errors.append(f"{path}.{key}:required")
        for key, child in properties.items():
            if key in value:
                errors.extend(_schema_errors(value[key], child, f"{path}.{key}"))
        additional = schema.get("additionalProperties", True)
        for key in value:
            if key not in properties:
                if additional is False:
                    errors.append(f"{path}.{key}:additional_property")
                elif isinstance(additional, Mapping):
                    errors.extend(_schema_errors(value[key], additional, f"{path}.{key}"))
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}:min_items")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}:max_items")
        if schema.get("uniqueItems") is True:
            keys = [_canonical_json(item) for item in value]
            if len(keys) != len(set(keys)):
                errors.append(f"{path}:unique_items")
        item_schema = schema.get("items")
        if isinstance(item_schema, Mapping):
            for index, item in enumerate(value):
                errors.extend(_schema_errors(item, item_schema, f"{path}[{index}]"))
    return errors


def _matches_json_type(value: Any, type_name: str) -> bool:
    if type_name == "object":
        return isinstance(value, Mapping)
    if type_name == "array":
        return isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray))
    if type_name == "string":
        return isinstance(value, str)
    if type_name == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if type_name == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if type_name == "boolean":
        return isinstance(value, bool)
    if type_name == "null":
        return value is None
    return False


def validate_json_schema_subset(value: Any, schema: Mapping[str, Any]) -> dict[str, Any]:
    """Validate the deliberately small JSON Schema subset used by this port."""
    if not isinstance(schema, Mapping) or schema.get("schema_version") != "local-json-schema-subset-v1":
        return {"valid": False, "errors": ["schema_version_unsupported"]}
    errors = _schema_errors(value, schema)
    return {"valid": not errors, "errors": errors, "schema_version": schema["schema_version"]}


def _warning_codes(result: Any) -> list[str]:
    return [
        str(check.get("reason_code"))
        for check in result.to_dict().get("checks", [])
        if check.get("severity") == "WARN" and check.get("reason_code")
    ]


def _clean_backend_error(exc: Exception) -> dict[str, str]:
    return {"error_type": type(exc).__name__}


def _stage1_validation_passed(stage1: FrozenStage1Draft) -> bool:
    schema = stage1.schema_validation
    completeness = stage1.completeness_validation
    return (
        isinstance(schema, Mapping)
        and isinstance(schema.get("parse"), Mapping)
        and schema["parse"].get("valid") is True
        and isinstance(schema.get("schema"), Mapping)
        and schema["schema"].get("valid") is True
        and isinstance(completeness, Mapping)
        and completeness.get("status") == GateStatus.PASS.value
    )


def _stage2_validation_passed(stage2: FrozenStage2Draft) -> bool:
    schema = stage2.schema_validation
    completeness = stage2.completeness_validation
    if not (
        isinstance(schema, Mapping)
        and isinstance(schema.get("parse"), Mapping)
        and schema["parse"].get("valid") is True
        and isinstance(schema.get("schema"), Mapping)
        and schema["schema"].get("valid") is True
        and isinstance(completeness, Mapping)
    ):
        return False
    stage1_check = completeness.get("stage1_recheck")
    stage2_check = completeness.get("stage2_and_distinction")
    return (
        isinstance(stage1_check, Mapping)
        and stage1_check.get("status") == GateStatus.PASS.value
        and isinstance(stage2_check, Mapping)
        and stage2_check.get("status") == GateStatus.PASS.value
    )


def assemble_validated_drafts(
    stage1: FrozenStage1Draft,
    stage2: FrozenStage2Draft,
    contract: GenerationTaskContract,
) -> CanonicalGenerationDraft:
    """Assemble without rewriting content; reject stale or unvalidated stage results."""
    stage1.verify()
    if stage1.task_id != contract.task_id or stage1.task_contract_version != contract.version:
        raise BindingMismatchError("Stage 1 draft does not belong to the supplied task contract")
    if not _stage1_validation_passed(stage1):
        raise BindingMismatchError("Stage 1 draft does not contain passing schema and completeness checks")
    if stage2.depends_on_stage1_hash != stage1.payload_sha256:
        raise BindingMismatchError("Stage 2 result is bound to a different Stage 1 payload")
    if not _stage2_validation_passed(stage2):
        raise BindingMismatchError("Stage 2 draft does not contain passing schema, completeness, and distinction checks")
    payload = {
        "lesson_plan": _thaw_json(stage1.payload["lesson_plan"]),
        "student_material": _thaw_json(stage2.payload["student_material"]),
        "metadata": _thaw_json(stage1.payload["metadata"]),
    }
    artifact_hash = _sha256_json(payload)
    return CanonicalGenerationDraft(
        payload=payload,
        artifact_hash=artifact_hash,
        stage1_hash=stage1.payload_sha256,
        stage2_hash=stage2.payload_sha256,
        task_id=contract.task_id,
        task_contract_version=contract.version,
        evidence_pack_sha256=stage1.evidence_pack_sha256,
        evidence_prompt_view_sha256=stage1.evidence_prompt_view_sha256,
        source_context_sha256=stage1.source_context_sha256,
        stage1_request_sha256=stage1.request_sha256,
        stage2_request_sha256=stage2.request_sha256,
    )


class TwoStageGenerationPipeline:
    """Execute one request per stage, freeze the validated first result, then assemble."""

    def __init__(self, backend: GenerationBackend, artifact_dir: str | Path | None = None) -> None:
        self.backend = backend
        self.store = _ArtifactStore(Path(artifact_dir) if artifact_dir is not None else None)
        self.backend_call_count = 0

    def run(
        self,
        *,
        contract: GenerationTaskContract,
        task_context: Any,
        source_context: Any,
        evidence_pack: EvidencePack | None = None,
        stage1_instructions: Sequence[str] = ("Produce only a lesson plan and task-declared metadata.",),
        stage2_instructions: Sequence[str] = ("Produce only student material; do not rewrite Stage 1.",),
    ) -> PipelineRunResult:
        context = _snapshot_json(task_context)
        source = _snapshot_json(source_context)
        prompt_view = evidence_pack.for_prompt().to_dict() if evidence_pack is not None else None
        evidence_pack_sha = hashlib.sha256(evidence_pack.serialize_canonical().encode("utf-8")).hexdigest() if evidence_pack is not None else None
        prompt_view_sha = _sha256_json(prompt_view) if prompt_view is not None else None
        source_sha = _sha256_json(source)
        stage1_request = Stage1Request(
            request_version=contract.request_version,
            task_id=contract.task_id,
            task_contract_version=contract.version,
            task_contract=contract.request_contract_dict(),
            task_context=context,
            source_context=source,
            evidence_prompt_view=prompt_view,
            output_schema=contract.stage1_output_schema,
            instructions=tuple(stage1_instructions),
        )
        self.store.write_json("stage1/request.json", {
            "request_sha256": stage1_request.request_sha256,
            "request": stage1_request.to_canonical_dict(),
        })
        self.backend_call_count += 1
        try:
            response1 = self.backend.generate(stage1_request)
        except Exception as exc:
            failure = _clean_backend_error(exc)
            self.store.write_json("stage1/response-status.json", {"technical_complete": False, **failure})
            self._write_run_state(StageStatus.STAGE1_TECHNICAL_FAILURE, StageStatus.STAGE2_NOT_RUN, "STAGE1_TECHNICAL_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_TECHNICAL_FAILURE, StageStatus.STAGE2_NOT_RUN, StageStatus.ASSEMBLY_BLOCKED, None, None, None, "STAGE1_BACKEND_EXCEPTION")
        if not isinstance(response1, GenerationResponse) or not isinstance(response1.content, str):
            self.store.write_json("stage1/response-status.json", {"technical_complete": False, "error": "invalid_response_type"})
            self._write_run_state(StageStatus.STAGE1_TECHNICAL_FAILURE, StageStatus.STAGE2_NOT_RUN, "STAGE1_TECHNICAL_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_TECHNICAL_FAILURE, StageStatus.STAGE2_NOT_RUN, StageStatus.ASSEMBLY_BLOCKED, None, None, None, "INVALID_BACKEND_RESPONSE")
        response1_record = self._response_record(response1)
        self.store.write_json("stage1/response-status.json", response1_record)
        if not self._response_is_complete(response1):
            self._write_run_state(StageStatus.STAGE1_TECHNICAL_FAILURE, StageStatus.STAGE2_NOT_RUN, "STAGE1_TECHNICAL_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_TECHNICAL_FAILURE, StageStatus.STAGE2_NOT_RUN, StageStatus.ASSEMBLY_BLOCKED, None, None, None, "TECHNICAL_INCOMPLETE")
        parse_result, payload1 = self._parse_payload(response1.content)
        schema_result = validate_json_schema_subset(payload1, contract.stage1_output_schema) if parse_result["valid"] else {"valid": False, "errors": parse_result["errors"], "schema_version": "local-json-schema-subset-v1"}
        self.store.write_json("stage1/schema-validation.json", {"parse": parse_result, "schema": schema_result})
        if not parse_result["valid"] or not schema_result["valid"]:
            self._write_run_state(StageStatus.STAGE1_SCHEMA_FAILURE, StageStatus.STAGE2_NOT_RUN, "STAGE1_SCHEMA_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_SCHEMA_FAILURE, StageStatus.STAGE2_NOT_RUN, StageStatus.ASSEMBLY_BLOCKED, None, None, None, "INVALID_STAGE1_JSON_OR_SCHEMA")
        completeness1 = evaluate_deliverable(payload1, contract.stage1_completeness)
        completeness1_dict = completeness1.to_dict()
        self.store.write_json("stage1/completeness-validation.json", completeness1_dict)
        if completeness1.status is not GateStatus.PASS:
            self._write_run_state(StageStatus.STAGE1_COMPLETENESS_FAILURE, StageStatus.STAGE2_NOT_RUN, "STAGE1_COMPLETENESS_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_COMPLETENESS_FAILURE, StageStatus.STAGE2_NOT_RUN, StageStatus.ASSEMBLY_BLOCKED, None, None, None, "C2_STAGE1_FAIL")
        stage1_hash = _sha256_json(payload1)
        stage1 = FrozenStage1Draft(
            payload=payload1,
            payload_sha256=stage1_hash,
            draft_id=f"stage1_{stage1_hash}",
            task_id=contract.task_id,
            task_contract_version=contract.version,
            request_sha256=stage1_request.request_sha256,
            schema_validation={"parse": parse_result, "schema": schema_result},
            completeness_validation=completeness1_dict,
            evidence_pack_sha256=evidence_pack_sha,
            evidence_prompt_view_sha256=prompt_view_sha,
            source_context_sha256=source_sha,
        )
        self.store.write_json("stage1/freeze.json", stage1.to_dict())
        # Reload precisely what was persisted; Stage 2 never receives a reconstruction.
        if self.store.root is not None:
            persisted = json.loads((self.store.root / "stage1/freeze.json").read_text(encoding="utf-8"))
            persisted_payload = persisted["payload"]
            persisted_hash = _sha256_json(persisted_payload)
            if persisted_hash != persisted["stage1_hash"]:
                raise BindingMismatchError("persisted Stage 1 freeze failed hash verification")
            stage1 = FrozenStage1Draft(
                payload=persisted_payload,
                payload_sha256=persisted_hash,
                draft_id=persisted["stage1_draft_id"],
                task_id=persisted["task_id"],
                task_contract_version=persisted["task_contract_version"],
                request_sha256=persisted["request_sha256"],
                schema_validation=persisted["schema_validation"],
                completeness_validation=persisted["completeness_validation"],
                evidence_pack_sha256=persisted.get("evidence_pack_sha256"),
                evidence_prompt_view_sha256=persisted.get("evidence_prompt_view_sha256"),
                source_context_sha256=persisted["source_context_sha256"],
            )
        stage1.verify()
        stage2_request = Stage2Request(
            request_version=contract.request_version,
            task_id=contract.task_id,
            task_contract_version=contract.version,
            task_contract=contract.request_contract_dict(),
            task_context=context,
            source_context=source,
            evidence_prompt_view=prompt_view,
            output_schema=contract.stage2_output_schema,
            instructions=tuple(stage2_instructions),
            frozen_stage1_payload=_thaw_json(stage1.payload),
            stage1_draft_id=stage1.draft_id,
            stage1_hash=stage1.payload_sha256,
        )
        self.store.write_json("stage2/request.json", {
            "request_sha256": stage2_request.request_sha256,
            "request": stage2_request.to_canonical_dict(),
        })
        self.backend_call_count += 1
        try:
            response2 = self.backend.generate(stage2_request)
        except Exception as exc:
            self.store.write_json("stage2/response-status.json", {"technical_complete": False, **_clean_backend_error(exc)})
            self._write_run_state(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_TECHNICAL_FAILURE, "STAGE2_TECHNICAL_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_TECHNICAL_FAILURE, StageStatus.ASSEMBLY_BLOCKED, stage1, None, None, "STAGE2_BACKEND_EXCEPTION")
        if not isinstance(response2, GenerationResponse) or not isinstance(response2.content, str):
            self.store.write_json("stage2/response-status.json", {"technical_complete": False, "error": "invalid_response_type"})
            self._write_run_state(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_TECHNICAL_FAILURE, "STAGE2_TECHNICAL_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_TECHNICAL_FAILURE, StageStatus.ASSEMBLY_BLOCKED, stage1, None, None, "INVALID_BACKEND_RESPONSE")
        self.store.write_json("stage2/response-status.json", self._response_record(response2))
        if not self._response_is_complete(response2):
            self._write_run_state(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_TECHNICAL_FAILURE, "STAGE2_TECHNICAL_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_TECHNICAL_FAILURE, StageStatus.ASSEMBLY_BLOCKED, stage1, None, None, "TECHNICAL_INCOMPLETE")
        parse_result2, payload2 = self._parse_payload(response2.content)
        schema_result2 = validate_json_schema_subset(payload2, contract.stage2_output_schema) if parse_result2["valid"] else {"valid": False, "errors": parse_result2["errors"], "schema_version": "local-json-schema-subset-v1"}
        self.store.write_json("stage2/schema-validation.json", {"parse": parse_result2, "schema": schema_result2})
        if not parse_result2["valid"] or not schema_result2["valid"]:
            self._write_run_state(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_SCHEMA_FAILURE, "STAGE2_SCHEMA_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_SCHEMA_FAILURE, StageStatus.ASSEMBLY_BLOCKED, stage1, None, None, "INVALID_STAGE2_JSON_OR_SCHEMA")
        bundle = evaluate_bundle(
            {
                contract.stage1_completeness.deliverable_type: _thaw_json(stage1.payload),
                contract.stage2_completeness.deliverable_type: payload2,
            },
            (contract.stage1_completeness, contract.stage2_completeness),
        )
        c2_stage1 = bundle[contract.stage1_completeness.deliverable_type]
        c2_stage2 = bundle[contract.stage2_completeness.deliverable_type]
        completeness2_dict = {
            "stage1_recheck": c2_stage1.to_dict(),
            "stage2_and_distinction": c2_stage2.to_dict(),
            "warning_codes": _warning_codes(c2_stage1) + _warning_codes(c2_stage2),
        }
        self.store.write_json("stage2/completeness-validation.json", completeness2_dict)
        if c2_stage1.status is not GateStatus.PASS:
            self._write_run_state(StageStatus.STAGE1_COMPLETENESS_FAILURE, StageStatus.STAGE2_NOT_RUN, "STAGE1_RECHECK_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_COMPLETENESS_FAILURE, StageStatus.STAGE2_NOT_RUN, StageStatus.ASSEMBLY_BLOCKED, stage1, None, None, "C2_STAGE1_RECHECK_FAIL")
        if c2_stage2.status is not GateStatus.PASS:
            self._write_run_state(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_COMPLETENESS_FAILURE, "STAGE2_COMPLETENESS_FAILURE")
            return PipelineRunResult(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_COMPLETENESS_FAILURE, StageStatus.ASSEMBLY_BLOCKED, stage1, None, None, "C2_STAGE2_OR_DISTINCTION_FAIL")
        stage2_hash = _sha256_json({"payload": payload2, "depends_on_stage1_hash": stage1.payload_sha256})
        stage2 = FrozenStage2Draft(
            payload=payload2,
            payload_sha256=stage2_hash,
            depends_on_stage1_hash=stage1.payload_sha256,
            request_sha256=stage2_request.request_sha256,
            schema_validation={"parse": parse_result2, "schema": schema_result2},
            completeness_validation=completeness2_dict,
        )
        self.store.write_json("stage2/freeze.json", stage2.to_dict())
        draft = assemble_validated_drafts(stage1, stage2, contract)
        self.store.write_json("generation-output.json", draft.deliverable_dict())
        self.store.write_json("generation-audit.json", draft.audit_dict())
        self._write_run_state(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_VALIDATED, StageStatus.COMPLETE_PENDING_REVIEW)
        return PipelineRunResult(StageStatus.STAGE1_VALIDATED, StageStatus.STAGE2_VALIDATED, StageStatus.COMPLETE_PENDING_REVIEW, stage1, stage2, draft, None)

    @staticmethod
    def _response_is_complete(response: GenerationResponse) -> bool:
        return response.technical_complete and response.finish_reason == "stop"

    @staticmethod
    def _response_record(response: GenerationResponse) -> dict[str, Any]:
        raw = response.content.encode("utf-8") if isinstance(response.content, str) else b""
        return {
            "technical_complete": response.technical_complete,
            "finish_reason": response.finish_reason,
            "content_sha256": hashlib.sha256(raw).hexdigest(),
            "content_character_count": len(response.content) if isinstance(response.content, str) else None,
            "backend_metadata_present": response.backend_metadata is not None,
        }

    @staticmethod
    def _parse_payload(content: str) -> tuple[dict[str, Any], Any]:
        try:
            parsed = _parse_json_strict(content)
            _canonical_json(parsed)
            return {"valid": True, "errors": []}, parsed
        except (TypeError, ValueError, json.JSONDecodeError, PipelineContractError) as exc:
            return {"valid": False, "errors": [f"invalid_json:{type(exc).__name__}"]}, None

    def _write_run_state(self, stage1: StageStatus, stage2: StageStatus, final: StageStatus | str) -> None:
        self.store.write_json("run-status.json", {
            "schema_version": PIPELINE_SCHEMA_VERSION,
            "stage1_status": stage1.value,
            "stage2_status": stage2.value,
            "final_status": final.value if isinstance(final, StageStatus) else final,
        })
