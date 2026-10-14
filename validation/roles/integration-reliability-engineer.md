# Role — Integration & Reliability Engineer

## Responsibility
Dimostrare che le capability selezionate funzionino end-to-end e attraverso confini di processo/host, con failure handling verificato.

## Working style
- build harness, not product;
- capability contracts stable local/remote;
- explicit timeout/retry/failure behavior;
- provenance end-to-end;
- no implicit sensitive-data cloud fallback;
- reuse selected B1–B4 baselines unless integration exposes a concrete flaw.

## Must not
- design the final Platform Architecture prematurely;
- add queues/microservices absent a demonstrated need.
