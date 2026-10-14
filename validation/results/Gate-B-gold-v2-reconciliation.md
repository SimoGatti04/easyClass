# Gate B — Gold v2 Identity Reconciliation

**Data:** 30 settembre 2026  
**Stato:** RESOLVED

## Scopo

Riconciliare le tre discrepanze d'identità emerse durante la costruzione del Gold v2. La regola applicata è: **l'identità del caso nella v1 + artifact/source raw prevale su descrizioni successive incoerenti nei report di audit**.

## Decisioni

### GB-AC-018

Identità v1 confermata: caso CERCA.X.

- Original label: `UNKNOWN`
- Final label: `SATISFIED`
- Audit action: `RELABEL_RECOMMENDED`
- Primary epistemic role: `GENERAL_DOMAIN_KNOWLEDGE`
- Supporting roles: `SOURCE_DERIVED`, `PEDAGOGICAL_PROPOSAL`

Motivo: l'artifact spiega la procedura CERCA.X senza attribuirla letteralmente alla fonte; usa elementi strutturali supportati dalla fonte e conoscenza generale lecita. La precedente associazione a `=SOMMA(Vendite!I2:I13)` era errata.

### GB-GR-037

Identità v1 confermata: claim sulle istruzioni di installazione/uso di DB Browser.

- Final label: `UNSUPPORTED`
- Audit action: `REBUILD_CONTEXT`

La source raw nomina DB Browser come obiettivo ma non contiene istruzioni operative. Il riferimento a formule/commissione in un report precedente era errato.

### GB-GR-046

Identità v1 confermata: controlled perturbation che assegna `nome` come PK di `prodotti`.

- Final label: `UNSUPPORTED`
- Audit action: `REBUILD_CONTEXT`

La source raw indica `id_prodotto` come PK. Il riferimento a `id_corso`/tabella `corsi` in un report precedente era errato.

## Effetti

- Gold Gate B finale: **81 casi**.
- `RECLASSIFY_TASK`: **0**.
- `RELABEL_RECOMMENDED`: **7**.
- Dataset spreadsheet separato: **0 casi validi derivati da GB-AC-018**.
- Stato: **READY_FOR_GATE_B_REVALIDATION**.

Questo documento supersede, per i tre ID sopra, qualsiasi descrizione confliggente in `grounding-generation-contract-review.md` e `grounding-generation-contract-correction.md`.
