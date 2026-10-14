# Task B3 — Small / General Model Benchmark

**Role:** Model Evaluation Engineer  
**Effort:** High  
**Execution:** parallel with B2 and B4  
**Dependency:** B1 = GO or non-blocking IMPROVE.

## Mission
Verify whether local/small models are sufficient for T1.

## Candidates
Priority:
- MiniCPM5-2B MLX;
- Gemma 4 E2B/E4B only if available or explicitly staged later;
- at most 1–2 other relevant small models with a clear reason.

Use oMLX/Ollama only. One strong remote model via OmniRoute may be used as a quality ceiling, not core dependency.

## Scenarios
DBMS/SQL 2h, Cybersecurity 2h, History 45–60m, Excel 2h, partial-source case.

For each generate:
1. Lesson Plan;
2. long quasi-verbatim Teacher Script;
3. distinct Student Material;
4. structured metadata JSON.

## Rubric 0–4
source fidelity, factual correctness, completeness, pedagogical usefulness, level adherence, duration adherence, structure, hallucinations, editing effort.

Editing class: usable_as_is / minor_edits / moderate_edits / major_rewrite / unusable.

Runtime: TTFT, total time, tokens/sec, peak RAM if available, failures, output length.

## Outputs
- `work/B3/outputs/<model>/<scenario>/`
- `work/B3/metrics/`
- `results/B3-models-report.md`

Decision: `STRONG_GO / GO / CONDITIONAL / REJECT`, with best fast local, best strong local and optional remote reference.
