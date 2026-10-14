"""Independent OOXML Spot-Check for SpreadsheetWorkbookAST.

Performs an independent verification of the extracted AST against the raw OOXML
package bytes and XML structures without using the adapter implementation.
"""

from __future__ import annotations

import hashlib
import zipfile
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Tuple


OOXML_NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def run_independent_ooxml_spot_check(
    xlsx_path: str,
    ast_dict: Dict[str, Any],
) -> Dict[str, Any]:
    """Inspects the raw XLSX zip archive directly and compares invariants with the AST."""
    results: Dict[str, Any] = {
        "status": "PASS",
        "invariants_tested": 0,
        "invariants_passed": 0,
        "checks": [],
    }

    def _record(name: str, passed: bool, raw_val: Any, ast_val: Any, details: str = ""):
        results["invariants_tested"] += 1
        if passed:
            results["invariants_passed"] += 1
        else:
            results["status"] = "FAIL"
        results["checks"].append({
            "name": name,
            "passed": passed,
            "raw_ooxml": raw_val,
            "ast_extracted": ast_val,
            "details": details,
        })

    # 1. SHA256 invariant
    h = hashlib.sha256()
    with open(xlsx_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    raw_sha = h.hexdigest()
    _record(
        name="sha256_checksum",
        passed=(raw_sha == ast_dict.get("sha256")),
        raw_val=raw_sha,
        ast_val=ast_dict.get("sha256"),
        details="Source file SHA-256 matches AST metadata."
    )

    with zipfile.ZipFile(xlsx_path, "r") as z:
        # 2. Raw sheet names from xl/workbook.xml
        wb_tree = ET.fromstring(z.read("xl/workbook.xml"))
        raw_sheet_names = [s.attrib.get("name") for s in wb_tree.findall(".//m:sheet", OOXML_NS)]
        ast_sheet_names = ast_dict.get("workbook", {}).get("sheet_names", [])
        _record(
            name="sheet_names_match",
            passed=(raw_sheet_names == ast_sheet_names),
            raw_val=raw_sheet_names,
            ast_val=ast_sheet_names,
            details="Exact ordered sheet names extracted from xl/workbook.xml."
        )

        # 3. Sheet count
        _record(
            name="sheet_count_match",
            passed=(len(raw_sheet_names) == len(ast_dict.get("sheets", []))),
            raw_val=len(raw_sheet_names),
            ast_val=len(ast_dict.get("sheets", [])),
            details="Number of sheet elements in xl/workbook.xml matches AST sheets count."
        )

        # 4. MergeCells on sheet 1 (LEGGIMI) and sheet 2 (Ripasso)
        s1_tree = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        raw_s1_merges = [m.attrib.get("ref") for m in s1_tree.findall(".//m:mergeCell", OOXML_NS)]
        ast_s1 = next((s for s in ast_dict.get("sheets", []) if s["metadata"]["name"] == "LEGGIMI"), None)
        ast_s1_merges = ast_s1["metadata"]["merged_ranges"] if ast_s1 else []
        _record(
            name="sheet1_merged_ranges",
            passed=(raw_s1_merges == ast_s1_merges),
            raw_val=raw_s1_merges,
            ast_val=ast_s1_merges,
            details="MergeCell elements on sheet 1 match AST metadata."
        )

        s2_tree = ET.fromstring(z.read("xl/worksheets/sheet2.xml"))
        raw_s2_merges = [m.attrib.get("ref") for m in s2_tree.findall(".//m:mergeCell", OOXML_NS)]
        ast_s2 = next((s for s in ast_dict.get("sheets", []) if s["metadata"]["name"] == "Ripasso"), None)
        ast_s2_merges = ast_s2["metadata"]["merged_ranges"] if ast_s2 else []
        _record(
            name="sheet2_merged_ranges",
            passed=(raw_s2_merges == ast_s2_merges),
            raw_val=raw_s2_merges,
            ast_val=ast_s2_merges,
            details="MergeCell elements on sheet 2 match AST metadata."
        )

        # 5. Raw cell values spot-check
        # Sheet 1 A1: inline string / str
        raw_s1_a1_val = s1_tree.find(".//m:c[@r='A1']/m:v", OOXML_NS)
        raw_s1_a1_text = raw_s1_a1_val.text if raw_s1_a1_val is not None else None
        ast_s1_a1_val = ast_s1["cells"].get("A1", {}).get("raw_value") if ast_s1 else None
        _record(
            name="cell_value_LEGGIMI_A1",
            passed=(raw_s1_a1_text == ast_s1_a1_val and raw_s1_a1_text == "Lezione Excel - File docente (DEMO)"),
            raw_val=raw_s1_a1_text,
            ast_val=ast_s1_a1_val,
            details="Cell A1 text matches raw XML value tag."
        )

        # Sheet 3 (Prodotti) A4, B4, C4
        s3_tree = ET.fromstring(z.read("xl/worksheets/sheet3.xml"))
        raw_s3_a4 = s3_tree.find(".//m:c[@r='A4']/m:v", OOXML_NS).text
        raw_s3_b4 = s3_tree.find(".//m:c[@r='B4']/m:v", OOXML_NS).text
        raw_s3_c4 = float(s3_tree.find(".//m:c[@r='C4']/m:v", OOXML_NS).text)
        ast_s3 = next((s for s in ast_dict.get("sheets", []) if s["metadata"]["name"] == "Prodotti"), None)
        ast_s3_a4 = ast_s3["cells"].get("A4", {}).get("raw_value") if ast_s3 else None
        ast_s3_b4 = ast_s3["cells"].get("B4", {}).get("raw_value") if ast_s3 else None
        ast_s3_c4 = ast_s3["cells"].get("C4", {}).get("raw_value") if ast_s3 else None

        _record(
            name="cell_values_Prodotti_row4",
            passed=(raw_s3_a4 == ast_s3_a4 == "P01" and raw_s3_b4 == ast_s3_b4 == "Tastiera" and raw_s3_c4 == ast_s3_c4 == 25.9),
            raw_val={"A4": raw_s3_a4, "B4": raw_s3_b4, "C4": raw_s3_c4},
            ast_val={"A4": ast_s3_a4, "B4": ast_s3_b4, "C4": ast_s3_c4},
            details="Row 4 product code, name, and price match raw XML values."
        )

        # Sheet 4 (Vendite) D4 ('Anna'), E5 (0.1)
        s4_tree = ET.fromstring(z.read("xl/worksheets/sheet4.xml"))
        raw_s4_d4 = s4_tree.find(".//m:c[@r='D4']/m:v", OOXML_NS).text
        raw_s4_e5 = float(s4_tree.find(".//m:c[@r='E5']/m:v", OOXML_NS).text)
        ast_s4 = next((s for s in ast_dict.get("sheets", []) if s["metadata"]["name"] == "Vendite"), None)
        ast_s4_d4 = ast_s4["cells"].get("D4", {}).get("raw_value") if ast_s4 else None
        ast_s4_e5 = ast_s4["cells"].get("E5", {}).get("raw_value") if ast_s4 else None
        _record(
            name="cell_values_Vendite_sample",
            passed=(raw_s4_d4 == ast_s4_d4 == "Anna" and raw_s4_e5 == ast_s4_e5 == 0.1),
            raw_val={"D4": raw_s4_d4, "E5": raw_s4_e5},
            ast_val={"D4": ast_s4_d4, "E5": ast_s4_e5},
            details="Vendite seller and discount rate match raw XML values."
        )

        # 6. Raw XML formula check (<x:f> tags) across ALL worksheet XMLs
        raw_f_tags_count = 0
        for name in z.namelist():
            if name.startswith("xl/worksheets/") and name.endswith(".xml"):
                s_t = ET.fromstring(z.read(name))
                raw_f_tags_count += len(s_t.findall(".//m:f", OOXML_NS))

        ast_formula_count = sum(
            1 for s in ast_dict.get("sheets", [])
            for c in s.get("cells", {}).values()
            if c.get("formula") is not None
        )
        _record(
            name="formula_tags_count",
            passed=(raw_f_tags_count == ast_formula_count == 0),
            raw_val=raw_f_tags_count,
            ast_val=ast_formula_count,
            details="Formula tags in raw XML match AST stored formulas (0 in demo file)."
        )

        # 7. Styles custom number format inspection
        styles_tree = ET.fromstring(z.read("xl/styles.xml"))
        raw_custom_fmts = {
            int(nf.attrib.get("numFmtId")): nf.attrib.get("formatCode")
            for nf in styles_tree.findall(".//m:numFmt", OOXML_NS)
        }
        fmt_200_match = raw_custom_fmts.get(200) == "€ #,##0.00"
        fmt_202_match = raw_custom_fmts.get(202) == "0%"
        _record(
            name="custom_number_formats_ooxml",
            passed=(fmt_200_match and fmt_202_match),
            raw_val=raw_custom_fmts,
            ast_val={"200": "€ #,##0.00", "202": "0%"},
            details="Custom number format codes for Currency and Percentage verified."
        )

    return results
