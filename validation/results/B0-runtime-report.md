# B0 — Runtime & Environment Verification

## Metadata
- **Agent:** B0 — Runtime & Environment Verification
- **Date:** 29 settembre 2026 (CEST)
- **Host:** Mac mini Apple M4, 24 GiB unified memory
- **Software versions:** oMLX 0.6.4; Ollama 0.34.4; MinerU 3.4.2; Marker marker-pdf 1.10.2; Open WebUI 0.11.4; chat-history-search 1.0.0; Rizzo Flow runtime llama.cpp b11081.
- **Workspace:** `~/Workspace/teacher-service-design`

## Objective
Accertare con richieste runtime che i componenti già presenti funzionino oggi, senza installare o cambiare infrastruttura.

## Results
| componente | versione | endpoint | modello/backend | test reale eseguito | risultato | note |
|---|---|---|---|---|---|---|
| oMLX | 0.6.4 | `127.0.0.1:8000`, LAN | MLX / Apple Silicon | health, models, chat, embedding, rerank | **PASS** | MiniCPM5, Qwen3 embedding e reranker invocati |
| Ollama | 0.34.4 | `127.0.0.1:11434` | `nomic-embed-text` | tags, ps, embedding | **PARTIAL** | nessun generative model installato |
| MinerU | 3.4.2 | CLI | hybrid-engine / mlx-engine | parse reale PDF smoke | **PASS** | Markdown utilizzabile |
| Marker | marker-pdf 1.10.2 | CLI | Apple Silicon; TableRec CPU fallback | stesso PDF smoke | **PASS** | Markdown prodotto |
| Rizzo Flow / Spark-X2.5 | service version non esposta | `127.0.0.1:8017` | Spark-X2.5-4B Q8_0 / Metal | health + typed decision | **PARTIAL** | API pronta; status CLI discordante |
| OmniRoute | version non esposta | `http://198.51.100.13/v1` | provider remoti | models + completion | **PASS** | `agy/gemini-3.7-flash-tiered` riuscito |
| Open WebUI | 0.11.4 | `127.0.0.1:8080` | backend oMLX | status + health | **PARTIAL** | `/api/models` anonimo = 401 |
| chat-history-search | 1.0.0 | `127.0.0.1:8765` | FTS5 + dense + RRF + Qwen | CLI/source inventory | **PARTIAL** | harness presente, nessun B2 runtime |

## oMLX models observed
- `MiniCPM5-2B-MLX`
- `Ornith-1.5-9B-MLX-4bit`
- `Ornith-1.5-9B-uncensored-MLX-6bit`
- `Qwen3-Embedding-0.6B`
- `Qwen3-Reranker-0.6B`
- `Qwen3.8-27B-oQ4e-mtp`

No Gemma 4 candidate was present in the API inventory.

## Important anomalies
1. Rizzo Flow CLI status disagreed with working listener/health/API.
2. Open WebUI authenticated model discovery not verified.
3. Ollama had no generative model installed.
4. MinerU/Marker warnings were non-blocking.
5. chat-history-search components were present but B2 was not run.

## Decision
**PARTIALLY READY**

The original corpus blocker has now been resolved by including the six real B1 source files and SHA-256 manifest in this validation bundle.

## Next step
Run B1 document parsing against the staged real corpus.

Filesystem containment check: PASS
