# UX2-A — Teacher Dashboard Responsive Navigation & Attention Queue

**Data:** 28 ottobre 2026  
**Stato:** implementazione locale completata; nessun push, merge o deployment.  
**Branch:** `codex/teacher-service-c6`  
**Perimetro:** UX2-A. UX2-B (percorso classe → lezione → materiale → pubblicazione) non è iniziato.

## Sintesi

La direzione B per il docente è stata applicata senza sostituire l’intera area docente: la navigazione resta raggruppata con link diretti su desktop e diventa un selettore nativo etichettato su tablet e smartphone. La dashboard ora mostra una sola riga per attività che richiede sia correzione sia monitoraggio; i due stati e le due azioni restano distinti. Non sono stati aggiunti scadenze, priorità o conteggi non forniti dal servizio.

## 1. Problemi risolti e aperti

| Rilievo | Esito | Evidenza |
|---|---|---|
| Navigazione docente orizzontale e difficile da usare su schermi stretti | **Risolto**: a ≤1024 px le schede raggruppate sono sostituite da un selettore nativo con etichetta “Vai a” e gruppi `Insegnamento` / `Verifiche`. | Test browser a 1024, 768, 390 e 320 px; nessun overflow orizzontale. |
| La stessa verifica compariva sia nella coda correzione sia nella sezione attività attive | **Risolto**: una riga nella coda “Richiedono attenzione”, con indicatori separati per correzione e monitoraggio e relativi pulsanti indipendenti. | Test E2E sintetico: una sola riga C5 con entrambe le azioni. |
| Etichetta mobile “Sessione autorizzata” troncata | **Risolto**: testo completo mantenuto leggibile anche a 390 e 320 px. | Test DOM/layout e screenshot responsive. |
| Screenshot desktop mostrava per un istante due sezioni attive | **Risolto**: era la transizione `all` di 150 ms che lasciava visibile parte del colore selezionato dopo il cambio; la navigazione ora non anima sfondo/bordo. | Test verifica una sola scheda attiva e sfondo trasparente sulla scheda inattiva; screenshot finale. |
| Gruppi del selettore non visibili nello screenshot chiuso | **Parzialmente verificato**: i gruppi sono `<optgroup>` con etichette accessibili e sono presenti nell’albero DOM; lo screenshot non mostra il menu nativo aperto. | Test DOM; non è stata acquisita una schermata del menu aperto su dispositivo fisico. |

Resta un limite di dominio, non affrontato in UX2-A: non si inventano priorità/scadenze quando il backend non le fornisce. Le righe sono organizzate per stato e contesto disponibili.

## 2. Componenti e strutture

- **`TeacherArea`** — gruppi di navigazione semantici, `aria-current` sulla sola sezione corrente e selettore nativo accessibile fino a 1024 px.
- **`TeacherOverviewView`** — coda unica per attività, contesto classe/materia/lezione quando disponibile, stati distinti e azioni separate.
- **`client/app.css`** — comportamento responsive, focus visibile, stato selezionato immediato e testo di autorizzazione non troncato su mobile.
- **Test browser C5** — copertura di selettore/gruppi, ordine Tab e focus, assenza di overflow, stati/azioni della coda e screenshot.

Il design system condiviso resta in `DESIGN.md`; la direzione A per il portale studenti rimane documentata ma non è stata implementata.

## 3. Screenshot

Le immagini `before-*` sono della sessione UX1 con una fixture sintetica diversa dalle immagini `after-*` (fixture C5 E2E). Il confronto è quindi utile per gerarchia, navigazione e deduplicazione, non per confrontare conteggi o contenuti riga per riga.

- Prima: [desktop 1440](screenshots/before-desktop-1440.png) · [tablet 768](screenshots/before-tablet-768.png) · [mobile 390](screenshots/before-mobile-390.png)
- Dopo: [desktop 1440](screenshots/after-desktop-1440.png) · [tablet landscape 1024](screenshots/after-tablet-landscape-1024.png) · [tablet 768](screenshots/after-tablet-768.png) · [mobile 390](screenshots/after-mobile-390.png)

## 4. Browser e responsive

- **Chrome visibile:** la pagina locale docente è stata ispezionata tramite Chrome e albero di accessibilità; il servizio di preview locale è stato arrestato a fine verifica.
- **Viewport browser automatizzati:** 1440×1000, 1024×768, 768×1024, 390×844 e 320×740. La coda resta leggibile, il selettore è presente sotto la soglia responsive, l’etichetta di autorizzazione non è tagliata e non si rileva overflow orizzontale.
- **Tastiera:** il test raggiunge il selettore con Tab dal pulsante “Home Portale” e verifica `:focus-visible`; selezione delle sezioni e gruppi sono inoltre verificati nel selettore nativo.
- **Limite:** 1024/768/390/320 sono viewport simulati in Chromium automatizzato, non dispositivi fisici. Il controllo Chrome visibile è stato desktop; non viene dichiarata una prova su tablet o telefono reali.
- **Contenuto:** soltanto dati sintetici. Il test C5 non dimostra deduplicazione per ogni dataset possibile, ma verifica il caso in cui la stessa attività richiede correzione e monitoraggio.

## 5. Impeccable

- Skill letta: Impeccable **4.8.0**. La valutazione A iniziale era **31/40**, screenshot-only; aveva segnalato doppia evidenza desktop, testo di sessione troncato e necessità di controllare i gruppi del selettore.
- La rivalutazione qualitativa finale delle immagini conferma risolti i due rilievi visivi principali e non rileva altre criticità materiali; rimane il limite di non aver catturato il menu nativo aperto.
- Comando detector effettivamente eseguito dopo le modifiche:

  ```text
  ~/.agents/skills/impeccable/scripts/impeccable detect --json --scope layout ~/Workspace/teacher-service-design/client/app.css ~/Workspace/teacher-service-design/client/src/components/TeacherArea.js ~/Workspace/teacher-service-design/client/src/components/TeacherOverviewView.js
  ```

  **Risultato:** `[]`, nessun finding statico di layout. La scansione non certifica accessibilità WCAG, contrasto o comportamento browser. Non dichiaro eseguiti i sottocomandi CLI `critique` o `audit`; la critica qualitativa e l’audit pratico sono stati condotti separatamente con screenshot e test browser.

## 6. Verifiche e regressioni

- `pnpm run test:browser:c5` — **1 test superato, 0 fallimenti, 0 skip**. Include la build frontend e l’E2E C5 con database isolato e dati sintetici.
- `pnpm test` — **37 suite superate, 0 fallite, 2 skip**: drill container escluso perché Docker/image non disponibili; test HTTP isolato saltato per policy di bind loopback nell’esecuzione non elevata.
- `git diff --check` — superato dopo l’aggiornamento di codice, test e report.
- Nessun cambio a backend, API, autenticazione, database, MCP, scoring, stati o logica di correzione. Nessun dato reale, push o deployment.

## 7. File e commit

Modifiche UX2-A: `client/app.css`, `DESIGN.md`, `tests/browser/teacher-c5-browser.test.js`, screenshot in `.impeccable/ux2/screenshots/` e questo report. `TeacherArea.js` e `TeacherOverviewView.js` contengono l’implementazione UX2-A già presente nel working tree al passaggio di consegne.

Le modifiche UX1 preesistenti a `PRODUCT.md`, `STATUS.md`, `ActivitiesView.js`, `SubmissionsView.js` e relativi asset compilati sono state preservate, non annullate né riscritte. **Commit locale non creato**: il working tree contiene entrambe le tranche UX1 e UX2-A ancora non committate. Il branch resta `codex/teacher-service-c6`.

## 8. Rischi e limiti

- La coda non aggiunge scadenze o ranking: se servirà ordinamento per urgenza, il requisito deve essere supportato da dati/backend prima di essere mostrato.
- Il detector Impeccable è statico e non è una certificazione di accessibilità.
- Gli screenshot prima/dopo usano fixture sintetiche diverse; i dati non sono comparabili.
- Nessun test su dispositivo fisico o assistive technology.

## 9. Raccomandazione UX2

Procedere con **UX2-B** solo dopo la revisione di UX2-A: rendere coerente e breve il flusso **classe → lezione → materiale → revisione → pubblicazione**, mantenendo contesto e stato visibili a ogni passaggio. Prima di estenderlo all’intera area docente, validare un percorso completo su desktop e mobile con soli dati sintetici.
