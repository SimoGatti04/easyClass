# C7 — Decisione capability e disponibilità operativa Groq

**Data:** 6 ottobre 2026 (Europe/Rome)  
**Modello/profilo:** `groq/qwen/qwen3.8-27b` / `remote.generation`  
**Esito della decisione:** **PASS** — disposizione operativa formalizzata; nessun benchmark quality completato o ripetuto in questo task.  
**Prossimo passo:** `GEMINI_POST_EXECUTION_REVIEW`  
**Gate D:** **BLOCKED ora**; nessuna modifica allo stato del gate.

## 1. Decisione in breve

| Dimensione | Decisione |
|---|---|
| Capability structured output | `HISTORICALLY_OBSERVED_SUPPORTED`; `CURRENT_LIVE_RELIABILITY_NOT_VALIDATED` — supporto non dichiarato `UNSUPPORTED` |
| Disponibilità nel corrective Gate C corrente | `UNAVAILABLE_FOR_TEST` per il preflight structured; disponibilità operativa generale `DEGRADED`, non globalmente `UNAVAILABLE` |
| Lifecycle, `groq/qwen/qwen3.8-27b` su `remote.generation` | `COMPATIBLE` / `NOT_VALIDATED`; annotazione decisionale `DEFERRED_OPERATIONAL_INSTABILITY` |
| `REJECTED_FOR_PROFILE` | **NO** |
| Penalità di qualità per Groq | **NO** — i sample mancanti sono un blocco operativo, non un `QUALITY_FAIL` |
| Matrice correttiva D3 da 12 run | **INCOMPLETE**: 8 sample Gemini disponibili; 0/4 sample Groq disponibili |
| Ulteriori preflight Groq nella continuazione attuale | **NO**, non autorizzati; stop al retry loop |
| Sample Gemini riutilizzabili | **8** — evaluator-audited e pronti per post-execution review |
| Sample quality Groq correttivi disponibili | **0 su 4** |
| Registry / Gate D / chiamate remote in questo task | **0 / 0 / 0** |

Questa decisione è una disposizione di benchmark e di disponibilità, non un aggiornamento del registry operativo e non un giudizio qualitativo negativo sul modello.

## 2. Evidenza sulla capability structured

### 2.1 Successo storico da conservare

Esiste una precedente riuscita Groq sullo stesso **protocollo di alto livello**: API OpenAI-compatible `/chat/completions`, streaming, `response_format=json_schema` strict, risposta HTTP 200, identità verificata, contenuto non vuoto, `finish_reason=stop`, terminazione `[DONE]`, JSON e schema validi. La riuscita è la generation DBMS dell’attempt-07, riusata nella traccia storica poi esaminata offline.

Questo successo storico esclude la conclusione generale `STRUCTURED_OUTPUT_UNSUPPORTED`. Il report forense precisa tuttavia che la richiesta storica impiegava schema e budget diversi e che l’esatta versione renderer C6 non è attestabile per quella chiamata: è confermata la stessa famiglia di protocollo structured, non l’identità byte-per-byte del renderer corrente.

### 2.2 Preflight live corrente: risposta terminale vuota

Il preflight già persistito `groq-continuation-preflight-20261006T211511453133Z-04b88ccb` mostra:

- catalogo live disponibile (`LIVE_CATALOG`, HTTP 200; 56 modelli) e `groq/qwen/qwen3.8-27b` presente;
- base route probe: **PASS**, HTTP 200, identità `VERIFIED`, testo presente, `finish_reason=stop`, `[DONE]`;
- structured probe: richiesta effettivamente inviata con `response_format=json_schema`, `strict=true`, streaming; HTTP 200, identità `VERIFIED`, `finish_reason=stop`, `[DONE]`;
- la risposta structured non contiene testo, JSON, refusal o errore; il body termina regolarmente e il replay del parser coincide con il raw stream;
- diagnosi forense: **`PROVIDER_TERMINAL_EMPTY_RESPONSE`**, non guasto di trasporto incompleto e non disaccordo parser/raw.

Il probe structured era sintetico e corpus-free. La validazione JSON/schema è `NOT_RUN` perché non è stato restituito alcun contenuto da validare. Questo singolo esito dimostra instabilità operativa corrente, ma non cancella la riuscita storica né dimostra mancato supporto generale.

### 2.3 Evidenza distinta di trasporto nella quality attempt precedente

La precedente quality attempt Groq è un evento diverso: HTTP 200, heartbeat, poi EOF/frame di errore provider, senza contenuto utilizzabile, identità verificata, `finish_reason` o `[DONE]`. È stata classificata come blocco ambiente/trasporto (`ENVIRONMENT_BLOCKED` / `ENVIRONMENT_TRANSPORT_FAILURE`). Non va fusa con la risposta terminale vuota del preflight del 6 ottobre: i due eventi hanno firme e significati diagnostici diversi.

## 3. Capability, availability e lifecycle: livelli distinti

La distinzione architetturale `Declared Capability ≠ Observed Capability` resta applicata:

- **Storico osservato:** structured output strict ha funzionato su una precedente richiesta dello stesso modello e della stessa famiglia di protocollo.
- **Osservazione live attuale:** il preflight structured ha restituito una risposta terminale vuota.
- **Decisione capability:** `HISTORICALLY_OBSERVED_SUPPORTED` con `CURRENT_LIVE_RELIABILITY_NOT_VALIDATED` / instabilità operativa corrente. Non impostare `structured_output=false` né etichettare il provider `UNSUPPORTED`.
- **Disponibilità per il test attuale:** `UNAVAILABLE_FOR_TEST`, coerente con la disciplina preflight Gate C per una route che non supera il probe necessario a entrare nella coorte di test.
- **Disponibilità generale:** `DEGRADED`, non `UNAVAILABLE`: il catalogo live include il modello e la base route risponde. `UNAVAILABLE_FOR_TEST` non significa indisponibilità globale né stato lifecycle `UNAVAILABLE`.
- **Lifecycle profilo-specifico:** conservare `COMPATIBLE` / `NOT_VALIDATED`, con nota `DEFERRED_OPERATIONAL_INSTABILITY`. Non assegnare `VALIDATED`, `ELIGIBLE`, `DEFAULT_FOR_PROFILE` o `REJECTED_FOR_PROFILE`.

La capability non è promossa per la riuscita storica; allo stesso modo, il singolo probe terminale vuoto non retrodegrada la capability a “non supportata”.

## 4. D3: matrice da 12 run incompleta e deviazione esplicita

D3 aveva congelato una matrice di **12 quality runs remote**: 8 run Gemini (`CORR-01`–`CORR-04`, due repliche ciascuno) e 4 run Groq (`CORR-05`–`CORR-06`, due repliche ciascuno). La matrice non è stata completata e non viene riscritta retroattivamente:

- **Gemini: 8/8 sample disponibili e riutilizzabili.** La rivalidazione evaluator locale ha mantenuto separati gli stati storici: in particolare `CORR-02 R2` resta storicamente `QUALITY_FAIL`, con esito retrospettivo distinto `TECHNICAL_PASS_AFTER_EVALUATOR_CORRECTION` dovuto al falso positivo del validator. Nessuno stato storico è stato sovrascritto.
- **Groq: 0/4 sample quality correttivi disponibili.** `CORR-05 R1` è stato bloccato da trasporto; gli altri slot sono rimasti non eseguiti dopo lo stop. Il preflight sintetico corrente non è un quality sample e non colma nessuno slot.
- **Matrice originale D3: `INCOMPLETE`.** Non usare `C7_CONSOLIDATED_EXECUTION_COMPLETE` e non rappresentare gli slot Groq mancanti come completati.
- **Deviazione:** i quattro sample Groq non ottenuti sono un’incompletezza per disponibilità operativa, non un risultato di qualità e non una modifica retroattiva alla decisione D3.

I sample Gemini sono evidenza indipendente: la loro disponibilità e riusabilità non dipende dal completamento dei quattro slot Groq.

## 5. Nessuna penalità qualitativa e stop ai nuovi preflight

`CORR-05/06` mancanti restano `MISSING_QUALITY_SAMPLE_OPERATIONAL_BLOCK` (o equivalente stato operativo), **non** `QUALITY_FAIL`. Non si ricava un punteggio qualitativo da:

- il precedente blocco di trasporto;
- la risposta terminale vuota del probe structured sintetico;
- un preflight non superato o una replica mai eseguita.

La continuazione correttiva C7 **si ferma senza lanciare altri preflight Groq**. Non si cercherà una “finestra fortunata” attraverso retry ripetuti: ciò renderebbe il benchmark opportunistico e confonderebbe disponibilità transitoria con ripetibilità. Una nuova valutazione Groq potrà essere proposta soltanto come benchmark separato, quando route/provider risultino stabilizzati e con un nuovo perimetro decisionale esplicito.

Questa decisione non crea un freeze, non esegue quality sample e non avvia una nuova continuazione.

## 6. Evidenza Gemini, review e indipendenza per profilo

Gli otto sample Gemini (`CORR-01 R1/R2`, `CORR-02 R1/R2`, `CORR-03 R1/R2`, `CORR-04 R1/R2`) restano disponibili, evaluator-audited e riutilizzabili senza nuova inference. Sono **`READY_FOR_GEMINI_POST_EXECUTION_REVIEW`**, non già approvati né automaticamente `VALIDATED`/`ELIGIBLE`.

La prossima review dovrà documentare almeno:

1. source/factual fidelity, con verifica del criterio `SOURCE_FACT >=95%`;
2. zero material hard failures;
3. semantic completeness;
4. qualità pedagogica;
5. appropriatezza di livello, durata e coerenza;
6. ripetizioni;
7. raccomandazione di teacher editing effort;
8. pacchetto per il Domain Owner e relativo sign-off di Simone.

La validazione è specifica sia per profilo sia per modello. La mancata validazione Groq non impedisce in linea di principio che Gemini venga validato per `remote.generation` e `remote.longform`, se supera D4, assistant review e Domain Owner sign-off. Gli otto sample sono materiale pronto per questa valutazione, non prova che tutti i criteri siano già passati.

## 7. Gate D e prossimo passo

**Gate D resta `BLOCKED` ora**: nessuna condizione viene dichiarata soddisfatta o modificata da questa decisione. Non deve però attendere necessariamente una futura validazione Groq. Potrà diventare eleggibile alla review quando esista almeno un’implementazione `VALIDATED`/`ELIGIBLE` per ciascun profilo T1 necessario (`remote.generation` e `remote.longform`) e siano soddisfatte le altre policy applicabili, inclusi D4 e sign-off umano.

**Prossimo passo raccomandato:** `GEMINI_POST_EXECUTION_REVIEW`.  
**Non raccomandato/autorizzato nella continuazione corrente:** `NEW_GROQ_PREFLIGHT`.

## 8. Mutazioni e chiamate di questo task

- Chiamate remote in questo task: **0**.
- Nuovi preflight o quality sample: **0**.
- Modifiche al registry production/profile status: **0**.
- Modifiche a Gate D: **0**.
- Freeze di continuazione: **0**.
- Gold/corpus e output storici: nessuna modifica.

## 9. Fonti esaminate

- `docs/ai/model-routing-and-registry.md` — distinzione declared/observed, lifecycle, availability, preflight Gate C e validazione per profilo.
- `validation/results/Gate-C-v2-correction-plan.md` — D3 (12 run), D4, separazione trasporto/qualità, sign-off Domain Owner e Gate D.
- `validation/results/C7-evaluator-correction-audit-report.md` — otto sample Gemini riusabili, quattro sample Groq mancanti, ledger consolidato e preservazione degli stati storici.
- `validation/results/C7-groq-continuation-readiness-report.md` — scope autorizzato della precedente continuazione e criteri di consolidamento; il readiness locale non equivale a run completato.
- `validation/results/C7-groq-continuation-preflight-correction-report.md` — correzione locale del failure handling e limiti del precedente preflight fallito.
- `validation/results/C7-groq-structured-probe-corpus-free-correction-report.md` — preflight builder corpus-free validato soltanto con fake locale, non prova di esito live.
- `validation/results/C7-groq-structured-empty-response-forensic-report.md` — audit read-only della risposta terminale vuota, del successo storico e dell’evento transport separato.
- Artifact live preflight: `validation/work/C7/continuation-preflights/groq-continuation-preflight-20261006T211511453133Z-04b88ccb/` (manifest, catalog snapshot e artifact delle due route probe).

## 10. Acceptance

**PASS.** Groq non è classificato unsupported, non è promosso e non è quality-penalized; il probe structured corrente è `UNAVAILABLE_FOR_TEST` mentre la disponibilità generale è solo `DEGRADED`; D3 resta `INCOMPLETE`; gli 8 sample Gemini sono preservati; registry e Gate D non sono stati mutati; nessuna chiamata remota è stata eseguita; il prossimo passo è `GEMINI_POST_EXECUTION_REVIEW`.
