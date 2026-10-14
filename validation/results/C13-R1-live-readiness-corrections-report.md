# C13-R1 — Cost Governance Simplification & Live Readiness Corrections

**Data:** 11 ottobre 2026 (Europe/Rome)  
**Esito locale:** `PASS` per le correzioni e le regressioni offline.  
**Readiness live:** `BLOCKED_PENDING_DOMAIN_OWNER_AND_CURRENT_ROUTE_GATES`.  
**Chiamate remote reali / inferenze / corpus inviato / credenziali lette:** `0 / 0 / false / 0`.  
**Registry, eligibility, sign-off C7, Gate D:** invariati; Gate D resta `BLOCKED`.

## Decisione applicata

La responsabilità per abbonamento, disponibilità dei modelli consentiti e gestione economica su OmniRoute appartiene all'utente/Domain Owner e al gateway. Teacher Service rispetta i modelli che OmniRoute espone come disponibili/consentiti e svolge i soli controlli tecnici e di sicurezza necessari. Non ispeziona piani o billing, non richiede evidenza economica, non stima spesa e non applica quote monetarie.

I limiti C13 su numero di generazioni, token, retry e chiamate restano **limiti tecnici della singola prova** e non policy generali del prodotto. Restano registrabili metriche tecniche disponibili (token, latenza, conteggio richieste, retry, stato HTTP, finish reason ed errori); non vengono convertite in controlli economici.

## Piano di autorizzazione versionato

- Nuovo piano: `validation/work/C13/plans/authorization-plan-v002.json`.
- SHA-256 canonico v002: `6f575b00a19776e6359247b223aa8ad9f8b381f60374564d53b35903c02fbd0b`.
- Stato: `PENDING_DOMAIN_OWNER_INPUT_AND_APPROVAL`; il piano non autorizza chiamate.
- Template non autorizzante: `validation/work/C13/authorizations/domain-owner-authorization-template-v002.json`, legato allo SHA-256 v002.
- Il piano e il template v001 sono preservati byte-identici. SHA-256 v001: `caa8a8d55ed0e4b5ecd9b4bf4d6f6d2cbcd4e23a6b92ad40da00e9a1ff62a430`.
- Il modello approvato resta `agy/gemini-3.8-flash-tiered`; nessuna selezione, eligibility o modifica registry.
- Rimosse dal piano operativo v002 le condizioni e i campi per cap USD 1, billing evidence, verifica SHA economica e relativi blocchi. Nel piano e template v002 non rimangono campi o condizioni di questo tipo.

### Limiti tecnici v002

- massimo 3 generazioni, una per fase; nessun inference retry e nessun fallback;
- `max_tokens`: Teacher Material 3000, Student Material 2000, Assessment Draft 2500;
- massimo 3 preflight C13, una per fase: fino a 7 richieste HTTP e 80 output token ciascuna;
- massimo 24 chiamate HTTP gateway complessive e 7.740 output token inclusa la preflight;
- parametri e contenuti del task invariati: temperature 0.2, top_p 0.9, streaming, scenario e source set C9 congelati.

Il nome canonico usato sia dal validatore sia dal piano è `max_gateway_http_calls_total_including_preflight` (valore 24). Il vecchio nome `max_gateway_http_calls_total_including_preflight_and_generation` non è accettato dal nuovo piano.

## Preflight C13 Gemini-only

È stato verificato e mantenuto un runner C13 distinto, `validation/work/C13/scripts/run_experiment_preflight.py`, che riutilizza catalogo, transport, SSE, request guard e retry policy C6 senza modificare il runner o gli artifact storici C6.

- La route è limitata all'unico Model ID approvato Gemini; vengono eseguite una probe sintetica base e una structured, senza corpus.
- Il catalogo OmniRoute live è l'autorità per availability e allow-list correnti; il Model ID deve essere presente e avere identity coerente. Non è selezionato alcun sostituto.
- Soltanto dopo esaurimento per transient transport è ammesso il catalogo attempt-07 come metadato di risoluzione identità; non viene usato per discovery o availability.
- 401/403 del catalogo e catalogo HTTP 200 semanticamente invalido fermano la preflight senza fallback.
- La preflight C6 storica mantiene la propria coorte e non è stata modificata. SHA-256 del suo runner `run_c6.py`, prima/dopo: `e38ffdd50e74337951e8156f840118c0b47a5081b5d0b9bf92044a4b67507b32`.

La prova offline della preflight C13 ha usato esclusivamente cataloghi e risposte SSE fake: PASS con catalogo live fittizio; PASS con identity fallback attempt-07 dopo exhaustion transient fittizia; stop senza route probe su auth failure e catalogo semanticamente invalido. Sono stati osservati esclusivamente i due POST fake per la route Gemini; nessuna route Groq è stata richiesta. I contatori di chiamata presenti negli artifact test sono contatori di fixture e non chiamate esterne.

## Test e preservazione

- C10 + C11 + C12 + C13: **70/70 PASS**.
  - C10: 23;
  - C11: 18;
  - C12: 15;
  - C13 lifecycle/adapter: 11;
  - C13 Gemini-only preflight: 3.
- Regressione C6 aggiuntiva: **82/82 PASS**; il test suite verifica anche l'integrità del suo storico preflight.
- Coperti: piano v002 senza campi economici; assenza di metadati economici senza blocco; enforcement dei limiti tecnici; esattezza della route e del capability evidence; request/auth/data gates fail-closed; route Gemini-only; preflight persistito non-overwriting; fallback identity-only solo dopo transient transport; stop su auth/catalog semantic error; regressioni del lifecycle, dei gate version-bound, dell'assenza di retry e della separazione Teacher-only.
- Hash baseline storico: **1.252/1.252 file presenti e invariati**. Include C7/Gate-C/C10–C13, piano/template v001 e artifact storici verificati. I test temporanei sono stati rimossi dal proprio teardown.
- Syntax/import dei runner e test C13: PASS. Hash dei pin di implementazione del piano v002: tutti coerenti al termine della verifica.
- Zero modifiche a C6, C10–C12, C9 source/contracts, output C7, registry, eligibility, sign-off storico e Gate D.

## Documentazione aggiornata

- `docs/00-design-method.md`: chiarita la responsabilità economica dell'utente/Domain Owner per i gateway opzionali e la natura non economica dei limiti di prova.
- `docs/dossiers/10-ai-architecture.md` §11.1: formalizzati responsabilità economica esterna, rispetto della allow-list OmniRoute e separazione tra metriche tecniche e controlli economici.
- `validation/work/C13/procedure.md`: aggiornata a plan v002, preflight C13 Gemini-only e sequence futura; nessun comando live è stato eseguito.
- `STATUS.md`: stato C13-R1 aggiunto, mantenendo il report C13 originario come evidenza storica.
- Il report originario `C13-unified-ai-experiment-readiness-report.md` non è stato modificato: descrive storicamente v001 e rimane consultabile; questo report R1 ne corregge la readiness corrente.

## Blocchi effettivi prima di un esperimento reale

1. Ottenere autorizzazione non simulata del Domain Owner, legata allo SHA-256 v002 e alla route Gemini esatta.
2. Approvare l'endpoint OmniRoute e i termini di trattamento/retention; identificare il provider downstream o accettarne esplicitamente la visibilità non riportata.
3. Autorizzare esplicitamente la trasmissione della fonte C9 e approvare i dati/request per ciascuna fase.
4. Dopo tali autorizzazioni, eseguire la preflight Gemini-only per verificare availability, identità e structured capability correnti; al momento sono `NOT_CHECKED`.
5. Prima di ogni generazione, esaminare e autorizzare la request projection esatta; dopo ogni output, decidere esplicitamente se continuare dalla versione/hash risultante.

Non è richiesto alcun billing artifact o controllo del piano OmniRoute da parte del Teacher Service. Non è stata avviata alcuna fase remota, non è stato inviato il corpus e non è stata letta alcuna credenziale.

## Addendum — C13 Final Authorization Preflight (local only)

**Data:** 11 ottobre 2026. **Natura:** packet informativo, non autorizzante; questo addendum aggiorna l’indicazione precedente di endpoint non determinato. Nessun codice, piano approvabile o artefatto storico è stato modificato. Nessuna chiamata remota, preflight, inferenza o trasmissione della fonte è stata effettuata; è stato estratto soltanto il valore endpoint dalla configurazione dedicata locale, senza esporre o esportare credenziali.

### Destinazione e route

- Endpoint configurato (raggiungibilità non verificata) nel solo `TEACHER_SERVICE_OMNIROUTE_BASE_URL` del `.env.local` dedicato al progetto: `http://198.51.100.13/v1`.
- Il piano v002 non contiene ancora un endpoint (`destination.omniroute_base_url = null`) e prescrive HTTPS per destinazioni non-loopback; HTTP è ammesso solo per `localhost`, `127.0.0.1` o `::1`. L'endpoint configurato è non-loopback e HTTP, quindi **non è compatibile con il controllo di trasporto C13 attuale**. Non può essere autorizzato né usato invariato. Occorre che il Domain Owner scelga/approvi un endpoint compatibile (ad esempio HTTPS) e che questo venga vincolato in una nuova versione del piano; v002 resta preservato e non viene riscritto.
- Model ID richiesto: `agy/gemini-3.8-flash-tiered`; namespace `agy`; identity storica del piano: root/name `gemini-3.8-flash-tiered`. Questa identity non prova availability o capability correnti.
- Visibilità downstream: **`UNREPORTED`**. La documentazione locale descrive `agy` come namespace/provider logico o aggregatore e illustra genericamente l'instradamento verso provider; non contiene una mappatura autorevole specifica per questa route. Nessun provider downstream è dedotto dal nome.

### Piano e fonte

- Piano: `validation/work/C13/plans/authorization-plan-v002.json`, versione `v002`, stato `PENDING_DOMAIN_OWNER_INPUT_AND_APPROVAL`.
- SHA-256 canonico del piano: `6f575b00a19776e6359247b223aa8ad9f8b381f60374564d53b35903c02fbd0b` (coerente con l'hash collegato al template v002). Il piano non è un'autorizzazione.
- Fonte prevista: `validation/work/C9/inputs/sources/dbms_student_lesson.md`.
- SHA-256 atteso e ricalcolato: `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035` — corrispondenza verificata. Scope sperimentale: `SELECT` / `FROM` / `WHERE` / `ORDER BY`; `JOIN` e aggregazioni esclusi.

### Proposta di trattamento e limiti tecnici

- Classe proposta: `TEACHER_INTERNAL_NON_PERSONAL_FROZEN_C9_SOURCE_AND_GENERATED_DRAFTS`; dati personali degli studenti fuori perimetro.
- Elaborazione esterna tramite OmniRoute: **non ancora approvata**. Conservazione proposta nel progetto, accesso owner-only, retention 30 giorni, cleanup manuale owner-controlled e nessuna cancellazione automatica. Il Domain Owner può approvare o sostituire esplicitamente queste condizioni.
- Limiti della sola prova: massimo 3 generazioni, una per fase; `max_tokens` 3000 (Teacher Material), 2000 (Student Material), 2500 (Assessment Draft); zero retry d'inferenza e zero fallback; massimo 3 preflight sintetiche Gemini-only, ciascuna entro 7 richieste HTTP e 80 output token; massimi complessivi 24 richieste HTTP e 7.740 output token inclusa la preflight. Metriche disponibili (token, latenza, richieste, errori) restano tecniche, senza stime o controlli economici.

### Decisioni ancora richieste al Domain Owner

1. Scegliere e approvare l'esatto endpoint OmniRoute compatibile con la policy di trasporto; il valore locale corrente è HTTP non-loopback e deve essere risolto. La destinazione approvata va registrata in una nuova versione del piano, senza alterare v002.
2. Per la route esatta, fornire una fonte autorevole del provider downstream oppure accettare esplicitamente `UNREPORTED`.
3. Autorizzare in modo esplicito l'elaborazione esterna e l'invio della fonte C9 identificata sopra; approvare accesso, retention e cleanup proposti o indicare condizioni sostitutive.
4. Dopo l'allineamento del piano/destinazione, approvare la nuova identità/hash del piano e creare il record Domain Owner reale, non simulato e legato a tale hash.
5. Autorizzare separatamente la preflight sintetica C13-only Gemini per accertare route/capability correnti; poi, prima di ogni generazione, esaminare e approvare la proiezione esatta della richiesta. Ogni continuazione richiede una decisione esplicita legata agli hash della versione generata e della richiesta successiva.

Questo packet non autorizza l'esecuzione. Nessun controllo economico/billing è richiesto a Teacher Service; nessun modello, registry, eligibility, sign-off o stato Gate D è stato modificato.
