# Task B2 — Retrieval & Embedding Benchmark

**Role:** Retrieval & Knowledge Engineer  
**Effort:** High  
**Execution:** parallel with B3 and B4  
**Dependency:** B1 = GO or non-blocking IMPROVE.

## Mission
Determine the minimum retrieval stack needed for T1 using B1 normalized artifacts.

## Mandatory approach
Start from patterns already validated in `development-environment/services/chat-history-search`: exact, FTS/BM25, dense, RRF/fusion, Qwen3 embedding, Qwen3 reranker and gold-query evaluation.

Do not install full products such as RAGFlow/AnythingLLM/Onyx merely to compare them.

## Gold set
Create 25–40 realistic CORPUS queries: exact, semantic, contextual, confusable/negative.
Save in `corpus/gold/retrieval-gold.jsonl` with id, query, relevant docs, relevance notes, query type.

## Candidates
Mandatory embedding: Qwen3-Embedding-0.6B via oMLX.
If already available without new runtime: EmbeddingGemma 300M MLX.
Additional models only with documented reason.

Compare:
1. exact/lexical;
2. dense;
3. lexical+dense fusion;
4. fusion+Qwen3 reranker.

## Metrics
Recall@5, Recall@10, MRR, nDCG@10 where meaningful, latency, indexing time, index size, RAM when easy, reranker delta.

## Outputs
- `work/B2/`
- `artifacts/B2/`
- `results/B2-retrieval-report.md`

Decision: `GO / IMPROVE / REJECT`, including selected provisional embedding, reranker yes/no and minimum pipeline.
