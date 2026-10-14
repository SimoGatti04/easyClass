"""Data structures for Spreadsheet Workbook AST (CellAwareSpreadsheetAdapter).

Fully JSON-serializable dataclasses providing a strict, typed representation
of workbook, sheet, table, and cell structures.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


SCHEMA_VERSION = "1.1.0"


def col_letter_to_index(col_letter: str) -> int:
    """Converts column letter (e.g. 'A', 'Z', 'AA') to 1-based index."""
    idx = 0
    for char in col_letter.upper():
        if not ('A' <= char <= 'Z'):
            raise ValueError(f"Invalid column letter '{col_letter}'")
        idx = idx * 26 + (ord(char) - ord('A') + 1)
    return idx


def col_index_to_letter(col_idx: int) -> str:
    """Converts 1-based index (e.g. 1, 26, 27) to column letter ('A', 'Z', 'AA')."""
    if col_idx < 1:
        raise ValueError(f"Column index must be >= 1, got {col_idx}")
    letters = []
    while col_idx > 0:
        col_idx, remainder = divmod(col_idx - 1, 26)
        letters.append(chr(ord('A') + remainder))
    return "".join(reversed(letters))


def parse_coordinate(coord: str) -> tuple[str, int]:
    """Splits coordinate like 'B3' into ('B', 3)."""
    m = re.match(r"^([A-Za-z]+)(\d+)$", coord.strip())
    if not m:
        raise ValueError(f"Invalid coordinate format '{coord}'")
    return m.group(1).upper(), int(m.group(2))


def parse_range(range_ref: str) -> tuple[tuple[str, int], tuple[str, int]]:
    """Parses range string like 'A3:C9' into (('A', 3), ('C', 9))."""
    parts = range_ref.split(":")
    if len(parts) == 1:
        c, r = parse_coordinate(parts[0])
        return (c, r), (c, r)
    elif len(parts) == 2:
        return parse_coordinate(parts[0]), parse_coordinate(parts[1])
    else:
        raise ValueError(f"Invalid range format: '{range_ref}'")


@dataclass
class CachedValueInfo:
    value: Any
    availability: str                 # "present" | "not_present"
    freshness: str = "unknown"        # "unknown" | "known"
    trust: str = "informational_only" # Strictly informational, never verified ground truth


@dataclass
class CellAST:
    coordinate: str                   # e.g. "B3"
    row: int                          # 1-based row index
    column: int                       # 1-based column index
    column_letter: str                # e.g. "B"
    raw_value: Any                    # Primitive value (str, int, float, bool, None)
    data_type: str                    # "string" | "number" | "boolean" | "date" | "empty" | "error"
    is_blank: bool                    # True if value is None or empty string
    formula: Optional[str] = None     # Stored formula if FORMULA_PRESENT_IN_WORKBOOK, else None
    cached_value: Optional[CachedValueInfo] = None
    number_format: Optional[str] = None
    is_merged: bool = False           # True if coordinate participates in a merged range
    merge_parent: Optional[str] = None # Coordinate of the top-left cell of the merge range, if merged

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ColumnHeaderAST:
    index: int                        # 1-based column index
    column_letter: str                # e.g. "A"
    header: Optional[str] = None      # Header label if detected or defined
    header_source: str = "unassigned" # "native_table" | "detected_row" | "explicit_cell"


@dataclass
class NativeTableAST:
    table_id: int
    name: str                         # Table name (e.g. "Catalogo")
    display_name: str                 # Display name from OOXML table tag
    range_ref: str                    # e.g. "A3:C9"
    headers: List[str]                # Table column names from tableColumns
    sheet_name: str                   # Name of the hosting sheet
    source_type: str = "native_ooxml_table"


@dataclass
class DetectedRegionAST:
    name: str                         # Region label (e.g. sheet_name)
    range_ref: str                    # e.g. "A3:C9"
    headers: List[str]                # Detected header strings
    detected_row: int                 # Row index where headers were detected
    source_type: str = "detected_range"


@dataclass
class SheetMetadataAST:
    name: str                         # Sheet name
    sheet_id: int                     # Internal sheet ID
    dimensions: Optional[str] = None  # e.g. "A1:M14"
    min_row: int = 1
    max_row: int = 1
    min_col: int = 1
    max_col: int = 1
    hidden: bool = False
    merged_ranges: List[str] = field(default_factory=list)


@dataclass
class SheetAST:
    metadata: SheetMetadataAST
    columns: List[ColumnHeaderAST] = field(default_factory=list)
    native_tables: List[NativeTableAST] = field(default_factory=list)
    detected_regions: List[DetectedRegionAST] = field(default_factory=list)
    cells: Dict[str, CellAST] = field(default_factory=dict)  # coord -> CellAST

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class WorkbookMetadataAST:
    sheet_names: List[str]
    defined_names: Dict[str, str] = field(default_factory=dict)
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SpreadsheetWorkbookAST:
    schema_version: str
    source_file: str
    sha256: str
    workbook: WorkbookMetadataAST
    sheets: List[SheetAST]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
