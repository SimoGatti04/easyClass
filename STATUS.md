# Teacher Service — Stato operativo

**Aggiornato:** 2026-10-13 (Europe/Rome)  
**Fase attiva:** Live Integration & ChatGPT MCP Readiness (Supervisione: ChatGPT)  
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
