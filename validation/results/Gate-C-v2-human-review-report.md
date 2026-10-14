# Gate C v2 — Blind Assistant Review Report (Attempt-07 / Attempt-09)

> **Stato:** Formalizzato e Concluso — Giudizi di Assistant Blindati Fissati e Mapping Rivelato
> **Ruolo:** AI Platform Architect
> **Data:** 1 ottobre 2026 (Europe/Rome)
> **Reviewer:** ChatGPT — blind assistant review (`MODEL_IDENTITY_BLINDED_ASSISTANT_REVIEW` su richiesta dell'utente)
> **Metodo:** Valutazione qualitativa cieca rispetto all'identità dei modelli (Model ID, provider e mapping candidato ciechi) condotta prima dell'apertura del mapping
> **Human / Domain Owner Sign-Off:** Requisito aperto; la ratifica formale del Domain Owner è obbligatoria prima della promozione a `VALIDATED` / `ELIGIBLE`
> **Workspace:** `~/Workspace/teacher-service-design`

---

## 1. Metodologia di Revisione Blindata (Blind Assistant Review)

In conformità al protocollo sperimentale di Gate C v2 e su specifica richiesta dell'utente, la valutazione qualitativa dei deliverable è stata condotta secondo una rigida disciplina di isolamento dell'identità dei modelli:

1. **Anonimizzazione Rigorosa dell'Identità dei Modelli (*Model-Identity Blinding*):** I deliverable generati sono stati presentati al reviewer esclusivamente tramite i codici ciechi `CANDIDATE-A`, `CANDIDATE-B` e `CANDIDATE-C`, senza alcuna indicazione su Model ID, provider, root di routing o configurazione di inferenza;
2. **Accesso all'Evidenza Tecnica e Distinzione di Giudizio:** Il reviewer ha avuto accesso allo stato tecnico (`COMPLETE_TECHNICAL_PASS`, `COMPLETE_TECHNICAL_ISSUES`, `INCOMPLETE`), ai sommari deterministici e alle evidenze dei checker. Tuttavia, i warning/hit dei checker automatici **non sono stati accettati acriticamente come errori fattuali**, ma verificati rispetto alla consistenza didattica e all'AST della sorgente;
3. **Fissazione Immutabile dei Punteggi (*Scores Locked*):** Tutti i punteggi della rubrica (0–4) e i giudizi descrittivi sono stati fissati e congelati prima di accedere all'artefatto di mapping separato (`validation/artifacts/Gate-C-v2/review-key.json`);
4. **Artefatto di Mapping Separato (Review Key):** Il file `review-key.json` è un artefatto di mapping separato (non cifrato crittograficamente), conservato in isolamento e consultato unicamente dopo la formalizzazione dei punteggi;
5. **Divieto di Rigiudizio e Ruolo dell'Assistant Review:** I punteggi assegnati costituiscono evidenza fissata non alterabile. Poiché la review è stata condotta da assistant e non direttamente da un essere umano, essa non sostituisce il sign-off finale del Domain Owner (Simone), che resta un requisito aperto e obbligatorio prima di qualsiasi promozione definitiva a `VALIDATED` o `ELIGIBLE`.

---

## 2. Deliverable Effettivamente Valutati

A causa dell'interruzione dell'esecuzione della Phase 2 (scenario Excel generation e repliche), il pacchetto composito (`Gate-C-v2-human-review-packet-attempt-09.md`) ha sottoposto a valutazione i **4 deliverable completi** ottenuti nella Phase 1 (attempt-07):

1. **`CANDIDATE-A` — DBMS SQL Scenario:** Teacher Script Longform (`COMPLETE_TECHNICAL_PASS`);
2. **`CANDIDATE-A` — Excel Scenario:** Teacher Script Longform (`COMPLETE_TECHNICAL_ISSUES`);
3. **`CANDIDATE-B` — DBMS SQL Scenario:** Generation (Lesson Plan + Student Material) (`COMPLETE_TECHNICAL_PASS`);
4. **`CANDIDATE-C` — DBMS SQL Scenario:** Generation (Lesson Plan + Student Material) (`COMPLETE_TECHNICAL_PASS` a livello JSON Schema).

Gli altri 8 deliverable teorici della matrice $3 \times 2 \times 2$ risultavano nello stato `INCOMPLETE` (troncamento token o limiti di contesto) oppure non eseguiti (`NOT_RUN` in Phase 2).

---

## 3. Rubrica di Valutazione Qualitativa e Categorie di Editing Effort

La valutazione qualitativa ha applicato la rubrica multidimensionale standard (scala 0–4 per criterio):

- **Factual Correctness (0–4):** Esattezza concettuale, sintassi SQL corretta, coordinate di cella verificate;
- **Source Fidelity (0–4):** Aderenza ai contenuti della dispensa didattica e assenza di allucinazioni di dominio;
- **Completeness (0–4):** Completezza della trattazione rispetto a tutti gli obiettivi pedagogici previsti;
- **Pedagogical Usefulness (0–4):** Efficacia didattica per l'insegnamento in aula e chiarezza metodologica;
- **Level Adherence (0–4):** Calibrazione del linguaggio e della complessità per il target (principianti);
- **Duration Adherence (0–4):** Congruità della suddivisione dei tempi rispetto alla durata prevista (120 minuti);
- **Structure / Coherence (0–4):** Organizzazione modulare in fasi didattiche ben collegate e fluide;
- **Unnecessary Repetition (0–4):** Assenza di ridondanze inutili, riempitivi verbali o loop tautologici;
- **Teacher Editing Effort (Categorie Canoniche):**
  - `usable_as_is`: Pronto per l'adozione in classe senza alcuna modifica necessaria;
  - `minor_edits`: Richiede solo lievi rifiniture stilistiche o correzioni lessicali minori;
  - `moderate_edits`: Richiede correzione di calcoli specifici, formule o riscrittura mirata di una sezione;
  - `major_rewrite`: Richiede una ristrutturazione estesa dei contenuti o ricalcoli sistematici;
  - `unusable`: Rifiutato per inconsistenza, assenza di contenuto didattico o fallimento semantico.

*(Nota: le categorie di editing effort seguono la tassonomia canonica; non sono associate a finestre temporali rigide in minuti, che rimangono subordinate a calibrazione empirica).*

---

## 4. Punteggi Fissati (*Locked Scores*)

I punteggi assegnati nella blind assistant review sono formalizzati nella seguente matrice immutabile:

| Dimensione di Valutazione | CANDIDATE-A<br>(DBMS Longform) | CANDIDATE-A<br>(Excel Longform) | CANDIDATE-B<br>(DBMS Generation) | CANDIDATE-C<br>(DBMS Generation) |
|---|:---:|:---:|:---:|:---:|
| **Factual Correctness** | **3 / 4** | **2 / 4** | **3 / 4** | **3 / 4** *(su poche frasi)* |
| **Source Fidelity** | **3 / 4** | **3 / 4** | **4 / 4** | **3 / 4** *(su poche frasi)* |
| **Completeness** | **4 / 4** | **4 / 4** | **4 / 4** | **0 / 4** |
| **Pedagogical Usefulness** | **4 / 4** | **4 / 4** | **3 / 4** | **0 / 4** |
| **Level Adherence** | **4 / 4** | **4 / 4** | **4 / 4** | **1 / 4** |
| **Duration Adherence** | **4 / 4** | **3 / 4** | **4 / 4** | **1 / 4** |
| **Structure / Coherence** | **4 / 4** | **4 / 4** | **4 / 4** | **1 / 4** |
| **Unnecessary Repetition** | **3 / 4** | **3 / 4** | **4 / 4** | **4 / 4** |
| **Punteggio Medio (0–4)** | **3.63** | **3.38** | **3.75** | **1.63** |
| **Teacher Editing Effort** | **`minor_edits`** | **`moderate_edits`** | **`minor_edits`** | **`unusable`** |

---

## 5. Rivelazione del Mapping Blind (*Unblinding*)

A valle del congelamento dei giudizi di valutazione qualitativa, è stata aperta la review key separata (`validation/artifacts/Gate-C-v2/review-key.json`), rivelando il seguente mapping:

- **`CANDIDATE-A`** $\longrightarrow$ **`agy/gemini-3.8-flash-tiered`**
- **`CANDIDATE-B`** $\longrightarrow$ **`groq/qwen/qwen3.8-27b`**
- **`CANDIDATE-C`** $\longrightarrow$ **`openrouter/dots-studio/dots-3-note-preview:free`**

---

## 6. Analisi Dettagliata per Deliverable Valutato

### 6.1 CANDIDATE-A (`agy/gemini-3.8-flash-tiered`) — DBMS Longform (Teacher Script)
- **Caratteristiche:** Copione esteso completo (3989 parole), scansione didattica modulare su 120 minuti;
- **Qualità Pedagogica:** Voce docente naturale e coinvolgente; transizioni fluide tra teoria relazionale, algebra di base e sintassi SQL (`SELECT`, `WHERE`, `JOIN`); gestione realistica delle pause didattiche e delle domande di verifica;
- **Criticità Minori:** Lievi ridondanze nei riepiloghi tra le fasi 3 e 4;
- **Giudizio Sintetico:** Valutazione eccellente (**3.63 / 4**), editing effort **`minor_edits`**.

### 6.2 CANDIDATE-A (`agy/gemini-3.8-flash-tiered`) — Excel Longform (Teacher Script)
- **Caratteristiche:** Copione didattico approfondito (4275 parole) su cartella Excel di vendita;
- **Qualità Pedagogica:** Spiegazione eccellente della funzione logica `SE` e delle formule di ricerca; ottima scansione del tempo d'aula;
- **Errori Puntuali Confermati (Audit sull'AST):**
  1. *Inversione Etichetta/Valore su Aliquota Commissione:* Il modello ha fatto riferimento alla cella `M4` come contenente la stringa d'intestazione "Aliquota commissione", mentre nell'AST `M3` è l'etichetta testuale (`Aliquota commissione`) e `M4` è il valore numerico decimale `0.05` (formattato `0%`);
  2. *Errore di Calcolo su Aggregazione Derivata (`MEDIA.SE`):* Il testo afferma che la venditrice Sara ha conseguito la media vendite più alta, mentre il calcolo algebrico esatto sulle righe dati assegna a Marco la media più alta (~89.32 € contro ~74.73 € di Sara);
- **Coordinate Inesistenti:** Zero coordinate inventate (tutte le 19 coordinate citate appartengono al foglio `Vendite` `A3:M15`);
- **Giudizio Sintetico:** Punteggio solido (**3.38 / 4**), declassato a Factual 2/4 per i due errori puntuali. Editing effort: **`moderate_edits`** (richiede correzione manuale mirata delle due occorrenze).

### 6.3 CANDIDATE-B (`groq/qwen/qwen3.8-27b`) — DBMS Generation (Lesson Plan + Student Material)
- **Caratteristiche:** JSON strutturato valido; suddivisione realistica delle attività su 120 minuti;
- **Qualità Pedagogica:** Lesson Plan operativo chiaro; Student Material ben differenziato dal piano docente, con sintesi teoriche ed esercizi guidati adeguati al livello principianti;
- **Limiti Riscontrati:** Impostazione prudente che aderisce strettamente alla dispensa; spiegazioni relazionali talvolta appiattite;
- **Giudizio Sintetico:** Deliverable pienamente utilizzabile (**3.75 / 4**), editing effort **`minor_edits`**. Dimostra la fattibilità della generazione strutturata quando il carico di token rimane contenuto.

### 6.4 CANDIDATE-C (`openrouter/dots-studio/dots-3-note-preview:free`) — DBMS Generation
- **Caratteristiche:** JSON formalmente valido e conforme allo schema sintattico JSON Schema;
- **Fallimento Semantico:**
  - Il Lesson Plan non è un piano di lezione, ma una tautologia descrittiva (*"piano operativo per 120 minuti con fasi, minutaggi senza sovrapposizioni..."*);
  - Lo Student Material è una guida meta-prescrittiva rivolta a chi redige il materiale (*"inserire esercizi da 1 a 4...", "spiegare la teoria..."*);
  - Completeness e Pedagogical Usefulness pari a **0 / 4**;
- **Giudizio Sintetico:** Deliverable totalmente inutilizzabile (**1.63 / 4**), editing effort **`unusable`**. Evidenzia la necessità di un gate deterministico di completezza semantica a monte della revisione.

---

## 7. Distinzione Metodologica: Checker Automatico vs. Errore Umano/Semantico Confermato

La discrepanza emersa tra i warning dei checker automatici preliminari e la verifica semantica sull'AST ha evidenziato una netta separazione:

```text
┌──────────────────────────────────────┐        ┌──────────────────────────────────────┐
│       AUTOMATIC CHECKER HITS         │   ≠    │     CONFIRMED SEMANTIC/AST ERRORS    │
├──────────────────────────────────────┤        ├──────────────────────────────────────┤
│ 74 warning generati sui copioni      │        │ 0 coordinate inesistenti citate      │
│ Formule didattiche scambiate per leak│        │ 1 inversione etichetta M3 / valore M4│
│ Euristica lessicale rigida           │        │ 1 calcolo derivato errato (Sara)     │
└──────────────────────────────────────┘        └──────────────────────────────────────┘
```

1. **Limiti dei Checker Lessicali Rigidi:** Il checker preliminare considerava anomala qualunque formula o coordinata non presente nel testo grezzo della dispensa, non riconoscendo che il modello stava legittimamente estraendo celle reali dall'AST del foglio per costruire esercizi didattici;
2. **Natura Puntuale degli Errori Reali:** Gli unici errori confermati sull'AST riguardano l'inversione di ruolo M3/M4 (etichetta vs valore) e l'aggregazione algebrica di riga (`MEDIA.SE`);
3. **Implicazione di Progetto:** I modelli LLM non devono essere l'autorità di calcolo per le aggregazioni numeriche del workbook, che devono essere fornite come evidenza deterministica derivata (`SOURCE_DERIVED`).

---

## 8. Impatto per Capability e Status Attuale dei Profili

Sulla base dei punteggi fissati e dell'evidenza tecnica disponibile:

| Profilo Capability | Esito Assistant Review | Stato Attuale da Conservare | Motivazione Tecnica |
|---|---|---|---|
| **`remote.generation`** | 1 PASS con minor edits (Groq DBMS), 1 UNUSABLE (Dots DBMS), 2 TRUNCATED (Gemini) | **UNVALIDATED** | Nessun modello è validato su entrambi gli scenari (DBMS + Excel); la call monolitica ha evidenziato fragilità strutturali. |
| **`remote.longform`** | 1 PASS con minor edits (Gemini DBMS), 1 PASS con moderate edits (Gemini Excel), 2 FAIL (Groq, Dots) | **UNVALIDATED** | Gemini ha mostrato ottima tenuta ma 2 errori specifici in Excel; Groq e Dots non sostengono la pipeline composita estesa. |
| **`remote.reasoning`** | Non rieseguito in Phase 2 | **HISTORICAL_ELIGIBLE** (Gemini) | Conserva la qualifica storica ottenuta nel Gate C originario (B3 assessment blueprint validato). |
| **`Gate D (End-to-End)`** | Dipendente da `remote.generation` e `remote.longform` | **BLOCKED** | Nessun profilo di generazione remota è promosso a `VALIDATED` o `ELIGIBLE`. |

---

## 9. Ricostruzione Accurata del Trasporto di Rete e Limiti della Phase 2

Si verbalizza la ricostruzione tecnica accurata della mancata esecuzione della Phase 2:

1. **Attempt-08:** Fallimento di trasporto nella fase di bootstrap del catalogo Live OmniRoute (`URLError`), seguito da un crash nel branch di gestione errori del runner per mancata definizione di `_mark_phase2_unavailable` (`NameError`);
2. **Attempt-09:** Il live catalog refresh verso OmniRoute è fallito per trasporto (`URLError: <urlopen error [Errno 61] Connection refused>`). Il runner ha attivato correttamente la policy di fallback usando lo snapshot congelato di attempt-07 come base di identità dei modelli; successivamente, **entrambi i route guard one-shot diretti sono falliti con `URLError` senza alcuna risposta HTTP**. La Phase 2 non è stata quindi bloccata semplicemente dal catalog refresh, ma dalla totale indisponibilità di connettività di rete sui socket di inferenza;
3. **Conseguenza sulla Raccolta Dati:** Nessun artefatto generato è stato prodotto da attempt-08 o attempt-09. L'evidenza empirica su `remote.generation` per lo scenario Excel rimane non osservata per tutti i candidati;
4. **Necessità del Rerun Correttivo:** Tale lacuna rende necessario un rerun correttivo mirato sulle configurazioni non ancora validate.

---

## 10. Requisito Aperto di Human / Domain Owner Sign-Off

Poiché i giudizi qualitativi formalizzati nel presente documento derivano da una **blind assistant review** e non da un esame diretto del docente umano:

1. **Nessuna Promozione Automatica:** Nessun modello o profilo può transitare a `VALIDATED` o `ELIGIBLE` senza il sign-off esplicito del Domain Owner (Simone);
2. **Sign-Off Packet Post-Rerun:** A valle del rerun correttivo verrà generato un pacchetto di sign-off compatto contenente gli artefatti finali, il riassunto dell'assistant review, l'audit fattuale e i campi per ratifica (`APPROVE`, `AMEND`, `REJECT`), senza richiedere al docente di ripetere l'analisi tecnica di basso livello;
3. **Mantenimento dello Stato di Blocco:** Fino a tale ratifica formale, tutti i profili di generazione remota rimangono `UNVALIDATED` e Gate D rimane `BLOCKED`.

---

## 11. Architecture Review Corrections — 2026-10-01

A seguito della revisione architetturale, sono state applicate le seguenti correzioni esplicite al presente documento:
- **Attribuizione della Review:** Rettificata da "Valutatore Umano: Simone" a "Reviewer: ChatGPT — blind assistant review (`MODEL_IDENTITY_BLINDED_ASSISTANT_REVIEW`)", esplicitando che il sign-off formale del Domain Owner è un requisito ancora aperto;
- **Metodologia di Blinding:** Chiarito che il blinding riguardava l'identità del modello (Model ID, provider, codice cieco), mentre le evidenze tecniche e diagnostiche erano accessibili al reviewer; eliminata l'affermazione di isolamento totale dai checker tecnici;
- **Review Key:** Eliminata la dicitura "file cifrato"; precisato che `review-key.json` è un artefatto di mapping separato in chiaro;
- **Cronologia dei Fallimenti di Trasporto:** Rettificata la dinamica di attempt-09, documentando il corretto fallback sull'identity basis di attempt-07 e il successivo fallimento per `URLError` dei route guard one-shot diretti;
- **Dettagli Fattuali dell'AST Excel:** Corretta la denominazione della colonna `M` in "Aliquota commissione" (anziché "Aliquota IVA") e precisato che `M4` è `0.05` con formato `0%`;
- **Categorie di Editing Effort:** Riconciliate con la tassonomia canonica (`usable_as_is`, `minor_edits`, `moderate_edits`, `major_rewrite`, `unusable`), rimuovendo soglie temporali arbitrarie in minuti.
