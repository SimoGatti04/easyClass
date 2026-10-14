# Feasibility & Benchmark Gate — Teacher Service

> Stato: piano operativo proposto
>
> Posizione nel processo: **dopo Dossier 11, prima di Platform Architecture**
>
> Obiettivo: validare con dati reali le fondamenta tecniche che sosterranno T1 prima di progettare l'architettura definitiva.

## 1. Principio

Non dobbiamo benchmarkare tutto l'ecosistema AI.

Dobbiamo rispondere a domande concrete che possono bloccare il prodotto:

1. riusciamo a leggere bene i materiali reali del docente?
2. riusciamo a trovare automaticamente le fonti giuste?
3. per quali compiti i modelli piccoli/locali sono affidabili (parsing, embedding, controlli bounded) e quali richiedono modelli remoti (generazione long-form complessa)?
4. i decision model sono affidabili per classificazione/routing bounded?
5. la pipeline funziona con componenti anche su macchine diverse?
6. il core può garantire privacy e sovranità locale (parsing, storage privato, retrieval, policy) integrando la heavy generation remota via gateway senza dipendenze proprietarie del dominio?

Solo dopo queste risposte scegliamo il minimo stack T1.

## 2. Gate, non progetto parallelo

Il benchmark deve essere:

- piccolo;
- riproducibile;
- automatizzabile;
- basato su corpus reale;
- comparativo;
- abbastanza rigoroso da guidare le scelte;
- eliminabile come infrastruttura separata una volta integrato nei test del progetto.

Non costruire:
- piattaforma benchmark generica;
- dashboard sofisticata;
- distributed benchmarking framework;
- ML experiment platform complessa.

## 3. Ordine dei test

L'ordine è importante perché una pipeline downstream non ha senso se fallisce una foundation upstream.

~~~text
B0 Environment
↓
B1 Document parsing
↓
B2 Retrieval
↓
B3 Small/general models
↓
B4 Typed decisions
↓
B5 T1 end-to-end
↓
B6 Distributed execution
~~~

Grading, anti-copiatura e Assessment vengono benchmarkati più avanti quando arriviamo ai relativi vertical slice.

## 4. B0 — Environment verification

### Domanda

Cosa abbiamo realmente disponibile e funzionante oggi?

### Componenti da verificare

Già individuati nel development-environment:

- oMLX;
- Ollama;
- OmniRoute;
- MinerU;
- Marker;
- Rizzo Flow / Spark-X2.5;
- Open WebUI;
- chat-history-search;
- Qwen3-Embedding-0.6B;
- Qwen3-Reranker;
- mlx-whisper-cli.

### Output

Per ciascun servizio:

- installato sì/no;
- versione;
- endpoint/API;
- modello disponibile;
- hardware/backend;
- health check;
- può essere chiamato da altro host sì/no;
- eventuali dipendenze mancanti.

### Gate

Nessuna scelta architetturale basata su un servizio che esiste nei documenti ma non gira realmente.

## 5. Corpus minimo realistico

Il corpus deve essere piccolo ma rappresentativo.

Target iniziale:

### Documenti

Circa 20–30 risorse reali, con varietà:

- PDF testuale;
- PDF complesso;
- slide;
- DOCX/PPTX;
- tabelle;
- formule;
- immagini/scansioni se realmente usate;
- materiale creato dal docente;
- materiale esterno;
- almeno un documento lungo.

### Contenuti

Preferire materiali realmente utilizzati o realisticamente utilizzabili dal docente.

Il corpus non deve contenere dati personali studenti per T1.

### Lesson scenarios

Almeno 5 scenari reali:

1. lezione semplice con una fonte;
2. lezione con più fonti;
3. argomento con materiale storico simile;
4. argomento con fonti parzialmente insufficienti;
5. lezione lunga che richiede Teacher Script esteso.

Ogni scenario deve avere una breve expected outcome manuale.

## 6. Gold set leggero

Non serve una ground truth perfetta.

Per ogni scenario annotare manualmente:

- quali fonti sono davvero pertinenti;
- quali sezioni sono importanti;
- cosa non deve essere inventato;
- argomenti obbligatori;
- argomenti esclusi;
- durata prevista;
- livello atteso;
- eventuali esercizi/esempi indispensabili.

Questo basta per confrontare pipeline diverse.

# B1 — Document Parsing

## 7. Candidati

Baseline:

- MinerU;
- Marker;
- native/fast extraction quando applicabile.

Docling o altri parser entrano solo se emergono gap.

## 8. Cosa misurare

Per ogni documento:

- completezza testo;
- ordine di lettura;
- headings/sections;
- tabelle;
- formule;
- immagini/caption quando rilevanti;
- rumore introdotto;
- tempo;
- peak resource use;
- failure;
- qualità output Markdown/JSON.

## 9. Scoring pragmatico

Per ogni documento:

- 0 = inutilizzabile;
- 1 = richiede forte correzione;
- 2 = utilizzabile con difetti;
- 3 = buono;
- 4 = quasi perfetto.

Campi separati:

- text fidelity;
- structure;
- tables/formulas;
- downstream usability.

## 10. Gate B1

### GO

Un parser copre bene la grande maggioranza dei documenti reali e gli errori residui sono gestibili.

### IMPROVE

Serve routing MinerU/Marker/native o piccolo fallback.

### REJECT

La pipeline non conserva correttamente contenuto fondamentale dei materiali.

Non si procede a retrieval serio finché B1 non è sufficiente.

# B2 — Retrieval

## 11. Domande reali

Creare almeno 25–40 query realistiche.

Categorie:

### Exact
- titolo/materiale preciso;
- termine tecnico raro;
- nome esercizio;
- codice/identificatore.

### Semantic
- "materiale per spiegare le JOIN";
- "esercizi per ripassare subnetting";
- "fonte che confronta LEFT e INNER JOIN".

### Contextual
- "materiale usato con la 4B";
- "esercizi dell'anno scorso";
- "fonti adatte a una lezione di due ore".

### Negative / confusable
Query dove esistono materiali molto simili ma uno è sbagliato.

## 12. Pipeline candidate

Baseline custom semplice:

~~~text
structured filters
+ lexical
+ dense embeddings
+ RRF/fusion
+ optional reranker
~~~

Confrontare idee/componenti da:

- chat-history-search;
- PostgreSQL FTS + pgvector;
- Open WebUI;
- RAGFlow;
- Onyx/Qdrant solo se utile.

Non serve installare tutto per forza.

## 13. Embedding candidates

Priorità iniziale:

- EmbeddingGemma 300M MLX;
- Qwen3-Embedding-0.6B MLX.

Optional se promettenti:

- Nomic Embed Text v2 MoE;
- Granite Embedding 278M;
- BGE-M3.

## 14. Reranking

Prima baseline senza reranker.

Poi:

- Qwen3-Reranker già disponibile;
- eventuale alternativa solo se necessario.

Misurare il delta reale.

## 15. Metriche B2

- Recall@5;
- Recall@10;
- MRR;
- nDCG@10 se il gold set lo permette;
- query latency;
- indexing time;
- index size;
- peak RAM;
- teacher relevance judgement.

Più importante:

> nelle query operative il materiale giusto compare abbastanza in alto da essere realmente riutilizzabile?

## 16. Gate B2

### GO

Retrieval trova in modo affidabile le fonti pertinenti nei casi reali.

### IMPROVE

Reranking/context filters/ranking didattico risolvono errori principali.

### REJECT

Il retrieval non distingue materiali simili o perde frequentemente le fonti necessarie.

# B3 — General/Small Models

## 17. Candidati iniziali

Priorità:

- MiniCPM5-2B MLX;
- Gemma 4 E2B/E4B dove disponibili;
- 1–2 small model recenti solo se portano un confronto utile.

Reference opzionale:

- modello remoto più forte via OmniRoute.

Il modello remoto serve come quality ceiling/reference, non come requisito del core.

## 18. Task da testare

### T1A — Lesson Plan

Input:

- topic;
- duration;
- class/subject;
- selected sources.

### T1B — Teacher Script

Richiesta fondamentale:

- molto lungo;
- quasi-verbatim;
- coerente con durata;
- esempi;
- transizioni;
- domande;
- possibili risposte;
- errori comuni.

### T1C — Student Material

Deve essere realmente diverso dal Teacher Script.

### T1D — Structured metadata

- topic extraction;
- source summary;
- suggested links;
- JSON-schema output.

## 19. Metriche B3

Valutazione umana breve ma standardizzata:

0–4 per:

- source fidelity;
- factual correctness;
- completeness;
- pedagogical usefulness;
- adherence to level;
- adherence to duration;
- structure;
- unnecessary verbosity;
- hallucinations;
- amount of teacher editing required.

Runtime:

- TTFT;
- total time;
- tokens/sec;
- peak RAM;
- output length;
- failures.

## 20. Metrica chiave

Per Teacher Script la metrica principale non deve essere "qualità letteraria".

Deve essere:

> quanto lavoro resta al docente prima di poter realmente usare la lezione?

Classificazione:

- usable as-is;
- minor edits;
- moderate edits;
- major rewrite;
- unusable.

## 21. Gate B3

### Esito formale ed evidenza empirica B3: CONDITIONAL (30 Settembre 2026)
Il benchmark B3 ha confermato lo stato **CONDITIONAL**:
- I modelli locali 2B–9B testati (MiniCPM5-2B, Ornith-1.5-9B) sono risultati idonei per compiti delimitati e bozze veloci, ma **non sono adatti alla generazione autonoma di Teacher Script lunghi, strutturati e verbatim** (evidenze: troncamenti, filler ripetuto, scarsa tenuta temporale);
- La decisione di prodotto approvata stabilisce che **la generazione long-form complessa è responsabilità primaria dei modelli remoti via gateway OmniRoute**, mentre il runtime locale è ottimale per parsing, embedding, retrieval e verifiche;
- Questo esito non rigetta il Teacher Service né T1: elimina l'assunzione non necessaria di generazione 100% on-device e orienta l'architettura verso una pipeline ibrida disaccoppiata.

# B4 — Typed Decisions

## 22. Rizzo Flow / Spark benchmark

Task bounded:

- classify material type;
- select class/subject candidate;
- yes/no relevance;
- choose one of known categories;
- decide local-search-needed yes/no;
- rank discrete options where appropriate.

## 23. Dataset

Almeno 100–200 casi semplici derivati dal corpus, perché questi task possono essere testati automaticamente.

Ogni caso ha:

- input;
- allowed choices;
- expected answer.

## 24. Metriche

- accuracy;
- confusion matrix;
- latency;
- failure rate;
- probability/logit calibration only if we intend to use confidence thresholds.

## 25. Gate B4

### GO

Rizzo Flow supera una baseline semplice e raggiunge affidabilità sufficiente per il task bounded.

### KEEP AS PROPOSAL

Buono per suggerire ma non auto-applicare.

### REJECT FOR TASK

Regole/embedding/small model sono migliori o più semplici.

Il risultato può essere diverso capability per capability.

# B5 — T1 End-to-End

## 26. Scopo

Questo è il feasibility gate più importante.

Pipeline:

~~~text
real sources
↓
parse
↓
index/retrieve
↓
select Source Set
↓
generate Lesson Plan
↓
generate Teacher Script
↓
generate Student Material
↓
show provenance
~~~

Non serve ancora UI definitiva.

Può essere CLI/API/test harness.

## 27. Scenari

Eseguire i 5 lesson scenarios del corpus.

Per ciascuno registrare:

- fonti recuperate;
- parser usato;
- modello;
- runtime;
- output;
- durata totale;
- errori;
- teacher evaluation;
- modifiche necessarie.

## 28. T1 acceptance gate (Revisionato - Nuova Acceptance Condition)

Per dichiarare la foundation technically feasible per T1:

1. **Parsing robusto:** non perde informazioni fondamentali nei formati supportati (Marker per PDF, MinerU per Office/DOCX/PPTX, `CellAwareSpreadsheetAdapter` per XLSX);
2. **Retrieval fondato:** recupera i chunk corretti dal corpus (SQLite FTS5 lessicale + Qwen3-Embedding su oMLX locale);
3. **Teacher Script utilizzabile:** generato con alta qualità e tenuta narrativa da un modello del profilo `remote.longform` (via OmniRoute) con ancoraggio fedele al Source Set e pipeline composita a sezioni vincolate;
4. **Student Material differenziato:** generato dal profilo `remote.generation` con registro e contenuti dedicati allo studente;
5. **Source Provenance ricostruibile:** tracciamento completo di fonti, chunk, prompt versionati, modello selezionato e log di selezione;
6. **Indipendenza assoluta del dominio da singoli vendor:** nessuna API proprietaria o modello specifico è dipendenza del dominio (architettura esagonale: porta `RemoteModelGateway` con adapter);
7. **Architettura ibrida e sovranità dei dati:** parsing, indicizzazione, storage, retrieval vettoriale e controlli avvengono in locale/privato; la heavy generation complessa è remota;
8. **Automation Policy e Teacher Review obbligatorie:** le generazioni didattiche sono prodotte a livello L3 (Prepare) come bozze in attesa di approvazione/modifica docente, mai auto-pubblicate (Dossier 08);
9. **Nessun fallback implicito:** nessun passaggio automatico da locale a remoto o verso altri provider quando la riservatezza dei dati o le policy di istituto lo vietano (Dossier 11).

Se uno di questi criteri non è soddisfatto, fermarsi e correggere prima della Platform Architecture.

# B6 — Distributed Capability Test

## 29. Scopo

Validare il requisito:

> i componenti possono stare su macchine diverse.

Non serve distribuire tutto.

È sufficiente dimostrare almeno due capability remote.

Esempio:

~~~text
Teacher Service test harness
on Host A

→ oMLX Host B
→ MinerU Host C
~~~

oppure simulare con host/container distinti se non abbiamo subito più macchine disponibili.

## 30. Verifiche

- request/response;
- health check;
- timeout;
- failure handling;
- auth minima;
- retry where safe;
- file/reference transfer;
- same contract local vs remote.

## 31. Gate B6

La business logic non cambia quando una implementation passa da localhost a remote endpoint.

# 32. Cosa NON benchmarkiamo ora

Rimandare:

- grading reale;
- anti-copiatura;
- student profiles;
- personalization;
- adaptive learning;
- communications;
- voice;
- full web research agent;
- fine-tuning;
- MCP;
- multi-agent workflows.

Non sono prerequisiti per T1.

# 33. Output finale del Gate

Produrre un unico report breve:

~~~text
FEASIBILITY RESULT

Parsing
→ selected baseline
→ rejected alternatives
→ known gaps

Retrieval
→ selected baseline
→ embedding
→ reranking yes/no

Models
→ fast local
→ strong local
→ optional API reference

Typed decisions
→ tasks where Rizzo Flow is useful

Distributed execution
→ validated / issues

T1
→ FEASIBLE / NOT YET FEASIBLE
~~~

Con evidenze e benchmark allegati.

# 34. Regola di scelta

Non scegliamo automaticamente il componente con score massimo.

Valutiamo:

~~~text
quality
+ simplicity
+ existing availability
+ resource use
+ latency
+ maintainability
+ free/local viability
~~~

Una soluzione leggermente meno performante può essere preferibile se elimina un servizio intero senza compromettere il risultato pratico.

# 35. Primo passo operativo

Ordine immediato:

1. verificare B0 sui servizi reali;
2. individuare 20–30 documenti reali non sensibili;
3. creare 5 lesson scenarios;
4. eseguire B1 parsing;
5. solo dopo costruire il benchmark retrieval.

Non iniziare contemporaneamente tutti i benchmark.


# 36. Formalizzazione della correzione B3/B5 e Sequenza del Nuovo Gate

### 36.1 Valore dei risultati B3 e B5
I benchmark B3 e B5-B6 non rappresentano un fallimento del progetto, ma hanno prodotto un risultato di grande valore: hanno dimostrato in modo inequivocabile che costringere un modello locale compatto a generare un'ora di copione didattico verbatim porta a un'esperienza inaccettabile per il docente. Riconoscere questo limite prima dell'implementazione ha evitato mesi di sviluppo su un'ipotesi fragile.

L'esito `NOT YET FEASIBLE` di B5 era la diretta conseguenza di un criterio di gate ("100% local/private end-to-end") più rigido di quanto richiesto dalle reali esigenze didattiche ed etiche del prodotto.

### 36.2 La nuova sequenza operativa di validazione
Il prossimo ciclo di verifica si articola in quattro test specifici (senza implementarli o eseguirli prematuramente in questa fase di design):

1. **Gate A — Catalog Discovery Test:** Ingestione dinamica di `/v1/models` da OmniRoute e oMLX, normalizzazione in `ModelDescriptor` e verifica del lifecycle (`DISCOVERED` -> `COMPATIBLE`);
2. **Gate B — Local Capability Validation:** Verifica rigorosa dei modelli locali (oMLX / MinerU / Marker / FTS5) esclusivamente sui compiti bounded per cui sono adatti (parsing, embedding, retrieval, estrazioni strutturate brevi);
3. **Gate C — Remote Generation Benchmark (v2):** Benchmark dei profili `remote.generation`, `remote.longform` e `remote.reasoning` mediante pipeline composita a sezioni vincolate (non monolitica) su coorte di 3 modelli validati con preflight probe preliminare (senza consumo slot in caso di disservizio infrastrutturale e senza fallback inter-modello), su scenario DBMS e scenario Excel con `CellAwareSpreadsheetAdapter`; adotta una soglia di benchmark provvisoria (provisional benchmark threshold) per `SOURCE_FACT` ($\ge 95\%$) con hard failures su contraddizioni esplicite, false attribuzioni e coordinate inesistenti, misurando congiuntamente il carico di revisione del docente (teacher editing effort);
4. **Gate D — Revised End-to-End T1:** Test integrato della pipeline T1 completa (parsing locale -> embedding/retrieval locale -> Source Set -> heavy generation remota via OmniRoute -> tracciamento provenance -> revisione e approvazione docente).

### 36.3 Correzione di priorità: dominio didattico prima del formato (2026-10)

La distinzione fondamentale nella pipeline non è PDF vs DOCX vs XLSX, ma **Teacher Material → Student Material pubblicato → Assessable Source Set → Assessment**. Support Material accompagna il percorso ed entra nel perimetro valutabile solo mediante autorizzazione e disponibilità esplicite (Dossier 04 §46; Dossier 05 §56). Un formato è un requisito dell'adapter, mai la definizione del workflow.

Per i Gate C/D, selezionare un insieme eterogeneo e rappresentativo di fonti di uso didattico (testo/Markdown, PDF, HTML/web, DOCX, ed eventuali dati tecnici), con scenario XLSX mantenuto come regressione utile ma **non assunto a riferimento principale**. Non sostituire automaticamente una fonte incompleta con fatti inventati o presentare aggiunte generali come se provenissero dalle fonti.

**Accettazione E2E aggiuntiva:**
1. Generare Teacher Material e Student Material distinguendo ruoli, versioni e stato di pubblicazione;
2. Costruire un Assessment solo dalle versioni Student Material distribuite e dagli eventuali Support Material esplicitamente dichiarati valutabili;
3. Per ogni domanda dimostrare la catena Item → obiettivo/concetto → evidenza testuale/strutturata → versione valutabile → disponibilità;
4. Usare casi negativi con fatto presente solo nel Teacher Material, fonte parziale, citazione falsa e contraddizione esplicita: il sistema deve escludere, bloccare o segnalare come non grounded, non promuovere implicitamente l'Item;
5. Misurare separatamente fedeltà ai fatti specifici delle fonti, copertura didattica, carico di revisione docente e completezza della provenance. La soglia media provvisoria `SOURCE_FACT ≥95%` non compensa hard failures;
6. Per reasoning effort e altre capability dinamiche, registrare `UNKNOWN` quando non dichiarate e non inferire supporto dai nomi dei modelli.

Questi punti affinano i criteri dei gate esistenti; **non dichiarano alcun benchmark già eseguito o superato**.

### 36.4 Gate bilanciati — correttezza, copertura e rielaborazione (2026-10-09)

Per i **nuovi** benchmark il criterio non è la coincidenza delle parole o l'obbligo di citare celle/coordinate, ma la correttezza fattuale e la qualità del percorso educativo (Dossier 04 §47; Dossier 05 §57).

- **Teacher Material:** spiegazione fattualmente attendibile, integrazioni di knowledge generale corrette e riconoscibili, websearch tracciata se effettivamente consultata, esempi pedagogici leciti; hard failure se invenzione presentata come fonte o fatto vero, falsa citazione o contraddizione sostanziale.
- **Student Material:** copertura delle nozioni effettivamente spiegate/approvate, riorganizzazione e parafrasi corrette; hard failure se introduce nuovi prerequisiti importanti non insegnati.
- **Assessment:** prerequisiti valutabili e soluzioni corrette, problemi nuovi e ragionamento ammessi; hard failure se la prova richiede conoscenze non coperte o contiene errori/ambiguità sostanziali.
- **Positivi:** stessa spiegazione riformulata correttamente; esempio nuovo coerente; query SQL su schema nuovo con soli operatori studiati. **Negativi:** informazione inventata spacciata per fonte, argomento non insegnato aggiunto alla dispensa, quesito fuori programma, riferimento reale errato quando necessario.
- Misurare separatamente violazioni critiche, fedeltà semantica, copertura, valore didattico e teacher editing effort. Un exact-match non è una misura sufficiente.

Il D4 storico e la soglia sperimentale `SOURCE_FACT ≥95%` rimangono congelati **per l'analisi retrospettiva comparabile**. Non sono una specifica generale del prodotto, né giustificano penalizzare arricchimenti leciti o imporre i controlli cell-aware del vecchio scenario Excel ad altri contenuti. Qualsiasi nuova soglia quantitativa richiede validazione su casi realistici; i risultati storici non vengono alterati.
