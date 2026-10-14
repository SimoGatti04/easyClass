# Teacher Service — C13-R4 Post-Generation Technical Review

**Data:** 12 ottobre 2026 (Europe/Rome)  
**Run:** `c11-20261012T004527Z-03177a92`  
**Esito:** `TOKEN_LIMIT_COMPLIANCE_UNVERIFIED`; nessuna continuazione autorizzata da questa revisione.  
**Ambito:** analisi offline di artifact C13/C6 e documentazione locale OmniRoute; nessuna credenziale letta, nessuna chiamata remota/inferenza e nessun avanzamento C11.

## Sintesi esecutiva

1. La richiesta approvata e trasmessa contiene `max_tokens: 3000`. Il payload HTTP esatto revisionato ha SHA-256 `4ecbfb784233366202ac67df9beafbcd295fb41aeb38fe70c0374e081968dfc2`; lo stesso valore appare nell'artifact C6. `OmniRouteChatClient.complete()` copia `CallContext.max_tokens` nel body POST senza trasformarlo.
2. Il gateway ha restituito `completion_tokens=4411`, con `reasoning_tokens=3560` in `completion_tokens_details`, e `total_tokens=6514` (`prompt_tokens=2103`). Risposta HTTP 200, identità verificata dal transport, `finish_reason=stop` e SSE `[DONE]`; non risulta troncata. Il valore grezzo completion supera 3000 di 1411.
3. Il solo README locale OmniRoute non specifica come il gateway inoltri/interpreti `max_tokens`, se il cap includa il reasoning, o la semantica dei campi usage. C6 non calcola token: invia il valore e conserva l'oggetto `usage` ricevuto. Non è dimostrabile né la conformità né una violazione semantica certa del cap effettivo upstream. Non sottraggo reasoning token per inferire conformità.
4. Nel perimetro v005 sono state avviate due preflight su tre: una fallita (4 richieste remote) e una riuscita (3). Ne resta **una**. La preflight riuscita riporta 237 completion token contro 80 per run e 240 totali; se si applica il contatore grezzo, ne restano 3. Il validator ha registrato PASS senza verificare usage rispetto ai cap.
5. Non è prudente avviare Student Material sotto i limiti v005 finché la semantica e la contabilità non sono chiarite. Student Material e Assessment richiedono ciascuno una fresh preflight: un solo run residuo non basta per entrambe. Le autorizzazioni specifiche di fase/continuazione sono comunque necessarie e non sono create qui.

## Evidenze token e trasporto

| Evidenza | Valore | Fonte |
|---|---:|---|
| Cap approvato/body esatto | `max_tokens=3000` | `validation/work/C13/reviews/c13-r3-teacher-material-request-review-c11-20261012T004527Z-03177a92-v0001.request.json`; SHA uguale al body approvato |
| Payload salvato dal transport | `max_tokens=3000` | `validation/work/C13/runs/c11-20261012T004527Z-03177a92/transport/teacher_material/op_024951ccaacb45179f7f2ba015e86bc7/model-visible-request.json` |
| Costruzione C6 | `body["max_tokens"] = context.max_tokens`; POST `/chat/completions` | `validation/work/C6/scripts/omniroute_transport.py`, `OmniRouteChatClient.complete()` |
| Usage risposta | prompt 2103, completion 4411, reasoning detail 3560, total 6514 | `.../call-record.json` e `response.raw.sanitized.txt` |
| Terminalità | HTTP 200, identity `VERIFIED`, `stop`, `done`, 3 heartbeat | stesso `call-record.json` |

Il response stream contiene 3.066 caratteri in `delta.content` e 3.416 in `delta.reasoning_content`: i caratteri non sono una misura token. Nell'oggetto restituito, reasoning è annidato sotto completion details e `total_tokens` corrisponde aritmeticamente a prompt + completion; ciò descrive il payload numerico, ma non definisce come il cap `max_tokens` sia applicato upstream. Il parser SSE C6 conserva usage senza normalizzarlo o sottrarre reasoning.

Il piano include `prompt_tokens` e `completion_tokens` nella telemetria, ma non definisce il rapporto tra limite e reasoning né elenca `reasoning_tokens` come campo separato. Il README OmniRoute documenta architettura/routing, non questa mappatura. La causa accertabile è una **lacuna di semantica, telemetria e controllo**, non la prova che il modello abbia ignorato intenzionalmente un limite.

## Preflight e limiti v005

La preflight delle `00:17Z` è esplicitamente descritta nel report C13-R3 come evidenza storica precedente a v005, non fresca per la generazione successiva; non la conto nel budget v005.

| Istanza v005 | Esito | GET catalogo | Probe sintetiche | Chiamate remote | Completion usage |
|---|---|---:|---:|---:|---:|
| `...011630183950Z-64658525.json` | `ENVIRONMENT_BLOCKED` | 3 tentativi | 1 basic fallita | 4 | assente |
| `...012525359039Z-89b8aefc.json` | `PASS` | 1 | 2 | 3 | 237 (basic 73; structured 164) |
| Teacher Material | risposta terminale | — | 1 generazione | 1 | 4411 |

Una preflight fallita consuma un run autorizzato: il limite riguarda le istanze avviate, non solo gli esiti PASS. Entrambe erano corpus-free.

- **Preflight:** 2/3 run usati; 1 residuo. Chiamate preflight 7/21.
- **Chiamate HTTP complessive:** 8/24 usate (7 preflight + 1 generazione); 16 residue.
- **Generazioni:** 1/3 usata; due fasi restano numericamente autorizzabili come chiamate, una per fase.
- **Probe cap:** basic `max_tokens=16`, usage completion 73; structured `max_tokens=64`, usage completion 164. Cap dichiarati: 80 per run, 240 totale; la preflight PASS v005 ne riporta 237, lasciando 3 secondo il contatore grezzo. La preflight fallita non ha usage.
- **Generation cap:** 7.500 totale; Teacher Material riporta 4.411 completion, residuo grezzo 3.089. Student (2.000) + Assessment (2.500) sommano 4.500, oltre quel residuo.
- **Cap complessivo indicato:** 7.740 output token includendo preflight. Le risposte riuscite v005 riportano 4.648 completion token complessivi (237 + 4.411); la comparabilità con i cap non è stabilita.

I confronti rappresentano la contabilità grezza ricevuta, non una conclusione sulla metrica effettivamente limitata dal gateway. Se i cap sono soltanto limiti della richiesta, C6 non verifica post-response che OmniRoute li abbia rispettati; se il raw `completion_tokens` è la metrica di consumo, i valori sono oltre i cap. `PASS` preflight prova route/capability/JSON, non conformità token.

## Impatto e correzioni proporzionate

- La risposta Teacher Material è terminale e resta utilizzabile come baseline sperimentale per la review; l'anomalia non invalida automaticamente contenuto o identity. Non è però evidenza affidabile di conformità ai cap né una misura univoca di consumo.
- Prima di ulteriori fasi occorre una definizione tecnica autorevole, riferita alla route OmniRoute effettiva, di mapping `max_tokens`, inclusione del reasoning e semantica usage. La documentazione locale esaminata non basta.
- Il contratto/telemetria deve distinguere limite richiesto da usage riportato, registrare `reasoning_tokens` separatamente quando disponibile e conservare il payload raw; nessuna sottrazione automatica va applicata senza definizione autorevole.
- Il controllo locale deve confrontare l'usage secondo la semantica approvata con i cap per richiesta/run/totale. Runner e validator attuali non applicano i confronti sui valori usage dei cap preflight e generation.
- Per eseguire **entrambe** le fasi restanti, v005 non basta: ciascuna richiede una nuova preflight, ma rimane un solo run. Un eventuale piano aggiornato deve riallineare run e token budget e ricevere le approvazioni applicabili. Questa revisione non modifica il piano né autorizza chiamate.

## Raccomandazione didattica del supervisore

È registrata la revisione ricevuta come **raccomandazione del supervisore ChatGPT: `AMEND`**: Teacher Material v0001 è corretto nei contenuti essenziali ma incompleto come guida docente operativa e non è autorizzato per uso didattico reale. Non equivale a approvazione o sign-off formale del Domain Owner e non approva la continuazione C11.

Baseline canonica preservata: `validation/work/C13/runs/c11-20261012T004527Z-03177a92/artifacts/teacher-material/v0001/material.md`, SHA-256 `c3e1c145d75bbd4571cb21545a32d1bb8a5dacafe6c0429320fff95e0ce1744f`.

## Stato e decisione

**Student Material non va avviato ora.** Sotto il conteggio conservativo dei valori `completion_tokens`, il budget preflight v005 è quasi esaurito e il residuo generativo non copre entrambe le fasi. Poiché la semantica OmniRoute non è documentata, non è dimostrabile neppure la conformità di una singola ulteriore fase. Il run resta `C13_WAITING_FOR_EXPERIMENT_CONTINUATION` e richiede una decisione esplicita del Domain Owner legata alla versione e alla nuova richiesta esatta. Per riprendere servono chiarimento tecnico/contrattuale, budget coerente e nuove approvazioni; questa revisione non li concede.

Nessuna inferenza o chiamata remota è stata eseguita. Teacher Material v0001, run C11, checkpoint e manifest non sono stati modificati. Nessuna autorizzazione è stata creata; nessun lifecycle, registry, eligibility o stato Gate D è stato modificato. Gate D resta `BLOCKED`.
