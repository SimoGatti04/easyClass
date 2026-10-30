# UX2-R4-S2 — Audit contenuti pubblicabili e accettazione OCI sanificata

**Ruolo:** Security / Release Engineer
**Data:** 2026-10-30
**Stato di partenza:** UX2-R4-S `HOLD`
**Esito:** `HOLD` — un solo bloccante residuo (§5), nessun blocco tecnico.

---

## 1. Perimetro e metodo

| Elemento | Valore |
|---|---|
| Repository originale | `~/Workspace/teacher-service-design` |
| HEAD originale | `4e8b3513d0eb8338893374d4e199793f5c06dc81` (invariato, albero pulito) |
| Clone sanitizzato | `/private/tmp/easyclass-public-sanitized` |
| Commit iniziale del clone | `6494c277e21d9cf49d2167001792f346f3d476c2` (integro, pulito, 0 remote) |
| Commit pubblicabile finale | `1b0ed8fd8b855586dd6f2fb995f34514213110f4` |
| Cronologia | 40 commit, nessun tag, singolo ref `refs/heads/codex/teacher-service-c6` |
| Commit di evidenza | `HEAD` (solo documentazione; l'immagine resta riferita a `1b0ed8f`) |

Audit eseguito sull'**intera cronologia raggiungibile**, non solo sull'ultimo commit: 38 commit,
425 file tracciati, 442 percorsi distinti, 697 blob (27,6 MB) materializzati e analizzati come
testo, binario e metadati. Dopo la riscrittura: 397 percorsi, 984 blob, 380 file e 10,9 MB
nell'albero corrente.

Ambiti disgiunti (documentazione, `validation/`, log e `.impeccable/`, fixture e codice, binari e
metadati) analizzati con scansione a pattern, analisi di sovrapposizione testuale a 8-grammi e
estrazione dei metadati (PDF Info/XMP, DOCX/XLSX core properties, chunk PNG/JPEG). Un solo
responsabile ha eseguito la riscrittura Git, in tre passaggi sequenziali, per evitare modifiche
concorrenti alla stessa storia.

## 2. Esito dell'audit semantico

| Classe | Rilievi | Azione |
|---|---|---|
| `EXCLUDE` | 47 file in 7 categorie | rimossi da tutti i commit |
| `REDACT` | 50 file, 11 classi di dato | sostituzione su tutti i commit |
| `REDACT` (documento) | 2 documenti riscritti integralmente | contenuto anonimizzato su tutti i commit |
| `REVIEW REQUIRED` | 1 (metadati autore/committer) | **aperto**, richiede autorizzazione (§5) |
| `SAFE` | resto dell'albero | conservato |

### 2.1 Dati esclusi

| Categoria | File | Motivazione |
|---|---|---|
| Corpus didattico reale (PDF/DOCX/XLSX) | 8 | materiale didattico reale di terzi |
| Conversioni testuali integrali | 8 | riproducono il testo delle lezioni |
| Chunk store derivato | 3 | testo delle lezioni a chunk (41,5% di sovrapposizione verbatim) |
| Gold set e annotazioni umane | 6 | contengono estratti verbatim e giudizi sul materiale reale |
| Artifact di gate con estratti | 5 | incorporano porzioni di corpus |
| Copia duplicata `validation/validation/` | 16 | duplicato storico degli stessi dati |
| Cache Python e config PM2 ritirata | 1 | percorsi locali; runtime dismesso |

La soglia di esclusione è stata verificata quantitativamente: i file derivati mostravano
sovrapposizione verbatim con il corpus reale tra il 15% e il 41%, contro lo 0,0–0,2% dei report
aggregati, che sono stati quindi conservati.

### 2.2 Dati redatti

Indirizzo e-mail personale, principal di anteprima, nome nel mock di autenticazione, dominio
scolastico, acronimo dell'istituto, IP LAN e IP dell'overlay privato, alias del server di backup,
percorso home assoluto, roster illustrativo e nomi dei file originali della libreria privata.
Valori di sostituzione e motivazioni: [`PUBLICATION.md`](../../PUBLICATION.md).

### 2.3 Dati conservati deliberatamente

Endpoint pubblici di produzione e issuer OIDC (URL pubblici, nessuna credenziale), IP interni K3s
(RFC 1918, effimeri), hash di integrità, report aggregati del gate, screenshot UI con dati
sintetici, nome dell'autore nei documenti di progetto.

### 2.4 Segreti

Nessuna chiave privata, JWT, chiave cloud, token GitHub/Slack/OpenAI, credenziale di service
account o valore runtime nella cronologia. `.env.example` contiene solo chiavi vuote. Le uniche
occorrenze della stringa `PRIVATE KEY` nell'immagine sono nel parser PEM della libreria `jose`.

## 3. Identità e metadati dei commit

| Voce | Valore |
|---|---|
| Commit con metadati personali | 36 su 38 originari |
| Commit con identità di sanitizzazione | 2 originari + 2 nuovi (`noreply@easyclass.local`) |
| Indirizzi GitHub noreply verificati disponibili | no |
| Riscrittura eseguita | **no** (richiede autorizzazione del Domain Owner) |

Mappatura proposta: indirizzo personale → indirizzo noreply dell'account proprietario **solo se
verificato sul profilo GitHub**; nessuna attribuzione di contributi altrui a un unico account.
Nessun indirizzo inventato.

## 4. Correzioni applicate

1. Esclusione dei 47 file da tutti i commit (`git filter-branch --tree-filter`).
2. Redazione delle 11 classi di dato su tutti i commit, inclusi i bundle JavaScript minificati.
3. Riscrittura di `validation/corpus/SOURCES.md` e `docs/validation/01-benchmark-corpus.md` in
   versione anonimizzata che dichiara il withholding.
4. Nuovo `PUBLICATION.md` con mappa completa di esclusioni, redazioni e dati conservati.
5. `validation/scripts/verify_bundle.py` distingue ora `DATA WITHHELD` da un errore di integrità.
6. `validation/BUNDLE_MANIFEST.json` rigenerato sui 175 file pubblici, con sezione `withheld`.
7. Bundle client ricostruito dai sorgenti redatti; 0 occorrenze dei pattern redatti in
   `client/dist`.
8. Script riproducibile di verifica: `.impeccable/ux2-r4-s2/verify-public-sanitization.sh`.

## 5. Secondo audit e integrità

| Controllo | Esito |
|---|---|
| Pattern redatti su tutti i commit | 0 occorrenze (9 pattern) |
| Percorsi esclusi raggiungibili | 0 |
| Bytecode `.pyc` nella cronologia | 0 |
| `git fsck --full --strict` | pulito |
| `git count-objects -v` | 0 loose, 0 garbage |
| Ref e tag | 1 branch, 0 tag, `refs/original` rimosso |
| Reflog | espirato |
| Remote configurati | 0 |
| Repository originale | invariato a `4e8b351`, albero pulito |

**Bloccante residuo:** i metadati di 36 commit espongono ancora l'indirizzo personale. La
pubblicazione della cronologia resta `HOLD` finché il Domain Owner non conferma la policy e non
fornisce un indirizzo noreply verificato.

## 6. Verifica del nuovo commit pubblicabile

- Worktree dedicato e pulito creato dal commit `1b0ed8f`.
- **Equivalenza del codice applicativo** rispetto al candidato UX2-R3 (`40791eb`): su 115 file tra
  `src/`, `tests/`, `client/src/`, `bin/` e manifest, 99 sono identici byte per byte e 16
  differiscono solo per le sostituzioni dichiarate. `40791eb → 4e8b351` tocca esclusivamente
  documentazione ed evidenze: nessuna funzione applicativa è cambiata.
- **Test:** `pnpm test` → **39/39 suite verdi, 0 fallite**. `tests/server/application-routing.test.js`
  richiede Chromium e viene eseguito fuori sandbox (verde anche dopo la ricostruzione del bundle).
- Source closure, test di pubblicazione API e fixture sintetiche: verdi all'interno della suite.
- `python3 validation/scripts/verify_bundle.py` → `VALIDATION_BUNDLE: DATA WITHHELD (public mirror)`.

## 7. Immagine OCI finale

| Voce | Valore |
|---|---|
| Tag | `teacher-service:ux2-r4-s2-public-A` |
| Image ID | `sha256:ac2919fc1a6980f9a9b2e45e7bc6f560eb18736b2c67b76df6d4e0bd2471eff3` |
| Piattaforma | `linux/amd64` |
| Dimensione | 715 479 155 byte |
| Creato | `2026-10-30T10:38:01Z` (= `SOURCE_DATE_EPOCH` 1793356681) |
| Revision | `1b0ed8fd8b855586dd6f2fb995f34514213110f4` |
| Layer | 14 |
| Utente runtime | `uid=1000(node)` |

Riproducibilità: due build indipendenti (la seconda `--no-cache`) producono lo stesso digest di
configurazione (`6488829…`) e lo stesso hash dell'albero applicativo (`c1289b6…`); gli Image ID
differiscono solo per i metadati dei pacchetti di sistema, come già osservato in UX2-R3.

Base `node:22.23.2-bookworm-slim` fissata per digest nel `Dockerfile`, lockfile congelato,
`SOURCE_DATE_EPOCH` e etichette OCI pilotate da build-arg. L'immagine contiene solo `src/`,
`bin/`, `client/dist` e dipendenze di produzione: `validation/` è assente e la scansione interna
riporta 0 occorrenze di dati personali, dominio scolastico, acronimo, roster e percorsi home.

## 8. Accettazione nel container reale

Container `ux2r4s2-accept`, avviato dall'immagine candidata con `--read-only`, storage temporaneo
`tmpfs` (`mode=1777`), porta solo loopback e principal sintetici. Nessun server Node avviato dal
checkout: tutte le chiamate sono HTTP verso il container.

**16 controlli su 16 superati**, inclusi accesso docente autorizzato, rifiuto del principal
autenticato ma non autorizzato, v1 non pubblicata, pubblicazione, disponibilità pubblica, lettura
e download del contenuto corretto, ritiro, indisponibilità successiva, assenza di esposizione di
Teacher Material e soluzioni riservate, protezione CSRF su pubblicazione e ritiro, idempotenza del
ritiro. Log: `acceptance-run.log`.

Hardening di produzione (`NODE_ENV=production`, auth strict): `/health` 200, deep link SPA 200,
header sintetico 403 su `/auth/me` e `/api/materials`. Il 500 su una POST mutativa non
autenticata è il percorso fail-closed documentato quando `CF_ACCESS_AUD` non è configurato.
Dettaglio: `production-hardening.txt`.

## 9. Problemi residui

1. **Metadati dei commit** — indirizzo personale su 36 commit: richiede autorizzazione (§5).
2. **Riferimenti storici** — i report in `validation/results/` citano file ora non pubblicati; la
   condizione è dichiarata in `validation/README.md`, `validation/corpus/SOURCES.md` e
   `PUBLICATION.md`, senza riscrivere le evidenze storiche.
3. **Screenshot UI** — i PNG in `.impeccable/` non contengono metadati testuali; il contenuto
   pixel non è verificabile con strumenti testuali e resta classificato `SAFE` per origine
   sintetica dichiarata nei report.
4. **Dipendenze di test** — la suite completa richiede Chromium (Playwright) per una suite; in
   sandbox quella suite va eseguita con accesso al browser.
5. **Backup storico** — non rieseguito in questa fase; il backup storico non sostituisce il nuovo
   snapshot pre-UX2 da eseguire nella futura manutenzione autorizzata.

## 10. Divieti rispettati

Nessun push Git o GHCR, nessun merge, nessuna modifica K3s o Cloudflare, nessuno snapshot o
restore produttivo, nessuno scale-down, nessun deployment, nessuna modifica al codice applicativo
oltre alle redazioni dichiarate, nessun accesso ai PVC produttivi. Repository originale non
modificato.

## 11. Verdetto

**HOLD** — la candidata è tecnicamente pronta (`content-final`), ma la pubblicazione resta
subordinata a una sola decisione del Domain Owner: autorizzare la riscrittura dei metadati dei
commit verso un indirizzo GitHub noreply **verificato**.

Alla conferma, il percorso di chiusura è già predisposto: riesecuzione dello script di
sanitizzazione con la sola mappatura e-mail, `git fsck`, nuova build con `revision` aggiornata,
riaccettazione nel container e passaggio a `READY FOR PUBLICATION`.
