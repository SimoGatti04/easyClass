# AI Routing, Model Registry & Architecture Redesign Report

> **Stato:** Formalmente approvato  
> **Ruolo:** AI Platform Architect  
> **Data:** 30 settembre 2026 (Europe/Rome)  
> **Task:** Redesign architetturale di routing, registry e capability AI a valle dei benchmark B1–B6  
> **Workspace:** `~/Workspace/teacher-service-design`

---

## 1. Executive Summary e Decisioni Formalizzate

A valle dell'esecuzione dei benchmark di fattibilità tecnica B1–B6, è stato effettuato il completo riallineamento architetturale dell'AI Platform del Teacher Service.

### 1.1 Decisioni di Prodotto Approvate
1. **Generazione didattica complessa assegnata ai Modelli Remoti:** Il Teacher Service **non richiede** che piccoli modelli compatti locali (2B–9B) generino autonomamente Teacher Script estesi da un'ora di lezione, sintesi enciclopediche multi-documento o verifiche complesse. La generazione long-form e ad alto carico cognitivo è responsabilità primaria dei **Modelli Generali e di Reasoning Remoti** accessibili tramite gateway OmniRoute;
2. **Sovranità Locale e Bounded Tasks per il Runtime Locale:** Il runtime locale è riservato a compiti specialistici e deterministici dove garantisce zero latenza di rete, sovranità e privacy assoluta:
   - Ingestion documentale (Marker per PDF, MinerU per formati Office);
   - Indicizzazione lessicale e vettoriale (SQLite FTS5 + Qwen3-Embedding-0.6B su oMLX);
   - Retrieval ibrido e deduplicazione;
   - Controlli di schema (Pydantic / JSON Schema) e policy di automazione (Dossier 08);
   - Bounded semantic checks e piccole estrazioni strutturate;
   - Eventuali bozze rapide o sintesi preliminari chiaramente etichettate come provvisorie;
3. **Gerarchia di Risoluzione del Minimo Livello Sufficiente:** L'architettura adotta la regola ferrea di usare il primo livello sufficiente ed economico:
   `Deterministic/Rules → Algorithm/Search/Similarity → Specialist/Local Small Model → Remote General/Reasoning Model → Human Authority (Teacher Review & Approval)`;
4. **Nessun Hardcoding di Model ID:** Il dominio applicativo richiede **Profili e Capability astratte** (`local.*`, `remote.*`), mai identificatori fisici o prefissi commerciali (`agy/gemini-...`, `cx/gpt-...`, `MiniCPM...`);
5. **Routing Deterministico e Trasparente:** Il Model Selector è un algoritmo software puro basato su Task Model Policy e regole di governance (nessun LLM router, nessun decision model come selector).

---

## 2. Correzione dell'Interpretazione dei Benchmark B3 e B5

Nei precedenti report B3 (`validation/results/B3-models-report.md`) e B5–B6 (`validation/results/B5-B6-integration-report.md`), l'esito era stato registrato come `CONDITIONAL` e `NOT YET FEASIBLE` poiché i modelli locali testati (MiniCPM5-2B-MLX e Ornith-1.5-9B) avevano fallito la generazione autonoma del Teacher Script di classe.

### 2.1 Reinterpretazione Formale dei Risultati
- **I risultati B3 e B5 sono validi e preziosi:** Hanno provato empiricamente che i modelli 2B–9B attuali producono risposte frammentate, filler tautologico e troncamenti su generazioni long-form estese. Averlo dimostrato ha impedito di costruire il prodotto su fondamenta fragili;
- **Nessuna infattibilità del Teacher Service o di T1:** L'esito negativo era legato a un criterio di accettazione preliminare (*"100% local-only end-to-end compresa la generazione long-form"*) che eccedeva le reali necessità didattiche del prodotto;
- **I report storici rimangono intatti:** I file `validation/results/B1`..`B6` restano immutati come evidenza storica nei log del progetto.

### 2.2 Nuova Acceptance Condition per T1
Per dichiarare tecnicamente fattibile l'architettura T1:
1. Parsing, indicizzazione, storage privato, retrieval vettoriale e controlli operano in locale/privato;
2. Heavy generation didattica (Teacher Script, Lesson Plan, schede studenti) opera tramite modelli remoti via gateway;
3. Nessuna API, provider o modello commerciale specifico costituisce dipendenza diretta del dominio;
4. La Teacher Review e l'Automation Policy (livello L3 Prepare: bozza controllata) restano obbligatorie per ogni materiale generato;
5. Nessun fallback locale $ightarrow$ remoto o cross-provider è consentito in modo implicito quando la riservatezza dei dati (D11) lo vieta.

---

## 3. File Modificati e Creati

Tutte le modifiche sono state apportate all'interno di `~/Workspace/teacher-service-design/`:

1. **`docs/ai/model-routing-and-registry.md` (CREATO):**  
   Nuovo documento architetturale canonico che definisce la Capability Matrix, i Model Profiles, il Model Catalog dinamico, il Model Lifecycle formale, il Model Selector deterministico, la gestione dei fallback e il confine esagonale con OmniRoute. Guiderà direttamente il futuro Dossier 12;
2. **`docs/dossiers/10-ai-architecture.md` (MODIFICATO):**  
   - Aggiornate le Sezioni 8, 9, 10 per riflettere il Model Catalog dinamico, il Model Selector deterministico e i profili standard (`local.*`, `remote.*`);
   - Aggiornata la Sezione 11 per formalizzare la porta astratta `RemoteModelGateway` e l'isolamento credenziali;
   - Aggiornata la Sezione 14.1 per circoscrivere rigorosamente il ruolo di Rizzo Flow a compiti *SUGGEST ONLY* di recall expansion, escludendolo dal routing e dai filtri escludenti;
   - Consolidato lo stack T1 (Sezione 98) integrando le baseline convalidate in B1 (Marker per PDF, MinerU per Office), B2 (Qwen3 su oMLX + SQLite FTS5) e l'accesso remoto via OmniRoute;
   - Allineate le decisioni approvate (Sezione 101) e lo stato del dossier (Sezione 104);
3. **`docs/validation/00-feasibility-benchmark-gate.md` (MODIFICATO):**  
   - Aggiornate le domande di principio (Sezione 1);
   - Formalizzato l'esito CONDITIONAL di B3 e la correzione di confine (Sezione 21);
   - Riscritto il gate di accettazione T1 (Sezione 28) superando il vincolo local-only rigido;
   - Aggiunta la Sezione 36 con la sequenza del nuovo gate di validazione a 4 fasi (A, B, C, D);
4. **`validation/results/AI-routing-redesign-report.md` (CREATO):**  
   Il presente report finale di sintesi e governance architetturale.

---

## 4. Local / Remote Capability Matrix Canonica

| Capability | Classe di Esecuzione | Metodo Default | Limite / Fallback Boundary | Remoto Consentito? | Approvazione Umana Obbligatoria? | Note Architetturali |
|---|---|---|---|---|---|---|
| **File Type Detection** | Deterministic Local | Ispezione MIME / magic bytes / estensione | Fallback su euristica header | **NO** | NO | Regole deterministiche a 0.02 ms con 100% accuratezza (B4). |
| **Schema Validation** | Deterministic Local | Validatore Pydantic / JSON Schema | Rigetto esplicito dell'output / eccezione | **NO** | NO | Eseguita su ogni output prima di toccare il dominio. |
| **Automation Policy Evaluation** | Deterministic Local | Motore di regole e precondizioni D08 | Blocco esecuzione e routing in Review Inbox | **NO** | NO | Valuta trust ramp, prerequisiti e vincoli applicativi. |
| **Duration / Structure Arithmetic** | Deterministic Local | Calcolo algebrico su minutaggi/sezioni | Segnalazione scostamento temporale | **NO** | NO | Somma minuti fasi lezione, vincoli orario. |
| **Document Ingestion (PDF)** | Specialist Local | Marker (`marker-pdf` su MPS Apple Silicon) | Fallback MinerU (con log di degradazione) | NO (default) | NO | Validato in B1: Marker superiore su resa testo/formule PDF. |
| **Document Ingestion (Office/XLSX/DOCX)** | Specialist Local | MinerU (`hybrid-engine` locale) | Errore formattazione non supportata | NO (default) | NO | Validato in B1: MinerU gestisce DOCX/PPTX/XLSX. |
| **Text Chunking** | Deterministic Local | Structure-aware Markdown/Doc chunker | Fallback su sliding window con overlap | **NO** | NO | Basato su gerarchia titoli (#, ##) e blocchi logici. |
| **Text Indexing (Lexical)** | Deterministic Local | SQLite FTS5 (BM25 + prefix matching) | Ricerca testuale semplice LIKE / exact match | **NO** | NO | Fondazione privata a zero dipendenze esterne. |
| **Dense Embeddings** | Specialist Local | Qwen3-Embedding-0.6B su oMLX (locale) | **AUTO fallback su SQLite FTS5 lessicale** | Condizionale (solo se dati non Restricted) | NO | B2 ha validato Qwen3 su oMLX; FTS5 è fallback già testato. |
| **Reranking** | Specialist Local | Disabilitato di default / Qwen3-Reranker | Esclusione reranking (mantiene ranking B2) | NO | NO | B2 ha dimostrato che il reranker costa secondi e peggiora precisione. |
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
| **Accommodations / PEP / PDP** | Human Authority | **DOCENTE / REFERENTE INCLUSIONE** | Nessun fallback automatico consentito | **NO** (Divieto AI) | **SÌ (Autorità esclusiva)** | Dati Restricted; decisioni formali riservate al personale autorizzato. |

---

## 5. Model Profiles Stabili (Non Model ID)

Il codice di dominio non riferisce mai model slug fisici. Vengono definiti i seguenti profili canonici:

### 5.1 Profili LOCAL
- `local.embedding`: vettorizzazione per semantic retrieval (default candidato: `Qwen3-Embedding-0.6B` su oMLX);
- `local.semantic_small`: classificazioni delimitate e micro-estrazioni (default candidato: `MiniCPM5-2B` su oMLX);
- `local.reranker`: riordinamento fine opzionale (default candidato: `Qwen3-Reranker`, disattivato di default);
- `local.typed_decision`: decisioni logit categoriche a zero token (default candidato: `Spark-X2.5-4B` su Rizzo Flow);
- `local.document_pdf`: parsing PDF avanzato con formule (default candidato: `Marker`);
- `local.document_office`: parsing ibrido formati Office (default candidato: `MinerU`).

### 5.2 Profili REMOTE
- `remote.fast`: risposte a bassa latenza, interazioni veloci, suggerimenti;
- `remote.generation`: generazione didattica strutturata (Lesson Plan, Student Material);
- `remote.longform`: copioni didattici multi-ora (Teacher Script 45–60 minuti);
- `remote.reasoning`: progettazione verifiche complesse e reasoning curricolare;
- `remote.research`: acquisizione e sintesi multi-fonte web;
- `remote.multimodal`: comprensione immagini, layout e diagrammi didattici complessi.

---

## 6. Architettura del Model Catalog e Registry

1. **Catalogo Dinamico:** Rileva periodicamente i modelli disponibili tramite:
   - Endpoint OmniRoute `/v1/models` (modelli remoti LAN/WAN);
   - Endpoint oMLX `/v1/models` (pesi locali MLX montati su disco);
   - Manifest locali dei servizi specialistici;
2. **Schema Normalizzato `ModelDescriptor`:** Incapsula id, provider, location, finestre di contesto (fissate a 272k token da sincronizzazione per evitare overflow VRAM/context), output limits, supporto a JSON schema, tool calling e reasoning tiers (`low`, `medium`, `high`, `xhigh`, `max`);
3. **Declared vs. Observed Capability:** Una funzionalità dichiarata dal provider resta non fidata finché non supera il test empirico per uno specifico profilo.

---

## 7. Model Lifecycle

Il ciclo di vita di ogni modello è governato da una macchina a stati esplicita:
```text
DISCOVERED → COMPATIBLE → VALIDATED → ELIGIBLE → DEFAULT_FOR_PROFILE
```
- **Nessun Auto-Default:** La scoperta automatica inserisce il modello in `DISCOVERED`. Solo il superamento del benchmark di profilo porta a `VALIDATED`/`ELIGIBLE`. La promozione a `DEFAULT_FOR_PROFILE` è una configurazione amministrativa esplicita;
- **Stati di Eccezione:** `REJECTED_FOR_PROFILE` (respinto per uno specifico profilo), `DEPRECATED` (non riassegnabile ma conservato per storico), `UNAVAILABLE` (offline agli health-check);
- **Tracciabilità della Provenance:** I metadati storici non vengono mai distrutti per garantire la riproducibilità degli artefatti generati nel tempo.

---

## 8. Task Model Policy Model

Ogni task di dominio possiede una **Task Model Policy** dichiarativa che definisce:
- Profilo richiesto (es. `remote.longform` per `teacher_script.generate`);
- Requisito di esecuzione (`LOCAL_ONLY`, `REMOTE_PREFERRED`, `DETERMINISTIC_ONLY`);
- Funzionalità tecniche indispensabili (structured output, context window minima);
- Classi di riservatezza dati consentite (Dossier 11);
- Comportamento di fallback (`AUTO`, `APPROVAL_REQUIRED`, `FORBIDDEN`).

---

## 9. Model Selector Deterministico

Il selector risolve la policy ed esegue una sequenza a 8 stadi a costo zero e latenza sub-millisecondo:
1. Lookup della Task Model Policy;
2. Scansione modelli attivi dal catalogo;
3. Hard Capability Filter (scarta modelli privi delle feature obbligatorie);
4. Privacy Filter D11 (elimina modelli esterni se i dati sono Restricted o privi di consenso);
5. Validation/Lifecycle Filter (ammette solo modelli `VALIDATED` ed `ELIGIBLE`);
6. Configuration Resolution D09 (valuta override di tenant, docente o one-off verificandone l'autorità);
7. Multi-Criteria Ranking (ordina per default esplicito, qualità osservata, costo, latenza);
8. Emissione del modello selezionato e della `Selection Trace` strutturata per l'Audit Log.

**Divieto esplicito:** Vietato l'uso di LLM router o di Rizzo Flow come selettori di modelli.

---

## 10. Gateway Remoto e Confine OmniRoute

1. **Architettura Esagonale:** Il dominio interagisce con la porta astratta `RemoteModelGateway`. `OmniRouteGatewayAdapter` è un dettaglio implementativo del layer infrastrutturale;
2. **Isolamento delle Credenziali dei Vendor:** Le credenziali verso Google, OpenAI, Anthropic risiedono esclusivamente all'interno di OmniRoute. Il Teacher Service dialoga con OmniRoute utilizzando unicamente la propria `OMNIROUTE_API_KEY`;
3. **Gestione Segreti:** Nessuna API key nei file Git. Le chiavi vengono iniettate tramite variabili d'ambiente o lette da secret store protetto dell'host.

---

## 11. Policy e Architettura dei Fallback

1. **`AUTO`:** Solo tra risorse semanticamente equivalenti e già validate per lo stesso profilo (es. modello primario `remote.longform` guasto $ightarrow$ backup `remote.longform` convalidato), oppure da embedding denso locale a SQLite FTS5 lessicale;
2. **`APPROVAL_REQUIRED`:** Richiede conferma esplicita del docente se il fallback comporta variazioni sensibili di costo, cambio provider o degradazione qualitativa;
3. **`FORBIDDEN`:**
   - **Nessun downgrade silenzioso Remote $ightarrow$ Small Local:** Se il modello remoto non risponde, è vietato ripiegare silenziosamente su un modello locale 2B per generare il Teacher Script (produrrebbe testo degradato);
   - **Nessun fallback Locale $ightarrow$ Cloud per Dati Riservati:** I dati `Restricted` non possono mai lasciare l'ambiente privato in caso di guasto locale.

---

## 12. Nuova Sequenza Operativa di Validazione (Revised Gate)

Viene formalizzata la sequenza operativa per i successivi test empirici (senza eseguirli prematuramente in questa fase di architettura):
- **Fase A — Catalog Discovery Test:** Ingestione dinamica di `/v1/models` da OmniRoute e oMLX, normalizzazione in `ModelDescriptor`, verifica del ciclo di vita;
- **Fase B — Local Capability Validation:** Verifica dei modelli locali unicamente sui task delimitati e bounded per cui sono adatti (estrazioni brevi, controlli);
- **Fase C — Remote Generation Benchmark:** Benchmark su 2–3 modelli remoti del catalogo OmniRoute per i profili `remote.generation`, `remote.longform` e `remote.reasoning`;
- **Fase D — Revised End-to-End T1:** Test integrato della pipeline T1 (parsing locale Marker/MinerU $ightarrow$ embedding locale Qwen3 + FTS5 lessicale $ightarrow$ Source Set $ightarrow$ generazione remota via OmniRoute $ightarrow$ provenance tracciata $ightarrow$ review e approvazione docente).

---

## 13. Questioni Aperte per il Dossier 12 (Platform Architecture)

1. **Frequenza di Sincronizzazione del Catalogo Dinamico:** Stabilire se la sincronizzazione con OmniRoute ed oMLX debba avvenire all'avvio del servizio con aggiornamenti periodici in background (es. ogni 15 minuti) o on-demand su segnale;
2. **Storage per Selection Trace e Provenance:** Definire lo schema relazionale delle tabelle di persistenza per le tracce di selezione e per l'Audit Log (Dossier 11);
3. **Health-Check e Circuit Breaker:** Definire le soglie operative (numero di timeout o errori 5xx consecutivi) che fanno scattare la transizione di un modello verso lo stato `UNAVAILABLE`;
4. **Convenzione delle Variabili d'Ambiente di Runtime:** Formalizzare nel file di configurazione del deployment le chiavi standard (`TEACHER_SERVICE_OMNIROUTE_URL`, `TEACHER_SERVICE_OMNIROUTE_KEY`, `TEACHER_SERVICE_OMLX_URL`).
