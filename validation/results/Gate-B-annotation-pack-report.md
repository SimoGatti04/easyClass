# Gate B — Report pacchetto di annotazione umana

**Stato: READY_FOR_HUMAN_ANNOTATION**  
**Annotatore designato:** Simone, proprietario del caso d'uso e dei materiali CORPUS.  
**Perimetro:** preparazione di casi senza etichette. Nessun benchmark, modello locale/remoto o scoring automatico eseguito in questo task.

## Conteggio

| Task | Casi | Stato |
|---|---:|---|
| Source Grounding Check | 52 | Etichetta da assegnare a mano |
| Generated Artifact Semantic Check | 30 | Etichetta da assegnare a mano |
| Short Semantic Tagging | — | **NOT_NEEDED** |

Grounding: **44 `real`** (claim selezionati da output B3/B5) e **8 `controlled_perturbation`** (scritti manualmente e identificati solo come origine, senza risposta attesa). I casi coprono DBMS completo, Excel e source set DBMS parziale; non sono variazioni generate per raggiungere un conteggio.

## Fonti utilizzate

- `validation/results/Gate-B-local-capabilities-report.md` (stato del gate e quarantena del builder; non modificato).
- `validation/results/B3-models-report.md` e output B3 manifestati in `validation/artifacts/B3/MANIFEST.json`.
- `validation/results/B5-B6-integration-report.md`, gli output esistenti e i `source_set_top_k` dei retrieval manifestati in `validation/artifacts/B5-B6/MANIFEST.json`.
- Source B3: `validation/work/B3/inputs/scenario_sources/dbms_student_lesson.md`, `dbms_partial_excerpt.md`, `excel_demo_no_cellrefs.md`.
- Contesto architetturale/policy: `docs/ai/model-routing-and-registry.md`, `docs/dossiers/08-automation-model.md`, `docs/dossiers/10-ai-architecture.md`.
- B4: `validation/results/B4-decisions-report.md`, per non aggiungere una tassonomia di tagging già coperta o artificiale.

I casi B5 usano soltanto estratti dai `source_set_top_k` dei retrieval esistenti. Non sono stati usati file quarantinati/unreviewed come fonte autorevole. Le fonti Cybersecurity/History escluse per source/reference leakage in B3 non sono state riutilizzate.

## Composizione e controlli

- **Grounding:** 52 unici per ID, 44 claim da output esistenti e 8 perturbazioni controllate manuali; i campi `claim`, `source_excerpt`, origine e provenienza sono presenti. Non è stata inserita alcuna etichetta attesa.
- **Artifact check:** 30 excerpt distinti, scelti per coprire dichiarazione dei gap, aggiunte non supportate, coordinate/formule Excel, accuratezza concettuale e confine tra materiale studente e copione docente. Sono esclusi JSON validity, enum/campi, finish_reason e controlli esatti di conteggio/minutaggio verificabili con codice.
- **Duplicate check:** 0 duplicati testuali esatti dopo normalizzazione per i claim e per le coppie requirement/excerpt. Sei claim-glossario in una sola riga, tutti dallo stesso chunk, sono stati rimossi come ridondanti; revisione manuale dei casi restanti: nessun duplicato quasi identico evidente.
- **Provenance:** percorsi esistenti e verificati; i percorsi B3/B5 usati risultano nei rispettivi manifest. Nessun path quarantined/unreviewed è stato incluso.
- **Gold status:** tutti gli 82 record hanno `gold_label: null`, `human_note: null` e `annotation_status: PENDING_HUMAN`; nel Markdown non è selezionata alcuna casella.
- **Short tagging:** `SHORT_SEMANTIC_TAGGING: NOT_NEEDED`; non è emerso un use case convincente ulteriore rispetto a B4.
- **Safety/policy:** le etichette umane non autorizzano da sole auto-applicazione. Il Dossier 08 mantiene review/approvazione per azioni di impatto e gli output AI restano bozze/proposte; questo pacchetto non valuta né modifica tale policy.

## Audit di esecuzione

- Modelli/LLM chiamati: **0**.
- Nuovi benchmark o inference: **0**.
- Gate B benchmark eseguiti: **0**.
- B5/B6 avviati: **no**.
- `validation/results/Gate-B-local-capabilities-report.md`: **non modificato**.

## File

- Annotazione manuale: `validation/corpus/gold/gate-b/HUMAN_ANNOTATION.md`
- Template machine-readable senza label: `validation/corpus/gold/gate-b/human-annotation-template.jsonl`
- Audit di packaging: `validation/work/Gate-B/annotation-pack/annotation-pack-audit.json`
- Manifest del pacchetto: `validation/artifacts/Gate-B/human-annotation-pack-MANIFEST.json`
