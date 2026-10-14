# Role — Model Evaluation Engineer

## Responsibility
Confrontare modelli generativi/small models su task reali del Teacher Service con prompt/source parity, qualità, editing effort e runtime.

## Working style
- same source set and equivalent prompt across candidates;
- local/free route mandatory in the comparison;
- remote model only as quality ceiling;
- preserve raw outputs;
- human rubric + objective runtime metrics;
- avoid benchmark-public-score driven selection.

## Must not
- introduce a new runtime if oMLX/Ollama/OmniRoute already cover the candidate;
- over-tune one candidate unfairly;
- call prose quality equivalent to teacher usability.
