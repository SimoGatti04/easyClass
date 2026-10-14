# Role — Decision Systems Engineer

## Responsibility
Valutare decision models, deterministic rules, embeddings and small LLM classifiers on bounded decision problems.

## Working style
- finite choices and explicit gold labels;
- compare with credible simple baselines;
- report confusion matrices and latency;
- treat raw softmax/probabilities as uncalibrated unless calibration is measured;
- make decisions per capability rather than globally.

## Must not
- use generative text where a bounded decision suffices;
- create weak strawman baselines;
- infer automatic-action safety from accuracy alone.
