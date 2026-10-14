# CellAwareSpreadsheetAdapter — Semantic Contract Correction Report

> **Stato:** Formalmente Corretto e Validato
> **Ruolo:** Model Platform Engineer / AI Platform Architect
> **Data:** 30 settembre 2026
> **Workspace:** `~/Workspace/teacher-service-design`

---

# Executive Summary

**PASS**

Tutte le anomalie semantiche e i punti metodologici sollevati sono stati corretti e verificati con una suite di test di regressione a 10 verifiche indipendenti:
1. Correzione della formula didattica d'esempio (eliminato `=B4*(1-E4)`, adottata la sequenza coerente `H4=C4*G4`, `I4=H4*(1-E4)`);
2. Implementazione del parser nativo OOXML per `xl/tables/table*.xml` e `tableParts`;
3. Separazione netta e non intercambiabile tra `NATIVE_OOXML_TABLE`, `DETECTED_RANGE` e `DEFINED_NAME`;
4. Correzione delle query API in `SpreadsheetQueryEngine` (`has_native_table`, `has_table` rigoroso, `has_detected_region`, `has_defined_name`);
5. Esplicitazione della distinzione tra core di parsing deterministico e heuristic convenience layer;
6. Tracciamento esplicito della provenienza degli header di colonna (`header_source: native_table | detected_row | explicit_cell`);
7. Gestione rigorosa dei range uniti (`merged_ranges`) che estendono il bounding box e riconoscono le coordinate coperte da merge;
8. Validazione su fixture sintetiche per Native Table e Stored Formulas.

---

# 1. Formula Example Corrected

Nel report precedente era presente un esempio didattico che moltiplicava impropriamente il codice prodotto per il complemento a 1 dello sconto (`=B4*(1-E4)`).
Nel foglio `Vendite`:
- `B` = Codice prodotto (`P01`)
- `C` = Quantità venduta (`3`)
- `E` = Tasso di sconto (`0` / `0.10`)
- `G` = Prezzo unitario (`25.9`)
- `H` = Lordo
- `I` = Netto

La corretta sequenza didattica `GENERATED_FORMULA` (da costruire in classe, non presente a priori nel workbook) è:
- **Lordo in H4:** `=C4*G4` (Quantità $\times$ Prezzo unitario)
- **Netto in I4:** `=H4*(1-E4)` (Lordo $\times$ $(1 - \text{Sconto})$)

---

# 2. Native OOXML Table Support & Separation

L'adapter è stato esteso per gestire direttamente le parti OOXML Table:
- Scansiona `tableParts` nel worksheet XML (`xl/worksheets/sheetN.xml`);
- Risolve la relazione tramite `xl/worksheets/_rels/sheetN.xml.rels`;
- Esegue il parse di `xl/tables/table*.xml` estraendo ID, nome, displayName, range di riferimento (`ref`) e intestazioni delle colonne (`tableColumns`).

### Distinzione Epistemica Rigorosa:
| Tipo Struttura | Provenance OOXML | Proprietà AST | Query Engine API |
|---|---|---|---|
| **NATIVE_OOXML_TABLE** | `xl/tables/table*.xml` | `sheet.native_tables[]` | `has_native_table(name)`, `has_table(name)` |
| **DETECTED_RANGE** | Layout / Heuristic row | `sheet.detected_regions[]` | `has_detected_region(name)` |
| **DEFINED_NAME** | `xl/workbook.xml` (`definedNames`) | `workbook.defined_names{}` | `has_defined_name(name)` |

Il metodo `has_table(name)` è ora un alias **strettamente identico** a `has_native_table(name)`. Non restituisce mai `True` per detected ranges.

---

# 3. Heuristic Claim Clarification & Column Headers Provenance

- È stato formalmente rimosso il claim 'zero heuristics': il core OOXML è deterministico, mentre la funzione `_detect_regions()` è esplicitamente documentata come un **convenience layer euristico-deterministico** basato su densità di stringhe;
- Ciascun `ColumnHeaderAST` memorizza la propria provenienza in `header_source` (`native_table`, `detected_row`, `explicit_cell`, `unassigned`).

---

# 4. Merged Range Semantics & Bounds (Caso Ripasso)

- Nel foglio `Ripasso`, il blocco grafico `A11:H13` è un merge che si estende oltre le righe e colonne serializzate con celle fisiche;
- L'adapter estende il bounding box dimensionale (`metadata.max_row: 13`, `metadata.max_col: 8`);
- Le coordinate figlie (es. `C12`, `H13`) vengono instanziate con `is_merged: true`, `merge_parent: 'A11'`, garantendo che `is_valid_coordinate('Ripasso', 'H13')` e `is_coordinate_in_merged_range('Ripasso', 'H13')` rispondano deterministicamente `True`.

---

# 5. Risultati della Validazione

- **Workbook Reale (`excel_demo.xlsx`):**
  - Native Tables: `0` (confermato: 0 native table nel file OOXML)
  - Detected Regions: `5` (5 regioni tabellari individuate)
  - `has_native_table('Catalogo')`: `False` (conforme: la creazione della tabella è un passaggio didattico da svolgere)
  - `has_detected_region('Prodotti')`: `True` (`A3:E9`)
  - Formule memorizzate: `0` (0 formule, distinzione preservata)
- **Independent OOXML Spot-Check:** **PASS** (10/10)
- **Synthetic Native Table Fixture:** **PASS**
- **Synthetic Stored Formula Fixture:** **PASS**
- **Test Suite Unittest (10 test):** Ran 10 tests in 0.031s, **OK**

---

# 6. Readiness Gate C v2

**READY_FOR_GATE_C_V2**

