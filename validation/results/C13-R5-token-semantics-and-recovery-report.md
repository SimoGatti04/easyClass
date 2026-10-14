# Teacher Service — C13-R5: Token Semantics & E2E Recovery

**Data:** 12 ottobre 2026 (Europe/Rome)  
**Supervisore:** ChatGPT  
**Ruolo:** Models / Integration  
**Stato esecutivo:** `ANALYSIS_COMPLETE_RECOVERY_PROPOSAL_PREPARED`  
**Chiamate remote / inferenze eseguite:** `0 / 0` (analisi puramente offline)  
**Modifiche a registry / eligibility / Gate D:** `0 / 0 / BLOCKED`  
**Preservazione baseline Teacher Material v0001:** `VERIFIED_INTACT` (SHA-256 `c3e1c145d75bbd4571cb21545a32d1bb8a5dacafe6c0429320fff95e0ce1744f`)  

---

## 1. Causa Tecnica Verificata e Incertezza Residua

### 1.1 Identificazione dell'istanza OmniRoute utilizzata
Sulla base dei manifest di deployment K3s e della documentazione architetturale locale (`~/Workspace/infra/k3s/apps/omniroute/deployment.yaml` e `~/Workspace/development-environment/services/omniroute/README.md`):
- **Nodo di esecuzione:** `<backup-host>` (`198.51.100.13`), allocato tramite `nodeSelector: kubernetes.io/hostname: <backup-host>`.
- **Namespace K3s:** `omniroute`.
- **Immagine container dichiarata:** `diegosouzapw/omniroute:next` con `imagePullPolicy: IfNotPresent`.
- **Runtime:** applicazione Next.js 16.3.2 in modalità standalone runner.
- **Entrypoint:** `/bin/sh -c "node /app/data/patch.js && exec node dev/run-standalone.mjs"`.
- **Storage persistente:** volume locale PVC `/srv/omniroute/data` montato su `/app/data`.

**Confine epistemico e incertezza residua:**  
Poiché i comandi di ispezione diretta del cluster live (es. `kubectl describe`, accessi SSH al nodo K3s) e le chiamate remote sono esplicitamente esclusi in questo task, l'esatto SHA-256 digest del container e il commit Git da cui l'immagine `diegosouzapw/omniroute:next` presente su `<backup-host>` è stata compilata rimangono formalmente **UNKNOWN**. Non si assume l'identità assoluta tra il commit HEAD del repository pubblico e l'istanza installata.

### 1.2 Percorso specifico della route `agy/gemini-3.8-flash-tiered`
Dall'analisi congiunta del codice sorgente pubblico upstream (`diegosouzapw/OmniRoute` commit `7f3cbb046b3706bf0bbc047b7eaa0cbada8d9e50`), dello script di patch locale `~/Workspace/development-environment/services/omniroute/patch.js` e dei record di trasporto generati in C13-R4:

1. **Mapping del provider e traduzione richiesta:**
   - La route `agy/*` è instradata al modulo interno `antigravity` (Google Cloud Code).
   - In `open-sse/translator/request/openai-to-gemini.ts`, il parametro OpenAI `body.max_tokens` viene inoltrato a Gemini attraverso la funzione `capMaxOutputTokens(model, body.max_tokens)` nel campo `generationConfig.maxOutputTokens`.
   - Nell'API Gemini, `maxOutputTokens` disciplina specificamente i *candidate tokens* (l'output visibile).
2. **Patch locali a runtime (`patch.js`):**
   - L'ispezione locale di `~/Workspace/development-environment/services/omniroute/patch.js` mostra che le modifiche iniettate a runtime su `/app/.build/next/server` comprendono:
     - Prioritizzazione di `functionDeclarations` su `googleSearch`.
     - Logging diagnostico degli errori HTTP 429 Antigravity.
     - Riconoscimento della stringa Google `resource has been exhausted` per quota esaurita.
     - Tolleranza per blocchi `thought`, `web_search_call` e metadati Responses non rappresentabili nel traduttore Chat/Antigravity.
     - Iniezione alias SQLite per `gemini-3.8`.
     - Strategia di rotazione `round-robin` con limite sticky in SQLite `settings`.
   - **Nessuna patch locale altera la traduzione di `max_tokens`, `maxOutputTokens` o l'estrazione della telemetria dei token.**
3. **Calcolo della telemetria `usage`:**
   - In `open-sse/handlers/usageExtractor.ts`:
     ```typescript
     completion_tokens = (geminiUsage.candidatesTokenCount ?? 0) + (geminiUsage.thoughtsTokenCount ?? 0);
     completion_tokens_details.reasoning_tokens = geminiUsage.thoughtsTokenCount;
     ```
   - OmniRoute calcola `completion_tokens` come la somma algebrica di `candidatesTokenCount` e `thoughtsTokenCount`, esponendo contestualmente `reasoning_tokens` nel dettaglio OpenAI standard.
4. **Evidenza empirica in C13-R4 (`op_024951ccaacb45179f7f2ba015e86bc7`):**
   - Richiesta esatta inviata: `max_tokens = 3000`.
   - Record di trasporto restituito dal gateway:
     - `usage.prompt_tokens`: 2.103
     - `usage.completion_tokens`: 4.411
     - `usage.completion_tokens_details.reasoning_tokens`: 3.560
     - `usage.total_tokens`: 6.514
     - `finish_reason`: `stop` (terminazione naturale, non per `length`).
   - Scomposizione aritmetica:
     $$\text{candidatesTokenCount} = 4.411 - 3.560 = 851 \text{ token}$$
   - L'artefatto didattico Teacher Material generato (`material.md`) contiene 4.008 caratteri e 398 parole in lingua italiana, perfettamente compatibili con ~851 token (rapporto ~4,7 caratteri per token).

### 1.3 Conclusione sulla causa tecnica
- **Causa accertata:** Il valore `completion_tokens = 4411` riportato da OmniRoute eccede 3.000 unicamente perché include i 3.560 reasoning token generati internamente dal modello `gemini-3.8-flash-tiered`. Il testo generato visibile (851 token) è ampiamente inferiore al limite `max_tokens = 3000`.
- **Incertezza residua:** L'esatto comportamento interno del backend proprietario di Google Cloud Code (se consideri `maxOutputTokens` come vincolo esclusivo sui candidate token o se applichi un budget condiviso in condizioni di saturazione) è non documentato e rimane **UNKNOWN** a livello del fornitore esterno. Tuttavia, l'evidenza empirica locale dimostra che non vi è stato alcun troncamento e che il deliverable visibile ha rispettato il vincolo operativo.

---

## 2. Correzioni Minime Necessarie: Contratto dei Limiti

Il disallineamento è derivato dall'assenza, nel contratto v005, di una separazione tra il limite di richiesta, il limite visibile e la telemetria di monitoraggio.

### 2.1 Disaccoppiamento semantico a 5 livelli
Nel contratto C13 si stabilisce la seguente distinzione formale:

1. **`client_requested_max_tokens` (Parametro di richiesta):**  
   Il limite massimo trasmesso nel payload HTTP OpenAI-compatibile (es. `max_tokens: 3000`). È vincolato e verificato a livello deterministico prima dell'invio.
2. **`upstream_enforced_limit` (Vincolo applicato dal provider):**  
   Il limite effettivamente impostato ed eseguito da OmniRoute e dal backend upstream (`maxOutputTokens`). Poiché non è direttamente ispezionabile dal client, rimane **UNVERIFIED** e non deve essere dichiarato arbitrariamente né rispettato né violato.
3. **`gateway_reported_usage` (Telemetria del gateway):**  
   Il valore `usage.completion_tokens` restituito nel payload SSE. Per modelli con reasoning, riflette candidati + pensieri. È una metrica diagnostica e non costituisce un meccanismo economico o contrattuale di blocco.
4. **`reasoning_tokens` (Token di pensiero interno):**  
   I token consumati per la deliberazione interna del modello (es. 3.560), tracciati in `completion_tokens_details.reasoning_tokens`.
5. **`visible_content_tokens` (Token del testo didattico):**  
   I token che formano il contenuto effettivo consegnato al docente/studente (`completion_tokens - reasoning_tokens` = 851).

### 2.2 Correzione della contabilità contrattuale C13
- **Nessuna sanzione per reasoning legittimo:** Un output non deve essere marcato come violazione di budget o fallimento tecnico se `completion_tokens > client_requested_max_tokens`, purché:
  - `visible_content_tokens <= client_requested_max_tokens`;
  - `finish_reason == "stop"` (nessun troncamento);
  - L'eccesso sia interamente spiegato da `reasoning_tokens`.
- **Chiarimento sul cap generativo totale:** Il tetto contrattuale di 7.500 token definito nei piani v001–v005 rappresenta la somma dei `client_requested_max_tokens` delle tre fasi (3.000 Teacher + 2.000 Student + 2.500 Assessment = 7.500), non un tetto rigido sulla telemetria inclusiva di reasoning.

---

## 3. Budget Sperimentale e Margine Tecnico

### 3.1 Bilancio contabile del Piano v005
Nel Piano v005:
- `max_preflight_runs = 3`.
- `max_preflight_gateway_http_calls_per_run = 7`.
- `max_generation_calls_total = 3`.

Consumo effettivo durante C13-R4:
- Preflight 1 (`...011630183950Z-64658525`): fallita per timeout transitorio di rete LAN (`ENVIRONMENT_BLOCKED`) con 4 chiamate HTTP (3 catalog retry + 1 basic probe). Ha consumato 1 run di preflight.
- Preflight 2 (`...012525359039Z-89b8aefc`): completata con successo (`PASS`) con 3 chiamate HTTP (1 catalog + 2 probe). Ha consumato 1 run di preflight.
- Generazione Teacher Material: 1 chiamata HTTP completata con successo.

**Capacità residua v005:**
- Preflight run consumati: `2 / 3` (residuo: **1 run**).
- Fasi generative residue: Student Material e Assessment Draft (2 fasi distinte).
- Poiché la procedura di sicurezza impone una preflight sintetica fresca immediatamente prima di ciascuna generazione, sarebbero necessari 2 run di preflight, ma ne rimane disponibile soltanto 1.
- **Conclusione:** Sotto il Piano v005, il completamento dell'esperimento è **tecnicamente bloccato** per esaurimento della disponibilità dei run di preflight.

### 3.2 Struttura del budget recuperato (Proposta Piano v006)
Per consentire il completamento di tutte le fasi con margini tecnici realistici:
1. **Margine per preflight runs:** Estendere `max_preflight_runs` a **6**, consentendo fino a 2 tentativi di preflight per ciascuna delle 3 fasi a fronte di eventuali fluttuazioni di trasporto LAN.
2. **Cap chiamate HTTP per run di preflight:** Confermare max 7 chiamate per run (fino a 5 tentativi catalogo con backoff deterministico + 2 probe sintetiche basic/structured). Totale massimo chiamate preflight: 42.
3. **Cap generazioni:** Confermare rigorosamente 1 generazione per fase (max 3 chiamate generative totali), zero retry di inferenza, zero fallback di modello.
4. **Cap token di richiesta contrattuale:**
   - Teacher Material: `3.000`
   - Student Material: `2.000`
   - Assessment Draft: `2.500`
   - Totale token richiesti: `7.500`
   - Probe sintetiche: basic `16`, structured `64` (max 80 per run di preflight; max 480 totali).
5. **Busta telemetrica osservazionale:** Definire una busta di monitoraggio della telemetria riportata fino a 18.000–20.000 token complessivi grezzi, confermando che tale envelope serve a fini diagnostici e di telemetria e non costituisce un controllo economico.

---

## 4. Continuità C11 e Integrità dei Manifest

### 4.1 Impossibilità di mutazione del run corrente
È stata analizzata l'ipotesi di far proseguire il run `c11-20261012T004527Z-03177a92` sotto un nuovo piano v006:
1. **Legame crittografico di nascita:**  
   Il run è stato inizializzato e congelato al Checkpoint 5 (`MANIFEST-0005.json`), con stato `C13_WAITING_FOR_EXPERIMENT_CONTINUATION`.  
   Il campo `state["experiment"]["plan_sha256"]` è fissato in modo irreversibile a `8e7098177b529d0dc71578280a5f49c4f081f2284454e5c0999c2ae31cfac9e6` (l'hash canonico del piano v005).
2. **Invarianti C11 e C13:**  
   Il modulo `ai_experiment_adapter.py` verifica tassativamente:
   ```python
   if experiment.get("plan_sha256") != self.plan_sha256:
       raise C13AuthorizationError("C13 run is bound to a different authorization plan")
   ```
   E `preparation_delivery_runner.py` verifica ad ogni gate:
   ```python
   if authorization.get("plan_sha256") != state["experiment"]["plan_sha256"]:
       raise GateRejected("C13 authorization does not match experiment plan")
   ```
3. **Violazione dell'immutabilità:**  
   Modificare a posteriori lo stato del run o i file di checkpoint per allinearli a un nuovo hash di piano v006 distruggerebbe la catena crittografica SHA-256 e violerebbe il principio cardine di append-only logging di C11.
4. **Assenza di meccanismi di migrazione:**  
   Non esistono né devono essere creati artificiosi meccanismi di migrazione a caldo di contratti all'interno di un run C11 già sigillato.

### 4.2 Percorso minimo raccomandato: Nuovo Run C11
- **Preservazione:** Il run `c11-20261012T004527Z-03177a92` rimane sigillato nello stato `C13_WAITING_FOR_EXPERIMENT_CONTINUATION`, preservando integralmente Teacher Material v0001 (`c3e1c145d...`) come baseline canonica storica.
- **Riavvio in nuovo run:** L'esperimento E2E completo viene eseguito in un **nuovo run C11** (es. `c11-202610...`), inizializzato sotto il nuovo Piano v006 approvato dal Domain Owner.
- **Opzioni operative per il nuovo run:**
  - *Opzione A (Full 3-Stage Re-execution):* Il nuovo run esegue sequenzialmente Teacher Material, Student Material e Assessment Draft, ciascuno preceduto da preflight fresca e gate esplicito.
  - *Opzione B (Baseline Artifact Ingestion):* Se esplicitamente autorizzato dal Domain Owner, il nuovo run assume l'output Teacher Material v0001 (già tecnicamente conforme e recensito come `AMEND`) come artefatto di partenza verificato, procedendo direttamente alla generazione di Student Material e Assessment Draft.

---

## 5. Qualità Didattica e Stato della Baseline v0001

- **Revisione didattica del supervisore ChatGPT:**  
  La revisione pedagogica ha registrato la raccomandazione:
  **`AMEND`** (contenuti essenziali didatticamente corretti e grounded sulla fonte C9; guida docente operativa incompleta per uso in aula).
- **Stato autorizzativo:**  
  Teacher Material v0001 non è approvato per l'adozione scolastica reale.
- **Separazione concettuale:**  
  La valutazione sperimentale della pipeline AI (Micro-E2E) verifica la robustezza dei protocolli, la fedeltà alle fonti e la validità strutturale dei deliverable; l'approvazione didattica formale rimane competenza esclusiva del docente / Domain Owner. La raccomandazione `AMEND` è perfettamente adeguata a validare la baseline tecnica della pipeline senza costituire sign-off di produzione.

---

## 6. Specifica del Piano Non Autorizzante Proposto (C13 v006 Draft)

Si riporta la struttura del piano non autorizzante C13 v006 proposta per l'esame del Domain Owner:

```json
{
  "plan_version": "C13 v006 (DRAFT - NON-AUTHORIZING RECOVERY PLAN)",
  "schema_version": "c13-experiment-authorization-plan-v5",
  "status": "PENDING_DOMAIN_OWNER_INPUT_AND_APPROVAL",
  "mode": "C13_EXPERIMENTAL_REMOTE",
  "model_id": "agy/gemini-3.8-flash-tiered",
  "destination": {
    "omniroute_base_url": "http://198.51.100.13/v1",
    "model_route_id": "agy/gemini-3.8-flash-tiered",
    "transport_exception_id": "c13-r2-exact-lan-http-omniroute",
    "downstream_provider_visibility": "UNREPORTED_EXPLICITLY_ACCEPTED"
  },
  "transport_policy": {
    "general_requirement": "HTTPS_FOR_NON_LOOPBACK_EXCEPT_EXACT_C13_R2_ENDPOINT",
    "risk_statement": "HTTP traffic on the LAN is not encrypted. The Domain Owner accepts this risk only for http://198.51.100.13/v1 in the C13 experiment; no other non-loopback HTTP endpoint is authorized.",
    "domain_owner_exception": {
      "exception_id": "c13-r2-exact-lan-http-omniroute",
      "approval_status": "DOMAIN_OWNER_APPROVED_AS_RELAYED_IN_C13_R2",
      "endpoint": "http://198.51.100.13/v1",
      "scope": "C13_EXPERIMENT_ONLY",
      "transport": "HTTP_UNENCRYPTED",
      "risk_acceptance": "LIMITED_TO_EXACT_ENDPOINT_AND_THIS_EXPERIMENT",
      "automatic_substitution": false,
      "automatic_fallback": false
    }
  },
  "limits": {
    "max_generation_calls_total": 3,
    "max_generation_calls_per_stage": 1,
    "automatic_inference_retries": 0,
    "silent_route_fallbacks": 0,
    "max_preflight_runs": 6,
    "max_preflight_catalog_calls_per_run": 5,
    "max_preflight_route_probe_calls_per_run": 2,
    "max_preflight_gateway_http_calls_per_run": 7,
    "max_preflight_gateway_http_calls_total": 42,
    "max_gateway_http_calls_total_including_preflight": 45,
    "max_tokens_by_stage": {
      "teacher_material": 3000,
      "student_material": 2000,
      "assessment": 2500
    },
    "max_preflight_route_probe_tokens": {
      "basic": 16,
      "structured": 64
    },
    "max_generation_requested_tokens_total": 7500,
    "max_preflight_output_tokens_per_run": 80,
    "max_preflight_output_tokens_total": 480,
    "maximum_total_requested_tokens_including_preflight": 7980,
    "token_contract_semantics": "LIMITS_APPLY_TO_CLIENT_REQUESTED_MAX_TOKENS"
  },
  "telemetry": {
    "purpose": "Technical execution and reliability evidence only.",
    "reasoning_tokens_handling": "RECORD_SEPARATELY_WITHOUT_ECONOMIC_ENFORCEMENT",
    "record_when_available": [
      "prompt_tokens",
      "completion_tokens",
      "completion_tokens_details.reasoning_tokens",
      "visible_content_tokens",
      "elapsed_seconds",
      "time_to_first_output_seconds",
      "http_status",
      "finish_reason"
    ]
  }
}
```

---

## 7. Test Eseguiti e Risultati

Tutte le verifiche sono state condotte in modalità puramente offline:

1. **Test suite C13 Preflight & Integration:**
   - `python3 -m unittest -v validation/work/C13/tests/test_experiment_preflight.py` -> **6/6 test PASS**.
   - `python3 -m unittest -v validation/work/C13/tests/test_unified_ai_experiment.py` -> **18/18 test PASS**.
2. **Test suite C11 Lifecycle:**
   - `python3 -m unittest discover validation/work/C11/tests/` -> **18/18 test PASS**.
3. **Test suite C12 Generation Adapter:**
   - `python3 -m unittest discover validation/work/C12/tests/` -> **15/15 test PASS**.
4. **Verifica integrità artefatti e preservazione:**
   - Teacher Material v0001 (`material.md`): SHA-256 `c3e1c145d75bbd4571cb21545a32d1bb8a5dacafe6c0429320fff95e0ce1744f` (**INTATTO**).
   - Checkpoint-0005 e Manifest-0005 (`51ea26bcfb79adb...`): intatti, nessuna mutazione.
5. **Verifica sicurezza e secret leakage:**
   - File `.env.local` e credenziali protette: non letti, non caricati.
   - Chiamate di rete o aperture socket: **0**.

---

## 8. Decisioni Effettivamente Richieste al Domain Owner

Per riprendere ed eseguire con successo il Micro-E2E sono necessarie le seguenti decisioni esplicite del Domain Owner:

1. **Accettazione della semantica dei token:**  
   Confermare che i vincoli contrattuali `max_tokens` (3.000 Teacher, 2.000 Student, 2.500 Assessment, totale 7.500) governano i token massimi richiesti per il testo visibile candidabile (`client_requested_max_tokens`), e che i reasoning token generati internamente dal modello (`agy/gemini-3.8-flash-tiered`) vengono registrati in telemetria separatamente senza costituire superamento del limite.
2. **Approvazione dei margini per preflight (Piano v006):**  
   Approvare l'estensione a max 6 run di preflight per assorbire eventuali fluttuazioni di trasporto LAN, mantenendo esattamente 1 sola generazione per ciascuna delle 3 fasi didattiche, zero retry di inferenza e zero fallback di modello.
3. **Scelta della strategia per il run C11:**  
   - Confermare la preservazione del run `c11-20261012T004527Z-03177a92` come baseline immutabile v0001 (`AMEND`).
   - Scegliere la modalità per il nuovo run C11:
     - **Opzione A:** Riavvio completo da zero (nuova generazione Teacher Material + Student Material + Assessment Draft sotto Piano v006); oppure
     - **Opzione B:** Continuità logica tramite assunzione dell'artefatto Teacher Material v0001 come baseline congelata nel nuovo run, procedendo alla generazione di Student Material e Assessment Draft.
4. **Nessun avanzamento non autorizzato:**  
   In assenza di autorizzazione formale, nessun run viene avviato, nessuna inferenza viene eseguita e Gate D rimane **BLOCKED**.
