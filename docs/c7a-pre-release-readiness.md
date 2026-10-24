# C7A — Pre-release validation & deployment readiness

**Data di verifica:** 24 ottobre 2026 (Europe/Rome)
**Scope:** validazione locale C3–C6 e sola osservazione del runtime K3s.
**Decisione:** C7A completato; **C7B non avviato e non autorizzato**.

`PASS` significa che la prova indicata è stata eseguita con esito positivo; `BLOCKED` indica una condizione che impedisce un rilascio C3–C6; `NOT VERIFIED` indica una prova mancante. I test locali non sono prova di stato Cloudflare, connettività ChatGPT remota o recuperabilità dei dati di produzione.

## 1. Confini e preflight

- Repository applicativo: branch `codex/teacher-service-c6`, baseline `e2d8c7cb9d1c9620db929f634ae46851da041c28`. `main` è `382c58c`; il branch è avanti di quattro commit e non indietro. Non è configurato un remote, quindi non è possibile misurare la divergenza remota.
- Il worktree applicativo è unico. Le sole modifiche locali preesistenti all’integrazione C7A erano in `src/server/http.js`, `tests/mcp/http-transport.test.js` e `tests/browser/t1-browser.test.js`; sono state revisionate e mantenute. Non sono stati rimossi dati, test o evidenze C0–C13.
- Repository infra: branch `main`, HEAD `659a04c6b0ffc18bec79a5864cf2631c70f2bbe9`. Il working tree contiene modifiche concorrenti OmniRoute non correlate; sono state lasciate intatte. I manifest `k3s/apps/class`, `config/exposure.yaml` e `terraform/cloudflare` erano puliti rispetto al loro HEAD.
- Le fonti operative lette includono gli `AGENTS.md` applicativi e infra, gli standard `development-environment`, `docs/operations.md`, la roadmap C3–C7 e i runbook Terraform/Cloudflare K3s. Le verifiche infra lanciate sono state solo i controlli documentati e read-only.
- Non sono stati eseguiti push, pubblicazioni GHCR, apply Terraform, deploy, modifiche Cloudflare/DNS/Tunnel, migrazioni produttive, letture dei PVC, letture di Secret o accesso ai contenuti degli studenti.

## 2. Esiti software e integrazione locale

| Area | Esito | Evidenza |
|---|---|---|
| Suite applicativa | **PASS** | `TEACHER_SERVICE_ALLOW_EXTERNAL_STUDENT_GRADING=false pnpm test`: **25 suite passate, 0 fallite**. La suite finale include il test MCP TCP loopback senza skip. Test data sintetici/isolati. |
| REST/MCP, cache e grading privacy | **PASS** | `node --test tests/mcp/http-transport.test.js`: **14 test passati**. Verificati `Cache-Control: no-store`, 401/403 teacher authorization e rifiuto 403 del grading AI via REST; il tool MCP `grade_submission_ai` è rifiutato, `providerCalls=0` e nessuna valutazione parziale è persistita quando l'impostazione è `false`. Il test costruisce il servizio dal valore d'ambiente, non da un override applicativo. |
| MCP Streamable HTTP locale | **PASS** | `tests/mcp/http-loopback-integration.test.js`: initialize, tool discovery/invocazione CRUD, generazione/revisione contestuale e isolamento principal/sessione su TCP loopback: **1 test passato, 0 skip**. |
| C4, C5, C6, T1 nel browser | **PASS** | Playwright Chromium, quattro test: studente C4 (due sessioni, smartphone/tablet, offline, allegati, timer e consegna); docente C5 (creazione, monitoraggio, azioni, correzione, conferma ed export); C6 (evidenze teacher-only e viewport telefono); regressione T1 (homepage, area docente e flusso Lesson Pack). Tutti **1/1 pass**. Nessun dispositivo fisico, Firefox o WebKit verificato. |
| Student API e sicurezza HTTP | **PASS** | `node --test tests/server/student-api.test.js`: **37/37 pass**. Coperti impersonificazione/accesso cross-class, bozze e soluzioni docente, sessioni scadute o revocate, consegne immutabili, upload, claim concorrenti (una sola sessione), rinnovo dopo consegna, autosave multi-studente e anti-spoofing IP diretto. |
| Percorso C4→C5→C6 sullo stesso assessment/store | **NOT VERIFIED** | I test browser C4, C5 e C6 e il test MCP loopback passano, ma usano fixture separate. Non è stata eseguita un'unica traccia correlata dallo stesso assessment/submission attraverso pubblicazione, due studenti, offline/upload, monitoraggio, grading/export docente e ispezione MCP C6. Le prove dimostrano i sottoflussi, non l'intero percorso unificato richiesto. |
| Bundle web | **PASS** | `pnpm run build:client`: 32 moduli trasformati, build Vite completata. |
| Docker | **PASS locale, con limite** | Build frozen-lockfile riuscita. La build `linux/amd64` corrisponde all'architettura del nodo K3s ed è stata avviata sotto emulazione sul Mac arm64; il container ha restituito `/health` con `status=ok`, quindi è stato fermato. Local image ID: `sha256:438bc0a58c145cbaf26ec884f4c2d67387dc332f7680d9d08b4ffe8f3c3b5b2f`; manifest locale BuildKit amd64: `sha256:80b2d6fa4bf175ba209e68ca9a6335d4c1a1fcf21e76750f0c4bf47074bc8295`. **Non** sono digest GHCR e non sono stati pubblicati. Non è una prova su hardware amd64 nativo. |
| Manifest domini/exposure infra | **PASS statico** | `make -C ~/Workspace/infra domain-check` e `exposure-dry-run`: entrambi pass; `files_changed=0`, `semantic_target_changes=0`. Non interrogano o dimostrano lo stato live Cloudflare. |
| Grading studente AI | **PASS app-level; runtime NOT VERIFIED** | La variabile `TEACHER_SERVICE_ALLOW_EXTERNAL_STUDENT_GRADING=false` viene interpretata fail-closed dal servizio. Il test copre REST e MCP prima di invocare il provider. Il componente UI usa lo stesso endpoint REST; non è stata trovata un'azione UI AI attualmente raggiungibile (il relativo flag resta false). Il ConfigMap desiderato non contiene la variabile, ma non è stato ispezionato il Secret/runtime env produttivo. Nessun dato studente reale è stato inviato. |
| Connettività ChatGPT | **NOT VERIFIED** | È stato verificato il trasporto MCP locale, non una sessione remota autenticata di ChatGPT. |

### Limiti C6 e privacy AI

Interfaccia, MCP e servizio descrivono correttamente C6 come confronto lessicale/deterministico sperimentale, non analisi AST/semantica né verdetto di copiatura. La UI dichiara che similarità e riscontri non costituiscono prova e non produce colpevolezza o sanzioni; la decisione rimane al docente.

Con l'opzione di grading esterno **disattivata**, le proposte AI su risposte aperte falliscono prima della chiamata al provider. Se in futuro il proprietario autorizzasse l'opzione, il prompt contiene il quesito, la soluzione docente, la rubrica e la risposta testuale. L'attuale codice non aggiunge al prompt il nome dello studente, il suo ID o l'allegato; un allegato senza testo richiede revisione docente. Prima di abilitarlo servono una decisione privacy/organizzativa e un'autorizzazione specifica; non è coperta da questo checkpoint.

### Dati locali su dispositivi condivisi

La cache offline studente conserva risposte e stato della prova in IndexedDB per il recupero, con identità per-sessione; il bearer token vive in `sessionStorage`, non viene scritto nella cache. La UI elimina la cache locale alla consegna e all'uscita esplicita; i record locali hanno scadenza applicativa di 24 ore. La cache IndexedDB non è cifrata a riposo dal servizio. Il flusso browser verifica ripristino offline e separazione di sessioni, ma **non** prova cancellazione forense, isolamento tra profili browser condivisi o chiusura anomala del browser. Per dispositivi condivisi servono profili/browser gestiti e istruzioni di uscita; valutare una politica di retention più breve prima dell'uso scolastico. Questo limite va accettato esplicitamente dal Domain Owner/DPO, non interpretato come storage protetto.

## 3. Stato runtime K3s (sola lettura)

Il runbook infra indica `<backup-host>` come entrypoint; il contesto kubectl sul Mac non è configurato. È stata quindi eseguita, tramite il percorso documentato, una lettura limitata a Deployment, Service, HTTPRoute, Pod e PVC (nessun contenuto o secret):

- Deployment `class`: `1/1` ready, immagine `ghcr.io/simogatti04/class:20261020-f962706`.
- Pod: `1/1 Running` su `<backup-host>`, con **4 restart** (ultimo riportato circa 11 ore prima della lettura); causa non investigata in questo checkpoint.
- Service `class`: presente.
- HTTPRoute `class` su `class.simogatti.it` e `mcp-teacher` su `mcp-teacher.simogatti.it`: presenti.
- PVC `class-teacher-db` (2 GiB) e `class-teacher-files` (5 GiB): entrambi `Bound`.

Questo conferma lo stato attuale del runtime T1, **non** il rilascio C3–C6: il cluster sta ancora eseguendo l'immagine T1 `f962706`. La readiness probe attiva `/health`; non sono stati letti log, DB, FileStore o Secret. Gli ultimi restart richiedono verifica prima di C7B.

## 4. Cloudflare/routing: blocco da risolvere prima di C7B

La proposta precedente `docs/cloudflare-routing-iac-proposal.md` **non è eseguibile così com'è** ed è stata contrassegnata come draft storico non approvato:

1. `client/app.js` usa hash routing (`#/docente`, `#/studente`). Il fragment non raggiunge l'edge; pertanto i path proposti `/docente*` non corrispondono alla UI docente attuale.
2. `infra/config/exposure.yaml` dichiara `class` con Access su `primary_path: ""` e destination `""`, che nel manifest rappresenta la radice dell'host. Il `HTTPRoute` K3s inoltra l'host `class.simogatti.it` al medesimo Service senza separare i path. Il risultato desiderato — homepage/studenti pubblici, docente protetto — non è dimostrato da hash routing.
3. Il draft suggerisce un Access HCL dedicato `access-class.tf`, una policy `bypass everyone` e `options_preflight_bypass=true`. L'implementazione infra attuale è manifest-driven da `exposure.yaml`; il catalogo policy corrente non contiene la policy bypass proposta; il profilo `teacher-web` mantiene il preflight bypass disabilitato. Il draft cita inoltre `ingress-route.yaml`, mentre il file reale è `k3s/apps/class/httproute.yaml`.
4. C'è una discrepanza documentale: `infra/docs/10-cloudflare-domain-management.md` riassume tre Access application K3s, mentre `exposure.yaml` contiene anche la entry `class`; `terraform/cloudflare/access.tf` genera l'inventory dalle entry del manifest. Non è stata fatta una lettura provider/Cloudflare dello stato live per risolverla.
5. Il backend applica una distinzione fail-closed: solo `/api/student/*` entra nell'handler a sessione studente; gli altri `/api/*` richiedono teacher authentication e membership, mentre `/mcp` mantiene il percorso autonomo. I test locali dimostrano la protezione applicativa; **non dimostrano il comportamento edge di tutte le regole o dei path non corrispondenti**.

**Gate richiesto:** rivedere routing e policy con il proprietario infra, scegliere e documentare un confine che l'edge possa effettivamente vedere (path URL reale o host separato), aggiornare il source of truth manifest-driven e il router applicativo se necessario, definire un default-deny/protected per percorsi non classificati e validare un saved plan access con il runbook infra. Non aggiungere un bypass universale né applicare manualmente HCL. C7B deve prima verificare che i percorsi docente/MCP restino protetti e gli endpoint studente raggiungano solo l'autenticazione applicativa.

## 5. Migrazioni, persistenza e rollback

Le migrazioni C3–C6 sono additive (`CREATE TABLE IF NOT EXISTS` più `ALTER TABLE ... ADD COLUMN` condizionale). La suite include test SQLite di migrazione, e una migrazione sintetica dalla schema T1 `f962706` è stata verificata senza toccare dati produttivi: Lesson Pack/versioni sintetici conservati, `integrity_check=ok`, nessun risultato `foreign_key_check`, tabelle C3–C6 aggiunte. Questo è evidenza di compatibilità su copia sintetica, **non** un backup o un restore della produzione.

Il runbook operativo conferma che SQLite e FileStore sono su storage node-local (`<backup-host>`) e che non esiste una destinazione di backup indipendente. Non è stata effettuata né è verificabile una copia/restoration produttiva in C7A. Il rollback dell'immagine non annulla le migrazioni SQLite e non è stato dimostrato il rollback applicativo su una copia migrata con tutti i dati T1/C3–C6.

**Blocco esplicito al rilascio:** prima di ogni migrazione produttiva, il proprietario deve autorizzare e supervisionare una copia consistente di DB + FileStore, ripristinarla in ambiente isolato e verificare integrità SQLite, foreign keys, hash FileStore e recupero Lesson Pack/versioni. Non introdurre una nuova infrastruttura di backup: se non è disponibile una procedura autorizzata e provata, C7B resta bloccato. La conservazione PVC `Retain` non è backup.

## 6. Proposta C7B (non eseguita)

Prerequisiti obbligatori:

1. Risolvere routing/access e documentare le prove edge anonime/protette; preservare l'host MCP e le sue credenziali.
2. Verificare i 4 restart del Pod e il mapping teacher runtime senza visualizzare secret.
3. Completare prova di backup/restore su copia e rollback applicativo/schema; non fare migrazioni live senza gate.
4. Chiudere review privacy su cache offline e sull'eventuale grading esterno; mantenere quest'ultimo disabilitato finché non autorizzato.
5. Ritagliare un commit applicativo finale; buildare `linux/amd64`, eseguire suite e smoke, quindi pubblicare solo dopo autorizzazione il tag GHCR immutabile e annotarne il digest remoto. L'ID locale di questa build **non** può essere usato come digest GHCR.
6. Per Access utilizzare solo il workflow infra documentato di saved plan (`make cf-save-access-plan`, `make cf-verify-access-plan`) e ottenere review esplicita prima di qualsiasi apply. Per K3s, validare il bundle e applicare con wrapper infra `make k-apply APP=class` solo dopo autorizzazione C7B.
7. Sequenza proposta: recovery copy provata → app/image candidata con Access corrente ancora chiuso → verifica teacher/MCP → Access path/host split da saved plan → smoke test pubblico, studente e docente → osservazione e criteri STOP → rollback applicativo secondo procedura provata. Non usare `rollout undo` come sostituto del ripristino DB/FileStore.

Nessuno di questi passaggi di rilascio è stato eseguito.

## 7. Readiness finale

| Giudizio | Esito | Motivazione |
|---|---|---|
| **C7A Software Readiness** | **BLOCKED per un rollout C3–C6 controllato; PASS per build/test locale** | Suite, browser e build locali passano. La readiness software per un rollout controllato resta BLOCKED: il routing hash corrente non consente all'edge di distinguere l'area studente da quella docente e il percorso completo C4→C5→C6 sullo stesso dataset è NOT VERIFIED. Il draft IaC storico non è conforme all'attuale source of truth. Backup/restore e rollback sono invece gate di readiness produttiva C7B. |
| **C7B Production Readiness** | **BLOCKED** | Il runtime live è T1; Cloudflare live non è stato verificato; ci sono 4 restart non spiegati; non c'è prova di restore DB+FileStore; il percorso studente senza Access non è verificato. Il proprietario decide se e quando autorizzare C7B. |

**Remote ChatGPT:** `NOT VERIFIED`.
**Stato operativo:** nessun rilascio; nessun cambiamento a produzione/infra.

---

# C7A-R1 — Blocker Resolution Addendum (24 ottobre 2026)

**Baseline di questo addendum:** `codex/teacher-service-c6` @
`f901a9f8ccfdf935cd83c6430a5f03dbcb19b4bb`. Il riferimento baseline
`e2d8c7cb...` nel rapporto audit precedente descriveva un controllo diverso;
non è la baseline di C7A-R1. Il worktree infra è rimasto su `main` @
`659a04c6b0ffc18bec79a5864cf2631c70f2bbe9` e le modifiche concorrenti OmniRoute
sono state preservate. C7A-R1 non ha eseguito push, apply, deploy, build/publish
GHCR, modifiche a Cloudflare/DNS/Tunnel/K3s, letture PVC o letture di Secret.

## Esito sintetico

L'E2E unificato sullo stesso assessment è **PASS** in ambiente locale isolato:
una sola istanza applicativa, un solo SQLite temporaneo, un solo FileStore
sintetico, due sessioni browser individuali, mock AI e nessun dato reale. Le
risposte e gli identificativi sono confrontati fra API docente, database,
export e MCP; l'analisi C6 e la review docente riguardano le stesse consegne.

Il routing basato su path HTTP è implementato e verificato localmente, ma il
confine Cloudflare non è stato applicato né verificato live. La procedura di
snapshot/restore è implementata e provata su fixture; recuperabilità, backup e
rollback produttivi non sono dimostrati. **C7B rimane BLOCKED e non autorizzato.**

## Matrice dei blocchi

| Blocco iniziale | Correzione / evidenza | Stato | Decisione o blocco residuo |
|---|---|---|---|
| C4, C5, C6 e MCP provati solo con fixture disgiunte | `tests/browser/c7a-unified-browser.test.js`: stesso assessment e app, SQLite/FileStore unici, due browser/studenti; risposte a scelta multipla, aperte, codice e allegato; offline/reconnect, autosave/consegna, tempo extra, monitoraggio, grading/review, statistiche, export, MCP e review C6. ID e contenuti sono confrontati con SQLite, REST, JSON export e MCP. | **PASS — 1/1 browser E2E** | Nessun dato produttivo usato. AI mock esplicito; non è un test di provider esterno. |
| Distinzione delle superfici basata solo su hash UI | Frontend instradato da `/`, `/studente`, `/docente`; fallback SPA per deep link/refresh; vecchi hash normalizzati con navigazione HTTP; REST `/api/*` rimane autenticata/applicativamente autorizzata; `/api/student/*` usa sessione studente. | **PASS locale** | La protezione Edge Cloudflare non è implicata dal routing applicativo. |
| Configurazione Access root impedisce la homepage studente pubblica | Proposta statica in `docs/cloudflare-routing-iac-proposal.md`: mantenere una sola app Access docente per `/docente` e `/api/*`, con app Bypass più specifica limitata a `/api/student/*`; root e `/studente` senza app Access; hostname MCP invariato. Verificata contro manifest locale, HCL presente e schema provider bloccato 5.24.0. | **PASS statico; live NOT VERIFIED** | Repo infra non modificato per le variazioni concorrenti OmniRoute. Nessun piano Terraform o stato Cloudflare live consultato; richiede review e autorizzazione C7B. |
| Quattro restart del pod T1 senza causa accertata | Diagnostica K3s read-only: deployment 1/1 Ready; ultimo container terminato `reason=Error`, `exitCode=137` il 23 ottobre 2026 13:27:25 UTC, nuovo avvio 13:27:28 UTC; nessun evento pod trovato. Nodo osservato `Ready`, senza Memory/Disk/PIDPressure; metriche correnti ~2.9 GiB RAM (37%), pod ~29 MiB. Gli eventi `FreeDiskSpaceFailed` iniziano il 23 ottobre 14:13:43 UTC, dopo l'ultimo restart, e proseguono fino al 24 ottobre 10:48:45 UTC (248 eventi). | **NOT VERIFIED — causa non determinata** | `137` non prova OOM; Kubernetes ha registrato `Error`, non `OOMKilled`. Mancano dettagli storici delle terminazioni precedenti e log/eventi al momento del restart. Nessuna correlazione causale con eventi successivi. |
| SQLite + FileStore senza procedura di recovery provata | CLI locale snapshot/verify/restore; `VACUUM INTO`, inventory SHA-256, integrity/FK check, restore solo su destinazioni nuove. `tests/integration/store-snapshot.test.js` ripristina contenuto/versioni T1/C6 e byte allegato. | **PASS su fixture isolata** | **Backup produzione NOT VERIFIED; restore produzione NOT VERIFIED.** Nessun PVC letto o scritto; destinazione e retention produttive non definite. Il rischio single-node resta. |
| Compatibilità T1 → C6 e rollback immagine non provati su dati veri | Test `migration-additive` conserva fixture legacy con migrazioni additive; snapshot fixture conserva due versioni e allegato. Runbook aggiornato: niente downgrade distruttivo; provare l'immagine precedente su una copia ripristinata prima di riutilizzarla. | **PASS fixture; production NOT VERIFIED** | Nessuna prova su DB/PVC T1 reale, né compatibilità del precedente container con il DB migrato. |
| IP reale e rate-limit del claim-code dietro Cloudflare/Traefik | Resolver e test anti-spoofing verificati localmente; il manifest K3s corrente non dichiara `TEACHER_SERVICE_TRUSTED_PROXY_CIDRS`, e l'indirizzo immediatamente visto dal Pod non è stato verificato. | **NOT VERIFIED in produzione** | Non fidarsi degli header client. Prima di C7B rilevare il peer proxy autorizzato e configurare solo la sua CIDR; altrimenti più studenti potrebbero condividere un bucket rate-limit del proxy. |
| Regressioni applicative e test integrati | `pnpm test`: 28 suite / 158 test PASS; browser C4, C5, C6, unificato C7A e T1: 1 test ciascuno PASS; build frontend eseguite nei runner browser. | **PASS locale** | I test sintetici non provano Cloudflare live, ChatGPT remoto o produzione. |
| Limiti d'uso C6 per il primo rilascio | Raccomandazione tecnica: Opzione B, mantenere C6 nascosto dalla UI produttiva finché limiti e comunicazione sperimentale non siano approvati; preservare codice e audit. Nessun provider AI esterno o decisione automatica è stata abilitata da questo checkpoint. | **BLOCKED — decisione del proprietario** | La schermata docente C6 e i tool MCP risultano nel codice corrente. L'Opzione B è una raccomandazione, non una modifica applicata; il proprietario deve decidere anche se i tool C6 MCP rimangono disponibili ai docenti. |
| Gate di rilascio | Separazione Access live, audience web, recuperabilità produttiva e decisione C6 non dimostrate. | **C7B BLOCKED / non autorizzato** | Nessun rilascio o mutazione infrastrutturale è parte di C7A-R1. |

## Moduli e file modificati

- Routing/path: `client/app.js`, `client/src/components/Homepage.js`,
  `client/src/components/ActivitiesView.js`, `src/server/static.js`.
- Rate-limit IP e integrazione handler: `src/server/client-ip.js`,
  `src/server/http.js`; test anti-spoofing adeguati affinché l'IP di test sia
  il peer reale e gli header inoltrati falsificabili non determinino il bucket.
- Coerenza delle esportazioni complete usate per confrontare il dataset:
  `src/services/assessment-service.js`.
- Recovery: `src/storage/store-snapshot.js`,
  `bin/teacher-service-store-snapshot.js`,
  `tests/integration/store-snapshot.test.js`.
- Verifica: `tests/server/application-routing.test.js`,
  `tests/server/client-ip.test.js`,
  `tests/browser/c7a-unified-browser.test.js`, `tests/run-all.js`,
  `package.json` (`test:browser:c7a`).
- Documentazione: questo addendum, `docs/operations.md` e la sezione C7A-R1
  di `docs/cloudflare-routing-iac-proposal.md`.

## Piano concreto per C7B — non eseguito

1. Ottenere la decisione scritta del proprietario su C6 UI/MCP e il consenso
   separato per un piano Cloudflare; identificare un target snapshot/retention
   senza presumere che le PVC locali siano backup indipendenti. Determinare il
   peer/CIDR proxy effettivo del Pod e configurare la allowlist trusted-proxy
   solo su evidenza runtime approvata.
2. In un worktree infra autorizzato e senza toccare il lavoro OmniRoute, cambiare
   il manifest Access e il mapping `access.policy` seguendo la proposta. Eseguire
   solo validazioni statiche prima di generare un piano salvato con wrapper
   canonico; verificare che non tocchi DNS, Tunnel, altri host o MCP. Fermarsi
   prima dell'apply e sottoporre il piano al proprietario.
3. Verificare dal piano se l'app `class` viene aggiornata o sostituita. Se cambia
   `aud`, pianificare insieme l'aggiornamento della ConfigMap non-secret
   `TEACHER_SERVICE_WEB_CF_ACCESS_AUD`, preservando l'audience MCP.
4. Prima di migrare dati, ottenere un target di recovery approvato e una finestra
   di quiescenza. Provare snapshot/verify/restore e la migrazione T1→C6 su copie
   isolate, quindi testare l'immagine precedente contro la copia. Senza questi
   esiti non procedere al rollout.
5. Solo dopo autorizzazione separata: applicare l'eventuale piano Access e il
   rollout K3s in fasi reversibili; verificare anonimo `/`, `/studente`,
   `/api/student/*`, redirect docente, API gestionale, audience, MCP invariato,
   PVC, salute e smoke test. Nessun apply/deploy è stato eseguito in C7A-R1.

**Software Readiness:** routing applicativo ed E2E unificato **PASS**.
**Infrastructure Readiness:** Access live, produzione backup/restore e rollback
su DB migrato **NOT VERIFIED/BLOCKED**. **Non dichiarare C7B pronto.**
