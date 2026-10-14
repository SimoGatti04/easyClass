"""CellAwareSpreadsheetAdapter — Deterministic Local XLSX Structural AST Extractor.

Extracts workbook, sheet, native tables, cell, formula, and coordinate structures
directly from OOXML packages using Python standard libraries (zipfile, xml.etree.ElementTree).
Operates strictly locally with zero AI, explicit separation between native OOXML objects
and heuristic convenience detection, and explicit failure modes.
"""

from __future__ import annotations

import hashlib
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Set, Tuple

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


OOXML_NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
}

BUILTIN_NUM_FMTS = {
    0: "General",
    1: "0",
    2: "0.00",
    3: "#,##0",
    4: "#,##0.00",
    9: "0%",
    10: "0.00%",
    11: "0.00E+00",
    12: "# ?/?",
    13: "# ??/??",
    14: "mm-dd-yy",
    15: "d-mmm-yy",
    16: "d-mmm",
    17: "mmm-yy",
    18: "h:mm AM/PM",
    19: "h:mm:ss AM/PM",
    20: "h:mm",
    21: "h:mm:ss",
    22: "m/d/yy h:mm",
    37: "#,##0 ;(#,##0)",
    38: "#,##0 ;[Red](#,##0)",
    39: "#,##0.00;(#,##0.00)",
    40: "#,##0.00;[Red](#,##0.00)",
    44: r'_("$"* #,##0.00_);_("$"* \(#,##0.00\);_("$"* "-"??_);_(@_)',
    45: "mm:ss",
    46: "[h]:mm:ss",
    47: "mmss.0",
    48: "##0.0E+0",
    49: "@",
}


class SpreadsheetAdapterError(Exception):
    """Base error for spreadsheet adapter failures."""
    pass


class InvalidWorkbookError(SpreadsheetAdapterError):
    """Raised when the workbook file is not a valid ZIP/XLSX archive."""
    pass


class CellAwareSpreadsheetAdapter:
    """Deterministic extractor for OOXML spreadsheet files (.xlsx)."""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self._sha256: Optional[str] = None
        self._ast: Optional[SpreadsheetWorkbookAST] = None

    def extract_ast(self) -> SpreadsheetWorkbookAST:
        """Parses the XLSX file and returns the SpreadsheetWorkbookAST."""
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"Workbook file not found: {self.file_path}")

        if not os.path.isfile(self.file_path):
            raise InvalidWorkbookError(f"Path is not a regular file: {self.file_path}")

        # Compute file hash
        h = hashlib.sha256()
        with open(self.file_path, "rb") as f:
            while chunk := f.read(65536):
                h.update(chunk)
        self._sha256 = h.hexdigest()

        # Check ZIP validity
        if not zipfile.is_zipfile(self.file_path):
            raise InvalidWorkbookError(f"File is not a valid ZIP or XLSX package: {self.file_path}")

        try:
            with zipfile.ZipFile(self.file_path, "r") as z:
                ast = self._parse_zip(z)
                self._ast = ast
                return ast
        except zipfile.BadZipFile as e:
            raise InvalidWorkbookError(f"Corrupt ZIP archive: {e}") from e
        except Exception as e:
            if isinstance(e, SpreadsheetAdapterError):
                raise
            raise SpreadsheetAdapterError(f"Failed to extract AST from {self.file_path}: {e}") from e

    def _parse_zip(self, z: zipfile.ZipFile) -> SpreadsheetWorkbookAST:
        namelist = set(z.namelist())

        if "xl/workbook.xml" not in namelist:
            raise InvalidWorkbookError("Missing 'xl/workbook.xml'. File is not a valid Excel workbook.")

        # 1. Parse shared strings if present
        shared_strings = self._load_shared_strings(z)

        # 2. Parse styles (number formats)
        num_fmt_map = self._load_styles(z)

        # 3. Parse workbook relationships (map r:id -> worksheet path)
        wb_rels = self._load_workbook_rels(z)

        # 4. Parse workbook.xml (sheets, defined names)
        sheet_descriptors, defined_names = self._load_workbook_xml(z)

        # 5. Parse each worksheet
        sheets_ast: List[SheetAST] = []
        sheet_names: List[str] = []

        for s_info in sheet_descriptors:
            s_name = s_info["name"]
            s_id = s_info["sheet_id"]
            r_id = s_info["r_id"]
            hidden = s_info.get("hidden", False)
            sheet_names.append(s_name)

            rel_target = wb_rels.get(r_id)
            if not rel_target:
                # Fallback to direct path convention
                sheet_xml_path = f"xl/worksheets/sheet{s_id}.xml"
            else:
                target_clean = rel_target.lstrip("/")
                if not target_clean.startswith("xl/"):
                    sheet_xml_path = f"xl/{target_clean}"
                else:
                    sheet_xml_path = target_clean

            if sheet_xml_path not in namelist:
                raise InvalidWorkbookError(f"Worksheet XML '{sheet_xml_path}' not found in archive.")

            sheet_ast = self._parse_worksheet(
                z=z,
                sheet_xml_path=sheet_xml_path,
                sheet_name=s_name,
                sheet_id=s_id,
                hidden=hidden,
                shared_strings=shared_strings,
                num_fmt_map=num_fmt_map,
            )
            sheets_ast.append(sheet_ast)

        wb_meta = WorkbookMetadataAST(
            sheet_names=sheet_names,
            defined_names=defined_names,
            properties={"sheets_count": len(sheets_ast)},
        )

        return SpreadsheetWorkbookAST(
            schema_version=SCHEMA_VERSION,
            source_file=os.path.basename(self.file_path),
            sha256=self._sha256 or "",
            workbook=wb_meta,
            sheets=sheets_ast,
        )

    def _load_shared_strings(self, z: zipfile.ZipFile) -> List[str]:
        if "xl/sharedStrings.xml" not in z.namelist():
            return []
        try:
            tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
            strings = []
            for si in tree.findall(".//m:si", OOXML_NS):
                parts = [t.text or "" for t in si.findall(".//m:t", OOXML_NS)]
                strings.append("".join(parts))
            return strings
        except Exception:
            return []

    def _load_styles(self, z: zipfile.ZipFile) -> Dict[int, str]:
        """Maps style index (xf) to resolved number format string."""
        if "xl/styles.xml" not in z.namelist():
            return {}
        try:
            tree = ET.fromstring(z.read("xl/styles.xml"))
            custom_fmts: Dict[int, str] = {}
            for nf in tree.findall(".//m:numFmt", OOXML_NS):
                try:
                    nid = int(nf.attrib.get("numFmtId", "0"))
                    code = nf.attrib.get("formatCode", "")
                    custom_fmts[nid] = code
                except ValueError:
                    continue

            # Combine built-in and custom
            all_fmts = dict(BUILTIN_NUM_FMTS)
            all_fmts.update(custom_fmts)

            # Map cellXfs index -> format code
            xf_map: Dict[int, str] = {}
            cell_xfs = tree.findall(".//m:cellXfs/m:xf", OOXML_NS)
            for idx, xf in enumerate(cell_xfs):
                try:
                    num_fmt_id = int(xf.attrib.get("numFmtId", "0"))
                    xf_map[idx] = all_fmts.get(num_fmt_id, "General")
                except ValueError:
                    xf_map[idx] = "General"
            return xf_map
        except Exception:
            return {}

    def _load_workbook_rels(self, z: zipfile.ZipFile) -> Dict[str, str]:
        rels_path = "xl/_rels/workbook.xml.rels"
        if rels_path not in z.namelist():
            return {}
        try:
            tree = ET.fromstring(z.read(rels_path))
            rels = {}
            for r in tree:
                rid = r.attrib.get("Id")
                target = r.attrib.get("Target")
                if rid and target:
                    rels[rid] = target
            return rels
        except Exception:
            return {}

    def _load_workbook_xml(self, z: zipfile.ZipFile) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
        tree = ET.fromstring(z.read("xl/workbook.xml"))
        sheets_info = []
        for s in tree.findall(".//m:sheet", OOXML_NS):
            name = s.attrib.get("name", "")
            sid = int(s.attrib.get("sheetId", "1"))
            rid = s.attrib.get(f"{{{OOXML_NS['r']}}}id", "")
            state = s.attrib.get("state", "visible")
            sheets_info.append({
                "name": name,
                "sheet_id": sid,
                "r_id": rid,
                "hidden": state in ("hidden", "veryHidden"),
            })

        defined_names = {}
        for dn in tree.findall(".//m:definedName", OOXML_NS):
            name = dn.attrib.get("name")
            val = dn.text or ""
            if name and not name.startswith("_xlnm"):  # skip Excel internal print areas
                defined_names[name] = val.strip()

        return sheets_info, defined_names

    def _parse_worksheet(
        self,
        z: zipfile.ZipFile,
        sheet_xml_path: str,
        sheet_name: str,
        sheet_id: int,
        hidden: bool,
        shared_strings: List[str],
        num_fmt_map: Dict[int, str],
    ) -> SheetAST:
        tree = ET.fromstring(z.read(sheet_xml_path))

        dim_elem = tree.find(".//m:dimension", OOXML_NS)
        dim_str = dim_elem.attrib.get("ref") if dim_elem is not None else None

        merged_ranges = [
            mc.attrib.get("ref")
            for mc in tree.findall(".//m:mergeCell", OOXML_NS)
            if mc.attrib.get("ref")
        ]

        # Scan cells and rows
        cells_dict: Dict[str, CellAST] = {}
        min_row = 1000000
        max_row = 0
        min_col = 1000000
        max_col = 0

        for row_elem in tree.findall(".//m:row", OOXML_NS):
            r_attr = row_elem.attrib.get("r")
            row_idx = int(r_attr) if r_attr else 1

            for c_elem in row_elem.findall(".//m:c", OOXML_NS):
                coord = c_elem.attrib.get("r")
                if not coord:
                    continue

                col_letter, row_num = parse_coordinate(coord)
                col_idx = col_letter_to_index(col_letter)

                min_row = min(min_row, row_num)
                max_row = max(max_row, row_num)
                min_col = min(min_col, col_idx)
                max_col = max(max_col, col_idx)

                # Check formula
                f_elem = c_elem.find("m:f", OOXML_NS)
                formula_str = None
                if f_elem is not None and f_elem.text:
                    f_text = f_elem.text.strip()
                    formula_str = f"={f_text}" if not f_text.startswith("=") else f_text

                # Check value
                t_attr = c_elem.attrib.get("t")
                v_elem = c_elem.find("m:v", OOXML_NS)
                v_text = v_elem.text.strip() if v_elem is not None and v_elem.text else ""

                # Style number format
                s_attr = c_elem.attrib.get("s")
                style_idx = int(s_attr) if s_attr and s_attr.isdigit() else 0
                num_fmt = num_fmt_map.get(style_idx, "General")

                raw_val, data_type, is_blank = self._resolve_cell_value(
                    t_attr=t_attr,
                    v_text=v_text,
                    shared_strings=shared_strings,
                    num_fmt=num_fmt,
                    is_formula=bool(formula_str),
                )

                cached_val_info = None
                if formula_str:
                    # Formula is present: v_text is the precalculated/cached value
                    cached_val_info = CachedValueInfo(
                        value=raw_val if not is_blank else None,
                        availability="present" if not is_blank else "not_present",
                        freshness="unknown",
                        trust="informational_only",
                    )
                    # For a formula cell, raw_value represents the evaluated/cached value if present
                    raw_val = None

                cell_ast = CellAST(
                    coordinate=coord,
                    row=row_num,
                    column=col_idx,
                    column_letter=col_letter,
                    raw_value=raw_val,
                    data_type=data_type,
                    is_blank=is_blank,
                    formula=formula_str,
                    cached_value=cached_val_info,
                    number_format=num_fmt if num_fmt != "General" else None,
                    is_merged=False,
                    merge_parent=None,
                )
                cells_dict[coord] = cell_ast

        # Process merged ranges to ensure:
        # 1. Bounding box covers full extent of merges
        # 2. Coordinates participating in merges are recognized and linked to parent
        for m_ref in merged_ranges:
            try:
                (start_col, start_r), (end_col, end_r) = parse_range(m_ref)
                s_col_idx = col_letter_to_index(start_col)
                e_col_idx = col_letter_to_index(end_col)
                min_row = min(min_row, start_r)
                max_row = max(max_row, end_r)
                min_col = min(min_col, s_col_idx)
                max_col = max(max_col, e_col_idx)

                parent_coord = f"{start_col}{start_r}"
                for r_cur in range(start_r, end_r + 1):
                    for c_cur_idx in range(s_col_idx, e_col_idx + 1):
                        cur_coord = f"{col_index_to_letter(c_cur_idx)}{r_cur}"
                        if cur_coord in cells_dict:
                            cells_dict[cur_coord].is_merged = True
                            cells_dict[cur_coord].merge_parent = parent_coord
                        else:
                            # Create placeholder cell for un-serialized merged cell
                            cells_dict[cur_coord] = CellAST(
                                coordinate=cur_coord,
                                row=r_cur,
                                column=c_cur_idx,
                                column_letter=col_index_to_letter(c_cur_idx),
                                raw_value=None,
                                data_type="empty",
                                is_blank=True,
                                formula=None,
                                cached_value=None,
                                number_format=None,
                                is_merged=True,
                                merge_parent=parent_coord,
                            )
            except Exception:
                continue

        if min_row > max_row:
            min_row = max_row = 1
            min_col = max_col = 1

        calc_dim = f"{col_index_to_letter(min_col)}{min_row}:{col_index_to_letter(max_col)}{max_row}"
        final_dimensions = dim_str or calc_dim

        meta = SheetMetadataAST(
            name=sheet_name,
            sheet_id=sheet_id,
            dimensions=final_dimensions,
            min_row=min_row,
            max_row=max_row,
            min_col=min_col,
            max_col=max_col,
            hidden=hidden,
            merged_ranges=merged_ranges,
        )

        # 1. Parse Native OOXML Tables (xl/tables/table*.xml)
        native_tables = self._load_worksheet_native_tables(z, sheet_xml_path, sheet_name)

        # 2. Detected structural regions (heuristic convenience layer)
        detected_regions = self._detect_regions(sheet_name, cells_dict, min_row, max_row, min_col, max_col)

        # 3. Build ColumnHeaderAST preserving provenance
        columns = self._build_column_headers(
            cells_dict, native_tables, detected_regions, min_col, max_col
        )

        return SheetAST(
            metadata=meta,
            columns=columns,
            native_tables=native_tables,
            detected_regions=detected_regions,
            cells=cells_dict,
        )

    def _load_worksheet_native_tables(
        self,
        z: zipfile.ZipFile,
        sheet_xml_path: str,
        sheet_name: str,
    ) -> List[NativeTableAST]:
        """Parses native OOXML Table parts (xl/tables/table*.xml) associated with the worksheet."""
        native_tables: List[NativeTableAST] = []
        namelist = set(z.namelist())

        sheet_tree = ET.fromstring(z.read(sheet_xml_path))
        tparts = sheet_tree.findall(".//m:tableParts/m:tablePart", OOXML_NS)
        if not tparts:
            return native_tables

        # Find relationships for this worksheet
        # Typically xl/worksheets/_rels/sheetN.xml.rels
        sheet_dir, sheet_file = os.path.split(sheet_xml_path)
        sheet_rels_path = f"{sheet_dir}/_rels/{sheet_file}.rels"

        table_rel_map: Dict[str, str] = {}
        if sheet_rels_path in namelist:
            try:
                rels_tree = ET.fromstring(z.read(sheet_rels_path))
                for r in rels_tree:
                    rid = r.attrib.get("Id")
                    target = r.attrib.get("Target")
                    if rid and target:
                        # Normalize target relative to sheet_dir
                        # e.g. ../tables/table1.xml -> xl/tables/table1.xml
                        norm_target = os.path.normpath(os.path.join(sheet_dir, target)).replace("\\", "/")
                        table_rel_map[rid] = norm_target
            except Exception:
                pass

        for tp in tparts:
            rid = tp.attrib.get(f"{{{OOXML_NS['r']}}}id") or tp.attrib.get("id")
            table_xml_path = table_rel_map.get(rid)

            if not table_xml_path or table_xml_path not in namelist:
                continue

            try:
                t_tree = ET.fromstring(z.read(table_xml_path))
                tid = int(t_tree.attrib.get("id", "0"))
                tname = t_tree.attrib.get("name", "")
                disp_name = t_tree.attrib.get("displayName", tname)
                tref = t_tree.attrib.get("ref", "")

                headers = []
                for tc in t_tree.findall(".//m:tableColumns/m:tableColumn", OOXML_NS):
                    headers.append(tc.attrib.get("name", ""))

                native_tables.append(NativeTableAST(
                    table_id=tid,
                    name=tname,
                    display_name=disp_name,
                    range_ref=tref,
                    headers=headers,
                    sheet_name=sheet_name,
                    source_type="native_ooxml_table",
                ))
            except Exception:
                continue

        return native_tables

    def _resolve_cell_value(
        self,
        t_attr: Optional[str],
        v_text: str,
        shared_strings: List[str],
        num_fmt: str,
        is_formula: bool,
    ) -> Tuple[Any, str, bool]:
        if not v_text:
            return None, "empty", True

        if t_attr == "s":
            try:
                idx = int(v_text)
                str_val = shared_strings[idx] if idx < len(shared_strings) else v_text
                return str_val, "string", False
            except ValueError:
                return v_text, "string", False

        if t_attr in ("str", "inlineStr"):
            return v_text, "string", False

        if t_attr == "b":
            return (v_text == "1"), "boolean", False

        if t_attr == "e":
            return v_text, "error", False

        # Numeric or date
        try:
            if "." in v_text or "e" in v_text.lower():
                num_val = float(v_text)
            else:
                num_val = int(v_text)

            is_date = any(d in num_fmt.lower() for d in ("yy", "mm", "dd"))
            data_type = "date" if is_date else "number"
            return num_val, data_type, False
        except ValueError:
            return v_text, "string", False

    def _detect_regions(
        self,
        sheet_name: str,
        cells: Dict[str, CellAST],
        min_row: int,
        max_row: int,
        min_col: int,
        max_col: int,
    ) -> List[DetectedRegionAST]:
        """Heuristic convenience layer: detects probable tabular regions based on string density."""
        detected_regions: List[DetectedRegionAST] = []

        best_header_row = None
        best_header_cells = {}
        for r in range(min_row, min(max_row + 1, min_row + 6)):
            row_cells = {
                c.column: c.raw_value
                for c in cells.values()
                if c.row == r and c.data_type == "string" and c.raw_value and len(str(c.raw_value).strip()) > 0
            }
            if len(row_cells) > len(best_header_cells):
                best_header_cells = row_cells
                best_header_row = r

        if best_header_row is not None:
            col_indices = sorted(best_header_cells.keys())
            if len(col_indices) >= 2:
                start_c = col_index_to_letter(col_indices[0])
                end_c = col_index_to_letter(col_indices[-1])
                t_headers = [str(best_header_cells[c]) for c in col_indices]
                table_range = f"{start_c}{best_header_row}:{end_c}{max_row}"
                detected_regions.append(DetectedRegionAST(
                    name=sheet_name,
                    range_ref=table_range,
                    headers=t_headers,
                    detected_row=best_header_row,
                    source_type="detected_range",
                ))

        return detected_regions

    def _build_column_headers(
        self,
        cells: Dict[str, CellAST],
        native_tables: List[NativeTableAST],
        detected_regions: List[DetectedRegionAST],
        min_col: int,
        max_col: int,
    ) -> List[ColumnHeaderAST]:
        """Builds column headers preserving explicit provenance (native_table, detected_row, explicit_cell)."""
        columns: List[ColumnHeaderAST] = []

        # 1. Native table headers have highest authority
        native_col_headers: Dict[int, str] = {}
        for nt in native_tables:
            try:
                (start_c, _), (end_c, _) = parse_range(nt.range_ref)
                s_idx = col_letter_to_index(start_c)
                for offset, h in enumerate(nt.headers):
                    native_col_headers[s_idx + offset] = h
            except Exception:
                pass

        # 2. Detected row headers as secondary fallback
        detected_col_headers: Dict[int, str] = {}
        if detected_regions:
            reg = detected_regions[0]
            try:
                (start_c, _), (end_c, _) = parse_range(reg.range_ref)
                s_idx = col_letter_to_index(start_c)
                for offset, h in enumerate(reg.headers):
                    detected_col_headers[s_idx + offset] = h
            except Exception:
                pass

        for c_idx in range(min_col, max_col + 1):
            col_let = col_index_to_letter(c_idx)
            if c_idx in native_col_headers:
                columns.append(ColumnHeaderAST(
                    index=c_idx,
                    column_letter=col_let,
                    header=native_col_headers[c_idx],
                    header_source="native_table",
                ))
            elif c_idx in detected_col_headers:
                columns.append(ColumnHeaderAST(
                    index=c_idx,
                    column_letter=col_let,
                    header=detected_col_headers[c_idx],
                    header_source="detected_row",
                ))
            else:
                columns.append(ColumnHeaderAST(
                    index=c_idx,
                    column_letter=col_let,
                    header=None,
                    header_source="unassigned",
                ))

        return columns
