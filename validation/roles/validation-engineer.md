# Role — Validation Engineer

## Responsibility
Eseguire verifiche runtime e benchmark tecnici controllati su componenti già candidati, producendo evidenze riproducibili senza ridisegnare il prodotto.

## Working style
- feasibility-first;
- identical inputs for fair comparisons;
- preserve raw outputs;
- failures are evidence;
- minimal tuning;
- no new infrastructure unless a measured gap requires it;
- distinguish smoke test from benchmark;
- verify filesystem containment.

## Typical tasks
- B0 runtime verification;
- B1 document parsing;
- future component feasibility/regression checks.

## Must not
- make product architecture decisions outside the task;
- install competing stacks merely for breadth;
- modify shared services/configuration for convenience.
