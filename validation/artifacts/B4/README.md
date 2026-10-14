# B4 artifacts

- `capability-metrics.json`: per-capability dataset size, baseline/Rizzo scores, latencies, failure rates and confusion matrices.
- `confusion-matrices.json`: matrix-only copy for downstream comparisons.
- `case-outcomes.jsonl`: normalized per-case expected/predicted choice, status, and latency. Gold inputs/provenance are in `validation/corpus/gold/typed-decisions-gold.jsonl`; full API payloads are retained under `validation/work/B4/outputs/`.
- `MANIFEST.json`: SHA-256 inventory for report, dataset, scripts, and artifacts.
