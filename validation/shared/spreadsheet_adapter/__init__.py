"""CellAwareSpreadsheetAdapter Package.

Deterministic spreadsheet structural extractor for Teacher Service.
Distinguishes native OOXML structures, stored formulas, and heuristic convenience detections.
"""

from .models import (
    SCHEMA_VERSION,
    CachedValueInfo,
    CellAST,
    ColumnHeaderAST,
    DetectedRegionAST,
    NativeTableAST,
    SheetAST,
    SheetMetadataAST,
    SpreadsheetWorkbookAST,
    WorkbookMetadataAST,
    col_index_to_letter,
    col_letter_to_index,
    parse_coordinate,
    parse_range,
)
from .adapter import (
    CellAwareSpreadsheetAdapter,
    InvalidWorkbookError,
    SpreadsheetAdapterError,
)
from .query import (
    SpreadsheetQueryEngine,
)
from .ooxml_spot_check import (
    run_independent_ooxml_spot_check,
)

__all__ = [
    "SCHEMA_VERSION",
    "CachedValueInfo",
    "CellAST",
    "ColumnHeaderAST",
    "DetectedRegionAST",
    "NativeTableAST",
    "SheetAST",
    "SheetMetadataAST",
    "SpreadsheetWorkbookAST",
    "WorkbookMetadataAST",
    "col_index_to_letter",
    "col_letter_to_index",
    "parse_coordinate",
    "parse_range",
    "CellAwareSpreadsheetAdapter",
    "InvalidWorkbookError",
    "SpreadsheetAdapterError",
    "SpreadsheetQueryEngine",
    "run_independent_ooxml_spot_check",
]
