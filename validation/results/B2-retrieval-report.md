# B2 — Retrieval & Embedding Benchmark

## Decisione

### **IMPROVE** — baseline testuale promettente, ma il gate non è chiuso per un uso T1 robusto.

Il benchmark supporta **Qwen3-Embedding-0.6B via oMLX** come embedding provvisorio e mostra un guadagno reale di dense retrieval sul retrieval a livello di chunk. Il percorso minimo consigliato è mantenere **SQLite FTS5 + priorità exact/technical-anchor** per query letterali e fallback, aggiungendo la route **dense** per query semantiche/contestuali. **Non adottare RRF come default** e **non aggiungere il reranker di default**: in questo run RRF è sotto al dense puro e il reranker costa secondi, peggiora l'intrusione di contenuti confondibili e non migliora il recupero in modo abbastanza consistente da giustificarne il costo.

La decisione resta `IMPROVE`, non `GO`, perché il test usa sei documenti, 32 query (solo quattro negative) e include failure evidenti su richieste contestuali e sull'astensione quando il contenuto manca. È sufficiente per selezionare una pipeline minima candidata per **ricerca testuale**, non per dichiarare retrieval T1 generalizzato o fissare uno storage/vector database. La limitazione B1 per XLSX resta integra: query sul contenuto testuale del workbook sì; coordinate di cella, formule, calcoli cell-specific e grounding cella-per-cella **non validati e fuori scope**.

## Metadata

- **Ruolo:** Retrieval & Knowledge Engineer
- **Task:** B2 — Retrieval & Embedding Benchmark
- **Data:** 29 settembre 2026 (CEST)
- **Host/hardware:** Mac mini Apple M4, 24 GiB unified memory (inventario B0)
- **Software misurato:** Python 3.14.7; NumPy 2.4.4; SQLite 3.53.4; oMLX 0.6.4 (inventario B0); chat-history-search 1.0.0 (inventario B0, usato come riferimento di pattern)
- **Runtime/modelli:** oMLX `http://127.0.0.1:8000`; `Qwen3-Embedding-0.6B` (1024 dimensioni) e `Qwen3-Reranker-0.6B`. L'API non ha esposto una revisione immutabile dei pesi.
- **Workspace state:** la directory non contiene `.git`; commit/ref non disponibile.
- **Corpus:** sei artifact normalizzati B1, hash/provenance registrati in `validation/artifacts/B2/MANIFEST.json`.

## Obiettivo

Rispondere, usando query gold e ranking di chunk/sezione, a: quanto guadagna T1 aggiungendo dense retrieval alla baseline lessicale; quanto guadagna aggiungendo RRF e Qwen3 reranker; se i delta giustificano latenza, memoria e complessità. Il benchmark non sceglie un vector database e non progetta la Platform Architecture.

## Precondizioni

Eseguito prima dell'attività e ripetuto a chiusura:

```text
python3 validation/scripts/verify_bundle.py
VALIDATION_BUNDLE: PASS
Required files: 30
Corpus checksums: 6/6 PASS
```

B1 autorizza la ricerca testuale sui sei artifact: Marker 1.10.2 per PDF e MinerU 3.4.2 `hybrid-engine` per DOCX/XLSX. Si mantiene il limite XLSX già stabilito da B1. Non è stato scaricato alcun modello. `EmbeddingGemma` non era esposto nell'inventario `/v1/models` di oMLX consultato per questa prova; non è stato cercato in un altro runtime, installato o valutato, per non introdurre runtime o modifiche infrastrutturali.

## Setup

### Gold set e unità di retrieval

Gold set manuale di **32 query**, annotato tramite ispezione diretta degli artifact e dei chunk; nessun LLM judge ha assegnato relevance label.

| Tipo | Query | Descrizione |
|---|---:|---|
| Exact | 8 | SQL/formule testuali, nomi e ancore tecniche |
| Semantic | 8 | Parafrasi concettuali su DBMS, cybersecurity e storia |
| Contextual | 8 | Scenari docente, durata, livello, tipo di materiale e attività |
| Confusable | 4 | Contrasti tra sezioni/documenti simili |
| Negative | 4 | Richieste di contenuto assente dal corpus |

Il gold contiene 28 query positive, 63 label chunk rilevanti graduate (grade 2–3) e 23 hard-negative label. Ogni label identifica query → chunk, con `source`, artifact B1, heading/anchor e righe; ogni record chunk conserva anche gli SHA-256 di sorgente e artifact. Provenance verificata dal runner prima della valutazione. Il file gold è `validation/corpus/gold/retrieval-gold.jsonl`.

I sei documenti sono segmentati in **137 chunk structure-aware** (heading/paragrafi/tabelle; target 1.250 e cap 1.800 caratteri). I frammenti tabellari portano nel testo indicizzato gli header di colonna disponibili, senza simulare indirizzi XLSX. Il corpus contiene 6 file, con 11–41 chunk per documento.

### Candidate comparati

1. **Exact/lexical:** SQLite FTS5 BM25, tokenizzazione `unicode61 remove_diacritics=2`, query OR sui termini; priorità deterministica per frase/ancore tecniche esatte. Non è una prova di exact-only isolata: è la baseline combinata exact + lexical richiesta dal task.
2. **Dense:** Qwen3-Embedding-0.6B via oMLX; embeddings L2-normalizzati, max length 512, batch indexing 32; dot-product/coseno esatto su tutti i 137 vettori, restituiti top 50. Nessun ANN/vector DB.
3. **Fusion:** RRF `k=60` sui ranking lessicale (boost exact incluso) e dense, route limit 50.
4. **Fusion + reranker:** Qwen3-Reranker-0.6B via oMLX sui primi 20 candidati; la coda oltre 20 conserva il proprio ordine fusion.

Sono state escluse piattaforme RAG complete e non sono stati installati nuovi componenti. Nessun fallback silenzioso: fallimenti embedding/reranker 0, fallback 0.

### Misurazione

- Recall@K è la quota dei chunk gold rilevanti recuperata nei primi K, calcolata per query positiva e poi mediata tra le 28 query; MRR usa il primo chunk rilevante; nDCG@10 applica i grade manuali 2–3.
- Le query negative non entrano in Recall/MRR/nDCG; sono riportate separatamente tramite intrusioni degli hard negative in top 5. Non essendoci una soglia di astensione, il sistema restituisce sempre candidati.
- Latenza per query, singolo run sequenziale con warm-up escluso; p95 su 32 osservazioni. Gli outlier non sono stati attribuiti a una causa specifica.
- Indici SQLite e NumPy misurati su disco; RSS è del solo runner Python. La memoria oMLX viene riportata come misura aggregata del pool, non attribuita ai singoli modelli.
- Gli script riproducibili e il manifest degli hash sono in `validation/work/B2/scripts/` e `validation/artifacts/B2/MANIFEST.json`.

## Risultati

### Qualità chunk-level — 28 query positive

| Configurazione | Recall@5 | Recall@10 | MRR | nDCG@10 |
|---|---:|---:|---:|---:|
| Exact + lexical (FTS5/BM25) | 0.708 | 0.774 | 0.829 | 0.712 |
| Dense Qwen3 | 0.792 | 0.905 | 0.834 | 0.766 |
| Fusion RRF k=60 | 0.780 | 0.863 | 0.807 | 0.754 |
| Fusion + Qwen3 reranker | 0.798 | 0.896 | 0.851 | 0.780 |

### Delta marginali misurati

| Modifica | Δ Recall@5 | Δ Recall@10 | Δ MRR | Δ nDCG@10 | Lettura |
|---|---:|---:|---:|---:|---|
| Dense vs exact/lexical | +8.3 pp | +13.1 pp | +0.5 pp | +5.4 pp | Guadagno più netto in Recall@K/nDCG; valore per parafrasi e contesto, non sostituto dell'exact. |
| Fusion vs dense puro | -1.2 pp | -4.2 pp | -2.7 pp | -1.2 pp | RRF k=60 non aiuta nel complesso e abbassa MRR/Recall@10 rispetto a dense. |
| Reranker vs fusion | +1.8 pp | +3.3 pp | +4.4 pp | +2.5 pp | Migliora ranking positivo, ma con latenza alta e hard-negative peggiore. |
| Fusion + reranker vs dense puro | +0.6 pp | -0.9 pp | +1.7 pp | +1.3 pp | Il reranker non produce un miglioramento netto e ampio rispetto alla base migliore. |

Per categoria (Recall@10, medie sulle query positive della categoria), il dense rispetto alla baseline lessicale è: **exact 87.5% vs 100.0%**; **semantic 91.7% vs 83.3%**; **contextual 87.5% vs 62.5%**; **confusable 100.0% vs 50.0%**. Campioni per categoria di 4–8 query: sono descrittivi, non conclusioni generalizzabili.

### Confusione, document-level e footprint

| Configurazione | Query confusable con hard negative in top 5 | Query negative con hard negative in top 5 |
|---|---:|---:|
| Exact + lexical | 2/4 | 1/4 |
| Dense | 2/4 | 0/4 |
| Fusion | 2/4 | 2/4 |
| Fusion + reranker | **3/4** | 2/4 |

A livello documento tutte le configurazioni raggiungono Recall@5/10 = 1,00 sui positivi. Con soli sei documenti e duplicazione delle stesse fonti in più chunk, questo livello è saturo e poco discriminante; il dato guida è quello chunk-level.

| Voce | Misura |
|---|---:|
| Chunk build + indicizzazione totale | 37.48 s / 137 chunk |
| Solo embedding + scrittura vettori | 37.45 s |
| SQLite FTS5 index | 425,984 B |
| Vettori `.npy` (137 × 1024 × float32) | 561,280 B |
| Chunk JSONL | 285,056 B |
| Totale indici + chunk | 1,272,320 B (1.21 MiB) |
| Peak RSS runner | 48.78 MiB |
| Memoria aggregata riportata da oMLX | 3.99 GB, pool con 3 modelli caricati; non attribuibile per modello |

| Latenza per query (ms) | p50 | p95 | Media |
|---|---:|---:|---:|
| FTS5 exact/lexical | 0.345 | 1.294 | 0.486 |
| Dense (embedding query + scansione esatta) | 125.196 | 3703.468 | 333.840 |
| Fusion (lexical + dense) | 125.597 | 3704.813 | 334.440 |
| Reranker sui 20 candidati (solo fase) | 7718.184 | 18185.646 | 7575.227 |
| Fusion + reranker totale | 7859.715 | 18475.275 | 7909.668 |

Il dense costa circa **125 ms p50** nel singolo run, per lo più dovuti alla chiamata embedding; lo scan locale sui 137 vettori è sotto 1 ms p50. Il reranker ha **7,72 s p50** sul pool da 20, quindi circa 63× la latenza p50 del dense totale in questo test. Il p95 embedding arriva a 3,70 s; non è stata determinata la causa degli outlier e il dato non è una misura di SLA. RAM oMLX è una lettura aggregata dello stato del runtime, non un delta causale dei modelli B2.

## Failure cases e anomalie

1. **Parafrasi relazionale DBMS — `b2_009`:** dense non recupera alcun chunk gold entro top 5 (primo rilevante a rank 10); lexical ne recupera 2/3 top 5. RRF migliora a 2/3, mentre reranker scende a 1/3. Il guadagno dense aggregato non copre ogni parafrasi.
2. **Distinzione handout vs teacher script — `b2_023`:** dense primo rilevante a rank 11 e fusion a rank 8, quindi nessun chunk gold top 5; reranker ne porta uno a rank 4, mentre lexical ne ha uno top 5. La selezione per tipo/ruolo del materiale resta difficile.
3. **Flessibilità 30/60 minuti — `b2_020`:** lexical colloca la prima sezione rilevante al rank 83; dense la mette al rank 1 e trova entrambi i chunk gold top 5; fusion scende al rank 18. Il caso illustra la perdita introdotta da RRF su query contestuali.
4. **CERCA.X vs JOIN — `b2_026`:** dense trova i due chunk Excel rilevanti top 5; lexical mette il primo al rank 24. Fusion e reranker promuovono i chunk DBMS confondibili ai primi posti. È una regressione significativa proprio nel caso di disambiguazione.
5. **Contenuto assente — `b2_030`/`b2_031`:** il motore restituisce comunque risultati. Fusion e reranker hanno almeno un hard negative top 5 rispettivamente su 2/4 query negative; il dense puro su 0/4 nel gold corrente. Senza soglia/abstention non si può dire che il sistema sappia riconoscere in modo affidabile una richiesta fuori corpus.
6. **Confusabili overall:** reranker porta hard negative in top 5 in 3/4 query, peggio degli altri (2/4). Il suo incremento MRR medio rispetto alla fusion non equivale a migliore discriminazione negativa.
7. **Varianza di latenza:** sei query hanno embedding query >1 s (massimo 3,80 s); reranking p95 18,19 s. Nessuna chiamata fallita; la causa di questi outlier non è stata isolata.

Sul sottoinsieme positivo, confrontando reranker e fusion: MRR migliora in 6/28 query, resta invariato in 22/28 e non peggiora in questa misura; nDCG@10 migliora in 13, resta uguale in 10 e peggiora in 5. Questo non annulla la regressione sulle query confusable/negative né il costo di latenza.

## Interpretazione e raccomandazione

### Fatti misurati

- Dense Qwen3 supera lexical di +8,3 pp Recall@5, +13,1 pp Recall@10 e +5,4 pp nDCG@10; il delta MRR medio è piccolo (+0,5 pp), con query exact dove lexical resta migliore.
- RRF k=60 è inferiore a dense puro in tutte e quattro le metriche (da −1,2 pp a −4,2 pp). Nessun motivo misurato per attivarlo come default.
- Il reranker migliora i ranking positivi rispetto a fusion (+4,4 pp MRR; +2,5 pp nDCG@10) ma aumenta la latenza totale p50 da 126 ms a 7.860 ms e aumenta le intrusioni confusable top-5 da 2/4 a 3/4.
- Dense query latency p50 è 125 ms e il suo indice vettoriale è circa 0,54 MiB per questo corpus. Il costo marginale è modesto sul corpus di prova, ma i numeri non proiettano crescita/scaling.

### Decisione tecnica minima (provvisoria)

- **Lexical baseline:** sì — SQLite FTS5 BM25 + exact phrase/technical-anchor priority.
- **Embedding provvisorio:** Qwen3-Embedding-0.6B via oMLX.
- **Dense retrieval:** sì, per recupero semantico/contestuale; mantenere lexical per exact e degrado locale.
- **Fusion/RRF:** no come default (k=60 testato non supera dense puro).
- **Qwen3 reranker:** no come default; mantenere come opzione sperimentale solo per casi dove latenza secondaria e verificati su un gold più ampio.
- **Vector DB:** nessuna scelta; il confronto ha usato scansione coseno esatta in NumPy e FTS5 per misurare retrieval, non per approvare lo storage definitivo.

### Pipeline minima consigliata

```text
Query
  ├─ exact/keyword intent o degrado → SQLite FTS5 BM25 + exact-anchor priority
  └─ semantic/contextual → Qwen3-Embedding-0.6B via oMLX
                              + exact cosine scan sul candidate store
                              (tenere FTS come percorso fallback; niente RRF/reranker di default)
→ risultati con provenance source → artifact → chunk
```

La distinzione exact/semantic può essere una regola esplicita iniziale, non un nuovo modello/query planner. Non è stata valutata una politica di dispatch autonoma né una fusione calibrata: validarla nel successivo test retrieval prima di considerarla comportamento stabile.

## Impatto previsto sulla futura Platform Architecture (non progettazione)

I risultati suggeriscono soltanto che conviene preservare come capability separabili **lexical search**, **embedding/dense search** e, facoltativamente, **reranking**; l'indice derivato deve mantenere provenienza e poter essere rigenerato quando cambiano parser/chunker/modello. Per la route dense è utile poter degradare a FTS se oMLX/modello non risponde. Queste sono implicazioni circoscritte; **non** decidono servizio/deployment topology, API interne, schema definitivo, database, vector store, cluster, né piattaforma RAG.

## Limiti

- Sei documenti e 137 chunk non rappresentano il target 20–30 file o la varietà del corpus CORPUS; molte query e label riguardano più chunk dello stesso documento.
- Solo 4 query negative: i tassi d'intrusione hanno incertezza molto alta; non è stata misurata una soglia d'astensione o calibrazione.
- Le query contestuali sono descritte in linguaggio naturale ma non esistono metadata gold per classe/materia/freschezza/autore: non è testato il filtraggio strutturato.
- Nessun test di cold start, concorrenza, throughput, query ripetute per intervalli di confidenza, crescita dell'indice, ANN o deployment multi-host. p95 su 32 query è fragile. Il runner B2 non ha iniettato outage o testato il failover: il degrado a lexical è una raccomandazione coerente con il pattern interno, non un risultato misurato in questa prova.
- Latenza e qualità sono un singolo run su una macchina oMLX già in uso; i modelli erano parte di un pool con altri modelli caricati.
- Max length 512 con truncation; non è stato isolato l'effetto della troncatura sui pochi chunk lunghi.
- Le label sono gold manuale e riproducibile per questo piccolo set, ma non sono state adjudicate indipendentemente da un secondo valutatore.
- XLSX è valutato esclusivamente sul testo estratto da `excel_demo.md`; niente coordinate celle, formule XLSX, calcoli cell-specific o grounding cella-per-cella. Il gold include espressioni di formule come testo nel DOCX Excel, senza inferire supporto al workbook.
- EmbeddingGemma non valutato, dato non disponibile nell'inventario oMLX e divieto di introdurre runtime/modello solo per confronto.
- Nessuna misura di costo economico o consumo energetico.

## File prodotti

- `validation/corpus/gold/retrieval-gold.jsonl` — 32 query gold manuali e provenance.
- `validation/artifacts/B2/chunks.jsonl` — 137 chunk con source/artifact/hash/anchor/line range.
- `validation/artifacts/B2/index/lexical.sqlite3` — indice testuale FTS5.
- `validation/artifacts/B2/index/qwen3-embedding-0.6b.npy` — vettori densi.
- `validation/artifacts/B2/MANIFEST.json` — versioni, parametri e SHA-256 degli input/output.
- `validation/work/B2/scripts/` — build chunk, build gold e benchmark runner.
- `validation/work/B2/metrics/benchmark-results.json` — metriche aggregate, delta, latency e hash.
- `validation/work/B2/outputs/per-query-rankings.json` — ranking, score e metriche per query/configurazione.
- `validation/work/B2/logs/` — output/error stream del chunk builder.
- Questo report: `validation/results/B2-retrieval-report.md`.

**Filesystem containment check: PASS.** Tutti gli output B2 elencati sono sotto `~/Workspace/teacher-service-design/`; nessun symlink B2 rilevato. Il repository `development-environment/services/chat-history-search` è stato consultato in sola lettura; non è stato modificato. Sono stati ispezionati manifest/checksum B1 e provenance dei label.

## Non testato

- EmbeddingGemma o modelli embedding aggiuntivi; download/installazione di modelli.
- Fascia superiore ai 20–30 documenti previsti, cold start/concorrenza/scaling, ANN e vector database candidati.
- Query con filtri strutturati e una vera policy di abstention/score threshold.
- Coordinate XLSX, formule, calcoli cell-specific e grounding cella-per-cella.
- B5/B6; nessuna attività di progettazione della Platform Architecture.

## Test eseguiti e prossimo passo

- Preflight `verify_bundle.py`: PASS; integrità corpus 6/6.
- Generazione deterministica dei 137 chunk structure-aware e verifica checksum degli artifact B1.
- Validazione query gold/provenance chunk nel runner.
- Indexing FTS5 e Qwen3 embedding; tutti i 137 embedding prodotti, dimensione 1024.
- Benchmark query: 32/32; reranker 32/32; 0 errori, 0 fallback.
- Hash SHA-256 di chunk, gold, indici, script e output registrati nel manifest.
- `verify_bundle.py` ripetuto dopo la produzione: PASS.
- Non eseguiti: candidate EmbeddingGemma, stress/scaling/cold-start, astensione, formule/celle XLSX, B5/B6.

Prossimo passo limitato al gate: ampliare il gold/corpus con query negative e confusioni tra ruoli di risorsa; validare abstention e policy di dispatch senza rendere la fusion/reranker default sulla sola base di questo campione. **Non iniziare B5/B6.**
