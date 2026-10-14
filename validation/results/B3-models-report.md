# B3 — Benchmark dei modelli general-purpose per T1

## Decisione

# **CONDITIONAL**

Fra i candidati locali testati, MiniCPM5-2B è nettamente il più rapido ma non produce in modo affidabile il lesson pack completo; Ornith-1.5-9B non dimostra un vantaggio sufficiente per Teacher Script/metadata e ha latenza elevata, troncamenti e un run bloccato. Nessuno dei due dimostra di poter fornire da solo il pacchetto T1 nel livello d’uso richiesto dal prodotto.

T1 può operare **senza API esterna obbligatoria soltanto come modalità locale di bozze**, con revisione e correzione docente esplicite e senza promettere un Teacher Script già utilizzabile con interventi minimi. Se il requisito resta un Teacher Script esteso e quasi-verbatim pronto a sostenere una lezione, le evidenze B3 non provano che l’attuale route locale sia sufficiente. Il modello remoto ha una differenza qualitativa concreta, ma resta una quality ceiling opzionale, non una dipendenza del dominio. Il gate end-to-end T1 non è stato eseguito in B3.

La scelta di **CONDITIONAL** segue il gate B3: la generazione locale può sostenere task rapidi e alcune bozze, ma non ha superato la parte Teacher Script. Non è un esito `REJECT` dell’intero progetto né una prova di impossibilità di una futura route locale/composita.

## Metadata

- **Ruolo:** Model Evaluation Engineer
- **Task:** B3 — Small / General Model Benchmark
- **Data:** 29 settembre 2026 (Europe/Rome, CEST)
- **Host/hardware:** Mac mini Apple M4, 24 GiB di memoria unificata, arm64, macOS 27.0
- **Software:** oMLX 0.6.4; Ollama 0.34.4; OmniRoute presente, versione non esposta; Python 3.14.7
- **Workspace:** `~/Workspace/teacher-service-design`
- **Stato Git:** nessuna directory `.git` nel workspace, quindi nessun commit/ref disponibile
- **Input corpus:** bundle B1 verificato; dettagli e impronte delle fonti nella sezione “Separazione source/reference” e in `validation/work/B3/metrics/source-separation-audit.json`.

## Objective

Verificare, con task reali Teacher Service e non con score pubblici, se i modelli locali già disponibili possono produrre per T1 un Lesson Plan, un Teacher Script esteso/quasi-verbatim, Student Material distinto e metadata JSON strutturato, con qualità tale da ridurre il lavoro residuo del docente.

## Preconditions

Prima del benchmark è stato eseguito dalla root del progetto:

```text
python3 validation/scripts/verify_bundle.py
VALIDATION_BUNDLE: PASS
Required files: 30
Corpus checksums: 6/6 PASS
```

La verifica è stata ripetuta alla chiusura ed è rimasta `PASS`. B0 riporta oMLX operativo e l’inventario dei modelli già presenti; Gemma 4 non risultava disponibile e non è stata scaricata. Ollama non aveva modelli generativi utili (era presente `nomic-embed-text`); quindi non è stato aggiunto un candidato Ollama solo nominale. Nessun runtime o modello è stato installato.

## Separazione source/reference e validità degli scenari

| Scenario | Source set effettivamente fornito | Target/reference held-out | Motivazione della separazione e limiti |
|---|---|---|---|
| **DBMS/SQL** | `validation/work/B3/inputs/scenario_sources/dbms_student_lesson.md` (artifact B1 `dbms_student_lesson.md`, SHA-256 `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`) | Target: `validation/corpus/source/dbms-sql/dbms_teacher_script.pdf`; reference normalizzata: `validation/artifacts/B1/dbms_teacher_script.md` (SHA-256 `a6e48f68828ef44b3650b235bdf559eba4dae4a1a9ac507964b64fb7d0adc17d`) | È stata fornita la scheda studenti, non lo script docente usato come reference. Sono artifact distinti, benché tematicamente collegati; il confronto held-out è limitato a copertura macro, sequenza e usabilità, non a similarità testuale. |
| **Excel** | `validation/work/B3/inputs/scenario_sources/excel_demo_no_cellrefs.md`, versione filtrata del testo B1 del workbook demo (SHA-256 `ec0151a94b9ce9ed6ae4d505cbe0f300f7c33c7a11cbc071042954aeda5d960d`) | Target: `validation/corpus/source/excel/excel_teacher.docx`; reference normalizzata: `validation/artifacts/B1/excel_teacher.md` (SHA-256 `55fdc46eff97cd9eafd1045484d0bd8165ba92b60aa9ddd67776b37f9a1e8b26`) | Il DOCX docente non è stato dato ai modelli. B1 non ha validato formule né coordinate cella-per-cella: input e istruzioni vietano formule, celle/range e risultati formula-specifici. Il confronto col reference riguarda solo obiettivi, sequenza generale e usabilità. |
| **Partial-source DBMS** | `validation/work/B3/inputs/scenario_sources/dbms_partial_excerpt.md` (SHA-256 `c8992a2c9d1b5476f64b905c268c0553e96287b51b6d23d0a9a0b675a6d6ce56`), estratto limitato della scheda studenti | Target e reference: lo stesso Teacher Script DBMS held-out indicato sopra | L’estratto è un artifact fonte distinto e omette intenzionalmente sintassi SQL/esercizi. È un test della capacità di fermarsi ai contenuti supportati e dichiarare il tempo non coperto, non di completare a ogni costo 120 minuti. |
| **Cybersecurity** | Non disponibile un source artifact separato dal Teacher Script finale presente nel bundle | `validation/corpus/source/cybersecurity/cyber_teacher_script.pdf` | **INSUFFICIENT_SOURCE_SEPARATION**: usare lo stesso script sia come input di generazione sia come reference del Teacher Script avrebbe contaminato il test. Escluso senza valutare i modelli. |
| **History** | Non disponibile un source artifact separato dal materiale/script docente finale presente nel bundle | `validation/corpus/source/history/history_teacher.docx` | **INSUFFICIENT_SOURCE_SEPARATION**: nessuna fonte distinta sufficiente; generare e giudicare sullo stesso artifact avrebbe introdotto leakage. Escluso senza valutare i modelli. |

L’audit automatizzato ha confermato che gli hash attesi e osservati di source e reference coincidono, che i request salvati non contengono il percorso né il testo held-out della reference, e che le esclusioni hanno lo stato richiesto. In Excel la scansione ha trovato **due occorrenze di `$A$1`** nell’output Teacher Script di Ornith: è una violazione del vincolo di non introdurre coordinate, non un riferimento fornito o validato da B1, ed è stata conteggiata come difetto/hallucination. Gli altri output Excel v3 non hanno mostrato formule o coordinate nel controllo automatizzato. Il controllo testuale non sostituisce una verifica semantica completa.

Per ciascuno scenario generato sono stati chiesti tutti e quattro gli artifact. Il reference held-out è stato usato soltanto nel controllo manuale del Teacher Script; Lesson Plan, Student Material e JSON sono stati giudicati contro source set, contratto di output e vincoli, non contro lo script held-out.

## Setup e fairness

- **Locale veloce obbligatorio:** `MiniCPM5-2B-MLX` via oMLX.
- **Confronto locale strong selezionato:** `Ornith-1.5-9B-MLX-4bit` via oMLX, scelto tra i modelli già presenti per aggiungere un confronto mid/strong locale senza allargare inutilmente la matrice.
- **Quality ceiling remoto:** `agy/gemini-3.8-flash-tiered` via OmniRoute; non candidato al core locale.
- **Non testati:** `Ornith-1.5-9B-uncensored-MLX-6bit` e `Qwen3.8-27B-oQ4e-mtp`; non sono inclusi nella conclusione “migliore locale”, che vale solo fra i candidati effettivamente misurati. Gemma 4 assente e non installata.
- **Parametri comuni per richiesta:** temperature `0.2`, top-p `0.9`, `max_tokens=8500`, streaming e richiesta usage. Per ogni coppia scenario/artifact i request v3 sono identici salvo l’ID del modello. La matrice v3 ha 12 richieste per MiniCPM5, 12 per Gemini e 9 metricate per Ornith; per gli ultimi due artifact partial-source di Ornith, non avviati dopo il run bloccato, non esiste confronto.
- **Prompt comune:** istruzioni in italiano, fedeltà alla fonte, gap espliciti, vincoli di aula, quattro sezioni contrattuali, Teacher Script pronunciabile con cues/domande/esempi/esercizi e Student Material distinto. Il prompt chiede per i pacchetti da 120 minuti 1.600–2.100 parole effettivamente utilizzabili, ma precisa che l’attività studentesca/feedback deve coprire il tempo e non un monologo. Nel partial-source non si deve inventare contenuto per arrivare a 120 minuti.
- Gli output v3 sono salvati per scenario e artifact, inclusi request, `response.raw.md`, metriche e metadata normalizzati quando validi. Sono conservati anche i pilot one-shot/split-v2, ma non entrano nei punteggi comparativi v3. Non è stato usato un LLM come giudice.

## Results — qualità e sforzo docente

Scala qualitativa 0–4 come in `validation/shared/SCORING.md`. Le medie “qualità” sotto aggregano le prime otto dimensioni (source fidelity, factual correctness, completeness, pedagogical usefulness, level, duration, structure, hallucinations); **editing effort è riportato separatamente**, per non confondere difetti e lavoro residuo.

| Modello | Artifact valutati | Complete v3 | Media 8 dimensioni | Editing effort medio (0–4) | Classificazione editing |
|---|---:|---:|---:|---:|---|
| MiniCPM5-2B-MLX | 12/12 | 8/12 | 1,54 | 1,00 | 1 minor, 2 moderate, 5 major rewrite, 4 unusable |
| Ornith-1.5-9B-MLX-4bit | 9/12 pianificati | 4/9 metricati | 2,04* | 1,33* | 2 minor, 2 moderate, 2 major rewrite, 3 unusable* |
| Gemini 3.8 Flash Tiered | 12/12 | 12/12 | 3,69 | 2,75 | 9 minor, 3 moderate; nessun output classificato usable-as-is |

`*` Ornith è una matrice incompleta e ha un Teacher Script partial-source rimasto senza risposta: i valori descrivono soltanto i nove artifact valutabili e non sono direttamente rappresentativi dei 12 pianificati.

### Differenza qualitativa effettiva

- **MiniCPM5:** buona rapidità e qualche Student Material/metadata breve recuperabile, ma pacchetto disomogeneo e Teacher Script non pronto. Nel DBMS lo script è circa 1.283 parole contro il target orientativo e copre circa 80 minuti con tempi dichiarati per una lezione di 120; ripete cues e contiene una query finale non corretta. Il Lesson Plan introduce dettagli non supportati. In Excel il modello va in ripetizione/troncamento: Teacher Script e Student Material troncati a 8.500 token; metadata Excel invalido. Nel partial-source tenta di riempire lacune con attività SQL non sostenute dalla fonte invece di fermarsi al segmento difendibile.
- **Ornith 9B:** Student Material DBMS è il suo risultato migliore e può richiedere ritocchi limitati; anche alcuni altri output sono leggibili. Non si traduce però in script o JSON affidabili: Teacher Script DBMS/Excel troncati, metadata DBMS invalido, metadata Excel con code fence e scenario ID non conforme al contratto raw. Teacher Script Excel contiene commentary autoriferito e due coordinate `$A$1` vietate. Il Lesson Plan partial-source è troncato, ripetitivo e contraddittorio sui minuti supportati. Il Teacher Script partial-source è stato interrotto senza output completato dopo circa 21m31s; gli ultimi due artifact non sono stati lanciati.
- **Gemini via OmniRoute:** è il solo candidato con 12/12 deliverable completi e tre JSON validi. Produce gli script più utilizzabili: fasi, transizioni, domande/risposte, esercizi e feedback; gestisce correttamente le lacune del partial-source e, nel caso Excel, evita coordinate/formule. La distanza rispetto ai locali è sostanziale soprattutto nella completezza e nell’usabilità del Teacher Script. Non è comunque “pronto senza review”: nessun output è stato classificato usable-as-is. I tre script/plan completi possono risultare molto lunghi; nel DBMS lo script (~3.257 parole) introduce dettagli SQL non presenti, inclusi ROUND() e una formula specifica di sconto; l’Excel va verificato rispetto al workbook effettivo e potato. La review docente resta necessaria.

La metrica centrale non è la prosa in sé ma il lavoro per avere materiale davvero utilizzabile in aula: il remote riduce il lavoro a **minor edits** in 9 casi e **moderate edits** in 3; MiniCPM5 richiede **major rewrite** in 5 casi e risulta **unusable** in 4. Ornith non offre un vantaggio affidabile sullo script lungo.

### Structured metadata e Student Material

Gemini produce JSON valido in tutti e tre gli scenari e Student Material distinti. MiniCPM5 produce JSON valido nel DBMS e nel partial-source ma con errori di ID, coerenza o gap; Excel è troncato/invalido. Ornith non consegna JSON raw conforme nei due casi metricati (DBMS troncato; Excel fenced e con ID difforme). I migliori handout locali sono quelli DBMS; non compensano il mancato Teacher Script end-to-end. La distinzione dei due artifact va valutata nel merito: un handout conciso non equivale a un copione docente.

## Runtime, risorse e anomalie

| Modello | N misure v3 | TTFT mediano | Tempo totale mediano | tok/s mediano riportato | Lunghezza visibile totale | RSS di processo oMLX campionata, max |
|---|---:|---:|---:|---:|---:|---:|
| MiniCPM5-2B-MLX | 12 | 1,326 s | 19,231 s | 62,998 | 22.942 parole | 4.178,7 MB |
| Ornith-1.5-9B-MLX-4bit | 9 | 123,471 s | 236,304 s | 38,421 | 19.948 parole | 4.537,4 MB |
| Gemini 3.8 Flash Tiered | 12 | 10,575 s | 16,919 s | 741,290 | 16.822 parole | N/A locale |

Le velocità locali e OmniRoute non sono rigorosamente confrontabili: usage e modalità di calcolo dei token dipendono dal provider/runtime. Il TTFT remote include la route verso OmniRoute/provider; non è equivalente alla sola inferenza locale. L’RSS è un campionamento del processo oMLX, non il picco totale della memoria unificata/Metal del sistema; non è stato possibile ricavare un dato di picco RAM totale comparabile. Gemini riporta 69.846 completion token e 99.791 token complessivi nei suoi usage record; due risposte Teacher Script riportano completion token oltre `max_tokens=8500` pur con `finish_reason=stop` e includono token di reasoning. Sono contatori del provider, non una misura omogenea della sola prosa visibile. Non è disponibile un costo monetario verificabile per richiesta.

Il run Ornith partial-source Teacher Script è stato arrestato dall’operatore alle 23:59:56 CEST del 29 settembre 2026: richiesta iniziata alle 23:38:25, circa 1.291 secondi senza risposta o raw output persistito; oMLX era inattivo all’osservazione. Arresto per limitare risorse, non timeout inventato del modello. `ornith-run-status.json` conserva l’evento e gli artifact non avviati.

## Failures / anomalies

- MiniCPM5: quattro `finish_reason=length` su 12 (Excel metadata, Student Material, Teacher Script; partial-source Teacher Script). Risposte API HTTP 200 non significano deliverable completi. Output ripetitivo/troncato in Excel.
- Ornith: quattro troncamenti su nove metriche; una violazione di contratto raw JSON; un run stazionario interrotto dopo oltre 21 minuti; due artifact non avviati. Una risposta Excel ha inoltre introdotto due riferimenti di cella vietati.
- Gemini: nessun fallimento di completamento nel set misurato; lunghezza e aggiunte tecniche DBMS richiedono controllo. Nessun costo/provider RAM disponibile.
- Variance, robustezza multi-run e sensibilità a prompt diversi non sono stati misurati: una risposta per artifact/modello, temperature 0,2.
- Gli output raw dei pilot sono supplementari e non vanno mescolati alla matrice comparativa v3.

## Interpretation

### Fatti misurati

- Le richieste v3 sono esattamente uguali salvo model ID nei 10 accoppiamenti con tutti e tre i candidati; per metadata/student-material partial-source Ornith, non eseguiti, rimangono due accoppiamenti con due candidati.
- Source/reference hash verificati; nessuna request contiene il testo del Teacher Script held-out. Cybersecurity e History sono state escluse correttamente per `INSUFFICIENT_SOURCE_SEPARATION`.
- MiniCPM5 è il best fast local misurato; Ornith è l’unico strong-local comparatore misurato. Nessuno ha completato in modo affidabile tutti i quattro output nei tre scenari.
- Gemini ha completato tutti i 12 output e si avvicina di più all’obiettivo di Teacher Script, con revisione umana comunque richiesta.

### Interpretazione

La differenza qualitativa locale/remote non è marginale né solo stilistica: i candidati locali falliscono più spesso lunghezza/struttura/controllo delle lacune proprio nel Teacher Script e nel JSON machine-consumable. La maggiore velocità MiniCPM5 non compensa il tempo di riscrittura. Ornith impone ulteriore latenza senza la qualità long-form attesa. L’evidenza supporta una route esplicita per profilo/capability, non un solo modello universale, ma B3 non valida ancora routing o pipeline multi-modello.

## Decision

**CONDITIONAL.** Fra i modelli locali effettivamente testati:

- **Best fast local:** MiniCPM5-2B-MLX — rapido, utile per bozze o task brevi e alcuni handout, ma non accettabile come generatore autonomo del lesson pack T1.
- **Best strong local (candidate tested):** Ornith-1.5-9B-MLX-4bit — unico comparatore strong locale; non è raccomandato per produzione Teacher Script sulla base di questa prova, dati troncamenti, latenza e run bloccato. “Best” qui indica il candidato della fascia testato, non un endorsement né il migliore di tutto l’inventario.
- **Remote quality ceiling:** `agy/gemini-3.8-flash-tiered` via OmniRoute — qualità nettamente maggiore, ma review umana e controllo factual restano obbligatori; remote/API resta opzionale a livello architetturale.

**Senza API esterna obbligatoria:** possibile solo se T1 viene presentato come generazione locale di bozze soggette a revisione obbligatoria, senza promessa di copione quasi-verbatim pronto con modifiche minime. Per la promessa completa di T1, B3 non fornisce prova sufficiente di sufficienza locale; la route remota ha ridotto concretamente lo sforzo ma non è stata validata come requisito o come pipeline end-to-end. Non dichiarare il foundation T1 tecnicamente feasible sulla sola base di B3.

## Files produced

- Report: `validation/results/B3-models-report.md`
- Protocollo, prompt e separazione scenari: `validation/work/B3/inputs/`
- Output raw v3 e pilot, request e metriche per modello/scenario: `validation/work/B3/outputs/`
- Metriche e audit: `validation/work/B3/metrics/metrics-summary.json`, `validation/work/B3/metrics/metrics-summary.csv`, `validation/work/B3/metrics/source-separation-audit.json`, `validation/work/B3/metrics/ornith-run-status.json`, `validation/work/B3/metrics/environment.json`
- Rubric manuale: `validation/artifacts/B3/manual-scorecard.json`
- Manifest B3: `validation/artifacts/B3/MANIFEST.json`

**Filesystem containment check: PASS.** Tutti gli artifact creati o aggiornati da questo task risiedono sotto `~/Workspace/teacher-service-design/`; nessun nuovo runtime/modello è stato introdotto.

## Not tested

- Cybersecurity e History: escluse per source/reference leakage, non per qualità del modello.
- `Ornith-1.5-9B-uncensored-MLX-6bit`, `Qwen3.8-27B-oQ4e-mtp`, Gemma 4 (assente), modelli generativi via Ollama (nessuno disponibile in B0).
- B5 end-to-end, B6, integrazione UI, generazione in più run/seed, costo monetario remote, picco totale di memoria unificata, test con docenti reali cronometrati e quantificazione empirica dell’editing time.
- Uso Excel cell-aware/formula-aware; escluso deliberatamente perché B1 non ha validato coordinate o formule XLSX. Nessun modello doveva inferirle o citarle.
- Idoneità produzione/sicurezza dei contenuti oltre il perimetro delle fonti e degli artifact indicati.

## Next step

Per avanzare T1 senza assumere che un API sia obbligatoria, definire una modalità locale **draft + review** e misurarne il lavoro residuo con docenti; mantenere Teacher Script come gate esplicito. Se il requisito resta “quasi verbatim con modifiche minime”, valutare un candidato locale strong aggiuntivo solo con ragione informativa concreta, poi eseguire il gate B5 separatamente. B5/B6 non sono stati avviati.
