# Agent launch matrix

| Fase | Ruolo | Sforzo | Parallelismo | Dipendenza |
|---|---|---:|---|---|
| B0 Runtime | Validation Engineer | Medium | singolo | — |
| B1 Parsing | Validation Engineer | High | singolo | B0 + corpus valido |
| B2 Retrieval | Retrieval & Knowledge Engineer | High | parallelo B2/B3/B4 | B1 GO/IMPROVE |
| B3 Models | Model Evaluation Engineer | High | parallelo B2/B3/B4 | B1 GO/IMPROVE |
| B4 Decisions | Decision Systems Engineer | Medium/High | parallelo B2/B3/B4 | B1 GO/IMPROVE |
| B5-B6 Integration | Integration & Reliability Engineer | High | singolo | B2+B3+B4 |
| FINAL | Technical Auditor / Integrator | High | singolo | B0–B6 |

## Regola operativa

Per ogni esecuzione fornire all'agente:

1. il file del ruolo in `roles/`;
2. il task in `tasks/`;
3. i report indicati come dipendenze dal task.

Preferire una **nuova esecuzione** per ogni task anche quando il ruolo è lo stesso: si riusa il ruolo, non il contesto accumulato dell'istanza precedente.
