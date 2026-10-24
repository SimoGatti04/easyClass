# Proposta Architetturale & IaC: Routing Pubblico Studenti e Protezione Zero Trust Docente

**Checkpoint:** C3.1 Final Hardening & Gate C4
**Ruolo:** Software Engineering / Infrastructure Architecture
**Supervisione:** ChatGPT
**Stato storico:** proposta C3.1, revisionata in C7A il 24 ottobre 2026. **NON APPLICARE**: il draft IaC sotto è obsoleto e non conforme all’attuale routing React/manifest infra. Nessuna modifica a Cloudflare, Tunnel, DNS o K3s è stata applicata.
**Riferimenti normativi:**
- `~/Workspace/infra/AGENTS.md`
- `~/Workspace/infra/docs/10-cloudflare-domain-management.md`
- `~/Workspace/infra/docs/08-operational-commands.md`
- `~/Workspace/infra/config/exposure.yaml`
- Dossier 01, 04, 05, 06, 09.

---

> **Esito della revisione C7A — BLOCKED / non eseguibile.** I blocchi e i requisiti per una nuova proposta sono riportati in [`c7a-pre-release-readiness.md`](c7a-pre-release-readiness.md). Le sezioni HCL/YAML successive sono conservate come evidenza storica C3.1, non come istruzioni operative. In particolare, non usare la policy `bypass everyone`, non aggiungere `access-class.tf` e non applicare path che presumono route browser non esistenti.

## 1. Analisi dello Stato Attuale & Problema Tecnico

### 1.1 Configurazione dichiarata dal manifest (stato Cloudflare live non verificato)
Questa sezione descrive esclusivamente il desired state versionato in `infra/k3s/apps/class/` e `infra/config/exposure.yaml`, insieme al codice Terraform. Lo stato effettivamente applicato e le policy attive sul provider Cloudflare non sono stati interrogati in C7A.
1. **Dominio principale (`class.simogatti.it`)**:
   - `infra/config/exposure.yaml` dichiara `profile: teacher-web` e `primary_path: ""`.
   - `terraform/cloudflare/access.tf` include le entry del manifest nell'inventory Terraform per un'applicazione Zero Trust Access `self_hosted` sul dominio e sul path dichiarati. Ciò descrive il piano di configurazione, non prova che l'applicazione sia stata creata o sia attualmente attiva nel provider.
   - Il profilo versionato `teacher-web` dichiara l'IDP docente (`aff7d56e-3243-4631-b862-e7288539bf81`); l'associazione effettiva non è stata verificata live.
2. **Dominio MCP (`mcp-teacher.simogatti.it`)**:
   - Il repository contiene una route K3s dedicata e configurazione di accesso separata. Questa revisione non ha verificato la connettività remota o lo stato della policy Cloudflare; non usarla come prova di operatività live.

### 1.2 Limiti Insuperabili del Routing Hash-based (`#/studente`) come Protezione Perimetrale
- Secondo lo standard **RFC 3986 §3.5**, il fragment identifier (la porzione di URI dopo `#`) è gestito **esclusivamente dal browser (client-side)** e **non viene mai trasmesso** nelle intestazioni HTTP verso l'edge o verso il server origin.
- Una richiesta a `https://class.simogatti.it/#/studente` genera all'edge la richiesta `GET / HTTP/2`.
- L'edge riceve la richiesta per la radice `/`; non riceve il fragment `#/studente`. **Se** l'applicazione e la policy Access dichiarate nel manifest sono effettivamente applicate come descritto, Access valuterà la richiesta sulla route radice secondo quelle policy. C7A non ha interrogato lo stato Cloudflare live e quindi non afferma che oggi la richiesta venga reindirizzata al login o che la policy sia effettivamente attiva.
- **Conclusione tecnica:** Il routing client-side `#` non costituisce e non può costituire una misura di isolamento perimetrale.

### 1.3 Criticità della Bozza Precedente ("Bypass Everyone" Globale)
- La precedente bozza ipotizzava una policy `decision = "bypass"` con `include { everyone = true }` applicata genericamente all'applicazione Cloudflare Access `class`.
- In Cloudflare Access, associare una policy di bypass universale a un'applicazione senza scoping rigoroso sui path **annulla completamente la protezione Zero Trust su tutte le risorse** (inclusi `/api/*` e i dati del docente).
- Tale approccio è insicuro e non rispetta le convenzioni di `infra`.

---

## 2. Soluzioni Architetturali Supportate da Cloudflare

Per garantire contemporaneamente:
1. Homepage pubblica accessibile a tutti (`https://class.simogatti.it/` o portale dedicato).
2. API studente pubbliche ma protette da sessioni applicative e token hash (`/api/student/*`).
3. Dashboard docente e API gestionali protette da Cloudflare Access (`/docente*`, `/api/*`).
4. Server MCP invariato (`mcp-teacher.simogatti.it/mcp`).
5. Zero esposizione accidentale di percorsi riservati.

Sono state identificate e analizzate due opzioni tecniche:

---

### Opzione 1 (Raccomandata): Path-Scoped Access Applications su Hostname Unico (`class.simogatti.it`)

Cloudflare Zero Trust supporta la creazione di applicazioni `self_hosted` con **path prefix specifico** sullo stesso hostname. In caso di sovrapposizione, Cloudflare Access valuta le applicazioni in ordine di specificità decrescente dell'URI:

1. **Applicazione 1 — Docente Dashboard & Management API**:
   - **Path protetti**: `class.simogatti.it/docente*` e `class.simogatti.it/api/*` (eccetto `/api/student/*`).
   - **Access Policy**: `cloudflare_access` con profilo `teacher-web` (solo email docente autorizzata via Google IDP).
   - **Comportamento**: qualsiasi richiesta a questi percorsi senza cookie `CF_Authorization` valido viene bloccata all'edge prima di raggiungere il cluster K3s.
2. **Applicazione 2 — Studente API & Asset Pubblici (Bypass Scoped)**:
   - **Path ammessi**: `class.simogatti.it/api/student/*`, `class.simogatti.it/assets/*`, `class.simogatti.it/favicon.ico`.
   - **Access Policy**: `bypass` con `everyone = true`.
   - **Comportamento**: il traffico passa attraverso Cloudflared Tunnel verso Traefik/K3s, dove il server `http.js` valida i token di sessione studente, la cifratura dei codici e l'autenticazione monouso.
3. **Radice Pubblica**:
   - `class.simogatti.it/` (e `/index.html`) espone la Homepage pubblica con selettore "Area Studente" / "Area Docente".
   - Cliccando su "Area Docente", l'utente naviga su `/docente`, attivando il prompt Cloudflare Access.

---

### Opzione 2 (Alternativa): Separazione tramite Sottodominio Dedicato (`studenti.simogatti.it`)

Se il Domain Owner preferisce una separazione fisica e DNS totale:
1. **`class.simogatti.it`**: 100% protetto da Cloudflare Access con profilo `teacher-web`. Riservato alla dashboard docente e alle API gestionali.
2. **`studenti.simogatti.it`**: Hostname pubblico esposto via Cloudflare Tunnel direttamente a Traefik. Nessuna applicazione Cloudflare Access. Traefik inoltra al Service K3s `class`, che instrada solo su Homepage studente e `/api/student/*`.

*Valutazione:* L'Opzione 1 è raccomandata in quanto mantiene un unico URL unificato (`class.simogatti.it`) conforme all'identità di istituto e non richiede nuovi record DNS.

---

## 3. Specifiche tecniche IaC per Opzione 1 — DEPRECATED / NON APPLICARE

### 3.1 Aggiornamento a `infra/config/exposure.yaml`
```yaml
  class:
    subdomain: class
    exposure: public
    dns_exact: false
    tunnel_exact: false
    tunnel_order: 13
    render_target:
      - ~/Workspace/infra/k3s/apps/class/ingress-route.yaml

  # Regole Access dichiarate con path-scoping esplicito
  class-teacher:
    host: class
    policy: cloudflare_access
    profile: teacher-web
    primary_path: "/api"
    destinations:
      - "/api"
      - "/docente"
```

### 3.2 Struttura HCL in `infra/terraform/cloudflare/access-class.tf` (Bozza per C7)
```hcl
# Access Application per l'area Docente su class.simogatti.it
resource "cloudflare_zero_trust_access_application" "class_teacher_app" {
  account_id                 = local.managed_account_id
  name                       = "class-teacher"
  type                       = "self_hosted"
  domain                     = "class.simogatti.it/api"
  session_duration           = "24h"
  allowed_idps               = ["aff7d56e-3243-4631-b862-e7288539bf81"] # Google IDP docente
  auto_redirect_to_identity  = true
  enable_binding_cookie      = false
  http_only_cookie_attribute = true
  options_preflight_bypass   = true

  destinations = [
    {
      type = "public"
      uri  = "class.simogatti.it/api"
    },
    {
      type = "public"
      uri  = "class.simogatti.it/docente"
    }
  ]

  policies = [
    {
      id = cloudflare_zero_trust_access_policy.cloudflare_access.id
    }
  ]

  lifecycle {
    prevent_destroy = true
  }
}

# Access Application Bypass per le sole API studente
resource "cloudflare_zero_trust_access_application" "class_student_api_bypass" {
  account_id                 = local.managed_account_id
  name                       = "class-student-api"
  type                       = "self_hosted"
  domain                     = "class.simogatti.it/api/student"
  session_duration           = "24h"
  allowed_idps               = []
  auto_redirect_to_identity  = false
  enable_binding_cookie      = false
  http_only_cookie_attribute = true
  options_preflight_bypass   = true

  destinations = [
    {
      type = "public"
      uri  = "class.simogatti.it/api/student"
    }
  ]

  policies = [
    {
      id = cloudflare_zero_trust_access_policy.class_student_bypass_policy.id
    }
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_zero_trust_access_policy" "class_student_bypass_policy" {
  account_id = local.managed_account_id
  name       = "Class Student API Bypass"
  decision   = "bypass"

  include {
    everyone = true
  }

  lifecycle {
    prevent_destroy = true
  }
}
```

---

## 4. Workflow Operativo Canonico di `infra` (Nessun comando diretto Terraform)

Come sancito in `~/Workspace/infra/docs/10-cloudflare-domain-management.md`, è **severamente vietato** eseguire comandi generici `terraform plan` o `terraform apply` diretti.

Durante il checkpoint **C7**, l'esecuzione seguirà rigorosamente il wrapper canonico:

```bash
# 1. Validazione statica della configurazione locale
cd ~/Workspace/infra
make domain-check
make exposure-check
make cf-fmt-check
make cf-validate

# 2. Generazione del Saved Plan per Access (utilizzando il read token)
CLOUDFLARE_TERRAFORM_API_TOKEN=... make cf-save-access-plan

# 3. Verifica del bundle di attestazione e integrità crittografica
make cf-verify-access-plan

# 4. Fase di Revisione Umana / Architect Review:
# Ispezione del piano salvato in ~/.local/cloudflare/steady-state/
# Verifica che il piano tocchi ESCLUSIVAMENTE le risorse class-teacher e class-student-api

# 5. Applicazione controllata (solo con token autorizzato e dopo approvazione esplicita)
CLOUDFLARE_TERRAFORM_API_TOKEN=... make cf-apply-access-plan
```

---

## 5. Piano di Rollback Immediato (per Checkpoint C7)

Qualora durante l'apply in C7 si riscontrassero problemi di instradamento o anomalie di autenticazione:

1. **Revert Git dello stato desiderato**:
   ```bash
   cd ~/Workspace/infra
   git checkout HEAD~1 -- config/exposure.yaml terraform/cloudflare/access-class.tf
   ```
2. **Generazione e applicazione del piano di ripristino con wrapper canonico**:
   ```bash
   CLOUDFLARE_TERRAFORM_API_TOKEN=... make cf-save-access-plan
   make cf-verify-access-plan
   CLOUDFLARE_TERRAFORM_API_TOKEN=... make cf-apply-access-plan
   ```
3. **Tempi e Impatto**:
   - La propagazione edge di Cloudflare Access impiega meno di 60 secondi.
   - Il dominio `class.simogatti.it` torna immediatamente alla configurazione di protezione totale monolitica con login docente obbligatorio su tutto l'host. Nessun dato o credenziale viene compromesso.

---

## 6. Riepilogo Conformità C3.1
- **Nessuna modifica infrastrutturale applicata** (Zero modifiche a K3s, Cloudflare, DNS, Tunnel, GHCR).
- **Proposta tecnica priva di comandi Terraform diretti** e pienamente allineata ai Makefile wrapper di `infra`.
- **Eliminata qualsiasi regola Bypass Everyone globale non protetta da path scoping**.
- **Pronta per implementazione controllata in C7**.
