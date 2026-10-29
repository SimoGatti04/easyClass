# UX2-R2-F — Final Candidate Acceptance

**Data:** 29 ottobre 2026 (Europe/Rome)
**Ruolo:** Integration / Release QA Engineer
**Esito:** **HOLD — candidata non avviabile**
**Produzione:** invariata. Nessun push Git/GHCR, merge, deploy, modifica K3s/Cloudflare, snapshot/restore produttivo.

## 1. Identità dell'immagine — CONFORME

| Campo | Atteso | Rilevato | Esito |
|---|---|---|---|
| Tag | `teacher-service:ux2-r2-5205441-exact` | idem | OK |
| Image ID | `sha256:6c5594285bab…060d5280` | `sha256:6c5594285babfd36d8c859fbe0b069280b6cbe46956d40f67f87a1ba060d5280` | OK |
| Piattaforma | `linux/amd64` | `amd64/linux` | OK |
| OCI revision | `5205441eb30ddb8a332e9f90a647549a4ea24026` | idem | OK |
| OCI version | `ux2-r2-5205441` | idem | OK |

L'identità dichiarata corrisponde. La discrepanza non è di identità ma di contenuto funzionale.

## 2. Avvio nel container reale — FALLITO

Il container è stato avviato direttamente dall'immagine candidata, con storage temporaneo in `tmpfs`, porta pubblicata solo su loopback e principal sintetico configurato:

```
docker run -d --name ux2r2f-evidence --read-only \
  --tmpfs /app/storage:rw,size=256m --tmpfs /tmp:rw,size=64m \
  -p 127.0.0.1:18890:80 \
  -e TEACHER_SERVICE_TEACHER_EMAILS=ux2r2f-teacher@example.test \
  teacher-service:ux2-r2-5205441-exact
```

- Container: `2d50dcd891e7`
- Exit code: **1**, immediato
- `/health`: **nessuna connessione** (porta mai in ascolto)
- Log:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/src/storage/filestore.js'
  imported from /app/src/services/teacher-service.js
```

Ispezione read-only dell'immagine:

```
src/storage=absent
src_js_files=28
```

Nessun servizio è stato sostituito o avviato fuori dal container: i controlli positivi **non sono stati eseguiti** perché non esiste un endpoint da interrogare. L'harness `.impeccable/ux2-r2-f/container-acceptance.mjs` è pronto ma **non eseguito**: dichiarare un PASS avrebbe richiesto un servizio diverso dalla candidata.

## 3. Causa radice — difetto di confezionamento, non di logica

1. `.gitignore` contiene il pattern non ancorato `storage/`, che intercetta anche `src/storage/`.
2. `src/storage/filestore.js` e `src/storage/store-snapshot.js` **non sono tracciati**: `git ls-files src/storage` restituisce 0 file, `git check-ignore` conferma `.gitignore:6:storage/`.
3. Il commit `5205441` contiene 28 file JS sotto `src`, nessuno in `src/storage`.
4. `.dockerignore` contiene `storage`, coerente con l'esclusione della directory.
5. L'immagine `-exact` contiene esattamente quei 28 file: è stata costruita da un contesto derivato dal solo contenuto tracciato, perdendo i due moduli.

Confronto diagnostico (non candidata, nessun test funzionale):

| Tag | Image ID | `src/storage` | file JS |
|---|---|---|---|
| `ux2-r2-5205441` | `596857d94021` | presente | 30 |
| `ux2-r2-5205441-exact` | `6c5594285bab` | **assente** | 28 |

Impatto: 47 import relativi non risolvibili nel commit, tutti riconducibili ai soli due file non tracciati. Un clone pulito o una pipeline CI non possono produrre un'immagine avviabile; le 38 suite locali passano solo grazie ai file presenti nel working tree di questa macchina.

Nota di coerenza: uno smoke test 10/10 non è compatibile con questa immagine, che non apre mai la porta. Va riconciliato con l'evidenza UX2-R2 (probabile esecuzione contro il tag sibling o un processo Node dal checkout).

## 4. Verifica del backup storico — PASS

`<backup-host>:/srv/backup/teacher-service/pre-r3-cutover/`, sola lettura, manifest v1 confrontato con i file:

- 6/6 file presenti, 0 mancanti, 0 inattesi
- 0 mismatch di dimensione, 0 mismatch di SHA-256
- `database.sqlite`: byte e SHA-256 conformi al manifest
- SQLite `PRAGMA integrity_check` = `ok`, 28 tabelle, `material_publication_events` presente
- Nessuna scrittura effettuata; nessun nome file, contenuto, credenziale o dato studente riportato

Il backup resta valido ma **non sostituisce** il nuovo snapshot pre-UX2 da eseguire durante la manutenzione autorizzata.

## 5. Blocchi

1. **BLOCCANTE:** la candidata non si avvia; nessun controllo UX2 può essere eseguito su di essa.
2. **BLOCCANTE:** `src/storage/` non è versionato; il difetto si ripresenterà a ogni build da contesto pulito.
3. **Discrepanza documentale:** l'evidenza smoke 10/10 non è attribuibile a questa immagine.

## 6. Verdetto

**HOLD** — non idonea alla pubblicazione su GHCR.

Per sbloccare servono, in un intervento separato e autorizzato: versionare `src/storage/` (o spostarla in un percorso non ignorato), ancorare i pattern di `.gitignore`/`.dockerignore`, ricostruire una **nuova** candidata con identità distinta e rieseguire l'accettazione container. Nessuna di queste azioni è stata eseguita in questa fase.
