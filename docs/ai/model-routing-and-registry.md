# Model Routing, Registry & Capability Architecture

> **Stato:** Documento architetturale canonico  
> **Ruolo:** AI Platform Architect  
> **Data:** 30 settembre 2026  
> **Posizione nel sistema documentale:** Specifica architetturale propedeutica al Dossier 12 (Platform Architecture), a valle dei benchmark di fattibilità B1–B6 e integrata con i Dossier 08, 09, 10 e 11.

---

## 1. Obiettivo e responsabilità architetturale

Il presente documento definisce la separazione tra:
1. **Dominio didattico e applicativo** (concetti di lezione, piano didattico, copione docente, materiale studente, verifiche, valutazioni);
2. **Capability astratte e profili di qualità** (ciò che il dominio richiede a livello funzionale e non-funzionale);
3. **Gateway, registry e cataloghi dinamici** (l’inventario di ciò che è fisicamente disponibile);
4. **Implementazioni concrete e runtime** (modelli locali oMLX/Ollama, modelli remoti via OmniRoute, parser, algoritmi deterministici).

### Responsabilità chiave dell’AI Platform Architect:
- **Nessun hardcoding di Model ID** nel dominio o nelle logiche applicative;
- **Cataloghi dinamici e modelli sostituibili** senza modifiche al codice;
- **Routing deterministico, trasparente e spiegabile**, basato su regole, filtri di policy e ordinamenti misurabili (nessun router basato su LLM);
- **Adozione del principio del minimo livello sufficiente**: privilegiare sempre la soluzione meno complessa e più verificabile;
- **Governance rigorosa dei dati**: nessun fallback implicito locale -> remoto o cross-provider quando proibito dalla policy di privacy.

---

## 2. Decisione di Prodotto Approvata e Revisione dei Risultati B3/B5

### 2.1 La decisione approvata
Viene formalizzata la seguente decisione di prodotto e di indirizzo:
> **Il Teacher Service NON richiede che un piccolo modello locale generi autonomamente output long-form complessi**, quali ad esempio Teacher Script estesi da 45–60 minuti, spiegazioni enciclopediche multi-documento, progettazione articolata di verifiche complesse o sintesi estese.  
> **La generazione long-form complessa è responsabilità primaria dei MODELLI GENERALI REMOTI gestiti tramite OmniRoute.**

Il runtime locale è invece riservato primariamente a:
- Ingestion e document parsing (Marker per PDF, MinerU per formati Office);
- Indicizzazione lessicale e vettoriale (SQLite FTS5, embedding locali come Qwen3-Embedding-0.6B su oMLX);
- Similarity, deduplicazione e recupero deterministico/ibrido;
- Controlli di conformità, validazione di schema e policy check;
- Classificazioni bounded e piccole estrazioni strutturate;
- Rilevamento anomalie, grounding check e quality check veloci;
- Eventuale bozza rapida o sintesi preliminare locale (chiaramente etichettata come bozza parziale).

### 2.2 Correzione dell’interpretazione dei benchmark B3 e B5
Nei report B3 (`validation/results/B3-models-report.md`) e B5–B6 (`validation/results/B5-B6-integration-report.md`), l’esito era stato rubricato come `CONDITIONAL` e `NOT YET FEASIBLE` perché i modelli locali testati (MiniCPM5-2B-MLX e Ornith-1.5-9B) non erano stati in grado di generare autonomamente un Teacher Script completo e pronto per la lezione con interventi minimi.

**Questa evidenza non costituisce un fallimento di fattibilità del Teacher Service o di T1:**
1. I benchmark B3/B5 hanno verificato un requisito locale estremo (*"generazione completa long-form 100% on-device su modelli 2B–9B"*), superiore a quanto realmente necessario per il valore di prodotto;
2. B3 e B5 hanno fornito un dato prezioso e definitivo: **i piccoli modelli locali attuali non garantiscono il livello qualitativo, la coerenza pedagogica e la tenuta contestuale richiesta per un Teacher Script di classe senza pesante riscrittura**;
3. Il fallimento della generazione locale non invalida l’architettura, ma ne corregge i confini: la generazione complessa viene demandata a modelli remoti capaci (attraverso un gateway disaccoppiato), mentre il locale conserva la sovranità su parsing, storage privato, retrieval e filtri di governance.

### 2.3 Principio del minimo livello sufficiente
L’architettura adotta la seguente catena ordinata di risoluzione:

```text
1. DETERMINISTIC / RULES
   ↓ (se richiede confronto o ricerca flessibile)
2. ALGORITHM / SEARCH / SIMILARITY
   ↓ (se richiede comprensione semantica delimitata o parsing)
3. SPECIALIST / LOCAL SMALL MODEL
   ↓ (se richiede generazione complessa, sintesi o reasoning esteso)
4. REMOTE GENERAL / REASONING MODEL (via OmniRoute)
   ↓ (per decisioni finali, giudizi formali o pubblicazione)
5. HUMAN AUTHORITY (Teacher Review & Approval)
```

**Regola aurea:** Usare sempre il primo livello sufficiente a risolvere il compito con la massima verificabilità e il minor costo/rischio.

### 2.4 Il Contratto Epistemico a 5 Classi (Grounding & Generazione Didattica)
Il Teacher Service genera **nuovo materiale didattico** e non si limita alla parafrasi delle fonti. Per discriminare tra arricchimento pedagogico legittimo e vera allucinazione, l'architettura formalizza cinque classi epistemiche. Il contratto governa claim e span semanticamente rilevanti (*minimum sufficient provenance*, senza sentence-level classifier obbligatorio) e prevede la composabilità delle classi (*Primary Epistemic Role + Supporting Roles*):

1. **`SOURCE_FACT` (Fatto Primario di Fonte):** Asserzioni direttamente verificabili nel Source Set. Provenance obbligatoria (`chunk_id`, riga). Candidate retrieval tramite embeddings/lessicale; checker di grounding deterministico o small semantic model (gli embeddings non sono entailment checker). Costituisce allucinazione l'asserzione di fatti non presenti, smentiti o falsamente attribuiti alla fonte.
2. **`SOURCE_DERIVED` (Fatto Derivato / Inferenza Logica):** Deduzioni analitiche, calcoli aritmetici o conversioni coerenti (es. $Netto = Lordo \times (1 - Sconto)$ quando Sconto è un tasso percentuale, equivalenza 10% $\leftrightarrow$ 0.10). Provenance: `chunk_id` sorgente + regola di calcolo. Si distinguono derivazioni formalizzabili (checker deterministico) da inferenze semantiche (bounded semantic check / review). Costituisce allucinazione l'errore di calcolo dimensionale o la falsa attribuzione alla lettera della fonte.
3. **`GENERAL_DOMAIN_KNOWLEDGE` (Conoscenza Generale della Disciplina):** Nozioni teoriche e metodologiche consolidate (sintassi ANSI SQL, funzionamento Excel, principi contabili) introdotte per spiegare. Provenance: categoria disciplinare (nessun chunk falso). Checker di accuratezza disciplinare e anti-spoofing. Costituisce allucinazione l'errore concettuale o la falsa attribuzione al testo del docente.
4. **`PEDAGOGICAL_PROPOSAL` (Proposta Didattica):** Esempi pratici, analogie, domande, varianti di esercizi, indicazioni di regia per la classe e formule didattiche per la soluzione generati ex-novo. Provenance: categoria didattica + obiettivo formativo. Checker di vincoli di tempo e livello. **Review docente sempre obbligatoria (L3 Prepare)**. Costituisce allucinazione la violazione palese dei vincoli didattici o la falsa attribuzione al materiale del docente.
5. **`SOURCE_SPECIFIC_DETAIL` (Dettaglio Fisico di Fonte):** Coordinate fisiche (es. `B2`, `I2:I13`), nomi di fogli e formule workbook. Ammessa **solo se sostenuta da un adapter strutturato** (`CellAwareSpreadsheetAdapter`). Distinzione chiara tra formule native memorizzate nel file (dettagli fisici di fonte) e formule didattiche generate a runtime (ammesse come `PEDAGOGICAL_PROPOSAL` se vincolate a coordinate reali dell'AST).

## 3. Matrice Canonica delle Capability (Local / Remote)

Ogni operazione del Teacher Service appartiene a una specifica classe di esecuzione. La tabella seguente costituisce il riferimento canonico per la progettazione dei componenti e delle policy.

| Capability | Classe di Esecuzione | Metodo Default | Limite / Fallback Boundary | Remoto Consentito? | Approvazione Umana Obbligatoria? | Note Architetturali |
|---|---|---|---|---|---|---|
| **File Type Detection** | Deterministic Local | Ispezione MIME / magic bytes / estensione | Fallback su analisi euristica header | **NO** | NO | B4 ha dimostrato che le regole impiegano ~0.02 ms con 100% accuratezza. |
| **Schema Validation** | Deterministic Local | Validatore Pydantic / JSON Schema | Rigetto esplicito dell’output / eccezione | **NO** | NO | Eseguita su ogni output prima di toccare il dominio. |
| **Automation Policy Evaluation** | Deterministic Local | Motore di regole e precondizioni D08 | Blocco esecuzione e routing in Review Inbox | **NO** | NO | Valuta trust ramp, prerequisiti e vincoli applicativi. |
| **Duration / Structure Arithmetic** | Deterministic Local | Calcolo algebrico su minutaggi/sezioni | Segnalazione scostamento temporale | **NO** | NO | Somma minuti fasi lezione, vincoli orario. |
| **Document Ingestion (PDF)** | Specialist Local | Marker (`marker-pdf` su MPS Apple Silicon) | Fallback MinerU (con log di degradazione) | NO (default) | NO | Validato in B1: Marker superiore su resa testo/formule PDF. |
| **Document Ingestion (Office/XLSX/DOCX)** | Specialist Local | MinerU (`hybrid-engine` locale) | Errore formattazione non supportata | NO (default) | NO | Validato in B1: MinerU gestisce DOCX/PPTX/XLSX. |
| **Spreadsheet Cell-Aware Parsing (XLSX)** | Deterministic Local | `CellAwareSpreadsheetAdapter` (openpyxl/calamine locale) | Segnalazione workbook corrotto / non-XLSX | **NO** | NO | Estrae coordinate celle, fogli multipli, intervalli e formule native per `SOURCE_SPECIFIC_DETAIL`. |
| **Text Chunking** | Deterministic Local | Structure-aware Markdown/Doc chunker | Fallback su sliding window con overlap | **NO** | NO | Basato su gerarchia titoli (#, ##) e blocchi logici. |
| **Text Indexing (Lexical)** | Deterministic Local | SQLite FTS5 (BM25 + prefix matching) | Ricerca testuale semplice LIKE / exact match | **NO** | NO | Fondazione privata a zero dipendenze esterne. |
| **Dense Embeddings** | Specialist Local | Qwen3-Embedding-0.6B su oMLX (locale) | **AUTO fallback su SQLite FTS5 lessicale** | Condizionale (solo se dati non Restricted) | NO | B2 ha validato Qwen3 su oMLX; FTS5 è fallback già testato. |
| **Reranking** | Specialist Local | Disabilitato di default / Qwen3-Reranker | Esclusione reranking (mantiene ranking B2) | NO | NO | B2 ha dimostrato che il reranker costa secondi e aumenta falsi positivi. |
| **Source Relevance Check** | Small Semantic Local | Heuristic + Small Model / Rizzo SUGGEST | Solo espansione candidati (recall-first) | Condizionale (solo se dati non Restricted) | NO (se solo suggerimento) | B4: non usare come filtro escludente; solo suggerimenti al docente. |
| **Metadata Extraction (delimitata)** | Small Semantic Local | Small Model (oMLX) con Schema Constrained | Estrazione regex/deterministica | Condizionale (solo se dati non Restricted) | NO (bozza interna) | Campi limitati (materia, livello, lingua, parole chiave). |
| **Lesson Plan Generation** | Remote General Generation | Modello Generale Remoto (via OmniRoute) | Altro modello `remote.generation` compatibile | **SÌ** (conforme a D11) | **SÌ (L3: ReviewItem)** | Produce bozza strutturata (Dossier 08: L3 Prepare). |
| **Teacher Script Generation** | Remote General Generation | Modello Remoto Long-form (via OmniRoute) | Altro modello `remote.longform` eligibile | **SÌ** (conforme a D11) | **SÌ (L3: ReviewItem)** | Generazione narrativa estesa con citazioni al Source Set. |
| **Student Material Generation** | Remote General Generation | Modello Generale Remoto (via OmniRoute) | Altro modello `remote.generation` eligibile | **SÌ** (conforme a D11) | **SÌ (L3: ReviewItem)** | Esercizi, schede guida, sintesi studenti differenziate. |
| **Complex Assessment Design** | Remote Reasoning / Research | Modello Remoto Reasoning (via OmniRoute) | Altro modello `remote.reasoning` eligibile | **SÌ** (conforme a D11) | **SÌ (L3: ReviewItem)** | Rubriche multidimensionali, casi studio, varianti parallele. |
| **Curriculum Multi-source Synthesis**| Remote Reasoning / Research | Modello Remoto Reasoning (via OmniRoute) | Altro modello `remote.reasoning` eligibile | **SÌ** (conforme a D11) | **SÌ (L3: ReviewItem)** | Analisi comparative programmi, raccordo interdisciplinare. |
| **Closed-item Grading** | Deterministic Local | Confronto esatto o normalizzato con chiave | Segnalazione ambiguità al docente | **NO** | NO (se chiave esatta approvata) | Correzione automatica quiz/scelte multiple (Dossier 06). |
| **Open-item Formative Feedback** | Remote General Generation | Modello Remoto Generale con Rubrica | Altro modello conforme D11 (dati anonimizzati)| **SÌ** (con minimizzazione D11) | **SÌ (L3: ReviewItem)** | Bozza di commento qualitativo basata sui criteri docente. |
| **Final Grade / Sanctions / Integrity**| Human Authority | **DOCENTE / CONSIGLIO DI CLASSE** | Nessun fallback automatico consentito | **NO** (Divieto AI) | **SÌ (Autorità esclusiva)** | Nessun modello AI può assegnare voti finali o sanzioni (D06/D08/D11). |
| **Accommodations / PEP / PDP** | Human Authority | **DOCENTE / REFERENTE INCLUSIONE** | Nessun fallback automatico consentito | **NO** (Divieto AI) | **SÌ (Autorità esclusiva)** | Dati Restricted; le decisioni formali spettano solo a persone autorizzate. |

---

## 4. Model Profiles, non Model ID

### 4.1 Principio di isolamento
Il dominio applicativo richiede **Capability e Profili**, mai identificatori fisici di modelli come:
- `agy/gemini-3.8-flash-tiered`
- `cx/gpt-6-astra`
- `claude-3-7-sonnet`
- `MiniCPM5-2B-MLX`

Gli identificatori di modello, i prefissi dei vendor e i puntatori infrastrutturali sono **dati di configurazione e di runtime**. Se un modello esce dal mercato, viene aggiornato o diventa indisponibile, la logica applicativa del Teacher Service rimane identica.

### 4.2 Catalogo dei Profili Standard

#### Profili LOCAL
1. `local.embedding`
   - **Scopo:** Calcolo di vettori densi per indicizzazione e semantic retrieval.
   - **Requisiti tipici:** Supporto embeddings API, output a dimensione fissa (es. 1024 o 1536), bassa latenza locale.
   - **Default iniziale candidato:** `Qwen3-Embedding-0.6B` su oMLX.
2. `local.semantic_small`
   - **Scopo:** Bounded classification, piccole estrazioni strutturate, verifica coerenza/anomalie, controlli di qualità preliminari.
   - **Requisiti tipici:** Dimensione ridotta (1B–4B), supporto JSON/Structured output rapido, basso consumo VRAM.
   - **Default iniziale candidato:** `MiniCPM5-2B-MLX` su oMLX.
3. `local.reranker`
   - **Scopo:** Riordinamento fine dei chunk recuperati da dense/lexical search.
   - **Requisiti tipici:** Cross-encoder o score di rilevanza semantica coppia (query, chunk).
   - **Default iniziale candidato:** `Qwen3-Reranker` su oMLX (disattivato di default per policy B2).
4. `local.typed_decision`
   - **Scopo:** Decisioni categoriche rigide e a zero token generati su schede o insiemi chiusi di opzioni.
   - **Requisiti tipici:** Calcolo di distribuzione logit / softmax su opzioni fisse, output tipizzato.
   - **Default iniziale candidato:** `Spark-X2.5-4B` su Rizzo Flow (riservato a use-case dove ha superato le euristiche).
5. `local.document_pdf`
   - **Scopo:** Estrazione di testo, formule LaTeX e layout da documenti PDF e scansioni.
   - **Requisiti tipici:** Parsing documentale preservando struttura Markdown e formule.
   - **Default iniziale candidato:** `Marker` CLI/wrapper locale su MPS Apple Silicon.
6. `local.document_office`
   - **Scopo:** Estrazione strutturata da file Word (DOCX), fogli di calcolo (XLSX) e presentazioni (PPTX).
   - **Requisiti tipici:** Pipeline OCR/VLM ibrida per formati Office.
   - **Default iniziale candidato:** `MinerU` hybrid-engine locale.

#### Profili REMOTE
1. `remote.fast`
   - **Scopo:** Risposte rapide a bassa latenza per feedback interattivi, riformulazioni brevi, sintesi veloci di singoli passaggi.
   - **Requisiti tipici:** TTFT (Time To First Token) < 500 ms, throughput elevato, costo per token minimo.
2. `remote.generation`
   - **Scopo:** Generazione didattica generale: Lesson Plan completi, spiegazioni strutturate, schede per studenti, esercizi e varianti formative.
   - **Requisiti tipici:** Ottima padronanza dell’italiano, rispetto dello structured output, aderenza didattica e grounding sulle fonti.
3. `remote.longform`
   - **Scopo:** Generazione di Teacher Script estesi (45–60 minuti di parlato coerente), simulazione di dialogo pedagogico, copioni dettagliati lezione per lezione.
   - **Requisici tipici:** Finestra di contesto ampia (>= 128k token), capacità di produrre output lunghi (> 4000 token) senza ripetizioni o loop, forte tenuta narrativa.
4. `remote.reasoning`
   - **Scopo:** Progettazione di verifiche complesse, allineamento quadri di competenze ministeriali, analisi incrociata tra curricoli, validazione di consistenza logica profonda.
   - **Requisiti tipici:** Supporto nativo a catena di pensiero (thinking/reasoning budget configurabile), eccellente affidabilità logico-concettuale.
5. `remote.research`
   - **Scopo:** Ricerca multi-fonte sul web, comparazione di documenti specialistici esterni, estrazione e sintesi di fonti multiple con attribuzione.
   - **Requisiti tipici:** Integrazione con tool di navigazione/ricerca, grounding e citazione rigorosa.
6. `remote.multimodal`
   - **Scopo:** Analisi di immagini didattiche complesse, grafici storici/geografici, diagrammi geometrici o scientifici e slide con impaginazione visuale non lineare.
   - **Requisiti tipici:** Vision-language model con alta risoluzione di lettura visuale.

---

## 5. Model Catalog e Registry Dinamico

Il sistema adotta un **Model Catalog dinamico** che scopre e indicizza i modelli realmente operativi nell’ambiente, senza liste statiche preconfezionate.

### 5.1 Fonti del Catalogo
1. **Remote Gateway:** Endpoint OmniRoute `/v1/models` (scopre dinamicamente i modelli resi disponibili via LAN/WAN);
2. **Local Engine:** Endpoint oMLX `/v1/models` (scopre i pesi MLX presenti localmente su `/Volumes/SIMONE/models/`);
3. **Local Specialized:** Manifest locali dei servizi dedicati (Marker, MinerU, Rizzo Flow `/health`).

### 5.2 Descrittore di Modello Normalizzato (`ModelDescriptor`)
Ogni modello scoperto viene normalizzato in un descrittore indipendente dal vendor:

```yaml
model_id: "agy/gemini-3.8-flash-tiered"      # ID univoco fornito dal gateway/runtime
provider: "agy"                             # Provider logico o aggregatore upstream
execution_location: "remote"                 # "local" | "remote"
modality: ["text", "vision"]                 # Modalità supportate in ingresso
context_window: 272000                       # Lunghezza massima della finestra di contesto
max_output_tokens: 8192                      # Limite massimo di token generabili
capabilities:
  structured_output: true                    # Supporto nativo a JSON Schema / schema enforcement
  tool_calling: true                         # Supporto a Function/Tool calling
  reasoning: true                            # Supporto a reasoning/thinking
  reasoning_tiers: ["low", "medium", "high", "xhigh", "max"]
  vision: true                               # Supporto a input immagini
lifecycle_status: "ELIGIBLE"                 # Stato nel ciclo di vita (vedi Sez. 6)
profile_eligibility:
  - profile: "remote.fast"
    status: "VALIDATED"
  - profile: "remote.generation"
    status: "VALIDATED"
  - profile: "remote.longform"
    status: "ELIGIBLE"
  - profile: "remote.reasoning"
    status: "VALIDATED"
cost_class: "low"                            # "free" | "low" | "medium" | "high"
latency_class: "low"                         # "low" | "medium" | "high"
privacy_eligibility: ["public", "teacher_internal", "student_personal_minimized"] # D11 compliance
observed_metrics:                            # Metriche empiriche osservate nei test reali
  last_tested_date: "2026-09-30"
  observed_throughput_tps: 84.5
  observed_structured_error_rate: 0.00
  observed_script_tenuta_score: 0.92
availability_status: "HEALTHY"               # "HEALTHY" | "DEGRADED" | "UNAVAILABLE"
last_health_check: "2026-09-30T10:15:00Z"
```

### 5.3 Distinzione fondamentale: Declared vs. Observed Capability
- **Declared Capability:** Ciò che il provider dichiara nelle specifiche (es. *"supporta 1M token di contesto e JSON Schema"*);
- **Observed Capability:** Ciò che i benchmark interni e i test di regressione del Teacher Service hanno empiricamente convalidato (es. *"tronca le risposte dopo 2500 token"* oppure *"fallisce lo schema Pydantic nel 18% dei casi su prompt in italiano"*).
Il Model Selector considera valida una capability solo quando lo stato empirico è `VALIDATED` o `ELIGIBLE`.

---

## 6. Ciclo di Vita del Modello (Model Lifecycle)

Un modello presente nei cataloghi attraversa una macchina a stati esplicita. Nessun modello scoperto entra in produzione senza validazione.

```text
       [ Endpoint /v1/models ]
                  │
                  ▼
          ┌───────────────┐
          │  DISCOVERED   │ (Trovato nel catalogo, metadati estratti)
          └───────┬───────┘
                  │ Supera prerequisiti tecnici minimi (schema, context window)
                  ▼
          ┌───────────────┐
          │  COMPATIBLE   │ (Sintatticamente idoneo, ma non testato sul dominio)
          └───────┬───────┘
                  │ Supera il benchmark di regressione per uno specifico profilo
                  ▼
          ┌───────────────┐
          │   VALIDATED   │ (Qualitativamente solido per il profilo)
          └───────┬───────┘
                  │ Supera i criteri di privacy, compliance e affidabilità operativa
                  ▼
          ┌───────────────┐
          │   ELIGIBLE    │ (Candidabile per la selezione deterministica)
          └───────┬───────┘
                  │ Configurazione esplicita da parte dell'amministratore/sistema
                  ▼
     ┌─────────────────────────┐
     │  DEFAULT_FOR_PROFILE    │ (Scelta primaria per il profilo indicato)
     └─────────────────────────┘
```

### Stati di eccezione e conservazione storico:
- `REJECTED_FOR_PROFILE`: Il modello ha fallito il benchmark specifico per un profilo (es. MiniCPM5-2B è `REJECTED_FOR_PROFILE` per `remote.longform`, ma resta `ELIGIBLE` per `local.semantic_small`);
- `DEPRECATED`: Il modello è ancora utilizzabile per riproducibilità o completamento task esistenti, ma non viene più assegnato ai nuovi task;
- `UNAVAILABLE`: Il modello non risponde agli health-check (timeout, connection refused, quota esaurita);
- **Conservazione dello storico:** Il registro non cancella i modelli obsoleti o rimossi: ne conserva il descrittore storico per garantire la ricostruzione fedele della **Provenance** di lezioni e materiali generati in passato.

---

## 7. Task Model Policy

Ogni capability di dominio definisce una **Task Model Policy**, che stabilisce i vincoli di esecuzione, i requisiti di confidenza e le regole di fallback.

### 7.1 Schema di una Task Model Policy
```yaml
task_name: "teacher_script.generate"
required_profile: "remote.longform"
execution_requirement: "REMOTE_PREFERRED"     # "LOCAL_ONLY" | "REMOTE_PREFERRED" | "DETERMINISTIC_ONLY"
required_capabilities:
  structured_output: true
  min_context_window: 64000
  language_proficiency: "it"
minimum_validation_status: "ELIGIBLE"
preferences:
  quality_priority: "HIGH"
  latency_priority: "MEDIUM"
  cost_priority: "LOW"
allowed_privacy_classes:                      # D11 Governance
  - "public"
  - "teacher_internal"
fallback:
  allowed: true
  mode: "AUTO"                               # "AUTO" | "APPROVAL_REQUIRED" | "FORBIDDEN"
  fallback_profile: "remote.generation"
  fallback_model_id: null                     # Risolto dinamicamente tra gli ELIGIBLE del profilo
```

### 7.2 Catalogo delle Policy per i Principali Task di Dominio

| Task Name | Profilo Richiesto | Requisito Esecuzione | Output Strutturato? | Privacy Class Ammessa | Modalità Fallback |
|---|---|---|---|---|---|
| `teacher_script.generate` | `remote.longform` | REMOTE_PREFERRED | SÌ (Schema Script) | Public, Teacher Internal | AUTO (su altro `remote.longform` ELIGIBLE) |
| `student_material.generate` | `remote.generation` | REMOTE_PREFERRED | SÌ (Schema Material) | Public, Teacher Internal | AUTO (su altro `remote.generation` ELIGIBLE) |
| `assessment.generate` | `remote.reasoning` | REMOTE_PREFERRED | SÌ (Schema Assessment) | Public, Teacher Internal | APPROVAL_REQUIRED (se cambia fornitore/costo) |
| `lesson_plan.generate` | `remote.generation` | REMOTE_PREFERRED | SÌ (Schema LessonPlan)| Public, Teacher Internal | AUTO (su altro `remote.generation` ELIGIBLE) |
| `material.extract_metadata`| `local.semantic_small`| LOCAL_ONLY | SÌ (Metadata Schema) | Tutte | AUTO (su parser/euristica deterministica) |
| `material.check_relevance` | `local.semantic_small`| LOCAL_ONLY | SÌ (RelevanceScore) | Tutte | FORBIDDEN (ritorna solo recall suggestions) |
| `source.check_grounding` | `local.semantic_small`| LOCAL_ONLY | SÌ (GroundingReport) | Tutte | APPROVAL_REQUIRED |
| `assessment.check_consistency`| `remote.reasoning` | REMOTE_PREFERRED | SÌ (ConsistencyReport)| Public, Teacher Internal | AUTO (su `remote.generation`) |
| `retrieval.embed` | `local.embedding` | LOCAL_ONLY | NO (Vector Float32) | Tutte | **AUTO (su SQLite FTS5 lessicale)** |
| `retrieval.rerank` | `local.reranker` | LOCAL_ONLY | NO (Rank Scores) | Tutte | **AUTO (disattivazione: mantieni ranking denso)** |

---

## 8. Model Selector Deterministico

Il Model Selector è il componente architetturale che risolve una Task Model Policy e le configurazioni applicative in un modello concreto da eseguire.

### 8.1 Regola architetturale ferrea
- **NESSUN LLM ROUTER:** Non viene utilizzato alcun modello linguistico per decidere quale modello invocare. Il routing tramite LLM introduce latenza non necessaria, costi imprevedibili, allucinazioni e non-riproducibilità;
- **NESSUN RIZZO SELECTOR:** Come accertato nel benchmark B4, Rizzo Flow / Spark-X2.5 non è adatto né utile per la selezione dei modelli. Il selector è un algoritmo software puro;
- **DECISIONE ALGORITMICA E DETERMINISTICA:** La scelta avviene mediante una pipeline di filtraggio e ordinamento sequenziale a costo zero e latenza inferiore al millisecondo.

### 8.2 Pipeline di Selezione Algoritmica

```text
                  [ Task da Eseguire ]
                           │
                           ▼
             [ 1. Task Model Policy Lookup ]
                           │
                           ▼
          [ 2. Catalog Scan (Modelli Attivi) ]
                           │
                           ▼
           [ 3. Hard Capability Filter ]
        (Scarta modelli privi di structured output,
         con context window insufficiente, ecc.)
                           │
                           ▼
          [ 4. Privacy & Governance Filter (D11) ]
       (Scarta modelli remoti se i dati sono Restricted
        o se la policy vieta l'invio all'esterno)
                           │
                           ▼
       [ 5. Validation / Lifecycle Filter ]
        (Scarta modelli DISCOVERED o REJECTED;
         trattiene solo VALIDATED ed ELIGIBLE)
                           │
                           ▼
        [ 6. Configuration Overrides Resolution (D09) ]
       (Verifica se esistono override espliciti di tenant,
        docente o one-off, verificandone l'autorità)
                           │
                           ▼
      [ 7. Multi-Criteria Scoring & Ranking ]
     (Ordina per: Default esplicito > Qualità > Costo > Latenza)
                           │
                           ▼
         [ 8. Selected Model + Explainability Trace ]
```

### 8.3 Trasparenza ed Explainability del Selector
Il Model Selector non restituisce solo l’identificatore del modello selezionato, ma emette una struttura formale di **Selection Trace**:
```json
{
  "task": "teacher_script.generate",
  "requested_profile": "remote.longform",
  "effective_policy": "POLICY_DEFAULT",
  "selected_model": {
    "model_id": "cx/gpt-6-astra",
    "provider": "cx",
    "execution_location": "remote",
    "reasoning_effort": "medium"
  },
  "candidate_evaluation": [
    {
      "model_id": "MiniCPM5-2B-MLX",
      "status": "EXCLUDED",
      "reason": "REJECTED_FOR_PROFILE: fallito benchmark di tenuta narrativa long-form B3/B5"
    },
    {
      "model_id": "agy/gemini-3.8-flash-tiered",
      "status": "ELIGIBLE_BACKUP",
      "score": 0.88,
      "reason": "Idoneo ma subordinato per preferenza qualità configurata"
    },
    {
      "model_id": "cx/gpt-6-astra",
      "status": "SELECTED",
      "score": 0.95,
      "reason": "Default configurato per remote.longform con supporto reasoning convalidato"
    }
  ],
  "fallback_chain": ["agy/gemini-3.8-flash-tiered"],
  "provenance_token": "sel_tr_8f91b2c4e0"
}
```

---

## 9. Integrazione con il Configuration Model (Dossier 09)

Il modello di configurazione del routing rispetta rigorosamente i principi stabiliti nel Dossier 09.

### 9.1 Risoluzione della Policy Effettiva
La configurazione effettiva per un task è il risultato della composizione gerarchica:
```text
SYSTEM DEFAULT
  + Deployment Policy (es. policy d'istituto o server scolastico)
  + Task Model Policy di base
  + Applicable Configuration (es. profilo della materia o classe)
  + Specific Override (es. preferenza esplicita del docente per un profilo)
  + One-off Override (es. istruzione contingente per una singola esecuzione)
  ─────────────────────────────────────────────────────────────────────────────
  = EFFECTIVE MODEL POLICY
```

### 9.2 Regole di Autorità e Confini di Sovrascrittura
Come stabilito in D09 (§12 e §13):
1. **Specificità != Autorità:** Un livello più specifico (es. preferenza del docente o one-off) **non può sovrascrivere un vincolo autoritativo superiore (Policy/Constraint)**. Se una policy d'istituto o un vincolo di privacy D11 impone `LOCAL_ONLY` per i dati dello studente, una preferenza docente per un modello remoto viene rigettata;
2. **I vincoli di Privacy e Sicurezza sono invalicabili:** Nessuna preferenza utente può forzare il routing esterno di dati classificati come `Restricted`;
3. **Nessuna persistenza automatica del One-Off:** Un override one-off (es. *"prova a rigenerare questo copione con profilo remote.reasoning"*) si applica esclusivamente alla richiesta corrente e non modifica la configurazione persistente del docente.

### 9.3 Esempi di Frammenti di Configurazione

#### Configurazione a livello di Deployment (`deployment.yaml`)
```yaml
ai_routing:
  gateway_type: "omniroute"
  enforce_privacy_boundaries: true
  defaults:
    profile_defaults:
      remote.fast: "agy/gemini-3.8-flash-tiered"
      remote.generation: "agy/gemini-3.8-flash-tiered"
      remote.longform: "cx/gpt-6-astra"
      remote.reasoning: "cx/gpt-6-sol"
      local.embedding: "Qwen3-Embedding-0.6B"
      local.semantic_small: "MiniCPM5-2B-MLX"
```

#### Override Docente per Contesto Didattico (`teaching_context.yaml`)
```yaml
teaching_context_id: "ctx_storia_liceo_4b"
overrides:
  # Il docente desidera massima profondità narrativa per gli script di storia
  teacher_script.generate:
    profile: "remote.longform"
    reasoning_effort: "high"
  # Per le verifiche desidera la modalità veloce
  assessment.generate:
    profile: "remote.fast"
```

---

## 10. Gateway Remoto e Confine OmniRoute

### 10.1 Architettura Esagonale: Porta vs. Adattatore
Il core del Teacher Service non dipende da OmniRoute, né da OpenAI, né da Google. Il core espone una porta astratta:

```text
┌──────────────────────────────────────────────────────────────┐
│                  TEACHER SERVICE CORE                        │
│                                                              │
│  [Domain Logic] ──► [Task Policy] ──► [Port: RemoteGateway]  │
└──────────────────────────────────────────────┬───────────────┘
                                               │ (interfaccia astratta)
                                               ▼
┌──────────────────────────────────────────────────────────────┐
│               INFRASTRUCTURE ADAPTER LAYER                   │
│                                                              │
│            [ OmniRouteGatewayAdapter ]                       │
│                         │                                    │
│                         ▼ (HTTP OpenAI-compatible API)       │
│               [ Servizio OmniRoute ]                         │
│               (198.51.100.13 / WAN)                           │
│                         │                                    │
│                         ├─► Google Gemini API                │
│                         ├─► OpenAI / Codex API               │
│                         └─► Anthropic Claude API             │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 Responsabilità di OmniRoute
OmniRoute funge da **gateway d'infrastruttura condiviso**:
1. **Aggregazione e normalizzazione dei cataloghi:** Espone l'endpoint `/v1/models` unificato;
2. **Multiplexing dei provider:** Instrada le chiamate verso OpenAI, Google, Anthropic in base al prefisso o allo slug richiesto;
3. **Isolamento delle credenziali dei vendor:** Il Teacher Service **non conosce e non gestisce** le API key di OpenAI, Google o Anthropic. Conosce unicamente la credenziale di accesso al gateway OmniRoute;
4. **Sostituibilità totale:** Un cambio di provider o di modello upstream avviene in OmniRoute senza riavviare o ricompilare il Teacher Service.

### 10.3 Gestione delle Credenziali
- **Credenziale dedicata del Teacher Service != credenziale OmniRoute condivisa dell'host != API Keys dei Provider:**
  - `TEACHER_SERVICE_OMNIROUTE_API_KEY`: unica credenziale ammessa per il client Teacher Service verso OmniRoute;
  - `OMNIROUTE_API_KEY`: credenziale condivisa dell'host, esplicitamente **fuori perimetro** per il Teacher Service e per i suoi benchmark;
  - `PROVIDER_KEYS` (Google, OpenAI, Anthropic, ecc.): gestite unicamente all'interno del servizio OmniRoute e mai esposte al Teacher Service;
- **Fail-closed obbligatorio:** se `TEACHER_SERVICE_OMNIROUTE_API_KEY` non è disponibile o viene rifiutata, il Teacher Service termina l'operazione con `AUTH_REQUIRED_TEACHER_SERVICE`. È vietato cercare o usare automaticamente `OMNIROUTE_API_KEY`, `~/.omniroute/.env`, configurazioni Codex o provider API key dirette;
- **Configurazione locale di sviluppo/validazione:** il progetto usa il file non versionato `.env.local`, letto esclusivamente dal loader comune `validation/shared/runtime_config.py`. Il template versionabile è `.env.example`;
- **Endpoint dedicato configurabile:** `TEACHER_SERVICE_OMNIROUTE_BASE_URL` definisce l'endpoint del gateway usato dal progetto;
- **Divieto di credenziali nei file versionati o negli artifact:** nessuna API key deve comparire in Git, log, report, JSON, manifest, request dump o artifact di benchmark;
- **Deployment futuro:** container/CI/server potranno iniettare lo stesso secret logico tramite il meccanismo di secret management del deployment, senza cambiare il contratto applicativo e senza ereditare credenziali condivise dell'host.

---

### 10.4 Remote Generation Pipeline Composita (Teacher Script & Longform)
Per superare i limiti sistematici di troncamento (`finish_reason=length`) emersi nelle chiamate monolitiche, la generazione long-form adotta una pipeline composita a 6 stadi orchestrata deterministicamente:
`Plan (Remote Call 1) → Bounded Sections (Remote Calls 2..N) → Assembly (Deterministic Local) → Local & Policy Checks (Deterministic/oMLX) → Bounded Repair (max 1 retry mirato) → Human Review (L3 Prepare)`.
Nessun agent framework opaco, nessun loop autonomo illimitato.

## 11. Gestione dei Cataloghi Dinamici dei Provider

**Vincolo aggiuntivo sulle capacità di reasoning.** `reasoning_effort` e analoghi parametri non costituiscono un insieme fisso universalmente supportato. Un adapter deve ricavare per provider/modello le capacità e i valori realmente dichiarati dal catalogo e/o verificati tramite probe; in assenza di evidenza registra `UNKNOWN` anziché assumere livelli come `low`, `medium`, `high`. Un override docente di reasoning è una *preferenza da negoziare*, non un comando sempre applicabile: il selector lo valida contro il descrittore effettivo e produce un errore/avviso esplicito o una scelta alternativa consentita dalla policy, mai una sostituzione silenziosa. Gli esempi YAML e JSON di questo documento non impongono capacità o disponibilità ai modelli nominati.

Il registry è interamente **provider-agnostic**:
1. Nessuna lista fissa o hardcoded di provider (GPT, Gemini, Claude, Mistral) risiede nel dominio;
2. Gli adapter estraggono periodicamente i metadati dal gateway e aggiornano il catalogo locale;
3. Se un nuovo fornitore o una nuova famiglia di modelli viene aggiunta ad OmniRoute (es. nuovi modelli open-weight ospitati su server remoto), essi appaiono nello stato `DISCOVERED` nel catalogo del Teacher Service;
4. Il Teacher Service supporta nativamente la sostituzione trasparente: un modello appena rilasciato può essere testato contro la suite di validazione del profilo di riferimento e, una volta convalidato, impostato come default senza toccare una singola riga di codice applicativo.

---

## 12. Validazione e Benchmark per Profilo (Non Globale)

I modelli non vengono valutati con un generico "punteggio medio di intelligenza", bensì **rigorosamente per specifico profilo di utilizzo**.

### 12.1 Suite di Regressione per Profilo
- **`remote.longform` -> Teacher Script Evaluation Rubric:**
  - Tenuta temporale e verbale (minimo 3.000–4.000 parole coerenti);
  - Assenza di filler tautologico o frasi a vuoto;
  - Fedeltà didattica al Source Set (grounding rigoroso);
  - Registro pedagogico appropriato per la classe.
- **`remote.generation` -> Lesson Plan & Student Material Rubric:**
  - Aderenza ai vincoli temporali del piano didattico;
  - Distinzione netta tra guida per il docente e scheda per lo studente;
  - Rigoroso rispetto dello schema JSON di output.
- **`remote.reasoning` -> Assessment & Competence Rubric:**
  - Coerenza tra obiettivi didattici, quesiti e griglie di correzione;
  - Assenza di ambiguità concettuali;
  - Correttezza logico-formale della chiave di risposta.
- **`local.semantic_small` -> Bounded Extraction & Quality Test:**
  - Accuratezza nell’estrazione di campi strutturati brevi;
  - Basso tasso di allucinazione su schemi vincolati;
  - Latenza < 1.000 ms.
- **`local.embedding` -> Gold Set Retrieval Accuracy:**
  - Recall@k e MRR sulle query del corpus reale (validazione B2);
  - Resilienza a query negative/confondibili.

### 12.2 Indipendenza della Validazione
Un modello può essere validato per un profilo e contemporaneamente respinto per un altro:
> *Esempio reale:*  
> Il modello **MiniCPM5-2B-MLX** è:
> - `VALIDATED` ed `ELIGIBLE` per `local.semantic_small` (ottimo per piccole estrazioni locali veloci);
> - `REJECTED_FOR_PROFILE` per `remote.longform` (incapace di sostenere un Teacher Script completo).

---

### 12.3 Disciplina di Preflight e Selezione Coorte (Gate C v2)
Per garantire che disservizi d'infrastruttura non invalidino i test, l'ammissione al benchmark segue tre livelli distinti:
`Catalog Candidate → Protocol & Identity Probe → Benchmark Cohort`.
Una route che fallisce la probe iniziale (HTTP 5xx, keepalive, mancata corrispondenza model ID, mancato supporto JSON Schema) viene marcata `UNAVAILABLE_FOR_TEST` e **non consuma slot della matrice**. La coorte deve comprendere 3 route realmente invocabili e verificate. Durante la run di benchmark, il fallback tra modelli è categoricamente disattivato.

## 13. Policy e Architettura dei Fallback

I fallback non devono mai essere impliciti o imprevisti. L'architettura prevede tre modalità esplicite:

### 13.1 Modalità di Fallback
1. **`AUTO` (Automatico):**
   - Ammesso solo tra risorse **semanticamente equivalenti e già validate per lo stesso profilo**, oppure verso un metodo degradato esplicitamente verificato a monte;
   - *Esempio 1 (Local Dense -> Lexical):* Se il servizio di embedding locale (oMLX) non risponde o fallisce, il sistema effettua il fallback **automatico su SQLite FTS5 lessicale**. Questo fallback è pienamente legittimo perché la ricerca lessicale è locale, privata e la sua accuratezza è già stata misurata in B2;
   - *Esempio 2 (Remote Model -> Backup Remote Model):* Se il modello primario per `remote.longform` restituisce errore 5xx o timeout, il gateway può reindirizzare automaticamente su un modello secondario **anch’esso convalidato come ELIGIBLE per `remote.longform`** e avente profilo di costo/privacy comparabile.
2. **`APPROVAL_REQUIRED` (Richiede conferma docente):**
   - Applicato quando il fallback comporta un cambio di classe di costo, una degradazione sensibile della qualità attesa, o l'attivazione di un provider con condizioni d'uso differenti;
   - L'applicazione sospende l'esecuzione, registra l'accaduto e chiede esplicitamente al docente: *"Il generatore primario non è disponibile; desideri procedere con il modello alternativo [Nome] oppure attendere?"*.
3. **`FORBIDDEN` (Assolutamente vietato):**
   - **Nessun downgrade silenzioso Remote -> Small Local:** Se il servizio remoto non è disponibile, il sistema **NON deve ripiegare silenziosamente su un modello locale 2B** tentando di generare il Teacher Script. Come dimostrato in B3/B5, il modello locale produrrebbe un output inadeguato violando la promessa di qualità del prodotto. L'azione corretta è notificare l'indisponibilità;
   - **Nessun fallback Locale/Privato -> Remoto/Cloud per Dati Riservati:** Come stabilito nel Dossier 11 (§8), i dati classificati come `Restricted` (accomodamenti, situazioni personali, note di disciplina) non possono **in nessun caso** essere instradati all'esterno in caso di guasto dei servizi locali. Se il servizio locale fallisce, l'operazione viene interrotta con errore bloccante.

---

## 14. Piano di Validazione Successivo (Nuovo Feasibility Gate)

Alla luce delle decisioni approvate, viene formalizzato il piano operativo per i prossimi test di validazione, superando i limiti del precedente test local-only.

### 14.1 Fasi del Nuovo Gate

#### Fase A — Catalog Discovery Test
- **Obiettivo:** Verificare l'ingestione e la normalizzazione automatica dei cataloghi dinamici;
- **Verifiche:**
  - Query verso OmniRoute `/v1/models` e parsing dell'elenco modelli;
  - Query verso oMLX `/v1/models` e rilevamento pesi locali;
  - Popolamento del registro con i descrittori normalizzati (`ModelDescriptor`);
  - Verifica della corretta assegnazione iniziale degli stati di lifecycle (`DISCOVERED`, `COMPATIBLE`).

#### Fase B — Local Capability Validation (Bounded Tasks)
- **Obiettivo:** Validare i modelli locali esclusivamente sui compiti delimitati per cui sono idonei;
- **Verifiche:**
  - Test di estrazione metadati didattici con schema JSON rigido su oMLX;
  - Test di bounded semantic check (anomalie, rilevanza come solo suggerimento);
  - Esclusione esplicita di test di generazione long-form su modelli piccoli.

#### Fase C — Remote Generation Benchmark (Profiles Evaluation)
- **Obiettivo:** Selezionare 2–3 modelli remoti candidati dal catalogo OmniRoute attuale (es. modelli basati su GPT e Gemini) e sottoporli alla suite di benchmark per profilo;
- **Verifiche:**
  - Valutazione del profilo `remote.longform` sui casi di Teacher Script del corpus reale;
  - Valutazione del profilo `remote.generation` su Lesson Plan e Student Material;
  - Valutazione del profilo `remote.reasoning` sulla progettazione di assessment coerenti;
  - Assegnazione dello stato `VALIDATED` ed `ELIGIBLE` ai modelli che superano le soglie didattiche.

#### Fase D — Revised End-to-End T1
- **Obiettivo:** Dimostrare la completa integrazione della pipeline T1 secondo la nuova architettura ibrida;
- **Flusso validato:**
  1. Materiali reali del docente -> parsing con Marker (PDF) e MinerU (Office);
  2. Indicizzazione e retrieval -> SQLite FTS5 (lessicale) + Qwen3 su oMLX (denso);
  3. Costruzione del Source Set validato e tracciato;
  4. Generazione guidata -> invocazione del profilo `remote.longform` / `remote.generation` via OmniRoute;
  5. Governance e Automation -> output generato in stato di bozza controllata (D08: L3 Prepare);
  6. Provenance completa -> tracciamento rigoroso di chunk usati, prompt versionato, modello eseguito e selection trace;
  7. Teacher Review -> revisione, correzione e approvazione finale da parte del docente.

---

## 15. Conclusioni e Impatto sui Dossier Successivi

Il presente assetto architetturale:
1. **Risolve l'impasse dei benchmark B3/B5**, riconoscendo il valore della prova empirica e collocando la generazione pesante sui nodi remoti capaci;
2. **Preserva l'indipendenza e la privacy del core**, garantendo che la gestione documentale, l'indicizzazione e il governo dei dati restino controllati localmente;
3. **Fornisce le fondamenta dirette per il Dossier 12 (Platform Architecture)**, che potrà progettare i componenti software e i contratti API senza ambiguità di ruoli o dipendenze premature da singoli modelli di mercato.
