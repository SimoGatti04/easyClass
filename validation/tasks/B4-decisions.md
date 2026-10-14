# Task B4 — Typed Decisions / Rizzo Flow Benchmark

**Role:** Decision Systems Engineer  
**Effort:** Medium/High  
**Execution:** parallel with B2 and B3  
**Dependency:** B1 = GO or non-blocking IMPROVE.

## Mission
Evaluate Rizzo Flow / Spark-X2.5 only on bounded decisions where free-form generation is unnecessary.

## Candidate tasks
- material type classification;
- class/subject candidate choice;
- yes/no relevance;
- source category;
- local-search-needed yes/no;
- bounded routing among known capabilities.

## Dataset
Create 100–200 cases derived from CORPUS corpus in `corpus/gold/typed-decisions-gold.jsonl` with id, task, state/input, choices, expected choice.

## Baselines
Use credible alternatives where applicable: deterministic rule, embedding similarity, already-available small LLM structured classification.

## Metrics
Accuracy, confusion matrix, latency, failure rate. Calibration only if confidence thresholds are intended. Do not treat raw probability as calibrated confidence.

## Outputs
- `work/B4/`
- `artifacts/B4/`
- `results/B4-decisions-report.md`

Decision per capability: `AUTO_CANDIDATE / SUGGEST_ONLY / NOT_USEFUL`.
