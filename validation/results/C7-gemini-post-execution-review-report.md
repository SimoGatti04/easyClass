# C7 — Revisione offline post-execution degli 8 sample Gemini

**Data:** 10 ottobre 2026 (Europe/Rome)  
**Review mode:** `OFFLINE_READ_ONLY_NO_INFERENCE`  
**Execution esaminata:** `gate-c-corrective-20261002T223554140943Z-e3723564`  
**Model osservato:** `agy/gemini-3.8-flash-tiered`  
**Esito della review:** gli otto sample sono stati esaminati qualitativamente; la soglia storica D4 `SOURCE_FACT >=95%` resta `NOT_EVALUATED`, perché il ledger non è un denominatore completo. Nessuna eligibility è assegnata. Gate D resta invariato e bloccato.

## Risultato esecutivo

| Profilo | D4 storico | Criteri prodotto aggiornati | Raccomandazione indipendente |
|---|---|---|---|
| `remote.generation` | **FAIL per l'evidence set**: il pair Excel supera `minor_edits`; una replica ha anche un difetto di formula. La percentuale SOURCE_FACT non è valutata. Il pair DBMS è promettente, con prerequisito operativo non verificato. | **AMEND prima della decisione di profilo.** Buona resa DBMS; i due materiali Excel richiedono correzioni/impaginazione e non sono pronti all'uso così come generati. | Conservare il DBMS come evidenza positiva; correggere gli artefatti Excel e verificare la disponibilità del database DBMS. Nessuna promozione automatica. |
| `remote.longform` | **FAIL per l'evidence set**: errori disciplinari/di riferimento nel pair DBMS; false attribuzioni e formule/range errati nel pair Excel; editing oltre `minor_edits`. SOURCE_FACT resta non valutato. | **AMEND; gli script correnti non sono approvabili così come sono.** Struttura e durata sono generalmente buone, ma la correttezza operativa è insufficiente. | Correggere e sottoporre nuovamente a verifica gli script; CORR-04 richiede una riscrittura sostanziale. Nessuna promozione automatica. |

La revisione applica la correttezza semantica, non il matching letterale: parafrasi, spiegazioni originali, esempi e proposte didattiche appropriate non sono penalizzati solo perché non sono presenti parola per parola nella fonte. Le criticità riportate sotto sono difetti effettivi o prerequisiti non verificati, non semplici differenze testuali.

## Metodo, provenienza e limiti

- Sono stati esaminati gli 8 output CORR-01–CORR-04, i Source Set congelati dell'execution, l'AST/validation summary Excel, il manifest/stato dell'execution e l'overlay correttivo dell'evaluator.
- L'identità, i riferimenti e gli hash dei sample e delle fonti sono nel ledger machine-readable: `validation/work/C7/reviews/gemini-post-execution/claim-ledger.json`.
- Il ledger contiene **41 righe di claim rappresentative**, non tutti i fatti di ogni frase e metadato. Non è un denominatore completo per la percentuale SOURCE_FACT; non viene pubblicata alcuna percentuale né inferita dal numero di tag o dall'assenza di alert.
- Le cinque classi epistemiche sono mantenute distinte: `SOURCE_FACT`, `SOURCE_DERIVED`, `GENERAL_DOMAIN_KNOWLEDGE`, `PEDAGOGICAL_PROPOSAL`, `SOURCE_SPECIFIC_DETAIL`. Difetti di formattazione sono registrati come `OUTPUT_FORMAT_QUALITY`, non come classi epistemiche.
- Non sono state effettuate chiamate remote o nuove inferenze (0). Non sono stati modificati gli output, il manifest o gli stati storici dell'execution. Nessun LLM è stato usato come giudice.
- L'esito storico CORR-02 R2 resta `QUALITY_FAIL`; separatamente, l'audit correttivo ha identificato il falso positivo M3/M4 e la rivalidazione tecnica retrospettiva `TECHNICAL_PASS_AFTER_EVALUATOR_CORRECTION`. La formula errata con criterio fra apici singoli è un problema reale distinto e non viene cancellata dalla correzione dell'evaluator.

### Autorità delle fonti Excel

`validation/artifacts/Spreadsheet-Adapter/validation-summary.json` e `workbook-ast.json` confermano 5 fogli, 0 tabelle native, 0 formule memorizzate e 5 regioni rilevate. In `Vendite`, l'area è A3:M15, intestazioni alla riga 3, dati 4–15; `D` è Venditore, `I` è Netto; `B4` è il primo codice prodotto e `C4` la quantità; `M3` è l'etichetta e `M4` contiene `0.05` con formato percentuale. Proporre formule nuove o insegnare a creare `Catalogo` è lecito: non è lecito descriverle come già presenti nel workbook iniziale.

## Punteggi e editing effort per sample

Scala 0–4: factual correctness, semantic source fidelity, completeness, pedagogical usefulness, level adherence, duration adherence, structure/coherence e bassa ripetizione non necessaria (punteggio più alto = migliore). L'effort è una **stima dell'assistente**, non una valutazione del Domain Owner.

| Sample | Stato storico | Factual | Fedeltà semantica | Completezza | Utilità didattica | Livello | Durata | Struttura | Poca ripetizione | Effort assistente |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| CORR-01 R1 — generation, DBMS | `QUALITY_PASS` | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | `minor_edits` |
| CORR-01 R2 — generation, DBMS | `QUALITY_PASS` | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | `minor_edits` |
| CORR-02 R1 — generation, Excel | `QUALITY_PASS` | 3 | 4 | 3 | 3 | 4 | 4 | 2 | 3 | `moderate_edits` |
| CORR-02 R2 — generation, Excel | `QUALITY_FAIL` (storico) | 2 | 4 | 3 | 3 | 4 | 4 | 2 | 3 | `moderate_edits` |
| CORR-03 R1 — longform, DBMS | `QUALITY_PASS` | 2 | 4 | 4 | 3 | 3 | 4 | 4 | 3 | `moderate_edits` |
| CORR-03 R2 — longform, DBMS | `QUALITY_PASS` | 2 | 4 | 4 | 3 | 3 | 4 | 4 | 3 | `moderate_edits` |
| CORR-04 R1 — longform, Excel | `QUALITY_PASS` | 1 | 1 | 3 | 1 | 3 | 4 | 3 | 3 | `major_rewrite` |
| CORR-04 R2 — longform, Excel | `QUALITY_PASS` | 1 | 1 | 3 | 1 | 3 | 4 | 4 | 3 | `major_rewrite` |

D4 per sample e sintesi per profilo sono anche nel claim ledger. CORR-01 è `NOT_DEMONSTRATED` rispetto al criterio “zero hard failures” perché la presenza del database operativo non è verificabile dai Source Set; non è classificata come falsa attribuzione. Per gli altri sample il criterio hard-failure è fallito quando indicato sotto. `SOURCE_FACT >=95%` non è valutabile in nessuno dei sample.

## Evidenze per scenario e problemi effettivi

### `remote.generation` — CORR-01 DBMS/SQL

Entrambi i piani sono coerenti con livello base e durata di 120 minuti; gli Student Material mantengono schema, relazioni, esercizi SQL e checklist di autoverifica. La corrispondenza è semantica: non si richiede riproduzione letterale della scheda. Riferimenti: claim `01R1-01..03`, `01R2-01..03` e output generation JSON citati nel ledger.

**Caveat operativo:** entrambi i piani presuppongono di aprire un database pre-popolato. Il Source Set congelato descrive schema ed esercizi, ma non contiene un file database. Non è dimostrato che tale risorsa sia disponibile per la lezione: confermarla o aggiungerla come Support Material. Non attribuire questa assunzione alla fonte né considerarla un errore fattuale confermato. Effort stimato: `minor_edits`, subordinato alla verifica del prerequisito.

**D4:** non dimostrato per il pair; il denominatore SOURCE_FACT manca e il prerequisito operativo resta da verificare. **Prodotto:** campioni promettenti, non prova di pubblicazione Student Material.

### `remote.generation` — CORR-02 Excel

**R1.** La mappatura `Vendite!M3` = etichetta e `M4` = 0,05/5% è corretta; le medie/ranking per venditore riportate risultano coerenti con i dati congelati. Non ripetere il falso positivo storico del validator. Difetti effettivi: `student_material` contiene 96 sequenze letterali `\n` e 0 newline effettivi, quindi non si renderizza come dispensa strutturata; varie formule usano placeholder come `SOMMA(intervallo Entrate)` invece di un intervallo concretamente operativo. Sono problemi di formato e azionabilità, non allucinazioni. Riferimenti: `02R1-03..06`.

**R2.** La descrizione M3/M4 è corretta e `Catalogo` è presentata come tabella da creare, in linea con la fonte. La formula `CONTA.SE(...; '>=100')` usa apici singoli per il criterio testuale; occorrono virgolette doppie, ad es. `">=100"`. Il testo della scheda è sostanzialmente un unico paragrafo/sequenza e non è pronto per distribuzione senza ristrutturazione. Riferimenti: `02R2-01..05`.

**D4:** il pair fallisce il limite di editing (`moderate_edits` per entrambe); R2 ha inoltre un difetto di formula. **Prodotto:** le idee e la mappatura sono in gran parte corrette, ma i deliverable studenti richiedono correzione e revisione editoriale; non sono pubblicati né automaticamente valutabili.

### `remote.longform` — CORR-03 DBMS/SQL

Gli script sono completi nella forma, 3.486 e 3.920 parole, 5 fasi e time map 0–120 minuti. Sono ben scanditi, con esempi, domande, feedback e attività. La qualità strutturale non annulla però gli errori disciplinari.

- **R1:** presenta `ROUND(...,2)` come troncamento; `ROUND` arrotonda, non tronca (claim `03R1-03`). Inoltre attribuisce a `SELECT *` conseguenze prestazionali assolute e non universali; formulare come possibile trade-off e qualificare per motore/carico (claim `03R1-05`). La scala numerica di `sconto_percento` e il file database pre-popolato non sono stabiliti dal source set (claim `03R1-04`).
- **R2:** usa `SELECT nome prezzo FROM prodotti` come errore deliberato di parser dovuto alla virgola mancante. La verifica locale con SQLite 3.53.4 accetta la forma come alias equivalente a `SELECT nome AS prezzo`; la dimostrazione insegna una diagnosi falsa. Sostituirla con un errore realmente invalido (claim `03R2-03`). Restano da esplicitare la scala di `sconto_percento` e la disponibilità del database (claim `03R2-04..05`).

Effort stimato `moderate_edits` per entrambi. **D4:** fail (errori di contenuto e effort oltre il limite); **prodotto:** struttura e valore pedagogico sono recuperabili solo dopo correzioni fattuali e verifica dei prerequisiti.

### `remote.longform` — CORR-04 Excel

Gli script hanno time map 120 minuti (3.792 e 3.537 parole) e progressione didattica riconoscibile. Il caso richiede riferimenti puntuali perché si descrive proprio il workbook reale; non è una penalità per un tutorial generico senza coordinate.

- **R1:** attribuisce alla fonte moduli PivotTable/dashboard non presenti nel programma congelato (`04R1-01`: falsa attribuzione). La formula CERCA.X usa `C4`, quantità, anziché il codice in `B4` (`04R1-03`). Gli aggregati puntano a `B2:B13`/`F2:F13` invece di venditore `D4:D15` e netto `I4:I15` (`04R1-04..05`). La mappatura M3/M4 e la proposta di creare Catalogo sono invece corrette (`04R1-02`, `04R1-06`).
- **R2:** `=D2*E2`, `=F2*(1-G2)`, `=H2*M4` usano colonne/righe errate rispetto al workbook; gli aggregati `B2:B13`/`F2:F13` non sono colonne venditore/netto (`04R2-02..05`). Esempi corretti di formule nuove sono leciti, ma queste formule non rappresentano le operazioni dichiarate. La creazione di `Catalogo` e la distinzione M3/M4 sono corrette (`04R2-01`, `04R2-06`).

Effort stimato `major_rewrite` per entrambe le repliche. **D4:** fail; **prodotto:** non usare gli script così come sono. Le proposte di spiegazioni/esercizi restano recuperabili, ma la parte operativa centrale va riscritta e ricontrollata contro l'AST.

## Valutazione distinta dei criteri prodotto aggiornati

### Dossier 04 §47 — materiali e generazione

Applicando il principio “affidabilità senza letteralismo”, parafrasi, spiegazioni generali corrette, analogie ed esempi pedagogici originali sono ammissibili se non falsamente attribuiti. La valutazione è rigorosa quando un output afferma un dettaglio concreto del database/workbook. Il risultato è misto: generation DBMS ben allineata salvo un prerequisito esterno; generation Excel corretta in parti sostanziali ma con difetti editoriali/di formula; longform Excel contiene gravi riferimenti operativi errati; longform DBMS contiene due errori didattici fattuali.

Il flusso **Fonti → Teacher Material → Student Material pubblicato → Assessable Material** non è stato dimostrato end-to-end. Gli script sono bozze Teacher Material; i due output Student Material sono output generati, non evidenza di pubblicazione o conferma docente della copertura. Non considerarli automaticamente `Assessable Material`.

### Dossier 05 §57 — assessment

**Non valutabile direttamente in questo benchmark:** nessuno degli otto sample è un Assessment Item o un Assessment Blueprint e non esiste un Assessable Source Set pubblicato con cui verificare item/prerequisiti. Il principio aggiornato è comunque compatibile con gli output: problemi nuovi possono essere validi se richiedono competenze insegnate e se dati fittizi sono autosufficienti; non si esige copia testuale. Non assegnare grounding/eligibility per assessment sulla base di questi sample.

## Stato D4 e raccomandazioni di profilo

| Profilo | Esito storico D4 | Criteri prodotto | Raccomandazione assistant, non decisione |
|---|---|---|---|
| `remote.generation` | **FAIL per l'evidence set**: pair Excel oltre `minor_edits`; in R2 difetto formula. La soglia percentuale SOURCE_FACT resta `NOT_EVALUATED`; pair DBMS non chiude il prerequisito del database. | Buona generazione DBMS; Excel richiede interventi moderati. Nessun output ha stato di pubblicazione. | **AMEND.** Conservare il DBMS come evidenza positiva; rimediare formattazione, formule e azionabilità Excel; verificare il database. Non promuovere il profilo ora. |
| `remote.longform` | **FAIL per l'evidence set**: errori fattuali DBMS e errori di attribuzione/coordinate Excel; editing effort moderato/major. SOURCE_FACT resta `NOT_EVALUATED`. | Struttura e durata non bastano: i copioni Excel sono operativamente scorretti e quelli DBMS richiedono correzioni disciplinari. | **AMEND / non approvare gli artefatti correnti.** Correggere le affermazioni e riscrivere CORR-04 prima di qualsiasi decisione. |

Nessuna raccomandazione costituisce `VALIDATED`, `ELIGIBLE`, `DEFAULT_FOR_PROFILE` o sign-off del Domain Owner. `remote.reasoning` non è oggetto di questa review e non è stato modificato.

## Decisione del Domain Owner e readiness

Packet separato: `validation/results/C7-gemini-post-execution-domain-owner-packet.md`. Le opzioni del Domain Owner restano non selezionate e il suo editing effort/sign-off sono vuoti.

**Readiness:** `REVIEW_INCOMPLETE` per la ratifica D4: manca il denominatore completo SOURCE_FACT e l'evidence set presenta criteri D4 falliti. Il Domain Owner può decidere le modifiche di prodotto e il percorso di remediation, ma questo report non autorizza eligibility né Gate D. Gate D rimane `BLOCKED`.

## File e verifiche

Creati:
- `validation/work/C7/reviews/gemini-post-execution/claim-ledger.json` (corretto e completato con riferimenti a request/response/trace per ogni sample)
- `validation/results/C7-gemini-post-execution-review-report.md`
- `validation/results/C7-gemini-post-execution-domain-owner-packet.md`

Preservati: execution storica, output e artifact, fonti e file protetti del baseline; `STATUS.md`, registry e Gate D non sono stati modificati. Verifica finale PASS: 329/329 file dell’execution corrispondono al baseline; gli 11 file protetti e gli 8 artifact campione mantengono l’hash atteso; JSON valido (8 sample, 41 righe claim); packet Domain Owner non precompilato. Nessuna nuova inferenza. Rimossa la cache temporanea `.uv-cache` creata nella directory di review. Il workspace non contiene `.git`, quindi non è stato possibile fare un diff Git.

## Fonti normative/esatte esaminate

`STATUS.md`; `validation/tasks/C7-gemini-post-execution-review.md`; `validation/roles/model-evaluation-engineer.md`; `validation/shared/COMMON_RULES.md`; `validation/shared/SCORING.md`; `docs/dossiers/04-knowledge-materials.md` §§46–47; `docs/dossiers/05-assessment-system.md` §§56–57; `validation/results/C7-groq-capability-operational-decision.md`; `validation/results/C7-evaluator-correction-audit-report.md`; `validation/results/Gate-C-v2-correction-plan.md`; `validation/artifacts/Spreadsheet-Adapter/validation-summary.json`; `validation/work/Gate-C-v2/inputs/scenario_sources/{dbms_student_lesson.md,excel_demo_b1.md}`; convenzioni applicabili `development-environment/AGENTS.md`, `docs/environment/README.md`, `docs/engineering/README.md`, `docs/engineering/documentation.md`, `docs/engineering/agent-protocol.md`.
