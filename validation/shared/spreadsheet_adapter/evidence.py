"""Deterministic evidence extraction over the existing typed workbook query API."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import hashlib
import json
from pathlib import Path
from typing import Any

from validation.shared.evidence import (
    EvidenceItem,
    EvidencePack,
    EvidenceProvenance,
    EvidenceRole,
    EvidenceVisibility,
)
from validation.shared.spreadsheet_adapter.adapter import CellAwareSpreadsheetAdapter
from validation.shared.spreadsheet_adapter.models import (
    SCHEMA_VERSION,
    col_letter_to_index,
    parse_coordinate,
    parse_range,
)
from validation.shared.spreadsheet_adapter.query import SpreadsheetQueryEngine


PROVIDER_VERSION = "1.0.0"
PROJECTION_SCHEMA = "gate-c-v2-cellaware-source-projection-v1"


class SpreadsheetEvidenceError(ValueError):
    """Base error for invalid source state or request contracts."""


class SourceIntegrityError(SpreadsheetEvidenceError):
    """Raised when source or projection provenance does not match its pin."""


class UnsupportedProjectionError(SpreadsheetEvidenceError):
    """Raised when the projection contract is not supported."""


class RequestKind(str, Enum):
    WORKBOOK_SUMMARY = "WORKBOOK_SUMMARY"
    SHEET_EXISTENCE = "SHEET_EXISTENCE"
    CELL = "CELL"
    RANGE = "RANGE"
    NATIVE_TABLE = "NATIVE_TABLE"
    DETECTED_REGION = "DETECTED_REGION"
    DEFINED_NAME = "DEFINED_NAME"
    STORED_FORMULA = "STORED_FORMULA"
    HEADER = "HEADER"


@dataclass(frozen=True)
class SpreadsheetEvidenceRequest:
    """One explicit, bounded query; no broad source dump is available."""

    request_id: str
    kind: RequestKind
    visibility: EvidenceVisibility
    role: EvidenceRole
    sheet_name: str | None = None
    coordinate: str | None = None
    range_ref: str | None = None
    name: str | None = None
    column: str | int | None = None
    semantic_label: str | None = None

    def __post_init__(self) -> None:
        if not self.request_id.strip():
            raise SpreadsheetEvidenceError("request_id must not be blank")
        if not isinstance(self.kind, RequestKind):
            object.__setattr__(self, "kind", RequestKind(self.kind))
        if not isinstance(self.visibility, EvidenceVisibility):
            object.__setattr__(self, "visibility", EvidenceVisibility(self.visibility))
        if not isinstance(self.role, EvidenceRole):
            object.__setattr__(self, "role", EvidenceRole(self.role))
        if self.semantic_label is not None and not self.semantic_label.strip():
            raise SpreadsheetEvidenceError("semantic_label must not be blank")
        if self.role is EvidenceRole.SOURCE_DERIVED:
            raise SpreadsheetEvidenceError("provider requests extract source records; use the derivation builder for derived records")


@dataclass(frozen=True)
class UnresolvedRequest:
    request_id: str
    kind: str
    code: str
    detail: str

    def to_dict(self) -> dict[str, str]:
        return {
            "request_id": self.request_id,
            "kind": self.kind,
            "code": self.code,
            "detail": self.detail,
        }


@dataclass(frozen=True)
class SpreadsheetEvidenceResult:
    pack: EvidencePack
    unresolved: tuple[UnresolvedRequest, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "pack": json.loads(self.pack.serialize_canonical()),
            "unresolved": [item.to_dict() for item in self.unresolved],
        }


class SpreadsheetEvidenceProvider:
    """Resolve declarative requests against a hash-verified local source."""

    def __init__(
        self,
        *,
        source_path: str | Path,
        projection_path: str | Path,
        expected_source_sha256: str,
        expected_projection_content_sha256: str,
        expected_ast_sha256: str,
        source_id: str = "local-source-1",
    ) -> None:
        self.source_path = Path(source_path)
        self.projection_path = Path(projection_path)
        self.expected_source_sha256 = expected_source_sha256
        self.expected_projection_content_sha256 = expected_projection_content_sha256
        self.expected_ast_sha256 = expected_ast_sha256
        self.source_id = source_id.strip()
        if not self.source_id:
            raise SourceIntegrityError("source_id must not be blank")
        self._projection = self._load_and_verify_projection()
        self.ast = CellAwareSpreadsheetAdapter(str(self.source_path)).extract_ast()
        self.query = SpreadsheetQueryEngine(self.ast)
        self.source_sha256 = self.ast.sha256
        self._verify_parsed_ast()

    def _load_and_verify_projection(self) -> dict[str, Any]:
        try:
            raw = self.projection_path.read_bytes()
            projection = json.loads(raw)
        except (OSError, json.JSONDecodeError) as exc:
            raise SourceIntegrityError(f"projection unreadable or invalid JSON: {exc}") from exc
        if not isinstance(projection, dict):
            raise SourceIntegrityError("projection root must be an object")
        if projection.get("projection_schema") != PROJECTION_SCHEMA:
            raise UnsupportedProjectionError("projection schema is not supported")
        declared = projection.get("projection_sha256")
        content = {key: value for key, value in projection.items() if key != "projection_sha256"}
        actual_content_sha = hashlib.sha256(
            json.dumps(
                content,
                sort_keys=True,
                separators=(",", ":"),
                ensure_ascii=False,
                allow_nan=False,
            ).encode("utf-8")
        ).hexdigest()
        if declared != actual_content_sha:
            raise SourceIntegrityError("projection content digest does not match its declaration")
        if actual_content_sha != self.expected_projection_content_sha256:
            raise SourceIntegrityError("projection content digest does not match the configured pin")
        if projection.get("workbook_source_sha256") != self.expected_source_sha256:
            raise SourceIntegrityError("projection source digest does not match the configured pin")
        if not self.source_path.is_file():
            raise SourceIntegrityError("source file is missing")
        actual_source_sha = hashlib.sha256(self.source_path.read_bytes()).hexdigest()
        if actual_source_sha != self.expected_source_sha256:
            raise SourceIntegrityError("source file digest does not match the configured pin")
        if projection.get("workbook_ast_sha256") != self.expected_ast_sha256:
            raise SourceIntegrityError("projection AST digest does not match the configured pin")
        return projection

    def _verify_parsed_ast(self) -> None:
        if self.ast.schema_version != SCHEMA_VERSION:
            raise UnsupportedProjectionError(
                f"AST schema {self.ast.schema_version!r} is not supported; expected {SCHEMA_VERSION!r}"
            )
        serialized_ast = json.dumps(self.ast.to_dict(), indent=2).encode("utf-8")
        actual_ast_sha = hashlib.sha256(serialized_ast).hexdigest()
        if actual_ast_sha != self.expected_ast_sha256:
            raise SourceIntegrityError("parsed AST digest does not match the configured pin")
        if self.ast.sha256 != self.expected_source_sha256:
            raise SourceIntegrityError("parsed AST source digest does not match the configured pin")
        if self._projection.get("workbook") != self.ast.to_dict().get("workbook"):
            raise SourceIntegrityError("projection metadata differs from the parsed source")
        if self._projection.get("sheets") != self.ast.to_dict().get("sheets"):
            raise SourceIntegrityError("projected structures differ from the parsed source")

    @property
    def projection_content_sha256(self) -> str:
        return str(self._projection["projection_sha256"])

    @property
    def ast_sha256(self) -> str:
        return self.expected_ast_sha256

    def resolve(
        self,
        requests: list[SpreadsheetEvidenceRequest] | tuple[SpreadsheetEvidenceRequest, ...],
    ) -> SpreadsheetEvidenceResult:
        items: list[EvidenceItem] = []
        unresolved: list[UnresolvedRequest] = []
        seen_request_ids: set[str] = set()
        for request in requests:
            if request.request_id in seen_request_ids:
                unresolved.append(
                    UnresolvedRequest(request.request_id, request.kind.value, "DUPLICATE_REQUEST_ID", "request IDs must be unique")
                )
                continue
            seen_request_ids.add(request.request_id)
            try:
                record = self._resolve_one(request)
            except _Unresolved as exc:
                unresolved.append(
                    UnresolvedRequest(request.request_id, request.kind.value, exc.code, exc.detail)
                )
                continue
            items.append(
                EvidenceItem.create(
                    role=request.role,
                    value=record["value"],
                    provenance=EvidenceProvenance(
                        source_id=self.source_id,
                        source_type="xlsx_ooxml_ast",
                        source_hash=self.source_sha256,
                        locator=record["locator"],
                        extraction_method=record["method"],
                        source_schema_version=self.ast.schema_version,
                        provider_version=PROVIDER_VERSION,
                    ),
                    visibility=request.visibility,
                    semantic_label=request.semantic_label,
                    unit=record.get("unit"),
                    value_type=record.get("value_type"),
                )
            )
        return SpreadsheetEvidenceResult(EvidencePack.build(items), tuple(unresolved))

    def _resolve_one(self, request: SpreadsheetEvidenceRequest) -> dict[str, Any]:
        kind = request.kind
        if kind is RequestKind.WORKBOOK_SUMMARY:
            total_cells = sum(len(sheet.cells) for sheet in self.ast.sheets)
            nonblank = sum(not cell.is_blank for sheet in self.ast.sheets for cell in sheet.cells.values())
            formulas = sum(
                bool(cell.formula)
                for sheet in self.ast.sheets
                for cell in sheet.cells.values()
            )
            native_tables = sum(len(sheet.native_tables) for sheet in self.ast.sheets)
            detected_regions = sum(len(sheet.detected_regions) for sheet in self.ast.sheets)
            return {
                "value": {
                    "sheet_names": list(self.ast.workbook.sheet_names),
                    "sheet_count": len(self.ast.sheets),
                    "addressed_cell_count": total_cells,
                    "nonblank_cell_count": nonblank,
                    "stored_formula_count": formulas,
                    "native_table_count": native_tables,
                    "detected_region_count": detected_regions,
                },
                "locator": {"scope": "workbook"},
                "method": "typed_ast_summary",
                "value_type": "object",
            }

        if kind is RequestKind.SHEET_EXISTENCE:
            sheet_name = self._required(request.sheet_name, "sheet_name")
            return {
                "value": {"sheet_name": sheet_name, "exists": self.query.has_sheet(sheet_name)},
                "locator": {"sheet": sheet_name},
                "method": "SpreadsheetQueryEngine.has_sheet",
                "value_type": "object",
            }

        if kind is RequestKind.CELL:
            sheet_name = self._required(request.sheet_name, "sheet_name")
            coordinate = self._normalize_coordinate(self._required(request.coordinate, "coordinate"))
            if not self.query.has_cell(sheet_name, coordinate):
                raise _Unresolved("CELL_NOT_FOUND", f"no addressed source item at {sheet_name}!{coordinate}")
            cell = self.query.get_cell(sheet_name, coordinate)
            if cell is None:
                raise _Unresolved("CELL_NOT_FOUND", f"query did not resolve {sheet_name}!{coordinate}")
            return {
                "value": {
                    "sheet_name": sheet_name,
                    "coordinate": coordinate,
                    "raw_value": cell.raw_value,
                    "data_type": cell.data_type,
                    "is_blank": cell.is_blank,
                    "number_format": cell.number_format,
                    "formula": cell.formula,
                },
                "locator": {"sheet": sheet_name, "coordinate": coordinate, "query_kind": "cell"},
                "method": "SpreadsheetQueryEngine.has_cell/get_cell",
                "value_type": "object",
            }

        if kind is RequestKind.RANGE:
            sheet_name = self._required(request.sheet_name, "sheet_name")
            range_ref = self._normalize_range(self._required(request.range_ref, "range_ref"))
            if not self.query.has_range(sheet_name, range_ref):
                raise _Unresolved("RANGE_NOT_FOUND_OR_INVALID", f"range is not valid in the requested source: {sheet_name}!{range_ref}")
            return {
                "value": {"state": "PRESENT", "sheet_name": sheet_name, "range_ref": range_ref},
                "locator": {"sheet": sheet_name, "range": range_ref, "query_kind": "range"},
                "method": "SpreadsheetQueryEngine.has_range",
                "value_type": "object",
            }

        if kind is RequestKind.NATIVE_TABLE:
            name = self._required(request.name, "name")
            table = self.query.get_native_table(name)
            value = {"state": "PRESENT", "name": table.name, "display_name": table.display_name, "range_ref": table.range_ref, "sheet_name": table.sheet_name} if table else {"state": "NOT_PRESENT", "name": name}
            return {
                "value": value,
                "locator": {"native_table_name": name, "query_kind": "native_ooxml_table"},
                "method": "SpreadsheetQueryEngine.get_native_table",
                "value_type": "object",
            }

        if kind is RequestKind.DETECTED_REGION:
            sheet_name = self._required(request.sheet_name, "sheet_name")
            name = self._required(request.name, "name")
            if not self.query.has_sheet(sheet_name):
                raise _Unresolved("SHEET_NOT_FOUND", f"no source named {sheet_name!r}")
            region = self.query.get_detected_region(name)
            if region is None or region.name.casefold() != sheet_name.casefold():
                value = {"state": "NOT_PRESENT", "name": name, "sheet_name": sheet_name}
            else:
                value = {
                    "state": "PRESENT",
                    "name": region.name,
                    "range_ref": region.range_ref,
                    "headers": list(region.headers),
                    "detected_row": region.detected_row,
                    "source_type": region.source_type,
                }
            return {
                "value": value,
                "locator": {"sheet": sheet_name, "detected_region": name, "query_kind": "detected_range"},
                "method": "SpreadsheetQueryEngine.has_detected_region/get_detected_region",
                "value_type": "object",
            }

        if kind is RequestKind.DEFINED_NAME:
            name = self._required(request.name, "name")
            exists = self.query.has_defined_name(name)
            return {
                "value": {"state": "PRESENT", "name": name, "expression": self.query.get_defined_name(name)} if exists else {"state": "NOT_PRESENT", "name": name},
                "locator": {"defined_name": name, "query_kind": "defined_name"},
                "method": "SpreadsheetQueryEngine.has_defined_name/get_defined_name",
                "value_type": "object",
            }

        if kind is RequestKind.STORED_FORMULA:
            sheet_name = self._required(request.sheet_name, "sheet_name")
            coordinate = self._normalize_coordinate(self._required(request.coordinate, "coordinate"))
            if not self.query.has_cell(sheet_name, coordinate):
                raise _Unresolved("CELL_NOT_FOUND", f"no addressed source item at {sheet_name}!{coordinate}")
            cell = self.query.get_cell(sheet_name, coordinate)
            present = self.query.has_stored_formula(sheet_name, coordinate)
            return {
                "value": {
                    "state": "PRESENT" if present else "NOT_PRESENT",
                    "sheet_name": sheet_name,
                    "coordinate": coordinate,
                    "formula": cell.formula if cell else None,
                },
                "locator": {"sheet": sheet_name, "coordinate": coordinate, "query_kind": "stored_formula"},
                "method": "SpreadsheetQueryEngine.has_stored_formula",
                "value_type": "object",
            }

        if kind is RequestKind.HEADER:
            sheet_name = self._required(request.sheet_name, "sheet_name")
            column = self._normalize_column(self._required(request.column, "column"))
            header = self.query.get_column_header(sheet_name, column)
            if header is None:
                raise _Unresolved("HEADER_NOT_FOUND", f"no header metadata for {sheet_name} column {column}")
            return {
                "value": {
                    "index": header.index,
                    "column_letter": header.column_letter,
                    "header": header.header,
                    "header_source": header.header_source,
                },
                "locator": {"sheet": sheet_name, "column": header.column_letter, "query_kind": "column_header"},
                "method": "SpreadsheetQueryEngine.get_column_header",
                "value_type": "object",
            }

        raise _Unresolved("UNSUPPORTED_REQUEST_KIND", f"unsupported request kind {kind!r}")

    @staticmethod
    def _required(value: Any, name: str) -> Any:
        if value is None or (isinstance(value, str) and not value.strip()):
            raise _Unresolved("INVALID_REQUEST", f"{name} is required")
        return value

    @staticmethod
    def _normalize_coordinate(value: str) -> str:
        try:
            column, row = parse_coordinate(value)
            if row < 1:
                raise ValueError("row index must be positive")
            col_letter_to_index(column)
        except ValueError as exc:
            raise _Unresolved("INVALID_LOCATOR", f"invalid coordinate {value!r}: {exc}") from exc
        return f"{column.upper()}{row}"

    @staticmethod
    def _normalize_range(value: str) -> str:
        try:
            (start_col, start_row), (end_col, end_row) = parse_range(value)
            start_index = col_letter_to_index(start_col)
            end_index = col_letter_to_index(end_col)
            if start_row < 1 or end_row < 1 or start_index > end_index or start_row > end_row:
                raise ValueError("range bounds are reversed or non-positive")
        except ValueError as exc:
            raise _Unresolved("INVALID_LOCATOR", f"invalid range {value!r}: {exc}") from exc
        return f"{start_col.upper()}{start_row}:{end_col.upper()}{end_row}"

    @staticmethod
    def _normalize_column(value: str | int) -> str | int:
        if isinstance(value, bool):
            raise _Unresolved("INVALID_LOCATOR", "boolean is not a column index")
        if isinstance(value, int):
            if value < 1:
                raise _Unresolved("INVALID_LOCATOR", "column index must be positive")
            return value
        try:
            normalized = value.strip().upper()
            if not normalized:
                raise ValueError("column letters must not be blank")
            col_letter_to_index(normalized)
            return normalized
        except (AttributeError, ValueError) as exc:
            raise _Unresolved("INVALID_LOCATOR", "column must be a valid letter sequence or positive integer") from exc


class _Unresolved(Exception):
    def __init__(self, code: str, detail: str) -> None:
        self.code = code
        self.detail = detail
