# C3 — Generic Evidence Contract, Spreadsheet Provider e Bounded Evidence Pack

**Data di esecuzione:** 1 ottobre 2026  
**Verdetto C3:** **PASS**  
**Perimetro:** implementazione e verifica locale C3 soltanto. Nessuna generazione didattica, nessuna chiamata remota, nessun invio del corpus. C4 non è iniziato.

## 1. Scope e non-goals

C3 implementa il contratto generico di evidence, un provider deterministico per lo spreadsheet fixture e un pack limitato alle richieste dichiarate. Excel/DBMS sono trattati come fixture/adapter, non come domini architetturali. Il core non importa l’adapter spreadsheet, il codice di scenario, né tipi o concetti di formato/dominio. Una fixture testuale di storia usa lo stesso core senza provider spreadsheet.

Non sono stati implementati C4–C7, generazione/longform, selezione semantica, embeddings, ranking AI, LLM evidence selector o Gate D. Semantic Completeness (C2) resta indipendente; è stata verificata soltanto la compatibilità d’importazione e la suite C2 non è stata modificata. Non sono stati modificati OmniRoute, registry/profile status, Gate B o artifact storici Gate B/Gate C.

## 2. Implementazione

- Core generico: `validation/shared/evidence.py`
- Provider spreadsheet: `validation/shared/spreadsheet_adapter/evidence.py`
- Scenario, fixture, output e test C3: `validation/work/C3/`
- Metriche del run locale: `validation/work/C3/metrics/c3-metrics.json`

Il core offre `EvidenceItem`, `EvidenceProvenance`, `DerivationProvenance`, `EvidencePack`, `EvidenceView`, `EvidenceRole` e `EvidenceVisibility`. I ruoli source-related sono `SOURCE_FACT`, `SOURCE_DERIVED` e `SOURCE_SPECIFIC_DETAIL`. La provenance è strutturata: source ID/type/hash, locator JSON opaco per il core, extraction method, source schema/version, provider version e, per derivazioni, lineage, regola, versione di calcolo e parametri.

I record sono immutabili dopo la costruzione, validati come JSON rigoroso e serializzati canonicamente con versione dello schema. I pack sono ordinati deterministicamente e hanno un ID derivato dal contenuto canonico.

### Evidence ID

L’ID item è un SHA-256 deterministico con prefisso `ev_`, ottenuto dalla rappresentazione canonica di versione item, ruolo, valore, identità/hash sorgente, locator, label semantica, unit/type e metadati di derivazione. Non usa UUID casuali ed è indipendente dall’ordine di esecuzione; la visibilità è deliberatamente un attributo di accesso e non altera l’identità del fatto. I test verificano riproducibilità e stabilità.

## 3. Visibility e leak prevention

Le view sono opt-in, senza un default che esponga il pack intero:

- `for_prompt()`: solo `PROMPT_VISIBLE`, in record model-safe minimale;
- `for_validation()`: `PROMPT_VISIBLE` e `VALIDATOR_ONLY`;
- `for_teacher()`: `PROMPT_VISIBLE` e `TEACHER_ONLY`.

Il validator non riceve automaticamente `TEACHER_ONLY`; il generatore non riceve né `VALIDATOR_ONLY` né `TEACHER_ONLY`. Per esempio, le medie calcolate usate come risposta attesa sono `VALIDATOR_ONLY`, così il prompt pack dello studente non rivela la soluzione. La teacher view include gli elementi prompt-visible e teacher-only autorizzati.

I sei test V1–V6 coprono presenza/assenza nelle view e allowlist teacher. Tutti passano.

## 4. SpreadsheetEvidenceProvider e fail-closed

`SpreadsheetEvidenceProvider` verifica i pin del file sorgente, della projection e dell’AST prima di risolvere richieste. Usa `CellAwareSpreadsheetAdapter` per l’estrazione e `SpreadsheetQueryEngine` per le query; non duplica la logica di query. Le richieste dichiarative coprono summary, esistenza sheet, cella, range, native table, detected region, defined name, stored formula e header/colonna. La fixture, non il provider, specifica nomi, coordinate e colonne del benchmark.

Richieste duplicate, locator non valido, cella/sheet/range assente o strutture non supportate non producono fatti inventati: tornano come unresolved strutturati, oppure interrompono la costruzione con errore di integrità/schema. Il provider richiede il ruolo source-related e non consente di estrarre direttamente `SOURCE_DERIVED`.

La distinzione è esplicita e testata: `NATIVE_OOXML_TABLE`, `DETECTED_RANGE` e `DEFINED_NAME` sono stati indipendenti, non sinonimi. Il provider non materializza automaticamente tutte le celle o l’intero AST; restituisce soltanto i record corrispondenti alle query esplicite.

## 5. Pin e fatti del workbook reale

Pin verificati durante l’esecuzione:

| Input | SHA-256 |
|---|---|
| Workbook `excel_demo.xlsx` | `fb8a07d2bfc17839bf8cb3aa9955b36e12c7f4cbb9dfab620d38e05e60bd42b7` |
| Projection JSON (file) | `e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed` |
| Projection content | `e0a3ec985070de9c8583c4d5f37a3a2e4a80d53a8511fe79a98946bb1b534747` |
| Parsed workbook AST | `08672d4c4e4b6cb8046185024b4df9f35f372b0170bcb45dd7026ba13c065423` |
| Scenario source `excel_demo_b1.md` | `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414` |

Regressioni sul workbook reale, tutte PASS:

- 5 fogli, 359 celle indirizzate, 184 non vuote;
- 0 formule memorizzate e 0 native OOXML tables;
- 5 detected regions;
- `Vendite` detected region `A3:M15`;
- `Prodotti` detected region `A3:E9`;
- `Vendite!M3` raw value `Aliquota commissione`, label fixture `LABEL`;
- `Vendite!M4` raw value `0.05`, number format `0%`, label fixture `VALUE`;
- native table `Catalogo` = `NOT_PRESENT`, separatamente dalla detected region `Prodotti` = `PRESENT`;
- stored formula in `Vendite!H4` = `NOT_PRESENT`.

La proposta `=H4*(1-E4)` è rappresentata come `GeneratedFormulaProposal` classificata `PEDAGOGICAL_PROPOSAL`; non è un `EvidenceItem`/`SOURCE_FACT` e il controllo conferma che non è memorizzata nella sorgente.

## 6. Derivazione locale e provenance

Il codice scenario C3 interroga i fatti necessari per le 12 righe vendita e le 6 righe prodotto, poi calcola localmente con `Decimal`:

1. lookup codice vendita → codice prodotto → prezzo;
2. lordo = quantità × prezzo;
3. netto = lordo × (1 − sconto);
4. raggruppamento per venditore e media aritmetica;
5. ordinamento media decrescente, con nome stabile come tie-break.

Nessun valore atteso è passato come input al builder. Ogni riga di lordo/netto e ogni media sono `SOURCE_DERIVED` e `VALIDATOR_ONLY`, con `derived_from`, derivation ID, metodo, computation version, locatori, aggregazione e policy di arrotondamento. Le medie sono arrotondate solo sull’aggregato con `ROUND_HALF_UP` a due decimali.

Risultato calcolato dai dati:

| Rank | Venditore | Media netto |
|---:|---|---:|
| 1 | Marco | 89.32 |
| 2 | Anna | 86.33 |
| 3 | Sara | 74.73 |

Il test oracle asserisce questi valori e dimostra che Marco rank 1 emerge dal calcolo, non da una classifica hardcoded.

## 7. Bounded Evidence Pack e anti-dump

L’output prompt dimostrativo richiede esplicitamente soltanto `Vendite!M3` e `Vendite!M4`; il pack contiene esattamente due item. L’anti-dump test verifica l’assenza delle coordinate non richieste (tra cui `A4`–`E4`, `A1`, `A15`) e dell’array/campo di dump `cells`. Il pack non contiene l’AST né 359 celle: boundedness deriva dalla richiesta prima della serializzazione, non da troncamento a posteriori.

Misura registrata per la prompt view M3+M4: **861 caratteri / byte UTF-8**, stima puramente indicativa **216 token circa** usando caratteri/4 arrotondato per eccesso. Non è output di un tokenizer e non è una soglia di accettazione. Il riferimento 400–600 token è un target operativo non universale; questa probe minimale è più piccola e non fallisce per questo motivo. Rappresentazione canonica audit e rendering prompt restano separati.

Output campione: `validation/work/C3/outputs/bounded-m3-m4-pack.json` e `validation/work/C3/outputs/bounded-m3-m4-prompt-view.json`.

## 8. Fixture ortogonale e genericità

La fixture di storia, priva di provider Excel o SQL, crea due `SOURCE_FACT` testuali (eventi del 1764 e 1769) e deriva l’ordinamento temporale localmente come `SOURCE_DERIVED`. Usa gli stessi `EvidenceItem`, `EvidencePack`, provenance e visibility views del contratto generico.

La regressione di genericità scansiona `validation/shared/evidence.py` per i termini vietati di formato/dominio richiesti (excel, spreadsheet, workbook, sheet, cell, sql, dbms, join, select, Vendite, Prodotti, Riepilogo): **0 match / 0 branch**. Provider, fixture e scenario possono contenere naturalmente questi termini.

C2 resta importabile e non circolare: test d’integrazione minimo C2+C3 PASS; la suite locale C2 separata ha passato 17/17 test.

## 9. Test e verifiche locali

`validation/work/C3/scripts/test_c3_evidence.py`: **38/38 PASS**, zero errori/fallimenti. Copertura: T1–T26; V1–V6; immutabilità dei payload annidati; compatibilità C2; query di range/header; assenza di defined name; locator invalido; schema projection sconosciuto. Include test locale che blocca socket/urllib per il percorso di derivazione.

Verifiche aggiuntive completate:

- `py_compile` di core, provider, scenario, runner e test: PASS;
- `validation/work/C3/scripts/run_c3.py`: PASS, 38 test;
- suite `validation/work/C2/scripts/test_semantic_completeness.py`: 17/17 PASS;
- metriche e artefatti C3 rigenerati dal runner: PASS;
- `remote_calls = 0`, `corpus_sent = false`.

## 10. Limitazioni note

- Non esiste ancora un `TextSourceEvidenceProvider` generale: la fixture di storia prova l’ortogonalità del core, non l’estrazione testuale production-grade.
- La derivazione vendite è intenzionalmente scenario-local e legata alle colonne della fixture; non è un motore formule generale né una DSL.
- L’estimatore di dimensione è una stima caratteri/4, non un tokenizer specifico del modello.
- C3 non dimostra integrazione del pack in un generation runner: quella valutazione è fuori scope e richiede una review/autorizzazione separata per C4.

## 11. Esito

Tutti i criteri C3 richiesti sono soddisfatti: core generico e senza branch di formato/dominio; provider sopra il query engine; fatti reali e distinzione tabelle/regioni/formule corretti; derivazione riproducibile; visibility leak test e anti-dump PASS; fixture ortogonale PASS; fail-closed e test PASS; nessun accesso remoto o invio corpus.

**C3 = PASS — READY_FOR_C4_REVIEW.** Nessuna attività C4 è stata iniziata.
