# C7 — Packet sintetico per decisione del Domain Owner

**Execution:** `gate-c-corrective-20261002T223554140943Z-e3723564`  
**Modello:** `agy/gemini-3.8-flash-tiered`  
**Natura:** review offline degli otto sample Gemini; nessuna nuova inferenza. Questo packet non è un sign-off e non assegna eligibility.

## Decisione richiesta

Esaminare le evidenze nel report `validation/results/C7-gemini-post-execution-review-report.md` e decidere separatamente per profilo. Le valutazioni e gli effort indicati sotto sono stime indipendenti dell'assistente; non sono precompilati come giudizi del Domain Owner.

| Profilo | Raccomandazione assistant | Scelta Domain Owner |
|---|---|---|
| `remote.generation` | **AMEND** — DBMS è promettente; i materiali Excel richiedono correzioni di presentazione/formula e va verificato il database operativo. | [ ] APPROVE &nbsp;&nbsp; [ ] AMEND &nbsp;&nbsp; [ ] REJECT |
| `remote.longform` | **AMEND; non approvare gli script correnti** — correggere gli errori SQL/di attribuzione e riscrivere i riferimenti Excel errati. | [ ] APPROVE &nbsp;&nbsp; [ ] AMEND &nbsp;&nbsp; [ ] REJECT |

## Campioni e questioni da decidere

| Sample | Stato storico | Evidenza/issue da considerare | Editing effort stimato dall'assistente | Effort Domain Owner |
|---|---|---|---|---|
| CORR-01 R1 — generation / DBMS | `QUALITY_PASS` | Piano e scheda coerenti; verificare la disponibilità del database pre-popolato assunto dal piano, non presente nel Source Set congelato. | `minor_edits` | __________________ |
| CORR-01 R2 — generation / DBMS | `QUALITY_PASS` | Come R1: buon allineamento semantico; prerequisito database da confermare. | `minor_edits` | __________________ |
| CORR-02 R1 — generation / Excel | `QUALITY_PASS` | Mapping M3/M4 corretto e aggregati coerenti; 96 `\n` letterali, 0 newline effettivi nel materiale e formule generiche non pronte all'uso. | `moderate_edits` | __________________ |
| CORR-02 R2 — generation / Excel | `QUALITY_FAIL` storico; `TECHNICAL_PASS_AFTER_EVALUATOR_CORRECTION` retrospettivo | Il falso positivo M3/M4 è corretto; resta il criterio `CONTA.SE` fra apici singoli, da correggere in doppi, e la struttura è monolitica. | `moderate_edits` | __________________ |
| CORR-03 R1 — longform / DBMS | `QUALITY_PASS` | Copione strutturato 3.486 parole/120'; `ROUND` descritto come troncamento; affermazione `SELECT *` troppo assoluta; database e scala `sconto_percento` da verificare. | `moderate_edits` | __________________ |
| CORR-03 R2 — longform / DBMS | `QUALITY_PASS` | Copione strutturato 3.920 parole/120'; `SELECT nome prezzo` presentato erroneamente come errore di parser (SQLite lo interpreta come alias); prerequisiti database/scala da verificare. | `moderate_edits` | __________________ |
| CORR-04 R1 — longform / Excel | `QUALITY_PASS` | Falsa attribuzione di PivotTable/dashboard; CERCA.X legge C4 quantità invece del codice in B4; aggregazioni usano colonne/range errati. | `major_rewrite` | __________________ |
| CORR-04 R2 — longform / Excel | `QUALITY_PASS` | Formule operative su righe/colonne errate (`D2*E2`, `F2*(1-G2)`, `H2*M4`) e aggregati su range non corretti. | `major_rewrite` | __________________ |

Gli artifact esatti, gli hash, i locator per claim e le fonti sono nel ledger `validation/work/C7/reviews/gemini-post-execution/claim-ledger.json` e nel report di review. I punteggi dell'assistente non sono giudizi umani. Nessuna critica deriva dalla sola mancanza di corrispondenza letterale alle fonti.

## Valutazione separata dei criteri

- **D4 storico:** nessun profilo supera l'evidence set. In generation il pair Excel supera il limite `minor_edits` e R2 contiene un difetto di formula. In longform ci sono errori fattuali/source-specific confermati e effort superiore al limite. `SOURCE_FACT >=95%` resta `NOT_EVALUATED`: le 41 righe del ledger sono campioni rappresentativi, non il denominatore completo. Non inventare una percentuale.
- **Dossier 04 §47 (prodotto):** le parafrasi e le proposte originali corrette sono lecite; i dettagli presentati come specifici del workbook devono invece corrispondere all'AST. I sample DBMS generation sono positivi con prerequisito da verificare; generation Excel richiede amendment; longform Excel non è utilizzabile senza riscrittura.
- **Dossier 05 §57 (assessment):** non valutato direttamente; non sono presenti Assessment Items/Blueprint né un Assessable Source Set pubblicato. Gli output non sono prova di pubblicazione o di copertura valutabile.

## Deliberazione e sign-off — da compilare dal Domain Owner

**Decisione finale `remote.generation`:** __________________________________________  
**Decisione finale `remote.longform`:** ____________________________________________  

**Editing effort umano complessivo (per profilo o sample):** _________________________  
**Fatti/claim che richiedono correzione o conferma:** ________________________________  
**Remediation richiesta / condizioni:** _____________________________________________  

**Domain Owner:** __________________________  **Data:** __________________________  
**Sign-off:** ___________________________________________________________________

Le caselle e i campi sopra restano intenzionalmente non selezionati/vuoti. Fino a decisione autorizzata e completamento dei prerequisiti, nessuna eligibility o modifica del registry è proposta; Gate D resta `BLOCKED`.
