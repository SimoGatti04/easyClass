# C13-R2 — Eccezione esplicita per trasporto HTTP LAN

**Data:** 11 ottobre 2026 (Europe/Rome)  
**Esito:** `PASS — eccezione limitata implementata e regressioni offline superate`  
**Readiness esperimento:** `BLOCKED — piano v003 non autorizzante; restano gate del Domain Owner e verifica route/capability`  
**Chiamate di rete / preflight live / inferenze / corpus inviato / letture di credenziali:** `0 / 0 / 0 / false / 0`  
**Registry, eligibility, sign-off storico C7, Gate D:** invariati; Gate D resta `BLOCKED`.

## Decisione C13-R2 e confine dell'eccezione

È stata applicata la decisione esplicita trasmessa dal Domain Owner per usare, nel solo esperimento C13, l'endpoint esatto `http://198.51.100.13/v1`. Il traffico HTTP sulla LAN **non è cifrato**: il tratto non ha protezione TLS per riservatezza o integrità. L'accettazione del rischio è registrata nel piano v003 esclusivamente per questa destinazione e per questo esperimento; l'autorizzazione operativa dovrà ripeterla esplicitamente.

HTTPS resta il requisito generale C13 per destinazioni non-loopback diverse dall'eccezione. Non sono consentiti altri host/IP, subnet, porte, percorsi, endpoint alternativi, sostituzione automatica, fallback pubblico HTTPS, proxy o tunnel. Il controllo confronta esattamente la stringa dell'endpoint del piano con quella del runtime. Il preflight C6 storico e il relativo comportamento non sono stati modificati.

## Piano v003

- Piano: `validation/work/C13/plans/authorization-plan-v003.json`.
- Schema/versione: `c13-experiment-authorization-plan-v3` / `v003`.
- SHA-256 canonico: `a710f84e5f0f14b48fb36859dcef3ee2655e5e5d126cffb7da9024939532433d`.
- Template: `validation/work/C13/authorizations/domain-owner-authorization-template-v003.json`.
- Il template resta `TEMPLATE_ONLY`, `NOT_AUTHORIZED_TEMPLATE`, `simulated=true`; la conferma del rischio HTTP è `false`. Non è stato creato un record di autorizzazione reale.
- Piano e template v002 sono stati preservati. Il loro hash canonico v002 continua a essere `6f575b00a19776e6359247b223aa8ad9f8b381f60374564d53b35903c02fbd0b`.
- Modello, source set/hash, parametri, token/call limits, capability gate, provider-downstream policy, privacy, provenance e approvazioni per fase sono rimasti invariati rispetto a v002; il piano v003 non abilita l'elaborazione esterna e resta `PENDING_DOMAIN_OWNER_INPUT_AND_APPROVAL`.

Il piano v003 pinna gli hash aggiornati delle implementazioni C13. È stato verificato che ciascun hash registrato corrisponde al relativo file corrente e che il template v003 riporta l'hash canonico del piano.

## Controlli implementati

In `validation/work/C13/scripts/ai_experiment_adapter.py`:

- v003 richiede l'endpoint esatto, il marker d'eccezione e la policy di trasporto esatti, oltre a un record non simulato che approvi lo stesso endpoint e dichiari `unencrypted_lan_http_risk_accepted=true`;
- v003 rifiuta anche un endpoint HTTPS sostitutivo: il piano C13-R2 è vincolato alla destinazione LAN approvata, senza deviazioni automatiche;
- v002 conserva il requisito HTTPS per ogni destinazione non-loopback; le sue prove di compatibilità aggiornano soltanto pin temporanei nel fixture, senza alterare l'artefatto storico;
- un mismatch tra piano e configurazione runtime è rifiutato con confronto esatto, senza normalizzazioni permissive.

In `validation/work/C13/scripts/run_experiment_preflight.py`, l'autorizzazione v3 viene verificata prima di leggere la configurazione runtime e prima di qualsiasi chiamata al catalogo. La preflight C13 richiede identità endpoint esatta e usa il trasporto LAN solo con i gate completi. Nessuna modifica è stata apportata a C6.

## Regressioni locali

- Syntax/import: `AST_PARSE_PASS` per runner e test C13.
- Test C13 lifecycle + preflight: **19/19 PASS**.
- Regressione combinata C10–C13: **75/75 PASS**.
- Regressione C6 storica: **82/82 PASS**; il test di preservazione dello storico C6 è passato.
- Coperti: endpoint LAN esatto con doppia approvazione; rigetto di IP/porta/path differenti e di sostituzione HTTPS; eccezione mancante nel piano o nell'autorizzazione; accettazione del rischio mancante; mismatch runtime prima del catalogo; mancata autorizzazione prima del catalogo; compatibilità HTTPS v002; regressioni lifecycle C10–C13 e trasporto/preflight C6.
- Ogni trasporto impiegato nei test era fixture/fake. Nessun test ha aperto una connessione o caricato la configurazione runtime reale.

## Documentazione e stato

Aggiornati il runbook `validation/work/C13/procedure.md` e `STATUS.md`. Il runbook specifica l'uso esclusivo dell'endpoint LAN, il rischio non cifrato, i divieti di fallback e la necessità del record reale v3. Questo report è una nuova evidenza separata e non riscrive il report storico C13-R1 o gli artifact v002.

## Autorizzazioni ancora mancanti

1. Record Domain Owner **non simulato**, legato allo SHA-256 canonico v003, che approvi il modello/esperimento e confermi esplicitamente `http://198.51.100.13/v1` e il rischio del traffico LAN non cifrato.
2. Identificazione autorevole del provider downstream oppure accettazione esplicita che la visibilità resti `UNREPORTED`.
3. Approvazione dell'elaborazione esterna e dell'invio della fonte C9 congelata; approvazione o sostituzione esplicita di accesso, retention proposta di 30 giorni e cleanup manuale.
4. Approvazione separata delle proiezioni esatte di richiesta per ciascuna fase e decisioni di continuazione legate agli hash/versioni dei risultati precedenti.

La preflight sintetica corrente Gemini-only e i gate di esecuzione restano da effettuare solo dopo le autorizzazioni applicabili; in questo task non sono stati verificati.
