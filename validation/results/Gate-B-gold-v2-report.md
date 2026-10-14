# Gate B — Gold v2: report di revisione e audit

**Data:** 30 settembre 2026  
**Esito:** **READY_FOR_GATE_B_REVALIDATION**  
**Perimetro:** preparazione e riconciliazione del gold v2; nessun benchmark eseguito e nessun modello locale/remoto chiamato.

## Conteggi finali

- Casi finali Gate B: **81** (**51 grounding + 30 artifact semantic check**).
- Distribuzione label finali: `SUPPORTED 33`, `UNSUPPORTED 18`, `SATISFIED 18`, `VIOLATED 9`, `PARTIAL 2`, `UNKNOWN 1`.
- Azioni sui casi originari: `KEEP 61`, `REBUILD_CONTEXT 13`, `RELABEL_RECOMMENDED 7`, `DROP 1`, `RECLASSIFY_TASK 0`.
- Provenienza dei casi finali: `real 73`, `controlled_perturbation 8`.
- Short Semantic Tagging: **NOT_NEEDED**.

Il totale originario era 82 casi. `GB-GR-032` è l'unico caso eliminato. Nessun caso rimane riclassificato fuori dal gold Gate B dopo la riconciliazione dell'identità di `GB-AC-018`.

## Fonti autorevoli e precedenza

Per l'identità dei casi, l'ordine di precedenza è:

1. `validation/corpus/gold/gate-b/HUMAN_ANNOTATION.md` — identità e annotazione umana v1;
2. artifact/source raw citati nella v1;
3. `HUMAN_ANNOTATION_v2.md` / `gold-v2.jsonl` dopo ricostruzione raw;
4. report metodologici successivi.

Quando un report successivo ha associato contenuti differenti allo stesso ID, la v1 e le source raw prevalgono.

## 13 contesti ricostruiti

`GB-GR-007`, `008`, `009`, `010`, `011`, `012`, `015`, `028`, `030`, `033`, `037`, `039`, `046`.

Tutti usano evidence raw/bounded. Le parafrasi reviewer-authored non sono più usate come SOURCE.

## 7 relabel finali

- `GB-GR-002`: PARTIALLY_SUPPORTED → SUPPORTED (`SOURCE_FACT`).
- `GB-GR-016`: PARTIALLY_SUPPORTED → SUPPORTED (`SOURCE_DERIVED`).
- `GB-GR-034`: PARTIALLY_SUPPORTED → SUPPORTED (`SOURCE_DERIVED`).
- `GB-GR-035`: PARTIALLY_SUPPORTED → UNSUPPORTED (`SOURCE_FACT / false attribution`).
- `GB-AC-016`: PARTIAL → SATISFIED (`PEDAGOGICAL_PROPOSAL`).
- `GB-AC-018`: UNKNOWN → SATISFIED (`GENERAL_DOMAIN_KNOWLEDGE` + `SOURCE_DERIVED` / `PEDAGOGICAL_PROPOSAL`).
- `GB-AC-021`: VIOLATED → SATISFIED (`GENERAL_DOMAIN_KNOWLEDGE` + `SOURCE_DERIVED`).

## Riconciliazione delle tre discrepanze

### GB-AC-018 — RISOLTA

La v1 contiene il caso CERCA.X, non la formula `=SOMMA(Vendite!I2:I13)`.

Il caso reale valuta se una spiegazione dettagliata di CERCA.X venga falsamente presentata come testo letterale della fonte. L'artifact descrive la semantica del lookup usando:
- CERCA.X, esplicitamente presente nella lista funzioni;
- la struttura Prodotti/Catalogo prevista dalla fonte;
- le colonne Codice/Prodotto/Prezzo e Vendite/Prodotto/Prezzo unitario.

L'artifact **non afferma che tale procedura sia testo letterale della fonte**. Nel contratto epistemico finale è quindi un arricchimento didattico lecito. Label finale: **SATISFIED**.

La precedente associazione dell'ID alla formula SUM era un errore di identità nel report di revisione. `GB-AC-018` resta nel gold Gate B. Il file `validation/corpus/gold/spreadsheet/spreadsheet-semantic-cases.jsonl` è lasciato vuoto perché non esiste più un caso validamente riclassificato con quell'ID.

### GB-GR-037 — RISOLTA

La v1 autorevole contiene il claim:

> L'estratto include le istruzioni di installazione e uso dell'interfaccia DB Browser for SQLite.

La source raw completa nomina DB Browser come obiettivo, ma non contiene istruzioni di installazione o uso dell'interfaccia. Il rebuild v2 è corretto.

Label finale: **UNSUPPORTED**.  
Audit action: **REBUILD_CONTEXT**.

Il riferimento a formule/commissione attribuito allo stesso ID in una precedente revisione era un errore di identità del report.

### GB-GR-046 — RISOLTA

La v1 autorevole contiene la controlled perturbation:

> La scheda assegna il campo nome come chiave primaria della tabella prodotti.

Il blocco raw della tabella indica chiaramente `id_prodotto` come chiave primaria e `nome` tra i campi principali.

Label finale: **UNSUPPORTED**.  
Audit action: **REBUILD_CONTEXT**.

Il riferimento a `id_corso`/tabella `corsi` attribuito allo stesso ID in una precedente revisione era un errore di identità del report.

## Quality checks finali

- Record gold Gate B: **81**.
- ID univoci: **PASS**.
- Una sola final label per record: **PASS**.
- Label null nel gold didattico: **0**.
- `GB-GR-035 = UNSUPPORTED`: **PASS**.
- `GB-GR-032` assente: **PASS**.
- `GB-AC-018 = SATISFIED` e presente nel gold generale: **PASS**.
- 13 `REBUILD_CONTEXT`: **PASS**.
- 7 `RELABEL_RECOMMENDED`: **PASS**.
- Source reviewer-authored usate come evidence: **0 nei casi ricostruiti**.
- Chiamate LLM durante costruzione/reconciliation: **0**.
- Nuovi benchmark: **0**.
- v1 originale: **non modificata**.

## Stato

**READY_FOR_GATE_B_REVALIDATION**

Il gold set v2 è ora utilizzabile per il benchmark bounded di Gate B. Il risultato della revalidation dovrà determinare l'effettiva utilità di local semantic/grounding checks senza trasformarli in autorità decisionale.
