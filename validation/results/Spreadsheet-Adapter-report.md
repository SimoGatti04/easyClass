# CellAwareSpreadsheetAdapter — Implementation & Validation Report

> **Stato:** Formalmente Implementato e Validato (Post Correction Pass)
> **Ruolo:** Model Platform Engineer / AI Platform Architect
> **Data:** 30 settembre 2026
> **Workspace:** `~/Workspace/teacher-service-design`

---

# Executive Result

**PASS**

Il componente deterministico locale `CellAwareSpreadsheetAdapter` è stato implementato con successo a zero AI, validato su file OOXML reale ed integrato con un motore di query semantico tipizzato con rigorosa separazione tra strutture native OOXML e rilevamento euristico di convenienza.

---

# Implementation Scelta & Dependency

- **Componente:** `validation/shared/spreadsheet_adapter/adapter.py`
- **Librerie Utilizzate:** Python standard library (`zipfile`, `xml.etree.ElementTree`, `hashlib`, `re`, `dataclasses`).
- **Zero Dependency Esterna:** Non richiede `openpyxl` o compiler C (`calamine`). Garantisce esecuzione universale, zero overhead di installazione e massima affidabilità.
- **Zero AI:** Nessun modello locale/remoto impiegato nell'estrazione strutturale.
- **Core Deterministico vs Heuristic Convenience:** Il parsing del package OOXML (`xl/workbook.xml`, `xl/worksheets/*.xml`, `xl/tables/*.xml`) è deterministico al 100%. L'eventuale rilevamento di blocchi tabellari privi di tag Table OOXML (`_detect_regions()`) costituisce un convenience layer secondario chiaramente marcato come `detected_range`.

---

# Contract AST (SpreadsheetWorkbookAST)

Il modello dati tipizzato (`models.py`, schema `1.1.0`) implementa la specifica canonica:
- `schema_version`: `1.1.0`
- `source_file` e `sha256`: Tracciabilità crittografica del sorgente binario;
- `workbook`: Metadati di cartella (lista ordinata fogli, defined names);
- `sheets[]`:
  - `metadata`: Nome, ID, bounding box dimensionale (`min_col`, `max_col`, `min_row`, `max_row`), intervalli uniti (`merged_ranges`);
  - `columns[]`: Lettera colonna, indice 1-based, intestazione semantica e tracciamento di provenienza `header_source` (`native_table` | `detected_row` | `explicit_cell` | `unassigned`);
  - `native_tables[]`: Oggetti Table nativi OOXML estratti da `xl/tables/table*.xml` con ID, nome, displayName, range_ref e intestazioni ufficiali (`source_type: 'native_ooxml_table'`);
  - `detected_regions[]`: Regioni tabellari inferite euristicamente dal layout (`source_type: 'detected_range'`);
  - `cells{}`: Mappa per coordinata (`'B3'`) contenente riga, colonna, valore raw tipizzato (`string`, `number`, `boolean`, `date`, `empty`), flag `is_blank`, formula nativa memorizzata (`formula`), metadati di cache (`cached_value`), flag `is_merged` e coordinata padre `merge_parent`.

---

# Workbook Reale Testato

- **File:** `excel_demo.xlsx` (`validation/corpus/source/excel/excel_demo.xlsx`)
- **SHA-256:** `fb8a07d2bfc17839bf8cb3aa9955b36e12c7f4cbb9dfab620d38e05e60bd42b7`
- **Fogli Rilevati (5):** `LEGGIMI, Ripasso, Prodotti, Vendite, Riepilogo`
- **Celle Totali Indirizzate:** `359`
- **Celle Non Vuote:** `184`
- **Celle Vuote / Blank:** `175`
- **Formule Memorizzate nel File:** `0` (0 stored formulas: workbook demo per costruzione dal vivo)
- **Native OOXML Tables:** `0` (0 native tables: lezioni e passaggi didattici mostrano l'inserimento della tabella)
- **Detected Regions:** `5` (5 regioni tabellari individuate euristicamente)

---

# Preservazione di Sheet, Cell, Table e Formula

1. **Coordinate e Dimensioni:** Ogni cella memorizza la coordinata esatta e gli indici algebrici 1-based. I bounding box tengono conto sia delle celle fisiche che dell'estensione dei range uniti (es. `Ripasso` esteso a riga 13 e colonna H per `A11:H13`).
2. **Valori Raw:** Tipi primitivi preservati esattamente (es. `Prodotti!C4 = 25.9` float, `Vendite!E5 = 0.1` float, `LEGGIMI!A1 = 'Lezione Excel - File docente (DEMO)'` string).
3. **Formule Realmente Presenti vs Formule Didattiche Generate:**
   - Nel workbook demo `excel_demo.xlsx`, le celle operative (`Vendite!I4` per il netto, `Vendite!H4` per il lordo, `Vendite!F4` per il prodotto cercato) sono **fisicamente vuote** per permettere la spiegazione interattiva del docente;
   - L'adapter le registra fedelmente come `is_blank: true` e `formula: null`;
   - Una formula didattica generata a runtime (`PEDAGOGICAL_PROPOSAL`) come:
     $$\text{H4} = \text{C4} \times \text{G4} \quad (\text{Lordo} = \text{Quantità} \times \text{Prezzo Unitario})$$
     $$\text{I4} = \text{H4} \times (1 - \text{E4}) \quad (\text{Netto} = \text{Lordo} \times (1 - \text{Sconto}))$$
     è perfettamente lecita se supportata dalle coordinate validate dell'AST, senza richiedere che fosse preesistente nel file;
   - L'esempio precedentemente errato `=B4*(1-E4)` (che moltiplicava il codice prodotto B4 per lo sconto) è stato formalmente corretto.

---

# OOXML Independent Spot-Check

La correttezza dell'adapter è stata verificata tramite ispezione disaccoppiata della struttura interna dello ZIP OOXML:
- **Stato:** **PASS**
- **Invarianti Verificate:** 10 / 10
- **Controlli Effettuati:**
  - Corrispondenza checksum SHA-256;
  - Corrispondenza esatta dei nomi foglio estratti da `xl/workbook.xml`;
  - Corrispondenza dei tag `mergeCell` sui fogli `LEGGIMI` e `Ripasso`;
  - Spot-check su valori testuali e numerici grezzi in `sheet1.xml`, `sheet3.xml` e `sheet4.xml`;
  - Verifica globale dell'assenza di tag `<x:f>` in tutti i fogli del file di demo;
  - Ispezione dei formati numerici personalizzati in `xl/styles.xml` (`€ #,##0.00`, `0%`).

---

# Native Table Support & Strict Separation

- L'adapter supporta pienamente le tabelle native OOXML memorizzate in `xl/tables/table*.xml` associate ai fogli via `tableParts`;
- `has_native_table(name)` e `has_table(name)` restituiscono `True` **esclusivamente** se esiste un oggetto Tabella Excel nativo;
- `has_detected_region(name)` interroga separatamente le regioni tabellari euristiche;
- Il claim *'Nel workbook esiste già una Tabella Excel chiamata Catalogo'* restituisce correttamente `False` su `excel_demo.xlsx` poiché il foglio `Prodotti` contiene le istruzioni per crearla al minuto 35–43 ma non possiede ancora il tag OOXML `table`.

---

# Merged Range Semantics

- Le coordinate appartenenti a intervalli uniti (es. `Ripasso!C12` e `Ripasso!H13` all'interno di `A11:H13`) vengono riconosciute come coordinate valide (`is_valid_coordinate: true`, `is_coordinate_in_merged_range: true`);
- Ciascuna cella unita non-principale possiede `is_merged: true` e `merge_parent: 'A11'`, garantendo che i checker non considerino 'inventata' una coordinata fisicamente coperta da un merge.

---

# Failure Tests

Tutti i casi limite e di errore generano eccezioni esplicite o risposte deterministiche:
- **File Inesistente:** solleva `FileNotFoundError`;
- **File non XLSX / Plain Text:** solleva `InvalidWorkbookError`;
- **Archivio ZIP Corrotto:** solleva `InvalidWorkbookError`;
- **Foglio Inesistente:** query `has_sheet()` restituisce `False`, `get_cell()` restituisce `None`;
- **Coordinata Fuori Limiti:** query `is_coordinate_within_dimensions('Prodotti', 'Z100')` restituisce `False`.

---

# Rapporto con MinerU

- **MinerU:** Continua a svolgere il ruolo di estrattore semantico/testuale per indicizzazione lessicale e vettoriale in FTS5/oMLX;
- **CellAwareSpreadsheetAdapter:** Costituisce la **fonte di autorità strutturale** per coordinate di cella, intervalli, nomi di fogli, colonne e formule.
- **Nessun Silent Fallback:** Se una verifica richiede la convalida fisica di una coordinata o di una tabella, l'unica autorità interrogabile è l'AST dell'adapter.

---

# Readiness Gate C v2

**READY_FOR_GATE_C_V2**

