# Grounding & Generation Contract — Correzione Metodologica Post Gate B/C

> **Stato:** Proposta architetturale e metodologica validata tecnicamente (soggetta ad approvazione finale di prodotto da parte dell'utente)  
> **Ruolo:** AI Platform Architect  
> **Data:** 30 settembre 2026 (Europe/Rome)  
> **Oggetto:** Ridefinizione del contratto epistemico di grounding e generazione, audit del gold set Gate B, risoluzione delle contraddizioni sperimentali Gate C e specifica della generazione composita.  
> **Workspace:** `~/Workspace/teacher-service-design`

---

## 1. Executive Summary e Decisione Fondamentale di Prodotto

A seguito dell'analisi approfondita dei risultati dei benchmark Gate B (`Gate-B-local-capabilities-report.md`, `Gate-B-annotation-pack-report.md`) e Gate C (`Gate-C-remote-models-report.md`), è emersa una fondamentale criticità metodologica nell'impostazione originaria della valutazione:
l'assunzione implicita che un sistema di generazione didattica debba operare come un puro estrattore o parafrasatore letterale delle fonti.

### 1.1 La Decisione di Prodotto Proposta
La direzione architetturale e di prodotto proposta stabilisce che:
> **Il Teacher Service ha come scopo la generazione di nuovo materiale didattico coerente, pedagogicamente efficace e fruibile per la classe.**  
> Il servizio **non deve essere limitato alla parafrasi letterale o alla mera trascrizione delle fonti documentali.**  
> Un modello che progetta un copione docente (*Teacher Script*), una scheda operativa per studenti (*Student Material*) o un piano di lezione (*Lesson Plan*) deve poter integrare conoscenze generali consolidate della disciplina, proporre esempi didattici, formulare analogie, definire domande-guida ed effettuare deduzioni logico-matematiche, purché non alteri i fatti storici/tecnici delle fonti, non attribuisca falsamente alla fonte ciò che è frutto di proposta pedagogica e non inventi dettagli fisici/strutturali specifici non verificabili.

### 1.2 Sintesi dei Risultati dell'Audit
1. **Contratto Epistemico a 5 Classi:** Formalizzata la distinzione qualitativa tra `SOURCE_FACT`, `SOURCE_DERIVED`, `GENERAL_DOMAIN_KNOWLEDGE`, `PEDAGOGICAL_PROPOSAL` e `SOURCE_SPECIFIC_DETAIL`, con rispettive regole di provenance, ammissibilità, checker e soglie di violazione;
2. **Audit del Pacchetto di Annotazione Umana Gate B (82 casi):**
   - **KEEP: 61 casi (74.4%)** — annotazioni umane valide e coerenti con le evidenze;
   - **RELABEL_RECOMMENDED: 6 casi (7.3%)** — correzione di etichettature per conciliazione con il contratto epistemico e falsa attribuzione (GB-GR-002, GB-GR-016, GB-GR-034, GB-GR-035 [-> UNSUPPORTED], GB-AC-016, GB-AC-021);
   - **REBUILD_CONTEXT: 13 casi (15.9%)** — ricostruzione di estratti fonte eccessivamente troncati o formulati con parafrasi del reviewer anziché con testo raw (GB-GR-007..012, GB-GR-015, GB-GR-028, GB-GR-030, GB-GR-033, GB-GR-037, GB-GR-039, GB-GR-046);
   - **DROP: 1 caso (1.2%)** — eliminazione di meta-claim relativi al setup del benchmark estranei al dominio didattico (GB-GR-032);
   - **RECLASSIFY_TASK: 1 caso (1.2%)** — riclassificazione di casi legati alla contraddizione metodologica Excel (GB-AC-018);
3. **Risoluzione della Contraddizione Excel Gate C:** Identificato il corto-circuito sperimentale tra la fonte di benchmark priva di coordinate/formule (`excel_demo_no_cellrefs.md`) e il riferimento reale del docente (`excel_teacher.md`), definendo la procedura di allineamento senza leakage;
4. **Specifiche dello Spreadsheet Adapter Cell-Aware:** Dichiarata la necessità (**SÌ**) di un parser/adapter deterministico strutturato per workbook XLSX, separato da MinerU;
5. **Pipeline di Generazione Remota Composita:** Superata la chiamata longform monolitica a favore di un'architettura orchestrata in 6 stadi: `Plan → Bounded Sections → Assembly → Local Checks → Bounded Repair → Human Review`;
6. **Preflight a 3 Livelli per Gate C:** Formalizzato il protocollo `Candidate → Probe → Cohort` per evitare che guasti d'infrastruttura consumino slot di benchmark.

---

## 2. Il Nuovo Contratto Epistemico di Grounding e Generazione

Per garantire rigore scientifico e al contempo preservare il valore didattico generativo, ogni contenuto prodotto dai modelli o annotato nei gold set deve essere ricondotto a una delle seguenti **cinque classi epistemiche**.

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           IL CONTRATTO EPISTEMICO                                 │
├─────────────────────────┬─────────────────────────────────────────────────────────┤
│ SOURCE_FACT             │ Fatto direttamente attestato nella fonte documentale    │
├─────────────────────────┼─────────────────────────────────────────────────────────┤
│ SOURCE_DERIVED          │ Deduzione logico-matematica da dati presenti            │
├─────────────────────────┼─────────────────────────────────────────────────────────┤
│ GENERAL_DOMAIN_KNOWLEDGE│ Conoscenza disciplinare generale (non della fonte)       │
├─────────────────────────┼─────────────────────────────────────────────────────────┤
│ PEDAGOGICAL_PROPOSAL    │ Esempio, esercizio, domanda, analogia inventata         │
├─────────────────────────┼─────────────────────────────────────────────────────────┤
│ SOURCE_SPECIFIC_DETAIL  │ Coordinata fisica, formula workbook, nome file specifico │
└─────────────────────────┴─────────────────────────────────────────────────────────┘
```

### 2.0 Principi Guida: Granularità, Composabilità e Non-Performatività

1. **Granularità Semanticamente Rilevante (Minimum Sufficient Provenance):**
   - Il contratto epistemico **non impone un sentence-level classifier obbligatorio** in cui ogni singola frase del Teacher Script debba essere etichettata e persistita;
   - La tracciatura governa gli span e i claim operativamente e concettualmente rilevanti;
   - `SOURCE_FACT` e `SOURCE_SPECIFIC_DETAIL` richiedono provenance puntuale quando presentati come fatti della fonte;
   - `SOURCE_DERIVED` richiede provenance quando la derivazione è materialmente importante;
   - `GENERAL_DOMAIN_KNOWLEDGE` e `PEDAGOGICAL_PROPOSAL` possono essere gestite a livello di blocco, sezione o intero task didattico;
   - Si evita sistematicamente un sovraccarico onnipresente di annotazione (evitare ontologie complesse inutili).

2. **Composabilità delle Classi (Primary Epistemic Role + Evidence Dependencies):**
   - Le cinque classi non sono concepite come compartimenti stagni mutuamente esclusive;
   - Un asserto complesso o un'istruzione operativa presenta un **Ruolo Epistemico Primario** (`primary epistemic role`) sostenuto da **Dipendenze di Evidenza** (`evidence dependencies / supporting roles`);
   - *Esempio Didattico (Excel):* L'istruzione docente *"Digitiamo in D2 la formula =B2*(1-C2) per calcolare il netto applicando il tasso di sconto"* si compone di:
     - **`Primary Epistemic Role`:** `PEDAGOGICAL_PROPOSAL` (la scelta metodologica di proporre questa operazione agli studenti);
     - **`Supporting Role 1 (Struttura)`:** `SOURCE_SPECIFIC_DETAIL` (le coordinate fisiche `D2`, `B2`, `C2` devono essere reali e validate sull'AST del workbook);
     - **`Supporting Role 2 (Logica)`:** `SOURCE_DERIVED` o `GENERAL_DOMAIN_KNOWLEDGE` (la correttezza della formula matematica rispetto alle unità del foglio);
   - Questa architettura leggera risolve le ambiguità senza costruire tassonomie sovrabbondanti.

---

### 2.1 SOURCE_FACT (Fatto Primario di Fonte)
- **Definizione:** Asserzione, dato, proprietà, definizione, regola o evento storico/tecnico esplicitamente presente e documentato nel Source Set fornito alla pipeline;
- **Quando è ammessa:** Sempre ammessa; costituisce il fondamento della fedeltà documentale;
- **Provenance richiesta:** Tracciamento obbligatorio e puntuale (`source_id`, `chunk_id`, riga o range di testo);
- **Checker preposto:** 
  - **Gli embeddings e la cosine similarity NON sono entailment checker:** essi servono esclusivamente a monte per il *recupero delle candidate evidence* (individuare i passaggi semanticamente rilevanti nel corpus);
  - La verifica di grounding segue la pipeline concettuale:
    $$\text{Candidate Evidence Retrieval (Embedding/Lexical)} \longrightarrow \text{Deterministic Exact Check (se applicabile)} \longrightarrow \text{Bounded Semantic Verification / Review}$$
  - Il verdetto di `SUPPORTED` o `UNSUPPORTED` richiede matching esatto o un bounded semantic check (modello di estrazione vincolato), non un mero punteggio di similarità vettoriale;
- **Teacher Review:** Ordinaria (L3 Prepare, verifica campionaria o revisione della lezione);
- **Cosa costituisce Allucinazione / Violazione:**
  - Asserire l'esistenza di una tabella, di una colonna, di una data storica o di una regola attribuendola al testo sorgente quando questa è assente o smentita dal testo stesso;
  - *Falsa attribuzione materiale:* Affermare *"La fonte definisce X"* quando la fonte si limita a nominare un'intestazione o un dato senza definirne il significato (es. GB-GR-035).

---

### 2.2 SOURCE_DERIVED (Fatto Derivato / Inferenza Logica)
- **Definizione:** Conclusione analitica, calcolo aritmetico, conversione di formato, ordinamento o aggregazione logica ottenuta a partire da elementi informativi presenti nella fonte mediante passaggi deduttivi evidenti e corretti;
- **Quando è ammessa:** Pienamente ammessa e incoraggiata, poiché permette di collegare dati sparsi e produrre spiegazioni organiche;
- **Semantica Dimensionale e Correttezza Matematica:**
  - Non introdurre formule come regole generali se la semantica delle unità non è nota;
  - *Esempio Excel reale:* Nel corpus didattico, il campo `Sconto` rappresenta un **tasso percentuale** (es. `0`, `0.05`, `0.10`, `0.15`). Pertanto non è dimensionalmente corretto sottrarlo direttamente dal lordo ($Lordo - Sconto$). La formulazione corretta è:
    $$\text{Netto} = \text{Lordo} \times (1 - \text{Sconto})$$
    oppure una formulazione concettuale astratta che distingua l'importo dello sconto dal tasso:
    $$\text{Importo\_Netto} = \text{Lordo} - \text{Valore\_Sconto} \quad \text{con} \quad \text{Valore\_Sconto} = \text{Lordo} \times \text{Tasso\_Sconto}$$
- **Distinzione tra Derivazioni Formalizzabili e Inferenze Semantiche:**
  - **Tipo A — Derivazioni Formalizzabili:** Aritmetica, conversioni dimensionali, percentuali, ordinamenti, aggregazioni tabellari. $\longrightarrow$ Verificabili tramite **checker deterministico locale** (zero-AI);
  - **Tipo B — Inferenze Semantiche Non Formalizzabili:** Deduzioni logico-concettuali o testuali di contesto non riducibili ad algebra. $\longrightarrow$ Verificabili tramite **bounded semantic checker** o **Teacher Review**;
  - Il sistema predilige derivazioni formalizzabili (Tipo A) ovunque possibile;
- **Provenance richiesta:** Lista dei `chunk_id` sorgente da cui l'inferenza è stata tratta (`derived_from`) unitamente all'esplicitazione della regola applicata;
- **Teacher Review:** Ordinaria; segnalazione con badge `derived` per evidenziare il passaggio logico;
- **Cosa costituisce Allucinazione / Violazione:** Errori di calcolo aritmetico, deduzioni dimensionalmente errate (es. sottrarre un tasso da una valuta) o falsa attribuzione della deduzione alla lettera del testo originale.

---

### 2.3 GENERAL_DOMAIN_KNOWLEDGE (Conoscenza Generale di Disciplina)
- **Definizione:** Concetti teorici, sintassi standard, principi metodologici o nozioni consolidate della materia (es. standard ANSI SQL, nozioni di contabilità aziendale, concetti informatici di database o foglio elettronico) non presenti nella specifica dispensa del docente ma necessari per spiegarne i contenuti;
- **Quando è ammessa:** Pienamente ammessa e indispensabile per la funzione pedagogica;
- **Provenance richiesta:** Marcatura dichiarativa come `domain_knowledge` (nessun `chunk_id` fittizio attribuito; tracciamento del prompt e del modello generatore);
- **Checker preposto:** Fact-checking disciplinare di accuratezza concettuale;
- **Teacher Review:** Ordinaria; il docente approva che la nozione generale sia idonea al grado scolastico della classe;
- **Cosa costituisce Allucinazione / Violazione:**
  - **Falsa attribuzione:** Scrivere nel copione *"Come indicato nella dispensa del professore, la sintassi ANSI SQL impone..."* quando la dispensa non cita lo standard;
  - **Errore disciplinare:** Introdurre nozioni tecniche errate o fuorvianti (es. asserire che la chiave esterna richiede necessariamente un raggruppamento `GROUP BY` come in GB-AC-005).

---

### 2.4 PEDAGOGICAL_PROPOSAL (Proposta Didattica / Esemplificazione)
- **Definizione:** Contenuto inventato ex-novo dal modello per scopi puramente educativi: metafore, analogie esplicative, domande da rivolgere alla classe, simulazione di risposte degli studenti con relativi errori tipici (misconceptions), esercizi pratici aggiuntivi, indicazioni di regia per il docente (es. pause, scrittura alla lavagna) e **formule didattiche generate per guidare la risoluzione**;
- **Quando è ammessa:** Pienamente ammessa ed essenziale: trasforma una raccolta statica di appunti in una vera e propria lezione attiva;
- **Formule Didattiche Generate:**
  - Una formula proposta dal modello per insegnare a risolvere un esercizio è una legittima `PEDAGOGICAL_PROPOSAL`;
  - Essa **non è vietata dal fatto che la cella sorgente nel foglio fosse inizialmente vuota**, purché:
    1. Usi coordinate e colonne realmente esistenti nel workbook validate dall'AST (`SOURCE_SPECIFIC_DETAIL`);
    2. La sua logica algebrica sia corretta rispetto alle unità e allo scopo didattico;
    3. Sia presentata come soluzione proposta per la classe e **mai falsamente descritta come già presente nel file originario**;
- **Provenance richiesta:** Marcatura di categoria didattica (`proposal_type`: `exercise`, `analogy`, `question`, `board_work`, `formula_solution`), collegata all'obiettivo formativo di riferimento;
- **Checker preposto:** Verificatore di coerenza pedagogica, vincoli di tempo della scansione didattica e conformità al livello degli studenti;
- **Teacher Review:** **Sempre obbligatoria (L3 Prepare):** il docente detiene la sovranità esclusiva sulla validità degli esempi e delle attività proposte;
- **Cosa costituisce Allucinazione / Violazione:**
  - Proporre esempi o esercizi che contraddicono esplicitamente le premesse della fonte;
  - Spacciare un esempio fittizio o una formula generata per un caso storico o un dato reale del materiale didattico originale;
  - Superare la durata massima prevista per la lezione introducendo divagazioni non pianificate.

---

### 2.5 SOURCE_SPECIFIC_DETAIL (Dettaglio Fisico / Vincolato di Fonte)
- **Definizione:** Elementi strutturali vincolati alla fisicità dell'ambiente applicativo: coordinate di cella (`A1`, `I2:I13`), nomi esatti di fogli di lavoro (`Vendite`, `Catalogo`), formule preesistenti memorizzate nel file sorgente, nomi di tabelle relazionali, tipi di dato SQL nativi, nomi di file;
- **Quando è ammessa:**
  - Ammessa **soltanto se sostenuta da dati strutturati estratti da un adapter o parser qualificato** (AST del workbook o schema del database);
  - Non è ammesso che il modello inventi coordinate fisiche arbitrarie senza riscontro nell'AST;
- **Distinzione Fondamentale tra Formule:**
  - **Formule Realmente Presenti (Stored Formulas):** Formule già scritte nelle celle del foglio di calcolo sorgente. Vengono verificate deterministicamente tramite l'AST come `SOURCE_SPECIFIC_DETAIL`;
  - **Formule Generate (Didactic Formulas):** Formule inventate dal modello per mostrare agli studenti come eseguire un calcolo. Sono ammesse come `PEDAGOGICAL_PROPOSAL`, purché ancorate a coordinate reali dell'AST e corrette matematicamente;
- **Provenance richiesta:** Riferimento strutturato generato dall'adapter (es. `sheet:Vendite!range:I2:I13` oppure `table:prodotti!column:prezzo`);
- **Checker preposto:** Checker deterministico basato su AST o metadati di schema (es. `CellAwareSpreadsheetAdapter`);
- **Teacher Review:** Ordinaria; il checker deterministico blocca a monte le discrepanze fisiche;
- **Cosa costituisce Allucinazione / Violazione:**
  - **Invenzione di coordinate di workbook:** Dichiarare agli studenti di selezionare la cella `F4` o di digitare formule su coordinate fantasma non esistenti nella rappresentazione parsata;
  - **Falsa attestazione di formula esistente:** Sostenere che una formula sia già scritta nel file quando la cella sorgente è vuota.

---

### 2.6 Matrice Sinottica del Contratto Epistemico

| Dimensione | `SOURCE_FACT` | `SOURCE_DERIVED` | `GENERAL_DOMAIN_KNOWLEDGE` | `PEDAGOGICAL_PROPOSAL` | `SOURCE_SPECIFIC_DETAIL` |
|---|---|---|---|---|---|
| **Origine** | Estratto diretto dalla fonte | Deduzione logico-matematica | Conoscenza generale della disciplina | Invenzione ad uso educativo | Metadato fisico del file/schema |
| **Ammissibilità** | Sempre | Sempre se corretta | Sempre se corretta e non attribuita | Sempre se coerente con gli obiettivi | Solo se presente nei dati parsati |
| **Composabilità** | Base per asserti fattuali | Dipendenza di supporto logico | Supporto concettuale esplicativo | Ruolo primario per attività/formule didattiche | Dipendenza di supporto strutturale (coordinate) |
| **Provenance** | Chunk ID + offset/riga | Chunk IDs sorgente + regola | Categoria disciplinare + Prompt ID | Tipo proposta + Obiettivo didattico | Coordinata strutturata (cella, foglio AST) |
| **Checker** | Evidence Retrieval (Embedding) + Exact/Semantic Check | Tipo A: Deterministico<br>Tipo B: Semantic/Review | Fact-checking disciplinare / Anti-falsa-attribuzione | Coerenza pedagogica / Vincoli tempo | Checker deterministico cell-aware |
| **Teacher Review** | Ordinaria (campionaria) | Ordinaria (badge `derived`) | Ordinaria (adeguatezza livello) | **Sempre obbligatoria** (L3 Prepare) | Bloccante a monte se discrepanza fisica |
| **Violazione Tipica** | Fatto non presente o falsa attribuzione materiale | Calcolo algebrico o dimensionale errato | Falsa attribuzione / Errore teorico | Spacciata per testo della fonte | Invenzione di coordinate non nell'AST |

---


## 3. Audit Completo del Pacchetto di Annotazione Umana Gate B

In conformità al mandato architetturale, è stata condotta una revisione analitica di tutti gli **82 casi** presenti in `validation/corpus/gold/gate-b/HUMAN_ANNOTATION.md`.
**Le annotazioni originali dell'annotatore umano (Simone) non sono state sovrascritte**, preservando l'integrità storica del benchmark.

### 3.1 Statistiche dell'Audit

```text
Totale casi valutati: 82
├─ KEEP (Confermati):              61 casi  (74.4%)  [o 62 se GB-GR-035 è conteggiato fra i rigetti confermati]
├─ RELABEL_RECOMMENDED:             6 casi   (7.3%)  [incluso GB-GR-035 raccomandato a UNSUPPORTED; o 5 casi]
├─ REBUILD_CONTEXT:                13 casi  (15.9%)
├─ DROP:                            1 caso   (1.2%)
└─ RECLASSIFY_TASK:                 1 caso   (1.2%)
```

*Nota esplicativa sul conteggio di `GB-GR-035`:* Nel gold set v1 l'annotatore umano ha selezionato `PARTIALLY_SUPPORTED` motivando la plausibilità matematica. Poiché il claim asserisce categoricamente *"La fonte definisce"*, la label di verità corretta per il gold set v2 è `UNSUPPORTED` (`SOURCE_FACT / false attribution`). Se classificato come rettifica della label v1 verso v2, il caso appartiene a `RELABEL_RECOMMENDED` (6 casi totali, 61 KEEP). Se invece si considera l'esito di non-sostenibilità come allineato al dubbio dell'annotatore, il conteggio si attesta a 62 KEEP e 5 RELABEL_RECOMMENDED. La classificazione canonica adotta **61 KEEP e 6 RELABEL_RECOMMENDED (con GB-GR-035 $
ightarrow$ UNSUPPORTED)**.

### 3.2 Analisi Dettagliata dei Casi Critici Evidenziati

1. **`GB-GR-002` (RELABEL_RECOMMENDED):**
   - *Claim:* "Lo schema didattico collega categorie (1:N) a prodotti e prodotti (1:N) a vendite."
   - *Annotazione originale:* `PARTIALLY_SUPPORTED` con nota: *"Credo che ci sia un bias e confusione: si parla di 'schema didattico', non vorrei che si riferisse allo sviluppo del servizio..."*
   - *Risoluzione:* L'annotatore ha esitato ipotizzando che "schema didattico" alludesse all'architettura software del Teacher Service. Nel testo del copione, l'espressione designa chiaramente lo schema logico del database relazionale utilizzato nella lezione. Poiché categorie (1:N) prodotti (1:N) vendite è esattamente il dato della fonte, il caso è pienamente supportato (`SOURCE_FACT`). Si raccomanda il relabel a `SUPPORTED`.
2. **`GB-GR-007` fino a `GB-GR-012` e `GB-GR-015` (REBUILD_CONTEXT):**
   - *Problema riscontrato:* In tutti questi casi l'estratto `SOURCE` è stato predisposto come frammento isolato (es. solo `WHERE venditore = 'Anna'`, oppure solo `Prodotti con prezzo tra 30 e 90 euro inclusi`), amputando l'intestazione di sezione (`### Promemoria SQL`, `### Esercizio 2 - WHERE`, `### Esercizio 3 - filtri composti`).
   - *Impatto sull'annotazione:* L'annotatore umano ha coerentemente e correttamente marcato `INSUFFICIENT_EVIDENCE`, apponendo note sistematiche: *"Non possiamo sapere se questa frase è presa dagli esempi/esercizi dalla source menzionata"*.
   - *Risoluzione:* Il gold set deve contenere estratti raw contestualizzati che includano l'intestazione della sezione per permettere di verificare se si tratti di un esempio o di un esercizio. È necessario un rebuild del contesto per tutti e 7 i casi.
3. **`GB-GR-016` e `GB-GR-034` (RELABEL_RECOMMENDED — SOURCE_DERIVED):**
   - *Problema riscontrato:* L'annotatore ha marcato `PARTIALLY_SUPPORTED` annotando esplicitamente: *"è una deduzione, che può anche andare bene ma non è scritta direttamente"* (GR-016) e *"Corretto ma derivato, non espressamente scritto"* (GR-034).
   - *Risoluzione analitica:* Nel vecchio quadro rigido, la mancata corrispondenza letterale forzava il declassamento. Nel nuovo contratto epistemico, la conversione tra percentuali e decimali ($10\% \leftrightarrow 0.10$) e la corretta deduzione contabile dimensionale (applicando il tasso di sconto: $Netto = Lordo \times (1 - Sconto)$) sono derivazioni analitiche immediate (`SOURCE_DERIVED`). Si raccomanda il relabel a `SUPPORTED` (con tag di classe `SOURCE_DERIVED`).
4. **`GB-GR-035` (RELABEL_RECOMMENDED — Falsa Attribuzione alla Fonte):**
   - *Claim:* "La fonte definisce Netto come Lordo diminuito dello sconto applicato."
   - *Fonte bounded:* "Sono presenti le intestazioni Sconto, Lordo e Netto; le celle derivate sono vuote."
   - *Annotazione originale:* `PARTIALLY_SUPPORTED` con nota: *"Correto ma derivato, non espressamente scritto"*.
   - *Risoluzione analitica e correzione metodologica:*
     Il nodo centrale del claim risiede nella locuzione categorica **"La fonte definisce"**.
     La fonte bounded riporta unicamente le etichette di colonna `Sconto`, `Lordo` e `Netto`, ma non definisce in alcun punto la relazione o la formula.
     Pertanto, **non è corretto trasformare questo claim in `SUPPORTED`** classificandolo superficialmente come `SOURCE_DERIVED`. Sebbene la nozione contabile sottostante possa essere valida nel dominio, **l'attribuzione della definizione alla fonte è oggettivamente falsa**.
     Il caso deve quindi rimanere nel benchmark come prezioso test di **falsa attribuzione**:
     - **Label finale raccomandata nel Gold Set v2:** **`UNSUPPORTED`**;
     - **Classe verificata:** **`SOURCE_FACT / false attribution`**;
     - **Decisione Audit:** **`RELABEL_RECOMMENDED`** (da `PARTIALLY_SUPPORTED` a `UNSUPPORTED`) per correggere l'indulgenza iniziale dell'annotatore ed evidenziare la sanzione della falsa attribuzione;
     - *Nota metodologica:* Se si intendesse valutare unicamente la plausibilità della deduzione aritmetico-contabile, andrebbe formulato un claim separato privo dell'inciso "la fonte definisce".
5. **`GB-GR-028` (REBUILD_CONTEXT):**
   - *Claim:* "La prima riga delle Vendite riporta aliquota commissione 0.05."
   - *Annotazione originale:* `PARTIALLY_SUPPORTED` con nota: *"è la prima come data ma non è detto che sia la prima delle vendite, dipende dall'ordinamento"*.
   - *Risoluzione:* Lo snippet fornito riportava solo la riga del 2026-09-01 senza mostrare la tabella completa. È necessario ricostruire il contesto tabellare affinché l'annotatore possa verificare l'ordinamento fisico della tabella.
6. **`GB-GR-030` (REBUILD_CONTEXT):**
   - *Claim:* "La tabella indicatori include Vendite con Netto >= 100."
   - *Annotazione originale:* `PARTIALLY_SUPPORTED` con nota: *"Non è chiaro se indicatore sia una tabella o meno"*.
   - *Risoluzione:* L'estratto conteneva solo la riga atomica `Indicatore: Vendite con Netto >= 100`. Ricostruire con il blocco strutturato del foglio Riepilogo.
7. **`GB-GR-032` (DROP):**
   - *Claim:* "La proiezione fonte non conserva formule validate o coordinate di cella validate."
   - *Risoluzione:* Questo claim non descrive un contenuto didattico destinato agli studenti, bensì un meta-commento sul setup sperimentale del benchmark (B1 parsing limitation). Inoltre, il campo `SOURCE` riporta testo riassuntivo scritto dal reviewer. Il caso è metodologicamente spurio e va eliminato (`DROP`) dal gold set didattico.
8. **`GB-GR-033`, `GB-GR-037`, `GB-GR-039` (REBUILD_CONTEXT — Reviewer-Authored Sources):**
   - *Problema riscontrato:* In questi casi il campo `SOURCE` non contiene frammenti raw del testo didattico fornito al modello, ma parafrasi interpretative scritte dal reviewer (es. in GR-037: *"Il prompt/fonte presenta la tabella 'Vendite' solo come schema con tipi/esempi, senza formule preesistenti per 'Commissione'"*; in GR-039: *"Sono riportati nomi delle tabelle, chiavi e campi, senza righe di dati estese"*).
   - *Risoluzione:* Un gold set di grounding valido deve confrontare il claim con evidenze grezze (*raw/bounded source evidence*), non con riassunti interpretativi che anticipano il giudizio. I contesti devono essere interamente ricostruiti con estratti letterali della fonte documentale.
9. **`GB-GR-046` (REBUILD_CONTEXT):**
   - *Claim:* "Il prompt richiede di vincolare la chiave esterna id_corso alla tabella corsi."
   - *Annotazione originale:* `INSUFFICIENT_EVIDENCE` con nota: *"il prompt mostra solo una parte dello schema didattico, quindi non è chiaro se è un vincolo o meno"*.
   - *Risoluzione:* Ricostruire lo snippet includendo l'intero blocco di definizione vincoli e relazioni tra entità per eliminare l'amputazione del contesto.
10. **`GB-AC-016` (RELABEL_RECOMMENDED):**
    - *Requirement:* "Dove la fonte chiede un grafico ma non ne specifica il tipo, distinguere una proposta didattica dalla prescrizione della fonte."
    - *Artifact:* Il modello propone: *"Dal menu di inserimento, generiamo un grafico a barre o a linee per visualizzare l'andamento nel tempo"*.
    - *Annotazione originale:* `PARTIAL`.
    - *Risoluzione:* La scelta del tipo di grafico per una lezione è una tipica e legittima `PEDAGOGICAL_PROPOSAL`. Il modello non asserisce che la fonte impone quel grafico; fornisce una proposta didattica operativa coerente con il tema. Relabel da `PARTIAL` a `SATISFIED`.
11. **`GB-AC-018` (RECLASSIFY_TASK):**
    - *Requirement:* Sanzione per la presenza della formula `=SOMMA(Vendite!I2:I13)`.
    - *Risoluzione:* Tale formula è identica a quella impiegata nella lezione reale dal docente (`excel_teacher.md`), ma era considerata violazione perché il benchmark aveva rimosso le coordinate in `excel_demo_no_cellrefs.md`. Questo caso è l'emblema della contraddizione metodologica di Gate C: va riclassificato (`RECLASSIFY_TASK`) nel task di verifica dello Spreadsheet Adapter cell-aware.
12. **`GB-AC-021` (RELABEL_RECOMMENDED):**
    - *Requirement:* "Non presentare come regola della fonte la formula esatta per Netto quando sono solo presenti i campi Sconto, Lordo e Netto."
    - *Artifact:* *"L'importo netto sarà dato dal valore Lordo diminuito dello sconto applicato"*.
    - *Annotazione originale:* `VIOLATED`.
    - *Risoluzione:* Sanzionare il modello come violatore per aver spiegato il calcolo del netto applicando lo sconto al lordo ($Netto = Lordo \times (1 - Sconto)$ dato che Sconto è un tasso, oppure sottraendo l'ammontare monetario dello sconto) è iper-restrittivo. Trattandosi di conoscenza contabile fondamentale (`GENERAL_DOMAIN_KNOWLEDGE` / `SOURCE_DERIVED`) che non viola vincoli del workbook, si raccomanda il relabel da `VIOLATED` a `SATISFIED`.

### 3.3 Matrice di Audit di Tutti gli 82 Casi

| Caso ID | Tipo | Label Umana | Decisione Audit | Motivazione Sintetica |
|---|---|---|---|---|
| `GB-GR-001` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-002` | GR | `PARTIALLY_SUPPORTED` | **RELABEL_RECOMMENDED** | L'annotatore ha annotato PARTIALLY_SUPPORTED temendo che 'schema didattico' si riferisse all'architettura software del servizio. Nel copione si riferisce chiaramente allo schema relazionale del database della lezione (categorie -> prodotti -> vendite). Nel nuovo contratto epistemico è un fatto di fonte supportato; relabel raccomandato da PARTIALLY_SUPPORTED a SUPPORTED. |
| `GB-GR-003` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-004` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-005` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-006` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-007` | GR | `INSUFFICIENT_EVIDENCE` | **REBUILD_CONTEXT** | Estratto SOURCE eccessivamente troncato (riporta solo la stringa di query o frase atomica senza intestazione di sezione: Promemoria, Esercizio 2, Esercizio 3, ecc.), costringendo l'annotatore a selezionare INSUFFICIENT_EVIDENCE. Ricostruire con il blocco testuale completo comprensivo dell'intestazione di sezione. |
| `GB-GR-008` | GR | `INSUFFICIENT_EVIDENCE` | **REBUILD_CONTEXT** | Estratto SOURCE eccessivamente troncato (riporta solo la stringa di query o frase atomica senza intestazione di sezione: Promemoria, Esercizio 2, Esercizio 3, ecc.), costringendo l'annotatore a selezionare INSUFFICIENT_EVIDENCE. Ricostruire con il blocco testuale completo comprensivo dell'intestazione di sezione. |
| `GB-GR-009` | GR | `INSUFFICIENT_EVIDENCE` | **REBUILD_CONTEXT** | Estratto SOURCE eccessivamente troncato (riporta solo la stringa di query o frase atomica senza intestazione di sezione: Promemoria, Esercizio 2, Esercizio 3, ecc.), costringendo l'annotatore a selezionare INSUFFICIENT_EVIDENCE. Ricostruire con il blocco testuale completo comprensivo dell'intestazione di sezione. |
| `GB-GR-010` | GR | `INSUFFICIENT_EVIDENCE` | **REBUILD_CONTEXT** | Estratto SOURCE eccessivamente troncato (riporta solo la stringa di query o frase atomica senza intestazione di sezione: Promemoria, Esercizio 2, Esercizio 3, ecc.), costringendo l'annotatore a selezionare INSUFFICIENT_EVIDENCE. Ricostruire con il blocco testuale completo comprensivo dell'intestazione di sezione. |
| `GB-GR-011` | GR | `INSUFFICIENT_EVIDENCE` | **REBUILD_CONTEXT** | Estratto SOURCE eccessivamente troncato (riporta solo la stringa di query o frase atomica senza intestazione di sezione: Promemoria, Esercizio 2, Esercizio 3, ecc.), costringendo l'annotatore a selezionare INSUFFICIENT_EVIDENCE. Ricostruire con il blocco testuale completo comprensivo dell'intestazione di sezione. |
| `GB-GR-012` | GR | `INSUFFICIENT_EVIDENCE` | **REBUILD_CONTEXT** | Estratto SOURCE eccessivamente troncato (riporta solo la stringa di query o frase atomica senza intestazione di sezione: Promemoria, Esercizio 2, Esercizio 3, ecc.), costringendo l'annotatore a selezionare INSUFFICIENT_EVIDENCE. Ricostruire con il blocco testuale completo comprensivo dell'intestazione di sezione. |
| `GB-GR-013` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-014` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-015` | GR | `INSUFFICIENT_EVIDENCE` | **REBUILD_CONTEXT** | Estratto SOURCE eccessivamente troncato (riporta solo la stringa di query o frase atomica senza intestazione di sezione: Promemoria, Esercizio 2, Esercizio 3, ecc.), costringendo l'annotatore a selezionare INSUFFICIENT_EVIDENCE. Ricostruire con il blocco testuale completo comprensivo dell'intestazione di sezione. |
| `GB-GR-016` | GR | `PARTIALLY_SUPPORTED` | **RELABEL_RECOMMENDED** | Deduzione coerente con le intestazioni del foglio ($Netto = Lordo \times (1 - Sconto)$ dove Sconto è un tasso percentuale 0.10). Deduzione logica/contabile valida (SOURCE_DERIVED). Relabel a SUPPORTED. |
| `GB-GR-017` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-018` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-019` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-020` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-021` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-022` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-023` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-024` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-025` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-026` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-027` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-028` | GR | `PARTIALLY_SUPPORTED` | **REBUILD_CONTEXT** | Il claim asserisce 'la prima riga delle Vendite'; l'estratto SOURCE riporta solo 'Aliquota commissione: 0.05 nella riga del 2026-09-01' senza mostrare l'intera tabella. L'annotatore ha notato che è la prima per data ma non necessariamente della tabella. Ricostruire il blocco tabella completo. |
| `GB-GR-029` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-030` | GR | `PARTIALLY_SUPPORTED` | **REBUILD_CONTEXT** | Estratto SOURCE atomico ('Indicatore: Vendite con Netto >= 100'). L'annotatore nota: 'Non è chiaro se indicatore sia una tabella o meno'. Ricostruire la tabella Riepilogo originale. |
| `GB-GR-031` | GR | `SUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-032` | GR | `UNSUPPORTED` | **DROP** | Meta-claim relativo al setup del benchmark ('La proiezione fonte non conserva formule validate o coordinate di cella validate'), non un'asserzione didattica. La SOURCE è inoltre testo riassuntivo del reviewer. Da eliminare dal gold set. |
| `GB-GR-033` | GR | `UNSUPPORTED` | **REBUILD_CONTEXT** | La SOURCE è una sintesi formulata dal reviewer ('La fonte elenca CERCA.X; la tabella Prodotti ha Codice, Prodotto, Prezzo') anziché l'estratto raw della tabella e dell'elenco funzioni. Ricostruire con il testo raw della fonte. |
| `GB-GR-034` | GR | `PARTIALLY_SUPPORTED` | **RELABEL_RECOMMENDED** | Annotato PARTIALLY_SUPPORTED con nota: 'Corretto ma derivato'. La conversione tra percentuali e decimali (10% -> 0.10) è una deduzione elementare pienamente valida (SOURCE_DERIVED). Relabel a SUPPORTED. |
| `GB-GR-035` | GR | `PARTIALLY_SUPPORTED` | **RELABEL_RECOMMENDED** | Il claim asserisce 'La fonte definisce...', ma la fonte bounded riporta solo intestazioni senza definire formule. Falsa attribuzione materiale alla fonte (`SOURCE_FACT / false attribution`). Relabel raccomandato da PARTIALLY_SUPPORTED a UNSUPPORTED per mantenere il test di falsa attribuzione. |
| `GB-GR-036` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-037` | GR | `UNSUPPORTED` | **REBUILD_CONTEXT** | La SOURCE contiene sintesi del reviewer ('La tabella ha colonna Data... la timeline nomina...') anziché gli estratti raw delle tabelle e sezioni. Ricostruire con testo raw. |
| `GB-GR-038` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-039` | GR | `PARTIALLY_SUPPORTED` | **REBUILD_CONTEXT** | La SOURCE è testo del reviewer ('Sono riportati nomi delle tabelle, chiavi e campi, senza righe di dati') anziché l'estratto raw dello schema da `dbms_partial_excerpt.md`. Ricostruire con il blocco testuale autentico. |
| `GB-GR-040` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-041` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-042` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-043` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-044` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-045` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-046` | GR | `INSUFFICIENT_EVIDENCE` | **REBUILD_CONTEXT** | Lo snippet SOURCE omette la specifica dei vincoli di chiave dello schema completo. L'annotatore ha marcato INSUFFICIENT_EVIDENCE indicando che la PK non compare nello snippet. Ricostruire con la definizione di schema completa. |
| `GB-GR-047` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-048` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-049` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-050` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-051` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-GR-052` | GR | `UNSUPPORTED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-001` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-002` | AC | `VIOLATED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-003` | AC | `VIOLATED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-004` | AC | `VIOLATED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-005` | AC | `VIOLATED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-006` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-007` | AC | `PARTIAL` | **KEEP** | Regola di separazione strutturale valida: uno Student Material non deve incorporare una sezione intitolata Teacher Script. Annotazione PARTIAL confermata. |
| `GB-AC-008` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-009` | AC | `VIOLATED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-010` | AC | `PARTIAL` | **KEEP** | Regola valida: ampliamento indebito di SELECT con operazioni di modifica (UPDATE) non presenti e non dichiarate. Annotazione PARTIAL confermata. |
| `GB-AC-011` | AC | `SATISFIED` | **KEEP** | Regola valida: coerenza operativa del materiale studente rispetto alla disponibilità di dati parziali. Annotazione SATISFIED confermata. |
| `GB-AC-012` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-013` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-014` | AC | `VIOLATED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-015` | AC | `SATISFIED` | **KEEP** | Regola di consistenza dell'artefatto valida e annotazione umana pienamente confermata. |
| `GB-AC-016` | AC | `PARTIAL` | **RELABEL_RECOMMENDED** | La proposta di grafico a barre o a linee in assenza di specifica nella fonte costituisce una PEDAGOGICAL_PROPOSAL legittima ed essenziale per la conduzione della lezione. Non costituisce deviazione o allucinazione; relabel da PARTIAL a SATISFIED. |
| `GB-AC-017` | AC | `VIOLATED` | **KEEP** | Regola di consistenza dell'artefatto valida e annotazione umana pienamente confermata. |
| `GB-AC-018` | AC | `UNKNOWN` | **RECLASSIFY_TASK** | Il caso sanziona la formula '=SOMMA(Vendite!I2:I13)'. Tale formula corrisponde esattamente al reference didattico reale del docente (`excel_teacher.md`), ma era considerata violazione perché la proiezione artificiale `excel_demo_no_cellrefs.md` aveva censurato le coordinate. Riclassificare come verifica di SOURCE_SPECIFIC_DETAIL all'interno del task di validazione dello Spreadsheet Adapter. |
| `GB-AC-019` | AC | `UNKNOWN` | **KEEP** | Regola di consistenza dell'artefatto valida e annotazione umana pienamente confermata. |
| `GB-AC-020` | AC | `VIOLATED` | **KEEP** | Regola di consistenza dell'artefatto valida e annotazione umana pienamente confermata. |
| `GB-AC-021` | AC | `VIOLATED` | **RELABEL_RECOMMENDED** | Relazione contabile $Netto = Lordo \times (1 - Sconto)$ (con Sconto tasso) o diminuzione del lordo per lo sconto applicato; non costituisce allucinazione ma GENERAL_DOMAIN_KNOWLEDGE / SOURCE_DERIVED. Relabel da VIOLATED a SATISFIED. |
| `GB-AC-022` | AC | `VIOLATED` | **KEEP** | Regola di consistenza dell'artefatto valida e annotazione umana pienamente confermata. |
| `GB-AC-023` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-024` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-025` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-026` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-027` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-028` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-029` | AC | `SATISFIED` | **KEEP** | Annotazione e contesto coerenti con le evidenze e il task. |
| `GB-AC-030` | AC | `SATISFIED` | **KEEP** | Regola di consistenza dell'artefatto valida e annotazione umana pienamente confermata. |


---

## 4. Revisione Metodologica di Gate C

L'analisi del report Gate C (`Gate-C-remote-models-report.md`) evidenzia che le conclusioni negative sui profili `remote.generation` e `remote.longform` sono state pesantemente influenzate da una **contraddizione metodologica intrinseca al benchmark di Excel**.

### 4.1 La Contraddizione Metodologica di Excel
Nel benchmark Gate C si è verificata la seguente situazione paradossale:
1. **La Fonte in Ingresso (`excel_demo_no_cellrefs.md`):**  
   A causa dei limiti del parser documentale emersi in B1 (MinerU non estrae coordinate di cella), il benchmark ha fornito al modello una proiezione in cui **tutte le coordinate di cella e tutte le formule erano state censurate** e sostituite con `[riferimento cella omesso]`.
2. **Il Target di Riferimento Didattico (`excel_teacher.md`):**  
   Il riferimento didattico reale del docente — rispetto al quale veniva valutata la bontà della lezione di 2 ore — era un copione dettagliato incentrato sull'insegnamento pratico di formule di cella: `=A1+A2`, `=SOMMA(A1:A2)`, `=B2-C2`, `=CERCA.X(B2;Catalogo[Codice];...)` e riferimenti assoluti (`$D$2:$D$13`).
3. **Il Corto-Circuito di Valutazione:**  
   Il modello è stato contemporaneamente:
   - Penalizzato e bocciato se **non insegnava** le formule e le celle (perché il copione risultava vuoto o non conforme agli obiettivi di una lezione di Excel da 120 minuti);
   - Sanzionato come **allucinatore / violatore di policy** se **inseriva** formule e riferimenti di cella (perché il file `excel_demo_no_cellrefs.md` vietava coordinate e formule).

### 4.2 Risoluzione del Benchmark Senza Leakage
Per sanare questa contraddizione senza violare il principio di isolamento del target held-out:
1. **Non fornire il target docente al modello:** Il testo di `excel_teacher.md` deve rimanere rigorosamente held-out;
2. **Fornire la rappresentazione strutturata autentica del workbook:** Il problema non era il target, ma la fonte. Se la lezione verte su un file Excel, la fonte non deve essere un Markdown mutilato, ma la **struttura tabellare reale del foglio elettronico** con coordinate e formule presenti;
3. **Applicare la distinzione delle 5 classi epistemiche:**  
   - Se il workbook contiene intestazioni e dati numerici, la spiegazione di come scrivere `=B2-C2` è una `PEDAGOGICAL_PROPOSAL` applicata a `SOURCE_SPECIFIC_DETAIL` legittimi estratti dall'adapter;
   - Viene considerata allucinazione solo l'invenzione di coordinate inesistenti nel foglio reale (es. citare `Z100` quando la tabella termina in `D13`).

---

## 5. Specifiche dello Spreadsheet Input Adapter

A valle delle evidenze B1 e Gate C, è formalmente accertata la necessità architetturale di un modulo dedicato:

> **Spreadsheet Structured Adapter Required: SÌ**

### 5.1 Perché MinerU da solo non è sufficiente per i Fogli di Calcolo
Come dimostrato in B1, MinerU converte i file XLSX in tabelle Markdown standard. Nel Markdown:
- Gli indirizzi alfanumerici delle celle (`A1`, `B2`, `I2:I13`) scompaiono;
- Le formule sottostanti (`=SOMMA`, `=CERCA.X`) vengono perse (mostrando solo il valore visualizzato o lasciando il campo vuoto se calcolato);
- Le relazioni tra fogli di lavoro multipli (es. `Vendite!I2` collegato a `Catalogo!A2`) diventano illeggibili;
- I metadati di tabella strutturata (nomi di intervallo, intestazioni di colonna native) vengono appiattiti.

### 5.2 Distinzione Fondamentale: Formule Realmente Presenti vs. Formule Generate
L'adapter e i checker devono applicare una distinzione architetturale netta:
1. **Formule Realmente Presenti (Stored Formulas):**
   - Formule preesistenti memorizzate nelle celle del file `.xlsx` originale;
   - L'adapter le rileva, ne estrae la stringa formula e le registra nell'AST come `SOURCE_SPECIFIC_DETAIL`;
   - La loro presenza o assenza è un fatto deterministico della fonte.
2. **Formule Didattiche Generate (Generated Formulas):**
   - Una formula didattica generata dal Teacher Service (es. spiegare agli studenti come calcolare il netto o il totale) **non deve essere vietata soltanto perché la cella sorgente nel foglio era inizialmente vuota**;
   - Essa è pienamente lecita come `PEDAGOGICAL_PROPOSAL` (supportata da `SOURCE_SPECIFIC_DETAIL` e `SOURCE_DERIVED`) purché soddisfi tre condizioni vincolanti:
     1. Utilizzi coordinate, intervalli e nomi di colonna realmente esistenti nel foglio e validati dall'AST;
     2. La logica algebrico-dimensionale sia corretta rispetto alla semantica dei campi (es. moltiplicare per $1 - Sconto$ se sconto è un tasso);
     3. Sia presentata esplicitamente come proposta didattica/soluzione per la classe e **mai falsamente attribuita come formula già scritta nel file originale** (*"questa formula è già contenuta nel file"*).

### 5.3 Contratto Formale dell'Adapter Deterministico (`CellAwareSpreadsheetAdapter`)
Il Teacher Service adotterà un adapter deterministico leggero (basato su librerie standard come `openpyxl` / `calamine`, eseguito interamente in locale a zero latenza e zero AI).

```yaml
# Esempio schematico illustrativo del contratto dati (non dati reali osservati)
adapter_name: "CellAwareSpreadsheetAdapter"
execution_class: "Deterministic Local"
input: "File binario .xlsx / .xlsm"
output_contract:
  workbook_metadata:
    sheets: ["Foglio1", "DatiOperativi", "Riepilogo"]
    defined_names:
      TabellaEsempio: "DatiOperativi!$A$2:$E$20"
  sheets_data:
    - sheet_name: "DatiOperativi"
      dimensions: "A1:E20"
      columns:
        - index: 1
          header: "Data"
          col_letter: "A"
        - index: 2
          header: "Codice"
          col_letter: "B"
        - index: 5
          header: "Importo"
          col_letter: "E"
      cells:
        - coordinate: "E2"
          value_type: "formula"                 # Valori possibili: "number", "string", "formula", "empty"
          formula: "=C2*(1-D2)"                 # Opzionale: presente solo se una formula reale è memorizzata nel file
          cached_value: 190.00                  # Opzionale: valore pre-calcolato presente nella cache del file
          cached_value_metadata:
            reliability: "unverified_from_cache" # Metadato di freschezza: mai assunto corretto a priori
            evaluated: false
            format: "currency_eur"
```

Questo adapter fornisce al generatore e ai checker un terreno di verità inequivocabile:
- I nomi dei fogli, le coordinate e le colonne sono vincoli rigidi;
- Il campo `cached_value` è strettamente opzionale, corredato da metadati di affidabilità (`reliability`) e mai assunto come verità matematica certa senza verifica;
- Le formule native memorizzate vengono separate con chiarezza dalle proposte didattiche generate a runtime.

---


## 6. Architettura della Remote Generation Pipeline (Composita)

Il benchmark Gate C ha dimostrato che tentare di generare un Teacher Script da 120 minuti in una singola chiamata LLM monolitica produce:
- Troncamenti sistematici per raggiungimento del limite di token (`finish_reason=length`);
- Perdita di aderenza allo schema JSON di output;
- Diluizione della coerenza tra l'inizio e la fine della lezione.

Si adotta una **generazione composita a pipeline deterministica**:

```text
               [ Richiesta Lezione T1 ]
                          │
                          ▼
            ┌───────────────────────────┐
            │   1. PLAN GENERATION      │ ──► Output: Lesson Structure & Time Map
            └─────────────┬─────────────┘
                          │
                          ▼
            ┌───────────────────────────┐
            │ 2. BOUNDED SECTIONS GEN   │ ──► Generazione parallela/sequenziale
            └─────────────┬─────────────┘     di blocchi da 10-15 minuti ancorati
                          │
                          ▼
            ┌───────────────────────────┐
            │  3. DETERMINISTIC STITCH  │ ──► Unione strutturata, verifica
            └─────────────┬─────────────┘     continuità e transizioni
                          │
                          ▼
            ┌───────────────────────────┐
            │  4. LOCAL/POLICY CHECKS   │ ──► Validazione schema, FTS5 grounding,
            └─────────────┬─────────────┘     cell-coordinate check
                          │
                          ├─► [Se FAIL delimitato] ──► 5. BOUNDED REPAIR (max 1 tentativo)
                          │
                          ▼
            ┌───────────────────────────┐
            │ 6. HUMAN REVIEW INBOX(L3) │ ──► Presentazione al docente come ReviewItem
            └───────────────────────────┘
```

### Regole Rigorose di Pipeline
1. **Nessun Agent Framework Opaco:** Vietato l'uso di runtime agentici complessi (LangGraph, CrewAI, AutoGen);
2. **Nessun Loop Autonomo Illimitato:** Se una sezione fallisce la validazione strutturale o di policy, è ammesso un **singolo tentativo di bounded repair** focalizzato sul vincolo violato. Se fallisce nuovamente, il task viene instradato nella Review Inbox con segnalazione esplicita;
3. **Isolamento di Contesto:** Ogni sezione riceve nel prompt esclusivamente i chunk del Source Set pertinenti a quella specifica fase della lezione, riducendo drasticamente il rumore e il consumo di token.

---

## 7. Gate C Candidate Preflight e Cohort Selection

Nel benchmark Gate C originario, il candidato `mistral/mistral-medium-3-5` ha fallito la chiamata restituendo un messaggio di `keepalive` e nessun output. Questo disservizio d'infrastruttura ha consumato uno dei 2 slot di test, lasciando di fatto il profilo con un solo modello valutato.

### 7.1 La Disciplina del Preflight a 3 Livelli
L'ammissione dei modelli al benchmark deve seguire tre stadi distinti e non sovrapponibili:

```text
[ CATALOG DISCOVERY ] ──► [ PROTOCOL & IDENTITY PROBE ] ──► [ BENCHMARK COHORT ]
```

1. **Catalog Candidate:** Modello presente nei metadati del gateway con compatibilità dichiarata sui parametri minimi (contesto, modalità testo);
2. **Protocol & Identity Probe (Preflight Obbligatorio):**
   - Una chiamata diagnostica minima (non generativa) eseguita prima di ammettere il modello al benchmark;
   - Verifica:
     a) HTTP 200 con payload valido;
     b) Supporto a `response_format=json_schema`;
     c) Corrispondenza esatta tra model ID richiesto e model ID effettivo in risposta;
     d) Assenza di keepalive fantasma o risposte vuote;
   - **Regola di salvaguardia:** Un modello che fallisce la probe viene classificato come `UNAVAILABLE_FOR_TEST` o `GATEWAY_DISCREPANCY` e **NON consuma alcuno slot della matrice di benchmark**;
3. **Benchmark Cohort:** La coorte finale deve comprendere idealmente **3 route distinte realmente operative e funzionanti**, selezionate scorrendo il catalogo fino a completamento degli slot disponibili.
4. **Divieto di Fallback Dinamico:** Durante una run di benchmark, il fallback tra modelli è **categoricamente disattivato**, per garantire che ogni metrica sia attribuibile univocamente al modello sotto esame.

---

## 8. Sintesi Conclusiva e Stato di Validazione

| Quesito Architetturale | Risoluzione / Esito |
|---|---|
| **Nuovo Contratto Epistemico** | Formalizzato nelle 5 classi (`SOURCE_FACT`, `SOURCE_DERIVED`, `GENERAL_DOMAIN_KNOWLEDGE`, `PEDAGOGICAL_PROPOSAL`, `SOURCE_SPECIFIC_DETAIL`), componibili secondo la semantica `Primary Role + Supporting Roles`, senza sentence-level classifier obbligatorio. |
| **Audit Gate B (82 casi)** | **61 KEEP** (o 62), **6 RELABEL_RECOMMENDED** (incluso GB-GR-035 a `UNSUPPORTED`), **13 REBUILD_CONTEXT**, **1 DROP**, **1 RECLASSIFY_TASK**. |
| **Correzioni al Gold Set Gate B** | Ricostruire gli snippet di contesto raw per i 13 casi decontestualizzati; confermare `UNSUPPORTED` su GB-GR-035 per falsa attribuzione; rimuovere GB-GR-032; preservare intatto il file v1 originale e produrre `HUMAN_ANNOTATION_v2.md`. |
| **Nuova Semantica di Accettazione Gate C** | Distinzione netta tra arricchimento didattico legittimo e allucinazione di dettagli fisici. Adozione di hard failures (contraddizioni, false attribuzioni, coordinate inesistenti, troncamenti) e valutazione multidimensionale (editing effort, violazioni, utilità didattica). |
| **Soglia di Accuratezza 95%** | Classificata formalmente come **`PROVISIONAL BENCHMARK THRESHOLD`**, da calibrare empiricamente sul gold set v2 e sull'effettivo carico di revisione docente. |
| **Protocollo Gate C v2** | Pipeline composita per longform + Preflight diagnostico a 3 stadi per la selezione della coorte. |
| **Spreadsheet Adapter Necessario?** | **SÌ, NECESSARIO.** Richiede adapter deterministico cell-aware per XLSX, con distinzione tra formule memorizzate nel file e formule didattiche generate a runtime. |
| **Cosa di Gate C Rimane Valido** | Metriche e snapshot catalogo (62 modelli); evidenze positive sul caso DBMS; isolamento credenziali e audit trace. |
| **Cosa Deve Essere Rivalidato** | **Gate C v2 REQUIRED (SÌ)**: rivalidazione dei profili `remote.generation` e `remote.longform` con pipeline composita, adapter XLSX e coorte a 3 modelli verificati. |

---

### 8.1 Nuovo Contratto Epistemico
Il Teacher Service ha come fine istituzionale la produzione di nuovo materiale didattico (piani di lezione, copioni docente completi, schede operative studenti ed esercizi differenziati). Viene formalmente superata la visione riduzionista di un modello concepito come puro estrattore o parafrasatore letterale delle fonti.
Il nuovo contratto epistemico struttura ogni asserto in cinque classi canoniche:
1. **`SOURCE_FACT`:** Dati, definizioni e fatti storici/tecnici presenti nel Source Set. Richiede provenance puntuale (`chunk_id`, riga). La violazione/allucinazione consiste nell'asserire fatti smentiti o non presenti spacciandoli per contenuti della fonte, o nell'attribuire alla fonte definizioni inesistenti. Gli embeddings operano solo come candidate retrieval, mai come truth signals.
2. **`SOURCE_DERIVED`:** Deduzioni logiche, conversioni (es. $10\% \leftrightarrow 0.10$) e calcoli matematici dimensionalmente corretti (es. $Netto = Lordo \times (1 - Sconto)$ quando Sconto è un tasso percentuale). Provenance: `chunk_id` sorgente + regola di derivazione. Si distinguono derivazioni formalizzabili (checker deterministico) da inferenze semantiche (bounded semantic check / review).
3. **`GENERAL_DOMAIN_KNOWLEDGE`:** Concetti generali della disciplina (es. standard ANSI SQL, logica relazionale, principi di contabilità aziendale) introdotti dal modello per spiegare i contenuti. Provenance: etichetta dichiarativa disciplinare (senza falsi `chunk_id`). La violazione consiste in errori concettuali o falsa attribuzione alla fonte locale.
4. **`PEDAGOGICAL_PROPOSAL`:** Esempi pratici, analogie, domande stimolo, anticipazione di errori tipici degli studenti, indicazioni di regia alla lavagna e formule didattiche per la soluzione. Non richiede provenance di chunk ma marcatura tipologica; è **sempre subordinata a Teacher Review obbligatoria (L3 Prepare)**. La violazione consiste in incoerenza con gli obiettivi formativi o registro inidoneo.
5. **`SOURCE_SPECIFIC_DETAIL`:** Coordinate fisiche (`B2`, `I2:I13`), nomi foglio e formule native memorizzate nel file. È lecita **solo se sostenuta da un adapter strutturato**. È considerata allucinazione grave se inventata in assenza di coordinate nella rappresentazione parsata.

Le classi sono componibili (`Primary Epistemic Role + Supporting Roles`) e governano span e claim rilevanti (minimum sufficient provenance), senza imporre un sentence-level classifier obbligatorio.

### 8.2 Audit dei Casi Gate B
La revisione sistematica e imparziale di tutti gli 82 casi del pacchetto `HUMAN_ANNOTATION.md` (senza alterare le annotazioni storiche umane) produce la seguente distribuzione:
- **`KEEP` (61 casi — 74.4% o 62 casi — 75.6%):** Le annotazioni e i contesti originali sono confermati;
- **`RELABEL_RECOMMENDED` (6 casi — 7.3% o 5 casi — 6.1%):** Riconciliazione metodologica necessaria a seguito del nuovo contratto epistemico:
  - `GB-GR-002`: Relabel da `PARTIALLY_SUPPORTED` a `SUPPORTED` (lo "schema didattico" descrive le relazioni relazionali della lezione, non il codice del software);
  - `GB-GR-016`, `GB-GR-034`: Relabel da `PARTIALLY_SUPPORTED` a `SUPPORTED` come `SOURCE_DERIVED` (deduzioni su percentuali e sconti applicati dimensionalmente);
  - `GB-GR-035`: Relabel raccomandato da `PARTIALLY_SUPPORTED` a **`UNSUPPORTED`** (`SOURCE_FACT / false attribution`): l'asserzione categorica *"La fonte definisce"* costituisce una falsa attribuzione materiale, poiché la fonte bounded riporta solo intestazioni senza definire relazioni;
  - `GB-AC-016`: Relabel da `PARTIAL` a `SATISFIED` come `PEDAGOGICAL_PROPOSAL` (la scelta di un diagramma a barre o a linee per illustrare i dati è una legittima proposta didattica);
  - `GB-AC-021`: Relabel da `VIOLATED` a `SATISFIED` come `GENERAL_DOMAIN_KNOWLEDGE` / `SOURCE_DERIVED` (la relazione contabile di calcolo del netto diminuito dello sconto applicato $Netto = Lordo \times (1 - Sconto)$ non è un'allucinazione);
- **`REBUILD_CONTEXT` (13 casi — 15.9%):** Casi in cui lo snippet della fonte era amputato dell'intestazione (`GB-GR-007` fino a `GB-GR-012`, `GB-GR-015`, `GB-GR-028`, `GB-GR-030`, `GB-GR-046`) o conteneva parafrasi redatte dal reviewer invece di testo grezzo della fonte (`GB-GR-033`, `GB-GR-037`, `GB-GR-039`);
- **`DROP` (1 caso — 1.2%):** `GB-GR-032`, relativo a un meta-commento sul setup di benchmark B1 e non a un contenuto didattico;
- **`RECLASSIFY_TASK` (1 caso — 1.2%):** `GB-AC-018`, relativo alla formula `=SOMMA(Vendite!I2:I13)`, da riclassificare nel task di test dello Spreadsheet Adapter.

### 8.3 Correzioni Richieste al Gold Set
Per salvaguardare l'integrità scientifica:
1. Il file `validation/corpus/gold/gate-b/HUMAN_ANNOTATION.md` **non viene modificato né sovrascritto**, rimanendo la testimonianza primaria del lavoro svolto dall'annotatore umano;
2. Viene istituito il file derivato `HUMAN_ANNOTATION_v2.md` che recepisce:
   - I 13 estratti raw completi di intestazioni di sezione, recuperati direttamente dai markdown originali di scenario;
   - I relabel raccomandati con motivazione analitica e assegnazione della classe epistemica (inclusa la correzione di `GB-GR-035` a `UNSUPPORTED`);
   - L'espunzione del caso spurio `GB-GR-032`;
   - La ricollocazione di `GB-AC-018` nel dataset specialistico per fogli di calcolo.

### 8.4 Nuova Acceptance Semantics Gate C
Nel benchmark Gate C originario, i modelli venivano penalizzati confondendo l'ampliamento didattico o il calcolo logico con allucinazioni fattuali. La nuova semantica di accettazione per Gate C stabilisce che:
- Non costituisce violazione o deviazione l'inserimento di spiegazioni concettuali standard, domande interattive per la classe o esercizi analoghi, purché coerenti con il livello scolastico e gli obiettivi del piano di lezione;
- **Hard Failures (Condizioni di Fallimento Bloccanti):**
  1. Contraddizione esplicita di fatti di fonte (`SOURCE_FACT`);
  2. Falsa attribuzione materiale alla fonte documentale;
  3. Uso operativo di coordinate o dettagli fisici inesistenti (`SOURCE_SPECIFIC_DETAIL` non presenti nell'AST);
  4. Troncamento strutturale sintattico (`finish_reason=length`) o violazione dello schema JSON;
- **Status della Soglia 95%:** Il valore di accuratezza sui fatti di fonte ($\ge 95\%$) è formalmente designato come **`PROVISIONAL BENCHMARK THRESHOLD`** (soglia di benchmark provvisoria), da calibrare e validare sul gold set Gate B v2 corretto;
- **Metriche Multidimensionali di Gate C:** La valutazione misura contemporaneamente:
  - *Teacher editing effort* (entità del carico di correzione L3);
  - *Critical violation rate* (frequenza di errori bloccanti);
  - *Source-fact support* (accuratezza sui fatti documentali);
  - *Pedagogical usefulness* (efficacia didattica e aderenza pedagogica).

### 8.5 Protocollo Gate C v2
Il protocollo Gate C viene aggiornato per risolvere i due colli di bottiglia emersi:
1. **Generazione Composita a 6 Stadi:** I copioni didattici estesi (45–60 minuti) non vengono richiesti in una singola chiamata monolitica (soggetta a `finish_reason=length`), bensì generati mediante sequenza deterministica: `Plan → Bounded Sections → Assembly → Local Checks → Bounded Repair → Human Review (L3)`;
2. **Preflight a 3 Livelli per la Selezione della Coorte:**
   `Catalog Candidate → Protocol & Identity Probe → Benchmark Cohort`.
   Eventuali anomalie di rete, protocollo o credenziali (es. errore keepalive su Mistral) vengono intercettate nella probe preliminare e **non consumano slot del benchmark**. La coorte finale è composta da **3 route operative indipendenti**;
3. **Divieto di Fallback in Benchmark:** Nessun passaggio dinamico tra modelli durante la misurazione per garantire l'isolamento deterministico dei risultati.

### 8.6 Necessità o Meno di Spreadsheet Structured Adapter
**ESITO: SÌ, STRETTAMENTE NECESSARIO.**
L'analisi comparativa dimostra che i parser documentali generalisti (incluso MinerU) convertono i fogli di calcolo in tabelle Markdown lineari o testo privo di coordinate fisiche, formule native ed entità multi-foglio.
È indispensabile un componente software deterministico locale (`CellAwareSpreadsheetAdapter`), privo di dipendenze LLM e basato su librerie stabili (es. `openpyxl` / `calamine`), con il compito di generare un AST strutturato che preservi: nomi fogli, intervalli celle (`A1:D20`), valori raw e formule native memorizzate. L'adapter distingue le formule memorizzate preesistenti dalle formule didattiche generate a runtime.

### 8.7 Cosa delle Evidenze Gate C Rimane Valido
Dalla prima iterazione di Gate C rimangono pienamente valide e acquisite le seguenti evidenze:
1. **Mappatura del Catalogo Modelli:** Lo screening su 62 route del gateway OmniRoute ha identificato 13 candidati text-capable con finestre di contesto idonee ($\ge 32k$ token);
2. **Isolamento delle Credenziali e Architettura Esagonale:** La porta astratta `RemoteModelGateway` ha operato senza fughe di credenziali verso il dominio applicativo, con tracciamento puntuale delle chiamate;
3. **Validazione Empirica del Caso DBMS:** Su scenari privi di ambiguità di coordinate fisiche, i modelli hanno confermato eccellente padronanza della sintassi SQL ANSI e solida tenuta strutturale nello schema JSON richiesto;
4. **Trasparenza del Modello Selector:** La logica deterministica di selezione policy-driven è confermata come pienamente sufficiente e priva di overhead.

### 8.8 Cosa Deve Essere Rivalidato
È formalmente deliberata la necessità di **Gate C v2 (REQUIRED: SÌ)** per:
1. Rivalutare i profili `remote.generation` e `remote.longform` applicando la pipeline composita a sezioni vincolate anziché la chiamata monolitica;
2. Rivalutare lo scenario Excel fornendo al modello il contesto generato dal nuovo `CellAwareSpreadsheetAdapter`, eliminando la contraddizione originaria senza leakage del reference didattico;
3. Testare una coorte completa di 3 modelli verificati preventivamente mediante la probe di preflight;
4. Misurare le metriche di aderenza secondo la griglia delle 5 classi epistemiche e la soglia di benchmark provvisoria.

---

## 9. Prossimi Passi Consigliati

1. **Aggiornamento Mirato della Documentazione di Progetto:** Integrare le 5 classi epistemiche (con granularità claim/span e composabilità), la pipeline composita e l'adapter XLSX in `docs/ai/model-routing-and-registry.md`, `docs/dossiers/10-ai-architecture.md` e `docs/validation/00-feasibility-benchmark-gate.md`;
2. **Predisposizione del Gold Set Gate B v2 (`READY_FOR_GOLD_V2`):** Eseguire lo script di allineamento che ricostruisce i 13 contesti decontestualizzati e applica i relabel formalizzati in una copia `HUMAN_ANNOTATION_v2.md` (confermando `UNSUPPORTED` su GB-GR-035 ed espungendo GB-GR-032);
3. **Definizione dell'Interfaccia per lo Spreadsheet Adapter (`READY_FOR_SPREADSHEET_ADAPTER`):** Formalizzare il contratto Pydantic e la signature dell'adapter deterministico XLSX prima di Gate C v2;
4. **Esecuzione di Gate C v2:** Applicare il nuovo preflight diagnostico su OmniRoute, assemblare la coorte a 3 route attive ed eseguire il benchmark della pipeline composita su DBMS ed Excel.

---

## Identity Reconciliation Addendum — 30 settembre 2026

La successiva riconciliazione contro la v1 e le source raw ha identificato tre associazioni di ID errate in questo report. Per questi ID è autorevole `validation/results/Gate-B-gold-v2-reconciliation.md`:

- `GB-AC-018`: il caso reale v1 riguarda la spiegazione CERCA.X, non `=SOMMA(Vendite!I2:I13)`; final label `SATISFIED`, `RELABEL_RECOMMENDED`, resta nel Gold Gate B generale.
- `GB-GR-037`: il caso reale v1 riguarda l'affermazione che l'estratto contenga istruzioni di installazione/uso di DB Browser; final label `UNSUPPORTED`, `REBUILD_CONTEXT`.
- `GB-GR-046`: il caso reale v1 è la controlled perturbation che assegna `nome` come PK di `prodotti`; final label `UNSUPPORTED`, `REBUILD_CONTEXT`.

Conteggi canonici post-riconciliazione: `KEEP 61`, `RELABEL_RECOMMENDED 7`, `REBUILD_CONTEXT 13`, `DROP 1`, `RECLASSIFY_TASK 0`; Gold Gate B finale: **81 casi**. Le descrizioni confliggenti precedenti restano storiche e sono superseded da questo addendum e dal report di riconciliazione.
