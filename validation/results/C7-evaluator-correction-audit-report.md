# C7 Excel Validator Correction Audit

**Decisione: PASS**  
**Data audit:** 2026-10-02  
**Execution storica di riferimento:** `gate-c-corrective-20261002T223554140943Z-e3723564`

## Ambito e vincoli

È stata eseguita una correzione retrospettiva locale dei soli evaluator Excel C5/C6, seguita dalla rivalidazione degli output Gemini già raccolti. Non sono state effettuate chiamate remote o chiamate a modelli; non è stato inviato il corpus a modelli; non è stato tentato Groq. Non sono stati modificati i validator congelati in C5/C6, gli output o gli stati dell’execution storica, registry/profile status o Gate D. Non è stata assegnata alcuna eligibility.

I validator corretti e i risultati sono isolati nell’overlay append-only:
`~/Workspace/teacher-service-design/validation/work/C7/evaluator-audits/c7-excel-validator-correction-20261002/`

## Falso positivo e root cause

La replica storica `CORR-02/replicate-02` è rimasta registrata `QUALITY_FAIL`, con issue `SOURCE_CELL_ROLE_CONTRADICTION`. La frase del `generation-output.json` è:

> “Per il calcolo della Commissione, moltiplica il Netto per l Aliquota commissione memorizzata nella cella M4 (con etichetta 'Aliquota commissione' in M3, pari a 0.05 / 5%).”

La frase attribuisce correttamente l’etichetta ad M3 e il valore 0.05 / 5% ad M4. L’evaluator C5 congelato (`c5-excel-evidence-validator-1.0.0`) usava una regex di prossimità: `M4` seguito da una breve finestra contenente “etichetta/intestazione/label” e poi dal testo dell’etichetta. La finestra attraversava la parentesi “con etichetta … in M3” e interpretava erroneamente l’etichetta come associata a M4. Il validator C6 storico invocava il controllo C5.

Riferimenti storici immutati:
- Slot audit: `~/Workspace/teacher-service-design/validation/work/C7/executions/gate-c-corrective-20261002T223554140943Z-e3723564/artifacts/slot-audits/CORR-02-replicate-02.json`.
- Post-validazione: `~/Workspace/teacher-service-design/validation/work/C7/executions/gate-c-corrective-20261002T223554140943Z-e3723564/outputs/operational-attempts/CORR-02/replicate-02/deterministic-validations/generation-source-post-validation.json`.
- Output generato: `~/Workspace/teacher-service-design/validation/work/C7/executions/gate-c-corrective-20261002T223554140943Z-e3723564/outputs/operational-attempts/CORR-02/replicate-02/generation-output.json` (SHA-256 `58c3de2fe1fa0802568d48a2e008e56ed0567ba1be16a83f0cf57b4353b66415`).
- Evidenze che supportavano l’issue storico: `ev_bf5e8879c1bd9bc52d0ee1961c9a507a469ac327206d0b1746e6a29af6ddbd56` e `ev_d817bf6ebc51728a73decc6794e23fedea55b79287aa1f685c6116c8eaa19cde`.

## Correzione isolata e test

La correzione richiede una relazione grammaticale esplicita cella-label o cella-valore numerico invece di una finestra di caratteri. La regola numerica complementare segnala M3 solo quando il testo attribuisce esplicitamente a M3 il valore 0.05 / 5%. La logica di ranking non è stata modificata.

| Validator | Versione congelata / SHA-256 | Copia corretta nell’overlay / SHA-256 |
|---|---|---|
| C5 `ExcelHistoricalSectionValidator` | `c5-excel-evidence-validator-1.0.0` / `a82cd3288a0c778d38aa923a525cbc6197b062bf9511b1293867b8229bfb445f` | `~/Workspace/teacher-service-design/validation/work/C7/evaluator-audits/c7-excel-validator-correction-20261002/corrected_excel_validator.py`; `c5-excel-evidence-validator-1.0.1-retrospective` / `1f505fbc77859d80710b91a2f3f1865f284414c5a610830c56f197d96b505659` |
| C6 `ExcelGenerationArtifactValidator` | `c6-excel-generation-artifact-validator-1.0.0` / `63fb6aa2ef9c3f5c2bdd87a7c44235dc3ecea674e58f62a1c201be5f86c57965` | `~/Workspace/teacher-service-design/validation/work/C7/evaluator-audits/c7-excel-validator-correction-20261002/corrected_excel_generation_validator.py`; `c6-excel-generation-artifact-validator-1.0.1-retrospective` / `cb714bab62ae708648c4b4d0ebf769966d46cadc2e19996b0624ecfba2b4e304` |

La matrice avversariale ha **31/31 PASS**, sia direttamente su `ExcelHistoricalSectionValidator` sia tramite `ExcelGenerationArtifactValidator` dove applicabile:
- attribuzioni esplicite errate dell’etichetta a M4 e del valore numerico a M3 continuano a essere segnalate;
- mapping corretto M3=label/M4=value, parentesi, ordine invertito, coordinate nella stessa frase e varianti di punteggiatura passano;
- la frase CORR-02 R2 esatta passa con entrambi i validator corretti e falliva con quello congelato;
- il vero positivo storico C5 (“M4 contiene l’etichetta Aliquota commissione e il valore numerico 0,05”) continua a essere segnalato.

Fixture: `~/Workspace/teacher-service-design/validation/work/C7/evaluator-audits/c7-excel-validator-correction-20261002/fixture-results.json`.

Suite isolate rieseguite dopo l’ultima modifica al correttore:

| Suite | Risultato |
|---|---:|
| C5 full suite | PASS — 48/48 |
| C6 full suite | PASS — 81/81 |
| C7 locale dipendente dal validator | PASS — 22/22 |

I regressori ranking C5/C6 sono inclusi e passano; nessuna logica di ranking è stata cambiata. Il runner registra zero chiamate remote, zero tentativi di rete e zero violazioni del write guard. Log e riepilogo: `~/Workspace/teacher-service-design/validation/work/C7/evaluator-audits/c7-excel-validator-correction-20261002/regression-run5.log` e `regression-results.json` nello stesso overlay.

## Rivalidazione Gemini e riuso

Tutti gli otto campioni Gemini CORR-01–CORR-04 sono stati rivalidati localmente. Gli hash delle richieste visibili al modello, risposte grezze, artifact generati e provenienza fonti/evidenze sono registrati nel record sottostante: l’evaluator locale è l’unica componente cambiata.

| Slot | Stato storico immutato | Evidenza corretta / esito retrospettivo | Riutilizzabile |
|---|---|---|---|
| CORR-01 R1 | QUALITY_PASS | Excel evaluator non applicabile; risultato DBMS/SQL invariato | SÌ |
| CORR-01 R2 | QUALITY_PASS | Excel evaluator non applicabile; risultato DBMS/SQL invariato | SÌ |
| CORR-02 R1 | QUALITY_PASS | `PASS_UNAFFECTED`; zero hard issue corretti | SÌ |
| CORR-02 R2 | QUALITY_FAIL | `TECHNICAL_PASS_AFTER_EVALUATOR_CORRECTION`; frase esatta presente; zero hard issue corretti. Stato storico e reason originali restano invariati; reason retrospettiva `VALIDATOR_FALSE_POSITIVE`. Non è stato riscritto come QUALITY_PASS | SÌ |
| CORR-03 R1 | QUALITY_PASS | Excel evaluator non applicabile; risultato DBMS/SQL invariato | SÌ |
| CORR-03 R2 | QUALITY_PASS | Excel evaluator non applicabile; risultato DBMS/SQL invariato | SÌ |
| CORR-04 R1 | QUALITY_PASS | `CONTROL_FLOW_UNCHANGED`; 0 issue iniziali/finali, 0 repair call, stessa selezione finale delle sezioni; 6 chiamate backend storiche | SÌ |
| CORR-04 R2 | QUALITY_PASS | `CONTROL_FLOW_UNCHANGED`; 0 issue iniziali/finali, 0 repair call, stessa selezione finale delle sezioni; 6 chiamate backend storiche | SÌ |

La verifica longform CORR-04 conferma che il correttore non avrebbe richiesto repair o chiamate modello ulteriori né cambiato la selezione finale. Tutti i campioni Gemini completati sono riutilizzabili senza nuova inference.

Record dettagliato e hash: `~/Workspace/teacher-service-design/validation/work/C7/evaluator-audits/c7-excel-validator-correction-20261002/completed-sample-revalidation.json`.

## Ledger e campioni mancanti

Ledger machine-readable dei dodici slot: `~/Workspace/teacher-service-design/validation/work/C7/evaluator-audits/c7-excel-validator-correction-20261002/consolidated-evidence-ledger.json`. Contiene per slot execution originale, stato originale, disponibilità campione, applicabilità dell’evaluator corretto, esito, riusabilità e lavoro remoto residuo; non assegna eligibility.

Restano **4 campioni quality Groq mancanti**: CORR-05 R1/R2 e CORR-06 R1/R2. CORR-05 R1 è `ENVIRONMENT_BLOCKED`; gli altri tre slot sono `NOT_RUN_STOPPED` dopo il blocco di trasporto. Nessuna chiamata Groq è stata tentata durante questo audit.

## Preservazione storica e containment

Confronto con inventario baseline: **1.285/1.285 file** preservati, zero mancanti e zero differenze SHA-256. Lo scope include execution C7 storiche, script e test C7, C5/C6 e report preesistenti; il nuovo report target è escluso intenzionalmente. Esito `PASS`: `~/Workspace/teacher-service-design/validation/work/C7/evaluator-audits/c7-excel-validator-correction-20261002/preservation-check.json`.

Tutti i file creati o modificati dall’audit si trovano sotto `~/Workspace/teacher-service-design/`. Registry/profile status: 0 mutazioni. Gate D: 0 mutazioni. Execution, slot audit, manifest, report, pacchetto Domain Owner, generation output e stato storico `QUALITY_FAIL`: preservati.

## Decisione e prossimo passo

**PASS.** Il falso positivo CORR-02 R2 è corretto nell’overlay senza alterare il record storico; il true positive C5, l’inversione numerica M3 e i regressori ranking sono preservati. C5, C6 e C7 locale passano; i campioni Gemini completati sono riutilizzabili. Restano i quattro campioni quality Groq bloccati dal trasporto.

**Stato:** `READY_FOR_C7_GROQ_CONTINUATION_REVIEW`. Questo audit si ferma qui; non avvia Gate D né la continuazione Groq.
