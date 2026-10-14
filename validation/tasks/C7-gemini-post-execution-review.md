# C7 — Gemini post-execution review (offline, no nuova inferenza)

**Stato:** READY_FOR_REVIEW — task da eseguire, non report di completamento.  
**Ruolo:** Model Evaluation Engineer / independent Assistant Reviewer.  
**Scopo:** chiudere la valutazione qualitativa indipendente degli 8 sample Gemini correttivi, senza ritentare Groq e senza modificare risultati storici.

## Baseline obbligatoria

- Decisione più recente: `validation/results/C7-groq-capability-operational-decision.md` (2026-10-06).
- Correzione evaluator: `validation/results/C7-evaluator-correction-audit-report.md`.
- Contratto D4: `validation/results/Gate-C-v2-correction-plan.md`, §§ 17–18.
- Ruoli didattici: `docs/dossiers/04-knowledge-materials.md`, §46.
- Assessment grounding: `docs/dossiers/05-assessment-system.md`, §56.
- Regole comuni e scoring: `validation/shared/COMMON_RULES.md` e `validation/shared/SCORING.md`.
- Norme development-environment: `AGENTS.md` e documenti applicabili.

## Campioni in sola lettura

Radice: `validation/work/C7/executions/gate-c-corrective-20261002T223554140943Z-e3723564/`

| Slot | Profilo | Scenario | Artifact |
|---|---|---|---|
| CORR-01 R1/R2 | remote.generation | DBMS/SQL | `outputs/operational-attempts/CORR-01/replicate-0{1,2}/generation-output.json` |
| CORR-02 R1/R2 | remote.generation | Excel | `outputs/operational-attempts/CORR-02/replicate-0{1,2}/generation-output.json` |
| CORR-03 R1/R2 | remote.longform | DBMS/SQL | `outputs/operational-attempts/CORR-03/replicate-0{1,2}/teacher-script.final.md` |
| CORR-04 R1/R2 | remote.longform | Excel | `outputs/operational-attempts/CORR-04/replicate-0{1,2}/teacher-script.final.md` |

Le versioni di sorgenti, evidence pack, request e trace devono essere individuate dagli artifact/manifest di *questa stessa execution*. Non sostituire una versione o inferire citazioni inesistenti. L'overlay `validation/work/C7/evaluator-audits/c7-excel-validator-correction-20261002/` fornisce il ledger corretto. Conservare l'esito storico CORR-02 R2 `QUALITY_FAIL`; riportare separatamente `TECHNICAL_PASS_AFTER_EVALUATOR_CORRECTION`.

## Metodo e criteri

1. Verificare identità, hash/manifest, stato tecnico e riusabilità di ogni sample; distinguere affermazioni misurate da quanto non verificato.
2. Valutare **separatamente per replica e profilo**: fedeltà ai fatti source-specific, correttezza, completezza semantica, utilità didattica, aderenza al livello, sostenibilità della durata, struttura, ridondanza e teacher editing effort.
3. Per `SOURCE_FACT` costruire un **ledger esplicito e denominatore verificabile**: claim, posizione output, evidenza/versione fonte, classe epistemica, esito SUPPORTED/UNSUPPORTED/NOT_VERIFIABLE, motivo. Non stimare `SOURCE_FACT >=95%` dai soli tag o dall'assenza di alert automatici. Separare `SOURCE_DERIVED`, `GENERAL_DOMAIN_KNOWLEDGE`, `PEDAGOGICAL_PROPOSAL`.
4. Controllare i hard failures: contraddizione diretta della fonte, falsa attribuzione, riferimenti/celle inesistenti, dati numerici sbagliati, omissioni che rendono il deliverable inutilizzabile. Il corretto mapping Excel M3=etichetta e M4=0.05 deve essere giudicato secondo il validator corretto, non la regex storica.
5. Valutare la **distinzione Teacher/Student/Support** e il livello di modifiche che il docente dovrebbe fare per usare gli artefatti. Nessuno dei campioni è automaticamente Student Material **pubblicato**, e nessuno prova un Assessable Source Set o un Assessment grounded. Non inventare uno stato di pubblicazione.
6. **Due giudizi esplicitamente separati.** Per confrontabilità storica, applicare D4 congelato su entrambe le repliche: `SOURCE_FACT >=95%`, zero hard failures reali, Semantic Completeness PASS, nessun troncamento, editing effort massimo `minor_edits` (denominatore mancante = `NOT_EVALUATED`). **In parallelo** valutare il contratto di prodotto Dossier 04 §47 / Dossier 05 §57: fedeltà semantica, conoscenza generale corretta, esempi originali leciti, copertura didattica e sforzo docente. Non penalizzare parafrasi per assenza di overlap testuale, né generalizzare controlli specialistici di coordinate. Non riscrivere stati storici o confondere il giudizio D4 con la suitability per il prodotto.
7. Redigere giudizio Assistant indipendente e pacchetto decisionale compatto per il Domain Owner, distinguendo `APPROVE / AMEND / REJECT` come scelte **da sottoporgli**, non compilate da agenti. Non simulare il suo sign-off.
8. Se una route non soddisfa D4, riportare un blocker circoscritto e il minimo intervento corretto; non riavviare cicli di nuovi modelli per inerzia.

## Containment

- Lettura: corpus/manifest/evidence/output in sola lettura.
- Scrittura solo dentro `teacher-service-design/validation/results/` per report e, se servono ledger machine-readable, `validation/work/C7/reviews/gemini-post-execution/`.
- Non modificare risultati storici, runner C2–C7, gold, evaluator, registry, profile eligibility o Gate D.
- **Zero chiamate remote**: il task è una review offline, non un nuovo benchmark.
- Il caso Excel resta **regressione per adapter**, non architettura guida: la logica didattica usa ruoli/versioni, non estensioni di file. La precisione di celle e dati è necessaria quando l'output pretende di descrivere un workbook reale; non va richiesta a una spiegazione generale senza tale pretesa.

## Deliverable

- Report autonomo `validation/results/C7-gemini-post-execution-review-report.md` con score per slot, claim ledger, decisione per profilo ed evidence references.
- Packet sintetico per decisione Domain Owner con campioni e issue residue, **senza** decisione compilata al suo posto.
- Readiness finale: `READY_FOR_DOMAIN_OWNER_SIGNOFF` solo se tutti i prerequisiti di review sono dimostrati; altrimenti `REVIEW_INCOMPLETE` con blockers e stato Gate D invariato.

**Nessuna promozione a VALIDATED/ELIGIBLE e nessuno sblocco Gate D senza sign-off del Domain Owner.**
