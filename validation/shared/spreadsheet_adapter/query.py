"""Deterministic Query Interface for SpreadsheetWorkbookAST.

Provides strict, unambiguous semantic verification functions distinguishing:
- Native OOXML Tables (has_native_table / get_native_table)
- Workbook Defined Names (has_defined_name / get_defined_name)
- Heuristically Detected Regions (has_detected_region / get_detected_region)
- Stored Formulas vs Generated Proposals
- Physically serialized cells vs cells participating in merged ranges.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from .models import (
    CellAST,
    ColumnHeaderAST,
    DetectedRegionAST,
    NativeTableAST,
    SheetAST,
    SpreadsheetWorkbookAST,
    col_index_to_letter,
    col_letter_to_index,
    parse_coordinate,
    parse_range,
)


class SpreadsheetQueryEngine:
    """Provides fast, deterministic semantic checks against an AST."""

    def __init__(self, ast: SpreadsheetWorkbookAST):
        self.ast = ast
        self._sheets_by_name: Dict[str, SheetAST] = {
            s.metadata.name.lower(): s for s in ast.sheets
        }
        self._exact_sheets_by_name: Dict[str, SheetAST] = {
            s.metadata.name: s for s in ast.sheets
        }

    # =========================================================================
    # Sheet Queries
    # =========================================================================

    def has_sheet(self, sheet_name: str) -> bool:
        """Returns True if the sheet exists in the workbook."""
        return sheet_name in self._exact_sheets_by_name or sheet_name.lower() in self._sheets_by_name

    def get_sheet(self, sheet_name: str) -> Optional[SheetAST]:
        """Returns SheetAST by name (case-tolerant)."""
        return self._exact_sheets_by_name.get(sheet_name) or self._sheets_by_name.get(sheet_name.lower())

    # =========================================================================
    # Native Table Queries (Strict SOURCE_SPECIFIC_DETAIL)
    # =========================================================================

    def has_native_table(self, table_name: str) -> bool:
        """Returns True ONLY if a native OOXML Table object exists with that name."""
        target = table_name.strip().lower()
        for sheet in self.ast.sheets:
            for nt in sheet.native_tables:
                if nt.name.lower() == target or nt.display_name.lower() == target:
                    return True
        return False

    def get_native_table(self, table_name: str) -> Optional[NativeTableAST]:
        """Returns the NativeTableAST if a native Excel Table exists."""
        target = table_name.strip().lower()
        for sheet in self.ast.sheets:
            for nt in sheet.native_tables:
                if nt.name.lower() == target or nt.display_name.lower() == target:
                    return nt
        return None

    def has_table(self, table_name: str) -> bool:
        """Strict alias for has_native_table(). Never returns True for detected regions."""
        return self.has_native_table(table_name)

    # =========================================================================
    # Defined Names Queries
    # =========================================================================

    def has_defined_name(self, name: str) -> bool:
        """Returns True if a workbook defined name exists."""
        target = name.strip().lower()
        for dn in self.ast.workbook.defined_names:
            if dn.lower() == target:
                return True
        return False

    def get_defined_name(self, name: str) -> Optional[str]:
        """Returns the defined name range/expression if present."""
        target = name.strip().lower()
        for dn, val in self.ast.workbook.defined_names.items():
            if dn.lower() == target:
                return val
        return None

    # =========================================================================
    # Heuristic Detected Region Queries (Convenience Layer Only)
    # =========================================================================

    def has_detected_region(self, region_name: str) -> bool:
        """Returns True if a heuristic detected region matches the label."""
        target = region_name.strip().lower()
        for sheet in self.ast.sheets:
            for reg in sheet.detected_regions:
                if reg.name.lower() == target:
                    return True
        return False

    def get_detected_region(self, region_name: str) -> Optional[DetectedRegionAST]:
        """Returns the DetectedRegionAST if present."""
        target = region_name.strip().lower()
        for sheet in self.ast.sheets:
            for reg in sheet.detected_regions:
                if reg.name.lower() == target:
                    return reg
        return None

    # =========================================================================
    # Coordinate & Bounds Queries (including Merged Ranges)
    # =========================================================================

    def is_coordinate_within_dimensions(self, sheet_name: str, coordinate: str) -> bool:
        """Returns True if coordinate falls within the physical bounding box of the sheet."""
        sheet = self.get_sheet(sheet_name)
        if not sheet:
            return False

        try:
            col_letter, row_num = parse_coordinate(coordinate)
            col_idx = col_letter_to_index(col_letter)
        except ValueError:
            return False

        meta = sheet.metadata
        return (
            meta.min_col <= col_idx <= meta.max_col
            and meta.min_row <= row_num <= meta.max_row
        )

    def is_coordinate_in_merged_range(self, sheet_name: str, coordinate: str) -> bool:
        """Returns True if coordinate participates in an explicit merged range."""
        sheet = self.get_sheet(sheet_name)
        if not sheet:
            return False

        cell = sheet.cells.get(coordinate.strip().upper())
        if cell is not None and cell.is_merged:
            return True

        # Fallback check against merged_ranges list
        try:
            target_col, target_r = parse_coordinate(coordinate)
            t_col_idx = col_letter_to_index(target_col)
            for m_ref in sheet.metadata.merged_ranges:
                (start_col, start_r), (end_col, end_r) = parse_range(m_ref)
                s_col_idx = col_letter_to_index(start_col)
                e_col_idx = col_letter_to_index(end_col)
                if (s_col_idx <= t_col_idx <= e_col_idx) and (start_r <= target_r <= end_r):
                    return True
        except Exception:
            pass

        return False

    def is_valid_coordinate(self, sheet_name: str, coordinate: str) -> bool:
        """Returns True if coordinate is physically present, in bounds, or in a merged range."""
        return (
            self.has_cell(sheet_name, coordinate)
            or self.is_coordinate_within_dimensions(sheet_name, coordinate)
            or self.is_coordinate_in_merged_range(sheet_name, coordinate)
        )

    def has_cell(self, sheet_name: str, coordinate: str, non_blank_only: bool = False) -> bool:
        """Checks if a cell is present in the sheet, optionally requiring non-blank content."""
        sheet = self.get_sheet(sheet_name)
        if not sheet:
            return False

        coord_clean = coordinate.strip().upper()
        cell = sheet.cells.get(coord_clean)
        if cell is None:
            return False
        if non_blank_only and cell.is_blank:
            return False
        return True

    def get_cell(self, sheet_name: str, coordinate: str) -> Optional[CellAST]:
        """Returns CellAST if populated in the sheet."""
        sheet = self.get_sheet(sheet_name)
        if not sheet:
            return None
        return sheet.cells.get(coordinate.strip().upper())

    # =========================================================================
    # Header & Range Queries
    # =========================================================================

    def get_column_header(self, sheet_name: str, column: str | int) -> Optional[ColumnHeaderAST]:
        """Returns the ColumnHeaderAST for the given column preserving provenance."""
        sheet = self.get_sheet(sheet_name)
        if not sheet:
            return None

        if isinstance(column, str):
            col_idx = col_letter_to_index(column.strip().upper())
        else:
            col_idx = int(column)

        for col in sheet.columns:
            if col.index == col_idx:
                return col
        return None

    def get_column_header_text(self, sheet_name: str, column: str | int) -> Optional[str]:
        """Returns the string header for the given column."""
        h = self.get_column_header(sheet_name, column)
        return h.header if h else None

    def has_range(self, sheet_name: str, range_ref: str) -> bool:
        """Validates that a range string (e.g. 'A3:C9') is fully within sheet dimensions."""
        sheet = self.get_sheet(sheet_name)
        if not sheet:
            return False

        try:
            (start_c, start_r), (end_c, end_r) = parse_range(range_ref)
            start_coord = f"{start_c}{start_r}"
            end_coord = f"{end_c}{end_r}"
            return (
                self.is_valid_coordinate(sheet_name, start_coord)
                and self.is_valid_coordinate(sheet_name, end_coord)
            )
        except ValueError:
            return False

    # =========================================================================
    # Formula Queries (Strict distinction: Stored in file vs Generated)
    # =========================================================================

    def has_stored_formula(self, sheet_name: str, coordinate: str) -> bool:
        """Returns True ONLY if a formula is physically stored in the workbook cell."""
        cell = self.get_cell(sheet_name, coordinate)
        if not cell:
            return False
        return cell.formula is not None and len(cell.formula) > 0

    def is_formula_present_in_workbook(self, formula: str, sheet_name: Optional[str] = None) -> bool:
        """Checks if the exact formula string (normalized) exists anywhere in sheet or workbook."""
        target = formula.strip().upper()
        if not target.startswith("="):
            target = f"={target}"

        sheets_to_check = [self.get_sheet(sheet_name)] if sheet_name else self.ast.sheets
        for s in sheets_to_check:
            if not s:
                continue
            for cell in s.cells.values():
                if cell.formula and cell.formula.strip().upper() == target:
                    return True
        return False
