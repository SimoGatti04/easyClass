# Dossier 10 — AI Architecture

> Stato: proposta research-backed, non ancora approvata
>
> Research snapshot: 26 settembre 2026
>
> Questo dossier deriva dai requisiti consolidati nei Dossier 01–09. Le tecnologie concrete indicate qui sono shortlist da benchmarkare, non dipendenze già approvate.

## 1. Domanda centrale

Come usare AI, modelli e strumenti AI-adjacent per ridurre realmente il lavoro del docente mantenendo qualità, verificabilità, controllo, provenance, sicurezza, sostituibilità e compatibilità con il vincolo free/self-hostable del core?

La domanda non è "quale LLM useremo?". La domanda corretta è:

> Per ogni capability del prodotto, quale combinazione di regole, algoritmi, retrieval, modelli specializzati, LLM e strumenti produce il miglior risultato pratico con il minor costo e la massima verificabilità?

## 2. Principio fondamentale

L'AI non deve essere il dominio.

La struttura proposta è:

~~~text
DOMAIN
+ CANONICAL STATE
+ CONFIGURATION
+ AUTOMATION POLICY
        ↓
AI CAPABILITY PORTS
        ↓
IMPLEMENTATION / ROUTING
        ↓
MODEL / TOOL / SERVICE / ALGORITHM
~~~

Una Lesson non appartiene al modello. Un Assessment non appartiene all'agente. Una Grade Policy non vive nel prompt.

L'AI riceve richieste strutturate dal dominio e restituisce output derivati, proposte, estrazioni o valutazioni entro contratti precisi.

## 3. AI come capability layer, non come LLM service

Propongo un AI Capability Layer con porte applicative stabili.

Capability candidate:

- GenerateNarrative
- GenerateStructured
- ClassifySemantic
- ExtractStructured
- Embed
- Rerank
- Retrieve
- ParseDocument
- OCR
- UnderstandImage
- TranscribeAudio
- SearchWeb
- FetchWebContent
- BrowseInteractively
- ExecuteCode
- EvaluateResponse
- CompareSimilarity
- CheckGrounding

Il dominio dipende da queste capability, non da Qwen, Gemma, Mistral, gpt-oss, Ollama, vLLM, Docling, Qdrant o altri prodotti.

## 4. Perché questa separazione è necessaria

Nel 2026 l'ecosistema cambia troppo rapidamente per rendere un modello o un framework parte della foundation.

Modelli open-weight, runtime, parser, embedding/reranker, framework agentici, protocolli tool e piattaforme di evaluation stanno evolvendo indipendentemente. La sostituibilità non è quindi un'astrazione teorica: è un requisito operativo.

## 5. Principio di scelta per task

Ordine di preferenza concettuale:

~~~text
1. deterministic / rule based
2. algorithmic / search / similarity
3. specialized small model
4. general local model
5. larger local/server model
6. optional external provider
7. human review
~~~

Non significa che ogni task attraversi tutti i livelli. Significa usare il metodo meno complesso, meno costoso e più verificabile che soddisfa bene il requisito.

Esempi:

- hash duplicate → hashing;
- multiple choice grading → deterministic;
- SQL correctness → isolated execution + tests;
- semantic retrieval → embedding + reranking;
- Teacher Script → LLM;
- open-answer evaluation → rubric + evidence + LLM/checker hybrid;
- send communication → application action + approval.

## 6. Il modello non decide autonomamente le azioni applicative

Un modello può proporre una ActionIntent strutturata, ma l'Application/Automation Layer:

1. valida lo schema;
2. risolve Configuration;
3. controlla autorizzazioni;
4. applica hard constraints;
5. valuta Automation Policy;
6. esegue o genera ReviewItem.

MODEL OUTPUT non equivale ad APPLICATION AUTHORITY.

Questo vale per UI, agenti interni, API e MCP.

# Parte I — Routing e contratti

## 7. AI Request

Una richiesta interna dovrebbe poter descrivere almeno:

- capability;
- task/context;
- input references;
- required output schema;
- quality profile;
- latency profile;
- privacy/data class;
- allowed tools;
- source set;
- configuration snapshot;
- fallback policy.

Non tutti i campi servono in T1. Il punto è impedire che ogni feature chiami direttamente un modello con prompt arbitrari.

## 8. Capability Registry e Model Catalog Dinamico

Il sistema adotta un **Model Catalog e Capability Registry dinamico** (specificato in dettaglio nel documento canonico `docs/ai/model-routing-and-registry.md`), disaccoppiando completamente il dominio didattico dai modelli fisici.

Il registro:
1. Ingesta dinamicamente i modelli scoperti dai gateway (OmniRoute `/v1/models` per i remoti, oMLX `/v1/models` per i locali);
2. Normalizza ogni risorsa in un `ModelDescriptor` unificato con metadati tecnici, context window, supporto structured output, tool e reasoning;
3. Distingue rigorosamente tra **Declared Capability** (dichiarata dal fornitore) e **Observed Capability** (validata empiricamente sui benchmark interni);
4. Governa il **Model Lifecycle** formale:
   `DISCOVERED → COMPATIBLE → VALIDATED → ELIGIBLE → DEFAULT_FOR_PROFILE`
   (con stati di eccezione `REJECTED_FOR_PROFILE`, `DEPRECATED`, `UNAVAILABLE` preservando lo storico per la Provenance).

Nessun modello appena scoperto diventa automaticamente default di sistema: lo stato di default richiede configurazione esplicita e validazione superata per lo specifico profilo.

## 9. Routing Deterministico (Model Selector)

Il routing non deve trasformarsi in un ulteriore problema di intelligenza artificiale:
- **Nessun LLM Router:** non si utilizzano modelli generativi opachi per decidere quale modello invocare (evita latenza, allucinazioni e costi aggiuntivi);
- **Nessun Rizzo Selector:** come verificato empiricamente in B4, i decision model a classificazione pura non sono usati come selector dei modelli;
- **Algoritmo Deterministico:** il Model Selector opera come pipeline sequenziale trasparente a costo zero:
  `Task → Task Model Policy → Model Catalog → Hard Capability Filter → Privacy Filter (D11) → Validation/Lifecycle Filter → Configuration Overrides (D09) → Multi-Criteria Ranking → Modello Selezionato + Selection Trace`.

Il selector emette sempre una traccia di selezione esplicabile (`Selection Trace`) con i motivi di esclusione dei candidati e la catena di fallback.

## 10. Model Profiles (Non Model ID)

Il dominio applicativo richiede **Profili e Capability**, mai identificatori fisici (`agy/gemini-...`, `cx/gpt-...`, `MiniCPM...`). I model ID sono puri dati di configurazione e runtime.

I profili standard canonici sono divisi in due domini di esecuzione:

### Profili LOCAL
- `local.embedding`: indicizzazione e ricerca densa locale (default candidato: Qwen3-Embedding-0.6B su oMLX);
- `local.semantic_small`: piccole estrazioni strutturate, controlli di qualità e bounded check veloci (default candidato: MiniCPM5-2B su oMLX);
- `local.reranker`: riordinamento opzionale chunk (disattivato di default per policy B2);
- `local.typed_decision`: decisioni categoriche rigide zero-token (Rizzo Flow / Spark-X2.5 per task specifici validati);
- `local.document_pdf`: parsing documentale specialistico PDF/formule (Marker su MPS);
- `local.document_office`: parsing ibrido per formati Office DOCX/PPTX (MinerU locale);
- `local.document_spreadsheet`: parsing deterministico strutturato cell-aware per XLSX (fogli, celle, formule native) tramite `CellAwareSpreadsheetAdapter` locale.

### Profili REMOTE
- `remote.fast`: risposte a bassa latenza, correzioni veloci, suggerimenti interattivi;
- `remote.generation`: generazione didattica generale (Lesson Plan, spiegazioni strutturate, schede studenti differenziate);
- `remote.longform`: generazione di copioni didattici estesi (Teacher Script 45–60 minuti) con tenuta narrativa e grounding, orchestrata tramite pipeline composita a sezioni vincolate (Plan → Bounded Sections → Assembly → Local Checks → Bounded Repair → Human Review);
- `remote.reasoning`: progettazione di verifiche complesse, sintesi curricolari e allineamento competenze con thinking attivo;
- `remote.research`: acquisizione, comparazione e sintesi multi-fonte esterna/web;
- `remote.multimodal`: comprensione avanzata di diagrammi, grafici complessi e layout visuali non strutturati.

## 11. Provider/runtime independence e Gateway Remoto

Il contratto applicativo è rigorosamente indipendente dal cloud e dai singoli vendor commerciali:
- Il core didattico governa sovranamente in locale/privato: ingestion documentale, storage, indicizzazione lessicale FTS5, embedding densi, controlli di schema e Automation Policy;
- La generazione complessa (Teacher Script, Lesson Plan estesi) si interfaccia con modelli remoti attraverso la porta architetturale astratta `RemoteModelGateway`;
- L'infrastruttura iniziale adotta **OmniRoute** come adattatore (`OmniRouteGatewayAdapter`), ma il dominio non ha alcuna dipendenza diretta verso OmniRoute;
- **Isolamento credenziali:** Il Teacher Service possiede unicamente la credenziale del gateway locale/WAN (`OMNIROUTE_API_KEY`). Le credenziali dei singoli provider (Google, OpenAI, Anthropic) risiedono esclusivamente in OmniRoute e non sono note al Teacher Service;
- Nessuna chiave API viene inserita nei file versionati.

### 11.1 Responsabilità economica dei gateway opzionali

Per un gateway opzionale come OmniRoute, l'utente/Domain Owner è responsabile del proprio abbonamento, delle impostazioni di disponibilità/allow-list dei modelli e delle eventuali decisioni economiche applicate dal gateway. Teacher Service deve rispettare la configurazione dei modelli consentiti e verificare soltanto identità, disponibilità e capability tecniche necessarie alla richiesta. Non legge o verifica piani/billing dell'utente, non calcola stime economiche e non applica quote o hard cap monetari. Può registrare metriche tecniche disponibili (token, latenza, numero di richieste, retry ed errori) senza convertirle in controlli economici. I limiti tecnici espliciti di un esperimento restano circoscritti a quella prova e non diventano policy generali del prodotto.

# Parte II — Modelli general-purpose

## 12. Non scegliere un solo "modello ufficiale"

La ricerca aggiornata al 27 settembre 2026 rafforza l'idea di separare almeno tre fasce: modelli locali molto piccoli, modelli locali general-purpose più forti e modelli/API remoti opzionali.

La shortlist iniziale da benchmarkare viene aggiornata così.

### MiniCPM5-2B

È ora uno dei candidati principali per il ruolo **small local general model**.

OpenBMB ha rilasciato MiniCPM5-2B il 7 settembre 2026 come modello dense 2B orientato a deployment on-device/resource-constrained e pubblica direttamente varianti BF16, GGUF e MLX.

Nel development-environment esiste già una configurazione oMLX per `MiniCPM5-2B-MLX`, quindi deve entrare nel benchmark iniziale senza introdurre un nuovo runtime.

Possibili ruoli:

- classificazione/estrazione leggera;
- structured generation;
- tool-routing semplice;
- generazione rapida locale;
- fallback locale a basso consumo.

### Gemma 4 E2B / E4B

Gemma 4 E2B ed E4B sono candidati principali per la fascia **small/medium multimodal local**.

Sono modelli multimodali Apache-2.0 con varianti quantizzate/mobile-oriented disponibili. Nonostante i nomi E2B/E4B, il footprint totale dei checkpoint è maggiore della sola quota attiva, quindi vanno benchmarkati concretamente su Apple Silicon anziché giudicati solo dal numero E2B/E4B.

Possibili ruoli:

- multimodal reasoning;
- image/document understanding complementare al parser;
- general generation;
- structured/tool use.

### Altri small-model candidates

Mantenere aperta la shortlist a nuove release 1B–4B realmente competitive, includendo solo modelli che al momento del benchmark soddisfano:

- licenza compatibile;
- runtime locale disponibile;
- buona qualità italiana/multilingua;
- structured/tool reliability;
- footprint compatibile con l'hardware target.

Qwen/Ministral/altre famiglie restano candidati, ma non devono essere prese come default per inerzia se MiniCPM5/Gemma 4 o release più recenti risultano migliori.

### Local strong / server candidates

Per task più difficili possono entrare nel benchmark modelli locali/server più grandi, inclusi gpt-oss, Qwen più grandi, Mistral Small o equivalenti aggiornati.

### Remote/API models via OmniRoute

Per i modelli non locali il progetto può usare API opzionali.

Il development-environment dispone già di **OmniRoute** come gateway centralizzato OpenAI-compatible/Responses-compatible verso provider e modelli remoti, oltre che verso oMLX.

Quindi l'AI Capability Layer deve poter risolvere una stessa capability verso:

- oMLX locale/remoto;
- Ollama locale/remoto;
- OmniRoute;
- provider API diretto solo quando giustificato.

OmniRoute è un'infrastruttura disponibile, non una dependency obbligatoria del dominio.

## 13. Nessun benchmark vendor è la verità del progetto

Le classifiche pubbliche servono per costruire shortlist.

Il benchmark interno deve misurare:

- italiano naturale;
- qualità didattica;
- fedeltà alle fonti;
- long-form Teacher Script;
- structured outputs;
- tool calling;
- assessment generation;
- grading aperto;
- hallucination/error rate;
- latency;
- RAM/VRAM;
- quantization degradation.

## 14. Modelli diversi per compiti diversi

Esempio:

~~~text
material classification
→ small model / decision model

metadata extraction
→ parser / small model

Teacher Script multi-hour
→ stronger model

assessment equivalence review
→ stronger model or hybrid

semantic grading
→ specialized workflow
~~~

Non usare il modello più costoso per tutto.

## 14.1 Decision models / zero-generation semantic decisions (Evidenze B4)

La categoria dei **typed semantic decision services** (rappresentata nell'ambiente da **Rizzo Flow** basato su Spark-X2.5 4B Q8_0) è stata sottoposta a benchmark empirico rigoroso in B4 (`validation/results/B4-decisions-report.md`) su 116 casi reali derivati dal corpus.

Le evidenze hanno ridefinito e circoscritto con precisione il ruolo di Rizzo Flow nell'architettura:
1. **Regola del minimo livello sufficiente:** Dove una regola lessicale o un'ispezione deterministica (es. estensione file, nome documento, matching regex su materia) raggiunge accuratezza pari o superiore con latenza di ~0.02 ms, **la regola deterministica ha sempre la precedenza assoluta** (B4: Rizzo è risultato *NOT_USEFUL* per formato file e materia/classe rispetto alle regole base);
2. **Nessun ruolo di Model Selector:** Rizzo Flow **NON viene usato come model selector** per il routing delle chiamate AI;
3. **Ruolo validato — SUGGEST ONLY per espansione rilevanza:** Su compiti di rilevanza semantica delle fonti, Rizzo ha mostrato recall del 100% (superiore alle euristiche), ma con falsi positivi (precision 84.2%). Può essere impiegato come meccanismo *recall-first* per suggerire fonti al docente, ma **mai come filtro escludente automatico**;
4. **Principio di proporzionalità:** Non introdurre inferenza neurale locale dove una logica deterministica semplice è sufficiente e più veloce.

# Parte III — Inference runtime

## 15. oMLX — runtime Apple Silicon principale disponibile

Nel development-environment **oMLX è già installato e operativo** come servizio di inferenza MLX ad alte prestazioni.

Espone API HTTP OpenAI-compatible per:

- chat/completions;
- embeddings;
- reranking.

È configurato su `0.0.0.0`, quindi non è intrinsecamente vincolato allo stesso processo o alla stessa macchina del Teacher Service.

Ruolo proposto:

- runtime preferenziale per modelli MLX su Apple Silicon;
- embeddings/reranking MLX;
- general local inference;
- servizio remoto in LAN/VPN quando opportuno.

Il dominio non deve comunque dipendere da oMLX: resta un adapter di runtime.

## 16. Ollama

Ollama è già presente nell'ambiente ed è il secondo runtime locale naturale.

Ruolo:

- modelli GGUF/non-MLX;
- installazione e lifecycle semplici;
- fallback/runtime alternativo;
- deployment su macchine differenti quando disponibile via rete.

Non deve diventare l'API canonica del dominio.

## 17. llama.cpp

Rimane importante soprattutto come runtime sottostante/specialistico per GGUF e per servizi dedicati.

Nel development-environment è già usato da Rizzo Flow.

Non serve necessariamente esporlo direttamente al Teacher Service quando una capability è già fornita da oMLX, Ollama o da un servizio specialistico.

## 18. vLLM / SGLang

Restano candidati per macchine GPU server non Apple o deployment con alto throughput.

La scelta va fatta solo quando esiste effettivamente una macchina/workload che ne giustifica l'introduzione.

## 19. Strategia runtime proposta

~~~text
APPLE SILICON / MLX
→ oMLX

LOCAL GGUF / GENERAL FALLBACK
→ Ollama

SPECIALIZED SERVICE
→ Rizzo Flow / MinerU service adapter / sandbox / altri

REMOTE GPU SERVER
→ vLLM oppure SGLang quando giustificato

REMOTE/CLOUD MODELS
→ OmniRoute / provider adapters

APPLICATION
→ stable capability contracts
~~~

## 20. Gateway e deployment distribuito

OmniRoute è già disponibile come gateway per modelli remoti/API e può essere usato quando porta valore.

Non introdurrei un secondo gateway generico come LiteLLM finché OmniRoute + adapter interni coprono bene le necessità.

### Requisito fondamentale: componenti distribuibili su macchine diverse

Nessuna capability AI deve assumere che implementation e Teacher Service risiedano sulla stessa macchina.

Il contratto deve supportare:

~~~text
Teacher Service
      │
      ├── HTTP/API → oMLX su Mac Apple Silicon
      ├── HTTP/API → Rizzo Flow su altro host
      ├── HTTP/API → MinerU parsing worker
      ├── HTTP/API → retrieval service
      ├── HTTP/API → code sandbox
      └── HTTP/API → OmniRoute / provider remoto
~~~

Una implementation può essere anche in-process quando utile, ma **remote-capable è requisito architetturale**.

Ogni remote implementation deve poter dichiarare almeno:

- endpoint;
- capability/version;
- authentication;
- health/readiness;
- timeout;
- concurrency/capacity;
- data/privacy eligibility;
- supported schemas/modalities.

Il routing non deve distinguere semanticamente "localhost" da "altra macchina": vede una implementation registrata.

### Protocollo

Quando possibile preferire protocolli semplici e interoperabili:

- HTTP/JSON;
- OpenAI-compatible APIs per model inference dove appropriate;
- API capability-specific per servizi specialistici;
- MCP solo quando il problema è tool/resource interoperability, non come trasporto obbligatorio interno.

Tra macchine diverse vanno poi definiti nel Dossier Platform:

- TLS/VPN/LAN trust model;
- service discovery/configuration;
- secrets;
- retry/idempotency;
- bulk transfer/storage references per file grandi.

### Gateway evolution

LiteLLM o altri gateway restano opzioni future solo se introducono un beneficio misurabile che OmniRoute e gli adapter interni non coprono.

# Parte IV — Structured outputs e tool calling

## 21. Output strutturato come default per il dominio

Quando il codice deve consumare un output, preferire typed/JSON-schema output a testo libero.

Esempi:

- curriculum classification;
- assessment blueprint;
- material links;
- Criterion Evaluation;
- proposed actions;
- source selection;
- configuration proposals.

## 22. Validation multilayer

~~~text
MODEL
↓
constrained/native structured output
↓
schema validation
↓
domain validation
↓
application policy
~~~

Un JSON perfettamente valido può essere semanticamente errato.

## 23. XGrammar / constrained decoding

XGrammar è un candidato forte per JSON Schema, regex e grammar-constrained decoding ed è integrato in runtime moderni.

Ruolo:

- structural correctness.

Non garantisce semantic correctness.

## 24. Instructor

Candidato semplice per task schema-first:

- extraction;
- classification;
- typed responses;
- validation/retry.

Non serve come orchestratore generale.

## 25. Pydantic AI

Interessante per capability bounded grazie a typed tools, typed outputs, model/provider abstraction e integrazioni tool/MCP.

Possibile uso:

- bounded reasoning component;
- typed tool use.

Non deve diventare il proprietario dei workflow di dominio.

## 26. Plain Pydantic remains enough for many cases

Per molti task iniziali potrebbe bastare:

~~~text
provider call
→ JSON schema
→ Pydantic validation
→ domain validation
~~~

Non introdurre un framework agentico se non porta valore.

# Parte V — Document Intelligence

## 27. Il parser è una capability critica

Per il nostro prodotto document understanding può incidere sulla qualità più del generative model.

Materiali reali includono:

- PDF nativi;
- scansioni;
- slide;
- Word;
- spreadsheet;
- immagini;
- tabelle;
- formule;
- libri;
- dispense;
- email;
- layout complessi.

Una pipeline fragile a monte rende inutile un LLM eccellente a valle.

## 28. Pipeline ingestion proposta

~~~text
ORIGINAL FILE
↓
type detection
↓
fast native extraction when reliable
↓
layout-aware parser
↓
OCR / specialist fallback when needed
↓
normalized document representation
↓
quality checks
↓
indexing/chunking
~~~

L'originale resta preservato secondo Dossier 04.

## 29. MinerU — primary parser candidate

Dopo la ricerca aggiornata e l'inventario locale, **MinerU deve sostituire Docling come primo candidato da benchmarkare per il parser principale**.

La release 3.1 del 2026 ha aggiornato il modello VLM principale a MinerU2.5-Pro-2604-1.2B e supporta parsing nativo di immagini, PDF, DOCX, PPTX e XLSX, oltre a table/formula/image/chart understanding e gestione di strutture cross-page.

Nel development-environment MinerU è già installato con:

- backend `pipeline`;
- backend `vlm-engine`;
- backend `hybrid-engine`;
- OCR;
- formule;
- tabelle;
- image analysis;
- PDF/DOCX/PPTX/XLSX/immagini.

Quindi la baseline documentale deve partire da MinerU invece di aggiungere un parser nuovo per default.

## 30. Marker — second local parser candidate

Anche **Marker** è già installato localmente e supporta PDF/immagini/slide, formule, output Markdown/JSON/HTML/chunks e accelerazione MPS.

È un ottimo candidato secondario per:

- benchmark comparativo;
- fallback;
- casi in cui l'output strutturato JSON/chunks di Marker sia più utile del Markdown MinerU.

## 31. Docling / Tika / PaddleOCR

Restano opzioni da benchmarkare solo se coprono gap reali:

- Docling per rappresentazione documentale strutturata e interoperabilità;
- Tika per long-tail format detection/extraction;
- PaddleOCR per casi OCR/layout specialistici non coperti sufficientemente da MinerU.

Non introdurli automaticamente nel core.

## 32. Parser routing

Baseline proposta:

~~~text
simple/native extraction reliable
→ fast path

spreadsheet/workbook (XLSX)
→ CellAwareSpreadsheetAdapter (cell coordinates, formulas, sheet ranges)

complex office/PDF/image
→ MinerU hybrid

specific case where Marker scores better
→ Marker adapter

remaining gap
→ Docling / Tika / specialist OCR
~~~

Il routing deve essere guidato dai benchmark B1 e non dalla quantità di tool disponibili.

# Parte VI — Chunking e indexing

## 33. Il chunk non è la Resource

~~~text
Resource Version
↓
Normalized Document
↓
Chunk Set vN
↓
Embeddings vN
~~~

Chunk e embedding sono derived state rigenerabile.

## 34. Chunking versionato

Ogni chunk set significativo deve riferirsi a:

- Resource Version;
- parser/version;
- chunker/version;
- parameters;
- document structure/version.

Così possiamo cambiare chunking senza cambiare l'identità della Resource.

## 35. Structure-aware chunking

Quando utile, preferire confini:

- heading;
- section;
- slide;
- table;
- exercise;
- paragraph group;

rispetto a tagli fissi puramente token-based.

Il benchmark determinerà il guadagno reale.

# Parte VII — Retrieval

## 36. Retrieval non equivale a vector search

Il ranking deve poter combinare:

- exact/keyword match;
- semantic similarity;
- structured context;
- Curriculum links;
- class/subject;
- freshness;
- authority;
- teacher preferences;
- exclusions;
- usage history.

Retrieval è quindi una capability di dominio.

## 37. Pipeline retrieval proposta

~~~text
QUERY
↓
context enrichment
↓
candidate retrieval
  ├─ lexical / FTS
  ├─ dense semantic
  └─ structured filters
↓
fusion
↓
reranking
↓
domain ranking adjustments
↓
final evidence set
~~~

## 38. Embedding shortlist aggiornata

Prima di fissare il modello di embedding, la ricerca va estesa ai modelli piccoli/on-device più recenti e in particolare alle conversioni MLX.

### EmbeddingGemma 300M

Candidato molto forte per Apple Silicon/on-device:

- 308M parametri;
- oltre 100 lingue;
- dimensione output flessibile 768→128 tramite Matryoshka Representation Learning;
- progettato esplicitamente per telefoni/laptop/tablet;
- conversioni MLX community già disponibili a 4/6/8 bit.

È probabilmente il candidato più interessante da confrontare con Qwen quando memoria e throughput pesano molto.

### Qwen3-Embedding-0.6B

Resta candidato principale:

- Apache-2.0;
- multilingua;
- 32k context;
- conversioni MLX 8-bit e altre quantizzazioni già disponibili;
- è già utilizzato nell'ambiente locale tramite oMLX/chat-history-search.

Questo ultimo punto ci permette di partire da metriche e pipeline già esistenti invece di ricominciare da zero.

### Nomic Embed Text v2 MoE

Candidato da benchmarkare:

- ~0.5B;
- 100+ lingue;
- Apache-2.0;
- Matryoshka;
- MoE progettato per efficienza retrieval.

Va verificato specificamente il supporto/efficienza MLX rispetto ai primi due.

### Granite Embedding 278M Multilingual

Candidato molto leggero Apache-2.0 (~278M), interessante per footprint; supporta però un insieme linguistico più ristretto rispetto a EmbeddingGemma/Qwen/Nomic e quindi va verificata attentamente la qualità italiana.

### BGE-M3

Resta benchmark utile soprattutto per dense+sparse+multi-vector, ma non è automaticamente la scelta migliore per Apple Silicon o per il nostro target di piccole taglie.

### Regola

La decisione deve derivare da B2 Retrieval + B8 Runtime misurando almeno:

- italiano;
- recall;
- dimensione indice;
- ingestion throughput;
- query latency;
- RAM;
- MLX/oMLX compatibility;
- qualità dopo quantizzazione.

## 39. Reranking shortlist

Candidati:

- Qwen3-Reranker-0.6B;
- bge-reranker-v2-m3.

Il reranker opera su un candidate set limitato, non sull'intero corpus.

## 40. Retrieval platform research — AnythingLLM, Open WebUI, RAGFlow, Onyx

Prima di confermare lo storage/retrieval definitivo, abbiamo confrontato anche piattaforme RAG open source complete.

### AnythingLLM

È una piattaforma full-stack utile come riferimento per:

- workspace documentali;
- provider LLM/vector DB sostituibili;
- developer API;
- RAG/agent integration;
- deployment locale o remoto.

È però più un prodotto/harness completo che una primitive da incorporare nel nostro dominio.

### Open WebUI

È già installato nel development-environment.

La pipeline RAG corrente supporta:

- external vector DB;
- hybrid BM25 + vector;
- CrossEncoder reranking;
- configurable thresholds;
- filesystem-style knowledge access.

È molto utile come ambiente di test e come fonte di pattern, ma non deve diventare il knowledge domain del Teacher Service.

### RAGFlow

È il progetto più interessante da studiare per la parte **deep document understanding + ingestion + retrieval**.

Nel 2025–2026 ha aggiunto:

- MinerU e Docling come parser;
- orchestrable ingestion pipeline;
- agent/MCP;
- code executor;
- multimodal document understanding.

È però una piattaforma più pesante; la quickstart ufficiale resta principalmente orientata a Docker x86/NVIDIA e ARM richiede build dedicata.

### Onyx

È molto interessante come riferimento per knowledge sync/retrieval:

- connectors continuously indexed;
- hybrid search;
- reranking;
- multi-pass/contextual indexing;
- API/MCP;
- retrieval permission-aware nelle edizioni che lo supportano.

In particolare il pattern **indexed connectors rather than only live fetch** è rilevante per il nostro Material/Origin model.

### Conclusione

AnythingLLM/RAGFlow/Open WebUI/Onyx devono entrare nel **benchmark/reference study**, ma non adotterei nessuno di essi come core retrieval domain.

La nostra architettura ha requisiti più specifici:

- Resource/Version provenance;
- Curriculum/Class/Subject ranking;
- source authority;
- dependency graph;
- exact historical reconstruction.

Possiamo però riusare componenti o pattern se i benchmark dimostrano valore.

## 41. Storage/retrieval backend resta decisione aperta

PostgreSQL FTS + pgvector rimane una baseline molto sensata perché il dominio è fortemente relazionale e minimizza infrastruttura.

Ma prima dell'approvazione definitiva va confrontato almeno con:

- una pipeline semplice custom ispirata al già esistente chat-history-search;
- Qdrant;
- RAGFlow retrieval/context engine;
- Open WebUI external retrieval path;
- eventuali componenti Onyx riutilizzabili.

Il progetto locale `chat-history-search` è particolarmente rilevante: implementa già FTS5 + exact + dense retrieval + RRF + Qwen3 reranker con benchmark su corpus reale. Questa esperienza va trattata come asset interno e fonte di componenti/pattern riutilizzabili, non ignorata a favore di uno stack esterno.

# Parte VIII — Web research e acquisition

## 42. Web research separa più capability

~~~text
SEARCH
↓
candidate URLs

FETCH / BROWSE
↓
content

EXTRACT
↓
clean structured content

EVALUATE
↓
authority/relevance/freshness

USE / SAVE
~~~

Questa separazione migliora provenance e sostituibilità.

## 43. SearXNG — candidate search layer

SearXNG è un candidato self-hosted per discovery/aggregazione di motori.

Vantaggi:

- nessuna API search commerciale obbligatoria;
- provider sostituibili;
- self-hostable.

Caveat:

- gli upstream engine restano dipendenze esterne;
- affidabilità/rate-limit/ToS variano;
- licenza e modalità di deployment vanno valutate.

Va dietro un WebSearchProvider adapter.

## 44. Trafilatura — static extraction candidate

Per una normale pagina HTML:

~~~text
HTTP fetch
→ Trafilatura
→ normalized content
~~~

prima di aprire un browser completo.

## 45. Playwright — browser fallback

Usarlo quando:

- JavaScript è necessario;
- serve interazione;
- c'è login/session flow;
- pagina dinamica;
- download complesso.

Non come default per ogni URL.

## 46. Crawling frameworks

Crawlee, Crawl4AI e Firecrawl possono essere benchmarkati se serviranno crawl sistematici.

Non diventano foundation iniziali. Va considerato anche il costo operativo e, per alcuni progetti, il licensing.

# Parte IX — Code/SQL execution e grading verificabile

## 47. Execution separata dall'LLM

Per SQL, codice, formule eseguibili o output verificabili, l'LLM può preparare test o interpretare risultati, ma la verifica usa un runtime isolato quando possibile.

## 48. Judge0 CE

Candidato forte per general code grading:

- self-hosting;
- sandbox execution;
- molte lingue;
- resource limits.

Licenza e modalità operative vanno considerate nel packaging.

## 49. Piston

Alternativa più semplice, self-hostable. La public API non deve essere considerata parte del core: nel 2026 l'accesso pubblico è stato ristretto, quindi l'uso sensato per noi sarebbe self-hosted.

## 50. Wasmtime

Interessante per workload portabili a WebAssembly/WASI:

- sandboxing;
- resource controls;
- runtime leggero.

Non sostituisce necessariamente un runner general-purpose.

## 51. E2B

Interessante per future sessioni agentiche isolate tramite microVM/self-hosted stack.

Probabilmente troppo pesante come dipendenza iniziale, ma importante nella mappa delle opzioni.

## 52. Regola di sicurezza execution

Mai:

~~~text
LLM-generated code
→ host shell directly
~~~

Sempre:

~~~text
validated task
→ sandbox
→ resource limits
→ controlled filesystem/network
→ captured output
→ evaluator
~~~

# Parte X — Orchestrazione AI

## 53. Nessun super-agent centrale

I workflow sono già definiti da:

- Domain;
- Automation Action;
- Configuration;
- ReviewItem;
- dependency graph.

Non dobbiamo ricostruirli dentro un framework agentico.

## 54. Uso corretto dei framework agentic

Un framework può essere utile dentro una capability bounded.

Esempio:

~~~text
ResearchExternalSources

1. formulate search
2. search
3. inspect candidates
4. extract
5. verify
6. return SourceSetProposal
~~~

Il framework non decide se pubblicare, cambiare curriculum o modificare Final Grade.

## 55. Pydantic AI

Buon candidato per bounded typed agent loops.

## 56. Haystack

Buon candidato per RAG/pipeline modulari se riduce davvero codice e complessità.

## 57. LangGraph

Interessante per graph state, interrupt/resume e HITL, ma questi concetti sono già nel nostro Automation Model.

Usarlo solo come implementation engine se dimostra valore concreto.

## 58. Temporal e durable workflow engines

Potrebbero diventare utili per:

- ingestion lunga;
- bulk grading;
- large sync;
- durable multi-step automation.

Non introdurli in T1 senza bisogno reale.

# Parte XI — MCP e tool ecosystem

## 59. MCP come adapter standard

La specifica MCP 2026-07-28 rafforza il valore del protocollo come integrazione standard e ha introdotto un core stateless e aggiornamenti di authorization/extensions.

La nostra direzione resta:

~~~text
Teacher Service
        ↓
Application capabilities
        ↓
MCP adapter
        ↓
ChatGPT / altri client MCP
~~~

## 60. Future Teacher Service MCP Server

Possibili Resources:

- current week;
- class context;
- curriculum state;
- lesson summary;
- materials;
- assessment status.

Possibili Tools:

- prepare_lesson;
- search_materials;
- prepare_assessment;
- update_lesson;
- create_note;
- get_review_items.

I nomi sono esemplificativi.

Non esporre raw database operations.

## 61. MCP annotations non sono security boundary

Metadata come read-only/destructive/idempotent/external-effects sono utili, ma non sostituiscono:

- Authorization;
- Automation Policy;
- application validation;
- approval.

Il nostro Action Contract resta autorevole.

## 62. MCP client interno futuro

Il servizio può anche consumare MCP esterni per provider specifici.

Ogni MCP server/tool esterno viene però trattato come integrazione non fidata e con least privilege.

# Parte XII — Sicurezza AI

## 63. Contenuto esterno sempre untrusted

Trattare come non fidato:

- web;
- email;
- PDF;
- documenti caricati;
- risultati search;
- output tool esterni;
- MCP esterni.

Un documento che contiene istruzioni rivolte a un modello è contenuto, non una nuova istruzione applicativa.

## 64. Trust boundary

~~~text
UNTRUSTED CONTENT
      ↓
parse/extract/summarize
      ↓
structured data/evidence
      ↓
privileged application layer
      ↓
policy
      ↓
tool/action
~~~

Evitare:

~~~text
untrusted document
↓
privileged autonomous agent with all tools
~~~

## 65. Least privilege tools

Un modello vede solo gli strumenti necessari alla capability corrente.

Esempio:

- Material classifier → read resource metadata, no send-email, no modify-grade.
- External researcher → search/fetch, no grade write.

## 66. Action screening

Prima di tool call con side effect:

~~~text
original user/domain intent
+ proposed action
+ policy
→ deterministic/application validation
~~~

Il validation layer non dipende unicamente dal modello che propone l'azione.

## 67. Defense in depth contro prompt injection

Difese:

- separazione instructions/data;
- schema/structured outputs;
- least privilege;
- capability allowlists;
- URL/network restrictions dove utile;
- deterministic validation;
- approval high-impact/external;
- provenance/logging;
- red-team/evaluation.

Un singolo prompt-injection detector non è garanzia sufficiente.

## 68. Memory poisoning

Testo esterno non può diventare automaticamente:

- Configuration Entry;
- persistent preference;
- Student Annotation;
- canonical state;
- trusted instruction.

La persistenza passa sempre da regole domain/approval.

# Parte XIII — Prompt e implementation artifacts

## 69. Prompt non è business logic

I prompt vanno versionati come implementation artifact.

Regole come "non inviare comunicazioni senza approval" appartengono all'Automation Layer, non solo a un system prompt.

## 70. Prompt Template Version

Per output significativi registrare almeno riferimento a:

- capability;
- prompt/template version;
- implementation version;
- model/runtime version;
- configuration snapshot;
- source set.

## 71. Chain-of-thought

La hidden chain-of-thought non deve essere un requisito di audit.

Conservare invece:

- input;
- output;
- evidence;
- tool calls;
- selected sources;
- structured rationale quando serve;
- validation results;
- errors;
- confidence.

# Parte XIV — AI provenance

## 72. AI Result

Un risultato significativo dovrebbe poter indicare:

- capability;
- implementation;
- model/version;
- runtime;
- prompt/template version;
- source set;
- configuration snapshot;
- tools used;
- output schema;
- timestamp;
- validation status;
- eval/review state.

Il livello di dettaglio dipende dall'impatto.

## 73. AI output come derived state

Default:

~~~text
AI output
→ derived / proposed
~~~

Diventa canonical solo quando il workflow lo prevede.

# Parte XV — Evaluation e observability

## 74. Evaluation è foundation

Non possiamo scegliere modelli/tool sulla base di demo.

Ogni capability importante deve avere:

- dataset;
- expected behavior;
- metriche;
- regression tests;
- production feedback loop.

## 75. Gerarchia delle evaluation

~~~text
1. deterministic correctness
2. task-specific metrics / gold set
3. retrieval metrics
4. teacher/human review
5. LLM-as-a-judge supplementary
~~~

LLM-as-a-judge non è unica fonte di verità per feature critiche.

### 75.1 Contratto Epistemico a 5 Classi per Grounding e Generazione
Per distinguere l'arricchimento pedagogico legittimo dalla reale allucinazione, la valutazione didattica e di grounding adotta cinque classi epistemiche formali. Il contratto si applica a claim e span semanticamente rilevanti (evitando un sentence-level classifier obbligatorio nel T1) e adotta un modello composito (*Primary Epistemic Role + Supporting Roles*):
- **`SOURCE_FACT`:** Dati, asserzioni ed elementi direttamente attestati nella fonte (richiede provenance puntuale `chunk_id`; gli embeddings servono per il recupero di candidate evidence e non come entailment checker; costituisce allucinazione fattuale l'invenzione di dati o la falsa attribuzione alla fonte);
- **`SOURCE_DERIVED`:** Deduzioni e calcoli logico-matematici corretti e ricostruibili (es. $Netto = Lordo \times (1 - Sconto)$ quando Sconto è un tasso percentuale, equivalenza 10% / 0.10); distingue derivazioni formalizzabili (checker deterministico) da inferenze semantiche (bounded review);
- **`GENERAL_DOMAIN_KNOWLEDGE`:** Conoscenze disciplinari generali introdotte per spiegare/insegnare (es. sintassi SQL ANSI, contabilità), purché corrette e non falsamente attribuite alla fonte;
- **`PEDAGOGICAL_PROPOSAL`:** Esempi, esercizi, domande, analogie, modalità esplicative e formule didattiche per la soluzione inventati ex-novo dal modello (sempre subordinati a **Teacher Review L3 Prepare**);
- **`SOURCE_SPECIFIC_DETAIL`:** Coordinate di cella, formule workbook native e nomi fogli (ammesse solo se supportate da adapter strutturato deterministico come `CellAwareSpreadsheetAdapter`; distinzione netta tra formule memorizzate nel file e formule generate a runtime).

## 76. Promptfoo

Candidato forte per regression suite, model/prompt comparison, RAG evaluation e red-team.

## 77. Langfuse

Candidato forte come piattaforma self-hosted di:

- tracing;
- datasets;
- experiments;
- evaluation;
- human annotation;
- prompt/version comparison;
- cost/latency analysis.

Da usare eventualmente dietro tracing standard, non come dipendenza di dominio.

## 78. Phoenix / MLflow

Alternative da benchmarkare se portano vantaggi:

- Phoenix: observability/evals/experiments;
- MLflow GenAI: tracing, prompt/eval, più ampio ML lifecycle.

## 79. OpenTelemetry come base neutra

Proposta:

~~~text
application traces
→ OpenTelemetry / GenAI conventions where practical
→ Langfuse / Phoenix / MLflow / other backend
~~~

Così cambiare UI di observability non richiede riscrittura applicativa.

## 80. Production feedback

Metriche reali:

- output accettati senza modifica;
- modifiche docente;
- rigenerazioni;
- review rate;
- retrieval success;
- correction overrides;
- tool-call failures;
- latency;
- RAM/VRAM;
- source grounding;
- user intervention cost.

Questi dati alimentano benchmark e sviluppo, non auto-training opaco.

# Parte XVI — Benchmark suite

## 81. Benchmark B1 — Document ingestion

Corpus:

- PDF nativo;
- scan;
- slide;
- tabelle;
- formule;
- mixed layout;
- DOCX/PPTX.

Metriche:

- text fidelity;
- reading order;
- table correctness;
- formula correctness;
- latency;
- failure rate.

## 82. Benchmark B2 — Retrieval

Query reali:

- materiale JOIN usato in 4B;
- esercizi subnetting anno scorso;
- regolamento laboratorio aggiornato;
- exact identifier;
- semantic paraphrase.

Metriche:

- Recall@K;
- nDCG;
- MRR;
- teacher relevance judgement;
- latency.

## 83. Benchmark B3 — Lesson generation

Output:

- Lesson Plan;
- quasi-verbatim Teacher Script;
- Student Material.

Metriche:

- source fidelity;
- completeness;
- factuality;
- usable duration;
- teacher edit rate;
- structural validity.

## 84. Benchmark B4 — Assessment generation

Metriche:

- blueprint adherence;
- Actual Coverage adherence;
- difficulty plausibility;
- ambiguity;
- solution correctness;
- equivalence across Forms.

## 85. Benchmark B5 — Grading

Con risposte già corrette dal docente:

- deterministic;
- SQL/code;
- short open;
- long open.

Metriche:

- criterion agreement;
- score error;
- false auto-approval;
- review calibration;
- evidence quality.

## 86. Benchmark B6 — Structured/tool use

Metriche:

- schema success;
- wrong-tool rate;
- invalid arguments;
- unnecessary tool calls;
- successful recovery.

## 87. Benchmark B7 — Security

Casi:

- direct prompt injection;
- indirect web/PDF injection;
- tool misuse;
- data exfiltration attempt;
- memory poisoning;
- malicious MCP/tool output.

## 88. Benchmark B8 — Runtime

Metriche:

- TTFT;
- tokens/sec;
- peak RAM;
- peak VRAM;
- throughput;
- cold start;
- long-context degradation.

## 89. Acceptance non basata su un unico score

Per ogni capability si fissano requisiti minimi.

Nel grading, per esempio, false auto-approval può essere molto più importante della media del punteggio.

Nel retrieval, Recall@K + rerank quality può contare più di benchmark generici.

# Parte XVII — Fine-tuning

## 90. Fine-tuning non è foundation iniziale

Non farlo finché non abbiamo:

- real usage dataset;
- error taxonomy;
- baseline prompting/retrieval;
- benchmark stabile;
- evidenza che il problema è nel modello.

Ordine:

1. context;
2. retrieval;
3. prompt;
4. tools;
5. deterministic checks;
6. routing;
7. solo poi fine-tuning.

## 91. Toolkit futuro

Da rivalutare quando serve:

- Unsloth;
- LLaMA-Factory;
- Axolotl;
- PEFT/TRL.

Licenze/versioni/hardware vanno controllati al momento della scelta.

## 92. Use case plausibili

Più plausibili:

- classification specializzata;
- rubric behavior;
- output format molto ripetibile;
- small-model distillation;
- tool-call reliability.

Meno plausibile come primo intervento:

> addestrare il modello per ricordare tutti i materiali.

Per quello retrieval/versioned sources è più adatto.

# Parte XVIII — Voice e multimodal

## 93. Voice

Per annotazioni rapide:

~~~text
speech
→ transcription
→ Teacher Annotation
~~~

Un runtime locale Whisper-compatible è un candidato naturale futuro.

Non è prioritario prima che le annotazioni testuali siano solide.

## 94. Multimodal

Utile per:

- diagrammi;
- screenshot;
- scansioni;
- schemi;
- compiti fotografati;
- futuri handwritten workflows.

Principio:

~~~text
structured parser first
→ VLM only where visual interpretation adds value
~~~

# Parte XIX — Free-core strategy

## 95. Cosa significa free

Il core non deve dipendere da API/SaaS a pagamento.

Non significa che il calcolo sia fisicamente privo di costo: server, energia e GPU hanno comunque costi infrastrutturali.

Il core deve poter funzionare con:

- componenti open/self-hostable;
- modelli open/open-weight compatibili;
- database self-hosted;
- acquisition/search sostituibile;
- provider esterni opzionali.

## 96. Optional external providers

Possiamo supportare:

~~~text
Local baseline
→ sempre disponibile

Optional external provider
→ qualità/velocità maggiore se configurato
~~~

Rimuovere il provider non rompe il dominio.

# Parte XX — Shortlist tecnologica 2026

## 97. Shortlist da benchmarkare

General models:
- Qwen3.5-9B;
- Gemma 4 candidates;
- Ministral 3 8B/14B;
- gpt-oss-20b;
- Mistral Small 4 come server/heavier candidate.

Inference:
- llama.cpp;
- Ollama;
- vLLM;
- SGLang.

Embeddings:
- Qwen3-Embedding-0.6B;
- BGE-M3.

Reranking:
- Qwen3-Reranker-0.6B;
- bge-reranker-v2-m3.

Structured output:
- native runtime JSON schema;
- XGrammar;
- Pydantic validation;
- Instructor;
- Pydantic AI dove serve tool loop.

Documents:
- native fast extraction;
- Docling;
- Apache Tika;
- PaddleOCR / PP-StructureV3.

Retrieval storage:
- PostgreSQL FTS + pgvector first;
- Qdrant if benchmarks justify.

Web:
- SearXNG discovery candidate;
- HTTP + Trafilatura extraction;
- Playwright for dynamic interaction;
- crawler framework only if required.

Code execution:
- Judge0 CE;
- Piston;
- Wasmtime specialized;
- E2B only if advanced isolation warrants.

Orchestration:
- plain application code first;
- Pydantic AI bounded;
- Haystack for RAG/pipeline if valuable;
- LangGraph/Temporal only with demonstrated need.

Evals/observability:
- custom deterministic tests;
- Promptfoo;
- OpenTelemetry;
- Langfuse / Phoenix / MLflow shortlist.

MCP:
- official MCP SDK as baseline;
- convenience frameworks/gateways optional.

# Parte XXI — Proposed T1 profile

## 98. T1 minimal AI stack (Consolidato post benchmark B1–B6)

A valle delle evidenze empiriche dei benchmark B1–B6 e della decisione di prodotto approvata, lo stack AI canonico per T1 è così strutturato:

~~~text
Document ingestion (Specialist Local)
→ Marker (marker-pdf su MPS) primario per PDF e formule (validato B1)
→ MinerU (hybrid-engine locale) primario per DOCX, XLSX, PPTX (validato B1)

Storage / Search (Deterministic Local)
→ SQLite FTS5 per indicizzazione lessicale BM25 e fallback primario (validato B2)
→ Vector storage locale per chunk vettoriali (validato B2)

Embedding (Specialist Local)
→ Qwen3-Embedding-0.6B su oMLX locale (validato B2 come dense baseline)
→ Fallback automatico su FTS5 lessicale in caso di indisponibilità

Reranking
→ Disattivato di default per policy B2 (costoso in latenza, peggiora precisione)

Fast typed / bounded checks (Small Semantic Local)
→ Regole deterministiche prioritarie per formati, tipi e metadati (B4)
→ MiniCPM5-2B su oMLX per piccole estrazioni strutturate
→ Rizzo Flow (Spark-X2.5) solo per recall expansion e bounded suggestion (B4)

Heavy Generation (Remote via OmniRoute)
→ Profilo remote.longform: Teacher Script estesi (45-60 min) ancorati al Source Set
→ Profilo remote.generation: Lesson Plan, sintesi e Student Material
→ Profilo remote.reasoning: Progettazione verifiche complesse e allineamento curricolare
→ Gateway OmniRoute: nasconde credenziali vendor ed espone catalogo dinamico

Validation & Contracts
→ JSON Schema + Pydantic per validazione multilivello di ogni output
→ Selection Trace per trasparenza ed explainability del routing

Governance & Review (D08 / D11)
→ Livello di autonomia L3 (Prepare): output salvato come bozza, mai auto-pubblicato
→ Obbligo di Teacher Review e approvazione docente prima dell'uso in classe
→ Divieto categorico di fallback automatico su provider esterni per dati Restricted
~~~

Il web può entrare in T1 tramite adapter semplice se serve al valore reale.

Tutte le capability devono poter essere indirizzate a servizi sulla stessa macchina o su host differenti senza modificare il dominio.

## 99. Cosa non serve a T1

Non introdurre necessariamente:

- LiteLLM gateway service;
- Qdrant;
- Temporal;
- LangGraph;
- full agent platform;
- fine-tuning;
- microVM sandbox;
- complex MCP server;
- vector database cluster;
- multi-agent architecture;
- autonomous browser research agent.

# Parte XXII — AI1 checkpoint

## 100. AI1 — One capability, multiple implementations

Problema:

> Dobbiamo poter cambiare modello/tool senza cambiare il dominio.

Scenario:

1. T1 richiede Teacher Script;
2. Application invoca GenerateNarrative;
3. AI layer risolve implementation;
4. runtime produce output;
5. output conserva provenance;
6. cambiamo modello/config;
7. eseguiamo benchmark sullo stesso dataset;
8. domain object e workflow restano invariati.

Primitive:

- AICapability;
- AIRequest;
- AIImplementation;
- Capability Registry;
- Model/Tool Adapter;
- AIResult;
- AI Provenance;
- Prompt/Implementation Version;
- Evaluation Dataset/Run.

Non-goals:

- adaptive router;
- fine-tuning;
- multi-agent;
- distributed inference fabric.

# Parte XXIII — Foundation decisions proposte

## 101. Foundation decisions approvate

Le seguenti foundation sono considerate approvate, con le tecnologie concrete lasciate al benchmark:

1. AI come capability layer subordinato a Domain/Application/Automation;
2. nessun modello/provider/framework è foundation del dominio;
3. capability ports stabili e implementazioni sostituibili;
4. scelta tecnica per task secondo least-complex / most-verifiable;
5. deterministic e specialized-first quando appropriato;
6. typed/zero-generation decision models sono una categoria specializzata valida per task bounded;
7. routing iniziale esplicito/configurabile, non AI-router opaco;
8. quality profile astratto dal model name;
9. core con fondazione sovrana local/private per ingestion, storage, retrieval vettoriale/lessicale e policy; heavy generation complessa delegata a modelli remoti via gateway conforme a D11;
10. provider e modelli remoti gestiti tramite gateway disaccoppiato (OmniRoute), senza dipendenze proprietarie nel dominio;
11. structured outputs come default quando il codice consuma l'output;
12. structured output sempre seguito da domain validation;
13. parser/document understanding separato dal generative model;
14. original file preservato; normalized/chunk/embedding state derivato e versionabile;
15. retrieval lexical + semantic + structural/domain context, non solo vector similarity;
16. retrieval storage/backend non viene fissato prima dei benchmark;
17. embedding e reranker capability specializzate indipendenti;
18. web research separa search/fetch/extract/evaluate/use/save;
19. browser automation solo quando fetch statico non basta;
20. code/SQL execution in sandbox separato dall'LLM;
21. agent framework può implementare capability bounded ma non possedere workflow domain;
22. MCP come adapter futuro e possibile integration protocol, non dominio;
23. UI/API/MCP passano dalle stesse policy/authorization;
24. contenuto esterno sempre untrusted;
25. least privilege tools e action screening;
26. output AI derived/proposed salvo workflow che lo promuove a canonical;
27. AI provenance per output significativi;
28. prompt/template versionato ma non sede unica di business/security logic;
29. hidden chain-of-thought non richiesta come audit artifact;
30. evaluation/regression testing è foundation, non attività finale;
31. tracing OTel-compatible preferito per ridurre lock-in;
32. LLM-as-a-judge solo supplemental;
33. model/tool selection tramite benchmark sul nostro workload reale;
34. fine-tuning solo dopo evidenza misurata che prompting/retrieval/tools non bastano;
35. resource/cost awareness parte del routing e Automation Model;
36. AI stack iniziale volutamente piccolo, esteso solo da metriche/requisiti reali;
37. ogni capability implementation deve poter essere locale oppure remota;
38. i contratti applicativi non devono assumere co-location tra componenti;
39. health, auth, timeout, capability/version e privacy eligibility devono essere esprimibili per le implementation remote;
40. servizi già presenti nel development-environment sono preferiti quando soddisfano i benchmark, evitando duplicazioni infrastrutturali.

# Parte XXIV — Decisioni tecnologiche aperte

## 102. Candidate defaults, non foundation

Da benchmarkare prima della scelta:

- Qwen3.5 vs Gemma 4 vs Ministral 3 vs gpt-oss vs altri;
- llama.cpp vs Ollama per locale;
- vLLM vs SGLang per GPU server;
- Qwen3 Embedding vs BGE-M3;
- Qwen3 Reranker vs BGE reranker;
- Docling vs pipeline alternative;
- pgvector vs Qdrant;
- SearXNG vs altri search provider;
- Judge0 vs Piston/custom sandbox;
- Pydantic AI vs plain orchestration/Haystack;
- Langfuse vs Phoenix vs MLflow;
- LiteLLM SDK/gateway sì/no.

# Parte XXV — Research sources snapshot

## 103. Fonti primarie e documentazione consultate

Snapshot: 26 settembre 2026.

Models:
- https://github.com/OpenBMB/MiniCPM/
- https://huggingface.co/openbmb/MiniCPM5-2B-MLX
- https://huggingface.co/google/gemma-4-E2B-it
- https://huggingface.co/google/gemma-4-E4B-it
- https://huggingface.co/Qwen/Qwen3.5-9B
- https://qwenlm.github.io/blog/qwen3-embedding/
- https://docs.mistral.ai/models/mistral-small-4-0-26-03
- https://openai.com/index/gpt-oss-model-card/
- https://rizzo-ai-academy.github.io/rizzo-flow/
- https://github.com/Rizzo-AI-Academy/rizzo-flow

Inference / structured:
- https://github.com/ggml-org/llama.cpp
- https://ollama.com/blog
- https://docs.vllm.ai/
- https://docs.sglang.ai/
- https://github.com/mlc-ai/xgrammar
- https://github.com/567-labs/instructor
- https://pydantic.dev/docs/ai/

Documents:
- https://github.com/opendatalab/MinerU
- https://docling-project.github.io/docling/
- https://tika.apache.org/
- https://github.com/PaddlePaddle/PaddleOCR
- https://github.com/datalab-to/marker

Retrieval / RAG platforms:
- https://docs.anythingllm.com/
- https://docs.openwebui.com/features/chat-conversations/rag/
- https://ragflow.io/
- https://docs.onyx.app/
- https://github.com/pgvector/pgvector
- https://qdrant.tech/documentation/

Embedding / reranking:
- https://ai.google.dev/gemma/docs/embeddinggemma
- https://huggingface.co/mlx-community/embeddinggemma-300m-4bit
- https://huggingface.co/mlx-community/Qwen3-Embedding-0.6B-8bit
- https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe
- https://huggingface.co/ibm-granite/granite-embedding-278m-multilingual
- https://huggingface.co/BAAI/bge-m3
- https://huggingface.co/BAAI/bge-reranker-v2-m3

Web:
- https://docs.searxng.org/
- https://github.com/adbar/trafilatura
- https://playwright.dev/

Execution:
- https://ce.judge0.com/
- https://github.com/engineer-man/piston
- https://github.com/bytecodealliance/wasmtime
- https://e2b.dev/open-source

Orchestration / protocol:
- https://docs.haystack.deepset.ai/
- https://docs.langchain.com/oss/python/langgraph/
- https://docs.temporal.io/
- https://modelcontextprotocol.io/

Evaluation / observability:
- https://www.promptfoo.dev/
- https://langfuse.com/docs
- https://github.com/Arize-ai/phoenix
- https://mlflow.org/docs/latest/genai/

Security:
- https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- https://cheatsheetseries.owasp.org/
- https://genai.owasp.org/llmrisk/llm01-prompt-injection/

## 104. Stato del dossier

Il Dossier 10 — AI Architecture è **approvato come foundation architetturale**, integrato con le evidenze definitive dei benchmark B1–B6 e la specifica canonica `docs/ai/model-routing-and-registry.md`. Il contratto di affidabilità semantica senza letteralismo è precisato nel Dossier 04 §47 e nel Dossier 05 §57: la conoscenza parametrica del modello può arricchire una spiegazione ma non costituisce da sola una citazione o una certificazione esterna.

Punti fermi consolidati dopo i benchmark B1–B6:
- **Decisione di prodotto confermata:** il Teacher Service non delega a piccoli modelli locali la generazione autonoma di Teacher Script lunghi; tale generazione è affidata a modelli remoti capaci tramite il gateway OmniRoute;
- **Fondazione locale sovrana:** parsing (Marker/MinerU), embedding (Qwen3 su oMLX), indicizzazione (SQLite FTS5) e controlli di schema/policy rimangono interamente locali e privati;
- **Model Catalog e Registry dinamico:** adozione del ciclo di vita formale `DISCOVERED → COMPATIBLE → VALIDATED → ELIGIBLE → DEFAULT_FOR_PROFILE`;
- **Model Selector deterministico:** selezione algoritmica basata su Task Model Policy, senza router LLM;
- **Disaccoppiamento totale:** porta `RemoteModelGateway` verso OmniRoute, con isolamento assoluto delle API key dei provider esterni;
- **Allineamento di governance:** pieno rispetto dei livelli di autonomia L3 (Prepare) di Dossier 08 e delle classi di riservatezza di Dossier 11.
