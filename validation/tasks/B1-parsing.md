# Task B1 — Document Parsing Benchmark

**Role:** Validation Engineer  
**Effort:** High  
**Execution:** single  
**Dependency:** B0 acceptable + corpus precondition PASS.

## Mandatory reads
- `shared/COMMON_RULES.md`
- `shared/REPORT_TEMPLATE.md`
- `shared/SCORING.md`
- `shared/PROJECT_PATHS.md`
- `docs/validation/00-feasibility-benchmark-gate.md`
- `docs/validation/01-benchmark-corpus.md`
- `results/B0-runtime-report.md`
- `docs/dossiers/10-ai-architecture.md`

## Precondition
Require and SHA-256 verify:
- `corpus/source/dbms-sql/dbms_teacher_script.pdf`
- `corpus/source/dbms-sql/dbms_student_lesson.pdf`
- `corpus/source/cybersecurity/cyber_teacher_script.pdf`
- `corpus/source/history/history_teacher.docx`
- `corpus/source/excel/excel_teacher.docx`
- `corpus/source/excel/excel_demo.xlsx`
- `corpus/source/SHA256SUMS.txt`

If any input is missing or checksum differs: write `results/B1-parsing-report.md` with `INPUT_INVALID`, run no parser, stop.

## Mission
Compare MinerU and Marker on the real staged CORPUS material and select the minimum parsing baseline for T1.

Do not benchmark retrieval/models and do not install a third parser unless a concrete uncovered gap is demonstrated.

## Input rules
Never modify `corpus/source/`. If a working copy is needed place it in `work/B1/inputs/`.

## Mandatory batch
1. DBMS teacher script PDF
2. DBMS student lesson PDF
3. Cybersecurity teacher script PDF
4. History teacher DOCX
5. Excel teacher DOCX
6. Excel demo XLSX

Run MinerU and Marker where the installed version genuinely supports the format. Unsupported formats are valid evidence; do not manufacture conversions merely to make a parser participate.

## Fair configuration
Use sensible defaults documented in development-environment. Record backend/method/effort/flags. At most one additional configuration per parser when the first result exposes a clearly option-fixable issue. No extensive tuning.

## Outputs
- `work/B1/outputs/mineru/<document-id>/`
- `work/B1/outputs/marker/<document-id>/`
- `work/B1/logs/`
- `work/B1/metrics/`
- `work/B1/scripts/`

## Score 0–4
For each document/parser:
- text fidelity;
- structure/reading order;
- tables/formulas (N/A when irrelevant);
- downstream usability for chunking/retrieval/grounding without manual cleanup.

Inspect outputs against originals. Check headings, paragraphs, order, lists, tables, formulas, code, duplicated/lost/invented text and noise. Character counts alone are insufficient.

## Performance
Record wall time, exit code, output size and warnings/errors. Peak RAM only if available without new tooling.

## Decision
Choose one:
- MinerU primary, Marker unnecessary;
- MinerU primary + Marker fallback;
- Marker primary + MinerU fallback;
- routing by format/type;
- uncovered gap → IMPROVE.

Overall gate: `GO / IMPROVE / REJECT`.

## Report
Write `results/B1-parsing-report.md` with:
- executive result;
- environment/config;
- corpus;
- results matrix;
- detailed observations;
- failures;
- recommended baseline;
- impact on B2;
- files produced;
- not tested;
- decision;
- filesystem containment check.

If GO/IMPROVE produces reliable representations, put only normalized downstream artifacts in `artifacts/B1/` and create `artifacts/B1/MANIFEST.json` with source, parser, version, parameters, artifact and checksum.

Do not start B2/B3/B4.
