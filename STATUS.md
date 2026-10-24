# Teacher Service — Stato operativo

**Aggiornato:** 2026-10-24 (Europe/Rome)
**Fase attiva:** C7A validazione completata; C7B BLOCKED/PLANNED e non autorizzato (Supervisione: ChatGPT)
**Perimetro:** Workspace locale `teacher-service-design`.
**Fonte normativa:** `docs/` e decisioni del Domain Owner (13 ottobre 2026); **evidenze storiche:** `validation/results/`.

## 1. Transizione a Product MVP e completamento dei Checkpoint (2026-10-13)

Il progetto è transitato dalla fase di validazione preliminare di fattibilità AI (C0–C13) all'**implementazione del prodotto MVP reale**.

### Decisioni del Domain Owner applicate
- **Gate D unblocked:** Gate D non blocca lo sviluppo del prodotto MVP.
- **Modelli e quote:** Nessun limite artificiale su selezione modelli, token, chiamate o revisioni. OmniRoute gestisce l'accesso e l'abbonamento.
- **Workflow AI:** Generazione e revisione iterativa come funzionalità ordinaria di prodotto.
- **Preservazione:** Risultati sperimentali storici (C0–C13) preservati in `validation/results/`.

### Stato di avanzamento dei Checkpoint MVP

| Checkpoint | Stato | Dettagli di consegna |
|---|---|---|
| **Checkpoint 1: Application Foundation & Materials CRUD** | **COMPLETED** | Modello relazionale SQLite (schema atomico, WAL, FK), FileStore con SHA-256, FTS5 per ricerca full-text, ruoli pedagogici (Dossier 04 §46), lifecycle materiali (create, import, list, get, edit, move, duplicate, archive, restore, trash/delete), test unitari (7/7 pass). |
| **Checkpoint 2: OmniRoute Generation & Workflows** | **COMPLETED** | Adapter OmniRoute con cancellazione AbortController e fallback resiliente per test/offline; generatori Lesson Plan, Teacher Script dettagliato (con timecodes, hook, note lavagna, domande/risposte), Student Material canonico, Esercizi; revisioni iterative e rigenerazione sezioni; tracciamento di provenienza e telemetria (8/8 pass). |
| **Checkpoint 3: Assessment Drafts, Export & Teacher UI** | **COMPLETED** | Generazione bozze verifiche con soluzioni riservate docente (`[TEACHER_ONLY_SOLUTION]`); autorizzazione e promozione esplicita ad `assessable_material` (Dossier 04 §46 / Dossier 05 §56); export in Markdown, Plain Text, JSON; dashboard Web HTML/REST; suite E2E completa (1/1 pass). |
| **Checkpoint 4: MCP Protocol & Streamable HTTP Remote** | **COMPLETED** | Server MCP su standard v1.29 con supporto stdio (`bin/teacher-service-mcp.js`) e Streamable HTTP (`bin/teacher-service-http.js`); oltre 20 tool MCP registrati; autenticazione Cloudflare Access (Cf-Access-Jwt-Assertion RS256/JWKS) e OAuth Bearer token; SessionPrincipalRegistry per isolamento multi-tenant/anti-hijacking; manifest ChatGPT plugin in `plugin/` (15/15 pass). |

**Riepilogo collaudo automatico:** 31 test eseguiti in 5 suite, 0 fallimenti (`pnpm test`).

---

## Stato dei gate

| Area | Stato corretto | Evidenza |
|---|---|---|
| B0–B2 | Eseguiti; B0 inizialmente partially ready, B2 entro il perimetro sperimentale | `validation/results/B0-runtime-report.md`, `B1-parsing-report.md`, `B2-retrieval-report.md` |
| B3/B4 | Benchmark eseguiti; longform locale non adatto, decisioni bounded con limiti | `B3-models-report.md`, `B4-decisions-report.md` |
| B5–B6 storico | `NOT YET FEASIBLE` per pipeline local-only; risultato storico, non nuovo Gate D | `B5-B6-integration-report.md` |
| Gate A | `PASS` discovery/model registry | `Gate-A-catalog-discovery-report.md` |
| Gate B v2 | `PASS` revalidation; semantic checker locale **non** idoneo come autorità | `Gate-B-v2-revalidation-report.md` |
| Gate C v2/C7 | Review offline Gemini completata. Nessuna eligibility: generation `AMEND`, longform `AMEND`; sign-off Domain Owner pendente. `SOURCE_FACT >=95%` resta `NOT_EVALUATED` (ledger non esaustivo). | `C7-gemini-post-execution-review-report.md`, `C7-gemini-post-execution-domain-owner-packet.md`, `C8-root-cause-targeted-remediation-report.md` |
| Gate D revised E2E | **BLOCKED**: nessun profilo remoto è stato ratificato/reso eleggibile; C7 non dimostra la catena completa | `C7-gemini-post-execution-review-report.md`, `C7-gemini-post-execution-domain-owner-packet.md` |

**Nessuna nuova prova o modifica del registry è implicita nel presente stato.**

## Decisioni di prodotto aggiornate

Dossier 04 §§46–47 e Dossier 05 §§56–57 (2026-10): separazione **Teacher Material / Student Material / Support Material / Assessable Material** da ogni formato sorgente. La regola aggiornata è **affidabilità fattuale e coerenza delle competenze, non copia letterale**: materiale docente accurato e arricchimenti leciti; dispense fedeli al programma effettivamente spiegato, con rielaborazione; verifiche su prerequisiti distribuiti ma con nuovi problemi, applicazioni e ragionamento. Il model catalog gestisce capability dinamiche e `UNKNOWN` per quelle non dichiarate. I Gate C/D ora richiedono regressioni eterogenee, non un percorso privilegiato Excel. D4 storico e soglia SOURCE_FACT del 95% restano congelati solo per confrontabilità, non come requisiti generalizzati al prodotto.

**Queste decisioni sono documentate ma NON sono ancora dimostrate con un E2E completo né implementate come funzionalità di prodotto.**

## Review C7 e attività C8 — 10 ottobre 2026

- La review offline dei 8 sample Gemini è completata secondo D4 §47/D5 §57. Le 41 righe del claim ledger sono rappresentative, non un denominatore; nessuna percentuale `SOURCE_FACT` o eligibility viene inferita.
- Distinti errori presenti negli output, limiti del prompt/visibilità evidence, difetti di formato già presenti nel contenuto prodotto, prerequisiti DBMS mancanti e limiti dei validator. Il dettaglio è in `validation/results/C8-root-cause-targeted-remediation-report.md`.
- Applicata solo una regola locale e specifica dell'adapter Excel generation per segnalare criteri testuali `CONTA.SE`/`COUNTIF` con apici singoli; nessuna riparazione automatica. Suite C6 locale: 82/82 PASS. Nessuna modifica ai contratti, ai source pins, agli output C7, al registry o ai profili.
- Esecuzioni remote/inferenze: 0; corpus inviato: no; Gate D non avviato. C7 raw/artifact preservati con verifica di 325/325 hash del manifest.
- Il packet Domain Owner resta non compilato: decisione/sign-off umano ancora necessario.

## C9 — Provenance storica e preparazione Micro-E2E — 10 ottobre 2026

- Verificata la distinzione tra integrità e riproducibilità C7: 325/325 artifact del manifest restano integri; tre file sorgente C6 differiscono dagli hash nel freeze C7 e le copie byte-identiche pre-C8 non sono state reperite nel perimetro di ricerca. Nessun file storico è stato ricostruito o ripristinato. Le correzioni C8 sono conservate in uno snapshot separato C9; C7 raw e sign-off non sono stati modificati.
- Preparato un solo micro-caso testuale DBMS/SQL su fonte congelata, obiettivo `SELECT`/`WHERE`/`ORDER BY`, contratti minimi, criteri di accettazione, review template vuoto e runbook: `validation/results/C9-historical-provenance-micro-e2e-preparation-report.md`. Preflight fixture locale PASS 10/10; conferma copertura/pubblicazione nelle fixture sono esplicitamente simulate.
- Nessuna inferenza/chiamata remota, nessun corpus inviato, nessuna credenziale letta. Il runner reale è ancora bloccato: serve un gate docente intermedio tra Stage 1/2 e un percorso Assessment Item con trace alla Student Material effettivamente pubblicata; serve inoltre autorizzazione modello/corpus. Nessuna nuova infrastruttura o modello è stata introdotta. Gate D resta `BLOCKED`; nessuna eligibility, registry o sign-off modificati.

## C10 — Runner Micro-E2E sandbox e human gates — 10 ottobre 2026

- Implementato un runner locale riprendibile con run ID univoco, input C9 congelati e hash-verificati, checkpoint/manifests append-only, log sanificati e scritture non-overwriting. Riutilizza il validator JSON strutturale locale C4; non modifica né invoca il transport C6.
- Il percorso deterministico sandbox ha completato Teacher Material → gate copertura simulato → Student Material → approvazione simulata → pubblicazione simulata/non disponibile → Assessment sintetico con chiave docente separata. Assessment è tracciato alla versione/hash della Student Material e al gate publication. Il controllo SQL usa SQLite in-memory; chiave separata con permessi 0600.
- Suite C10 locale: 23/23 test PASS, inclusi pause/ripresa, gates mancanti o riferiti a versioni errate, materiale non pubblicato, prerequisiti non insegnati, chiave SQL errata, input Assessment privo di fonte/Teacher Material, interruzioni e integrità dei manifest.
- Esempio persistito: `validation/work/C10/runs/c10-20261010T021024Z-27680679/`, `COMPLETED_SANDBOX_ONLY`, 7 checkpoint, 2/2 query SQLite PASS; remote calls, inference calls e corpus remote calls = 0. Tutti i gate e la disponibilità sono simulati; non è evidenza di qualità del modello o approvazione docente.
- Verifica preservazione C7: 325/325 artifact del manifest presenti e con hash valido; nessuna modifica a C7, C9, registry, eligibility, sign-off Domain Owner o Gate D. Nessuna credenziale letta. Gate D resta **BLOCKED**.
- Il runner reale è ancora disabilitato (`--mode real` fail-closed). Mancano adapter di generazione reale con pausa docente operativa e percorso autorevole dei gate non simulati; l'esecuzione con corpus richiede una distinta autorizzazione esplicita. Dettagli, limiti e procedura: `validation/results/C10-micro-e2e-runner-report.md` e `validation/work/C10/procedure.md`.


## C11 — Preparation vs Delivery Lifecycle — 10 ottobre 2026

- Implementata una composizione sandbox C11 separata da C10: Teacher Material, Student Material e Assessment Draft possono essere preparati e revisionati prima della lezione; approvazioni di preparazione, copertura effettiva, distribuzione/disponibilità e readiness Assessment sono stati distinti e version-bound.
- Reconciliation post-lesson verifica competenze effettivamente coperte e l'esatta versione Student Material simulata come distribuita. Copertura incompleta blocca l'uso e identifica item/prerequisiti da rivedere o escludere. Nessun matching letterale.
- Il runner persiste checkpoint, eventi sanificati, artifact immutabili, hash e manifest; preserva le versioni precedenti e richiede una nuova approvazione dopo revisioni. Soluzione separata `TEACHER_ONLY`, permessi `0600`. Modalità reale assente e fail-closed; nessun `actor_id` è considerato prova d'identità.
- Test offline: C11 18/18 PASS, regressione C10 23/23 PASS. Esecuzione demo `c11-20261010T115757Z-62b3e580`, `ASSESSMENT_READY_FOR_USE_SIMULATED`, 10 checkpoint, 44 file inventariati, 4 query-check SQLite PASS. È solo prova software simulata, non validazione modello/docente/pubblicazione.
- Preservazione verificata: C7 325/325 artifact hash-valid; demo C10 32/32 hash-valid. Output storici C7/C9/C10, registry, eligibility, Domain Owner sign-off e Gate D non modificati. Remote/inference/corpus calls 0. Gate D resta **BLOCKED**.
- Documentazione canonica integrata in Dossier 01 §7/§19, Dossier 04 §48, Dossier 05 §58; runbook `validation/work/C11/procedure.md`. Readiness futura limitata all'orchestrazione offline: real model adapter su C6, autorizzazione corpus, gate docente autorevoli, prova di pubblicazione/availability e revisione privacy/retention restano da implementare/autorizzare separatamente.

## C12 — Adapter di generazione AI e readiness sperimentale — 10 ottobre 2026

- Preparato un adapter sperimentale mock-only che riutilizza renderer, request guard e client structured C6. L'opener ammesso è esclusivamente il `FakeSSEOpener` locale; nessun credential loader o percorso CLI live è disponibile. Le tre fasi hanno richieste distinte e versionate: Teacher Material da fonte C9; Student Material dalla versione Teacher approvata in preparazione; Assessment Draft dalla sola Student Material approvata e competenze pianificate, con dati sintetici. La soluzione Assessment resta separata `TEACHER_ONLY` (`0600`).
- Demo sandbox C12 `c12-20261010T150412Z-8eb455e8`, checkpoint 9, manifest 62 file hash-pinned, stato `ASSESSMENT_DRAFT_PREPARED_NOT_USE_AUTHORIZED`: 3 chiamate mock, remote/inference/corpus `0/0/0`, nessun retry. Output fixture e controlli schema/SQLite non valutano qualità del modello. Pubblicazione e autorizzazione all'uso restano `false`.
- Suite offline finale: 56/56 PASS (C12 15, regressione C10 23, C11 18). Il baseline di preservazione C12 verifica 1.052/1.052 file preesistenti integri; run demo C10/C11 verificate dai manifest. Nessun output storico, registro, eligibility, sign-off o Gate D modificato.
- **Readiness live BLOCKED.** Il percorso C12 ha una propria state machine che riflette i gate C11 ma non invoca direttamente l'orchestrazione C11; serve un bridge/refactor revisionato con accounting mock/remote corretto. C12 non supporta trasporto live né gate docente autorevoli. Route e structured capability Gemini attuali non sono state ricontrollate; il catalogo storico non concede eligibility per `remote.generation`. Restano inoltre approvazioni esplicite su fonte/request, endpoint/destinazione e trattamento/retention dati, budget massimo e limiti di chiamata. Nessuna chiamata remota o corpus è stata effettuata.
- Runbook offline e checklist gated: `validation/work/C12/procedure.md`; analisi: `validation/results/C12-ai-generation-adapter-report.md`. Gate D resta **BLOCKED**.

## C13 — Lifecycle unificato e readiness esperimento AI — 11 ottobre 2026

- C13 integra il generatore AI nello **stesso lifecycle persistente C11**: C11 rimane autorità unica per stati, checkpoint/manifest, versioni, gates version-bound, invalidazione e ripresa. C13 riusa contratti/schema C12 e renderer, guard, SSE/client C6; non crea una seconda state machine e non modifica C6 o i contratti congelati.
- Dimostrazione offline storica conservata: `validation/work/C13/runs/c11-20261011T013023Z-779169de/`, modalità `C13_EXPERIMENTAL_MOCK`; tre chiamate fake, remote/inference/corpus `0/0/0`. I test v1 erano 66/66 PASS; gli output simulati non valutano qualità modello.
- **C13-R1 (11 ottobre 2026):** applicata la decisione del Domain Owner che l'economia dell'uso AI resta responsabilità dell'utente/OmniRoute. Creato il piano non autorizzante v002, preservando byte-identico il piano v001 storico. Rimossi dal percorso operativo i cap monetari, la raccolta/verifica billing e i relativi blocchi; rimangono solo limiti tecnici circoscritti all'esperimento (generazioni, token, retry e chiamate). Metriche tecniche quali token, latenza, richieste ed errori sono osservabili quando disponibili e non sono trasformate in stime o controlli economici.
- Il piano v002 corregge anche il nome del campo del massimo numero di chiamate; il validator e il piano concordano su `max_gateway_http_calls_total_including_preflight`. La preflight C13-specifica verifica solo la route Gemini approvata, availability e capability correnti tramite il catalogo OmniRoute; il catalogo storico C6 resta immutato e non viene esteso/modificato. Teacher Service rispetta i modelli consentiti dal gateway e non seleziona sostituti.
- Regressioni offline C10–C13: **70/70 PASS**; preflight Gemini-only testata con fake transport sia su catalogo live valido sia sul fallback identity-only dopo transient transport exhaustion; auth e catalogo semanticamente invalido fermano la probe. C6 storico non è stato modificato. Chiamate remote/inferenze/corpus e letture credenziali: 0.
- **Esperimento live ancora BLOCCATO/non autorizzato:** restano necessari approvazione della trasmissione della fonte e delle esatte request, destinazione OmniRoute/route availability verificata, approvazione trattamento/accesso/retention dei dati, autorizzazione non simulata del Domain Owner e decisioni esplicite di continuazione per ogni versione generata. La verifica capability corrente non è stata eseguita. Nessun piano abbonamento o prova economica è richiesto al Teacher Service.
- Nessuna selezione modello, registry, eligibility, sign-off C7 o stato Gate D è stata modificata. Gate D resta **BLOCKED**. Report R1: `validation/results/C13-R1-live-readiness-corrections-report.md`; piano introdotto da R1: `validation/work/C13/plans/authorization-plan-v002.json`; runbook successivamente evoluto in R2: `validation/work/C13/procedure.md`.

### C13-R2 — eccezione HTTP LAN limitata — 11 ottobre 2026

- Registrata la decisione esplicita del Domain Owner di usare per il solo esperimento C13 l'esatto endpoint `http://198.51.100.13/v1`. Il piano non autorizzante v003 pinna destinazione, porta/percorso e ambito; HTTPS resta il requisito generale per gli altri endpoint non-loopback. Non sono previsti endpoint sostitutivi, fallback pubblico, proxy o tunnel.
- Rischio esplicito: il traffico HTTP sulla LAN non è cifrato. L'accettazione del Domain Owner è limitata alla destinazione esatta e all'esperimento C13; il template v003 richiede ancora una conferma separata nel record non simulato. L'eccezione non modifica il preflight o la policy storica C6.
- Il controllo C13 richiede coerenza byte-esatta tra endpoint del piano, endpoint del runtime, eccezione nel piano e accettazione nel record di autorizzazione. Le altre destinazioni HTTP non-loopback e ogni mismatch vengono rifiutati; nessuna credenziale o rete viene usata dai test.
- Piano corrente: `validation/work/C13/plans/authorization-plan-v003.json`; template non autorizzante: `validation/work/C13/authorizations/domain-owner-authorization-template-v003.json`. v002 resta storico e invariato. Stato esperimento: **BLOCKED** finché non sono approvati provider downstream (o `UNREPORTED`), trasmissione fonte e trattamento/accesso/retention, autorizzazione non simulata legata all'hash v003, route/capability correnti e gate per richiesta/fase.
- Verifiche offline C13 e regressioni C6/C10–C13 registrate nel report C13-R2; chiamate remote, inferenze, corpus inviato e letture di credenziali restano `0 / 0 / false / 0`. Registry, eligibility, sign-off C7 e Gate D non modificati; Gate D resta **BLOCKED**.

### C13 Final Authorization & Purpose-Based Cleanup — 12 ottobre 2026

- Creato il piano v004 `validation/work/C13/plans/authorization-plan-v004.json`, SHA-256 canonico `cbded01188f0ec4f83ad154f48fc0169aedf3e9a4a766fc8a36e658e58504682`. v003 è preservato byte-identico e resta storico. Il v004 rimuove retention fissa a giorni e stabilisce cleanup owner-controlled al termine del checkpoint di valutazione, soltanto dopo controlli di ownership, dipendenze, preservazione e conseguenze sui manifest. Nessun artifact è stato eliminato.
- Record v004 vincolato al piano: registra le decisioni esplicite riferite dal Domain Owner su endpoint LAN HTTP esatto e rischio non cifrato, downstream `UNREPORTED` accettato, fonte C9/elaborazione esterna, conservazione limitata alla necessità e assenza di controlli economici Teacher Service. Dichiara `identity verification=NOT_PERFORMED` e non contiene attestazioni d'identità. Il record non autorizza la proiezione/generazione Teacher Material.
- Validazione piano/record/source/implementation pins PASS; C10–C13 77/77 e C6 82/82 test offline PASS. C6 locale `validate-only` e `FAKE_ONLY` dry-run PASS.
- Dopo la conferma esplicita del Domain Owner, la singola preflight Gemini-only sintetica è stata eseguita: **PASS**, catalogo live 1 GET + 2 route probe, 3 chiamate remote totali, corpus `0`; artifact `validation/work/C13/preflight/c13-gemini-preflight-20261012T001710139655Z-05957652.json` (SHA-256 `4dbc3f4c4c6771393b7456e8a5347cbcc90364a920fdcb62b6eb6a73a37e5fa2`). Il runtime loader previsto è stato usato senza leggere/stampare direttamente credenziali. Nessun contenuto C9 è stato trasmesso.
- Il tentativo locale di creare il run per la projection è stato bloccato da un mismatch concreto: il validator C13 v004 richiede `DOMAIN_OWNER_EXPLICIT_RELAYED`, mentre `C11.start_experiment()` accetta solo `DOMAIN_OWNER_EXPLICIT`. Nessun run, projection o review template è stato creato; il gate non è stato aggirato. È necessaria una versione coerente del contratto/pin, mantenendo `identity verification=NOT_PERFORMED`. Nessuna generazione avviata.
- Report: `validation/results/C13-final-authorization-purpose-based-cleanup-report.md`; procedura aggiornata: `validation/work/C13/procedure.md`. Registry, eligibility, C7 e Gate D invariati; Gate D resta `BLOCKED`.

### C13-R3 — compatibilità autorizzativa e request review — 12 ottobre 2026

- Risolto il mismatch C13 `DOMAIN_OWNER_EXPLICIT_RELAYED` / C11 `DOMAIN_OWNER_EXPLICIT` con una compatibilità limitata ai contratti C13 v4/v5; C11 resta lifecycle autorevole. Le decisioni relayed mantengono provenance e `identity verification=NOT_PERFORMED`; non sono identità verificate né autorizzazioni stage. I contratti C13 storici v2/v3 e i lifecycle ordinari non sono stati allentati.
- Piano v005: `validation/work/C13/plans/authorization-plan-v005.json`; SHA-256 canonico `8e7098177b529d0dc71578280a5f49c4f081f2284454e5c0999c2ae31cfac9e6`. Record relayed vincolato a questo piano; conserva le decisioni già espresse e non autorizza la generation Teacher Material. v004 e precedenti non modificati.
- Test finali: C10–C13 **80/80 PASS**, C6 **82/82 PASS**. I test preflight usano il record reale v005 con trasporto fake locale. Nessuna credenziale letta.
- Run C11 remoto preparato senza generazione: `c11-20261012T004527Z-03177a92`, `C13_READY_FOR_TEACHER_MATERIAL`; remote/inference/corpus `0/0/0`. Proiezione: `validation/work/C13/runs/c11-20261012T004527Z-03177a92/gates/experiment/teacher_material-request-projection-v0001.json`, hash file `adacd0224a9c6d0f84ce3a0eaebb0f5884e273300425902ae1cd3547c335d8d1`. Packet leggibile e payload JSON esatto sono in `validation/work/C13/reviews/`, owner-only.
- La proiezione è stata ricostruita dal run e verificata contro fonte C9, contratti, route/parametri/schema e hash; il request guard C6 generico è passato offline. La preflight Gemini sintetica PASS precedente è preservata ma non ripetuta e non è fresca per una generazione successiva.
- **Prima della generazione** restano review ChatGPT della richiesta esatta, autorizzazione Domain Owner della singola richiesta vincolata agli hash e nuova preflight Gemini-only fresca. Nessuna generazione o trasmissione C9 è avvenuta. Registry, eligibility e C7 invariati; Gate D resta `BLOCKED`. Report: `validation/results/C13-R3-authorization-contract-compatibility-report.md`.

### C13-R4 — preflight iniziale bloccata; Teacher Material generato dopo nuova preflight — 12 ottobre 2026

- La prima preflight fresca è rimasta `ENVIRONMENT_BLOCKED`: catalogo live esaurito dopo 3 `URLError` e probe Gemini basic fallita; 4 chiamate remote totali, corpus/inferenze `0/0`. Evidenza storica preservata: `validation/work/C13/preflight/c13-gemini-preflight-20261012T011630183950Z-64658525.json`.
- Una seconda preflight sintetica Gemini-only, eseguita prima della generazione sul solo endpoint LAN autorizzato, è `PASS`: catalogo live HTTP 200, 54 modelli; probe basic e structured HTTP 200, identity `VERIFIED` via alias univoco, contenuto non vuoto, `finish_reason=stop`, terminazione `done`, JSON/schema `PASS`. Totale 3 chiamate remote; corpus `0`. Artifact `validation/work/C13/preflight/c13-gemini-preflight-20261012T012525359039Z-89b8aefc.json`.
- Dopo la preflight valida è stata eseguita esattamente una generazione Teacher Material, senza retry/fallback/seconda generazione, usando `agy/gemini-3.8-flash-tiered` tramite `http://198.51.100.13/v1`. La fonte C9 approvata è stata inviata una sola volta; C11 accounting `remote/inference/corpus=1/1/1`. HTTP 200, identity `VERIFIED` come alias univoco, `finish_reason=stop`, SSE `done`, 3 heartbeat; durata `27,6277 s`, primo testo `24,3947 s`.
- Usage riportato: prompt 2.103, completion 4.411 (reasoning 3.560), totale 6.514 token, con anomalia da chiarire: completion dichiarati oltre il limite inviato `max_tokens=3000`. Il limite della richiesta hashata resta 3.000; semantica del contatore non dedotta.
- Output canonico C11: `validation/work/C13/runs/c11-20261012T004527Z-03177a92/artifacts/teacher-material/v0001/material.md`, 398 parole, SHA-256 `c3e1c145d75bbd4571cb21545a32d1bb8a5dacafe6c0429320fff95e0ce1744f`; metadata SHA-256 `b46674b8848bf9ecbec452b6bb4f2d399e04f01c7cdaf1a19759c62d8c1c7220`.
- Stato C11 `C13_WAITING_FOR_EXPERIMENT_CONTINUATION`, checkpoint/manifest sequenza 5; catena e inventario delle cinque manifest version validate (38 entry correnti). Validazioni tecniche locali strutturali/schema e hash `PASS`; qualità semantica/didattica `NOT_EVALUATED`. È disponibile una copia leggibile per review in `validation/work/C13/reviews/c13-r4-teacher-material-v0001-review-copy.md` (solo formattazione dei separatori, hash `49cc3256afdddca7433ec4b49c41e720bdec3cd569bc4b789791dd506f3ca82f`).
- Nessuna approvazione didattica, continuazione, Student Material, Assessment, pubblicazione, eligibility o Gate D. Identità indipendente del Domain Owner `NOT_PERFORMED`; registry e Gate D invariati. Report generazione: `validation/results/C13-R4-first-live-teacher-material-generation-report.md`.
- Revisione didattica del supervisore ChatGPT: raccomandazione `AMEND` — contenuti essenziali corretti, guida docente operativa incompleta; non autorizzato per uso reale. È una raccomandazione, non un sign-off del Domain Owner. Revisione tecnica offline: `validation/results/C13-R4-post-generation-technical-review-report.md`; chiarimento token necessario prima di Student Material; nessuna chiamata remota o modifica lifecycle.

## Prossimi passi

1. Ottenere la decisione del Domain Owner sul packet C7; non trattare la raccomandazione assistant come approvazione.
2. Se si conferma `AMEND`, creare nuove versioni degli artefatti, correggere i fatti operativi e verificare i prerequisiti (database SQLite e scala `sconto_percento`); preservare intatti gli output C7.
3. Per C13, sottoporre Teacher Material v0001 alla revisione didattica ChatGPT usando l'artifact canonico e la copia leggibile. Non continuare a Student Material/Assessment senza nuova decisione esplicita del Domain Owner vincolata alla versione/hash e alla richiesta successiva; nessuna eligibility o modifica registry/Gate D è implicita.
4. Eseguire il Micro-E2E reale C9 soltanto quando i prerequisiti e le autorizzazioni esplicite applicabili sono soddisfatti. Le fixture e le esecuzioni sandbox non costituiscono sign-off o prova di modello.
5. Valutare Gate D solo dopo l'eventuale ratifica dei profili richiesti e la dimostrazione end-to-end della catena Teacher/Student/Assessable/Assessment. **Gate D resta `BLOCKED`.**

### C13-R5 — chiarimento semantica token, disaccoppiamento limiti e strategia di recovery E2E — 12 ottobre 2026

- **Verifica tecnica OmniRoute e causa dell'anomalia:** Dalla documentazione locale K3s (`deployment.yaml`) e dal sorgente upstream (`open-sse/translator/request/openai-to-gemini.ts` e `usageExtractor.ts`), è confermato che la route `agy/gemini-3.8-flash-tiered` mappa `max_tokens` su `maxOutputTokens` (vincolo sui candidate token visibili), mentre OmniRoute calcola `completion_tokens = candidatesTokenCount + thoughtsTokenCount`. L'anomalia C13-R4 (`completion_tokens = 4411 > 3000`) è spiegata dai 3.560 reasoning token generati internamente dal modello; il testo visibile generato è di soli 851 token (~4.008 caratteri), ampiamente entro il limite di 3.000. Il digest esatto dell'immagine su K3s resta formalmente **UNKNOWN**. Nessuna patch locale in `/app/data/patch.js` modifica la gestione dei token.
- **Contratto dei limiti:** Formalizzata la separazione a 5 livelli tra `client_requested_max_tokens` (parametro di richiesta contrattuale), `upstream_enforced_limit` (vincolo provider `UNVERIFIED`), `gateway_reported_usage` (telemetria non economica), `reasoning_tokens` e `visible_content_tokens`. I cap contrattuali deterministici si applicano ai token di richiesta del client.
- **Budget sperimentale e margini preflight:** Il Piano v005 consentiva max 3 run di preflight, di cui 2 consumati (1 bloccato su LAN, 1 PASS). Poiché Student Material e Assessment richiedono 2 preflight fresche distinte, v005 è a budget esaurito per i preflight run. Proposto il Piano v006 con margine fino a 6 run di preflight totali per assorbire eventuali fluttuazioni di trasporto LAN, mantenendo 1 sola generazione per fase, zero retry d'inferenza e zero fallback.
- **Continuità C11 e integrità manifest:** Il run `c11-20261012T004527Z-03177a92` è sigillato crittograficamente al Checkpoint 5 / `MANIFEST-0005.json` con hash vincolato a v005 (`8e709817...`). Non è possibile migrare il piano mid-run senza violare l'immutabilità dei manifest. Il run `c11-...-03177a92` e il relativo Teacher Material v0001 (SHA-256 `c3e1c145d75bbd4571cb21545a32d1bb8a5dacafe6c0429320fff95e0ce1744f`, recensito `AMEND` dal supervisore) vengono preservati intatti come baseline storica. Il completamento del Micro-E2E richiederà un nuovo run C11 inizializzato sotto il Piano v006 approvato dal Domain Owner.
- **Test ed evidenze offline:** Eseguite le suite C10–C13 (24/24 PASS preflight/integrazione), C11 (18/18 PASS) e C12 (15/15 PASS); chiamate remote, inferenze e letture di credenziali protette = `0 / 0 / 0`. Dettagli completi in `validation/results/C13-R5-token-semantics-and-recovery-report.md`. Registry, eligibility, sign-off Domain Owner e Gate D non modificati; Gate D resta **BLOCKED**.

## Checkpoint hardening — publication, Assessable Source Set e grading fail-closed (13 ottobre 2026)

### Implementato
- Aggiunta persistenza append-only degli eventi di pubblicazione/ritiro per Resource Version esatta (`material_publication_events`). Pubblicazione, ritiro e autorizzazione Support Material richiedono una versione precisa; un aggiornamento non eredita la pubblicazione.
- Student Material è valutabile solo se la versione esatta risulta attualmente disponibile/pubblicata. Support Material richiede sia disponibilità sia autorizzazione esplicita version-bound e compatibile con la lezione. L'autorizzazione non cambia il ruolo pedagogico; il ruolo legacy `assessable_material`, l'ID da solo e i tipi teacher-only non bastano.
- Generazione Assessment richiede un Source Set non vuoto e version-pinned; fonti mancanti, non pubblicate, ritirate, non autorizzate o fuori contesto bloccano l'operazione. La provenance include la versione e gli identificativi/date di pubblicazione e autorizzazione.
- Ogni Assessment Item creato tramite servizio richiede materiale, versione esatta e disponibilità/autorizzazione valida; item senza grounding e Teacher Script non sono accettati.
- Il grading prepara e valida l'intero round prima di persistere. Errori AI, JSON malformato o score/confidence invalidi non producono punteggi euristici né round parziali; i risultati persistiti restano proposte, con review docente separata.
- Esposizione MCP di `publish_material` e `unpublish_material`; `authorize_assessable` ora descrive e applica solo l'autorizzazione esplicita di Support Material. Le fonti interne segnalano assessability tramite lo stato effettivo di pubblicazione/autorizzazione, non tramite il ruolo legacy.
- REST `/api/*` verificata con test di autenticazione fail-closed; rimosso l'uso di `x-role`/`?role=` come input di ruolo. Il rendering dashboard già codifica i campi utente prima di inserirli nel DOM.

### Moduli e test
- Moduli: `src/db/schema.js`, `src/services/material-service.js`, `generation-service.js`, `assessment-service.js`, `source-service.js`, `teacher-service.js`, `src/mcp/server.js`, `src/server/http.js`, `src/ai/omniroute-client.js`.
- Regressioni aggiornate/aggiunte in `tests/unit/{materials,generation,assessment-grading,sources,file-import-export}.test.js`, `tests/mcp/{mcp-server,http-transport}.test.js` e `tests/integration/e2e.test.js`.
- `npm test`: **9 suite, 58 test/subtest, 0 fallimenti**. Include fixture di generazione/grading mock esplicite e test HTTP con token sintetici; non è una verifica AI reale.

### Limiti residui del checkpoint
- Nessun test reale OmniRoute eseguito; MCP/E2E AI usa il mock di test.
- Il servizio non ha ancora una policy applicativa di membership docenti distinta da `authenticated`: l'accesso teacher-only dipende dalla configurazione Cloudflare Access / dalla protezione del bearer token. Non usare un bearer condiviso con utenti non docenti e non esporre ingress senza verificare tale policy.
- La trace attuale pinna fonte/versione e stati, ma non implementa ancora la verifica semantica operativa per item di competenze, prerequisiti ed evidenze (§56) né la riconciliazione della copertura realmente svolta/readiness d'uso (§48/§58).
- Restano da completare gli altri requisiti MVP (import ChatGPT attachment sicuro e parsers, fonti web reali, source selection completo, dashboard CRUD/editor/generation, operazioni assessment/grading più complete, AI rules trust/authorization e integrazione MCP reale). Non dichiarare l'MVP completato.


## Checkpoint Context-Aware AI & Sources — 13 ottobre 2026

### Implementato e testato localmente
- AI rules persistenti, versionate e teacher-internal: scope global/course/subject/class/class-course/lesson/assessment/capability, risoluzione deterministica con trace di provenance, storico immutabile, archive/restore, ripristino di una versione e delete recuperabile o esplicito. Le modifiche persistenti richiedono `teacherAuthorized === true`; il test MCP verifica anche che un principal non autorizzato non possa scrivere.
- `courseId` distinto è propagato alla risoluzione delle regole in generazione e recuperato dalla configuration snapshot per le revisioni, così la revisione riusa il contesto originale.
- Source workflow con ricerca materiali, recupero di lezioni precedenti e versioni esatte, required/excluded sources, ricerca web tramite adapter configurabile, fetch HTTPS con DNS/IP validation, redirect revalidati, snapshot esterni versionati, relevance/authority signals e stati distinti FOUND/CONSULTED/USED/SAVED.
- Le pagine esterne sono passate al modello come dati JSON non fidati; non possono diventare istruzioni persistenti né invocare tool privilegiati. Un URL registrato non equivale a consultazione. Una required source mancante/non recuperabile blocca la generazione.
- Lesson Plan, Teacher Script, Student Material, esercizi, Assessment Draft e revisioni usano regole risolte e source context; gli artifact conservano source set, riferimenti/hash/versioni, snapshot delle regole e lineage immutabile. Il Source Set registra USED solo quando è osservato il relativo marker `[Sx]`; ciò documenta una citazione, non prova la correttezza fattuale della claim. Le fonti senza marker restano CONSULTED.
- Le regole Assessable Source Set restano separate: Assessment continua a richiedere versioni esatte, pubblicate/autorizzate e non teacher-only; soluzioni e Teacher Material non sono promossi per semplice ID.
- OmniRoute mantiene selezione modello configurabile e nessun default `max_tokens`; normalizzazione di risposte testuali a blocchi e errori provider con codici specifici. Mock resta esplicito e distinto da generation reale.

### MCP e moduli
- MCP espone gestione e risoluzione AI rules, ricerca/consultazione/selezione fonti, generazione, lettura provenance e revisione versionata, oltre agli strumenti materiali e Assessment già disponibili. UI/API/MCP condividono la stessa `TeacherService`.
- Moduli del workflow: `src/services/ai-rule-service.js`, `source-service.js`, `generation-service.js`, `teacher-service.js`; `src/ai/omniroute-client.js`, `web-research-client.js`; `src/mcp/server.js`; `src/core/errors.js`.
- Regressioni/runner: `tests/mcp/context-aware-generation.test.js`, `tests/unit/{generation,omniroute-client,rules}.test.js`, `tests/unit/run-unit.js`, `tests/mcp/run-mcp.js`. Il test MCP sintetico attraversa discovery/call, regole global+course+class/course, due lezioni precedenti, fetch esterno finto con prompt injection, persistenza e lettura Source Set, revisione v2 e denial di scrittura non autorizzata.

### Verifica
- `npm test`: **12 suite, 62 test/subtest PASS, 0 FAIL**. Include test unitari, MCP, HTTP/auth e integration E2E locale.
- `npm run test:unit`: **8 suite, 39 test/subtest PASS**.
- `npm run test:mcp`: **3 suite, 22 test/subtest PASS**; la suite MCP contestuale è inclusa nel runner.
- Il percorso MCP con OmniRoute e web research nei test usa trasporti finti deterministici. Non è una verifica di provider reali.

### Integrazioni reali e limiti espliciti
- **OmniRoute live: NOT RUN / NOT VERIFIED.** È stato tentato un solo flusso MCP sintetico con una required URL documentale; la risoluzione DNS di `docs.python.org` ha fallito (`ENOTFOUND`) prima che fosse invocato OmniRoute. La richiesta di escalation per l’egress con la credenziale privata verso il gateway configurato è stata respinta perché destinazione/ownership non verificate. Nessuna completion OmniRoute è stata eseguita; nessun segreto è stato stampato.
- **Web search live: NOT RUN / NOT CONFIGURED.** `TEACHER_SERVICE_WEB_SEARCH_URL` non è configurato nell’ambiente caricato. Nessuna pagina esterna è stata recuperata dal tentativo live.
- **ChatGPT remote MCP: NOT VERIFIED.** I test MCP usano un authorizer sintetico; non attestano connessione remota o identità docente reale.
- Resta irrisolta la policy autorevole di teacher-principal/membership: autenticazione da sola non conferisce privilegi docente. Il default MCP è fail-closed; non esporre ingress né condividere bearer non docente.
- La classificazione USED tramite citation marker non è validazione semantica della claim; authority/relevance sono segnali euristici da riesaminare nel workflow docente. La copertura semantica e la readiness Assessment restano subordinati alla review docente.
- Questo checkpoint non completa l’intero MVP: restano gli altri gaps già elencati (connessione ChatGPT remota con auth reale, UI di gestione completa, import/export di allegati ChatGPT nei formati dichiarati, assessment/grading operations ulteriori e verifica semantica didattica end-to-end). Le evidenze storiche C0–C13 e il precedente checkpoint restano invariati.

### Cleanup e stato repository
- I file temporanei creati dai test e dal tentativo sintetico sono stati rimossi dai rispettivi cleanup; non è stato avviato un servizio persistente e i runner terminati. L’inventario processi globale non è stato verificabile (`ps` restituisce `operation not permitted`). Non sono stati creati worktree, branch o commit.
- Rimane il preesistente `.tmp/test-http-1791850314354`; ownership e finalità non sono determinate, quindi non è stato modificato né rimosso. Cleanup da rivalutare dopo verifica di provenienza/consumer.
- Il workspace non contiene `.git`; non è stato possibile produrre un diff o verificare allineamento Git. Le modifiche sono state controllate direttamente e tramite suite.


## Checkpoint Live Integration & ChatGPT MCP Readiness — 13 ottobre 2026

### Integrazioni reali: verifiche indipendenti
- **Recupero HTTPS pubblico: PASS.** Il precedente `ENOTFOUND docs.python.org` si è riprodotto solo nel confine di rete/sandbox ristretto. Nel contesto autorizzato con egress funzionante, HTTPS a `https://docs.python.org/3/library/urllib.parse.html` ha restituito HTTP 200 con verifica TLS standard; anche `WebResearchClient.fetchPage()` ha recuperato e estratto la pagina. Non è stata modificata la configurazione DNS e non sono state indebolite le protezioni SSRF/TLS. Evidenza e snapshot: `validation/live-integrations/teacher-service-live-2026-10-13T14-47-30-267Z-22c54b7f/`.
- **Ricerca web: NOT CONFIGURED.** Ricerca in `development-environment` e inventario read-only non hanno trovato un deployment/endpoint SearXNG disponibile. Open WebUI contiene codice di integrazione per SearXNG, ma non un provider locale attivo già utilizzabile da Teacher Service. `TEACHER_SERVICE_WEB_SEARCH_URL` resta non configurato: non è stato inventato un endpoint e non è stata costruita una piattaforma di ricerca alternativa.
- **OmniRoute: endpoint e associazione configurativa verificati; completion FAIL per provider.** La configurazione locale non segreta indica l'esatto endpoint approvato `http://198.51.100.13/v1`; la documentazione di `development-environment/services/omniroute/README.md` lo attribuisce all'ingress LAN Traefik/K3s sul nodo `<backup-host>` (`198.51.100.13`). La credenziale privata è caricata dalla configurazione owner-only e l'adapter la invia esclusivamente al `baseUrl` configurato; il runner rifiuta qualsiasi destinazione diversa. La connessione usa HTTP non cifrato sulla LAN, rischio già circoscritto all'endpoint approvato. Sia la completion diretta sintetica sia la generazione contestuale MCP hanno ricevuto **HTTP 429**: gli account Antigravity per `agy/gemini-3.8-flash-tiered` risultavano esauriti. Nessun retry è stato eseguito e nessun output generato è stato dichiarato riuscito.
- **Generazione contestuale integrata: NOT COMPLETED.** Prima della risposta 429, il runner MCP ha scoperto gli strumenti necessari, creato in un DB isolato una classe sintetica, due lezioni precedenti e la lezione target, due materiali di contesto versionati, regole global/class-subject e ha recuperato la pagina Python richiesta come fonte esterna versione 1. Le fonti interne ed esterna risultano `CONSULTED`; non sono dichiarate `USED`. Il provider ha rifiutato la generation; non esiste un artifact generato, un Artifact Source Set associato né una riga di provenance. Lo stato parziale è stato aggiunto al report leggendo il DB isolato in sola lettura; le chiamate live non sono state ripetute.

### Autorizzazione teacher-principal
- Implementata una membership applicativa minima: solo `Cf-Access-Jwt-Assertion` verificato crittograficamente (RS256, issuer, audience e validità temporale) con email firmata presente nell'allowlist esplicita `TEACHER_SERVICE_TEACHER_EMAILS` ottiene il grant docente. Bearer condiviso, auth disabilitata, identità assente/non mappata, mapping vuoto o invalido e assertion senza `exp` numerico valido restano non autorizzati/fail-closed. Non si accettano role header o query param.
- `/api/*` e `/mcp` applicano entrambi autenticazione e autorizzazione docente; la sessione MCP resta vincolata al principal e la cross-principal reuse è rifiutata. Test con chiavi e identità Cloudflare sintetiche verificano autorizzazione, denial, session isolation e REST/MCP.
- **Configurazione runtime non pronta per connessione reale:** la verifica non segreta rileva audience Cloudflare e mapping email docente non configurati nell'ambiente locale. Questo è intenzionale fail-closed, non una concessione implicita. L'identità/principal autorevole va fornita dall'operatore tramite Cloudflare Access e mapping esplicito; autenticazione da sola non conferisce privilegi.

### MCP e ChatGPT
- **MCP locale: protocollo e superfici verificati.** Le suite deterministiche coprono `initialize`, `tools/list`, operazioni autorizzate/denial, isolamento sessione/principal, Organization/Material CRUD, regole/fonti, disponibilità assessment/grading, import/export e generazione/revisione contestuali. In aggiunta, `tests/mcp/http-loopback-integration.test.js` è stato eseguito con successo su TCP loopback (`127.0.0.1`), usando identità sintetiche e adapter AI/ricerca finti: ha verificato initialize, discovery, CRUD, rules, two-lesson context, retrieval web simulato, generation/revision via HTTP, provenance e session isolation. Questa prova valida il trasporto locale, non un provider AI reale né ChatGPT remoto.
- Il descriptor `plugin/mcp.json` resta solo descrittivo; l'URL non è stato provato e non prova l'esistenza di tunnel, Access policy o connessione client. **Connessione remota ChatGPT: NOT VERIFIED.** Nessun ingress pubblico, DNS, Cloudflare Access/Tunnel o infrastruttura è stato creato o modificato.
- Runbook di configurazione, bind loopback, mapping teacher, validazione prima della connessione e distinzione tra test locale e remoto: `docs/operations.md`.

### Moduli e verifica di questo checkpoint
- Moduli interessati dal precedente passaggio di implementazione: `src/server/teacher-authorization.js`, `src/server/auth.js`, `src/server/http.js`, `src/mcp/server.js`, `src/services/{teacher-service,generation-service,source-service,ai-rule-service}.js`, `src/ai/{omniroute-client,web-research-client}.js`, `bin/teacher-service-live-check.js` e test MCP/unitari. In questo completamento è stato inoltre reso obbligatorio `exp` numerico valido nei token JWT e aggiunti controlli regressivi per token senza scadenza e scaduti; aggiunto `tests/mcp/http-loopback-integration.test.js` ai runner MCP e full suite.
- **`npm test`: PASS — 14 suite, 0 failure; 68 test pass e 1 loopback test skipped** nella sandbox, che nega il bind socket. Lo stesso test TCP è stato eseguito separatamente su host dopo autorizzazione esplicita: **PASS, 1/1**. `node --test tests/mcp/http-transport.test.js`: PASS — 11 test. I test Cloudflare usano chiavi/test identities sintetiche; i provider AI/web nel loopback test sono finti.
- Report live sanificato e diagnosi per stage: `validation/live-integrations/teacher-service-live-2026-10-13T14-47-30-267Z-22c54b7f/report.json`; estratto HTTPS e DB isolato nello stesso path. La completion reale non è PASS; il solo stage live PASS è il recupero pagina HTTPS.
- **Pulizia:** runner terminato; DB, report ed estratto di evidenza restano owner-only sotto una directory `0700`. Nessun servizio persistente o ingress è stato avviato. Il preesistente `.tmp/test-http-1791850314354` non è stato toccato perché ownership/consumer non sono determinati. Il workspace continua a non contenere `.git`, quindi non è disponibile una verifica diff/stato Git; nessuna inizializzazione repository, branch, worktree o commit è stata effettuata. Le evidenze C0–C13 non sono state modificate.

### Blocchi e prossime azioni
1. L'operatore configura l'audience Cloudflare e una lista esplicita di email docente attraverso il meccanismo locale/PM2 autorizzato, quindi verifica l'identità firmata senza esporre credenziali.
2. Configurare `TEACHER_SERVICE_WEB_SEARCH_URL` solo dopo aver individuato e autorizzato un provider di ricerca effettivamente raggiungibile; poi verificare lo stage separato.
3. Quando l'account/provider OmniRoute torna disponibile, eseguire un nuovo smoke check sintetico, esplicitamente autorizzato, senza retry automatici; non riutilizzare il precedente 429 come prova di generazione riuscita.
4. La connessione remota ChatGPT richiede autorizzazione infrastrutturale separata per il percorso protetto (es. tunnel esistente/approvato), audience/mapping validi e test MCP autenticato end-to-end. Non aprire ingress pubblici nel frattempo.

### Gap MVP non chiusi da questo checkpoint
- **OmniRoute real generation:** il codice/adapter e l'orchestrazione sono verificati con mock, ma la completion reale è bloccata dalla quota upstream 429. La generation integrata live non ha persistito un artifact.
- **Web search:** manca un provider di ricerca effettivamente disponibile/configurato; la ricerca web live resta `NOT_CONFIGURED`.
- **ChatGPT attachment import:** i parser PDF/DOCX/testo e l'export hanno test locali; non è stata verificata una vera file reference ChatGPT (`download_url`/`file_id`). Il campo `originUri` di `import_material` è provenienza, non prova di ingestion. Il tool `import_file` esistente espone path locale/base64, non il percorso sicuro di attachment remota dichiarato dal requisito MVP.
- **UI:** il dashboard esistente non è stato validato in questo checkpoint come editor/generation management end-to-end.
- **Teacher deployment:** audience Cloudflare e allowlist docente runtime sono vuoti; non c'è connessione ChatGPT remota autenticata né ingress approvato.

**Conclusione:** il flusso contestuale è collegato all'adapter OmniRoute reale e ha raggiunto il gateway durante la prova live, ma la capacità di completare una generazione reale resta **NOT DEMONSTRATED** per il 429 upstream. Il retrieval HTTPS è passato e il trasporto Streamable HTTP è stato verificato su loopback reale; configurazione Cloudflare e connessione remota ChatGPT non sono verificate. **MVP non dichiarato completo.**

## Checkpoint ChatGPT MCP Integration & Attachment Workflow — 13 ottobre 2026

### Implementato
- **Workflow di importazione allegati ChatGPT (`import_attachment_file`):**
  - Implementato secondo il pattern comprovato di `register_asset_file` (`social-design-engine`).
  - Supporta il contratto file-reference di ChatGPT (`download_url`, `file_id`, `file_name`, `mime_type`).
  - Protezione SSRF fail-closed via `isPublicNetworkAddress` (blocco RFC1918, CGNAT 100.64.0.0/10, loopback, link-local, multicast, IPv6 non-global unicast).
  - Risoluzione DNS limitata a indirizzi pubblici con IP pinning (`fetchHttpsPinned`) su TLS con SNI, porta 443 e rifiuto redirect HTTP.
  - Allowlist host rigorosa: `files.oaiusercontent.com` e pattern Azure Blob accounts (`^[a-z0-9]{3,24}\.blob\.core\.windows\.net$`).
  - Limite di dimensione a 25 MB verificato su header e streaming byte counter.
  - Parser di estrazione testo: PDF (tramite `pdftotext`), Word DOCX (tramite `pandoc`), HTML, Markdown e testo semplice.
  - Salvataggio immutabile del binario originale in `FileStore` con verifica integrità SHA-256 (`attachment-<hash>-<filename>`).
  - Creazione persistente del Material in `MaterialService` con ruolo pedagogico, associazione opzionale a classe/materia/lezione e telemetria di provenienza (`fileHash`, `fileId`, `extractor`, `storedPath`, `mimeType`).
  - Protezione percorsi remoti: i chiamanti remoti MCP non possono fornire percorsi locali arbitrari del filesystem (`filePath` è strettamente rifiutato).
  - Annotazioni MCP: registrato con `_meta: { "openai/fileParams": ["file"] }`, schema `OpenAIFile` e `openWorldHint: true`.

- **Integrazione Cloudflare Access Managed OAuth (Allineamento Social Design Engine):**
  - Riutilizzo della configurazione dell'applicazione Access `mcp` (ID: `57a335b5-5e1d-42ad-a55d-4b489682e221`) e audience (`3a2781b1104b6ec529e0b91a2133114ffc8ad9a1803d15cb01bc4ff09c9d68cc`).
  - Managed OAuth DCR configurato per callback `https://chatgpt.com/connector/oauth/*`.
  - Identità docente autorizzata: `teacher@school.example`.
  - Verifica fail-closed delle asserzioni RS256 con tolleranza clock skew, normalizzazione trailing slash per issuer, supporto array `aud`, e refresh della cache JWKS su kid rotation.
  - Gestione preflight CORS (OPTIONS) con 204 No Content per origini autorizzate (`https://chatgpt.com`, `https://mcp-teacher.simogatti.it`).
  - Isolamento sessione-principale (`SessionPrincipalRegistry`).
  - Binding del server HTTP su loopback `127.0.0.1:8770`.

- **ChatGPT Skill & Plugin Packaging:**
  - Plugin manifest in `plugin/plugin.json` e configurazione server in `plugin/mcp.json`.
  - Skill didattica per ChatGPT in `plugin/skills/teacher-curriculum/SKILL.md` con flussi di organizzazione accademica, import allegati, generazione pedagogica, revisione e assessment.

- **OmniRoute Gateway:**
  - Endpoint configurato su `http://198.51.100.62:32128/v1` (Tailscale) con modello predefinito `agy/gemini-3.8-flash-tiered`.
  - Configurazione disaccoppiata e personalizzabile tramite variabili d'ambiente (`TEACHER_SERVICE_OMNIROUTE_BASE_URL`, `TEACHER_SERVICE_DEFAULT_MODEL`).
  - Nessun token limit rigido artificiale nel client.

- **Suite di Test Completa:**
  - 17 suite di test attive, 100% passate (81 test totali):
    - `tests/unit/attachment-transport.test.js`: 7 test pass.
    - `tests/unit/attachment-parsers.test.js`: 5 test pass.
    - `tests/mcp/attachment-mcp.test.js`: 3 test pass.
    - `tests/mcp/http-transport.test.js`: 13 test pass (inclusi CORS OPTIONS e array aud).
    - `tests/mcp/http-loopback-integration.test.js`: 1 test suite pass.
    - Tutte le suite di dominio, generazione, regole, sorgenti, export ed E2E passate.

### Stato della Connessione Remota ChatGPT
- **Configurazione locale pronta:** PM2 (`ecosystem.config.cjs`), `.env.local` e bind loopback (`127.0.0.1:8770`) allineati all'infrastruttura `MacMini`.
- **Modifiche infrastrutturali richieste (in attesa di autorizzazione operatore):**
  - Aggiornamento di `~/Workspace/infra/config/exposure-macmini.yaml`:
    1. Aggiunta record DNS CNAME `mcp-teacher.simogatti.it` verso tunnel `MacMini`.
    2. Aggiunta regola di ingress tunnel per `mcp-teacher` verso `http://127.0.0.1:8770` con applicazione Access `mcp`.
    3. Aggiunta destinazione `mcp-teacher` nell'applicazione Access `mcp`.
  - In conformità con le istruzioni, nessuna modifica è stata applicata a `infra` o DNS condivisi senza autorizzazione specifica.

## Checkpoint C1 — Cleanup completo portale-classi e allineamento development-environment (16 ottobre 2026)

### 1. Correzioni applicative e robustezza eliminazione
- **Application Facade (TeacherService):**
  - Esposto esplicitamente il metodo deleteMaterial(id, options) a livello di facade applicativa (src/services/teacher-service.js), risolvendo l'errore service.deleteMaterial is not a function riscontrato nelle chiamate MCP delete_material.
  - Instradamento chiaro tra soft-delete (trashMaterial) ed eliminazione permanente (deleteMaterialPermanently).
- **Eliminazione permanente e FileStore (MaterialService):**
  - Implementata la rimozione coordinata dei file su FileStore contestualmente alla cancellazione del record su database.
  - Rimozione sicura dei file di versione e dei blob raw importati non piu referenziati da altri materiali, con protezione dei blob condivisi per evitare file orfani e riferimenti inconsistenti.
  - Transazione atomica per rimozione record relazionali, versioni, correlazioni e sincronizzazione dell'indice full-text FTS5.
- **Suite di regressione:**
  - Aggiunto tests/unit/permanent-delete.test.js che verifica la cancellazione permanente tramite facade e handler MCP, la corretta eliminazione dei file da disco e la pulizia dei record DB e FTS5.
  - Suite completa: 18 test suite passate con successo (0 fallimenti).

### 2. Allineamento development-environment e ritiro runtime legacy
- **Package Manager e Versioni:**
  - Aggiunto packageManager: pnpm@10.32.1 in package.json e specificato engines: { node: >=22.5.0 } per il supporto nativo a node:sqlite.
  - Creato .mise.toml locale con versioni bloccate: node = 26.5.0 e pnpm = 10.32.1.
- **Dockerfile riproducibile:**
  - Pinned a FROM node:22.23.2-bookworm-slim.
  - Abilitazione di corepack e installazione dipendenze tramite pnpm install --prod --frozen-lockfile.
- **Ritiro runtime Mac mini e pulizia:**
  - Eliminato ecosystem.config.cjs (il runtime Mac mini / PM2 e definitivamente ritirato; l'unico runtime produttivo e K3s).
  - Rimosse directory e file temporanei di test dal workspace locale.
  - Verificata l'assenza di processi orfani, agenti launchd o container attivi sul Mac mini.
- **Source of truth e documentazione:**
  - Creato AGENTS.md come entry point di repository per vincoli e perimetri.
  - Riscritto docs/operations.md descrivendo esclusivamente l'architettura K3s di produzione, distinguendo gli stati CURRENT, DEPRECATED e PLANNED.
  - Aggiornato README.md allineando comandi, configurazione e architettura.

### 3. Configurazione K3s e manifest Infra (infra)
- **Manifest aggiornati (k3s/apps/class/ su branch codex/teacher-service-c1-cleanup):**
  - app.yaml: rimosso il volume mount di rollback /srv/legacy-class-uploads.
  - configmap.yaml: rimosse tutte le variabili legacy PostgreSQL (DB_*, POSTGRES_*).
  - postgres.yaml: rimosso il manifest dello StatefulSet e del Service legacy.
  - storage.yaml: rimossi i PV/PVC legacy class-postgres-data e class-uploads. Preservati con retention Retain i volumi class-teacher-db (2Gi) e class-teacher-files (5Gi) su <backup-host>.
  - external-secret.yaml: ripulite le chiavi segrete legacy portale-classi, mantenendo solo TEACHER_SERVICE_OMNIROUTE_API_KEY.
  - kustomization.yaml: rimossa l'inclusione di postgres.yaml.
  - README.md: aggiornato per documentare esclusivamente Teacher Service.
  - Creato tasks/teacher-service-c1-cleanup-2026-10-16.md per tracciare la sequenza operativa di transizione.

### 4. Rischio residuo SQLite/FileStore e Backup
- Come espressamente confermato dal Domain Owner, **non** e introdotto alcun sistema indipendente di backup verso NAS o storage esterno in C1.
- Resta documentato in docs/operations.md il rischio residuo di perdita dati dovuto al single-node hostPath su <backup-host>.

### 4. Finalizzazione operativa C1 completata (17 ottobre 2026)
- **Container image e build policy:**
  - Compilata immagine immutabile `ghcr.io/simogatti04/class:20261017-64d3030` (architettura `linux/amd64`, utente non-root `node:node`, `pdftotext` e `pandoc` verificati).
  - Immagine importata con successo nel containerd di entrambi i nodi K3s (`<backup-host>`, `<backup-host>`).
- **Deploy K3s e continuità del servizio:**
  - Manifest applicati via `make k-apply APP=class` da repository Infra.
  - Pod `class-5d84544d68-dtk6b` 1/1 Running su `<backup-host>`.
  - Verificato probe e healthcheck HTTP 200 su `https://class.simogatti.it/health` (`{"status":"ok","service":"teacher-service","transport":"streamable-http","version":"0.1.0"}`).
  - Verificato endpoint MCP su Cloudflare Access `https://mcp-teacher.simogatti.it/mcp` (HTTP 401 Bearer OAuth discovery verso `simogatti.cloudflareaccess.com`).
  - Nessun mount di rollback `/srv/legacy-class-uploads` attivo nel container.
- **Ritiro completo e permanente del vecchio portale-classi:**
  - `StatefulSet/class-postgres` e `Service/class-postgres` eliminati da K3s.
  - PVC legacy `class-postgres-data` e `class-uploads` eliminati dopo verifica assenza consumatori.
  - PV legacy `class-postgres-data` e `class-uploads` (Released) rimossi dal cluster.
  - Volumi persistenti `class-teacher-db` (2Gi) e `class-teacher-files` (5Gi) confermati Bound con StorageClass `class-local` e reclaim policy `Retain`.
- **Bonifica storage fisico su <backup-host>:**
  - Rimossi i percorsi legacy `/srv/class/postgres` (67 MB) e `/srv/class/uploads` (1015 MB).
  - Rimosso il dump SQL storico `/srv/class/backup_before_teacher_service_20261014.sql` (2.8 MB) e script SQL correlati.
  - Reclamati oltre 1.08 GB di spazio disco su `<backup-host>`.
  - Preservati intatti e operativi `/srv/class/teacher-service/db` e `/srv/class/teacher-service/files`.
- **Bonifica credenziali legacy su Infisical:**
  - Rimosse dal path `/class` le 5 chiavi legacy: `POSTGRES_PASSWORD`, `DB_PASSWORD`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`.
  - Mantenuta unicamente `TEACHER_SERVICE_OMNIROUTE_API_KEY`.
  - Verificato che il pod `class` riceva solo le variabili di configurazione di Teacher Service, senza variabili PostgreSQL.
- **Validazione coerenza configurazione:**
  - `make domain-check`: PASS.
  - `make exposure-check`: PASS.

## 5. Checkpoint C2: T1 "Tomorrow is ready" — Implementazione, Supervisione e Revisione Pre-release (17 ottobre 2026)

Conformemente alle direttive vincolanti del Supervisore e ai Dossier approvati (Dossier 01 §§5–8, 26–31; Dossier 03; Dossier 04; Dossier 09; Dossier 10), è stato completato e validato con successo il primo vertical slice UX/UI: **T1 ("Tomorrow is ready")**, integrando tutte le correzioni pre-release richieste dalla supervisione.

### 1. Frontend React Modulare e Immunizzazione XSS
- **Architettura Componenti React (`client/src/components/`):**
  - Allineata l'interfaccia alla struttura a componenti React modulari ed estendibili: `Header.js`, `ContextBar.js`, `LessonHeader.js`, `SourceManager.js`, `StepProgressCard.js`, `ArtifactWorkspace.js`, `Modals.js`.
  - Servita in modo nativo da `src/server/static.js` senza toolchain di build esterna né dipendenze runtime non necessarie.
- **Rendering Sicuro & Zero innerHTML (`client/src/components/MarkdownViewer.js`):**
  - Parsing e rendering Markdown convertito direttamente in Virtual DOM React (`h1`, `h2`, `h3`, `p`, `pre/code`, `ul/ol`, `blockquote`, `table`, `strong`, `em`).
  - **Zero innerHTML e Zero dangerouslySetInnerHTML**: immunizzazione completa contro payload malevoli (`<script>`, `<img onerror>`, `<iframe src>`).
  - Blocchi `[TEACHER_ONLY_SOLUTION]` incapsulati in container protetti con banner esplicito di riservatezza didattica.
- **Parametri Didattici e Fonti Esplicite:**
  - Durata lezione (`durationMinutes`) configurabile dal docente e propagata al contesto di generazione.
  - Selezione esplicita delle fonti (`selectedSourceIds`) per vincolare il materiale di riferimento usato dall'AI.

### 2. Autenticazione Multi-Audience e Sicurezza di Rete
- **Separazione Rigorosa degli Audience Cloudflare Access:**
  - Applicazione Web (`/api/*`): vincolata ad audience dedicato `TEACHER_SERVICE_WEB_CF_ACCESS_AUD`.
  - Applicazione MCP (`/mcp`): vincolata ad audience Managed OAuth `TEACHER_SERVICE_CF_ACCESS_AUD`.
  - Cross-token rejection fail-closed verificata (un token Web inviato all'MCP riceve 401 Audience mismatch; un token MCP inviato alle API Web riceve 401 Audience mismatch).
- **Protezione CSRF per Sessioni Browser Cookie-Based:**
  - Validazione `Host` contro header poisoning.
  - Blocco fail-closed delle richieste con `Sec-Fetch-Site: cross-site`.
  - Obbligo di `Origin` o `Referer` verificato per mutazioni (`POST`, `PUT`, `DELETE`, `PATCH`) basate su cookie `CF_Authorization`.
  - Nessun token manuale né persistenza in `localStorage`.

### 3. Orchestrazione Lesson Pack & Persistenza Version-Bound
- **Generazione e Ripresa Step-by-Step Verificabile:**
  - Pipeline sequenziale dei 4 artefatti didattici: Lesson Plan → Teacher Script → Esercizi con soluzioni riservate → Dispensa Studente.
  - Persistenza atomica immediata su SQLite e FileStore al completamento di ogni singolo step.
  - Nessuna simulazione o fake progress: stato reale emesso per ciascun passaggio (`idle`, `running`, `completed`, `failed`).
- **Rigenerazione Selettiva Senza Duplicati:**
  - Parametro `existingMaterialId` per aggiornare in-place l'artefatto esistente, incrementando la versione immutabile (es. v1 → v2) e conservando l'ID e i collegamenti di provenienza.
  - Nessun record orfano o duplicato generato nel database.
- **Macchina a Stati della Conferma Preparazione (`lesson_preparation_confirmations`):**
  - Distinzione a tre stati verificata:
    1. `confirmed`: tutte le versioni correnti del pack corrispondono allo snapshot congelato nella conferma.
    2. `modified_since_confirmation`: uno o più materiali sono stati modificati o rigenerati dopo l'ultima conferma.
    3. `incomplete`: preparazione incompleta (uno o più artefatti del pack non ancora generati; rifiuto fail-closed del congelamento).
  - Netta separazione tra conferma preparazione, svolgimento della lezione e pubblicazione agli studenti.

### 4. Gestione Fonti e Multipart Upload
- **Tracking di Provenienza:**
  - Il source set selezionato dal docente viene verificato (risoluzione id e versionNumber esatto) e memorizzato in `provenance.sourceSet` dell'artefatto generato.
- **Bufferizzazione Multipart Sicura (RFC 2046):**
  - Implementato `parseBufferedMultipartFormData` con validazione sintattica del boundary RFC 2046.
  - Limite rigoroso di dimensione a 25MB.
  - Sanitizzazione dei percorsi file contro directory traversal (`../../../`).
  - Allowlist estensioni consentite (`.pdf`, `.docx`, `.md`, `.txt`, `.html`).
  - Validazione magic bytes (`%PDF-`, `PK`) per impedire l'upload di file camuffati.

### 5. Suite di Test e Verifiche Superate (100% Pass)
- Esecuzione completa di tutte le **21 suite di test** (`pnpm test` / `node tests/run-all.js`):
  - 12 unit test suite (materiali, permanent delete, generation, omniroute client, rules, sources, file-service, attachment).
  - 5 MCP test suite (mcp-server, attachment-mcp, context-aware-generation, http-loopback, http-transport).
  - 2 server test suite (`api-t1.test.js` e la nuova suite `pre-release-corrections.test.js` con 8 test di sicurezza e ciclo di vita superati).
  - 2 integration test suite (`e2e.test.js` e `t1-workflow.test.js` con test E2E completi).
- Nessuna regressione sui contratti MCP o sulle funzionalità approvate in C1.


### 6. Ultimo Gate Pre-release C2/T1 Completato (19 ottobre 2026)
Conformemente alle direttive vincolanti dell'Ultimo Gate Pre-release, sono stati completati, verificati ed integrati tutti gli 8 punti operativi:

1. **Divieto Assoluto di `authMode != 'strict'` in Produzione**:
   - In `src/server/auth.js` (`authenticateRequest`) e `src/server/http.js`: fail-closed con eccezione bloccante / HTTP 500 se `isProduction && mode !== 'strict'`.
   - Blocco assoluto di identità sintetiche in produzione (`statusCode: 403`).
   - Verificato con suite dedicata in `tests/server/pre-release-corrections.test.js` (Test 8).

2. **Contratto Selezione Fonti e Dipendenze Interne**:
   - Supporto modalità `selected_only` (default) e `contextual` in `TeacherService.generateLessonPack`.
   - Nessuna preselezione automatica indiscriminata; gli artefatti didattici interni sono esclusi dalle fonti esterne.
   - Tracciamento della provenienza con esatto `sourceSet` (ID e versione). Preservate le dipendenze interne della generazione didattica.

3. **Frontend React + Vite & Rimozione Bundle Vendorizzati**:
   - Componenti React allineati a standard ESM (`react`, `react-dom/client`). Rimossa la directory legacy `client/vendor/`.
   - Build di produzione Vite configurata e verificata (`pnpm run build:client` genera `client/dist/` con asset digest immutabili).
   - Static file handler (`src/server/static.js`) serve `client/dist` con caching immutabile per `/assets/` e fallback SPA.

4. **Robustezza Runtime e Lock Concorrenza**:
   - In `TeacherService`, introdotto mutex/lock `_activeArtifactLocks` per impedire richieste concorrenti duplicate sullo stesso artefatto della medesima lezione (HTTP 409 Conflict).
   - In caso di timeout, refresh o disconnessione, `GET /api/lessons/:id/pack` recupera gli artefatti persistiti permettendo la ripresa selettiva.

5. **Build Container Reale e Browser Test E2E**:
   - Container image compilata con successo (`docker build -t teacher-service:test .`) e collaudata a runtime.
   - Suite browser reale Chromium (`tests/browser/t1-browser.test.js`) passata con successo al 100% (9 step completi: navigazione, creazione classe/materia/lezione, selettore fonti, generazione step progressiva, ispezione workspace, conferma e congelamento versioni, export).

6. **Migrazione Additiva Database & Non-Regressione MCP**:
   - Migrazione additiva (`duration_minutes` e tabella `lesson_preparation_confirmations`) verificata su database preesistente (`tests/unit/migration-additive.test.js`).
   - Suite completa unit & integration (`pnpm test`: 22 test files) e suite MCP (`pnpm run test:mcp`: 11 protocol tools + 4 attachment tools) passate con successo (0 fallimenti).

7. **Predisposizione Cloudflare Access Web & K3s (Nessuna mutazione applicata)**:
   - Specificato piano dichiarativo per Cloudflare Access Application per `class.simogatti.it` (distinta dall'OAuth MCP `mcp-teacher.simogatti.it`).
   - Configurazione variabile `TEACHER_SERVICE_WEB_CF_ACCESS_AUD` per Infisical e K3s.
### 7. Rilascio Produttivo C2/T1 & Collaudo Reale K3s Completato (20 ottobre 2026)
Conformemente alle autorizzazioni del Domain Owner e del Supervisore, il rilascio in produzione del vertical slice C2/T1 ('Tomorrow is ready') è stato eseguito, collaudato e completato con successo su cluster K3s:

1. **Cloudflare Access Web (`class.simogatti.it`) Applicato via IaC**:
   - Saved plan `make cf-save-access-plan` e verifica bundle `make cf-verify-access-plan`.
   - Token unificato `CLOUDFLARE_TERRAFORM_API_TOKEN` caricato da Infisical (`/cloudflare/terraform`).
   - `make cf-apply-access-plan` eseguito con successo (**1 added, 0 changed, 0 destroyed**).
   - Creata risorsa `cloudflare_zero_trust_access_application.k3s["class"]` (ID: `61b7861a-3587-479d-91d3-063b66a6ef96`).
   - **AUD Web Estratto**: `efba3266e210f6077d0e86f50721d7a3896e0deb1b9e60a5acc325af39b1e21d`.
   - Cookie `CF_AppSession` protetto con flag `Secure; HttpOnly` e durata sessione 24h.
   - Nessuna alterazione a DNS, Tunnel, policy condivise o all'applicazione MCP `mcp-teacher.simogatti.it` (AUD MCP invariato: `3a2781b1...`).

2. **Container Build & Push GHCR**:
   - Dockerfile multi-stage autonomo (`linux/amd64`) con compilazione React/Vite integrata nello stage di build e runner pnpm con lockfile frozen.
   - Immagine: `ghcr.io/simogatti04/class:20261020-f962706` (digest: `sha256:79d7c084233c60049c18e24459fde84160178cdf58b9e52461c97906180b455c`).
   - Push eseguito con successo su GitHub Container Registry.

3. **Manifest K3s e Rollout Operativo**:
   - `infra/k3s/apps/class/configmap.yaml` aggiornato con `TEACHER_SERVICE_WEB_CF_ACCESS_AUD`.
   - `infra/k3s/apps/class/app.yaml` allineato al tag immutabile `20261020-f962706`.
   - Commit Git `infra`: `e0ae514` (`feat(class): deploy teacher service 20261020-f962706 with web cf access aud`).
   - Rollout completato: Pod `class-5744fcfb8-97v8f` (1/1 Running su `<backup-host>`). Volumi SQLite (`class-teacher-db`) e FileStore (`class-teacher-files`) preservati integri con dati di produzione intatti.

4. **Verifiche di Rete e Sicurezza Runtime**:
   - `https://class.simogatti.it/`: reindirizzamento HTTP 302 verso Cloudflare Access login con `kid=efba3266...` e cookie `HttpOnly`.
   - `https://mcp-teacher.simogatti.it/mcp`: risposta HTTP 401 Bearer realm="OAuth" Cloudflare Access Managed OAuth (invariato e protetto).
   - Rifiuto chiamate non autenticate (401), identità sintetiche (403) e modalità permissive (500) in produzione (`NODE_ENV=production`).

5. **Collaudo Reale End-to-End con OmniRoute (`agy/gemini-3.8-flash-tiered`)**:
   - Connessione live al gateway OmniRoute (`http://omniroute.omniroute.svc.cluster.local:20128/v1`): OK (50 modelli disponibili).
   - Generazione 4-step reale del Lesson Pack per la lezione `[TEST-E2E-T1] Introduzione a NoSQL`:
     - Step 1: Lesson Plan generato e persistito.
     - Step 2: Teacher Script generato con timecode e note alla lavagna.
     - Step 3: Esercizi graduati generati con marker `[TEACHER_ONLY_SOLUTION]`.
     - Step 4: Dispensa studenti generata con rimozione lato server delle soluzioni riservate.
   - Conferma preparazione lezione con congelamento esatto delle versioni (`pack.preparationStatus === "confirmed"`).
   - Revisione AI con OmniRoute del Lesson Plan: transizione corretta dello stato di preparazione a `"modified_since_confirmation"`.
   - Export multi-formato verificato: Markdown, HTML strutturato e DOCX nativo tramite pandoc.

6. **Bonifica e Cleanup Completo dei Dati Sintetici di Test**:
   - Eliminazione permanente di tutti i materiali, lezioni, materie e classi con prefisso `[TEST-E2E-T1]`.
   - Verifica di stato pulito: 0 materiali sintetici residui in database, indice FTS5 e FileStore.

### 8. Checkpoint C3: UI/UX Foundation & Local Development Preview (21 ottobre 2026)

Conformemente alle direttive del Domain Owner e alla supervisione ChatGPT, è stato completato con successo il **Checkpoint C3**, avviando la nuova fase di Teacher Service incentrata sul sistema integrato di esercitazioni, verifiche, studenti, consegne, correzioni, monitoraggio live e anticopiatura:

1. **Formalizzazione dello Scope e Contratti di Dominio (C3–C7)**:
   - Creato documento programmatico e contrattuale `docs/c3-c7-roadmap-and-contracts.md`, allineato ai Dossier 01–11 (in particolare Dossier 04 §§46-48, Dossier 05 §§56-57, Dossier 06 §§1-4, Dossier 09 §§1-6).
   - Distinzione rigorosa tra **CURRENT** (operativo), **PLANNED** (C4–C7) e **DEPRECATED / PROHIBITED** (proctoring invasivo, keylogger, telecamere, grading arbitrario senza controllo docente).

2. **Separazione Architetturale delle Superfici & Sicurezza Fail-Closed**:
   - **Area Studenti (`/api/student/*` e `#/studente`)**: pubblica, zero credenziali o password, identificazione leggera tramite selezione classe e nominativo da elenco docente. Mascheramento applicativo rigoroso di soluzioni docente (`teacher_solution`) e rubriche (`rubric_json`).
   - **Area Docente (`/api/*` e `#/docente`) & Server MCP (`/mcp`)**: protetti da Cloudflare Access e verifica di autorizzazione del principal docente (`verifyTeacherAuthorization` con lista `TEACHER_SERVICE_TEACHER_EMAILS`). Rifiuto immediato (401/403) di tentativi non autorizzati.

3. **Nuova Struttura UI/UX & Design System Responsive**:
   - **Homepage Portale (`client/src/components/Homepage.js`)**: landing page responsive con card di accesso dedicate per Studenti e Docenti.
   - **Student Experience (`client/src/components/StudentArea.js`)**: flusso guidato a 6 step:
     1. Selezione classe;
     2. Identificazione nominativo con ricerca rapida;
     3. Selezione verifica/esercitazione attiva;
     4. Dichiarazione obbligatoria Seat Map (Fila, Banco, Vicino SX e DX con scelta esplicita «Nessuno»);
     5. Svolgimento prova con autosalvataggio persistente in background (debounced), badge visivo dello stato (`Salvataggio in corso...` / `Tutte le modifiche salvate`), supporto per scelta multipla, risposte aperte, codice ed upload allegati;
     6. Schermata di conferma consegna con riepilogo.
   - **Teacher Dashboard Multi-Scheda (`client/src/components/TeacherArea.js`)**:
     - *Lezioni (T1)*: modulo di preparazione lezioni intatto e operativo (`TeacherPreparationView.js`).
     - *Attività*: creazione e gestione verifiche ed esercitazioni (`ActivitiesView.js`).
     - *Studenti*: gestione anagrafica classe, inserimento ed importazione massiva (`StudentsView.js`).
     - *Monitoraggio Live*: cruscotto d'aula in tempo reale (`LiveMonitoringView.js`) con toggle tra Mappa d'Aula (Seat Map visiva con cattedra, banchi per fila, stato studente e vicini dichiarati) ed Elenco Roster tabellare; polling automatico configurabile (5s).
     - *Consegne & Valutazioni*: esame delle prove sottomesse dagli studenti, risposte e allegati, calcolo proposta automatica AI/deterministica, input e conferma definitiva della valutazione sovrana del docente (`SubmissionsView.js`).
     - *Integrità & Anticopiatura*: anteprima esplicita C6 con i 5 pilastri architetturali, visualizzazione cluster di prossimità e disclaimer etico (`IntegrityPreviewView.js`).
   - **Router Client & Build Vite**:
     - Router reattivo hash-based in `client/app.js` (`#/`, `#/studente`, `#/docente`).
     - Stili responsive in `client/app.css` ottimizzati per desktop, tablet e smartphone.
     - Compilazione asset con `pnpm build:client` (`client/dist/`, 30 moduli, digest immutabile, zero errori).

4. **Ambiente di Anteprima Locale Isolato (`pnpm dev:preview` & `pnpm dev:preview:clean`)**:
   - Creato script `bin/teacher-service-preview.js` per avvio locale e su LAN Wi-Fi (binding `0.0.0.0:8780`).
   - Rilevamento automatico dell'indirizzo IP di rete locale per accesso immediato da dispositivi mobili/smartphone connessi alla LAN.
   - Isolamento totale dello storage: SQLite dedicato in `.tmp/dev-preview/teacher-preview.db` e FileStore in `.tmp/dev-preview/filestore/` (zero toccamento dei dati di produzione o volumi K3s).
   - Generazione automatica di un ricco seed dimostrativo riproducibile (classi 4A Informatica e 3B Liceo, studenti, lezioni, dispense pubblicate, attività di verifica/esercitazione, sottomissioni simulate con Seat Map e correzioni).
   - Script di pulizia atomico e sicuro `bin/teacher-service-preview-clean.js` (`pnpm dev:preview:clean`) per eliminare la directory temporanea senza residui.

5. **Suite di Test & Validazione**:
   - **24 test suite eseguite ed esito 100% PASS (zero fallimenti)**:
     - `tests/server/student-api.test.js` (12 test): API studente isolate, mascheramento soluzioni docente, dichiarazione Seat Map, autosave, consegna finale, upload allegati, blocco chiamate non autorizzate su endpoint docente, monitoraggio live.
     - `tests/integration/dev-preview.test.js` (2 test): inizializzazione storage isolato, seed dimostrativo e pulizia sicura.
     - Tutte le 22 suite preesistenti (unit, server, mcp, integration) confermate passanti senza alcuna regressione.

### 9. Checkpoint C3.1: Stabilizzazione prima di C4 (22 ottobre 2026)

Conformemente alle direttive del Domain Owner e alla supervisione ChatGPT, è stato completato con successo il **Checkpoint C3.1** di consolidamento e stabilizzazione del flusso di verifiche ed esercitazioni:

1. **Sicurezza e Identità degli Studenti (Zero-Account & Token Crittografici con Hash)**:
   - Eliminato il rischio del modello basato su libero `studentId` client-side.
   - Implementato sistema di accesso leggero basato su credenziali individuali temporanee per attività (`access_code` monouso da 6 caratteri o QR) e session token crittografici a 256 bit (`student_activity_credentials`) con scadenza configurabile e stato (`issued`, `active`, `submitted`, `revoked`).
   - Il server memorizza su SQLite esclusivamente l'hash crittografico SHA-256 del token (`token_hash`), mai il token in chiaro.
   - Riscatto monouso rigorosamente applicato: una volta riscattato (`cred.status !== "issued"`), il codice non può essere riutilizzato da terzi o soggetti diversi; tentativi di riscatto multiplo vengono respinti con `403 AuthorizationError`.
   - Endpoint studente protetti dall'header obbligatorio `X-Student-Token` o `Authorization: Bearer <token>`: ogni operazione (`start`, `autosave`, `submit`, `upload`, `getSubmission`) risolve l'identità verificata (`studentId`, `classId`, `assessmentId`) lato server in modo fail-closed (`validateStudentSession`).
   - Privacy dei nominativi garantita: l'elenco studenti per la classe nell'area pubblica espone solo nome e iniziale del cognome (es. `Mario R.`); i dati completi e la consegna sono visibili unicamente alla sessione autorizzata.
   - Difesa contro attacchi a forza bruta implementata a livello HTTP: blocco dell'IP dopo 5 tentativi errati di riscatto codice entro 5 minuti con risposta `429 Too Many Requests`.
   - Procedura controllata per smarrimento, rinnovo e revoca: implementato `reissueActivityCredential` a livello service, esposto via REST (`POST /api/assessments/:id/credentials/:credId/reissue`), via MCP (`reissue_student_credential`) e nella UI docente con pulsante "Rinnova" individuale.
   - Interfaccia docente corretta: rimosse le indicazioni di proiezione collettiva alla lavagna, sostituite da istruzioni di distribuzione personale e riservata (tagliandi cartacei o QR individuali).

2. **Integrità delle Verifiche & Lifecycle Immutabile**:
   - Lifecycle rigorosamente applicato: `draft` → `ready` → `active` → `closed`.
   - Nello stato `ready`, i quesiti della prova rimangono inaccessibili (`items: []`), consentendo solo la visualizzazione delle informazioni generali di attesa; le domande vengono sbloccate solo con la transizione esplicita ad `active`.
   - Le verifiche in stato `draft` sono rigidamente inaccessibili agli studenti (rifiuto 403 con AuthorizationError su claim, start, autosave e query).
   - Validazione cross-class: studenti di una classe non possono accedere o salvare tentativi per verifiche di altre classi.
   - Immutabilità della consegna definitiva (`attempt_status === "submitted"`): qualsiasi tentativo successivo di autosave, consegna o upload di allegati viene respinto con `409 Conflict` sia a livello database che HTTP.
   - Riapertura controllata (`reopenSubmission`): il docente può riaprire esplicitamente un tentativo consegnato, tracciando l'audit e consentendo allo studente di riprendere la compilazione.
   - Versionamento delle domande e delle verifiche: ogni modifica o aggiunta quesiti incrementa `assessment.version`; le consegne sono collegate alla versione esatta dell'attività; eliminazione quesiti bloccata con `ConflictError` se sussistono risposte.

3. **Autosalvataggio Monotono & Protezione Concorrenza**:
   - Controllo di revisione monotona lato server (`revision` numerica crescente inviata ad ogni salvataggio bozza): richieste stale o fuori ordine vengono scartate con `409 Conflict`.
   - Richieste di autosave ritardate arrivate dopo la consegna definitiva vengono respinte con `409 Conflict` senza sovrascritture parziali o corruzioni.
   - Gestione esplicita dei conflitti HTTP nel frontend, evitando falsi positivi di salvataggio.
   - Test approfonditi di concorrenza, duplicazione rapida, disconnessione e arrivo asincrono fuori sequenza implementati ed eseguiti con successo.

4. **Minimizzazione Dati Studente & Isolamento Docente**:
   - `getStudentSubmission` con ruolo `student` pulisce rigorosamente il payload: rimosse soluzioni riservate (`teacher_solution`), rubriche di correzione (`rubric_json`), note interne, valutazioni non pubblicate e percorsi filesystem assoluti del FileStore.
   - Endpoint upload allegati restituisce percorsi relativi e sicuri.
   - Test negativi rigorosi su soluzioni, rubriche e dati interni.

5. **Proposta Architetturale Cloudflare Zero Trust (IaC)**:
   - Documento `docs/cloudflare-routing-iac-proposal.md` completamente allineato alle convenzioni `infra` e agli standard Zero Trust.
   - Rimosso il bypass globale; proposta architettura basata su Access Applications path-scoped (`/docente*` e `/api/*` protette da IDP docente; `/api/student/*` e asset con bypass scoped).
   - Predisposto piano di transizione e comandi canonici `make cf-save-access-plan`, `make cf-verify-access-plan`, `make cf-apply-access-plan` per Checkpoint C7.
   - Nessuna modifica applicata a Cloudflare, Tunnel o K3s in C3.1.

6. **Esito Validazione C3.1**:
   - **24/24 test suite eseguite ed esito 100% PASS (zero fallimenti)**:
     - `tests/server/student-api.test.js` (30 test passati al checkpoint precedente).
     - `tests/integration/dev-preview.test.js` (2 test).
     - Tutte le 22 suite preesistenti confermate passanti.
   - Client SPA compilato con successo (`pnpm run build:client`).

### 10. Checkpoint C3.1: Final Integration Fix (22 ottobre 2026)

Risoluzione definitiva delle discrepanze individuate dalla revisione indipendente tra frontend, backend e test, consolidando il contratto end-to-end prima di C4:

1. **Revisioni di Autosalvataggio End-to-End (Frontend & Backend)**:
   - In `client/src/components/StudentArea.js`, introdotta gestione con riferimenti reattivi (`responsesRef`, `attachmentsRef`, `serverRevisionRef`, `clientRevisionRef`, `persistedRevision`).
   - Inizializzazione corretta della revisione dal draft recuperato dal server (`sub.revision || 0`).
   - Incremento monotono rigoroso su ogni digitazione, rimozione o caricamento allegato.
   - Trasmissione obbligatoria del parametro `revision` su `/api/student/activities/:id/start`, `/autosave` e `/submit`.
   - Backend `src/server/http.js`: convalida stretta di `revision` (intero non negativo), con rifiuto HTTP 400 `ValidationError` in caso di assenza o valore non valido.
   - Riconciliazione automatica su HTTP 409: in caso di conflitto, il client recupera lo stato aggiornato della submission da `/submission`. Se la prova è già finalizzata, passa direttamente alla schermata di consegna; se in corso, sincronizza `serverRevisionRef`, incrementa `clientRevisionRef` e ritrasmette immediatamente le modifiche locali senza perdita di dati.
   - Badge visivo salvataggio: visualizza la revisione effettivamente confermata e persistita (`✓ Salvato (Rev X) • HH:MM:SS`).

2. **Riscatto Atomico dei Codici di Accesso**:
   - In `src/services/assessment-service.js`, `claimStudentSession` incapsulato in transazione atomica SQLite con aggiornamento condizionale:
     `UPDATE student_activity_credentials SET ... WHERE id = ? AND status = 'issued'`.
   - Controllo vincolante di `changes === 0` con lancio di `AuthorizationError` ("Questo codice di accesso è già stato utilizzato...").
   - Test di concorrenza reale con `Promise.all` simultaneo: esattamente 1 richiesta ottiene token (200), la concorrente viene respinta (403).

3. **Versionamento Coerente delle Verifiche e Immutabilità Quesiti**:
   - Inibizione di modifiche ai quesiti (`addItem`, `updateItem`, `deleteItem`) su verifiche che presentano tentativi avviati dagli studenti (`assessment_submissions > 0`), con rifiuto HTTP 409 `ConflictError`.
   - Preservazione dell'ancoraggio alla versione originale della verifica (`sub.assessment_version || asm.version || 1`) in `saveDraftSubmission`.

4. **Verifiche Accessorie di Sicurezza**:
   - Rate limiting brute-force: rilevamento IP cliente sicuro in `src/server/http.js`. Gli header `X-Forwarded-For` e `CF-Connecting-IP` sono considerati validi esclusivamente se la connessione remota del socket proviene da proxy locale/privato (loopback, 10.*, 192.168.*, 172.*). Su connessioni dirette pubbliche, gli header client vengono ignorati, impedendo spoofing dell'IP.
   - Reissue credenziali studente: verificato che il rinnovo credenziali non cancella o altera le risposte già salvate o le sottomissioni già finalizzate.

5. **Validazione & Test Suite**:
   - Suite `tests/server/student-api.test.js` estesa a **35 test** (inclusi test concorrenza atomica, proxy spoofing defense, multi-question workflow con due studenti concorrenti).
   - Bundle frontend compilato (`pnpm run build:client`) con successo (zero errori).
   - Tutte le **24 test suite** di `tests/run-all.js` confermate passanti al **100% (zero fallimenti)**.
   - **Gate C4 APERTO**: la base di sicurezza, identità, integrità e persistenza è consolidata ed end-to-end integrata per avviare l'implementazione della Student Experience avanzata (C4).


### 11. Checkpoint C4 — Student Experience & Mobile-First UX (23 ottobre 2026)

**Stato:** implementazione C4 completata e verificata localmente; nessun rilascio produttivo eseguito. C5–C7 non avviati. Le modifiche storiche C0–C13 e i dati/configurazioni di produzione sono stati preservati.

1. **Esperienza studente:** `~/Workspace/teacher-service-design/client/src/components/StudentArea.js` ora offre navigazione a quesiti, avanzamento, stato online/salvataggio, avvio Seat Map, editor codice leggero con gutter numerato e indentazione, upload con anteprima sicura di immagini/PDF/testo, riepilogo pre-consegna e blocco delle modifiche durante l’invio. Gli stili responsive/touch e gli spazi per safe area sono in `client/app.css`.
2. **Timer e server:** il conto alla rovescia si basa sulla scadenza e sull’orario restituiti dal server, sopravvive al refresh e mostra avvisi a 10/5 minuti. Il backend impedisce scritture e upload dopo la scadenza; gli upload scaduti sigillano il tentativo senza creare record/file. L’estensione di tempo già memorizzata lato server resta compatibile con C5, senza nuove azioni docente introdotte qui.
3. **Resilienza offline:** `client/src/utils/student-offline-cache.js` persiste bozze e allegati pendenti in IndexedDB con chiave per sessione/studente/attività, revisione e base server. I salvataggi locali non sono presentati come confermati dal server; una divergenza richiede riconciliazione esplicita. Sessioni consegnate/uscite sono ritirate dalla cache.
4. **Affidabilità e accesso:** corretti `start(0)` per restituire la porta effimera corretta nei test e il bootstrap React di `TeacherPreparationView.js`, che impediva alla SPA di avviarsi nel browser. Il test browser legge il tentativo con la sessione student token, non con endpoint anonimo. La riconciliazione usa revisioni persistite dal server; il client non si affida al solo annullamento delle richieste.
5. **Test aggiunti/aggiornati:** `tests/browser/student-c4-browser.test.js` e `pnpm run test:browser:c4`; regressione HTTP per upload dopo scadenza in `tests/server/student-api.test.js`. Gli E2E browser usano SQLite e FileStore temporanei sotto `.tmp/dev-preview/` e li eliminano nel cleanup del test.
6. **Verifiche effettive:**
   - `node --test tests/server/student-api.test.js`: PASS, 37 test (inclusi accesso con due studenti, timer e upload dopo scadenza).
   - `pnpm test`: PASS, 24 suite senza fallimenti; nel run confinato il test loopback MCP opt-in è stato saltato per divieto di bind TCP. Eseguito poi separatamente con autorizzazione loopback: `node --test tests/mcp/http-loopback-integration.test.js` PASS (MCP HTTP reale su localhost, dati sintetici e adapter AI/Web fake).
   - `pnpm run test:browser:c4`: PASS, un flusso Playwright reale su Chromium locale, due studenti, viewport 390×844 (telefono), 768×1024 (tablet) e 1365×900 (desktop), offline/ripristino, allegato/preview, avvisi timer, consegna e controllo teacher-side. La prima esecuzione ha rivelato una richiesta test non autenticata e poi un item ID invalido nel caso di scrittura tardiva; entrambi corretti nel test e l’esecuzione finale è passata. La prova non è su dispositivi fisici o tastiere di sistema reali.
   - `pnpm run build:client` è eseguito dal comando browser e PASS.
7. **Dati e cleanup:** database e FileStore del test sono sintetici e temporanei; il cleanup `t.after` elimina la directory del singolo run. Non è stata eseguita pulizia indiscriminata di `.tmp/dev-preview/` né di file preesistenti. Nessun endpoint esterno o runtime di produzione è stato toccato.
8. **Readiness:** gate C4 soddisfatto per il perimetro software locale e criterio funzionale del browser. Pronto ad aprire C5 dopo decisione/avvio separato; il test non sostituisce prove su telefoni fisici, browser diversi, condizioni reali della LAN, deploy o Cloudflare. La dashboard/monitoraggio restano nell’ambito già disponibile e le estensioni C5 non sono state implementate.

**Git e rilascio:** il checkpoint è registrato nella cronologia Git locale; nessun push o rilascio produttivo è stato eseguito.

## Checkpoint C5 — Teacher Monitoring, Submissions & Grading UX (23 ottobre 2026)

**Stato:** completato e verificato localmente sul branch `codex/teacher-service-c5`, derivato dal commit C4 `f33f07d`. Nessun push, deploy o cambiamento a Cloudflare/K3s/GHCR/ingress. Il runtime produttivo non è stato interrogato o modificato in questo checkpoint. C6 e C7 non sono stati avviati.

- **Dashboard docente:** aggiunta panoramica con code per attività da preparare, prove attive, consegne da correggere e valutazioni concluse, collegata alle viste esistenti.
- **Monitoraggio live:** Seat Map e roster mostrano chi non ha iniziato, chi è in prova, consegnati/ritirati, risposte persistite, timestamp dell'ultimo salvataggio confermato dal server e timer; polling ogni 10 secondi e annunci una tantum delle nuove consegne osservate. Nessuna inferenza di inattività/proctoring.
- **Azioni durante la prova:** shortcut +5 minuti e concessione tempo extra configurabile, ritiro docente distinto dalla consegna volontaria e riapertura motivata. Operazioni idempotenti con chiavi stabili, aggiornamenti condizionali/transazionali e audit di autore, motivazione e dettagli; le risposte persistite sono mantenute. Endpoint docente restano protetti dall'autorizzazione server-side.
- **Correzione e risultati:** viste per studente e per quesito, override per item con feedback/note, revisioni non distruttive, proposta AI distinta dal voto confermato e protezione del voto finale da successive rielaborazioni automatiche. Statistiche su soli voti definitivi confermati con denominatore esplicito, media, deviazione standard di popolazione e distribuzione; export CSV/JSON/Markdown.
- **Moduli modificati:** `src/services/assessment-service.js`, `src/services/teacher-service.js`, `src/db/schema.js`, `src/db/database.js`, `src/server/http.js`, `src/mcp/server.js`, `src/core/contracts.js`; componenti docente in `client/src/components/` e `client/app.css`; test unitari, server, MCP e browser.
- **MCP:** mantenuto il servizio applicativo condiviso; aggiornato il contratto `reopen_submission` per motivazione, idempotency key e tempo aggiuntivo facoltativo. Nessuna modifica a endpoint o autenticazione OAuth MCP. Le nuove viste non introducono business logic MCP-only.
- **Test eseguiti:** `pnpm test` — 24 suite passate, 150 test passati, 0 falliti, 1 test loopback opt-in saltato dalla policy sandbox; esecuzione isolata di `node --test tests/mcp/http-loopback-integration.test.js` con permesso loopback — 1/1 pass (protocollo locale, non ChatGPT remoto); `pnpm run test:browser:c4` — 1/1 pass; `pnpm run test:browser:c5` — 1/1 pass; ciascun browser test ha anche ricostruito la SPA. C5 ha usato dati sintetici, SQLite/FileStore temporanei e AI mock.
- **Limiti:** viewport mobili/tablet verificati in Chromium simulato, non su dispositivi fisici; nessun invio di dati studente a provider esterni e nessun test AI live; nessuna modifica o verifica di produzione. C6 (analisi integrità e ampliamento MCP) è il prossimo checkpoint pianificato; nessun lavoro C6 incluso.

## Checkpoint C6 — MCP Assessment & Integrity Evidence (23 ottobre 2026)

**Stato:** implementato e verificato localmente sul branch `codex/teacher-service-c6`, derivato da C5 `b66a4da`; modifiche registrate nella cronologia Git locale, non pushate e non rilasciate. C7 resta **PLANNED**; nessuna modifica a produzione, Cloudflare, DNS, Tunnel, GHCR o K3s.

### Funzionalità effettivamente implementate

- **MCP assessment/grading:** aggiunti/completati `list_student_submissions(assessmentId)` (metadati senza risposte), `get_submission_detail(submissionId)` (dettaglio docente tramite `AssessmentService`), `grade_submission_ai(submissionId, model)` (proposta non finale), `analyze_integrity_evidence(assessmentId)` e `record_integrity_review(...)`. Restano riutilizzati i tool C5 per valutazione, revisione e export: non è stata duplicata la logica di grading. Le chiamate MCP continuano a richiedere un grant esplicito del teacher principal.
- **Privacy del grading:** l'uso di un provider esterno per risposte reali è negato in assenza dell'opt-in `TEACHER_SERVICE_ALLOW_EXTERNAL_STUDENT_GRADING=true`; il default è disabilitato. I test usano adapter mock e dati sintetici.
- **Analisi locale on-demand:** confronta soltanto consegne definitive, testo di risposta e codice testuale; usa le versioni dei materiali pubblicati esplicitamente associate ai quesiti. Risposte brevi, testo della traccia e sovrapposizioni con fonte didattica vengono esclusi o mostrati come contesto legittimo ove riconosciuti. Seat Map è soltanto contesto interpretativo, mai evidenza autonoma. Non sono emessi probabilità, verdetti di copiatura o sanzioni.
- **Limiti misurabili:** il confronto testo è lessicale e non rileva parafrasi; il codice JavaScript/TypeScript/Python viene normalizzato lessicalmente, senza AST né analisi algoritmica. Gli altri linguaggi e gli allegati binari sono dichiarati non analizzati. Non è implementato un rilevatore autonomo di errori rari/codice superfluo né un confronto con fonti Web. Le attuali guardie sono euristiche fisse e non calibrate: confronto di frasi da 5 token con almeno 3 termini informativi, esclusione di identità testuali sotto 16 parole, minimo di 12 token per il confronto del codice. Non rappresentano una scala di rischio; vanno rivalutate con il Domain Owner prima di qualsiasi uso decisionale.
- **Review e retention:** i report sono ricalcolati a richiesta e gli estratti non vengono persistiti. Il database conserva eventi append-only di review separati dal grading, con riferimenti a consegne/evidenza, versione dell'analisi, decisione, nota limitata, principal docente e idempotency key; non memorizza il contenuto delle risposte nel registro review.
- **Dataset sintetico di controllo:** ripetizione di una frase distintiva in risposte estese e codice con identificatori rinominati producono osservazioni; risposta standard breve identica non ne produce; una coppia vicina con risposte diverse genera solo contesto Seat Map; una coppia lontana con risposte diverse resta controllo negativo. La versione Student Material pubblicata è riconosciuta come contesto legittimo e contenuti Teacher-only/soluzioni riservate non compaiono nel report.
- **UI docente:** la scheda C6 usa le API HTTP protette esistenti per selezione classe/verifica, filtri per tipologia e review, confronto delle risposte e registrazione/consultazione dello storico decisionale. Non è una schermata demo; non modifica voto o condotta dello studente.

### Moduli e verifiche

- Moduli aggiornati: `src/services/integrity-analysis-service.js` (nuovo), `src/services/assessment-service.js`, `src/services/teacher-service.js`, `src/db/schema.js`, `src/server/http.js`, `src/mcp/server.js`, `client/src/components/IntegrityPreviewView.js`, `client/src/components/TeacherArea.js`, `client/app.css` e bundle `client/dist/`.
- Test aggiunti/aggiornati: `tests/unit/integrity-analysis.test.js`, `tests/unit/assessment-grading.test.js`, `tests/browser/integrity-c6-browser.test.js`, `tests/server/student-api.test.js`, `tests/mcp/http-loopback-integration.test.js`, `tests/run-all.js` e `tests/unit/run-unit.js`.
- `pnpm test`: **25 suite PASS, 0 FAIL** (incluse le regressioni C6); l'esito conclusivo è stato verificato localmente. Il test MCP Streamable HTTP su loopback è stato eseguito separatamente con autorizzazione di rete locale; tool discovery/invocazione, analisi/review e diniego REST anonimo verificati.
- `pnpm run test:browser:c4`: **1 test PASS** (due studenti, viewport responsive, ripristino offline, allegati, timer e consegna); `pnpm run test:browser:c5`: **1 test PASS** (docente, monitoraggio, grading e export); `pnpm run test:browser:c6`: **1 test PASS** (dashboard reale, review persistita, diniego anonimo e viewport smartphone). E2E Chromium locale con database/FileStore sintetici isolati; nessun dispositivo fisico.
- Build Vite: **PASS**, 32 moduli trasformati. Nessun provider AI/Web reale e nessuna connessione remota ChatGPT sono stati usati o dichiarati.

### Readiness e lavoro residuo

C6 soddisfa localmente il flusso minimo MCP/UI per consultare consegne, ottenere proposte di grading non definitive e registrare review di evidenze comparative. È possibile avviare **C7 come checkpoint di verifica**, non come rilascio: il gate dovrà rivalutare le euristiche fisse, confermare i controlli di autorizzazione/runtime e decidere esplicitamente se AST/semantica, fonti Web, allegati e analisi degli errori rari restano fuori perimetro o debbano precedere il rilascio. ChatGPT remoto e sistemi produttivi non sono stati testati in questo checkpoint.

### C7A — Pre-release validation & deployment readiness (24 ottobre 2026)

- Eseguite le regressioni C3–C6/T1 su soli dati sintetici. `TEACHER_SERVICE_ALLOW_EXTERNAL_STUDENT_GRADING=false pnpm test`: **25 suite PASS, 0 FAIL**, incluso MCP Streamable HTTP TCP loopback senza skip. `tests/server/student-api.test.js`: **37/37 pass**. I quattro test browser Playwright Chromium C4/C5/C6/T1 passano; build Vite e build/smoke container locale `linux/amd64` passano. I sottoflussi usano fixture separate: il percorso unico C4→C5→C6 sullo stesso assessment non è verificato. Nessun provider AI/Web o ChatGPT remoto reale testato.
- In `/src/server/http.js` le risposte REST/MCP sono `no-store`; gli errori di autorizzazione REST mantengono HTTP 403. Regressioni MCP dimostrano che il grading esterno disabilitato rifiuta REST/MCP prima del provider, senza valutazioni parziali. Il test rispetta la variabile d'ambiente `false`.
- Solo osservazione read-only K3s: Deployment `class` 1/1, Pod Running 1/1, Service e HTTPRoute web/MCP presenti, entrambi i PVC teacher Bound. Il cluster esegue ancora l'immagine T1 `20261020-f962706`; il Pod mostra 4 restart, non analizzati. Nessun dato PVC/secret è stato letto.
- Verifica infra statica `domain-check`/`exposure-dry-run`: PASS, nessun file cambiato. La proposta C3.1 Cloudflare è marcata come draft non applicabile: usa hash route non visibili all'edge, propone bypass/HCL non allineato al manifest-driven Terraform e cita un file HTTPRoute inesistente. `docs/operations.md` distingue ora API studente da API docente/MCP.
- **C7A Software Readiness: BLOCKED per rollout controllato**: test/build locali PASS, ma l'edge non può distinguere i percorsi docente/studente con hash routing e il flusso unico C4→C5→C6 sullo stesso assessment è NOT VERIFIED. **C7B Production Readiness: BLOCKED** per stato Cloudflare live non verificato, runtime ancora T1, 4 restart non analizzati e assenza di prova backup/restore e rollback DB+FileStore. Nessuna pubblicazione GHCR, modifica Cloudflare, deploy K3s o migrazione produttiva.
- Rapporto completo: [`docs/c7a-pre-release-readiness.md`](docs/c7a-pre-release-readiness.md). C0–C13 e le modifiche OmniRoute concorrenti in `infra` preservate; i container di smoke sono stati fermati e i dati test restano isolati.
