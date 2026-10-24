# Proposta Architetturale & IaC: Routing Pubblico Studenti e Protezione Zero Trust Docente

**Checkpoint:** C7A-R2: Infrastructure Readiness & Pre-Release Preflight
**Data:** 24 ottobre 2026 (Europe/Rome)
**Ruolo:** Software Engineering / Infrastructure Architecture / QA
**Supervisione:** ChatGPT
**Stato:** **PROPOSTA REVISIONATA — NON APPLICARE**. C7B NON È AUTORIZZATO. Nessuna modifica a Cloudflare, Tunnel, DNS o K3s è stata applicata o pianificata in produzione.
**Riferimenti normativi:**
- `~/Workspace/infra/AGENTS.md`
- `~/Workspace/infra/docs/10-cloudflare-domain-management.md`
- `~/Workspace/infra/docs/08-operational-commands.md`
- `~/Workspace/infra/config/exposure.yaml`
- Dossier 01, 02, 04, 05, 06, 09.

---

> **AVVISO VINCOLANTE — NESSUNA MODIFICA REMOTA AUTORIZZATA**
> Questa proposta definisce l'architettura di routing dichiarativa e le modifiche IaC per il provider Cloudflare 5.24.0 necessarie ad abilitare l'accesso degli studenti pur mantenendo blindata l'area docente.
> Il repository `infra` contiene modifiche concorrenti sul branch `main` per OmniRoute che non devono essere alterate. Qualsiasi modifica IaC futura dovrà essere preparata in un worktree isolato e sottoposta ad approvazione esplicita del Domain Owner.

---

## 1. Analisi dello Stato Attuale & Problema Tecnico

### 1.1 Configurazione Dichiarata dal Manifest (Desired State K3s)
Nel repository `infra`, la configurazione dichiarata per `class` è:
- **Dominio Principale (`class.simogatti.it`)**:
  - `infra/config/exposure.yaml` dichiara:
    ```yaml
    access_entries:
      class:
        host: class
        policy: cloudflare_access
        profile: teacher-web
        primary_path: ""
        destinations:
          - ""
    ```
  - `infra/terraform/cloudflare/access.tf` crea una risorsa `cloudflare_zero_trust_access_application.k3s["class"]` con:
    - `domain = "class.simogatti.it"` (primary_path vuoto -> radice intera).
    - Policy collegata: `cloudflare_zero_trust_access_policy.cloudflare_access` (decision: `allow`, include: membri account Cloudflare).
    - Profilo `teacher-web`: `session_duration: 24h`, `http_only_cookie_attribute: true`, `auto_redirect_to_identity: true`.
- **Hostname MCP (`mcp-teacher.simogatti.it`)**:
  - Configurato separatamente con profilo Managed OAuth (`mcp-oauth`), limitato al percorso `^/mcp$`.
  - Non è impattato da modifiche a `class.simogatti.it` e deve rimanere rigorosamente invariato.

### 1.2 Il Conflitto Architetturale con l'Area Studente
L'attuale applicazione Cloudflare Access opera a livello di root (`class.simogatti.it/`).
Di conseguenza:
1. Qualsiasi richiesta HTTP verso `class.simogatti.it/`, `class.simogatti.it/studente` o `class.simogatti.it/api/student/*` viene intercettata all'Edge di Cloudflare e reindirizzata al login Google del docente.
2. Gli studenti in aula (che per normativa scolastica non possiedono account Zero Trust personali, Dossier 02 §4) ricevono un blocco o redirect all'IdP, rendendo impossibile riscattare il codice prova o consegnare la verifica.
3. Rimuovere semplicemente Access dall'intero dominio esporrebbe la dashboard docente e le API gestionali, violando il principio di fail-closed e difesa in profondità.

---

## 2. Tassonomia Cookie, Header e Identità Cloudflare Access

Per evitare ambiguità terminologiche nei documenti operativi e nei log applicativi, si fissa la seguente tassonomia rigorosa:

| Componente | Nome Ufficiale | Emesso da | Utilizzo | Posizione / Flag |
|---|---|---|---|---|
| **Edge Session Cookie** | `CF_AppSession` | Cloudflare Access Edge | Traccia la sessione utente con l'edge proxy di Cloudflare per evitare ri-autenticazioni continue all'IdP. | Cookie browser |
| **Signed JWT Assertion Cookie** | `CF_Authorization` | Cloudflare Access Edge | Contiene il JWT firmato con claims utente (`email`, `sub`, `aud`, `iss`, `exp`). Emesso se l'applicazione ha il profilo web. | Cookie browser (`HttpOnly: true`, `Secure`, SameSite) |
| **Origin Request Header** | `Cf-Access-Jwt-Assertion` | Cloudflare Tunnel / Edge Proxy | Header HTTP contenente il medesimo JWT di asserzione firmato, iniettato dall'edge verso l'origine (K3s). | Header HTTP ricevuto dal container Node |

Il backend Teacher Service convalida prioritariamente l'header `Cf-Access-Jwt-Assertion` e, in seconda istanza per chiamate browser same-site, il cookie `CF_Authorization`. In produzione (`NODE_ENV=production`), la convalida della firma contro le JWKS Cloudflare e la corrispondenza con l'AUD configurato sono obbligatorie e fail-closed.

---

## 3. Proposta di Modifica IaC (Provider Cloudflare 5.24.0)

La soluzione architetturale corretta combina:
1. **Homepage e Area Studenti pubbliche**: Rimozione della protezione Access sulla radice `/` e sul percorso SPA `/studente*`.
2. **Protezione rigorosa dell'Area Docente**: Access Application docente con destinazioni esplicite `/docente*` e `/api/*`.
3. **Bypass mirato per le sole API Studente**: Access Application (o regola Bypass) più specifica limitata rigorosamente a `/api/student/*`.

### 3.1 Precedenza dei Path in Cloudflare Access
Cloudflare One valuta le regole Access in base alla specificità del percorso:
- Una regola con path più lungo e specifico (es. `class.simogatti.it/api/student`) prevale su una regola con path più generico (es. `class.simogatti.it/api`).
- Le policy dell'applicazione più specifica sostituiscono interamente quelle dell'applicazione generica (non vi è ereditarietà).
- L'azione `bypass` disattiva l'intercettazione Access e permette il passaggio del traffico verso l'origine, dove la richiesta viene gestita dall'applicazione Node con autenticazione basata su token di sessione studente.

### 3.2 Rimozione Obbligatoria degli Attributi RDP
Nelle precedenti bozze storiche era presente l'attributo `connection_rules = { rdp = {} }`.
**Correzione vincolante C7A-R2:** Tale attributo appartiene alle policy infrastrutturali per tunnel TCP/RDP e **non deve comparire** nelle policy HTTP Web / Bypass.
La risorsa di policy Bypass deve contenere esclusivamente:
```hcl
resource "cloudflare_zero_trust_access_policy" "teacher_service_student_api_public" {
  account_id = local.managed_account_id
  name       = "Teacher Service student API public path"
  decision   = "bypass"
  include    = [{ everyone = {} }]

  lifecycle {
    prevent_destroy = true
  }
}
```

### 3.3 Rischio di Replacement Risorsa e Variazione AUD
Nel provider Cloudflare 5.24.0, modificare la configurazione di `cloudflare_zero_trust_access_application.k3s["class"]` modificando `domain` o `primary_path` può innescare una **SOSTITUZIONE (destroy + create)** della risorsa Access Application.

**Impatto Critico sull'AUD:**
- Ogni risorsa `cloudflare_zero_trust_access_application` creata su Cloudflare riceve un identificativo univoco esposto come **AUD** (Audience Tag / Client ID).
- L'applicazione Teacher Service su K3s valida che il claim `aud` del JWT coincida con la variabile d'ambiente `TEACHER_SERVICE_WEB_CF_ACCESS_AUD`, definita in `infra/k3s/apps/class/configmap.yaml`.
- **Se l'Access Application viene ricreata da Terraform, l'AUD cambia istantaneamente.**
- Se l'AUD cambia senza aggiornare contestualmente la ConfigMap K3s, tutti i tentativi di accesso del docente all'area protetta verranno rifiutati dall'applicazione con errore `401 Unauthorized (Invalid JWT audience)`.

**Procedura di mitigazione del rischio AUD:**
1. Ispezionare il Saved Plan generato: verificare se l'azione pianificata è `~ update in-place` oppure `- destroy` / `+ create`.
2. Se il piano prevede `forces replacement`, la procedura C7B deve includere una fase di synchronizzazione:
   a. Applicazione Access Plan.
   b. Acquisizione del nuovo AUD generato.
   c. Aggiornamento atomico di `TEACHER_SERVICE_WEB_CF_ACCESS_AUD` in `infra/k3s/apps/class/configmap.yaml`.
   d. Rollout restart del deployment `class` per caricare il nuovo AUD.
   e. Verifica con test browser prima di dichiarare completato il cutover.

---

## 4. Matrice Completa dei Percorsi HTTP e Regole di Protezione

La seguente matrice descrive ogni endpoint dell'applicazione, la destinazione prevista, il controllo Cloudflare Access e la policy applicativa interna:

| Percorso HTTP | Metodo | Natura | Controllo Cloudflare Access | Controllo Applicativo Interno | Comportamento Anonimo | Comportamento Studente | Comportamento Docente |
|---|---|---|---|---|---|---|---|
| `/` | GET | Pubblico | Nessuno (Bypass/No App) | Static file handler (SPA shell) | Riceve SPA shell | Riceve SPA shell | Riceve SPA shell |
| `/index.html` | GET | Pubblico | Nessuno (Bypass/No App) | Static file handler | Riceve SPA shell | Riceve SPA shell | Riceve SPA shell |
| `/assets/*` | GET | Pubblico | Nessuno (Bypass/No App) | Static file handler (MIME, cache) | 200 File statico | 200 File statico | 200 File statico |
| `/studente` | GET | Pubblico | Nessuno (Bypass/No App) | Static file handler (SPA fallback) | 200 SPA Studente | 200 SPA Studente | 200 SPA Studente |
| `/studente/attivita/:token` | GET | Pubblico | Nessuno (Bypass/No App) | Static file handler (SPA fallback) | 200 SPA Prova | 200 SPA Prova | 200 SPA Prova |
| `/docente` | GET | Riservato | App `class` (Google IdP 24h) | Auth check (`Cf-Access-Jwt-Assertion`) | Redirect a Google IdP | Redirect se non docente | 200 SPA Docente |
| `/docente/attivita/:id` | GET | Riservato | App `class` (Google IdP 24h) | Auth check (`Cf-Access-Jwt-Assertion`) | Redirect a Google IdP | Redirect se non docente | 200 SPA Monitor |
| `/health` | GET | Monitor | Nessuno / Interno K3s | Endpoint salute (200 JSON ok) | 200 `{"status":"ok"}` | 200 `{"status":"ok"}` | 200 `{"status":"ok"}` |
| `/mcp` | POST/GET | Riservato | App `mcp` (Managed OAuth) | Auth check (MCP AUD separato) | 401 Unauthorized | 401 Unauthorized | 200 Streamable MCP |
| `/api/student/claim-code` | POST | Pubblico | App `class-student-api` (Bypass) | Rate Limiter (IP/Device) + Codice | Riscatta sessione | Riscatta sessione | Riscatta sessione |
| `/api/student/session` | GET | Studente | App `class-student-api` (Bypass) | Verifica Bearer Token / Cookie sessione | 401 Sessione richiesta | 200 Dati sessione | 401 se senza sessione |
| `/api/student/classes` | GET | Studente | App `class-student-api` (Bypass) | Elenco classi pubbliche minime | 200 Elenco minimo | 200 Elenco minimo | 200 Elenco minimo |
| `/api/student/classes/:id/students` | GET | Studente | App `class-student-api` (Bypass) | Studenti per selezione aula | 200 Elenco studenti | 200 Elenco studenti | 200 Elenco studenti |
| `/api/student/classes/:id/activities` | GET | Studente | App `class-student-api` (Bypass) | Attività attive classe | 200 Attività attive | 200 Attività attive | 200 Attività attive |
| `/api/student/activities/:id` | GET | Studente | App `class-student-api` (Bypass) | Verifica sessione per prova | 401 Non autorizzato | 200 Dettagli prova | 401 se senza sessione |
| `/api/student/activities/:id/neighbors` | GET | Studente | App `class-student-api` (Bypass) | Attività collegate | 401 Non autorizzato | 200 Neighbors | 401 se senza sessione |
| `/api/student/activities/:id/submission` | GET | Studente | App `class-student-api` (Bypass) | Restituisce consegna (no soluzioni) | 401 Non autorizzato | 200 Elaborato studente | 401 se senza sessione |
| `/api/student/activities/:id/start` | POST | Studente | App `class-student-api` (Bypass) | Avvio tentativo e timer | 401 Non autorizzato | 200 Tentativo avviato | 401 se senza sessione |
| `/api/student/activities/:id/autosave` | POST | Studente | App `class-student-api` (Bypass) | Salvataggio periodico risposte | 401 Non autorizzato | 200 Risposte salvate | 401 se senza sessione |
| `/api/student/activities/:id/submit` | POST | Studente | App `class-student-api` (Bypass) | Consegna definitiva prova | 401 Non autorizzato | 200 Consegna registrata| 401 se senza sessione |
| `/api/student/attachment` | GET | Studente | App `class-student-api` (Bypass) | Download allegato studente pubblicato | 401 / 404 se non pub | 200 File binario | 401 se senza sessione |
| `/api/student/upload` | POST | Studente | App `class-student-api` (Bypass) | Upload allegato studente (multipart) | 401 Non autorizzato | 200 Upload completato | 401 se senza sessione |
| `/api/auth/me` | GET | Riservato | App `class` (Google IdP 24h) | `authenticateRequest` + principal check | 401 / Redirect Edge | 401 / Redirect Edge | 200 Profilo docente |
| `/api/classes` (CRUD) | ALL | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200/201 Operazione |
| `/api/subjects` (CRUD) | ALL | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200/201 Operazione |
| `/api/lessons` (CRUD/Pack)| ALL | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200/201 Operazione |
| `/api/materials` (CRUD) | ALL | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200/201 Operazione |
| `/api/materials/:id/export`| GET | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200 Download file |
| `/api/upload` | POST | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 201 File caricato |
| `/api/assessments` (CRUD) | ALL | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200/201 Operazione |
| `/api/assessments/:id/credentials` | ALL | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200 Codici accesso |
| `/api/assessments/:id/submissions` | GET | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200 Lista consegne |
| `/api/submissions/:id/grade` | POST | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200 Valutazione |
| `/api/submissions/:id/review`| POST | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200 Voto confermato |
| `/api/assessments/:id/results/export` | GET | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200 Export CSV/JSON |
| `/api/assessments/:id/integrity-preview` | GET | Riservato | App `class` (Google IdP) + C6 Gate | Feature flag C6 (`false` -> 404) | 401 / Redirect Edge | 401 / Redirect Edge | 404 se C6 disabilitato |
| `/api/assessments/:id/integrity-reviews` | POST | Riservato | App `class` (Google IdP) + C6 Gate | Feature flag C6 (`false` -> 404) | 401 / Redirect Edge | 401 / Redirect Edge | 404 se C6 disabilitato |
| `/api/events` | GET (SSE) | Riservato | App `class` (Google IdP 24h) | Docente autorizzato | 401 / Redirect Edge | 401 / Redirect Edge | 200 Stream eventi SSE |
| `/api/<qualsiasi_altro>` | ANY | Non mappato | App `class` (Google IdP 24h) | Fail-closed (`Route not found`) | 401 / Redirect Edge | 401 / Redirect Edge | 404 Not Found JSON |

---

## 5. Tabella dei Controlli Negativi di Sicurezza

A garanzia che nessun percorso gestionale diventi accidentalmente accessibile dall'esterno, la procedura di collaudo post-apply deve eseguire i seguenti test negativi:

| Tentativo di Accesso | Chiamata di Test | Risultato Atteso all'Edge | Risultato Atteso all'Origine | Verdetto Sicurezza |
|---|---|---|---|---|
| Chiamata anonima a endpoint docente | `GET https://class.simogatti.it/api/classes` | HTTP 302 Redirect a Google IdP Cloudflare | Nessun pacchetto raggiunge K3s | PASS (Blocco Edge) |
| Chiamata con cookie studente a endpoint docente | `GET https://class.simogatti.it/api/classes` con `Cookie: student_session=...` | HTTP 302 Redirect a Google IdP Cloudflare | Nessun pacchetto raggiunge K3s | PASS (Blocco Edge) |
| Chiamata anonima con header JWT falsificato | `GET https://class.simogatti.it/api/classes` con `Cf-Access-Jwt-Assertion: bad.jwt` | HTTP 403 Forbidden all'Edge | Se passa l'edge, K3s risponde 401 Signature Invalid | PASS (Doppia barriera) |
| Token docente con AUD errato (es. AUD di MCP) | `GET https://class.simogatti.it/api/classes` con JWT firmato per MCP AUD | HTTP 302/403 all'Edge | K3s risponde 401 "Invalid JWT audience" | PASS (Isolamento AUD) |
| Accesso a route non prevista sotto `/api` | `GET https://class.simogatti.it/api/admin/secret` | HTTP 302 Redirect a Google IdP Cloudflare | K3s risponde 404 JSON (`Route not found`) | PASS (No SPA leak) |
| Chiamata anonima ad allegato non pubblicato | `GET https://class.simogatti.it/api/student/attachment?materialId=raw-secret` | HTTP 200 Passa il Bypass Edge | K3s risponde 404 / 401 (Solo materiali pubblicati) | PASS (Controllo backend) |
| Accesso a deep link docente senza autenticazione | `GET https://class.simogatti.it/docente` | HTTP 302 Redirect a Google IdP Cloudflare | Nessun pacchetto raggiunge K3s | PASS (Blocco UI docente) |

---

## 6. Procedura Operativa di Preparazione IaC (In Worktree Isolato)

Dato che `~/Workspace/infra` ha modifiche non committate su `main` per OmniRoute:
1. **Creare un worktree dedicato** in `~/Workspace/infra-class-routing`:
   ```bash
   git -C ~/Workspace/infra worktree add ../infra-class-routing -b feature/class-student-routing 659a04c6b0ffc18bec79a5864cf2631c70f2bbe9
   ```
2. **Applicare le modifiche dichiarative** ai file del worktree:
   - `config/exposure.yaml`
   - `terraform/cloudflare/access.tf`
   - `terraform/cloudflare/access-policies.tf`
3. **Eseguire esclusivamente i controlli canonici**:
   ```bash
   cd ~/Workspace/infra-class-routing
   make domain-check
   make exposure-check
   make cf-fmt-check
   make cf-validate
   ```
4. **Generare il saved plan per Access (quando autorizzato dal Domain Owner)**:
   ```bash
   CLOUDFLARE_TERRAFORM_API_TOKEN=... make cf-save-access-plan
   make cf-verify-access-plan
   ```
5. **Ispezione del piano**:
   - Accertare l'assenza di modifiche a DNS, Tunnel, altre app o MCP.
   - Verificare se l'applicazione `class` subisce `forces replacement` (implicando rotazione AUD).
6. **Non eseguire `make cf-apply-access-plan`** senza separata autorizzazione vincolante.
