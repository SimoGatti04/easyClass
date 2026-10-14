# Grounding & Generation Contract — Report di Correzione Metodologica

> **Stato:** Documento di allineamento e correzione architetturale formalizzato  
> **Ruolo:** AI Platform Architect  
> **Data:** 30 settembre 2026 (Europe/Rome)  
> **Oggetto:** Correzione mirata dei punti metodologici del report `grounding-generation-contract-review.md` e allineamento dei documenti canonici (`docs/ai/model-routing-and-registry.md`, `docs/dossiers/10-ai-architecture.md`, `docs/validation/00-feasibility-benchmark-gate.md`).  
> **Workspace:** `~/Workspace/teacher-service-design`

---

## 1. Sintesi dell'Intervento di Correzione

Il presente pass di correzione (*Correction Pass*) consolida la direzione architetturale del Teacher Service preservandone i pilastri fondamentali:
- Generazione di nuovo materiale didattico (non limitata alla parafrasi letterale);
- Contratto epistemico a 5 classi;
- Necessità dello Spreadsheet Structured Adapter (`CellAwareSpreadsheetAdapter`);
- Architettura composita per la generazione remota long-form;
- Riconfigurazione di Gate C v2 con protocollo di preflight diagnostico a tre livelli.

Sono state apportate correzioni metodologiche puntuali e rigorose per eliminare imprecisioni matematiche, chiarire le responsabilità dei checker, prevenire sovra-ingegnerizzazioni ontologiche e assicurare che nessun valore di benchmark provvisorio diventi prematuramente un vincolo architetturale rigido.

---

## 2. Correzioni Applicate nel Dettaglio

### 2.1 Correzione Matematica e Semantica Dimensionale (`SOURCE_DERIVED`)
- **Problema Risolto:** Nel report precedente la deduzione del netto veniva esemplificata con la formula $Netto = Lordo - Sconto$. Tuttavia, nel corpus Excel didattico del progetto, il campo `Sconto` è un **tasso adimensionale** espresso in formato percentuale o decimale (`0`, `0.05`, `0.10`, `0.15`). Sottrarre direttamente un tasso da un importo monetario ($Lordo - Sconto$) è dimensionalmente scorretto;
- **Formula Corretta:** 
  $$\text{Netto} = \text{Lordo} \times (1 - \text{Sconto})$$
  oppure, in formulazione concettuale astratta:
  $$\text{Importo\_Netto} = \text{Lordo} - \text{Valore\_Sconto} \quad \text{con} \quad \text{Valore\_Sconto} = \text{Lordo} \times \text{Tasso\_Sconto}$$
- **Regola Architetturale:** Il sistema non assume a priori formule o sottrazioni se la semantica dimensionale e le unità di misura dei campi non sono esplicitate nell'AST o nel contesto.

### 2.2 Correzione e Risoluzione Definitiva di `GB-GR-035` (Falsa Attribuzione)
- **Claim:** *"La fonte definisce Netto come Lordo diminuito dello sconto applicato"*;
- **Fonte Bounded:** Riporta unicamente le intestazioni di colonna `Sconto`, `Lordo`, `Netto`, con celle sottostanti vuote; non fornisce alcuna definizione concettuale o formula;
- **Errore Precedente:** Il report precedente aveva proposto di relabelare il claim a `SUPPORTED` considerandolo una lecita `SOURCE_DERIVED`;
- **Correzione Applicata:** Il punto dirimente è la locuzione categorica **"La fonte definisce"**. La fonte non definisce la relazione, si limita a nominare i campi. Pertanto, l'asserzione costituisce una **Falsa Attribuzione di Fatto di Fonte (`SOURCE_FACT / false attribution`)**;
- **Label Finale del Gold Set v2:** **`UNSUPPORTED`**;
- **Decisione Audit:** **`RELABEL_RECOMMENDED`** (rettifica da `PARTIALLY_SUPPORTED` a `UNSUPPORTED` per sanzionare rigorosamente la falsa attribuzione).

### 2.3 Granularità e Non-Performatività delle Classi Epistemiche
- **Nessun Sentence-Level Classifier Obbligatorio in T1:** È formalmente escluso che ogni singola frase del Teacher Script debba essere classificata e persistita in una delle cinque classi. Si persegue il principio del *minimum sufficient provenance*, evitando un pervasivo overhead di annotazione;
- **Governo di Claim e Span Rilevanti:** Il contratto epistemico si applica a span semantici, passaggi didattici chiave, formule operative ed estrazioni di fatti;
- `SOURCE_FACT` e `SOURCE_SPECIFIC_DETAIL` richiedono provenance puntuale quando presentati come fatti della fonte; `SOURCE_DERIVED` la richiede quando materialmente rilevante; `GENERAL_DOMAIN_KNOWLEDGE` e `PEDAGOGICAL_PROPOSAL` possono essere tracciate a livello di blocco, sezione o task.

### 2.4 Composabilità delle Classi Epistemiche
- Le cinque classi non sono rigidamente mutuamente esclusive;
- È adottata la semantica leggera:
  $$\text{Primary Epistemic Role} + \text{Evidence Dependencies / Supporting Roles}$$
- *Esempio Didattico (Excel):* L'istruzione didattica *"Digitiamo in D2 la formula =B2*(1-C2) per calcolare il netto"* presenta:
  - `Primary Epistemic Role`: **`PEDAGOGICAL_PROPOSAL`** (la proposta metodologica di insegnare questa formula alla classe);
  - `Supporting Role 1 (Fisico/Strutturale)`: **`SOURCE_SPECIFIC_DETAIL`** (le coordinate `D2`, `B2`, `C2` devono esistere realmente nell'AST);
  - `Supporting Role 2 (Logico/Matematico)`: **`SOURCE_DERIVED`** o **`GENERAL_DOMAIN_KNOWLEDGE`** (la correttezza della moltiplicazione per il complemento a 1 del tasso);
- Questo approccio evita la costruzione di pesanti framework ontologici complessi.

### 2.5 Spreadsheet Adapter: Formule Presenti vs. Formule Generate
- È formalizzata la distinzione tra:
  1. **Formule Realmente Presenti (Stored Formulas):** Formule native preesistenti nelle celle del file `.xlsx` sorgente. L'adapter deterministico le rileva e le registra nell'AST come `SOURCE_SPECIFIC_DETAIL`;
  2. **Formule Didattiche Generate (Generated Formulas):** Formule didattiche generate dal Teacher Service per guidare la lezione. **Non sono vietate dal fatto che la cella sorgente fosse inizialmente vuota**, purché:
     - Utilizzino coordinate e intervalli realmente esistenti nell'AST (`SOURCE_SPECIFIC_DETAIL`);
     - La loro logica algebrica sia corretta e rispetti le unità dimensionali (`SOURCE_DERIVED`);
     - Siano presentate come proposta di soluzione didattica per gli studenti (`PEDAGOGICAL_PROPOSAL`) e **mai falsamente attribuite come formule preesistenti nel workbook**.

### 2.6 AST Schematico e Affidabilità di `cached_value`
- L'esempio del contratto AST è stato corretto e marcato esplicitamente come **schematico illustrativo (non dati reali osservati)**;
- Sono stati adottati identificatori neutri;
- Il campo `cached_value` è stato specificato come:
  - Strettamente opzionale (`Optional[Any]`);
  - Corredato da metadati di freschezza e affidabilità (`reliability: "unverified_from_cache"`);
  - Mai assunto come verità matematica certa solo perché salvato nel file binario.

### 2.7 Ruolo Corretto degli Embeddings (Candidate Retrieval, Non Entailment)
- È stato corretto l'errore concettuale che attribuiva agli embeddings densi la capacità di agire come checker di entailment;
- **Ruolo degli Embeddings:** Recupero delle *candidate evidence* (trovare passaggi semanticamente vicini nel corpus);
- **Pipeline del Checker `SOURCE_FACT`:**
  $$\text{Candidate Retrieval (Embedding/Lexical)} \longrightarrow \text{Deterministic Exact Check (se applicabile)} \longrightarrow \text{Bounded Semantic Verification / Review}$$
- Gli embeddings non possono da soli distinguere una contraddizione da un entailment né costituire un segnale di verità.

### 2.8 Distinzione in `SOURCE_DERIVED` (Formalizzabili vs. Semantiche)
- Non tutte le inferenze sono verificabili deterministicamente. Si distinguono:
  - **Tipo A (Derivazioni Formalizzabili):** Aritmetica, conversioni dimensionali, percentuali, ordinamenti, aggregazioni tabellari $\longrightarrow$ Verificabili tramite **checker deterministico locale**;
  - **Tipo B (Inferenze Semantiche Non Formalizzabili):** Deduzioni logico-testuali o contestuali non formalizzabili in algebra $\longrightarrow$ Verificabili tramite **bounded semantic checker** o **Teacher Review**;
  - L'architettura predilige derivazioni formalizzabili (Tipo A) ovunque possibile.

### 2.9 Status della Soglia di Gate C (Provisional Benchmark Threshold)
- La soglia del $95\%$ su `SOURCE_FACT` accuratezza è formalmente declassata da requisito architetturale definitivo a:
  **`PROVISIONAL BENCHMARK THRESHOLD`** (soglia di benchmark provvisoria da calibrare empiricamente sul gold set Gate B v2 corretto e sull'effettivo carico di revisione docente);
- **Hard Failures (Condizioni Bloccanti):**
  1. Contraddizione esplicita di fatti documentati nella fonte;
  2. Falsa attribuzione materiale di definizioni o regole alla fonte;
  3. Uso operativo di coordinate o dettagli fisici inesistenti;
  4. Troncamento sintattico (`finish_reason=length`) o violazione dello schema JSON;
- **Metriche Multidimensionali:** Gate C rileva congiuntamente: *Teacher editing effort*, *Critical violation rate*, *Source-fact support*, *Pedagogical usefulness*.

### 2.10 Stato del Report (Proposta Architetturale, Non Auto-Approvazione)
- È stata corretta la dicitura del report: non si auto-dichiara "formalmente approvato", bensì:
  **"Proposta architetturale e metodologica validata tecnicamente (soggetta ad approvazione finale di prodotto da parte dell'utente)"**.

---

## 3. Conteggi Finali dell'Audit Gate B (82 Casi)

L'audit analitico del pacchetto `validation/corpus/gold/gate-b/HUMAN_ANNOTATION.md` si attesta sui seguenti conteggi canonici:

| Decisione Audit | Numero Casi | % sul Totale | Descrizione |
|---|:---:|:---:|---|
| **`KEEP`** | **61** (o 62*) | **74.4%** | Annotazione originale dell'annotatore umano pienamente confermata |
| **`RELABEL_RECOMMENDED`** | **6** (o 5*) | **7.3%** | Riconciliazione metodologica necessaria: `GB-GR-002`, `GB-GR-016`, `GB-GR-034`, `GB-GR-035` (**`UNSUPPORTED`**), `GB-AC-016`, `GB-AC-021` |
| **`REBUILD_CONTEXT`** | **13** | **15.9%** | Snippet SOURCE amputati dell'intestazione (GR-007..012, GR-015, GR-028, GR-030, GR-046) o reviewer-authored (GR-033, GR-037, GR-039) |
| **`DROP`** | **1** | **1.2%** | `GB-GR-032` (meta-commento sul setup B1, non didattico) |
| **`RECLASSIFY_TASK`** | **1** | **1.2%** | `GB-AC-018` (formula `=SOMMA(Vendite!I2:I13)` riclassificata nel task di collaudo dello Spreadsheet Adapter) |
| **Totale** | **82** | **100.0%** | |

*\*Nota sui conteggi:* Il conteggio canonico adotta **61 KEEP e 6 RELABEL_RECOMMENDED**, includendo `GB-GR-035` tra i relabel raccomandati (rettificando `PARTIALLY_SUPPORTED` verso `UNSUPPORTED` per sancire formalmente la falsa attribuzione). Qualora l'esito di non-sostenibilità sia considerato coincidente con il giudizio restrittivo di Simone, il conteggio si attesta a 62 KEEP e 5 RELABEL_RECOMMENDED.

---

## 4. Conferma Analitica di GB-GR-035

```text
ID: GB-GR-035
Claim: "La fonte definisce Netto come Lordo diminuito dello sconto applicato."
Fonte Bounded: "Sono presenti le intestazioni Sconto, Lordo e Netto; le celle derivate sono vuote."
Annotazione Umana v1: PARTIALLY_SUPPORTED (Nota: "Correto ma derivato, non espressamente scritto")
Esito Correzione: UNSUPPORTED
Classe Epistemica: SOURCE_FACT / false attribution
```

**Motivazione Formale:**  
Il claim non si limita ad applicare una nozione algebrica generale, ma asserisce testualmente che *"La fonte definisce"*. La fonte bounded non contiene alcuna definizione; presenta unicamente le etichette delle colonne. Assegnare `SUPPORTED` o `PARTIALLY_SUPPORTED` a un claim che attribuisce falsamente una definizione alla fonte costituirebbe un vizio metodologico grave. Nel gold set v2 il caso viene etichettato come **`UNSUPPORTED`** per mantenere un presidio rigoroso contro le false attribuzioni.

---

## 5. Semantica Finale delle 5 Classi Epistemiche

```text
┌─────────────────────────┬───────────────────────────┬─────────────────────────────────────────────────────────┐
│ Classe Epistemica       │ Ruolo Architetturale      │ Regola di Verifica e Provenance                         │
├─────────────────────────┼───────────────────────────┼─────────────────────────────────────────────────────────┤
│ SOURCE_FACT             │ Fatto primario di fonte   │ Chunk ID puntuale; retrieval vettoriale + exact/semantic│
│                         │                           │ check; violazione se smentito o falsa attribuzione      │
├─────────────────────────┼───────────────────────────┼─────────────────────────────────────────────────────────┤
│ SOURCE_DERIVED          │ Deduzione logico-matematica│ Dimensione corretta [Netto = Lordo * (1 - Sconto)];     │
│                         │ da dati presenti          │ Tipo A: checker deterministico / Tipo B: semantic check │
├─────────────────────────┼───────────────────────────┼─────────────────────────────────────────────────────────┤
│ GENERAL_DOMAIN_KNOWLEDGE│ Conoscenza disciplinare   │ Tag disciplinare (nessun falso chunk); fact-checking    │
│                         │ generale                  │ concettuale; vietato attribuire alla fonte del docente  │
├─────────────────────────┼───────────────────────────┼─────────────────────────────────────────────────────────┤
│ PEDAGOGICAL_PROPOSAL    │ Proposta didattica per la │ Tag didattico + obiettivo; include formule generate     │
│                         │ conduzione della classe   │ supportate da AST; sempre soggetta a Teacher Review L3   │
├─────────────────────────┼───────────────────────────┼─────────────────────────────────────────────────────────┤
│ SOURCE_SPECIFIC_DETAIL  │ Dettaglio fisico vincolato│ Validazione rigida su AST (CellAwareSpreadsheetAdapter);│
│                         │ a coordinate / schemi     │ distingue formule memorizzate da formule generate       │
└─────────────────────────┴───────────────────────────┴─────────────────────────────────────────────────────────┘
```

**Composabilità:**
- `Primary Epistemic Role` stabilisce la finalità operativa primaria;
- `Evidence Dependencies` dichiarano le coordinate fisiche (AST) o le regole deduttive su cui poggia l'asserto;
- *Minimum sufficient provenance*, senza sentence-level classifier obbligatorio.

---

## 6. Status della Soglia di Gate C

- **Soglia di Accuratezza 95% su `SOURCE_FACT`:**  
  Formalmente qualificata come **`PROVISIONAL BENCHMARK THRESHOLD`** (indicatore orientativo per il benchmark esplorativo, soggetto a calibrazione empirica sul gold set corretto);
- **Hard Failures Categorici (Eliminatori):**
  1. Contraddizione esplicita di fatti attestati nella fonte;
  2. Falsa attribuzione materiale di definizioni o regole alla fonte;
  3. Utilizzo operativo di coordinate o nomi foglio inesistenti nell'AST;
  4. Troncamento strutturale (`finish_reason=length`) o JSON non conforme allo schema;
- **Metriche di Misurazione:**
  - *Teacher Editing Effort* (tempo ed entità dell'intervento umano necessario in L3);
  - *Critical Violation Rate* (frequenza di errori bloccanti);
  - *Source-fact Support* (fedeltà documentale);
  - *Pedagogical Usefulness* (efficacia didattica percepita dal docente).

---

## 7. Verifica e Allineamento dei Documenti Canonici

Tutti i riferimenti ai punti corretti sono stati aggiornati in modo mirato e coordinato:
1. `validation/results/grounding-generation-contract-review.md`: Testo principale interamente allineato con le 10 correzioni metodologiche;
2. `docs/ai/model-routing-and-registry.md`: Sezione 2.1 (decisione proposta), Sezione 2.4 (contratto a 5 classi con composabilità, formula dimensionale, limite embeddings, distinzione formule generate vs presenti);
3. `docs/dossiers/10-ai-architecture.md`: Sezione 75.1 (contratto epistemico allineato, ruolo embeddings, composabilità e formula corretta);
4. `docs/validation/00-feasibility-benchmark-gate.md`: Sezione 36.2 (Gate C v2 con provisional benchmark threshold, hard failures e adapter XLSX).

---

## 8. Conferma Readiness per i Task Successivi

- **`READY_FOR_GOLD_V2: SÌ`**  
  Il pacchetto metodologico per il Gold Set Gate B v2 è completamente definito: i 13 contesti decontestualizzati sono isolati e mappati sui testi sorgente completi di intestazioni; le 6 raccomandazioni di relabel sono formalizzate (inclusa la conferma categorica di `UNSUPPORTED` per `GB-GR-035`); `GB-GR-032` è marcato per l'espunzione; `GB-AC-018` è destinato al dataset spreadsheet.
- **`READY_FOR_SPREADSHEET_ADAPTER: SÌ`**  
  Il contratto formale dell'adapter deterministico cell-aware (`CellAwareSpreadsheetAdapter`), la distinzione tra formule memorizzate e generate a runtime, e i requisiti di affidabilità per `cached_value` sono consolidati per guidare l'interfaccia Pydantic e l'implementazione senza ambiguità.

---

## Identity Reconciliation Addendum — 30 settembre 2026

La successiva riconciliazione contro la v1 e le source raw ha identificato tre associazioni di ID errate in questo report. Per questi ID è autorevole `validation/results/Gate-B-gold-v2-reconciliation.md`:

- `GB-AC-018`: il caso reale v1 riguarda la spiegazione CERCA.X, non `=SOMMA(Vendite!I2:I13)`; final label `SATISFIED`, `RELABEL_RECOMMENDED`, resta nel Gold Gate B generale.
- `GB-GR-037`: il caso reale v1 riguarda l'affermazione che l'estratto contenga istruzioni di installazione/uso di DB Browser; final label `UNSUPPORTED`, `REBUILD_CONTEXT`.
- `GB-GR-046`: il caso reale v1 è la controlled perturbation che assegna `nome` come PK di `prodotti`; final label `UNSUPPORTED`, `REBUILD_CONTEXT`.

Conteggi canonici post-riconciliazione: `KEEP 61`, `RELABEL_RECOMMENDED 7`, `REBUILD_CONTEXT 13`, `DROP 1`, `RECLASSIFY_TASK 0`; Gold Gate B finale: **81 casi**. Le descrizioni confliggenti precedenti restano storiche e sono superseded da questo addendum e dal report di riconciliazione.
