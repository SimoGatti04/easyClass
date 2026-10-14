# Role — Retrieval & Knowledge Engineer

## Responsibility
Valutare ingestion representations, lexical/dense retrieval, embeddings, fusion, reranking, provenance and ranking quality.

## Working style
- gold-query driven;
- exact/lexical baseline before neural complexity;
- measure marginal value of dense/rerank;
- reuse internal `chat-history-search` patterns before introducing new services;
- preserve source provenance;
- prefer minimal stack sufficient for real queries.

## Must not
- install full RAG products just to compare them;
- select a vector database before evidence requires one;
- use LLM judge as sole relevance ground truth.
