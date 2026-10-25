# Teacher Service — C7B Release Go/No-Go & Operational Readiness

**Data:** 25 ottobre 2026 (Europe/Rome)  
**Ruolo:** Release Engineer / Infrastructure Engineer / QA  
**Supervisione:** ChatGPT  
**Stato operativo:** verifica C7B-P2 pre-R3 storica; aggiornata dal checkpoint C7B-R3 — nessun deployment eseguito
**Verdetto corrente:** **NO-GO / C7B NON PRONTO AL RILASCIO** — software R3 verificato solo localmente; edge, secret di produzione, persistenza e rollback post-R3 non verificati.

---

> **Avvertenza:** il verdetto `READY FOR AUTHORIZATION` riportato nella sezione 9 si riferisce esclusivamente alla baseline pre-R3 e non è più valido. La sezione 10 è la valutazione corrente e prevale in caso di conflitto.

## 1. Confini, Preflight e Verifica dello Stato Reale (Sola Lettura)

### 1.1 Repositories e Worktrees
- **Repository applicativo (`teacher-service-design`):**
  - Path: `~/Workspace/teacher-service-design`
  - Branch: `codex/teacher-service-c6`
  - Baseline di partenza: `8b6c7f1 fix(c7b-p0): align pre-opening smoke test, dual SIGKILL recovery verification, and teacher auth docs`
  - Working tree: pulito, nessun file tracciato modificato o non tracciato.
- **Repository infrastrutturale (`infra`):**
  - Path: `~/Workspace/infra`
  - Branch: `main` (commit `659a04c fix(networking): bump cloudflared to 2026.10.3 for eMudhra security advisory`)
  - Modifiche concorrenti OmniRoute in `k3s/apps/omniroute/` e `tasks/`: **integralmente preservate e intatte**.
- **Worktree isolato infrastrutturale:**
  - Path: `~/Workspace/infra-class-routing`
  - Branch: `feature/class-student-routing`
  - Commit IaC: `b5b4b05808781b8bcc1f13d069e975e8c608b1f4`
  - Working tree: pulito.

### 1.2 Stato Runtime K3s (Sola Lettura via Target Autorizzato `make k`)
Ispezione eseguita senza accesso a dati utente o secret:
- **Pod:** `class-5744fcfb8-97v8f` (1/1 `Running`, IP `10.42.1.42`, nodo `<backup-host>`, restart count: 4 con ultimo restart 47 ore fa il 23 ottobre 2026 13:27 UTC).
- **Deployment:** `deployment.apps/class` (1/1 Ready, immagine `ghcr.io/simogatti04/class:20261020-f962706`, image ID `@sha256:79d7c084233c60049c18e24459fde84160178cdf58b9e52461c97906180b455c`).
- **Service:** `service/class` (ClusterIP `10.43.37.253`, porta 80/TCP, selector `app=class`).
- **Storage e PVCs:**
  - `persistentvolumeclaim/class-teacher-db` (2Gi Bound, `StorageClass: class-local`, PV `class-teacher-db`, host path `/srv/class/teacher-service/db` su `<backup-host>`, `reclaimPolicy: Retain`).
  - `persistentvolumeclaim/class-teacher-files` (5Gi Bound, `StorageClass: class-local`, PV `class-teacher-files`, host path `/srv/class/teacher-service/files` su `<backup-host>`, `reclaimPolicy: Retain`).
  - *Nessun volume produttivo è stato letto, copiato o montato.*
- **ConfigMap `class-config`:**
  - `HOST: 0.0.0.0`, `PORT: 80`, `NODE_ENV: production`, `TEACHER_SERVICE_AUTH_MODE: strict`.
  - `TEACHER_SERVICE_CF_ACCESS_ISS: https://simogatti.cloudflareaccess.com`.
  - `TEACHER_SERVICE_CF_ACCESS_AUD: 3a2781b1104b6ec529e0b91a2133114ffc8ad9a1803d15cb01bc4ff09c9d68cc` (AUD MCP invariato).
  - `TEACHER_SERVICE_WEB_CF_ACCESS_AUD: efba3266e210f6077d0e86f50721d7a3896e0deb1b9e60a5acc325af39b1e21d` (AUD Web docente).
  - `TEACHER_SERVICE_TEACHER_EMAILS: teacher@school.example`.
- **Probes:**
  - Liveness: HTTP GET `/health` port 80, delay 15s, period 20s, timeout 1s.
  - Readiness: HTTP GET `/health` port 80, delay 5s, period 10s, timeout 1s.

---

## 2. Revisione Finale Cloudflare Access & Piano IaC

### 2.1 Risultato del Saved Plan (Scope `access`)
Generato tramite il wrapper canonico `make cf-save-access-plan` nel worktree isolato `infra-class-routing` su commit `b5b4b05`:
- **File generati:**
  - `access.tfplan` (SHA-256: `bf4a1fbaff75be3d3740e0d989e12a68c6b85b24a1aad0213237903f0b79c086`)
  - `access.exposure.yaml` (SHA-256: `2d330ffa8d9d162f35100ff8fe3b477a337aa9ca9d1126477811a4258f40d396`)
  - `access.attestation.json` (Attestazione valida generata il 25 ottobre 2026 12:20:47 UTC).
- **Azioni Terraform esatte:**
  1. `cloudflare_zero_trust_access_application.k3s["class"]`: **UPDATE IN-PLACE** (`~`)
     - Modifica del `domain` da `class.simogatti.it` a `class.simogatti.it/docente`.
     - Modifica delle `destinations` a `["class.simogatti.it/docente", "class.simogatti.it/api"]`.
     - ID risorsa preservato (`61b7861a-3587-479d-91d3-063b66a6ef96`).
     - **Invarianza AUD docente:** Non vi è distruzione né ricreazione della risorsa; l'Application AUD esistente **non cambia**.
  2. `cloudflare_zero_trust_access_application.k3s["class-student-api"]`: **CREATE** (`+`)
     - `domain`: `class.simogatti.it/api/student`.
     - `destinations`: `["class.simogatti.it/api/student"]`.
     - Policy associata: `teacher_service_student_api_public`.
  3. `cloudflare_zero_trust_access_policy.teacher_service_student_api_public`: **CREATE** (`+`)
     - `decision = "bypass"`.
     - `include = [{ everyone = {} }]`.
     - Nessuna regola RDP o attributo di protocollo estraneo (HTTP puro).
- **Azioni distruttive / sostituzioni:** **0 destroy, 0 replace**.
- **Invarianza assoluta:**
  - DNS: 0 modifiche.
  - Cloudflare Tunnel: 0 modifiche.
  - MCP (`mcp-teacher.simogatti.it`): 0 modifiche.
  - Altre applicazioni Access / MacMini: 0 modifiche.

### 2.2 Semantica dei Percorsi e Copertura Sub-paths
- In Cloudflare Access, una destination URL con path opera come prefisso:
  - `class.simogatti.it/docente` copre `/docente`, `/docente/`, `/docente/attivita/:id` (richiede autenticazione IdP).
  - `class.simogatti.it/api` copre `/api`, `/api/`, `/api/classes`, `/api/materials`, `/api/lessons`, `/api/assessments` (richiede autenticazione IdP).
  - `class.simogatti.it/api/student` è associata a un'applicazione Access distinta e più specifica: in base alla regola del *longest matching prefix*, Cloudflare Access invoca la policy Bypass su `/api/student/*`.
  - La radice `/`, la SPA studente `/studente`, `/studente/*`, `/index.html` e `/assets/*` non appartengono ad alcuna applicazione Access: il traffico attraversa il Tunnel e giunge direttamente all'applicazione Node.js, dove viene servito lo shell frontend o applicato il controllo di autorizzazione applicativa fail-closed.
- **Validità Attestazione e Rigenerazione:** L'attestazione del piano salvato dura 15 minuti ed è scaduta. Nel runbook di rilascio è previsto il comando canonico di refresh immediato prima dell'apply.

---

## 3. Trusted Proxy, Peer TCP e Identificazione IP Reale

### 3.1 Catena di Rete
```text
Client Browser / Studente
       │
       ▼
Cloudflare Edge (iniezione header CF-Connecting-IP, X-Forwarded-For)
       │
       ▼ (Cloudflare Tunnel)
cloudflared Pods (namespace networking, nodi <backup-host>/<backup-host>)
       │
       ▼ (ClusterIP http://traefik.kube-system.svc.cluster.local:80)
Traefik Ingress Gateway (namespace kube-system, pod su <backup-host> IP 10.42.0.173)
       │
       ▼ (Gateway API HTTPRoute -> ClusterIP class.class.svc.cluster.local:80)
Teacher Service Pod (namespace class, pod su <backup-host> IP 10.42.1.42)
```

### 3.2 Peer TCP Visto dal Pod e Anti-Spoofing
- **Comportamento attuale in produzione:** La ConfigMap `class-config` non definisce la variabile `TEACHER_SERVICE_TRUSTED_PROXY_CIDRS`.
- **Logica applicativa (`src/server/client-ip.js`):**
  - Se `TEACHER_SERVICE_TRUSTED_PROXY_CIDRS` è vuoto o non impostato, `hasTrustedRanges` è `false`.
  - `resolveClientIp` scarta immediatamente qualsiasi header `CF-Connecting-IP` o `X-Forwarded-For` e restituisce direttamente il socket peer TCP (`req.socket.remoteAddress`).
  - Pertanto, l'applicazione è intrinsecamente **fail-closed contro IP spoofing** anche in assenza di configurazione proxy.
- **Compatibilità con il Rate Limiting delle Aule:**
  - Poiché tutte le richieste da Traefik giungono al pod con il medesimo IP peer del cluster (IP Traefik o IP Gateway CNI Flannel `10.42.x.x`), un rate limiter ingenuo basato solo su IP bloccherebbe l'intera classe dopo 5 errori.
  - La nuova implementazione `ClaimRateLimiter` (`src/server/claim-rate-limiter.js`) risolve questo vincolo su tre livelli ortogonali:
    1. **Livello Dispositivo (`ts_device_id`):** cookie `HttpOnly; SameSite=Lax` emesso automaticamente dal server al primo accesso (o header `x-student-device-id`). Soglia: 5 errori per dispositivo.
    2. **Livello Codice (`IP:CODICE`):** soglia di 5 errori consecutivi sul medesimo codice da parte dello stesso indirizzo peer.
    3. **Livello Aggregato IP:** soglia allargata a `ipMaxFails = 120` in 5 minuti e `ipBurstMaxFails = 75` in 10 secondi.
  - Questo modello è stato validato sperimentalmente con test automatici (inclusi 30 studenti simultanei sotto lo stesso NAT con errori multipli): il bucket del singolo allievo che sbaglia si blocca, mentre gli altri 29 continuano a lavorare regolarmente.
- **Verdetto:** **NOT VERIFIED in produzione per il singolo IP Traefik; PROTETTO E COMPATIBILE a livello applicativo.**  
  *Raccomandazione:* Non configurare subnet arbitrarie come `10.42.0.0/16`. Solo durante una futura sessione autorizzata si potrà rilevare l'esatto peer IP di Traefik e impostare una CIDR stretta `/32` in ConfigMap.

---

## 4. Verifica della Superficie Studente Pubblica (Privacy & Sicurezza)

L'apertura dell'area studente espone pubblicamente gli endpoint sotto `/api/student/*`. L'audit analitico del codice (`src/server/http.js`) conferma:

| Endpoint | Metodo | Dati Restituiti | Valutazione Privacy / Sicurezza |
|---|---|---|---|
| `/api/student/classes` | GET | `id`, `name`, `section`, `academicYear` | **Pubblico didattico:** consente la selezione della classe; nessun dato personale. |
| `/api/student/classes/:id/students` | GET | `id`, `firstName`, cognome puntato (`s.last_name[0] + '.'`), `fullName` | **Roster privacy-preserving:** non espone cognomi completi, codici fiscali, email o voti. |
| `/api/student/classes/:id/activities` | GET | `id`, `title`, `description`, `durationMinutes`, `maxScore`, `status` | **Filtro rigoroso:** espone solo attività con `status IN ('ready', 'active')` e `is_active !== 0`. Bozze (`draft`) e archiviate sono invisibili. |
| `/api/student/claim-code` | POST | Emette token Bearer studente (scadenza 24h) | **Rate limitato:** difese anti brute-force su device, codice e IP burst. |
| `/api/student/session` | GET | Sessione associata al token Bearer | Richiede Bearer studente valido; fail-closed. |
| `/api/student/activities/:id` | GET | Quesiti della prova | **Teacher solutions e rubrics rimosse:** `includeTeacherSolutions: false` forzato lato server. Rifiuta attività in stato `draft`. |
| `/api/student/activities/:id/neighbors` | GET | Compagni di classe anonimizzati | Richiede sessione studente; serve esclusivamente alla mappa dei posti. |
| `/api/student/activities/:id/submission` | GET | Consegna dello studente | **Isolamento rigoroso:** vincolata a `session.studentId`. Impossibile visualizzare consegne di altri studenti. |
| `/api/student/activities/:id/start` | POST | Avvio timer prova | Richiede sessione studente; rifiuta se già avviata/consegnata. |
| `/api/student/activities/:id/autosave` | POST | Salvataggio bozza risposte | Richiede sessione studente; revisione monotonica; rifiuta dopo la consegna finale (409 Conflict). |
| `/api/student/activities/:id/submit` | POST | Finalizzazione consegna | Richiede sessione studente; rende la prova immutabile. |
| `/api/student/upload` | POST | Upload allegato studente | Richiede sessione studente; verifica MIME magic bytes ed estensioni sicure; proprietà salvata a database prima del riferimento. |
| `/api/student/attachment` | GET | Download allegato | Richiede sessione studente e verifica esplicita della proprietà dell'allegato. |

**Verdetto:** **PASS — Nessun rischio di data leak didattico o personale identificato.**

---

## 5. Recovery e Destinazione Off-Node

### 5.1 Invariante di Storage e Rischio Single-Node
- Lo storage produttivo risiede sui PVC `class-teacher-db` e `class-teacher-files` mappati localmente su `<backup-host>` (`/srv/class/teacher-service/*`).
- Non vi è replica automatica tra i nodi: la perdita fisica del disco su `<backup-host>` comporterebbe la perdita dello store.
- **Destinazione off-node identificata:**
  - Nodo secondario del cluster: `<backup-host>` (IP `198.51.100.13`), directory di staging operatore `/srv/backup/teacher-service/` (o workstation Mac mini dell'operatore via `scp`/`rsync`).
  - Accessibile tramite SSH da Mac mini durante la finestra di manutenzione.

### 5.2 Meccanica di Recovery Non-Atomica
- Poiché SQLite (`VACUUM INTO`) e FileStore (`fs.cpSync`) non costituiscono una singola transazione POSIX atomica:
  - Lo snapshot deve essere eseguito esclusivamente in **quiescenza delle scritture** (arresto del traffico client).
  - La procedura è gestita da `bin/teacher-service-store-snapshot.js create`.
  - Lo snapshot produce `manifest.json` con hash SHA-256 di SQLite e di ogni singolo file del FileStore.
- **Pre-Attachment Gate Obbligatorio:**
  - Prima che qualsiasi volume o directory ripristinata venga montata o collegata all'applicazione, è obbligatorio eseguire:
    ```bash
    node bin/teacher-service-store-snapshot.js verify-target <target-db> <target-files> <snapshot-dir>
    ```
  - Questo gate procedurale valida l'integrità del database (`integrity_check`, `foreign_key_check`), l'assenza di residui temporanei (`.teacher-service-*-restore-*`) e la corrispondenza bit-a-bit del FileStore con il manifest.
- **Policy Pre-Cutover vs Post-Cutover:**
  - *Pre-cutover (durante il deployment):* Se le verifiche o i test pre-apertura falliscono, il ripristino dello snapshot pre-manutenzione verso nuovi volumi garantisce ZERO data loss.
  - *Post-cutover (dopo l'apertura):* Una volta che gli studenti hanno iniziato a sostenere prove o il docente ha inserito valutazioni, **è vietato ripristinare ciecamente lo snapshot iniziale** (si distruggerebbero le prove appena svolte). In caso di anomalia post-cutover, è obbligatorio esportare un delta o eseguire uno snapshot di emergenza prima di qualsiasi intervento correttivo.

---

## 6. Configurazione Applicativa di Release (Matrice Variabili)

| Variabile d'Ambiente | Stato Attuale K3s | Valore Richiesto per Release | Azione Necessaria |
|---|---|---|---|
| `TEACHER_SERVICE_ENABLE_INTEGRITY_ANALYSIS` | Non impostata (default `false`) | `false` | **Aggiungere esplicitamente in ConfigMap** (garantisce C6 disabilitato server-side e UI). |
| `TEACHER_SERVICE_ALLOW_EXTERNAL_STUDENT_GRADING` | Non impostata (default `false`) | `false` | **Aggiungere esplicitamente in ConfigMap** (impedisce invio risposte a LLM esterni). |
| `TEACHER_SERVICE_TEACHER_EMAILS` | `teacher@school.example` | `teacher@school.example` | Mantenere invariata (allowlist docente). |
| `TEACHER_SERVICE_WEB_CF_ACCESS_AUD` | `efba3266e210f6077d0e86f50721d7a3896e0deb1b9e60a5acc325af39b1e21d` | `efba3266e210f6077d0e86f50721d7a3896e0deb1b9e60a5acc325af39b1e21d` | Mantenere invariata (l'app `class` non viene ricreata). |
| `TEACHER_SERVICE_CF_ACCESS_AUD` | `3a2781b1104b6ec529e0b91a2133114ffc8ad9a1803d15cb01bc4ff09c9d68cc` | `3a2781b1104b6ec529e0b91a2133114ffc8ad9a1803d15cb01bc4ff09c9d68cc` | Mantenere invariata (AUD MCP invariato). |
| `TEACHER_SERVICE_TRUSTED_PROXY_CIDRS` | Non impostata | Omettere inizialmente | Mantenere assente (fail-closed su peer socket; compatibile con rate limiter). |
| `TEACHER_SERVICE_AUTH_MODE` | `strict` | `strict` | Mantenere invariata. |
| `NODE_ENV` | `production` | `production` | Mantenere invariata. |
| `HOST` / `PORT` | `0.0.0.0` / `80` | `0.0.0.0` / `80` | Mantenere invariata. |

---

## 7. Preparazione dell'Immagine Container e Deployment

- **Sorgente di Release:** Commit applicativo `8b6c7f1` (o commit finale contenente questo report).
- **Stato Test:** 33 suite su 33 superate (100% pass), browser tests Playwright superati, build Vite completata.
- **Dockerfile:** Multi-stage build riproducibile (builder Vite + runtime Node 22 slim con poppler-utils e pandoc per conversioni PDF/DOCX; utente non-root `node` UID 1000).
- **Architettura target:** `linux/amd64` (compatibile con i nodi `<backup-host>` e `<backup-host>`).
- **Tag immutabile proposto:**
  ```text
  ghcr.io/simogatti04/class:20261025-8b6c7f1
  ```
- **Compatibilità Schema e Storage:** Le migrazioni schema (`DatabaseManager`) sono esclusivamente additive (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN`). Il drill di compatibilità eseguito in C7B-P0 ha dimostrato che il vecchio container T1 continua ad avviarsi e a leggere il database migrato senza errori.
- **Vincolo:** Nessuna immagine è stata pubblicata su GHCR; il push e la pubblicazione avverranno esclusivamente previa autorizzazione esplicita.

---

## 8. Sequenza Operativa di Release (Runbook Definitivo C7B)

La sequenza operativa è strutturata in 7 fasi sequenziali per minimizzare il downtime e garantire il rollback a ogni passaggio:

### Fase A: Preparazione Senza Downtime (Pre-Manutenzione)
1. **Freeze del codice:** confermare baseline `teacher-service-design` e `infra-class-routing`.
2. **Build e pubblicazione immagine (previa autorizzazione):**
   ```bash
   docker buildx build --platform linux/amd64 -t ghcr.io/simogatti04/class:20261025-8b6c7f1 --push .
   ```
   Registrare il digest SHA-256 immutabile generato da GHCR.
3. **Predisposizione storage di recovery off-node:** verificare spazio disco e connettività SSH verso `<backup-host>` (almeno 10 GiB liberi).
4. **Rigenerazione e verifica del Saved Plan Cloudflare:**
   Nel worktree `~/Workspace/infra-class-routing`:
   ```bash
   CLOUDFLARE_TERRAFORM_API_TOKEN="$(infisical secrets get CLOUDFLARE_TERRAFORM_API_TOKEN --projectId=7f7e7da6-efc6-4524-819c-9282721c919f --env=prod --path=/cloudflare/terraform --plain)" make cf-save-access-plan
   make cf-verify-access-plan
   ```
   Confermare che il piano corrisponda a: `2 to add, 1 to change, 0 to destroy` senza sostituzioni.

### Fase B: Inizio Manutenzione & Snapshot Coerente (Downtime Inizio)
1. **Quiescenza applicativa:** scalare temporaneamente il deployment a 0 repliche per bloccare ogni scrittura concorrente:
   ```bash
   make k ARGS='scale deployment class -n class --replicas=0'
   ```
2. **Snapshot SQLite + FileStore:**
   Tramite pod di manutenzione o operazione su nodo `<backup-host>`:
   ```bash
   node bin/teacher-service-store-snapshot.js create /srv/class/teacher-service/db/teacher_service.db /srv/class/teacher-service/files /srv/class/teacher-service/snapshots/pre-c7b-$(date +%s)
   node bin/teacher-service-store-snapshot.js verify /srv/class/teacher-service/snapshots/pre-c7b-*
   ```
3. **Copia off-node:** sincronizzare la cartella di snapshot verso `<backup-host>:/srv/backup/teacher-service/` e verificare gli hash SHA-256.

### Fase C: Aggiornamento Applicativo K3s
1. **Aggiornamento ConfigMap:** applicare `class-config` con l'aggiunta di `TEACHER_SERVICE_ENABLE_INTEGRITY_ANALYSIS=false` e `TEACHER_SERVICE_ALLOW_EXTERNAL_STUDENT_GRADING=false`.
2. **Aggiornamento Deployment:** impostare il nuovo tag immagine immutabile e ripristinare 1 replica:
   ```bash
   make k ARGS='set image deployment/class class=ghcr.io/simogatti04/class:20261025-8b6c7f1 -n class'
   make k ARGS='scale deployment class -n class --replicas=1'
   ```
3. **Attesa probe:** attendere che il pod risulti `1/1 Ready`:
   ```bash
   make k ARGS='rollout status deployment/class -n class --timeout=120s'
   ```

### Fase D: Gate Interno Pre-Apertura (Smoke Test Read-Only)
Prima di esporre il nuovo runtime ai client esterni, eseguire dall'interno del cluster (o via port-forward locale):
```bash
node bin/teacher-service-smoke-test.js http://10.43.37.253:80
```
- Controlli verificati dal tool:
  1. `/health` -> `200 OK`
  2. `/` -> `200 OK` (SPA shell)
  3. `/studente` -> `200 OK` (SPA shell)
  4. `/api/student/classes` -> `200 OK` (lettura DB senza scritture)
  5. `/api/classes` -> `401 Unauthorized` fail-closed
  6. `/api/student/claim-code` (empty body) -> `400 Bad Request` senza incremento contatori rate-limit
  7. `/mcp` -> `401 JSON-RPC` fail-closed
- **Condizione di STOP:** Se anche un solo check fallisce -> **STOP immediato**. Non applicare Cloudflare Access. Eseguire il rollback applicativo (Fase G).

### Fase E: Modifica Cloudflare Access Edge
Soltanto dopo il superamento della Fase D:
Nel worktree `~/Workspace/infra-class-routing` (entro i 15 minuti di validità dell'attestazione):
```bash
CLOUDFLARE_TERRAFORM_API_TOKEN="$(infisical secrets get CLOUDFLARE_TERRAFORM_API_TOKEN --projectId=7f7e7da6-efc6-4524-819c-9282721c919f --env=prod --path=/cloudflare/terraform --plain)" make cf-apply-access-plan
```
Verificare che l'output riporti: `Apply complete! Resources: 2 added, 1 changed, 0 destroyed.`

### Fase F: Collaudo Edge Live
Eseguire immediatamente i controlli dall'esterno via HTTPS pubblico (`https://class.simogatti.it`):
1. **Homepage:** `curl -I https://class.simogatti.it/` -> `200 OK` (nessun redirect ad Access).
2. **Area Studente:** `curl -I https://class.simogatti.it/studente` -> `200 OK`.
3. **API Studente Pubblica:** `curl https://class.simogatti.it/api/student/classes` -> `200 OK` con elenco classi.
4. **Area Docente Riservata:** `curl -I https://class.simogatti.it/docente` -> `302 Found` (redirect verso `simogatti.cloudflareaccess.com`).
5. **API Docente Riservata:** `curl -I https://class.simogatti.it/api/classes` -> `302 Found` (redirect ad Access) o `401/403` se anonimo.
6. **Bypass Specifico vs Protezione `/api`:** verificare che `/api/student/*` non richieda login, mentre `/api/*` richieda login.
7. **MCP Endpoint:** `curl -I https://mcp-teacher.simogatti.it/mcp` -> invariato, protetto da OAuth / Access.

### Fase G: Conferma o Rollback
- **Conferma:** Se i punti 1–7 della Fase F hanno successo, la finestra di manutenzione è conclusa con esito favorevole.
- **Rollback di Emergenza:**
  - *Se fallisce l'apply Cloudflare o il collaudo edge:*
    1. Ripristinare l'applicazione Access docente sulla radice: nel worktree reimpostare `primary_path: ""` e `destinations: [""]`, rimuovere `class-student-api`, rigenerare il piano ed eseguire l'apply.
    2. Ripristinare il Deployment K3s alla versione precedente `ghcr.io/simogatti04/class:20261020-f962706`.
    3. Poiché non sono state acquisite nuove scritture, lo store rimane integro e compatibile con T1.

---

## 9. Verdetto C7B-P2 precedente (storico, superseded da §10)

### 9.1 Matrice storica dei verdetti per area (baseline pre-R3)

| Area di Valutazione | Esito | Dettaglio Evidenza |
|---|---|---|
| **1. Software Readiness** | **PASS (storico, pre-R3)** | 33 suite su 33 superate; Playwright browser tests PASS; client Vite build completata; C6 feature gate server-side attivo per default. |
| **2. Cloudflare Plan Readiness** | **PASS (storico, solo pre-R3)** | Saved plan generato e verificato alla data del report precedente; non valida la policy path-scoped R3. |
| **3. Operational Readiness** | **PASS (storico, pre-R3)** | Pod K3s stabile da 47h; probes sane; rate limiter protetto multi-livello anche su socket peer Traefik. |
| **4. Data Recovery Readiness** | **PASS (storico, fixture pre-R3)** | Procedure CLI di snapshot e restore testate con simulazione SIGKILL e failure injection; pre-attachment verification gate `verify-target` documentato e vincolante; nodo di recovery off-node identificato. |
| **5. Deployment Authorization** | **HOLD / PENDING** | Nessuna azione produttiva eseguita. In attesa di approvazione formale. |

### 9.2 Verdetto storico pre-R3 — non applicabile alla release corrente
```text
================================================================================
VERDETTO STORICO C7B-P2: READY FOR AUTHORIZATION (SUPERSEDED)
================================================================================
Questa valutazione descriveva la baseline precedente a C7B-R3.
Non attesta la compatibilità del runtime T1 con il PIN condiviso, né
la policy Cloudflare o il recupero dati dopo il nuovo flusso.
Consultare la sezione 10 per lo stato corrente.
================================================================================
```

### 9.3 Checklist di Autorizzazioni Separate per il Domain Owner
Prima di procedere all'esecuzione del rilascio, il Domain Owner dovrà approvare singolarmente:

- [ ] **Autorizzazione 1: Build & Pubblicazione Container GHCR**  
  Autorizza la build dell'immagine multi-stage `linux/amd64` da commit `teacher-service-design` e il relativo push su `ghcr.io/simogatti04/class:20261025-8b6c7f1`.
- [ ] **Autorizzazione 2: Approvazione Finestra di Manutenzione & Snapshot Off-Node**  
  Autorizza la finestra di downtime (stimata in 15–20 minuti), lo scale-down temporaneo del pod e la copia dello snapshot SQLite + FileStore verso `<backup-host>`.
- [ ] **Autorizzazione 3: Rollout Deployment K3s & ConfigMap**  
  Autorizza l'aggiornamento dei manifest K3s con il nuovo tag immagine e le variabili `TEACHER_SERVICE_ENABLE_INTEGRITY_ANALYSIS=false` e `TEACHER_SERVICE_ALLOW_EXTERNAL_STUDENT_GRADING=false`.
- [ ] **Autorizzazione 4: Apply del Saved Plan Cloudflare Access**  
  Autorizza l'esecuzione di `make cf-apply-access-plan` nel worktree `infra-class-routing` dopo il superamento del gate interno pre-apertura (`teacher-service-smoke-test.js`).


---

## 10. Aggiornamento C7B-R3 — verdetto software e infrastrutturale (25 ottobre 2026)

Questo aggiornamento sostituisce il verdetto pre-R3 della sezione 9. Il lavoro è stato eseguito sul repository applicativo, branch `codex/teacher-service-c6`, partendo da `65316bbf200d46f9b226214154bcf10374298457`. Non sono state modificate risorse Cloudflare, DNS, Tunnel, Terraform, K3s, GHCR, PVC, database o FileStore produttivi. Il working tree `infra/main` e le modifiche concorrenti OmniRoute sono rimasti intatti.

### 10.1 Matrice corrente

| Area | Stato | Evidenza / limite |
|---|---|---|
| Flusso applicativo C7B-R3 | **PASS (locale)** | Directory classi e lettura pubblica delle sole versioni materiali pubblicate; PIN condiviso per classe; attività filtrate dopo PIN; roster solo nella selezione pre-avvio; tentativo separato per token. Test server e browser sintetici superati. |
| T1 / C4 / C5 / C6 | **PASS (locale)** | Browser E2E T1, C4, C5 e C6 eseguiti con bundle compilato; nessun test usa dati produttivi. |
| Contratti studente e isolamento | **PASS (locale)** | Test HTTP/API coprono PIN errati, isolamento classi, sessioni, revoca PIN, recupero bozze, immutabilità consegne, timer/allegati e rifiuto di rotte legacy. |
| MCP locale | **PASS (locale, sintetico)** | Suite MCP e C7A unificata superate; strumenti e letture avvengono sullo stesso servizio/store isolato. **MCP remoto da ChatGPT non verificato.** |
| Cloudflare Access / routing edge | **BLOCKED / NOT VERIFIED** | Lettura non mutativa del manifest IaC locale: l'app `class` attuale usa `primary_path: ''` e destinazione `''`, quindi la dichiarazione è host-wide e non rappresenta ancora il confine R3. Il provider bloccato alla 5.24.0 supporta applicazioni/destinazioni con path; le applicazioni Cloudflare più specifiche prevalgono senza ereditare la policy più ampia. Serve comunque una modifica IaC dedicata e review; nessuna verifica Cloudflare live né apply sono stati effettuati. |
| Secret PIN in produzione | **NOT VERIFIED** | R3 richiede il secret stabile `TEACHER_SERVICE_CLASS_PIN_SECRET` (almeno 32 byte) in Infisical/ESO. Non letto né modificato. In assenza il codice fallisce chiuso; il preflight release deve verificare solo presenza/lunghezza, mai il valore. |
| Storage, backup e rollback di produzione | **NOT VERIFIED** | Backup/restore testati solo su fixture isolate in precedenti checkpoint; nessun backup né restore produttivo C7B-R3. Il rollback all'immagine T1 non supporta i tentativi creati col flusso PIN. Non ripristinare o cancellare il database automaticamente. |
| Release / C7B | **NO-GO** | C7B resta bloccato e non autorizzato. Mancano verifica edge, secret e procedura dati specifica per lo schema/flusso R3, oltre all'autorizzazione separata al rilascio. |

### 10.2 Test effettivamente eseguiti

- `pnpm test` — **PASS**, 34 suite, 0 fallite; database e file temporanei/sintetici.
- `pnpm test:browser:c4` — **PASS**, un test browser end-to-end con due studenti e lettura materiale.
- `pnpm test:browser:c5` — **PASS**, un test browser C5; attività creata via dashboard, PIN generato dall'interfaccia Registro studenti, due browser di studenti, monitoraggio, azioni docente, correzione e export.
- `pnpm test:browser:c6` — **PASS**, un test browser C6.
- `pnpm test:browser:c7a` — **PASS**, un test unificato sullo stesso assessment con due sessioni, SQLite/FileStore, API, grading, export, MCP e review C6.
- `node --test tests/browser/t1-browser.test.js` — **PASS**, workflow T1 dal bundle React compilato.
- `pnpm run build:client` — **PASS**, eseguito anche dalle suite browser.

La prima esecuzione completa aveva rilevato un fixture C5 senza `assessableSourceId`; il fixture è stato corretto per rispettare il grounding richiesto e il successivo `pnpm test` è passato integralmente. La suite unitaria non è stata usata come sostituto delle verifiche browser.

### 10.3 Contratto di accesso e rollback aggiornato

La matrice completa degli endpoint è in `docs/c7b-r3-public-portal-readiness.md`. In sintesi: `/`, `/studente/**` e le API esplicitamente pubbliche di directory/materiali sono anonime; attività, elenco studenti e avvio richiedono una sessione di classe; le operazioni sul tentativo richiedono il token bearer associato; `/docente/**`, CRUD, export gestionali e le altre API restano protetti da Access e autorizzazione teacher; MCP mantiene host e percorso invariati. Il routing reale è stato verificato da browser locale, non dall'edge.

La rotazione/revoca PIN impedisce nuovi accessi ma non invalida tentativi avviati né resetta risposte, timer, allegati o consegne. Rientro: PIN valido → stessa attività → stesso nominativo → recupero della bozza server esistente; IndexedDB è indicizzata per classe/studente dichiarato/attività, non per token, e non deve mai essere riassociata automaticamente a un diverso nominativo. Nessun dato mai persistito non è dichiarato recuperabile.

Prima di qualsiasi C7B futuro: aggiornare IaC su branch dedicato per esprimere esplicitamente `/`, `/studente/**` e `/api/student/**` pubblici, `/docente/**` e API gestionali protetti, con default-deny per gestionali non previsti; preservare MCP invariato. Validare staticamente il piano e verificare live solo in finestra autorizzata. Aggiungere provisioning/verifica del PIN secret e un gate di backup/restore specifico per schema e FileStore R3. **Non eseguire Terraform apply, push, publish o deployment sulla base di questo checkpoint.**
