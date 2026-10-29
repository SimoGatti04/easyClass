# UX2-D — Teacher-to-Student E2E Acceptance & Release Readiness

**Data:** 29 ottobre 2026 (Europe/Rome)
**Ruolo:** QA / Integration Engineer
**Esito:** **PASS — accettazione end-to-end locale**
**Ambiente:** `~/Workspace/teacher-service-design`, branch `codex/teacher-service-c6`
**Produzione:** invariata; nessun push, merge, deploy o modifica a K3s, Cloudflare o Infisical.

## 1. Consolidamento del checkpoint

- UX1, UX2-A, UX2-B e UX2-C erano già presenti. UX2-C è stato registrato nel commit locale dedicato `e41a12f` (`feat(ux2c): integrate version-bound material publication`), con base UX2-B `5ba6b97`.
- L'intestazione di `STATUS.md` distingue ora esplicitamente:
  - **Produzione CURRENT:** Teacher Service R3 già distribuito tramite C7B su K3s.
  - **Sviluppo CURRENT:** UX1–UX2-C (e ora UX2-D) solo nel branch locale, non distribuiti.
- Nessuna credenziale, `.env`, database produttivo o artefatto temporaneo è stato aggiunto ai commit. Le fixture usano identità JWT sintetiche, SQLite temporaneo e FileStore temporaneo.

## 2. Correzioni emerse dal collaudo

1. **Ritiro di una versione non corrente.** La UI UX2-C operava solo sulla versione corrente del materiale: dopo la creazione di v2 non era possibile ritirare v1. La sezione “Altre versioni sono ancora disponibili” ora espone `Ritira vN`, con conferma esplicita, chiamando la stessa rotta version-bound. Questo abilita il percorso richiesto “ritira v1 lasciando v2”.
2. **Overflow a 320 px.** L'intestazione docente andava in overflow orizzontale di 26 px a 320 px. A ≤480 px l'intestazione va a capo e il badge utente può restringersi/ellissare. Verificato 0 px di overflow a 1024 e 320 px.
3. **Deep link a materiale ritirato.** Il portale studente mostrava il messaggio tecnico inglese del 404. Ora mostra: “Questo materiale non è più disponibile: potrebbe essere stato ritirato o la scadenza è terminata.”
4. **Anti-pattern visivi introdotti in UX2-C.** Rimossi i due `border-inline-start: 4px` da stato disponibilità e conferma pubblicazione. Il detector Impeccable non segnala nuovi anti-pattern; restano 9 `side-tab` preesistenti (UX2-B e precedenti), fuori dal perimetro di questa fase.

Nessuna modifica a schema SQLite, eventi append-only, autenticazione, autorizzazione docente, CSRF o regole di pubblicazione.

## 3. Percorso verificato

Il test `tests/browser/teacher-student-ux2d-e2e.test.js` usa **due contesti browser isolati**:

- **Docente:** principal JWT sintetico, esplicitamente autorizzato tramite `teacherEmails`; cookie `CF_Authorization` limitato all'origine loopback.
- **Studente:** contesto anonimo, senza cookie o credenziali docente.

Percorso eseguito:

1. Apertura della preparazione e verifica che un pacchetto non confermato non esponga la pubblicazione.
2. Conferma del pacchetto e pubblicazione esplicita di v1 con scadenza impostata dall'interfaccia.
3. Verifica che la scadenza locale del docente sia inviata come istante UTC corretto.
4. Consultazione studente di v1, contenuto e download originale (HTTP 200).
5. Modifica manuale del materiale, salvataggio v2, nuova conferma e pubblicazione di v2 senza scadenza.
6. Studente: v1 e v2 entrambe visibili; download di v2 (HTTP 200).
7. Controlli responsive docente e studente a 1024 e 320 px, oltre a 768/390 già coperti da UX2-C.
8. Ritiro di v1 dalla lista “Altre versioni”, con v2 ancora disponibile; download v1 ora 404 e lista studente ridotta a v2.
9. Concorrenza reale: una seconda sessione docente pubblica v3, poi la ritira e la ripubblica con scadenza breve mentre la prima sessione ha aperto la conferma di ritiro. Alla conferma il server restituisce **409**, la UI mostra “Lo stato è cambiato”, ricarica lo stato come “Pubblicazione scaduta” e non aggiunge eventi spuri.
10. Ritiro di v2; portale studente a 0 materiali, download 404 e deep link con messaggio comprensibile, senza lettore.

## 4. Copertura edge case

| Caso | Copertura |
|---|---|
| Versione esatta, nessun fallback alla corrente | API: versioni `0`, `01`, `1.0`, `not-a-version`, inesistenti |
| Autorizzazione | API: anonimo 401, autenticato non docente 403 |
| CSRF | API: mutazioni senza Origin rifiutate prima di scrivere eventi |
| Idempotenza | API: pubblicazione equivalente senza nuovi eventi |
| Scadenza | API: date invalide/passate rifiutate; scadenza reale; UI: conversione locale→UTC |
| Ruoli/tipi non pubblicabili | Teacher Material, Teacher Script, Lesson Plan, Assessment |
| Versioni indipendenti | API + UI: v1/v2/v3, ritiro selettivo |
| File pubblicato | API + UI: download 200, poi 404 dopo ritiro |
| Materiale archiviato | API: `unavailable` / `material_inactive`, lista studente esclusa, publish 400, withdraw 409, storico conservato |
| Concorrenza | Browser: seconda sessione reale, 409, nessun evento aggiuntivo |
| Deep link non disponibile | Browser: messaggio italiano, nessun lettore |
| Responsive | 1024, 768, 390, 320 px; overflow orizzontale ≤1 px |

## 5. Verifiche eseguite

Tutte le esecuzioni usano dati sintetici e loopback locale.

| Comando | Esito |
|---|---|
| `pnpm test` | **38 suite passate, 0 fallite; 161 test passati** |
| `node --test tests/server/material-publication-api.test.js` | **12 passati, 0 falliti** |
| `UX2D_SCREENSHOTS_DIR=.impeccable/ux2d/screenshots pnpm run test:browser:ux2d` | **1 passato, 0 falliti, 0 skip** |
| `pnpm run test:browser:ux2b` | **1 passato** |
| `pnpm run test:browser:ux2c` | **1 passato** |
| `pnpm run test:browser:c5` | **1 passato** |
| `pnpm run build:client` | superato (incluso nei test browser) |
| Impeccable 4.8.0 `detect --no-advisory` | 9 anti-pattern `side-tab` preesistenti; **0 nuovi** |

Evidenze visive: `.impeccable/ux2d/screenshots/availability-two-versions-1024.png`, `availability-two-versions-320.png`, `student-class-1024.png`, `student-class-320.png`, `student-reader-1024.png`, `student-reader-320.png`.

## 6. Limiti residui e rischi

- **Limite UI noto:** la schermata Disponibilità gestisce il Student Material del pacchetto. I Support Material idonei sono coperti da API e test, ma non hanno un selettore UI dedicato.
- **Rischi di produzione invariati:** SQLite e FileStore su singolo nodo; nessun backup indipendente introdotto. La pubblicazione reale resta non eseguita.
- **Verifica browser:** Chromium headless, viewport emulati; nessun device fisico, screen reader o certificazione WCAG.
- **Concorrenza:** SQLite serializza le scritture sul processo locale; il test copre il conflitto applicativo, non un cluster multi-scrittore.
- **Storico:** gli eventi di pubblicazione restano append-only; la verifica non autorizza cancellazioni o riscritture.

## 7. Release readiness

Pronto per la revisione locale successiva. Non pronto per un deploy produttivo senza un'autorizzazione separata che includa: verifica K3s/Infisical, smoke test su dati non sintetici, decisione su backup SQLite/FileStore e conferma esplicita del Domain Owner.
