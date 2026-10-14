# Gate C v2 — structured-output preflight attempt-04

## Esito

**READY_FOR_GATE_C_V2_RERUN**. La coorte richiede tre root distinte con Stage A `ROUTE_OPERATIONAL`, Stage B `STRUCTURED_OUTPUT_SUPPORTED`, JSON parse valido, schema valido e semantica esatta. Nessun corpus è stato letto/inviato; nessuna generation o longform è stata eseguita.

## Stage B sulle tre route Stage A già validate in attempt-03

| Model ID | Classificazione Stage B | Protocol supported | JSON parse | Schema | Semantica |
|---|---|---:|---:|---:|---:|
| `agy/gemini-3.8-flash-tiered` | STRUCTURED_OUTPUT_SUPPORTED | True | True | True | True |
| `groq/qwen/qwen3.8-27b` | STRUCTURED_OUTPUT_SUPPORTED | True | True | True | True |
| `openrouter/dots-studio/dots-3-note-preview:free` | STRUCTURED_OUTPUT_SUPPORTED | True | True | True | True |

Le evidenze Stage A sono riutilizzate senza ripetere le chiamate: `validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json`. `remote.reasoning` resta `HISTORICAL_ELIGIBLE`; la route Gemini resta `CURRENT_ROUTE_OPERATIONAL`. Stage B non rivaluta la qualità reasoning.

## Reserve routes provate

- Nessuna reserve provata.

Reserve selezionate dal catalogo live, con massimo 12 root distinte. Per reserve con capability reasoning dichiarata il budget sintetico è aumentato a 2048 token, rispetto ai 96 token che GPT-OSS aveva esaurito in reasoning nell'attempt-03. Se anche il budget maggiorato termina `length` senza testo, l'esito è limitato a questo preflight e non costituisce classificazione permanente di route unavailable. Nessun prompt tuning qualitativo.

## Semantica HTTP 401/403

Un 401/403 su singola route è classificato `ROUTE_ACCESS_DENIED`, persistendo status HTTP esatto, model ID, stage, timestamp, body sanitizzato, request ID e classification; non interrompe le route successive. Se una route già operativa riceve 401/403, il driver esegue un GET `/v1/models` indipendente: solo un 401/403 anche sul controllo globale produce `AUTH_REQUIRED_TEACHER_SERVICE` e stop.

## Coorte

- Route access-denied: 0
- Structured-output supportate (protocollo): `agy/gemini-3.8-flash-tiered`, `groq/qwen/qwen3.8-27b`, `openrouter/dots-studio/dots-3-note-preview:free`
- Cohort Model ID: `agy/gemini-3.8-flash-tiered`, `groq/qwen/qwen3.8-27b`, `openrouter/dots-studio/dots-3-note-preview:free`
- Stato Gemini current route: `CURRENT_ROUTE_OPERATIONAL`
- Rerun Gate C v2: **READY_FOR_GATE_C_V2_RERUN**

## Evidenze

- Preflight: `validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json`
- Metriche: `validation/artifacts/Gate-C-v2-structured-preflight/structured-output-metrics.json`
- Manifest: `validation/artifacts/Gate-C-v2-structured-preflight/MANIFEST.json`
- Raw sintetici: `validation/work/Gate-C-v2/outputs/attempt-04/`
- Catalogo live: `validation/work/Gate-C-v2/outputs/attempt-04/live-catalog-snapshot.json`
