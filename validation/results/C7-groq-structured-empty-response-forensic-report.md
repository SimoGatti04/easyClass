# C7 Groq structured empty-response — forensic offline audit

**Data audit:** 6 ottobre 2026  
**Preflight:** `groq-continuation-preflight-20261006T211511453133Z-04b88ccb`  
**Esito audit:** **PASS** — analisi offline completata; nessuna modifica a codice o artifact esaminati; nessuna nuova chiamata remota.  
**Verdetto principale:** `PROVIDER_TERMINAL_EMPTY_RESPONSE`  
**Next decision class:** `READY_FOR_STRUCTURED_CAPABILITY_DECISION`

> Il verdetto descrive esclusivamente il comportamento osservato nella singola synthetic structured probe. Non conclude che Groq/Qwen non supporti JSON Schema e non promuove/demote alcuna route.

## 1. Ambito e preservazione

Analizzato il preflight sotto:

`~/Workspace/teacher-service-design/validation/work/C7/continuation-preflights/groq-continuation-preflight-20261006T211511453133Z-04b88ccb/`

L'audit è read-only. È stata calcolata la baseline SHA-256 degli 11 file nel target prima dell'analisi; sono stati inclusi nel controllo anche gli artifact storici e i runner/parser consultati, per un totale di 29 file. Dopo la stesura del report tutti i 29 hash sono rimasti identici (**29/29 preservati**). Nessun codice o artifact storico è stato modificato.

Nuove chiamate di rete nell'audit: **0**. I contatori del preflight sono storici: 1 GET catalog + 1 route probe base + 1 structured probe = 3; `corpus_call_count = 0`.

## 2. Operazioni distinte

| Operazione | operation_attempt_id | pipeline_stage | request_kind (runner) | HTTP | Identity | finish | termination | content | body persistito / SSE |
|---|---|---|---|---:|---|---|---|---|---|
| Base route probe | `op_0ea526032d384df592bdf945403b7d52` | `ROUTE_PROBE` | `synthetic_preflight` | 200 | `VERIFIED` (`unique_catalog_alias`) | `stop` | `done` | presente, 5 caratteri | 1.349 byte; 5 data frame: 4 JSON + `[DONE]`; 0 heartbeat |
| Structured route probe | `op_7234bbc26b374b96868abf1b7ff9a3d2` | `STRUCTURED_ROUTE_PROBE` | `c7_groq_structured_preflight` | 200 | `VERIFIED` (`unique_catalog_alias`) | `stop` | `done` | assente, 0 caratteri | 541 byte; 3 data frame: 2 JSON + `[DONE]`; 0 heartbeat |

Entrambe richiedevano `groq/qwen/qwen3.8-27b`; il provider ha restituito `qwen/qwen3.8-27b`, risolto univocamente dal catalogo live. La base probe è un controllo route distinto e riuscito: non va confusa con la risposta structured vuota.

Usage: la base probe registra 32 prompt token, 2 completion token, 34 totali. Usage è assente sia dal flusso structured sia dal suo call record (`usage = null`).

## 3. Request structured effettivamente persistita

Sono stati ispezionati `model-visible-request.json` e `structured-request.json`, inclusa la decodifica del messaggio user. I controlli strutturali sono PASS:

- model `groq/qwen/qwen3.8-27b`; famiglia endpoint OpenAI-compatible `/chat/completions`;
- `response_format.type = json_schema`, `strict = true`;
- schema provider-facing uguale alla trasformazione strict del renderer C6 corrente; il payload JSON del messaggio user coincide con `structured-request.json`;
- `max_tokens = 512`, `stream = true`, `temperature = 0.2`, `top_p = 0.9`, `stream_options.include_usage = true`;
- request-kind e route-probe flag appartengono al percorso production structured preflight, non a un test-only builder.

**Corpus-free request = PASS.** La struttura persistita mostra `source_context.sources = []`, contenuto sintetico, `evidence_prompt_view = null`, `task_context.source_ids = []` e `source_hashes = {}`. I valori sono placeholder (`scenario_id = synthetic`, `source_ids = [synthetic-source.md]`). Non compaiono i file reali noti `excel_demo_b1.md`, `excel_teacher.md`, `excel-workbook-ast-projection.json` o `dbms_student_lesson.md`, né hash sorgente, AST/workbook o evidence items.

### Complessità schema (probe sintetica)

- proprietà top-level: 2 (`lesson_plan`, `metadata`), entrambe required;
- profondità massima dei nodi schema: 4;
- nodi object: 4; nodi array: 7;
- `additionalProperties = false` su tutti e 4 gli object;
- 3 enum: tipo attività, ruolo epistemico e source ID sintetico;
- 4 const: durate, scenario sintetico e flag booleano;
- dimensione JSON canonica minificata: 2.132 byte.

Hash distinti per superfici distinte: schema locale `5f47ebd76ae68ce159255d2263d3180fbe7d7adf643d32044cfe1fc1869cb405`; schema incluso nel `response_format` strict `8ef3008569ddfc19526cf404567e640a30ae994c89ebe09f343f9c01f374bf72`. Il renderer rimuove il marker locale `schema_version` e adatta `required` per la modalità strict. Non è una discordanza dell'artifact. Il manifest preflight registra shape originale/sintetica equivalenti (`044c409680bce74db0118ff6e907d341e9f11fd7eee1e048a92c9c1d5ba31381`), oltre a task-contract e request-contract shape equivalenti.

## 4. Raw SSE, evento per evento

Il conteggio di **541 byte** è quello del body SSE sanitized persistito (non include header HTTP). I tre data frame sono:

1. **JSON:** una scelta in `choices`; `delta` ha `role=assistant` e `content=""`; `finish_reason=null`. Presenti metadati di risposta/modello e `x_groq` con soli metadati provider-specifici (non testo di completamento).
2. **JSON:** una scelta; `delta` vuoto; `finish_reason="stop"`. Nessun `message.content`, usage, refusal o tool call.
3. **Terminale:** `data: [DONE]`.

Nessun heartbeat/commento SSE, evento `error`, refusal, testo reasoning o testo in campi provider-specifici. Usage assente. L'ID del secondo chunk differisce da quello del primo; il parser conserva il primo response ID. Entrambi i chunk riportano il medesimo model alias verificabile. La variazione di ID non genera incompatibilità tra raw stream, call record e summary: questi sono coerenti sui campi registrati (primo ID, identità, `stop`, `done`, content vuoto).

**`TRANSPORT_COMPLETE = YES`; `TRANSPORT_INCOMPLETE = NO`.** Il flusso raggiunge `[DONE]`, quindi non è EOF anomalo né una sequenza composta solo da heartbeat.

## 5. Replay parser C6 e field-aware replay

Il body SSE persistito è stato passato offline a `validation.shared.omniroute_sse.parse_sse_payload`, con il requested model ID e il catalog snapshot persistito. `CURRENT_PARSER_REPLAY_RESULT`:

```json
{
  "content": "",
  "finish_reason": "stop",
  "termination": "done",
  "identity_verified": true,
  "returned_model_id": "qwen/qwen3.8-27b",
  "heartbeat_events": 0,
  "wire_data_events": 3,
  "actual_events": 2,
  "usage": null
}
```

Il replay coincide con il call record nei campi omologhi. Il client classifica `OPERATIONAL_ERROR` perché il testo visibile è vuoto nonostante HTTP 200, identità verificata e completamento terminale. `TransportBlocked` è il tipo di eccezione usato dal wrapper per propagare un esito non-success; in questo caso il suo nome non significa guasto di trasporto.

L'ispezione manuale di tutti i campi rilevanti conferma che non c'è output alternativo ignorato: `delta.content` è vuoto o assente; `message`/`message.content`, `reasoning`, `reasoning_content`, `refusal`, `tool_calls` ed `error` sono assenti; `x_groq` non contiene testo modello. **Parser/raw disagreement = NO**; il parser production non ha estratto testo (**NO**); il raw non contiene testo modello utilizzabile (**NO**). JSON parse e schema validation sono `NOT_RUN`, correttamente, non essendoci JSON da validare.

## 6. Confronto storico read-only

### Gate C attempt-09 e generation DBMS

Il `phase2-matrix.json` di attempt-09 marca generation e longform run-02 `NOT_RUN`. L'artifact DBMS generation aggregato sotto attempt-09 è etichettato `phase1-attempt-07-run-01`: la chiamata remota sottostante è la Phase 1 di attempt-07, non una nuova generation DBMS attempt-09.

Quella request storica usa lo stesso model ID e la stessa famiglia `/chat/completions`, streaming e `response_format.type=json_schema` strict; il budget era `max_tokens=9000`. Ha HTTP 200, identità verificata, content non vuoto (12.191 caratteri, non riprodotti), `finish_reason=stop`, termination `done`, 5 wire data event (4 eventi modello + `[DONE]`), usage presente. I controlli deterministici registrati attestano JSON parse, schema e semantic validation validi; il replay offline del relativo SSE conferma content non vuoto e zero heartbeat.

**Esiste una precedente riuscita sullo stesso protocollo strutturato di alto livello: YES.** Era però una diversa request/schema e un budget maggiore. Il request/run-metrics Gate C non registra un `renderer_version` C6 esplicito; il runner Gate C costruisce il body autonomamente, quindi l'uguaglianza dell'esatta versione renderer C6 non è attestabile. È attestata la stessa famiglia wire `json_schema` strict.

### C7 CORR-05 e altre structured call

- CORR-05 del 2 ottobre con renderer C6 v2: HTTP 200 ma stream incompleto; 11 heartbeat, poi un frame provider con campo `error`; nessun contenuto/identità verificata/finish reason, nessun `[DONE]`, termination `eof`. Classificazione persistita: `ENVIRONMENT_TRANSPORT_FAILURE`. Non è una risposta terminale vuota né una riuscita structured.
- Il precedente CORR-05 con renderer v1 ha HTTP 400 e content assente; non costituisce successo.
- Il preflight continuation precedente del 6 ottobre contiene solo una base `ROUTE_PROBE` riuscita e nessuna structured remote call. Anche la base probe dell'attuale preflight non verifica JSON Schema.

Questi record sono contesto comparativo: non cambiano la diagnosi della structured probe corrente e non giustificano una conclusione di supporto/non-supporto permanente.

## 7. Risposta deterministica e verdict

- `RAW_STREAM_CONTAINS_USABLE_MODEL_TEXT = NO`.
- Errore/refusal provider nel flusso structured corrente: **NO**.
- `TRANSPORT_COMPLETE = YES`.
- Parser production ha estratto testo: **NO**; disaccordo parser/raw: **NO**.
- `response_format=json_schema, strict=true` effettivamente inviato: **YES**.
- Request corpus-free: **PASS**.
- Storica riuscita stesso protocollo di alto livello: **YES**; renderer C6 esatto non attestato per Gate C.
- Inconsistenza artifact: **NO**.

**Verdict principale (esattamente uno):** `PROVIDER_TERMINAL_EMPTY_RESPONSE`.  
**Next decision class (esattamente una):** `READY_FOR_STRUCTURED_CAPABILITY_DECISION`.

La singola risposta vuota non basta a dichiarare `STRUCTURED_OUTPUT_UNSUPPORTED`. La decisione di capability/promozione non è stata eseguita in questo audit.

## 8. SHA-256 pre/post — tutti i file del target primario

Gli hash pre-audit e post-audit coincidono per tutti gli 11 file del target. I nomi sotto sono relativi alla directory preflight indicata sopra.

| File | SHA-256 pre = post |
|---|---|
| `live-catalog-snapshot.json` | `d1720860a9c5c3e0db0d3421370ce1f39a45799c5b6dbc5afb2d0fd32c0039ad` |
| `preflight.json` | `ff416b8432e37dcf6fedecb1b7896ac83523a64a2af922094c450bf8d95b3dfc` |
| `probe-artifacts/op_0ea526032d384df592bdf945403b7d52/call-record.json` | `21ffeb788582bcecf81c801655545e24439e6e5650b06751158bb855a8cf4d2a` |
| `probe-artifacts/op_0ea526032d384df592bdf945403b7d52/model-content.sanitized.txt` | `c2e3ac47f4a325469c1a2d5f117e463ec943c721986d5d9f09ac4540b7d80526` |
| `probe-artifacts/op_0ea526032d384df592bdf945403b7d52/model-visible-request.json` | `304ca8f9bd6b3f4c16383fb4a4a3d5ca2c0adc58ebcb6182ad900b53a4ca8756` |
| `probe-artifacts/op_0ea526032d384df592bdf945403b7d52/response.raw.sanitized.txt` | `88f6861cc4bba8ab2b0f764ecaeb8802c856076cb2ce278e76fea936d66a6e6b` |
| `probe-artifacts/op_7234bbc26b374b96868abf1b7ff9a3d2/call-record.json` | `2d8a38fd1fa657422df9ca4cff6fa42ebbc72addfb651b82fafddc27aad6e2ce` |
| `probe-artifacts/op_7234bbc26b374b96868abf1b7ff9a3d2/model-content.sanitized.txt` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `probe-artifacts/op_7234bbc26b374b96868abf1b7ff9a3d2/model-visible-request.json` | `3faf39d89e6b97d6d092d96c7513f289a3e88f0e7a7d0d9dc0498e90043bf98f` |
| `probe-artifacts/op_7234bbc26b374b96868abf1b7ff9a3d2/response.raw.sanitized.txt` | `b6a846b9ecf9c08541f9449d28367ae078d67eb237037cad726b97faa5cf68e6` |
| `probe-artifacts/op_7234bbc26b374b96868abf1b7ff9a3d2/structured-request.json` | `d6dc23a2395c3ac373ae77f6409853fe6beb2f932a51283a1f6614313ff3cf70` |

Gli altri 18 file storici/di codice inclusi nel controllo pre/post sono rimasti anch'essi invariati. **Artifacts preserved: PASS.** Nessuna parser correction, transport reclassification, live probe, capability declaration o altro follow-up è stata eseguita.

**Audit outcome: PASS.**
