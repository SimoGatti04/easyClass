# B0 — Environment Verification

> Stato: **static inventory completed; B0 runtime checks executed on 2026-09-29; overall PARTIALLY READY**

> Source: current development-environment service documentation and configuration.

## 1. Verified present in workspace

| Capability | Service | Static status | Network/API |
|---|---|---|---|
| MLX inference | oMLX | configured | `0.0.0.0:8000`, OpenAI-compatible chat/embeddings/rerank |
| GGUF/general local | Ollama | present in development environment | network-capable runtime |
| Remote/API gateway | OmniRoute | deployed on K3s/homelab | LAN + WAN ingress documented |
| Document parsing | MinerU | installed/configured | CLI today; remote worker adapter required for Teacher Service |
| Document fallback | Marker | installed/configured | CLI today; remote worker adapter optional |
| Typed decisions | Rizzo Flow / Spark-X2.5 | installed/configured | `0.0.0.0:8017`, `POST /v1/decisions` |
| RAG/test harness | Open WebUI | installed/configured | `127.0.0.1:8080` |
| Retrieval reference implementation | chat-history-search | implemented/benchmarked | local CLI/UI, oMLX embeddings/reranking |
| Embeddings | Qwen3-Embedding-0.6B | already used | through oMLX `/v1/embeddings` |
| Reranking | Qwen3-Reranker-0.6B | already used | through oMLX `/v1/rerank` |
| Speech | mlx-whisper-cli | present | later capability, not T1 priority |

## 2. Important observations

### oMLX

Already matches the desired architecture well:

- service rather than in-process dependency;
- MLX/Apple Silicon;
- chat + embeddings + reranking;
- binds `0.0.0.0`;
- model storage centralized;
- already consumed by other local services.

This should be the first runtime used in B3/B2 for MLX candidates.

### Rizzo Flow

Already exposes a bounded semantic decision service:

```text
POST /v1/decisions
```

Configured on `0.0.0.0:8017`.

This is directly suitable for B4 without building a new wrapper first.

### MinerU

Installed and configured with:

- hybrid-engine default;
- OCR;
- table parsing;
- formula parsing;
- image analysis;
- PDF/DOCX/PPTX/XLSX/images.

Current local integration is CLI-oriented.

For the Teacher Service, do not assume in-process use: benchmark the parser first, then wrap it behind a small capability-specific HTTP worker only if/when Platform Architecture requires remote deployment.

### Marker

Already available as a second parser implementation, including MPS acceleration and structured output options.

Use primarily for comparative B1 tests or fallback.

### OmniRoute

Already provides a remote/provider gateway and is deployed separately from the main workstation.

This proves that the environment already uses distributed AI components.

Use it in B3 only as an optional external quality reference, not as T1 dependency.

### chat-history-search

This is an important reusable internal reference.

Already contains:

- lossless source provenance;
- FTS5 lexical retrieval;
- exact matching;
- dense retrieval;
- RRF;
- Qwen3-Embedding-0.6B;
- Qwen3-Reranker;
- benchmark/gold-query workflow;
- resumable indexing.

Before selecting a new RAG framework, B2 should reuse its evaluation patterns and, where sensible, generic retrieval components.

## 3. Dynamic checks still required

Static configuration does not prove that each process is running correctly today.

The following runtime checks must be executed on the real development hosts:

### oMLX

```bash
omlx --version
curl -f http://127.0.0.1:8000/v1/models
```

Then test one chat request, one embedding request, one rerank request, and capture the selected model list.

### Rizzo Flow

```bash
rizzo-flow status
curl -f http://127.0.0.1:8017/
```

Then one `/v1/decisions` call.

### MinerU

```bash
mineru --help
```

Then parse one small representative PDF.

### Marker

```bash
marker --help
```

Then parse the same PDF.

### Ollama

```bash
ollama list
```

Then one model invocation if a relevant model is installed.

### OmniRoute

Use the documented LAN endpoint and issue one minimal Responses/OpenAI-compatible request to a configured remote model.

## 4. B0 acceptance criteria

B0 is complete when:

1. required executables/services answer;
2. model inventories are captured;
3. endpoint versions are known;
4. at least oMLX, MinerU and one generation model complete a real request;
5. Rizzo Flow completes one typed decision;
6. failures/dependencies are recorded rather than silently fixed by adding new infrastructure.

## 5. Current result

### Static readiness

**PASS**

The development environment already contains nearly all components required for the first feasibility gate.

### Runtime readiness

**PARTIALLY READY — verificato il 29 settembre 2026** sul Mac mini Apple Silicon disponibile. oMLX ha superato health, inventario modelli, chat, embedding e rerank; MinerU e Marker hanno completato lo stesso smoke PDF (4 pagine); OmniRoute ha risposto a una completion remota; Rizzo Flow ha restituito una decisione tipizzata. Ollama dispone solo di un modello embedding (inferenza riuscita); Open WebUI è attivo ma `/api/models` non autenticato restituisce 401; `rizzo-flow status` è discordante con listener/API pronti. Dettagli, output e avvertenze sono nel report `validation/results/B0-runtime-report.md`.

**Prerequisito ancora aperto per B1:** il corpus didattico dichiarato in `/CORPUS/LEZIONI` non era disponibile sul host. Entrambi i parser funzionano sul documento smoke interno, ma prima del benchmark rappresentativo va fornito un sottoinsieme non sensibile del corpus reale. Nessuna infrastruttura o configurazione è stata modificata.
Nessun nuovo servizio va installato prima che i benchmark B1/B2 dimostrino un gap concreto.
