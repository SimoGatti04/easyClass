"""Comprehensive Test Suite for CellAwareSpreadsheetAdapter.

Tests:
1. Corpus workbook extraction (excel_demo.xlsx)
2. Coordinate preservation and boundary validation (including merged ranges in Ripasso)
3. Sheet names preservation
4. Raw values and data types
5. Formule realmente presenti vs formule generate (distinzione semantica)
6. Native tables vs Detected regions distinction (strict semantic separation)
7. Column headers provenance (native_table vs detected_row)
8. Independent OOXML spot-check (zipfile + xml.etree)
9. Stored formula workbook test (synthetic OOXML fixture with actual formulas)
10. Native Excel Table workbook test (synthetic OOXML fixture with xl/tables/table1.xml)
11. Failure modes (non-xlsx, missing file, corrupted zip, non-existent sheet/cell)
"""

from __future__ import annotations

import io
import json
import os
import sys
import unittest
import zipfile

from .adapter import (
    CellAwareSpreadsheetAdapter,
    InvalidWorkbookError,
    SpreadsheetAdapterError,
)
from .models import (
    col_index_to_letter,
    col_letter_to_index,
    parse_coordinate,
)
from .ooxml_spot_check import run_independent_ooxml_spot_check
from .query import SpreadsheetQueryEngine


CORPUS_XLSX = "validation/corpus/source/excel/excel_demo.xlsx"


def create_synthetic_formula_workbook() -> bytes:
    """Creates a minimal valid OOXML XLSX buffer with stored formulas and cached values."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        # [Content_Types].xml
        ct = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""
        z.writestr("[Content_Types].xml", ct)

        # _rels/.rels
        rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""
        z.writestr("_rels/.rels", rels)

        # xl/workbook.xml
        wb = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Calcoli" sheetId="1" r:id="rId1"/>
  </sheets>
  <definedNames>
    <definedName name="DatiBase">Calcoli!$A$2:$B$3</definedName>
  </definedNames>
</workbook>"""
        z.writestr("xl/workbook.xml", wb)

        # xl/_rels/workbook.xml.rels
        wb_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"""
        z.writestr("xl/_rels/workbook.xml.rels", wb_rels)

        # xl/worksheets/sheet1.xml with a real stored formula in C2
        sheet = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:C3"/>
  <sheetData>
    <row r="1">
      <c r="A1" t="str"><v>Valore1</v></c>
      <c r="B1" t="str"><v>Valore2</v></c>
      <c r="C1" t="str"><v>Totale</v></c>
    </row>
    <row r="2">
      <c r="A2"><v>100</v></c>
      <c r="B2"><v>50</v></c>
      <c r="C2"><f>A2+B2</f><v>150</v></c>
    </row>
    <row r="3">
      <c r="A3"><v>200</v></c>
      <c r="B3"><v>80</v></c>
      <c r="C3"><f>SUM(A3:B3)</f><v>280</v></c>
    </row>
  </sheetData>
</worksheet>"""
        z.writestr("xl/worksheets/sheet1.xml", sheet)

    return buf.getvalue()


def create_synthetic_native_table_workbook() -> bytes:
    """Creates a minimal valid OOXML XLSX buffer containing a real Native Excel Table part."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        # [Content_Types].xml
        ct = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>
</Types>"""
        z.writestr("[Content_Types].xml", ct)

        # _rels/.rels
        rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""
        z.writestr("_rels/.rels", rels)

        # xl/workbook.xml
        wb = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="CatalogoSheet" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""
        z.writestr("xl/workbook.xml", wb)

        # xl/_rels/workbook.xml.rels
        wb_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"""
        z.writestr("xl/_rels/workbook.xml.rels", wb_rels)

        # xl/worksheets/sheet1.xml with tableParts
        sheet = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:C3"/>
  <sheetData>
    <row r="1">
      <c r="A1" t="str"><v>Codice</v></c>
      <c r="B1" t="str"><v>Prodotto</v></c>
      <c r="C1" t="str"><v>Prezzo</v></c>
    </row>
    <row r="2">
      <c r="A2" t="str"><v>P01</v></c>
      <c r="B2" t="str"><v>Tastiera</v></c>
      <c r="C2"><v>25.9</v></c>
    </row>
  </sheetData>
  <tableParts count="1">
    <tablePart r:id="rIdTable1"/>
  </tableParts>
</worksheet>"""
        z.writestr("xl/worksheets/sheet1.xml", sheet)

        # xl/worksheets/_rels/sheet1.xml.rels
        sheet_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdTable1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>
</Relationships>"""
        z.writestr("xl/worksheets/_rels/sheet1.xml.rels", sheet_rels)

        # xl/tables/table1.xml
        table_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="Catalogo" displayName="Catalogo" ref="A1:C2" headerRowCount="1">
  <tableColumns count="3">
    <tableColumn id="1" name="Codice"/>
    <tableColumn id="2" name="Prodotto"/>
    <tableColumn id="3" name="Prezzo"/>
  </tableColumns>
</table>"""
        z.writestr("xl/tables/table1.xml", table_xml)

    return buf.getvalue()


class TestSpreadsheetAdapter(unittest.TestCase):

    def setUp(self):
        self.adapter = CellAwareSpreadsheetAdapter(CORPUS_XLSX)
        self.ast = self.adapter.extract_ast()
        self.engine = SpreadsheetQueryEngine(self.ast)

    def test_01_coordinate_helpers(self):
        self.assertEqual(col_letter_to_index("A"), 1)
        self.assertEqual(col_letter_to_index("Z"), 26)
        self.assertEqual(col_letter_to_index("AA"), 27)
        self.assertEqual(col_index_to_letter(1), "A")
        self.assertEqual(col_index_to_letter(26), "Z")
        self.assertEqual(col_index_to_letter(27), "AA")
        self.assertEqual(parse_coordinate("B3"), ("B", 3))
        self.assertEqual(parse_coordinate("AA150"), ("AA", 150))
        with self.assertRaises(ValueError):
            parse_coordinate("INVALID")

    def test_02_corpus_workbook_identity_and_sheets(self):
        self.assertEqual(self.ast.source_file, "excel_demo.xlsx")
        self.assertEqual(self.ast.sha256, "fb8a07d2bfc17839bf8cb3aa9955b36e12c7f4cbb9dfab620d38e05e60bd42b7")
        self.assertEqual(len(self.ast.sheets), 5)
        expected_names = ["LEGGIMI", "Ripasso", "Prodotti", "Vendite", "Riepilogo"]
        self.assertEqual(self.ast.workbook.sheet_names, expected_names)

    def test_03_cell_preservation_and_values(self):
        # Sheet LEGGIMI
        a1 = self.engine.get_cell("LEGGIMI", "A1")
        self.assertIsNotNone(a1)
        self.assertEqual(a1.raw_value, "Lezione Excel - File docente (DEMO)")
        self.assertEqual(a1.data_type, "string")
        self.assertFalse(a1.is_blank)

        # Sheet Prodotti
        a4 = self.engine.get_cell("Prodotti", "A4")
        self.assertEqual(a4.raw_value, "P01")
        b4 = self.engine.get_cell("Prodotti", "B4")
        self.assertEqual(b4.raw_value, "Tastiera")
        c4 = self.engine.get_cell("Prodotti", "C4")
        self.assertEqual(c4.raw_value, 25.9)
        self.assertEqual(c4.data_type, "number")

        # Sheet Vendite
        d4 = self.engine.get_cell("Vendite", "D4")
        self.assertEqual(d4.raw_value, "Anna")
        e4 = self.engine.get_cell("Vendite", "E4")
        self.assertEqual(e4.raw_value, 0)
        e5 = self.engine.get_cell("Vendite", "E5")
        self.assertEqual(e5.raw_value, 0.1)

    def test_04_stored_vs_generated_formulas_distinction(self):
        # The demo XLSX has ZERO stored formulas
        for sheet in self.ast.sheets:
            for cell in sheet.cells.values():
                self.assertIsNone(cell.formula)
                self.assertFalse(self.engine.has_stored_formula(sheet.metadata.name, cell.coordinate))

        # Blank target cells (e.g. Vendite I4 for Netto, F4 for Prodotto)
        i4 = self.engine.get_cell("Vendite", "I4")
        self.assertIsNotNone(i4)
        self.assertTrue(i4.is_blank)
        self.assertFalse(self.engine.has_stored_formula("Vendite", "I4"))

        # In-workbook formula check returns False
        self.assertFalse(self.engine.is_formula_present_in_workbook("=C4*G4"))
        self.assertFalse(self.engine.is_formula_present_in_workbook("=H4*(1-E4)"))

    def test_05_native_table_vs_detected_range_separation(self):
        # excel_demo.xlsx has 0 native tables
        self.assertFalse(self.engine.has_native_table("Catalogo"))
        self.assertFalse(self.engine.has_table("Catalogo"))
        self.assertIsNone(self.engine.get_native_table("Catalogo"))

        # But Prodotti has a detected region
        self.assertTrue(self.engine.has_detected_region("Prodotti"))
        reg = self.engine.get_detected_region("Prodotti")
        self.assertIsNotNone(reg)
        self.assertEqual(reg.source_type, "detected_range")
        self.assertEqual(reg.range_ref, "A3:E9")

        # Column header provenance
        h_a = self.engine.get_column_header("Prodotti", "A")
        self.assertIsNotNone(h_a)
        self.assertEqual(h_a.header, "Codice")
        self.assertEqual(h_a.header_source, "detected_row")

    def test_06_merged_ranges_and_bounds_in_ripasso(self):
        # In Ripasso, merged range A11:H13 extends to row 13 and col H (col 8)
        ripasso = self.engine.get_sheet("Ripasso")
        self.assertIn("A11:H13", ripasso.metadata.merged_ranges)
        self.assertEqual(ripasso.metadata.max_row, 13)
        self.assertEqual(ripasso.metadata.max_col, 8)

        # Coordinates inside merged range are recognized
        self.assertTrue(self.engine.is_coordinate_in_merged_range("Ripasso", "A11"))
        self.assertTrue(self.engine.is_coordinate_in_merged_range("Ripasso", "C12"))
        self.assertTrue(self.engine.is_coordinate_in_merged_range("Ripasso", "H13"))
        self.assertTrue(self.engine.is_valid_coordinate("Ripasso", "H13"))

        # Merged child cell metadata
        c12 = self.engine.get_cell("Ripasso", "C12")
        self.assertIsNotNone(c12)
        self.assertTrue(c12.is_merged)
        self.assertEqual(c12.merge_parent, "A11")

    def test_07_independent_ooxml_spot_check(self):
        ast_dict = self.ast.to_dict()
        spot_results = run_independent_ooxml_spot_check(CORPUS_XLSX, ast_dict)
        self.assertEqual(spot_results["status"], "PASS")
        self.assertEqual(spot_results["invariants_tested"], spot_results["invariants_passed"])
        self.assertGreater(spot_results["invariants_tested"], 6)

    def test_08_synthetic_stored_formula_workbook(self):
        synth_bytes = create_synthetic_formula_workbook()
        synth_path = "/tmp/synthetic_formula_test.xlsx"
        with open(synth_path, "wb") as f:
            f.write(synth_bytes)

        try:
            synth_adapter = CellAwareSpreadsheetAdapter(synth_path)
            synth_ast = synth_adapter.extract_ast()
            synth_engine = SpreadsheetQueryEngine(synth_ast)

            self.assertEqual(synth_ast.workbook.sheet_names, ["Calcoli"])
            self.assertTrue(synth_engine.has_defined_name("DatiBase"))
            self.assertEqual(synth_engine.get_defined_name("DatiBase"), "Calcoli!$A$2:$B$3")

            # Check stored formulas
            self.assertTrue(synth_engine.has_stored_formula("Calcoli", "C2"))
            c2 = synth_engine.get_cell("Calcoli", "C2")
            self.assertEqual(c2.formula, "=A2+B2")
            self.assertIsNotNone(c2.cached_value)
            self.assertEqual(c2.cached_value.value, 150)
            self.assertEqual(c2.cached_value.availability, "present")
            self.assertEqual(c2.cached_value.trust, "informational_only")

            self.assertTrue(synth_engine.has_stored_formula("Calcoli", "C3"))
            c3 = synth_engine.get_cell("Calcoli", "C3")
            self.assertEqual(c3.formula, "=SUM(A3:B3)")
            self.assertEqual(c3.cached_value.value, 280)

            self.assertTrue(synth_engine.is_formula_present_in_workbook("=A2+B2"))
            self.assertTrue(synth_engine.is_formula_present_in_workbook("=SUM(A3:B3)"))
            self.assertFalse(synth_engine.is_formula_present_in_workbook("=AVERAGE(A1:A3)"))
        finally:
            if os.path.exists(synth_path):
                os.remove(synth_path)

    def test_09_synthetic_native_table_workbook(self):
        synth_bytes = create_synthetic_native_table_workbook()
        synth_path = "/tmp/synthetic_table_test.xlsx"
        with open(synth_path, "wb") as f:
            f.write(synth_bytes)

        try:
            synth_adapter = CellAwareSpreadsheetAdapter(synth_path)
            synth_ast = synth_adapter.extract_ast()
            synth_engine = SpreadsheetQueryEngine(synth_ast)

            # Native table check
            self.assertTrue(synth_engine.has_native_table("Catalogo"))
            self.assertTrue(synth_engine.has_table("Catalogo"))
            t = synth_engine.get_native_table("Catalogo")
            self.assertIsNotNone(t)
            self.assertEqual(t.name, "Catalogo")
            self.assertEqual(t.range_ref, "A1:C2")
            self.assertEqual(t.headers, ["Codice", "Prodotto", "Prezzo"])
            self.assertEqual(t.source_type, "native_ooxml_table")

            # Column header provenance
            h_a = synth_engine.get_column_header("CatalogoSheet", "A")
            self.assertIsNotNone(h_a)
            self.assertEqual(h_a.header, "Codice")
            self.assertEqual(h_a.header_source, "native_table")
        finally:
            if os.path.exists(synth_path):
                os.remove(synth_path)

    def test_10_failure_modes(self):
        # 1. Missing file
        with self.assertRaises(FileNotFoundError):
            CellAwareSpreadsheetAdapter("/tmp/non_existent_workbook.xlsx").extract_ast()

        # 2. Non-ZIP / non-XLSX file
        txt_path = "/tmp/fake_sheet.xlsx"
        with open(txt_path, "w") as f:
            f.write("This is plain text, not a spreadsheet.")
        try:
            with self.assertRaises(InvalidWorkbookError):
                CellAwareSpreadsheetAdapter(txt_path).extract_ast()
        finally:
            if os.path.exists(txt_path):
                os.remove(txt_path)

        # 3. Corrupted ZIP
        corrupt_path = "/tmp/corrupt.xlsx"
        with open(corrupt_path, "wb") as f:
            f.write(b"PK\x03\x04corrupteddata")
        try:
            with self.assertRaises(InvalidWorkbookError):
                CellAwareSpreadsheetAdapter(corrupt_path).extract_ast()
        finally:
            if os.path.exists(corrupt_path):
                os.remove(corrupt_path)

        # 4. Sheet inesistente query
        self.assertFalse(self.engine.has_sheet("NonExistentSheet"))
        self.assertIsNone(self.engine.get_sheet("NonExistentSheet"))
        self.assertIsNone(self.engine.get_cell("NonExistentSheet", "A1"))

        # 5. Cella inesistente / fuori dai limiti
        self.assertFalse(self.engine.has_cell("Vendite", "Z100"))
        self.assertFalse(self.engine.is_coordinate_within_dimensions("Vendite", "Z100"))


def run_all_tests() -> unittest.TestResult:
    suite = unittest.TestLoader().loadTestsFromTestCase(TestSpreadsheetAdapter)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite)


if __name__ == "__main__":
    result = run_all_tests()
    sys.exit(0 if result.wasSuccessful() else 1)
