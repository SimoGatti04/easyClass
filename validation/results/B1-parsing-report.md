# B1 — Document Parsing Benchmark

## Decisione

### **IMPROVE** — non bloccante per avviare B2 sulla ricerca testuale dei contenuti selezionati.

**Baseline provvisoria raccomandata: routing per formato.** Usare **Marker 1.10.2 per i PDF** del profilo testuale provato; usare **MinerU 3.4.2 `hybrid-engine` per DOCX e XLSX**. Per i PDF, MinerU resta un fallback operativo, ma non è un sostituto semanticamente intercambiabile: nel corpus ha perso contenuto presente in Marker. **Marker non supporta i tre formati Office provati.**

Il limite che mantiene la decisione su `IMPROVE` è lo spreadsheet: MinerU conserva i fogli e i valori, ma il Markdown non conserva gli indirizzi delle celle né tutto il contesto di visualizzazione; inoltre l'unico XLSX del corpus contiene **zero formule**. Prima di usare il workbook per citazioni cella-per-cella, risposte con calcoli o spiegazioni delle formule, va validata una rappresentazione XLSX address-aware e formula-aware. Questo non impedisce a B2 di valutare la ricerca testuale generale, ma ne delimita l'uso per questo file.

**B2, B3 e B4 non sono stati avviati.**

## Metadata

- **Ruolo:** Validation Engineer
- **Task:** B1 — Document Parsing Benchmark
- **Data:** 29 settembre 2026 (CEST)
- **Host/hardware:** Mac mini Apple M4, 24 GiB unified memory (dato del report B0)
- **Software:** MinerU 3.4.2; Marker `marker-pdf` 1.10.2; Surya OCR 0.17.1
- **Workspace:** `~/Workspace/teacher-service-design`
- **Stato Git:** questo workspace non contiene una directory `.git`; non è quindi disponibile un commit/ref da riportare.
- **Input:** corpus reale CORPUS staged in `validation/corpus/source/`; dettagli e hash qui sotto.

## Obiettivo e perimetro

Confrontare qualitativamente MinerU e Marker sul medesimo materiale CORPUS e scegliere la baseline minima di parsing utilizzabile a valle. Sono stati considerati fedeltà testuale, ordine/struttura, tabelle/formule e usabilità per chunking, retrieval e grounding. Il benchmark non è un conteggio di caratteri: i testi Markdown completi sono stati confrontati con estrazioni di riferimento del PDF e dell'OOXML; pagine campione dei PDF sono state anche renderizzate e ispezionate visivamente.

Sono state eseguite **9 conversioni effettive**: MinerU sui 6 file, Marker sui 3 PDF supportati. I tre tentativi Marker per DOCX/XLSX sono stati marcati `unsupported` e non sono stati convertiti artificialmente.

## Precondizioni e integrità del corpus

Eseguito dalla root del progetto:

```text
python3 validation/scripts/verify_bundle.py
VALIDATION_BUNDLE: PASS
Required files: 30
Corpus checksums: 6/6 PASS
```

La verifica è stata ripetuta anche dopo la produzione degli artifact; il risultato è rimasto `PASS`. `SHA256SUMS.txt` è presente e la sua impronta per audit è `02819fe54b44b624d5c4fb8bcb0cce56d4dbe3f7c58334033aad38f09f19d54b`.

Il prerequisito B0 è stato considerato sufficiente: `validation/results/B0-runtime-report.md` riporta lo smoke test reale di MinerU e Marker come `PASS` ed esito complessivo `PARTIALLY READY`, con B1 indicato come passo successivo. Sono stati letti i file obbligatori del task/ruolo: ruolo Validation Engineer; task B1; `COMMON_RULES.md`, `REPORT_TEMPLATE.md`, `SCORING.md`, `PROJECT_PATHS.md`; `docs/00-design-method.md`; Dossier 10 e 11; gate di fattibilità; manifest/corpus benchmark; report B0.

| Documento | Percorso relativo al corpus | Dimensione/struttura di riferimento | SHA-256 atteso e verificato |
|---|---|---|---|
| DBMS docente | `dbms-sql/dbms_teacher_script.pdf` | PDF, 7 pagine | `fac8f9e20063e60611ae1c6795aa7e47655d056abaa4426f147308d0b7191ff0` |
| DBMS studenti | `dbms-sql/dbms_student_lesson.pdf` | PDF, 3 pagine | `6a1277ba8c83bad71649aa55d2cb20ae8446eaa30985b7129f0c53bbc127623d` |
| Cybersecurity docente | `cybersecurity/cyber_teacher_script.pdf` | PDF, 6 pagine | `31255cb0abf374b41147f3b987ec0d3cdbcce293efea61491d92e6e3e3142917` |
| Storia docente | `history/history_teacher.docx` | DOCX, 98 paragrafi, 4 tabelle | `bb62fa1cb722ce6b3d46e0ea55a8d15e152ba0c966f64828e7fca03ff62c6c66` |
| Excel docente | `excel/excel_teacher.docx` | DOCX, 97 paragrafi, 41 tabelle | `f185672989b0f5603d1d829875e9b669cdd33e86e2747d9c3456d4f48cdb0bee` |
| Excel demo | `excel/excel_demo.xlsx` | XLSX, 5 fogli, 301 celle indirizzate (184 con valore non vuoto), 0 formule | `fb8a07d2bfc17839bf8cb3aa9955b36e12c7f4cbb9dfab620d38e05e60bd42b7` |

I sorgenti in `validation/corpus/source/` non sono stati modificati.

## Runtime, configurazione ed esecuzione

### MinerU

- Versione: **3.4.2**.
- Esecuzione tramite il launcher documentato `~/Workspace/development-environment/services/mineru/bin/mineru`, con `mode=auto`, backend `hybrid-engine`, effort `medium`, `formula=true`, `table=true`, `image-analysis=true`, `reprocess=true`.
- **Sorgente modelli locale verificata:** `~/Workspace/development-environment/services/mineru/mineru.json` ha `"model-source": "local"`; il launcher esporta `MINERU_MODEL_SOURCE=local`. Questo run ha usato il launcher e ha mantenuto la sorgente locale.
- Cache, home, temporanei e output di runtime del benchmark sono stati reindirizzati a `validation/work/B1/tmp/` o alle directory B1 previste.
- Comando batch riproducibile: `python3 validation/work/B1/scripts/run_b1.py --parser all`.

### Marker

- Versione: `marker-pdf` **1.10.2**, Surya OCR **0.17.1**.
- `marker_single <source> --output_format markdown --output_dir <B1 output> --disable_tqdm`; device impostato su MPS, OCR non forzato.
- È stato usato il model cache già presente; la configurazione impediva il fallback a download esterni.
- `TableRecEncoderDecoderModel` non è compatibile con MPS e ha eseguito il riconoscimento tabelle su CPU su tutti e tre i PDF.

I run MinerU/Marker sono sequenziali secondo lo script, con output grezzi e log conservati. Peak RAM non è stato raccolto. Le misure wall-time qui sotto sono del singolo run e non equivalgono a una prova di throughput o scalabilità.

## Risultati e scoring qualitativo

Scala 0–4 come da `validation/shared/SCORING.md`: 0 inutilizzabile, 1 richiede riscrittura, 2 usabile con difetti significativi, 3 buono con difetti minori, 4 quasi senza correzioni. `N/A` significa non pertinente/non esercitato. Tutte le conversioni effettivamente lanciate sono terminate con exit code 0.

| Documento | Parser | Fedeltà testo | Struttura/ordine | Tabelle | Formule | Usabilità B2 | Wall-time | Output totale parser |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| DBMS docente PDF | MinerU | 2 | 3 | 3 | N/A | 2 | 56,537 s | 1.021.589 B |
| DBMS docente PDF | Marker | 4 | 3 | 3 | N/A | 3 | 63,800 s | 38.089 B |
| DBMS studenti PDF | MinerU | 3 | 4 | 4 | N/A | 3 | 43,830 s | 429.792 B |
| DBMS studenti PDF | Marker | 4 | 4 | 4 | N/A | 4 | 41,243 s | 11.168 B |
| Cybersecurity PDF | MinerU | 2 | 3 | N/A | N/A | 2 | 38,988 s | 906.084 B |
| Cybersecurity PDF | Marker | 4 | 3 | N/A | N/A | 3 | 57,654 s | 26.810 B |
| Storia DOCX | MinerU | 4 | 4 | 4 | N/A | 4 | 12,921 s | 274.350 B |
| Storia DOCX | Marker | — | — | — | — | — | non eseguito | unsupported |
| Excel docente DOCX | MinerU | 4 | 3 | 4 | 3 | 3 | 12,929 s | 359.241 B |
| Excel docente DOCX | Marker | — | — | — | — | — | non eseguito | unsupported |
| Excel demo XLSX | MinerU | 4 | 3 | 3 | N/A* | 2 | 12,367 s | 90.071 B |
| Excel demo XLSX | Marker | — | — | — | — | — | non eseguito | unsupported |

`N/A*`: il sorgente Excel demo non contiene formule; la capacità di estrarle non è stata testata. “Output totale parser” è la somma delle dimensioni di tutti i file nella directory del run, inclusi JSON, PDF/layout e copie di input generate da MinerU; **non** è comparabile come misura di qualità o solo-testo tra parser.

### Osservazioni per documento

1. **DBMS docente PDF.** MinerU conserva la scansione temporale, la tabella della lezione e quasi tutto lo script, ma perde le righe `SELECT`, `FROM` e `JOIN` dell'esempio SQL finale; resta soltanto il frammento `ON`/`ORDER BY`. Sono presenti anche errori puntuali di trascrizione (ad es. `afidabili`, `diferenza`). Marker conserva l'intera query di JOIN e la tabella, ma unisce alcune etichette `SCRIPT VERBATIM` ai titoli e non racchiude sempre le query in code fence. Per fedeltà del codice, Marker è la scelta netta.
2. **DBMS studenti PDF.** Entrambi mantengono schema, promemoria SQL, tutti gli esercizi e l'esempio di JOIN. MinerU ha un errore di battitura isolato (`efettuate`) e query meno nettamente separate; Marker presenta una gerarchia pulita e la tabella schema in Markdown.
3. **Cybersecurity PDF.** MinerU omette per intero il paragrafo che definisce la vulnerabilità e gli esempi (password debole, software non aggiornato, computer sbloccato), pur mantenendo il testo prima e dopo: è una perdita semantica importante. Inoltre promuove alcune indicazioni operative a heading. Marker conserva quel paragrafo e gli esempi; alcune indicazioni/risposte attese restano inline con il testo parlato. Marker è il candidato migliore sul PDF.
4. **Storia docente DOCX.** MinerU mantiene la struttura in sezioni, le liste e tutte e quattro le tabelle: scaletta, timeline, errori da evitare e contenuti di supporto risultano leggibili e utilizzabili per chunking per sezione.
5. **Excel docente DOCX.** MinerU mantiene il percorso didattico, esempi, formule, soluzioni e tabelle. La struttura è però markup-heavy: molte consegne e battute sono emesse come tabelle HTML; le formule appaiono spesso inline in grassetto con caratteri Markdown escaped, non come blocchi formula/codice. È utilizzabile per retrieval testuale, non ancora ideale per grounding preciso delle formule senza normalizzazione.
6. **Excel demo XLSX.** MinerU riconosce e conserva tutti e cinque i fogli e i valori. La data visualizzata nel workbook viene serializzata in forma ISO con orario (`2026-09-01 00:00:00`); nel Markdown non compaiono gli indirizzi di cella e il contesto di visualizzazione/formato non è integralmente mantenuto. Confronto testuale automatico delle 184 celle non vuote contro la reference OOXML: 184/184 valori trovati nell’output dopo la normalizzazione delle date. Le 301 celle indirizzate includono anche celle vuote esplicitamente presenti nel worksheet; 0 formule. Il workbook ha zero formule, perciò non si può concludere sulla correttezza del parsing o della rappresentazione delle formule.

I razionali completi per ogni score sono in `validation/work/B1/metrics/qualitative-scoring.json`; gli appunti qualitativi in `validation/work/B1/metrics/inspection-notes.md`. Le reference di confronto sono in `validation/work/B1/metrics/source_reference/`.

## Prestazioni e anomalie

- MinerU: 6/6 successi, **177,572 s** complessivi; output directory aggregate **3.081.127 B**.
- Marker: 3/3 PDF supportati completati, **162,697 s** complessivi; 3 formati Office risultano unsupported e non sono stati eseguiti. Totale directory, inclusi i file `NOT_RUN_UNSUPPORTED.txt`: **76.451 B**.
- I totali non costituiscono confronto a parità di copertura, perché Marker ha processato solo tre PDF e MinerU tutti e sei i documenti; la durata dei singoli run è riportata in tabella.
- Nei log MinerU PDF compaiono `FutureWarning` relativo alla variabile cache Transformers deprecata e `SyntaxWarning` nel pacchetto MLX-VLM; nessun errore di conversione.
- Nei run MinerU DOCX/XLSX compaiono warning `No valid PDF or image files to process` e `Skipping visualization ... missing origin.pdf`; il Markdown e gli artefatti Office sono stati comunque prodotti con exit code 0. Sono warning del ramo di visualizzazione PDF, non un fallimento della conversione Office osservata.
- Marker segnala il fallback CPU del riconoscimento tabelle su MPS; run riusciti, ma il costo CPU va considerato quando crescerà il corpus.

## Ripristino MinerU e controllo documentazione

La configurazione è stata verificata in sola lettura dopo il ripristino richiesto: `model-source=local` nel `mineru.json` e `MINERU_MODEL_SOURCE=local` nel launcher. Ho controllato la documentazione del progetto, il report B0, il passaggio MinerU/Marker del Dossier 10, il README MinerU e la documentazione disponibile nell'ambiente di sviluppo. Nessun documento specifica o contraddice il valore `model-source`; il README elenca uso/flag/formati e posizionamento dei modelli, senza documentare quel parametro. **Non è stata quindi necessaria alcuna modifica documentale.** In questa ripresa non è stato modificato `development-environment`.

## Artifact normalizzati e file prodotti

È stato selezionato un Markdown downstream per ciascun input, copiato con encoding UTF-8 e newline LF, senza modifiche semantiche manuali. Le versioni grezze, i JSON intermedi e i log restano in `validation/work/B1/`.

| Artifact B1 | Parser selezionato | SHA-256 dell'artifact |
|---|---|---|
| `validation/artifacts/B1/dbms_teacher_script.md` | Marker 1.10.2 | `a6e48f68828ef44b3650b235bdf559eba4dae4a1a9ac507964b64fb7d0adc17d` |
| `validation/artifacts/B1/dbms_student_lesson.md` | Marker 1.10.2 | `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035` |
| `validation/artifacts/B1/cyber_teacher_script.md` | Marker 1.10.2 | `c85baabcb34dda03ce21a55fd09cc0ac8e1cda05ba0761c27cbc57ade7c77d1f` |
| `validation/artifacts/B1/history_teacher.md` | MinerU 3.4.2 | `613dcf10c2a0f7c87ebc0132e6ee240b35c17569b80bb3748ec2b02a4f03923d` |
| `validation/artifacts/B1/excel_teacher.md` | MinerU 3.4.2 | `55fdc46eff97cd9eafd1045484d0bd8165ba92b60aa9ddd67776b37f9a1e8b26` |
| `validation/artifacts/B1/excel_demo.md` | MinerU 3.4.2 | `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414` |

`validation/artifacts/B1/MANIFEST.json` contiene per ciascun artifact: sorgente e SHA-256 del sorgente, parser/versione, parametri, percorso artifact e SHA-256 dell'artifact. La selezione è riproducibile con `validation/work/B1/scripts/select_artifacts.py`.

Sono inoltre conservati:
- output grezzi: `validation/work/B1/outputs/{mineru,marker}/`;
- log completi: `validation/work/B1/logs/`;
- metriche runtime: `validation/work/B1/metrics/run-metrics.json`;
- reference native e render PDF: `validation/work/B1/metrics/source_reference/` e `validation/work/B1/tmp/source_renders/`;
- runner e strumenti B1: `validation/work/B1/scripts/`;
- score e note: `validation/work/B1/metrics/qualitative-scoring.json` e `inspection-notes.md`.

## Gap concreti e impatto su B2

1. **Conservazione di indirizzi/celle e formule XLSX:** il Markdown MinerU non porta gli indirizzi espliciti delle celle; la sorgente campionata non contiene formule. Prima di rispondere a query cell-specific, calcoli o domande formula-aware è necessaria una route nativa XLSX verificata su un workbook con formule. Non installare un terzo parser per questo gap senza prima verificare un fast path nativo.
2. **Varianza MinerU sui PDF:** una perdita di paragrafo su Cybersecurity e una query SQL incompleta sullo script DBMS rendono MinerU un fallback possibile ma da validare per contenuto, non una sostituzione automatica di Marker.
3. **Prestazioni Marker su tabelle:** TableRec su CPU; impatto su corpus più ampio non misurato.
4. **Normalizzazione dei contenuti Office:** le formule del DOCX Excel e alcune tabelle HTML richiedono una fase futura di normalizzazione se B2 deve fornire evidenza precisa su formule o singole celle.

**Impatto operativo su B2:** può procedere con i sei artifact presenti per ricerca testuale e recupero di sezioni. Escludere per ora risposte che richiedano citazioni di coordinate XLSX, calcolo da celle o validazione delle formule. Questa condizione rende `IMPROVE` non bloccante per il task B2 definito, ma va mantenuta visibile nei risultati di B2.

## Non testato

- PDF scansiti/immagini pure, OCR degradato, manoscrittura, layout multi-colonna complesso, lingue diverse dall'italiano e tabelle che attraversano molte pagine.
- DOCX/XLSX con formule effettive, formule condivise, grafici/figure complesse o esigenze di recupero cella-indirizzo; nessun dato di questo tipo era presente nel file Excel demo.
- Marker su DOCX, XLSX, PPTX e formati diversi da PDF/immagini: esplicitamente unsupported nel wrapper installato, quindi non convertiti.
- Peak RAM, throughput su batch grande e prestazioni di Marker con TableRec interamente su MPS.
- Retrieval, embeddings, modelli generativi o qualsiasi parte di B2/B3/B4.

## Filesystem containment check

**Filesystem containment check: PASS.** Le directory di lavoro, gli output parser, i log, le metriche, i render temporanei, i sei artifact normalizzati, il manifest e questo report risiedono sotto `~/Workspace/teacher-service-design/`. La scansione non ha trovato symlink o file derivati fuori dalla root; il `__pycache__` generato durante i controlli è stato spostato in `validation/work/B1/tmp/pycache/`. I soli percorsi esterni utilizzati sono runtime/config/modelli già presenti e letti/eseguiti dal `development-environment`; il corpus non è stato modificato.

## Esito finale e prossimo passo

**IMPROVE.** Baseline B1 consigliata: **Marker per PDF; MinerU `hybrid-engine` per DOCX/XLSX; MinerU fallback per PDF solo con controllo qualità sul contenuto.** Nessun nuovo parser è stato installato. B2 può usare gli artifact per retrieval testuale; l'uso cell-level del workbook resta esplicitamente fuori dalla baseline finché non sarà validata l'estrazione nativa con coordinate e formule. Il task B1 termina qui.
