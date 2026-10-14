# Task B5-B6 — End-to-End & Distributed Validation

**Role:** Integration & Reliability Engineer  
**Effort:** High  
**Execution:** single  
**Dependency:** B1–B4 reports available.

## Mission
Build a minimal harness, not the product, proving T1 feasibility and multi-process/multi-host capability.

Pipeline:
`real sources → parse → index/retrieve → source selection → Lesson Plan → Teacher Script → Student Material → provenance`

Use DBMS, Cybersecurity, History, Excel and partial-source scenarios.
Use selected baselines from prior reports unless integration exposes a concrete flaw.

## Distributed proof
Demonstrate at least two capabilities on distinct endpoints/processes. If a parser lacks HTTP, a minimal reusable wrapper is allowed inside `work/B5-B6/scripts/`; do not design the final platform.

## Failure tests
- model unavailable;
- parser failure;
- timeout;
- remote endpoint unreachable.

Business semantics must not change local vs remote. No implicit cloud fallback for restricted/private data.

## Outputs
- `work/B5-B6/`
- `artifacts/B5-B6/`
- `results/B5-B6-integration-report.md`

Report: distributed PASS/FAIL, provenance PASS/FAIL, `T1 FEASIBLE / NOT YET FEASIBLE`, concrete inputs for Platform Architecture.
