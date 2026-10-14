# Teacher Service — Validation Workspace

Questa cartella è la baseline canonica del **Feasibility & Benchmark Gate** del Teacher Service.

## Regola fondamentale

Qualsiasi file creato o modificato dagli agenti deve rimanere sotto:

`~/Workspace/teacher-service-design/`

I servizi sotto `~/Workspace/development-environment/` possono essere letti/eseguiti come input/runtime, ma non devono ricevere output del benchmark né modifiche persistenti salvo autorizzazione esplicita.

## Modello agenti

Usiamo **ruoli riutilizzabili + task separati**:

- `roles/` definisce come lavora ciascun tipo di agente;
- `tasks/` definisce il lavoro specifico del gate;
- `shared/` contiene regole e scoring comuni;
- `corpus/` contiene gli input reali e i gold set;
- `work/` contiene output grezzi, script, log e metriche di ogni fase;
- `artifacts/` contiene solo gli artefatti normalizzati riusabili dalle fasi successive;
- `results/` contiene i report conclusivi;
- `results/history/` conserva tentativi/precondition failure senza farli apparire come risultati attivi.

## Sequenza e stato attuale

La matrice `LAUNCH_MATRIX.md` descrive la **sequenza storica** B0–B6; non è più un elenco aggiornato delle attività ancora da eseguire. B1, B2, B3, B4, B5–B6 e Gate A/B/C hanno prodotto report. Il benchmark storico local-only B5–B6 rimane `NOT YET FEASIBLE`; la successiva architettura ibrida prevede Gate C e Gate D distinti.

**Fonte canonica dello stato presente:** [`../STATUS.md`](../STATUS.md).

- Gate A: PASS.
- Gate B v2: revalidation eseguita; semantic checker locali non validati per decisioni autoritative.
- Gate C / C7: 8 campioni Gemini disponibili; 4 Groq mancanti per problematiche operative. Prossimo passo: revisione Gemini post-execution (task `tasks/C7-gemini-post-execution-review.md`).
- Gate D revised E2E: `BLOCKED`, finché i profili richiesti e la review/sign-off non saranno completati.

Gli artifact, i report e i risultati storici devono essere preservati senza sovrascriverli né promuoverli implicitamente.

## Verifica dopo l'estrazione

Dalla root del progetto:

```bash
python3 validation/scripts/verify_bundle.py
```

L'esito atteso prima di B1 è `VALIDATION_BUNDLE: PASS`.
