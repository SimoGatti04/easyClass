# C7 — Rapporto di correzione del runner

**Data:** 2 ottobre 2026  
**Esito:** `PASS` — correzione locale e readiness review; nessuna nuova execution avviata.

## Ambito e interpretazione dell’esecuzione storica

L’execution `gate-c-corrective-20261002T165755866150Z-afe571f8` resta immutata e autorevole per lo stato `C7_EXECUTION_PARTIAL_RUNNER_FAILURE`:

- 12 quality replicate pianificate; 0 completate;
- 1 `RUNNER_FAILURE`; 0 `QUALITY_PASS`; 0 `QUALITY_FAIL`;
- 0 chiamate inference e 0 chiamate repair;
- replicate `CORR-01/1` non consumata;
- 1 bootstrap catalogo, che non è una chiamata inference.

Il blocco si è verificato prima di qualsiasi inference. Le tre cause locali confermate erano: `TypeError` dovuto alla firma del builder C6, collisione del percorso globale del report e assenza di `task_id` nelle righe di evidenza del report (`None replica`).

## Correzioni

1. **Interfaccia builder C6.** Il wrapper C7 invoca ora i builder con il contratto congelato C6 (`task`, `backend`, `fake_mode`, `artifact_dir`, `call_records`) e non inoltra `replicate`. C7 continua a legare la replicate al backend e a conservarla in slot identity, metadata e checkpoint. Le firme e i file C2–C6 non sono stati modificati.
2. **Report versionato per execution.** Ogni nuovo freeze determina e registra prima dell’esecuzione `validation/results/C7-<execution-id>-report.md`. Il freeze e il runner verificano che il percorso corrisponda all’ID e che non esista già; una collisione interrompe il flusso senza sovrascrivere report o creare l’execution. Non è stato aggiunto alcun puntatore `latest`.
3. **Metadata del report.** Ogni deterministic-evidence row include `task_id`; i titoli vengono costruiti con task e numero replicate reali.
4. **Smoke pre-esecuzione obbligatorio.** `--validate-only`/readiness, il nuovo freeze e l’avvio di una futura execution attraversano il medesimo contract smoke locale prima di credenziali o chiamate remote. Il smoke costruisce i 12 slot e invoca tramite `_build_live_scenario_builders` i quattro builder C6 reali; esegue gli adapter C4/C5 con backend fake locali, verifica binding backend/replicate, firme/payload, source binding DBMS/Excel, validator Excel e resolver longform Excel, nonché l’isolamento dei path di manifest e review. L’entrypoint transport è configurato nel test per fallire se chiamato. I risultati del fake sono esclusivamente evidenza di wiring e non qualità del modello.

## Verifiche e test

- C7 test suite: **21/21 PASS**, inclusi T1–T16 e i test preesistenti.
- Contract smoke: **PASS** per `scenarios.dbms_generation`, `scenarios.excel_generation`, `scenarios.dbms_longform`, `scenarios.excel_longform`; 12 slot costruibili; 0 network calls; 0 corpus calls.
- `--validate-only`: **PASS**, risultato `READY_FOR_C7_FREEZE`; preflight autorevole riutilizzato, credenziali non lette, 0 corpus calls.
- Task/replicate report regression: `CORR-01 replica 1` e `CORR-04 replica 2` presenti; nessun `None replica`.
- Runner failure semantics: invariata; un errore locale resta `RUNNER_FAILURE`, non consuma la replicate e arresta la progressione prevista.
- Freeze futuro: input map include l’hash SHA-256 aggiornato del runner C7; il test verifica il valore rispetto al file corretto.

## Immutabilità e hash

Il confronto SHA-256 prima/dopo copre tutti i **30 file** della execution storica e il report storico; fingerprint combinato invariato:

`73a734f85259af6c2ff134fb035477cfabd9d51b6066dde92510f1b06655f006`

Hash dei principali artifact storici, invariati:

| Artifact | SHA-256 |
|---|---|
| Report execution storico | `8abf62b73cb9e536296bdebf4fe2a88c5256ed2b89c3f09e9b3cbdbdeefc6cd1` |
| `execution-freeze.json` | `2b770d0a083a0a0c661518ae0bd1b7454710ce069ff1f931cb03060ffd42e334` |
| `run-state.json` | `df1a3a2e5cd0a3e2d8cf4ddc4d80113e72751b8b4d904ee92ddc983cd2fdd479` |
| `artifacts/MANIFEST.json` | `47fcc5e0abfc0ab97cd7285e529ec6acaae1981c5ac2f3397a6774a502e9f44c` |
| `metrics/quality-slots-current.json` | `5c4fe93bae636244eed41499d14215e79c36abad570f17eff272cc98cf96e3cb` |
| audit `CORR-01-replicate-01.json` | `9b5ef9b559caabcf3218e09d622408907171d4f0be8c13703b3d4f9f2e6fb664` |

Nessun file C2–C6 è stato modificato: confronto invariato di **573 file**, fingerprint:

`538ca8195ab864a7d5c88bd95a7baafb26bfdc97942f2657de2eba5072a1ad49`

Source-pin SHA-256 validati:

- `dbms_student_lesson.md`: `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`
- `excel_demo_b1.md`: `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414`
- `excel-workbook-ast-projection.json`: `e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed`
- `excel_demo.xlsx`: `fb8a07d2bfc17839bf8cb3aa9955b36e12c7f4cbb9dfab620d38e05e60bd42b7`

Runner corretto SHA-256: `d064e215b4d898eb8abc5e2ee06a9869371b65c5b880ec1f16e47a3efc3495dc`  
Test C7 SHA-256: `a26f2d14a9b9e9381772e287f0e709f377eaa1263d0670ad374a5c02427afe6a`

## Stato finale

**`READY_FOR_FRESH_C7_EXECUTION_REVIEW`**. Il runner è pronto per una review/autorizzazione separata per una fresh C7 execution. Questo task non ha creato un nuovo freeze e non ha avviato l’execution o le 12 quality replicates.

- Remote calls: **0**.
- Corpus calls: **0**.
- C2–C6, registry/profile status e Gate D: **nessuna modifica**.
