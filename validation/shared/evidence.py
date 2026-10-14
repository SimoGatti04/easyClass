"""Typed, source-neutral evidence records and explicitly scoped views."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json
import re
from typing import Any
from types import MappingProxyType


EVIDENCE_SCHEMA_VERSION = "evidence-pack-v1"
EVIDENCE_ITEM_VERSION = "evidence-item-v1"
_HASH_RE = re.compile(r"^[0-9a-f]{64}$")


class EvidenceContractError(ValueError):
    """Raised when an evidence record violates the serialization contract."""


class EvidenceVisibility(str, Enum):
    PROMPT_VISIBLE = "PROMPT_VISIBLE"
    VALIDATOR_ONLY = "VALIDATOR_ONLY"
    TEACHER_ONLY = "TEACHER_ONLY"


class EvidenceRole(str, Enum):
    SOURCE_FACT = "SOURCE_FACT"
    SOURCE_DERIVED = "SOURCE_DERIVED"
    SOURCE_SPECIFIC_DETAIL = "SOURCE_SPECIFIC_DETAIL"


def _json_compatible(value: Any) -> Any:
    if isinstance(value, Mapping):
        if any(not isinstance(key, str) for key in value):
            raise EvidenceContractError("JSON object keys must be strings")
        return {key: _json_compatible(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_compatible(item) for item in value]
    return value


def _freeze_json(value: Any) -> Any:
    copied = _json_copy(value)
    if isinstance(copied, dict):
        return MappingProxyType({key: _freeze_json(item) for key, item in copied.items()})
    if isinstance(copied, list):
        return tuple(_freeze_json(item) for item in copied)
    return copied


def _canonical_json(value: Any) -> str:
    try:
        return json.dumps(
            _json_compatible(value),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        raise EvidenceContractError(f"value is not strict JSON data: {exc}") from exc


def _json_copy(value: Any) -> Any:
    return json.loads(_canonical_json(value))


def _nonblank(value: str, name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise EvidenceContractError(f"{name} must not be blank")
    return cleaned


@dataclass(frozen=True)
class DerivationProvenance:
    """Reconstructible computational lineage for a derived record."""

    derived_from: tuple[str, ...]
    derivation_id: str
    method: str
    computation_version: str
    parameters: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.derived_from or any(not item.strip() for item in self.derived_from):
            raise EvidenceContractError("derived_from must contain evidence IDs")
        object.__setattr__(self, "derived_from", tuple(self.derived_from))
        object.__setattr__(self, "derivation_id", _nonblank(self.derivation_id, "derivation_id"))
        object.__setattr__(self, "method", _nonblank(self.method, "method"))
        object.__setattr__(
            self,
            "computation_version",
            _nonblank(self.computation_version, "computation_version"),
        )
        copied = _freeze_json(dict(self.parameters))
        object.__setattr__(self, "parameters", copied)

    def to_dict(self) -> dict[str, Any]:
        return {
            "derived_from": list(self.derived_from),
            "derivation_id": self.derivation_id,
            "method": self.method,
            "computation_version": self.computation_version,
            "parameters": _json_copy(dict(self.parameters)),
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "DerivationProvenance":
        return cls(
            derived_from=tuple(data["derived_from"]),
            derivation_id=str(data["derivation_id"]),
            method=str(data["method"]),
            computation_version=str(data["computation_version"]),
            parameters=data.get("parameters", {}),
        )


@dataclass(frozen=True)
class EvidenceProvenance:
    """Structured origin data; locator payloads are stored without interpretation."""

    source_id: str
    source_type: str
    extraction_method: str
    provider_version: str
    source_hash: str | None = None
    locator: Mapping[str, Any] | None = None
    source_schema_version: str | None = None
    derivation: DerivationProvenance | None = None

    def __post_init__(self) -> None:
        for name in ("source_id", "source_type", "extraction_method", "provider_version"):
            object.__setattr__(self, name, _nonblank(getattr(self, name), name))
        if self.source_hash is not None and not _HASH_RE.fullmatch(self.source_hash):
            raise EvidenceContractError("source_hash must be a lowercase SHA-256 digest")
        if self.source_schema_version is not None:
            object.__setattr__(
                self,
                "source_schema_version",
                _nonblank(self.source_schema_version, "source_schema_version"),
            )
        if self.locator is not None:
            object.__setattr__(self, "locator", _freeze_json(dict(self.locator)))
        if self.derivation is not None and not isinstance(self.derivation, DerivationProvenance):
            raise EvidenceContractError("derivation must be DerivationProvenance")

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_id": self.source_id,
            "source_type": self.source_type,
            "source_hash": self.source_hash,
            "locator": _json_copy(dict(self.locator)) if self.locator is not None else None,
            "extraction_method": self.extraction_method,
            "source_schema_version": self.source_schema_version,
            "provider_version": self.provider_version,
            "derivation": self.derivation.to_dict() if self.derivation else None,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "EvidenceProvenance":
        derivation = data.get("derivation")
        return cls(
            source_id=str(data["source_id"]),
            source_type=str(data["source_type"]),
            source_hash=data.get("source_hash"),
            locator=data.get("locator"),
            extraction_method=str(data["extraction_method"]),
            source_schema_version=data.get("source_schema_version"),
            provider_version=str(data["provider_version"]),
            derivation=DerivationProvenance.from_dict(derivation) if derivation else None,
        )


def _item_identity(
    *,
    role: EvidenceRole,
    value: Any,
    provenance: EvidenceProvenance,
    semantic_label: str | None,
    unit: str | None,
    value_type: str | None,
) -> dict[str, Any]:
    derivation = provenance.derivation.to_dict() if provenance.derivation else None
    if derivation:
        derivation["derived_from"] = sorted(derivation["derived_from"])
    return {
        "item_version": EVIDENCE_ITEM_VERSION,
        "role": role.value,
        "value": value,
        "source_id": provenance.source_id,
        "source_type": provenance.source_type,
        "source_hash": provenance.source_hash,
        "locator": dict(provenance.locator) if provenance.locator is not None else None,
        "semantic_label": semantic_label,
        "unit": unit,
        "value_type": value_type,
        "derivation": derivation,
    }


def _stable_item_id(identity: Mapping[str, Any]) -> str:
    digest = hashlib.sha256(_canonical_json(identity).encode("utf-8")).hexdigest()
    return f"ev_{digest}"


@dataclass(frozen=True)
class EvidenceItem:
    """One typed fact or derivation with explicit origin and visibility."""

    evidence_id: str
    role: EvidenceRole
    value: Any
    provenance: EvidenceProvenance
    visibility: EvidenceVisibility
    semantic_label: str | None = None
    unit: str | None = None
    value_type: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.role, EvidenceRole):
            object.__setattr__(self, "role", EvidenceRole(self.role))
        if not isinstance(self.visibility, EvidenceVisibility):
            object.__setattr__(self, "visibility", EvidenceVisibility(self.visibility))
        if not isinstance(self.provenance, EvidenceProvenance):
            raise EvidenceContractError("provenance must be EvidenceProvenance")
        object.__setattr__(self, "value", _freeze_json(self.value))
        for name in ("semantic_label", "unit", "value_type"):
            current = getattr(self, name)
            if current is not None:
                object.__setattr__(self, name, _nonblank(current, name))
        if self.role is EvidenceRole.SOURCE_DERIVED:
            derivation = self.provenance.derivation
            if derivation is None or not derivation.derived_from:
                raise EvidenceContractError("SOURCE_DERIVED requires reconstructible derivation provenance")
        elif self.provenance.derivation is not None:
            raise EvidenceContractError("derivation provenance is only valid for SOURCE_DERIVED")
        expected = _stable_item_id(
            _item_identity(
                role=self.role,
                value=self.value,
                provenance=self.provenance,
                semantic_label=self.semantic_label,
                unit=self.unit,
                value_type=self.value_type,
            )
        )
        if self.evidence_id != expected:
            raise EvidenceContractError("evidence_id does not match stable identity")

    @classmethod
    def create(
        cls,
        *,
        role: EvidenceRole,
        value: Any,
        provenance: EvidenceProvenance,
        visibility: EvidenceVisibility,
        semantic_label: str | None = None,
        unit: str | None = None,
        value_type: str | None = None,
    ) -> "EvidenceItem":
        if not isinstance(role, EvidenceRole):
            role = EvidenceRole(role)
        identity = _item_identity(
            role=role,
            value=_json_copy(value),
            provenance=provenance,
            semantic_label=semantic_label,
            unit=unit,
            value_type=value_type,
        )
        return cls(
            evidence_id=_stable_item_id(identity),
            role=role,
            value=value,
            provenance=provenance,
            visibility=visibility,
            semantic_label=semantic_label,
            unit=unit,
            value_type=value_type,
        )

    def to_canonical_dict(self) -> dict[str, Any]:
        return {
            "evidence_id": self.evidence_id,
            "role": self.role.value,
            "value": _json_copy(self.value),
            "provenance": self.provenance.to_dict(),
            "visibility": self.visibility.value,
            "semantic_label": self.semantic_label,
            "unit": self.unit,
            "value_type": self.value_type,
        }

    def to_model_record(self) -> dict[str, Any]:
        """Return a minimal model-safe record, not the audit representation."""
        locator = self.provenance.locator
        return {
            "evidence_id": self.evidence_id,
            "role": self.role.value,
            "semantic_label": self.semantic_label,
            "value": _json_copy(self.value),
            "unit": self.unit,
            "value_type": self.value_type,
            "source_locator": _json_copy(dict(locator)) if locator is not None else None,
        }

    @classmethod
    def from_canonical_dict(cls, data: Mapping[str, Any]) -> "EvidenceItem":
        return cls(
            evidence_id=str(data["evidence_id"]),
            role=EvidenceRole(data["role"]),
            value=data["value"],
            provenance=EvidenceProvenance.from_dict(data["provenance"]),
            visibility=EvidenceVisibility(data["visibility"]),
            semantic_label=data.get("semantic_label"),
            unit=data.get("unit"),
            value_type=data.get("value_type"),
        )


@dataclass(frozen=True)
class EvidenceView:
    """An explicitly filtered projection of a pack."""

    scope: str
    items: tuple[EvidenceItem, ...]
    model_safe: bool = False

    def records(self) -> list[dict[str, Any]]:
        if self.model_safe:
            return [item.to_model_record() for item in self.items]
        return [item.to_canonical_dict() for item in self.items]

    def to_dict(self) -> dict[str, Any]:
        return {
            "view_schema_version": EVIDENCE_SCHEMA_VERSION,
            "scope": self.scope,
            "items": self.records(),
        }

    def render_json(self) -> str:
        return json.dumps(
            self.to_dict(),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        )


@dataclass(frozen=True)
class EvidencePack:
    """Canonical evidence collection. Consumers must request an explicit view."""

    pack_id: str
    items: tuple[EvidenceItem, ...]
    schema_version: str = EVIDENCE_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.schema_version != EVIDENCE_SCHEMA_VERSION:
            raise EvidenceContractError(f"unsupported pack version: {self.schema_version}")
        normalized = tuple(self.items)
        if any(not isinstance(item, EvidenceItem) for item in normalized):
            raise EvidenceContractError("pack items must be EvidenceItem instances")
        ordered = tuple(sorted(normalized, key=lambda item: item.evidence_id))
        ids = [item.evidence_id for item in ordered]
        if len(ids) != len(set(ids)):
            raise EvidenceContractError("duplicate evidence_id in pack")
        object.__setattr__(self, "items", ordered)
        expected = self._calculate_pack_id(ordered)
        if self.pack_id != expected:
            raise EvidenceContractError("pack_id does not match its canonical contents")

    @staticmethod
    def _calculate_pack_id(items: Sequence[EvidenceItem]) -> str:
        payload = [item.to_canonical_dict() for item in sorted(items, key=lambda item: item.evidence_id)]
        digest = hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()
        return f"ep_{digest}"

    @classmethod
    def build(cls, items: Sequence[EvidenceItem]) -> "EvidencePack":
        ordered = tuple(sorted(items, key=lambda item: item.evidence_id))
        return cls(pack_id=cls._calculate_pack_id(ordered), items=ordered)

    def for_prompt(self) -> EvidenceView:
        return EvidenceView(
            scope="PROMPT_VISIBLE",
            items=tuple(item for item in self.items if item.visibility is EvidenceVisibility.PROMPT_VISIBLE),
            model_safe=True,
        )

    def for_validation(self) -> EvidenceView:
        allowed = {EvidenceVisibility.PROMPT_VISIBLE, EvidenceVisibility.VALIDATOR_ONLY}
        return EvidenceView(
            scope="VALIDATION_ALLOWED",
            items=tuple(item for item in self.items if item.visibility in allowed),
        )

    def for_teacher(self) -> EvidenceView:
        allowed = {EvidenceVisibility.PROMPT_VISIBLE, EvidenceVisibility.TEACHER_ONLY}
        return EvidenceView(
            scope="TEACHER_ALLOWED",
            items=tuple(item for item in self.items if item.visibility in allowed),
        )

    def serialize_canonical(self) -> str:
        """Serialize the full audit record; never use this as a model prompt view."""
        data = {
            "schema_version": self.schema_version,
            "pack_id": self.pack_id,
            "items": [item.to_canonical_dict() for item in self.items],
        }
        return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)

    @classmethod
    def from_canonical_json(cls, payload: str) -> "EvidencePack":
        try:
            data = json.loads(payload)
            items = tuple(EvidenceItem.from_canonical_dict(item) for item in data["items"])
            return cls(
                pack_id=str(data["pack_id"]),
                items=items,
                schema_version=str(data["schema_version"]),
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            if isinstance(exc, EvidenceContractError):
                raise
            raise EvidenceContractError(f"invalid canonical pack: {exc}") from exc


def build_derived_evidence(
    *,
    value: Any,
    derived_from: Sequence[str],
    derivation_id: str,
    method: str,
    computation_version: str,
    source_id: str,
    source_type: str,
    source_hash: str | None,
    locator: Mapping[str, Any] | None,
    extraction_method: str,
    source_schema_version: str | None,
    provider_version: str,
    visibility: EvidenceVisibility,
    semantic_label: str | None = None,
    unit: str | None = None,
    value_type: str | None = None,
    parameters: Mapping[str, Any] | None = None,
) -> EvidenceItem:
    """Build one derived item with explicit lineage and reproducible method metadata."""
    provenance = EvidenceProvenance(
        source_id=source_id,
        source_type=source_type,
        source_hash=source_hash,
        locator=locator,
        extraction_method=extraction_method,
        source_schema_version=source_schema_version,
        provider_version=provider_version,
        derivation=DerivationProvenance(
            derived_from=tuple(derived_from),
            derivation_id=derivation_id,
            method=method,
            computation_version=computation_version,
            parameters=parameters or {},
        ),
    )
    return EvidenceItem.create(
        role=EvidenceRole.SOURCE_DERIVED,
        value=value,
        provenance=provenance,
        visibility=visibility,
        semantic_label=semantic_label,
        unit=unit,
        value_type=value_type,
    )
