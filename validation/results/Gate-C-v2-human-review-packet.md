# Gate C v2 — Blind Human Review Packet

## Stato: BLOCKED — revisione completa dei profili non possibile

`attempt-05` è terminato con `RUNNER_FAILURE`: una generation DBMS tecnicamente valida non è stata propagata agli aggregati dopo il successivo fallimento longform. Il ranking e la matrice aggregata non sono decision-grade; la fase 2 Excel non è stata eseguita. Questo packet espone soltanto i deliverable didattici anonimi verificati che possono essere esaminati in modo diagnostico. **Non usare una revisione parziale per dichiarare `remote.generation` o `remote.longform` eleggibile.**

Nessun punteggio o giudizio qualitativo è precompilato. I codici sono neutri; non cercare né riprodurre il mapping in questo documento. Il mapping resta separato in `validation/artifacts/Gate-C-v2/review-key.json`.

## Matrice dei deliverable disponibili

| Candidate | Scenario | Generation: Lesson Plan + Student Material | Teacher Script assemblato | Stato della revisione |
|---|---|---|---|---|
| CANDIDATE-A | DBMS/SQL | Non disponibile come deliverable strutturato valido nel packet | [Teacher Script](../work/Gate-C-v2/outputs/attempt-05/blinded/CANDIDATE-A/dbms_sql/teacher-script.md) | Solo diagnosi del singolo script; generation mancante |
| CANDIDATE-A | Excel | Non disponibile come deliverable strutturato valido nel packet | [Teacher Script](../work/Gate-C-v2/outputs/attempt-05/blinded/CANDIDATE-A/excel/teacher-script.md) | Solo diagnosi del singolo script; generation mancante |
| CANDIDATE-B | DBMS/SQL | [Lesson Plan, Student Material e metadata strutturato](../work/Gate-C-v2/outputs/attempt-05/blinded/CANDIDATE-B/dbms_sql/generation-output.json) | Non disponibile: pipeline interrotta prima di uno script assemblato valido | Solo diagnosi della generation; scenario e profilo incompleti |
| CANDIDATE-B | Excel | Non disponibile | Non disponibile | Non eseguito |
| CANDIDATE-C | DBMS/SQL | Non disponibile come deliverable strutturato valido | Non disponibile | Output incompleto/non valido; non revisionabile come deliverable |
| CANDIDATE-C | Excel | Non disponibile | Non disponibile | Non eseguito |

I file indicati sono gli unici output didattici anonimizzati verificati per questo packet. I file `deterministic-review-summary.json` non sono referenziati: non sono artefatti di revisione blindata affidabili. Le richieste raw, gli stream e gli aggregati tecnici non sono materiali da valutare con la rubrica qualitativa.

## Schede di revisione — output disponibili

Compilare separatamente una scheda per ciascun deliverable indicato. Punteggi ammessi: **0–4**. Lasciare vuoti i campi non valutabili; non inferire la qualità di output mancanti. Per l'editing effort selezionare una sola voce.

### CANDIDATE-A — DBMS/SQL — Teacher Script

Artifact: [Apri Teacher Script](../work/Gate-C-v2/outputs/attempt-05/blinded/CANDIDATE-A/dbms_sql/teacher-script.md)

| Criterio | Punteggio 0–4 |
|---|---:|
| Factual correctness | |
| Source fidelity | |
| Completeness | |
| Pedagogical usefulness | |
| Level adherence | |
| Duration adherence | |
| Structure/coherence | |
| Unnecessary repetition | |

**Editing effort:** ☐ usable_as_is ☐ minor_edits ☐ moderate_edits ☐ major_rewrite ☐ unusable

- Critical errors:
- Unsupported source-specific details:
- False attribution:
- Strongest aspects:
- Required edits before classroom use:
- General note:

### CANDIDATE-A — Excel — Teacher Script

Artifact: [Apri Teacher Script](../work/Gate-C-v2/outputs/attempt-05/blinded/CANDIDATE-A/excel/teacher-script.md)

| Criterio | Punteggio 0–4 |
|---|---:|
| Factual correctness | |
| Source fidelity | |
| Completeness | |
| Pedagogical usefulness | |
| Level adherence | |
| Duration adherence | |
| Structure/coherence | |
| Unnecessary repetition | |

**Editing effort:** ☐ usable_as_is ☐ minor_edits ☐ moderate_edits ☐ major_rewrite ☐ unusable

- Critical errors:
- Unsupported source-specific details:
- False attribution:
- Strongest aspects:
- Required edits before classroom use:
- General note:

### CANDIDATE-B — DBMS/SQL — Generation (Lesson Plan + Student Material)

Artifact: [Apri output strutturato](../work/Gate-C-v2/outputs/attempt-05/blinded/CANDIDATE-B/dbms_sql/generation-output.json). Il JSON contiene Lesson Plan, Student Material e metadata; valutare distintamente piano e materiale studente, verificando che quest'ultimo sia autonomo e distinto dal copione docente.

**Lesson Plan**

| Criterio | Punteggio 0–4 |
|---|---:|
| Factual correctness | |
| Source fidelity | |
| Completeness | |
| Pedagogical usefulness | |
| Level adherence | |
| Duration adherence | |
| Structure/coherence | |
| Unnecessary repetition | |

**Editing effort:** ☐ usable_as_is ☐ minor_edits ☐ moderate_edits ☐ major_rewrite ☐ unusable

**Student Material**

| Criterio | Punteggio 0–4 |
|---|---:|
| Factual correctness | |
| Source fidelity | |
| Completeness | |
| Pedagogical usefulness | |
| Level adherence | |
| Duration adherence | |
| Structure/coherence | |
| Unnecessary repetition | |

**Editing effort:** ☐ usable_as_is ☐ minor_edits ☐ moderate_edits ☐ major_rewrite ☐ unusable

- Critical errors:
- Unsupported source-specific details:
- False attribution:
- Strongest aspects:
- Required edits before classroom use:
- General note:

## Deliverable mancanti e limite della decisione

- Per CANDIDATE-A mancano Lesson Plan e Student Material validi per entrambi gli scenari.
- Per CANDIDATE-B manca il Teacher Script DBMS completo; lo scenario Excel non è stato eseguito.
- Per CANDIDATE-C non è disponibile un deliverable didattico valido da revisionare; lo scenario Excel non è stato eseguito.
- La seconda run Excel della fase 2 non è stata eseguita.
- Il conteggio dei controlli hard source-specific e gli status tecnici sono descritti nel report tecnico, ma non sono giudizi umani e non sono stati convertiti in punteggi qui.

È possibile usare le schede presenti solo per annotazioni diagnostiche sugli artifact disponibili. La review completa dei profili resta **BLOCKED** fino a un attempt successivo metodologicamente valido che fornisca deliverable comparabili per la matrice richiesta. Nessuna conclusione `ELIGIBLE` o default provvisorio è autorizzata da questo packet.

Report tecnico: [Gate C v2 — Remote Composite Generation Benchmark](Gate-C-v2-remote-models-report.md).
