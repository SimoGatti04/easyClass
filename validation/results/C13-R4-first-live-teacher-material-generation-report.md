# Teacher Service — C13-R4: First Live Teacher Material Generation

**Data:** 12 ottobre 2026 (Europe/Rome)  
**Esito corrente:** `TEACHER_MATERIAL_GENERATED_PENDING_DIDACTIC_REVIEW`  
**Decisione didattica / approvazione:** `NOT_PERFORMED`  
**Teacher Material:** una sola generazione reale, persistita nel lifecycle C11.

## Executive result

Il primo tentativo di preflight fresca è rimasto bloccato per errori di trasporto; tale tentativo è conservato integralmente e non costituisce evidenza negativa sulla qualità del modello. Una successiva nuova preflight sintetica, sul solo endpoint LAN autorizzato, è passata con catalogo live e due probe Gemini. Subito dopo è stata eseguita **una sola** generazione Teacher Material, senza retry di inferenza, fallback o seconda generazione.

La risposta è terminata correttamente e l’output è stato persistito come versione immutabile C11 `teacher_material-v0001-d43025776b`. Lo stato del run è `C13_WAITING_FOR_EXPERIMENT_CONTINUATION`: l’output è una bozza sperimentale in attesa di revisione, non è stato approvato didatticamente e non autorizza Student Material, Assessment, pubblicazione, eligibility o Gate D.

## Verifica di autorizzazione e richiesta esatta

L’autorizzazione di fase salvata nel run corrisponde ai limiti espliciti riferiti dal Domain Owner:

| Vincolo | Valore verificato |
|---|---|
| Run | `c11-20261012T004527Z-03177a92` |
| Piano | C13 v005; SHA canonico `8e7098177b529d0dc71578280a5f49c4f081f2284454e5c0999c2ae31cfac9e6` |
| Proiezione | SHA-256 `adacd0224a9c6d0f84ce3a0eaebb0f5884e273300425902ae1cd3547c335d8d1` |
| Richiesta canonica | SHA-256 `1a25dcd97a2a8adb99910116e890dae8f77d884af948ddfe44791f0f220509d7` |
| Messaggi renderizzati | SHA-256 `ec0514cad5d34f9328153df5c764880d793a065515105520960fc395bacba7d2` |
| Body HTTP revisionato | SHA-256 `4ecbfb784233366202ac67df9beafbcd295fb41aeb38fe70c0374e081968dfc2` |
| Route / endpoint / fase | `agy/gemini-3.8-flash-tiered` / `http://198.51.100.13/v1` / `teacher_material` |
| Limite approvato | `max_tokens=3000`; una generazione; retry e fallback `0` |
| Decision provenance | `DOMAIN_OWNER_EXPLICIT_RELAYED`; identità indipendente `NOT_PERFORMED` |

Il record autorizzativo generale v005 è rimasto invariato. La decisione relay è registrata con la sua provenienza; non dichiaro né inferisco una verifica indipendente dell’identità del Domain Owner. L’autorizzazione stage-specifica è non simulata, vincolata a run/piano/richiesta/hash e limitata a una sola generazione.

## Preflight

### Tentativo iniziale bloccato — preservato

Artifact: `validation/work/C13/preflight/c13-gemini-preflight-20261012T011630183950Z-64658525.json` (SHA-256 `bb90396618ad9597e76a7bfa26b2f865e5d4895689dbb546e67e707b843dcffd`). Esito `ENVIRONMENT_BLOCKED`: catalogo live fallito dopo 3 tentativi `URLError` senza status HTTP; il runner ha poi fatto una probe sintetica basic che è fallita in trasporto usando il basis identity storico. Totale 4 chiamate remote, corpus 0, inferenze 0. Nessun contenuto della fonte fu inviato in questo tentativo.

### Nuova preflight valida, immediatamente precedente alla generazione

Artifact: `validation/work/C13/preflight/c13-gemini-preflight-20261012T012525359039Z-89b8aefc.json`; SHA-256 dei byte `7aa3559b78f92e3bc596262c5c81c1027a8330bece13c368f46e9a3ef8141bf7`; hash canonico capability legato all’intent C11 `e29cc8b2efc1af032191ee294715d5b5bf8f8ce9d0da06596af5dc6765510e58`. Esito `PASS`; catalogo live `CATALOG_AVAILABLE`, HTTP 200, 54 modelli, identity basis `LIVE_CATALOG`. La probe basic e quella structured hanno entrambe HTTP 200, identità `VERIFIED` tramite alias univoco del catalogo, contenuto non vuoto, `finish_reason=stop` e terminazione `done`; JSON e schema structured `PASS`.

Contabilità di questo tentativo: 1 GET catalogo + 2 probe = **3 chiamate remote**, corpus `0`, generazioni Teacher Material `0`. Le due probe riportano complessivamente 438 token (prompt 201, completion 237; reasoning 231). Il preflight era synthetic-only. Non sono stati usati endpoint o credenziali alternativi.

## Generazione Teacher Material

- Chiamata remota di generazione: **1**; chiamate d’inferenza: **1**; retry inference: **0**; fallback: **0**; generazioni ulteriori: **0**.
- Una richiesta contenente la fonte C9 approvata è stata inviata una volta; accounting C11 `corpus_remote_calls=1`. La preflight non ha trasmesso corpus.
- Modello richiesto: `agy/gemini-3.8-flash-tiered`; modello restituito: `gemini-3.8-flash-tiered`, risolto come alias univoco nel catalogo live. Questo è lo stato d’identità riportato dal transport, non una verifica indipendente di identità umana.
- Endpoint: esclusivamente `http://198.51.100.13/v1`; stage `teacher_material`; body/request hash approvato invariato.
- HTTP `200`; contenuto presente; `finish_reason=stop`; terminazione SSE `done`; identity `VERIFIED`; 3 heartbeat ignorati dal parser.
- Latenza complessiva: **27,6277 s**; primo testo di output: **24,3947 s**.
- Usage riportato dal gateway: prompt **2.103**, completion **4.411** (reasoning **3.560**), totale **6.514** token.

**Anomalia da chiarire:** il gateway riporta 4.411 completion token pur essendo stato inviato il limite approvato `max_tokens=3000`. La richiesta salvata/hashata conferma il limite di 3.000; non è noto se la metrica includa token di reasoning secondo una semantica diversa o indichi una discrepanza del gateway. Il contatore viene riportato come osservato, senza correggerlo o dedurne una violazione di qualità. Sommando solo le tre risposte riuscite (due probe + generazione), il gateway riporta 6.952 token complessivi: prompt 2.304, completion 4.648, reasoning 3.791. La probe fallita del primo tentativo non ha usage disponibile. Non è stata fatta alcuna chiamata di verifica aggiuntiva.

## Output e lifecycle C11

- Artifact canonico immutabile: `validation/work/C13/runs/c11-20261012T004527Z-03177a92/artifacts/teacher-material/v0001/material.md`
- SHA-256: `c3e1c145d75bbd4571cb21545a32d1bb8a5dacafe6c0429320fff95e0ce1744f`; dimensione: 2820 byte; 398 parole.
- Metadata: `validation/work/C13/runs/c11-20261012T004527Z-03177a92/artifacts/teacher-material/v0001/metadata.json`; SHA-256 `b46674b8848bf9ecbec452b6bb4f2d399e04f01c7cdaf1a19759c62d8c1c7220`.
- Stato del run: `C13_WAITING_FOR_EXPERIMENT_CONTINUATION`; checkpoint 5 SHA-256 `30a34b60c143b5db8e3db0d2a7e1cf96fc545e15daf00c501669bda9f2edefeb`.
- Manifest corrente: `validation/work/C13/runs/c11-20261012T004527Z-03177a92/manifests/MANIFEST-0005.json`; SHA-256 `51ea26bcfb79adb27cbaa890211f5cad0fcea826da4248e9b689844c87ace4c9`. Catena manifest 1–5 e inventory corrente verificati: tutte le entry inventory delle cinque versioni sono presenti e hash-valid (38 entry nel manifest corrente).
- Accounting C11 della fase: `remote_calls=1`, `inference_calls=1`, `corpus_remote_calls=1`, `generation_calls_attempted/completed/uncertain=1/1/0`.
- `model_quality=NOT_EVALUATED`; pubblicazione `false`; approval Teacher Material `null`; nessuna continuazione registrata.

## Validazioni automatiche

**PASS** per i controlli tecnici locali disponibili: parsing del payload JSON della risposta, validazione di schema/forma Teacher Material riutilizzata da C11/C10, objective ID coincidente con lo scenario, source-fact IDs limitati a `F1–F4`, e presenza nella fonte congelata dei marcatori SQL previsti. Sono inoltre PASS l’associazione agli hash approvati, il pin della fonte C9, il checksum output/metadata e la catena/inventory dei manifest C11. La structured probe preflight ha superato parsing JSON e schema.

Questi controlli non costituiscono una valutazione semantica esaustiva dei fatti, della qualità didattica, della durata o dell’effort. **Non ho eseguito la review qualitativa**, non ho assegnato editing effort e non ho approvato il materiale. La bozza resta in attesa di supervisore/Domain Owner.

## Review copy e privacy

Per rendere il testo agevole da leggere senza toccare l’output canonico è stata creata una copia di visualizzazione che cambia esclusivamente i separatori inline ` --- ` in interruzioni Markdown:

- `validation/work/C13/reviews/c13-r4-teacher-material-v0001-review-copy.md`
- SHA-256 `49cc3256afdddca7433ec4b49c41e720bdec3cd569bc4b789791dd506f3ca82f`; permessi owner-only `0600`.
- L’artifact canonico C11 resta byte-identico e hash-valid.

Il solo Source Set inviato nella generazione è la fonte DBMS/SQL C9 congelata, SHA-256 `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`. Nessun dato personale studente è stato incluso. I file delle due probe della preflight corrente sono owner-only (`0700` directory, `0600` file); la directory radice del run C11 è `0700`, quindi i suoi artifact restano accessibili solo al proprietario. Uno scanner limitato agli artifact di richiesta/risposta/preflight (17 file; pattern comuni di header/token) ha rilevato 0 corrispondenze; nessuna credenziale è stata stampata o persistita. La credenziale è stata gestita soltanto dal runtime C13/C6 previsto, senza leggere manualmente `.env.local`.

## Cleanup e preservazione

I due artifact di trasporto delle probe della preflight valida sono stati ristretti a directory `0700` e file `0600`; il JSON preflight è già `0600`. I file raw/sanitized e il run C11 restano preservati come provenance necessaria per la review. Non sono stati trovati file `.tmp` o `.reserve` sotto `validation/work/C13/preflight`. Le preflight storiche, incluse quella fallita e quelle precedenti, non sono state cancellate. Non sono state avviate altre generazioni o processi helper persistenti.

Sono stati aggiornati questo report e `STATUS.md`; creato soltanto il review copy indicato. Nessun codice, contratto, piano, registry, eligibility, Gate B, Gate D, Student Material, Assessment, pubblicazione o distribuzione è stato modificato o avviato. Non è stato effettuato cleanup distruttivo di artifact inventariati.

## Prossima decisione

Il Teacher Material v0001 è pronto per la revisione didattica ChatGPT. La review deve distinguere correttezza/fedeltà semantica da corrispondenza letterale alle fonti e può proporre correzioni, ma questa bozza non è approvata. Ogni continuazione a Student Material, Assessment o uso successivo richiede una nuova decisione esplicita del Domain Owner legata alla versione/hash e alla richiesta successiva. Nessuna eleggibilità o promozione di profilo è implicata.
