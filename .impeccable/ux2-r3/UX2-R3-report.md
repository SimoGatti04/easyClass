# UX2-R3 — Source Closure, Reproducible OCI Build & Functional Acceptance

**Data:** 30 ottobre 2026 (Europe/Rome)
**Ruolo:** Release Engineer / Build & Integration QA
**Branch:** `codex/teacher-service-c6`
**Esito:** **READY FOR GHCR PUBLICATION APPROVAL**
**Produzione:** invariata. Nessun push Git/GHCR, merge, deploy, modifica K3s/Cloudflare o accesso ai PVC.

## 1. Causa del difetto (confermata)

`.gitignore` conteneva il pattern non ancorato `storage/`, che in Git esclude qualsiasi directory con quel nome a qualunque profondità, compresa `src/storage/`. `.dockerignore` conteneva la stessa voce. Conseguenza:

- `git ls-files src/storage` → 0 file; `git check-ignore -v` → `.gitignore:6:storage/` per entrambi i moduli;
- il commit `5205441` conteneva 28 file JS sotto `src`, nessuno in `src/storage`;
- l'immagine `-exact` ne replicava esattamente 28 e non si avviava.

Nessun altro modulo era mancante: su 111 file JS dell'albero di lavoro gli import relativi non risolti erano 47, tutti e soli verso `src/storage/filestore.js` e `src/storage/store-snapshot.js`. Dopo la correzione: 0 non risolti.

## 2. Correzione applicata

Commit `cdbc421` — `fix(build): version storage modules and anchor ignore patterns`:

- `.gitignore`: `/storage/` e `/.tmp/` (ancorati alla radice) al posto dei pattern liberi;
- `.dockerignore`: `/storage` e `/.tmp` ancorati;
- aggiunti al versionamento `src/storage/filestore.js` (226 righe) e `src/storage/store-snapshot.js` (251 righe);
- nuovo `tests/unit/source-closure.test.js`, registrato in `tests/run-all.js`.

Commit `40791eb` — `build(oci): pin base image digest and drive OCI metadata from build args`.

### Esame preventivo dei moduli aggiunti

| Aspetto | Esito |
|---|---|
| Provenienza | `FileStore` e la CLI snapshot sono referenziati dal commit baseline `96ca882`; i file esistevano solo nel working tree, mai versionati |
| Contenuto | Store filesystem (hash, allegati, preparazione file) e snapshot/verify/restore del pair SQLite+FileStore |
| Dipendenze | Solo moduli Node builtin: `fs`, `path`, `crypto`, `node:sqlite` |
| Segreti / dati ambientali | Nessuno. Unico riferimento: nome della variabile `TEACHER_SERVICE_STORAGE_DIR`, senza valori |
| Altri moduli non versionati | Nessuno: unica voce ignorata con sorgenti era `src/storage/` |

Il test di regressione copre tre punti: import relativi risolvibili, presenza dei moduli di storage, e assenza di file sorgente esclusi da Git (quest'ultimo è il controllo che avrebbe intercettato il difetto).

## 3. Build canonico

```bash
git worktree add --detach /tmp/ux2r3-clean <COMMIT>
cd /tmp/ux2r3-clean
docker build \
  --platform linux/amd64 \
  --build-arg SOURCE_DATE_EPOCH=$(git show -s --format=%ct) \
  --build-arg BUILD_REVISION=$(git rev-parse HEAD) \
  --build-arg BUILD_VERSION=ux2-r3-$(git rev-parse --short HEAD) \
  --build-arg BUILD_CREATED=$(git show -s --format=%cI) \
  --build-arg BUILD_SOURCE=teacher-service-design \
  -t teacher-service:ux2-r3-$(git rev-parse --short HEAD) .
```

- Base fissata per digest: `node:22.23.2-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9`.
- `SOURCE_DATE_EPOCH` pilotato dalla data del commit; etichette OCI `revision`, `version`, `created`, `source`, `title` passate come build args.
- Build eseguito da due worktree detached indipendenti dello stesso commit `40791eb`, senza file non tracciati.

## 4. Riproducibilità — misurata

| Proprietà | A | B |
|---|---|---|
| Image ID | `sha256:a2e321b05a87…cf69c5d78` | `sha256:7c9fea6bab69…f2f04b3e4` |
| Config digest (senza created) | `f81d98cf1b06…685625c` | identico |
| OCI labels | revision `40791ebb4bd4…`, version `ux2-r3-40791eb` | identici |
| Albero applicativo `/app/src` + `/app/bin` | `301f54c85f7e…dc9144b2` | identico |
| Layer | 14 | 14 |

Conclusione onesta: **riproducibile per contenuto e configurazione, non bit-identica**. I primi 5 layer (base) coincidono; la divergenza nasce dal layer `pnpm install`, che incorpora metadati e timestamp del package manager, e si propaga ai layer successivi. `apt-get` contribuisce allo stesso effetto. Non è stato introdotto un toolchain di normalizzazione (né snapshot apt né store pnpm sigillato): sarebbe un cambiamento infrastrutturale separato, non una correzione del difetto.

Nota: su host arm64 la build amd64 gira in emulazione; l'architettura dichiarata e verificata resta `linux/amd64`.

## 5. Accettazione nel container reale

Container `faf245be1e9a…`, immagine `sha256:a2e321b05a87…`, avviato dall'immagine candidata con `--read-only`, storage temporaneo `tmpfs` (mode 1777), porta solo loopback, principal sintetici. Nessun server Node avviato dal checkout.

15 controlli superati:

| # | Verifica | Esito |
|---|---|---|
| 0 | `/health` sul container | 200 ok |
| 1 | Principal docente sintetico autorizzato | 200, `teacherAuthorized=true` |
| 2 | Principal autenticato non docente | `/api/materials` 403 |
| 3 | Materiale v1 non pubblicato | `never_published`, non elencato |
| 4 | `POST /publication` docente | 201, `available` |
| 5 | `GET` pubblico studente | 200, v1 elencata |
| 6 | Lettura e download | 200, contenuto identico byte per byte |
| 6b | Nessuna soluzione riservata nel payload | confermato |
| 7 | `DELETE /publication` docente | 200, `withdrawn` |
| 8 | Indisponibilità pubblica successiva | lettura e download 404, non elencata |
| 9 | Teacher Material nascosto | 404, publish 400, mai elencato |
| 10a | CSRF su pubblicazione senza Origin | 403, stato invariato |
| 10b | CSRF su ritiro senza Origin | 403, stato invariato |
| 10c | Ritiro ripetuto | 200 `already_withdrawn`, nessun nuovo evento |
| 2b | Non docente che tenta la pubblicazione | 403 |

Difetto dell'harness corretto in fase: due controlli usavano campi `snake_case` inesistenti nella risposta studente (`resource_id`, `version_number`); con i campi reali (`id`, `versionNumber`) i controlli 3, 5, 8 e 9 sono ora significativi. La versione storica in `.impeccable/ux2-r2-f/` resta invariata come evidenza.

### Hardening di produzione (stessa immagine, `NODE_ENV=production`)

| Richiesta | Esito |
|---|---|
| `/health`, SPA `/` | 200 |
| `/api/materials` anonimo | 401 |
| Header sintetico in produzione | 403 |
| `/api/student/classes` | 200 |
| Senza `TEACHER_SERVICE_WEB_CF_ACCESS_AUD` | 500 fail-closed con messaggio di misconfigurazione esplicito |

Bucket di avvio: l'immagine gira come utente `node` (uid 1000). Un volume montato su `/app/storage` deve essere scrivibile da quell'utente; con un `tmpfs` root-owned il servizio esce con `EACCES` su `/app/storage/db`. Da tenere presente per il PVC in un eventuale futuro deploy.

## 6. Verifiche locali

| Comando | Esito |
|---|---|
| `pnpm test` | **39 suite passate, 0 fallite** (38 + source closure) |
| `node --test tests/unit/source-closure.test.js` | 4 passati |
| Build A e build B da worktree puliti | entrambe riuscite |
| Avvio B | `/health` 200, `/api/auth/me` 200 |

`pnpm-lock.yaml` non è stato modificato.

## 7. Backup storico

Non ripetuto: la verifica integrale del backup C7B-G1 è stata eseguita e documentata in UX2-R2-F (6/6 file, hash e byte conformi, integrità SQLite `ok`) e il brief non ne richiede la ripetizione. Resta valido l'obbligo del nuovo snapshot pre-UX2 in manutenzione autorizzata.

## 8. Limitazioni residue

1. Immagine non bit-identica tra build: differenze nei layer di installazione.
2. Build verificata in emulazione amd64 su host arm64, non su hardware amd64 nativo.
3. Autenticazione reale Cloudflare Access non esercitata: usati principal sintetici e, in produzione, la verifica fail-closed.
4. L'immagine non è pubblicata; nessun digest GHCR esiste.

## 9. Verdetto

**READY FOR GHCR PUBLICATION APPROVAL.** La candidata `teacher-service:ux2-r3-40791eb` è ricostruibile da Git pulito, si avvia, supera l'accettazione funzionale docente→studente nel container e mantiene l'hardening di produzione. La pubblicazione resta soggetta ad autorizzazione separata.
