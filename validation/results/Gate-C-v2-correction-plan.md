# Gate C v2 — Piano di Correzione Architetturale e Rerun Mirato

> **Stato:** Proposta Architetturale Aggiornata Post Architecture Review
> **Ruolo:** AI Platform Architect
> **Data:** 1 ottobre 2026 (Europe/Rome)
> **Contesto:** Superamento delle fragilità riscontrate in Gate C v2 (attempt-07/08/09) e abilitazione dei profili `remote.generation` e `remote.longform`
> **Documento di Riferimento Valutativo:** `validation/results/Gate-C-v2-human-review-report.md` (Blind Assistant Review)
> **Review Type:** `MODEL_IDENTITY_BLINDED_ASSISTANT_REVIEW` (ChatGPT) — Sign-off finale del Domain Owner (Simone) formalmente richiesto per la validazione
> **Workspace:** `~/Workspace/teacher-service-design`

---

## 1. Evidence Summary (Sintesi dell'Evidenza Sperimentale)

La valutazione combinata delle metriche di esecuzione (Phase 1 attempt-07) e della blind assistant review (condotta con mascheramento dell'identità dei modelli prima del disvelamento di `review-key.json`) fornisce il quadro empirico oggettivo per i tre modelli candidati (`CANDIDATE-A` = `agy/gemini-3.8-flash-tiered`, `CANDIDATE-B` = `groq/qwen/qwen3.8-27b`, `CANDIDATE-C` = `openrouter/dots-studio/dots-3-note-preview:free`):

| Candidato / Modello | Scenario | Profilo | Esito Tecnico | Esito Assistant Review | Teacher Editing Effort |
|---|---|---|---|:---:|:---:|
| **CANDIDATE-A** (`gemini-3.8-flash-tiered`) | DBMS SQL | `remote.longform` | COMPLETE_PASS | **3.63 / 4** | **`minor_edits`** (3989 parole, 120 min eccellenti) |
| **CANDIDATE-A** (`gemini-3.8-flash-tiered`) | Excel | `remote.longform` | COMPLETE_ISSUES | **3.38 / 4** | **`moderate_edits`** (4275 parole, 2 errori puntuali) |
| **CANDIDATE-A** (`gemini-3.8-flash-tiered`) | DBMS SQL | `remote.generation` | INCOMPLETE (length) | Non valutabile | Troncato a char 23867 (output token limit) |
| **CANDIDATE-A** (`gemini-3.8-flash-tiered`) | Excel | `remote.generation` | INCOMPLETE (length) | Non valutabile | Troncato (output token limit) |
| **CANDIDATE-B** (`groq/qwen/qwen3.8-27b`) | DBMS SQL | `remote.generation` | COMPLETE_PASS | **3.75 / 4** | **`minor_edits`** (Piano e Scheda coerenti e distinti) |
| **CANDIDATE-B** (`groq/qwen/qwen3.8-27b`) | Excel | `remote.generation` | INCOMPLETE | Non valutabile | Risposta incompleta/vuota (non completata) |
| **CANDIDATE-B** (`groq/qwen/qwen3.8-27b`) | DBMS & Excel | `remote.longform` | INCOMPLETE | Non valutabile | Pipeline non completata / timeout / token starvation |
| **CANDIDATE-C** (`dots-3-note-preview:free`) | DBMS SQL | `remote.generation` | COMPLETE_PASS (schema) | **1.63 / 4** | **`unusable`** (Tautologie e meta-direttive vuote) |
| **CANDIDATE-C** (`dots-3-note-preview:free`) | Excel | `remote.generation` | INCOMPLETE | Non valutabile | Risposta non conforme / incompleta |
| **CANDIDATE-C** (`dots-3-note-preview:free`) | DBMS & Excel | `remote.longform` | INCOMPLETE | Non valutabile | Incapace di sostenere pipeline estesa |

### Sintesi dell'Evidenza Primaria:
1. **Gemini nel Longform dimostra eccellente tenuta narrativa e pedagogica:** Ha generato due copioni di oltre 4000 parole con gestione credibile dei tempi (120 min), registro docente naturale e scansione a fasi;
2. **Groq Qwen nella Generation dimostra fattibilità quando l'ambito è circoscritto:** Nello scenario DBMS ha generato un JSON valido, con Lesson Plan e Student Material distinti e pronti con minimi ritocchi (`minor_edits`);
3. **Dots fallisce semanticamente nonostante la validità sintattica:** Ha rispettato lo schema formale JSON Schema producendo però solo meta-istruzioni e tautologie descrittive (0/4 Completeness e Pedagogical Usefulness);
4. **Assenza di Evidenza sulla Phase 2:** A causa di anomalie di trasporto di rete (socket connection refused), la Phase 2 non ha generato artefatti, lasciando l'evidenza per `remote.generation` su Excel non osservata.

---

## 2. Root Cause Analysis (Analisi delle Cause Radice)

L'analisi ingegneristica individua cinque cause radice distinte e delimitate:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ROOT CAUSE TAXONOMY                                  │
├───────────────────────────────┬────────────────────────────────────────────────────────┤
│ RC1: Monolithic Fragility     │ Chiamata unica per Piano + Scheda + Metadati           │
│                               │ fortemente implicata nel troncamento di Gemini.        │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ RC2: Semantic Blindness       │ JSON Schema valida la sintassi ma è cieco rispetto a   │
│                               │ tautologie, placeholder e meta-istruzioni (Dots).      │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ RC3: Grounding Inadequacy     │ Assenza di un Fact Pack verificato con aggregazioni    │
│                               │ pre-calcolate causa scambi di celle ed errori algebrici│
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ RC4: Rigid Heuristic Checkers │ Checker automatici lessicali scambiavano formule lecite│
│                               │ per violazioni (74 warning a fronte di 0 coord errate) │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ RC5: Transport/Slot Confusion │ Errori di connettività di rete (URLError) gestiti      │
│                               │ consumando slot anziché isolare l'ambiente di test.    │
└───────────────────────────────┴────────────────────────────────────────────────────────┘
```

1. **RC1 — Fragilità Contrattuale della Chiamata Monolitica (`remote.generation`):**
   La generazione in una singola chiamata strutturata di Lesson Plan (fasi, minutaggi, obiettivi, metodologia), Student Material (teoria ed esercizi) e metadati curricolari rappresenta una fragilità empiricamente osservata. È fortemente implicata nel troncamento sistematico di Gemini (`finish_reason: length` a char 23867). Per Groq, il successo su DBMS e l'incompiutezza su Excel evidenziano come payload estesi rendano la singola chiamata strutturata instabile;
2. **RC2 — Cecità Semantica della Sola Validazione Sintattica:**
   Il validatore JSON Schema si limita a verificare tipi di dato e presenza delle chiavi. Un modello debole o elusivo come Dots ha generato chiavi formalmente corrette (`"lesson_plan": "piano operativo per 120 minuti con fasi e minutaggi..."`, `"student_material": "inserire esercizi da 1 a 4..."`), soddisfacendo lo schema sintattico ma producendo un deliverable nullo sul piano didattico (**1.63 / 4**, effort `unusable`);
3. **RC3 — Inadeguatezza dell'Evidence Pack per Dettagli Specifici e Calcoli Derivati:**
   I due errori confermati sull'AST in Gemini Excel Longform:
   - *Inversione Ruolo Cella su Aliquota Commissione (M3 vs M4):* M3 nell'AST è l'etichetta testuale (`Aliquota commissione`), mentre M4 è il valore numerico `0.05` con formato percentuale `0%`; il modello ha confuso i ruoli indicando M4 come intestazione;
   - *Errore di Calcolo su Aggregazione Derivata (`MEDIA.SE`):* Il modello ha dichiarato che Sara avesse la media vendite più alta invece di Marco (Marco $pprox 89.32$ € vs Sara $pprox 74.73$ €);
   dimostrano che i modelli linguistici non devono essere usati come motori di aggregazione numerica a memoria su insiemi densi di dati;
4. **RC4 — Iper-Rigidità Euristica dei Checker Automatici Preliminari:**
   I checker automatici preliminari segnalavano 74 hit/warning interpretando come violazioni o leak le formule complesse o i riferimenti di cella non letteralmente presenti nella dispensa, ignorando che il modello stava legittimamente utilizzando celle reali dell'AST. L'audit ha confermato che **zero coordinate citate erano inesistenti**;
5. **RC5 — Conflusione tra Fallimenti di Trasporto ed Evidenza di Modello:**
   In attempt-08 e attempt-09, fallimenti di rete a livello di socket HTTP (`URLError`) hanno interrotto i test prima della Phase 2. Tali anomalie infrastrutturali non costituiscono evidenza di incapacità qualitativa dei modelli e non devono consumare gli slot di test.

---

## 3. Cosa ha Già Funzionato (Evidenze Positive da Preservare)

1. **Pipeline Composita per `remote.longform`:**
   La generazione sequenziale (Plan $ightarrow$ 4–6 sezioni delimitate $ightarrow$ assemblaggio deterministico $ightarrow$ controlli locali $ightarrow$ L3 review) ha permesso a Gemini 3.8 Flash di produrre testi di oltre 4000 parole con punteggi di **3.63/4** (DBMS) e **3.38/4** (Excel) e gestione accurata del tempo (120 minuti);
2. **Capacità di Generazione Strutturata di Qwen 27B (`groq`):**
   Nello scenario DBMS, Qwen ha prodotto un deliverable completo con piano e scheda chiaramente differenziati, valutato **3.75/4** con effort `minor_edits`;
3. **Parser Deterministico Locale (`CellAwareSpreadsheetAdapter`):**
   Il parsing deterministico nativo OOXML di fogli, celle, formule memorizzate e regioni rilevate fornisce la base di verità certificata; tutte le 19 coordinate usate dal modello erano verificabili nell'AST;
4. **Metodologia di Revisione Blindata:**
   Il mascheramento dell'identità del modello con congelamento dei punteggi prima dell'apertura di `review-key.json` ha garantito l'oggettività della valutazione qualitativa.

---

## 4. Cosa NON va Ridisegnato (Invarianti Architetturali)

1. **Autorità dei Dati:**
   `Source Document` $ightarrow$ `Editable Canonical State` $ightarrow$ `Derived Artifacts`. Il modello linguistico **non è mai fonte di autorità** sui dati di fatto o sui calcoli;
2. **Determinismo a Monte dei Modelli:**
   Parsing sintattico, estrazione dei vincoli e calcolo delle aggregazioni avvengono con codice deterministico Python certificato prima di invocare i modelli remoti;
3. **Minima Provenienza Sufficiente (*Minimum Sufficient Provenance*):**
   Nessun classificatore sentence-level o parser probabilistico pesante a runtime. La tracciabilità si basa su contratti di prompt ed evidenze strutturate;
4. **Centralità della Revisione Docente (L3 Teacher Review - Prepare):**
   Il docente mantiene il controllo e la responsabilità finale. L'artefatto deve richiedere al massimo interventi di rifinitura (`minor_edits` per il baseline T1);
5. **Divieto di Fallback Implicito tra Modelli:**
   Nessun cambio trasparente di modello durante una run di benchmark o in produzione;
6. **Separazione Locale/Remoto:**
   Parsing, retrieval, validazione e assemblaggio sono rigorosamente locali; la generazione pesante passa attraverso il gateway astratto OmniRoute.

---

## 5. Architettura Correttiva per `remote.generation` (Split Deterministico a 2 Stadi)

### 5.1 Valutazione dell'Opzione B (Adottata)

Si adotta formalmente l'**Opzione B: Split Deterministico a 2 Stadi con Assemblaggio Programmatico**:

- **Stage 1 (Lesson Plan + Metadata):** Il modello genera la scansione temporale, gli obiettivi di apprendimento, le metodologie didattiche e i metadati curricolari;
- **Validazione Intermedia:** Il Lesson Plan viene sottoposto a validazione JSON Schema e al Semantic Deliverable Completeness Gate deterministico. Se valido, viene congelato e persistito;
- **Stage 2 (Student Material):** Il modello genera il materiale per lo studente (sintesi concettuali ed esercizi guidati), ricevendo in input il Lesson Plan approvato e le evidenze circoscritte per gli esercizi;
- **Validazione e Assemblaggio:** Lo Student Material viene validato e assemblato programmaticamente con il Lesson Plan nel deliverable finale.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   STAGE 1: GENERATION OF LESSON PLAN & METADATA                        │
│ Input: Bounded Evidence Pack + Docente Context + Profilo Didattico                    │
│ Output Schema: LessonPlanSchema (Obiettivi, Fasi Temporali, Metodologia, Metadati)    │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│           DETERMINISTIC VALIDATION & SEMANTIC COMPLETENESS GATE (STAGE 1)              │
│  - JSON Schema Validation (Syntactic correctness)                                      │
│  - Semantic Completeness Gate (Anti-placeholder, anti-tautology substance checks)      │
│  - Time Budget Balance (Somma tempi fasi = Durata target lezione)                      │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │ [Pass: Lesson Plan Frozen & Persisted]
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   STAGE 2: GENERATION OF STUDENT MATERIAL                              │
│ Input: Approved Lesson Plan + Specific Exercise Evidence (from Fact Pack)              │
│ Output Schema: StudentMaterialSchema (Spiegazioni, Esercizi, Guida Pratica, Soluzioni)│
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│           DETERMINISTIC VALIDATION & SEMANTIC COMPLETENESS GATE (STAGE 2)              │
│  - JSON Schema Validation (Syntactic correctness)                                      │
│  - Semantic Completeness Gate (Verifica presenza esercizi reali e soluzioni)           │
│  - Bounded Coordinate & Derived Fact Check                                            │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │ [Pass: Student Material Frozen]
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                  DETERMINISTIC PROGRAMMATIC CANONICAL ASSEMBLY                         │
│  Combina Stage 1 e Stage 2 nel Canonical Deliverable JSON per L3 Teacher Review        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Benefici Ingegneristici:**
- Riduce significativamente il rischio di troncamento per lunghezza dimezzando il carico di output token per singola richiesta;
- Isola i fallimenti: un eventuale problema sullo Stage 2 non invalida lo Stage 1 già approvato;
- Mantiene l'emissione all'interno dei limiti ottimali di attenzione e context window di modelli efficienti (come Qwen 27B);
- Garantisce coerenza didattica alimentando lo Stage 2 con il piano pedagogico già validato.

*(Nota metodologica: lo split a 2 stadi non "elimina alla radice" ogni ipotetico troncamento in assoluto, ma circoscrive ciascun output, ne limita la complessità e isola i punti di fallimento).*

---

## 6. Semantic Deliverable Completeness Gate (Filtro Anti-Placeholder / Tautologie)

Il **Semantic Deliverable Completeness Gate** opera deterministicamente dopo la validazione JSON Schema e prima del salvataggio o della revisione docente, intercettando deliverable formalmente validi ma privi di sostanza.

### 6.1 Struttura a Due Livelli del Gate:

1. **Livello A — Controlli Deterministici di Sostanza (*Hard Substance Checks*):**
   - *Popolamento Effettivo delle Sezioni:* Nessuna sezione o campo obbligatorio può essere vuoto o composto solo da spazi/caratteri speciali;
   - *Rilevamento di Placeholder e Meta-Template:* Intercettazione immediata di pattern di bozza o evasione del compito:
     - Costrutti meta-prescrittivi: `(inserire|aggiungere|descrivere|spiegare|fornire)\s+(qui\s+)?(gli\s+|le\s+|un\s+)?(esercizi|obiettivi|contenuti|formule|fasi)`
     - Tautologie del prompt: `piano operativo per \d+ minuti`, `struttura conforme a`, `sezione per lo studente da completare`
     - Indicatori di omissione: `TODO`, `TBD`, `[placeholder]`, `[...]`, `eccetera`, `omissis`;
   - *Distinzione Strutturale tra Piano e Scheda:* Verifica che il testo dello Student Material non sia una mera copia o parafrasi del Lesson Plan;
   - *Presenza di Esercizi Reali:* Lo Student Material deve contenere compiti applicativi con testo di consegna e scaffolding operativo;
2. **Livello B — Soglie Quantitative Provvisorie (da calibrare in Slice C2):**
   - Soglie orientative provvisorie: Lesson Plan $\ge 600$ parole; Student Material $\ge 800$ parole; descrizione singola fase $\ge 50$ parole;
   - **Tali soglie non sono invarianti universali rigide:** saranno calibrate empiricamente nello **Slice C2** tramite fixture positive (deliverable completi di Gemini e Groq) e negative (output placeholder di Dots), stabilendo margini realistici e robusti.

**Azione:** Il fallimento del Gate assegna lo stato `TECHNICAL_INVALID` con codice `SEMANTIC_COMPLETENESS_GATE_FAILED`, bloccando il deliverable senza coinvolgere inutilmente il revisore.

---

## 7. Architettura dell'Evidenza Specifica e Derivata (SpreadsheetEvidenceProvider & Bounded Fact Pack)

### 7.1 Flusso Deterministico di Evidenza
Il flusso di generazione rispetta rigorosamente la catena:

$$	ext{Spreadsheet AST} \longrightarrow 	ext{Deterministic Evidence Query} \longrightarrow 	ext{Bounded Evidence Pack} \longrightarrow 	ext{Generation} \longrightarrow 	ext{Deterministic Validation}$$

È formalmente vietato l'uso di file JSON di evidenza compilati a mano o disconnessi dall'AST del parser.

### 7.2 Regola Anti-Dump e Budget Orientativo
È vietato iniettare nel prompt il dump integrale dell'AST (che contiene centinaia di nodi). Il Bounded Evidence Pack deve essere circoscritto al contesto didattico della lezione. Un intervallo di **400–600 token** costituisce un target orientativo di efficienza per prompt, non un vincolo matematico inderogabile. Vale il principio della **minima provenienza sufficiente**.

### 7.3 Autorità Reale dell'AST del Progetto (`CellAwareSpreadsheetAdapter`)
I dati del foglio demo certificati dall'adattatore (`validation/artifacts/Spreadsheet-Adapter/workbook-ast.json`) stabiliscono la verità del corpus didattico:
- **5 Fogli Rilevati:** `LEGGIMI`, `Ripasso`, `Prodotti`, `Vendite`, `Riepilogo`;
- **Tabelle Native OOXML:** 0 (nessun tag `table` nativo presente nel file sorgente);
- **Regioni Rilevate (*Detected Regions*):** 5 regioni tabellari delimitate;
- **Foglio `Vendite`:** Detected region con range `A3:M15` (13 colonne: Data, Codice, Quantità, Venditore, Sconto, Prodotto, Prezzo unitario, Lordo, Netto, Commissione, Fascia, Bonus, Aliquota commissione);
- **Cella `M3`:** Etichetta testuale (`raw_value: "Aliquota commissione"`, `data_type: "string"`);
- **Cella `M4`:** Valore numerico (`raw_value: 0.05`, `data_type: "number"`, `number_format: "0%"`).

### 7.4 Ambiti di Visibilità dell'Evidenza (*Evidence Visibility Scopes*)
L'Evidence Pack supporta la qualificazione dello scopo d'uso per ciascun dato:
- **`PROMPT_VISIBLE`:** Fatti e strutture accessibili al prompt del generatore (es. struttura colonne, aliquota commissione);
- **`VALIDATOR_ONLY`:** Valori e risultati algebrici noti a priori usati esclusivamente dai checker deterministici per convalidare l'output (es. per verificare gli esercizi dello Student Material senza rivelare in anticipo la soluzione allo studente);
- **`TEACHER_ONLY`:** Informazioni riservate al docente e al Teacher Script (es. indicazioni metodologiche, soluzioni complete, avvertenze didattiche).

### 7.5 Esempio di Bounded Evidence Pack Strutturato (Generato da Dati Reali)

```json
{
  "evidence_pack_type": "BOUNDED_SPREADSHEET_EVIDENCE",
  "sheet_name": "Vendite",
  "detected_region": {
    "name": "Vendite",
    "range_ref": "A3:M15",
    "source_type": "detected_range",
    "header_row": 3,
    "key_columns": [
      {"column": "B", "header": "Codice", "header_coordinate": "B3"},
      {"column": "C", "header": "Quantità", "header_coordinate": "C3"},
      {"column": "E", "header": "Sconto", "header_coordinate": "E3", "semantic_type": "ADIMENSIONAL_RATE"},
      {"column": "G", "header": "Prezzo unitario", "header_coordinate": "G3"},
      {"column": "H", "header": "Lordo", "header_coordinate": "H3"},
      {"column": "I", "header": "Netto", "header_coordinate": "I3"},
      {"column": "M", "header": "Aliquota commissione", "header_coordinate": "M3"}
    ]
  },
  "source_facts": [
    {
      "coordinate": "M3",
      "role": "LABEL",
      "raw_value": "Aliquota commissione",
      "data_type": "string",
      "visibility": "PROMPT_VISIBLE"
    },
    {
      "coordinate": "M4",
      "role": "VALUE",
      "raw_value": 0.05,
      "number_format": "0%",
      "semantic_meaning": "Aliquota provvigionale base (5%)",
      "visibility": "PROMPT_VISIBLE"
    }
  ],
  "source_derived": [
    {
      "variable_name": "media_vendite_per_venditore",
      "aggregation_type": "AVERAGEIF",
      "results": [
        {"entity": "Marco", "value": 89.32, "unit": "valuta", "rank": 1},
        {"entity": "Anna", "value": 86.33, "unit": "valuta", "rank": 2},
        {"entity": "Sara", "value": 74.73, "unit": "valuta", "rank": 3}
      ],
      "didactic_takeaway": "Marco registra la media vendite più alta (~89.32 €)",
      "visibility": "TEACHER_ONLY"
    },
    {
      "variable_name": "regola_calcolo_netto",
      "formula_semantics": "Netto = Lordo * (1 - Sconto)",
      "excel_formula_pattern": "=H4*(1-E4)",
      "semantic_note": "Sconto è un tasso percentuale adimensionale; vietata la sottrazione Lordo - Sconto",
      "visibility": "PROMPT_VISIBLE"
    }
  ]
}
```

---

## 8. Architettura Correttiva per `remote.longform` (Evidence Injection & Preservazione Pipeline)

Si **preserva integralmente l'architettura della pipeline longform composita già validata** nei precedenti gate, senza introdurre stadi artificiali:

$$	ext{PLAN} \longrightarrow 	ext{4–6 BOUNDED SECTIONS} \longrightarrow 	ext{DETERMINISTIC ASSEMBLY} \longrightarrow 	ext{LOCAL CHECKS} \longrightarrow 	ext{max 1 BOUNDED REPAIR per sezione} \longrightarrow 	ext{L3 REVIEW}$$

### Correzioni Mirate Introdotte:
1. **Bounded Evidence Injection:** Iniezione mirata delle sole evidenze rilevanti per ciascuna fase della lezione (es. struttura della cartella nella fase di introduzione; calcoli e formule nelle fasi di esercitazione guidata);
2. **Deterministic Grounding Checks:** Verifica immediata di conformità a `SOURCE_FACT` e `SOURCE_DERIVED` al termine della stesura di ogni sezione;
3. **Targeted Section Repair:** Attivazione del bounded repair contract esclusivamente sulla singola sezione difettosa, senza risottomettere l'intero testo. La formattazione non costituisce uno stadio autonomo di modello, ma una regola di rendering locale.

---

## 9. Bounded Repair Contract (Contratto di Riparazione Mirata e Limitata)

Quando una sezione generata viola vincoli fattuali o sintattici deterministici:

1. **Principio `GENERATE ≠ APPLY`:** Il modello genera una proposta di riparazione; il motore deterministico locale valida la proposta e, solo se corretta, la applica al documento;
2. **Budget Rigido (Massimo 1 Retry per Sezione):** È consentito un solo tentativo di riparazione per sezione. I loop infiniti di correzione sono vietati; se la riparazione fallisce, la discrepanza viene registrata come `ANNOTATED_DISCREPANCY` e inoltrata alla L3 Teacher Review;
3. **Payload del Prompt di Riparazione Estremamente Circoscritto:**
   - Contiene solo il paragrafo/sezione interessato (non l'intero documento);
   - Notifica l'errore deterministico riscontrato (es. *"Cella M3 è etichetta 'Aliquota commissione', cella M4 è valore 0.05"*);
   - Fornisce il corretto frammento di evidenza;
   - Richiede la rigenerazione della sola porzione necessaria.

---

## 10. Separazione Concettuale e Operativa: Transport vs. Model Quality

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FAILURE TAXONOMY & RESOLUTION POLICY                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. TRANSPORT & INFRASTRUCTURE FAILURES (Ambito Ambientale/Infrastrutturale)           │
│    - URLError (socket drop, connection refused verso OmniRoute)                        │
│    - HTTP 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout                │
│    - Rate limit da provider remoto (HTTP 429 con Retry-After)                          │
│    POLICY OPERATIVA:                                                                   │
│    * Registra lo stato ENVIRONMENT_BLOCKED / TRANSPORT_BLOCKED;                        │
│    * La replica di test programmata NON viene consumata;                               │
│    * NESSUNA penalizzazione qualitativa per il modello;                                │
│    * La replica viene rischedulata successivamente;                                    │
│    * Catalog bootstrap: mantiene la propria policy limitata di retry;                  │
│    * Chiamate di inferenza di route: NESSUN retry automatico nascosto.                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. MODEL QUALITY & BEHAVIORAL FAILURES (Ambito Qualitativo di Modello)                 │
│    - Troncamento dell'output (finish_reason = length)                                  │
│    - Schema JSON non valido o malformato                                               │
│    - Fallimento del Semantic Deliverable Completeness Gate (Dots tautology)            │
│    - Errori gravi di grounding (coordinate inesistenti, aggregazioni errate)           │
│    - Rifiuto pedagogico (Teacher Editing Effort = unusable)                            │
│    POLICY OPERATIVA:                                                                   │
│    * Consuma lo slot di valutazione del benchmark;                                     │
│    * Determina il giudizio di qualificazione del modello per il profilo.               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Verifica della Salute dell'Infrastruttura:** Prima di avviare il benchmark, si impiegano i meccanismi consolidati di discovery catalogo e probe sintetici diretti già documentati, senza inventare nuovi endpoint ad-hoc.

---

## 11. Proposta di Status dei Candidati per Profilo (Profile-Specific Status)

In conformità al registry canonico (`docs/ai/model-routing-and-registry.md`), si formalizzano i seguenti stati proposti:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                    PROPOSED CANDIDATE PROFILE STATUS SUMMARY                           │
├──────────────────────────────────────┬──────────────────────┬──────────────────────────┤
│ Candidate / Model ID                 │ Capability Profile   │ Proposed Status          │
├──────────────────────────────────────┼──────────────────────┼──────────────────────────┤
│ agy/gemini-3.8-flash-tiered          │ remote.generation    │ COMPATIBLE (In Rerun)    │
│ agy/gemini-3.8-flash-tiered          │ remote.longform      │ COMPATIBLE (In Rerun)    │
│ agy/gemini-3.8-flash-tiered          │ remote.reasoning     │ HISTORICAL_ELIGIBLE      │
├──────────────────────────────────────┼──────────────────────┼──────────────────────────┤
│ groq/qwen/qwen3.8-27b                │ remote.generation    │ COMPATIBLE (In Rerun)    │
│ groq/qwen/qwen3.8-27b                │ remote.longform      │ NOT_VALIDATED / DEFERRED │
├──────────────────────────────────────┼──────────────────────┼──────────────────────────┤
│ openrouter/dots-studio/dots-3-note...│ remote.generation    │ REJECTED_FOR_PROFILE     │
│ openrouter/dots-studio/dots-3-note...│ remote.longform      │ REJECTED_FOR_PROFILE     │
└──────────────────────────────────────┴──────────────────────┴──────────────────────────┘
```

### Motivazioni Analitiche:
- **`agy/gemini-3.8-flash-tiered`:**
  - `remote.generation`: Proposto **`COMPATIBLE / CORRECTIVE_REVALIDATION_REQUIRED`** (ammesso al rerun a 2 stadi);
  - `remote.longform`: Proposto **`COMPATIBLE / CORRECTIVE_REVALIDATION_REQUIRED`** (ammesso al rerun con Fact Pack per validazione finale e regressione);
  - `remote.reasoning`: Confermato **`HISTORICAL_ELIGIBLE`**;
- **`groq/qwen/qwen3.8-27b`:**
  - `remote.generation`: Proposto **`COMPATIBLE / CORRECTIVE_REVALIDATION_REQUIRED`** (forte su DBMS con 3.75/4, ammesso al rerun su entrambi gli scenari);
  - `remote.longform`: **Non formalmente rigettato per il profilo in assoluto**, ma classificato come **`COMPATIBLE / NOT_VALIDATED / DEFERRED_FROM_CORRECTIVE_RERUN`** (l'evidenza pregressa è incompleta e parzialmente compromessa da failure runner);
- **`openrouter/dots-studio/dots-3-note-preview:free`:**
  - `remote.generation`: Formalmente **`REJECTED_FOR_PROFILE`** (evasione semantica, punteggio 1.63/4, unusable);
  - `remote.longform`: **`REJECTED_FOR_PROFILE`** / escluso dal rerun per manifesta incapacità di sostenere carichi complessi.

---

## 12. Ambito e Design del Rerun Correttivo Minimo (Corrective Rerun Scope)

Il Rerun Correttivo comprende esattamente **12 esecuzioni remote** (6 configurazioni $	imes$ 2 repliche di ripetibilità accoppiata):

### 12.1 Matrice del Rerun Correttivo (12 Esecuzioni Totali)

| Task ID | Modello | Scenario | Profilo | Architettura Applicata | Repliche | Scopo del Test |
|---|---|---|---|---|:---:|---|
| `CORR-01` | `agy/gemini-3.8-flash-tiered` | DBMS SQL | `remote.generation` | Split 2 Stadi + Semantic Gate | 2 run | Verifica superamento del troncamento |
| `CORR-02` | `agy/gemini-3.8-flash-tiered` | Excel | `remote.generation` | Split 2 Stadi + Fact Pack + Semantic Gate | 2 run | Verifica generazione strutturata Excel |
| `CORR-03` | `agy/gemini-3.8-flash-tiered` | DBMS SQL | `remote.longform` | Pipeline 6 stadi + Bounded Repair | 2 run | Test di regressione sui contratti aggiornati |
| `CORR-04` | `agy/gemini-3.8-flash-tiered` | Excel | `remote.longform` | Pipeline 6 stadi + Fact Pack + Bounded Repair | 2 run | Risoluzione errori M3/M4 e media vendite |
| `CORR-05` | `groq/qwen/qwen3.8-27b` | DBMS SQL | `remote.generation` | Split 2 Stadi + Semantic Gate | 2 run | Conferma stabilità e ripetibilità su DBMS |
| `CORR-06` | `groq/qwen/qwen3.8-27b` | Excel | `remote.generation` | Split 2 Stadi + Fact Pack + Semantic Gate | 2 run | Verifica tenuta su scenario tabellare |

**Terminologia Metodologica:** L'esecuzione di 2 repliche per configurazione misura la **ripetibilità accoppiata / consistenza run-to-run di base** (*paired repeatability*), senza pretendere di costituire una statistica inferenziale su larga scala.

---

## 13. Criteri di Accettazione Formalizzati (Acceptance Criteria)

Per conseguire la validazione a valle del Rerun Correttivo:

1. **Aderenza Factual Grounding (`SOURCE_FACT`):** $\ge 95\%$ (soglia provvisoria);
2. **Zero Hard Failures:**
   - Nessuna contraddizione materiale rispetto alla sorgente;
   - Nessuna falsa attribuzione;
   - Nessuna coordinata inesistente citata;
   - Nessun calcolo operativo derivato errato;
   - Nessun troncamento dell'output (`finish_reason` deve essere `stop`);
3. **Semantic Deliverable Completeness Gate:** Esito **`PASS`** su entrambi i run;
4. **Teacher / Domain Owner Review Effort:** Valutazione $\le$ **`minor_edits`** secondo le categorie canoniche (`usable_as_is`, `minor_edits`, `moderate_edits`, `major_rewrite`, `unusable`);
5. **Criterio di Ripetibilità:** Entrambi i run di replica accoppiata devono superare pienamente i criteri.

---

## 14. Voci Differite (Deferred Items)

1. Cicli conversazionali multi-agente per raffinamento ricorsivo;
2. Risolutori di vincoli generali o theorem prover simbolici;
3. Modellazione AST per formati non tabellari (es. PDF o documenti testuali);
4. Modelli multimodali per generazione grafica di diagrammi;
5. Meccanismi di fallback dinamico tra provider durante la singola transazione.

---

## 15. Implementation Slices (Scomposizione Operativa C1–C7)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CORRECTION IMPLEMENTATION SLICES                                │
├────────┬───────────────────────────────────────────┬───────────────────────────────────┤
│ Slice  │ Descrizione Sintetica                     │ Stato / Deliverable Concreto      │
├────────┼───────────────────────────────────────────┼───────────────────────────────────┤
│ **C1** │ Canonicalization of Review & Contracts    │ COMPLETATO (Report e Piano Corretti)│
│ **C2** │ Semantic Deliverable Completeness Gate    │ Calibrazione Fixture + Modulo     │
│ **C3** │ SpreadsheetEvidenceProvider & Scopes      │ Bounded Pack + Scopi Visibilità   │
│ **C4** │ 2-Stage remote.generation Pipeline        │ Runner 2-Stadi + Contratti        │
│ **C5** │ Longform Grounding & Bounded Repair Hook  │ Iniezione Pack + Riparazione      │
│ **C6** │ Corrective Harness & Transport Isolation  │ Harness 12 Run + Probe Salute     │
│ **C7** │ 12-Run Execution & Human Sign-Off Packet  │ Esecuzione + Pacchetto Decisionale│
└────────┴───────────────────────────────────────────┴───────────────────────────────────┘
```

- **Slice C1 — Canonicalization of Review & Contracts:** Completamento della formalizzazione della blind assistant review e del piano di correzione architetturale post-review;
- **Slice C2 — Semantic Deliverable Completeness Gate:** Implementazione del gate deterministico di sostanza con calibrazione delle soglie su fixture reali positive e negative;
- **Slice C3 — SpreadsheetEvidenceProvider & Visibility Scopes:** Generazione deterministica del Bounded Evidence Pack a partire dall'AST, con attribuzione degli scopi `PROMPT_VISIBLE`, `VALIDATOR_ONLY` e `TEACHER_ONLY`;
- **Slice C4 — 2-Stage Pipeline for `remote.generation`:** Disaccoppiamento della chiamata generativa in due stadi sequenziali (Piano $ightarrow$ Scheda) con validazione intermedia;
- **Slice C5 — Longform Evidence Injection & Bounded Repair Hook:** Integrazione dell'evidenza delimitata nella pipeline longform e supporto al bounded repair della singola sezione;
- **Slice C6 — Corrective Benchmark Harness & Transport Isolation:** Configurazione dell'ambiente di test per le 12 run con separazione rigorosa degli errori di trasporto;
- **Slice C7 — Corrective Benchmark Execution & Human Sign-Off Packet:** Esecuzione delle 12 run, formalizzazione dei risultati e produzione del pacchetto di delibera per il Domain Owner.

---

## 16. Rischi e Incertezze Residue (Risks & Unknowns)

1. **Tenuta di Qwen 27B nello Scenario Excel:** Verificare che lo Stage 2 su Excel rientri agevolmente nella finestra di attenzione del modello;
2. **Stabilità di Rete dei Socket di Routing:** Necessità di isolare le indisponibilità temporanee del trasporto tramite la policy senza intaccare la qualità;
3. **Calibrazione Fine delle Soglie Semantiche (Slice C2):** Accertarsi che le soglie del Semantic Gate non generino falsi allarmi su risposte didattiche sintetiche.

---

## 17. Punti Decisionali Congelati (Decisions D1–D4 Freeze)

In sede di Architecture Review, i quattro punti decisionali sono stati formalmente deliberati:

- **D1 — Architettura `remote.generation`:** **APPROVATO CON RETTIFICHE REDAZIONALI**. Adozione formale dello Split Deterministico a 2 Stadi (Stage 1 Piano $ightarrow$ Stage 2 Scheda $ightarrow$ Assemblaggio canonico programmatico);
- **D2 — Esclusione e Differimento Modelli:** **PARZIALMENTE APPROVATO**:
  - `Dots generation`: Escluso e respinto formalmente per il profilo (`REJECTED_FOR_PROFILE`);
  - `Dots longform`: Escluso dal rerun correttivo sulla base dei fallimenti osservati;
  - `Groq longform`: **Non formalmente respinto per il profilo**; classificato come `COMPATIBLE / NOT_VALIDATED / DEFERRED_FROM_CORRECTIVE_RERUN`;
- **D3 — Ambito del Rerun Correttivo:** **MODIFICATO E APPROVATO A 12 RUN REMOTE**:
  - 6 configurazioni $	imes$ 2 repliche di ripetibilità accoppiata (`CORR-01` a `CORR-06`);
- **D4 — Criteri di Accettazione e Categorie di Editing Effort:** **APPROVATO CON CATEGORIE CANONICHE**:
  - `SOURCE_FACT` $\ge 95\%$; zero hard failures; Semantic Completeness PASS; nessun troncamento;
  - Valutazione docente $\le `minor_edits`$ basata sulle categorie canoniche (`usable_as_is`, `minor_edits`, `moderate_edits`, `major_rewrite`, `unusable`), senza soglie temporali fisse;
  - Entrambi i run di replica devono superare i criteri.

---

## 18. Requisito di Human / Domain Owner Sign-Off Finale

Poiché la valutazione di Gate C v2 è stata condotta come blind assistant review, la promozione definitiva dei profili a `VALIDATED` o `ELIGIBLE` e il conseguente sblocco di Gate D richiedono la ratifica formale del Domain Owner (Simone) su un **Sign-Off Packet** sintetico generato al termine dello Slice C7. Fino a tale atto formale:
- `remote.generation`: **`UNVALIDATED`**
- `remote.longform`: **`UNVALIDATED`**
- `remote.reasoning`: **`HISTORICAL_ELIGIBLE`** (Gemini)
- `Gate D`: **`BLOCKED`**

---

## 19. Architecture Review Corrections — 2026-10-01

A seguito della revisione architetturale, sono state applicate le seguenti correzioni esplicite:
- **Attribuizione della Review:** Precisato che la review è stata una `MODEL_IDENTITY_BLINDED_ASSISTANT_REVIEW` e che il sign-off umano del Domain Owner è un requisito aperto a valle del rerun;
- **Evidenza dell'AST Excel:** Rimossi riferimenti a tabelle native OOXML e valori fittizi; adottati i dati reali di `CellAwareSpreadsheetAdapter` (`Vendite` detected range `A3:M15`, `M3` = "Aliquota commissione", `M4` = 0.05 / 0%);
- **Flusso dell'Evidence Pack:** Formalizzato il percorso deterministico `AST` $ightarrow$ `Query` $ightarrow$ `Bounded Pack` $ightarrow$ `Generation` $ightarrow$ `Validation`, introducendo gli ambiti di visibilità (`PROMPT_VISIBLE`, `VALIDATOR_ONLY`, `TEACHER_ONLY`);
- **Causa Radice `remote.generation`:** Rimossa l'affermazione di causalità assoluta/sistematica per entrambi i modelli; formulata come fragilità osservata fortemente implicata per Gemini;
- **Semantic Completeness Gate:** Distinti i controlli deterministici di sostanza dalle soglie quantitative, da calibrare nello Slice C2;
- **Preservazione Pipeline Longform:** Riaffermata la pipeline composita canonica (Plan $ightarrow$ 4–6 sezioni $ightarrow$ assemblaggio $ightarrow$ controlli $ightarrow$ bounded repair $ightarrow$ L3 review);
- **Decisioni D1–D4:** Congelate le delibere della review (D1 approvato, D2 parzialmente approvato con differimento Groq longform, D3 approvato a 12 run, D4 approvato con categorie canoniche);
- **Policy di Trasporto:** Esclusi retry automatici sulle chiamate di inferenza; confermato che il disservizio di rete genera `ENVIRONMENT_BLOCKED` senza penalizzare il modello o consumare la replica.
