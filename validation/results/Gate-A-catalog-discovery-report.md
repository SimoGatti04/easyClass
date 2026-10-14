# Gate A — Catalog Discovery & Model Registry Report

> **Stato:** Formalmente Eseguito e Validato
> **Ruolo:** Model Platform Engineer
> **Data:** 30 settembre 2026
> **Workspace:** `~/Workspace/teacher-service-design`

---

# Executive result

**PASS**

Tutti i 9 test minimi di discovery, normalizzazione, merging, ciclo di vita, semantica di aggiornamento e secret hygiene sono stati eseguiti con successo.

---

# Runtime sources

### OmniRoute (Remote Gateway)
- **status:** AVAILABLE (200 OK)
- **endpoint class:** LAN (http://198.51.100.13/v1/models)
- **auth status:** AUTHENTICATED
- **latency:** 27.06 ms
- **model count:** 8

### oMLX (Local MLX Engine)
- **status:** AVAILABLE (200 OK)
- **endpoint class:** LOCAL (http://127.0.0.1:8000/v1/models)
- **auth status:** AUTHENTICATED
- **latency:** 3.95 ms
- **model count:** 6

---

# Normalized Registry

### Schema
La rappresentazione `ModelDescriptor` normalizza sia i gateway OpenAI-compatibili remoti che gli engine MLX locali secondo la specifica canonica:
- `canonical_id`: Identificativo univoco deterministico (`{source_catalog}/{provider}/{model_name}`)
- `source_catalog`: Provenienza (`omniroute` | `omlx`)
- `provider`: Vendor logico (`agy`, `codex`, `github`, `opencode`, `omlx`)
- `provider_model_id`: ID originario comunicato dal fornitore
- `execution_location`: Topologia fisica (`local` | `remote`)
- `modalities`: Lista modalità input (`['text']`, `['text', 'image']`)
- `declared_capabilities`: Specifica dichiarata (vision, tool calling, reasoning, structured output, embedding, reranking)
- `observed_capabilities`: Evidenza empirica verificata dai benchmark (non desunta da metadata)
- `context_window` e `output_limit`: Finestre di contesto e limiti di output
- `lifecycle_status`: Stato di lifecycle (`DISCOVERED` | `COMPATIBLE`)
- `availability`: Disponibilità attuale (`available` | `unavailable`)
- `discovered_at` / `last_seen_at`: Timestamp tracciati
- `raw_metadata_hash`: Checksum SHA-256 del payload grezzo

### Counts
- **Remote Models (OmniRoute):** 8
- **Local Models (oMLX):** 6
- **Total Canonical Descriptors:** 14
- **Collisions / Duplicates:** 0

### Identity Strategy
La collisione accidentale tra modelli omonimi su provider differenti o versioni locali/remote dello stesso modello è prevenuta dalla strategia di namespace canonico `source_catalog/provider/model_name`. Il display name è trattato come informazione descrittiva per la UI e non partecipa alla chiave primaria del registro.

---

# Declared vs Observed

La separazione tra dati dichiarati dal fornitore ed evidenze empiriche verificate in produzione è rigorosamente preservata:

1. **Modello locale verificato con evidenza empirica B0 (`MiniCPM5-2B-MLX`):**
   - `declared_capabilities.text_generation`: `true`
   - `observed_capabilities.text_generation`: `true` (validato nel benchmark B0)
   - `observed_capabilities.reasoning`: `unknown` (nessun benchmark ha validato reasoning)
   - `observed_capabilities.vision`: `unknown` (non validato in B0)

2. **Modello embedding locale verificato in B0 (`Qwen3-Embedding-0.6B`):**
   - `declared_capabilities.embedding`: `true`
   - `observed_capabilities.embedding`: `true` (validato in B0)
   - `observed_capabilities.text_generation`: `false`

3. **Modello reranker locale verificato in B0 (`Qwen3-Reranker-0.6B`):**
   - `declared_capabilities.reranking`: `true`
   - `observed_capabilities.reranking`: `true` (validato in B0)
   - `observed_capabilities.text_generation`: `false`

4. **Modello remoto scoperto privo di test empirico interno (`agy/gemini-3.8-flash-tiered`):**
   - `declared_capabilities.reasoning`: `true` (dichiarato da OmniRoute)
   - `declared_capabilities.tool_calling`: `true` (dichiarato da OmniRoute)
   - `declared_capabilities.vision`: `true` (dichiarato da OmniRoute)
   - `observed_capabilities.reasoning`: `unknown` (in attesa di Gate B/C)
   - `observed_capabilities.tool_calling`: `unknown`
   - `observed_capabilities.vision`: `unknown`

---

# Lifecycle

- **DISCOVERED:** 0
- **COMPATIBLE:** 14
- **VALIDATED:** 0 (nessuna promozione arbitraria prima dei benchmark)
- **ELIGIBLE:** 0

Tutti i 14 modelli scoperti sono stati classificati come `COMPATIBLE` poiché dichiarano o supportano almeno uno dei profili didattici e architetturali standard del Teacher Service.

---

# Profile candidate matrix

| Profilo Standard | Candidati Dichiarati | Note Architetturali |
|---|---|---|
| `local.embedding` | 1 | Valutazione statica candidata (validated=false) |
| `local.semantic_small` | 3 | Valutazione statica candidata (validated=false) |
| `local.reranker` | 1 | Valutazione statica candidata (validated=false) |
| `local.typed_decision` | 4 | Valutazione statica candidata (validated=false) |
| `remote.fast` | 1 | Valutazione statica candidata (validated=false) |
| `remote.generation` | 8 | Valutazione statica candidata (validated=false) |
| `remote.longform` | 8 | Valutazione statica candidata (validated=false) |
| `remote.reasoning` | 8 | Valutazione statica candidata (validated=false) |
| `remote.research` | 7 | Valutazione statica candidata (validated=false) |
| `remote.multimodal` | 4 | Valutazione statica candidata (validated=false) |

---

# Registry update semantics

- **A. Nuovo modello:** Viene registrato come `DISCOVERED` o `COMPATIBLE` a seconda dei requisiti minimi.
- **B. Modello già noto:** Snapshot successivi aggiornano metadati e `last_seen_at` preservando la data originaria `discovered_at` e le osservazioni empiriche acquisite.
- **C. Modello scomparso dal catalogo:** Il test di simulazione ha confermato che il modello **non viene cancellato**, ma marcato `availability = 'unavailable'`, mantenendo lo storico intatto per provenance e auditabilità.
- **D. Collisioni cross-source:** Simulazione confermata: due modelli con lo stesso provider_model_id su fonti diverse generano canonical ID distinti (`omnx/omlx/...` vs `omniroute/omniroute/...`).
- **E. Modifica di display name / alias:** La variazione di display name aggiorna il descrittore senza alterare il canonical ID o distruggere l'identità storica.

---

# Secret hygiene

**PASS**

Nessuna credenziale, token API o secret è presente nei file JSON esportati, nei log, nei manifest o nei report. Le chiavi sono lette a runtime da variabili d'ambiente o configurazioni locali protette non tracciate nel repository.

---

# Failures / anomalies

- Nessuna anomalia bloccante.
- OmniRoute ha risposto correttamente via LAN (http://198.51.100.13/v1/models) con 8 modelli.
- oMLX ha risposto correttamente via LOCAL (http://127.0.0.1:8000/v1/models) con 6 modelli.
- I modelli remoti GPT-6 in OmniRoute usano il protocollo `responses` specificato nelle note.

---

# Files produced

- `validation/artifacts/Gate-A/model-registry.json`
- `validation/artifacts/Gate-A/catalog-snapshot-summary.json`
- `validation/artifacts/Gate-A/MANIFEST.json`
- `validation/work/Gate-A/outputs/raw_omniroute_catalog.json`
- `validation/work/Gate-A/outputs/raw_omlx_catalog.json`
- `validation/work/Gate-A/outputs/normalized_descriptors.json`
- `validation/work/Gate-A/metrics/gate_a_metrics.json`
- `validation/work/Gate-A/logs/gate_a_run.log`

---

# Next gate readiness

**READY_FOR_GATE_B**

