# Gate C v2 — Transport fix e preflight attempt-03

## Esito

**PARTIAL — BLOCKED** per la ripresa completa di Gate C v2. Il parser/reader è stato corretto e le regression locali A–E richieste (più un controllo strutturale aggiuntivo F) passano. Tre route reali hanno completato Stage A con testo, identità ricostruibile e finish reason valido. Stage B non è stato completato, quindi non esiste una coorte strutturata di tre route e non si può avviare la generazione sul corpus.

**Nessun Source Set/corpus è stato inviato in attempt-03.** Tutte le richieste remote persistite contengono solo messaggi sintetici. Non è stato avviato il benchmark generation/longform.

## Letture e confronto dei raw

- `attempt-01` Gemini preflight: un heartbeat `model=keepalive` precede l’evento reale `gemini-3.8-flash-tiered`; seguono testo, `finish_reason=stop` e `[DONE]`. La nuova lettura ricostruisce 1 heartbeat, l’identità reale e il vero response ID.
- `attempt-01` Gemini DBMS generation: heartbeat intercalati al flusso reale, poi chunk del modello e terminazione. La lettura ricostruisce 6 heartbeat e un solo model ID reale. L’output storico termina con `length`; resta escluso dal benchmark valido.
- `attempt-02` Gemini: unicamente il frame vuoto `id=chatcmpl-keepalive`, `model=keepalive`, `finish_reason=null`, poi EOF. Il vecchio reader lo trattava come identità e interrompeva la connessione.

Pertanto tutte le classificazioni attempt-02 basate su quel comportamento sono **`INVALIDATED_TRANSPORT_CLIENT_BUG`**, non prove di route indisponibili. I raw storici restano intatti.

## Correzioni trasporto

È stato aggiunto `validation/shared/omniroute_sse.py` e aggiornato `run_composite_benchmark.py`:

- `is_keepalive_event()` riconosce `model=keepalive`, `id=chatcmpl-keepalive`, il payload SSE letterale `data: keepalive` e il chunk strutturalmente vuoto senza identità reale;
- heartbeat ignorati per contenuto, ID risposta, model identity e finish reason; conteggiati separatamente e mai usati per terminare lo stream;
- `actual_model_ids_seen`, requested ID, heartbeat count/IDs e response ID reale sono conservati separatamente;
- ogni model ID reale è verificato contro il catalogo per ID esatto o alias root/name univoco; identità incompatibili interrompono lo stream;
- il reader continua fino a `[DONE]`, EOF, timeout, errore di trasporto o identità reale incompatibile;
- Stage A usa timeout overall bounded di 120 s. Un timeout con soli heartbeat è `HEARTBEAT_ONLY_TIMEOUT`;
- TTFT viene misurato sul primo `delta.content` non vuoto. Reasoning, heartbeat e JSON body bufferizzati non producono TTFT;
- gli output mettono a disposizione `requested_model_id`, `actual_model_ids_seen`, `heartbeat_events`, e il terminal state del reader.

I test A–E sono sintetici e non chiamano il provider; F verifica anche che un evento vuoto con identità reale non venga classificato come heartbeat.

## Catalogo e preflight attempt-03

Il check `check_teacher_service_omniroute.py` ha dato `READY`; la lettura live `/v1/models`, usando esclusivamente `runtime_config.py`, è riuscita con HTTP 200 e 62 modelli. Lo snapshot è conservato in `validation/artifacts/Gate-C-v2-transport-fix/catalog-snapshot.json`; rispetto allo snapshot Gate C v2 precedente risultano persistenti 62 ID, nessun nuovo/scomparso e cambi del campo `created` per i 62 record. Gli ID per i candidati sono stati selezionati dalla risposta live, non da una shortlist presunta.

| Stage A candidate | ID reale osservato | Heartbeat | TTFT | Totale | Esito |
|---|---|---:|---:|---:|---|
| `agy/gemini-3.8-flash-tiered` | `gemini-3.8-flash-tiered` (root univoca) | 1 | 2.394 s | 2.414 s | **ROUTE_OPERATIONAL** |
| `groq/qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | 0 | 0.607 s | 0.628 s | **ROUTE_OPERATIONAL** |
| `openrouter/dots-studio/dots-3-note-preview:free` | `dots-studio/dots-3-note-preview:free` | 0 | 1.843 s | 2.226 s | **ROUTE_OPERATIONAL** |

Tutte e tre hanno HTTP 200, contenuto non vuoto e `finish_reason=stop`. Il tempo Gemini include l’heartbeat iniziale, ma TTFT decorre fino al primo testo reale. Il gateway/provider ha esposto usage token; non ha esposto un costo affidabile, quindi `cost=unknown`.

Altri tentativi sintetici registrati prima dello stop:

- `groq/openai/gpt-oss-120b`: identità valida ma nessun testo e `finish_reason=length`; non operativo per questa probe.
- `openrouter/thinkingmachines/inkling-small:free`: 13 heartbeat e EOF senza model event/contenuto; non classificato come timeout, perché la connessione è terminata invece di scadere.
- `openrouter/thinkingmachines/inkling-small:free-high`: il driver ha seguito il ramo HTTP 401/403 e si è fermato. Il primo driver non ha persistito il codice esatto o il body; non è possibile attribuire il rifiuto alla credenziale gateway o all’autorizzazione della singola route. Non è stata usata alcuna credenziale alternativa e non sono state fatte ulteriori chiamate.

### Stage B e anomalia del driver

Stage B **non è stato eseguito**. Dopo aver scritto correttamente le metriche dei primi tre Stage A, il primo driver attempt-03 ha generato un `AttributeError` locale valutando `startswith()` su `error=null`, e ha marcato erroneamente tutte e tre le route operative come failure, senza proseguire a Stage B. L’anomalia è stata individuata e corretta in `run_attempt03_preflight.py`; non sono state ripetute chiamate remote dopo il successivo ramo HTTP 401/403 non attribuibile.

Quindi:

- Stage A operational: 3 route;
- Stage B `STRUCTURED_OUTPUT_SUPPORTED`: 0 route testate;
- coorte completa: nessuna;
- il supporto JSON Schema non è inferito dalle dichiarazioni del catalogo;
- il full rerun Gate C v2 rimane bloccato fino a Stage B valido su tre route.

Il nuovo selector canonicalizza inoltre gli alias OpenRouter per effort tier, evitando di trattare varianti `:free-low/high/...` come modelli sottostanti indipendenti.

## Stato remote.reasoning

L’evidenza precedente Gemini resta **`HISTORICAL_ELIGIBLE`**. Il corretto Stage A attempt-03 dimostra **`CURRENT_ROUTE_OPERATIONAL`** per la route Gemini. La qualità del reasoning non è stata rivalutata.

## Esito vincoli

- Credenziale: caricata esclusivamente con `validation/shared/runtime_config.py`; check live passato. Nessuna credenziale condivisa/provider o fallback è stata usata.
- OmniRoute e `development-environment`: non modificati. Il README esterno è stato consultato solo come documentazione.
- Benchmark epistemico, Source Set, rubriche, Gate B: non modificati.
- Nessun corpus inviato, nessun benchmark completo avviato.
- Costi non esposti in modo affidabile: `unknown`.

## Artifact principali

- Parser tests: `validation/artifacts/Gate-C-v2-transport-fix/parser-regression-tests.json`
- Attempt-03 preflight: `validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json`
- Transport metrics: `validation/artifacts/Gate-C-v2-transport-fix/transport-metrics.json`
- Live catalog snapshot: `validation/artifacts/Gate-C-v2-transport-fix/catalog-snapshot.json`
- Manifest: `validation/artifacts/Gate-C-v2-transport-fix/MANIFEST.json`
- Raw attempt-03: `validation/work/Gate-C-v2/outputs/attempt-03/`
- SSE helper: `validation/shared/omniroute_sse.py`
- Corrected composite runner: `validation/work/Gate-C-v2/scripts/run_composite_benchmark.py`
- Preflight-only driver: `validation/work/Gate-C-v2/scripts/run_attempt03_preflight.py`

**Gate C v2 rerun: BLOCKED.** La correzione SSE e Stage A sono verificate; mancano le prove Stage B necessarie per una coorte strutturata di tre route.


## Addendum — Stage B structured-output attempt-04 (2026-09-30T17:42:28.803153+00:00)

Stage B è stato eseguito con probe sintetiche `response_format.type=json_schema`, `strict=true`, riutilizzando le tre evidenze Stage A PASS di attempt-03 senza nuove chiamate Stage A. Nessun corpus, generation o longform è stato inviato/eseguito. La semantica 401/403 è stata corretta: rifiuti isolati di route sono `ROUTE_ACCESS_DENIED`; `AUTH_REQUIRED_TEACHER_SERVICE` globale richiede 401/403 sul GET `/v1/models` iniziale o sul controllo indipendente effettuato dopo un rifiuto di una route precedentemente operativa.

Esito attempt-04: **READY_FOR_GATE_C_V2_RERUN**. Stage B per le tre route originarie: `agy/gemini-3.8-flash-tiered` = `STRUCTURED_OUTPUT_SUPPORTED`; `groq/qwen/qwen3.8-27b` = `STRUCTURED_OUTPUT_SUPPORTED`; `openrouter/dots-studio/dots-3-note-preview:free` = `STRUCTURED_OUTPUT_SUPPORTED`. Reserve provate: nessuna. Cohort: `agy/gemini-3.8-flash-tiered`, `groq/qwen/qwen3.8-27b`, `openrouter/dots-studio/dots-3-note-preview:free`. Route access-denied count: 0. Stato Gemini invariato: `remote.reasoning=HISTORICAL_ELIGIBLE`, `current route=CURRENT_ROUTE_OPERATIONAL`.

Report dettagliato: `validation/results/Gate-C-v2-structured-preflight-report.md`; artifacts: `validation/artifacts/Gate-C-v2-structured-preflight/`. La cronologia e i file attempt-03 restano invariati.
