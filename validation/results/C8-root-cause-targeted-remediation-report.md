# C8 — C7 root cause e remediation mirata

**Data:** 10 ottobre 2026 (Europe/Rome)  
**Modalità:** review locale/offline; nessuna inferenza o chiamata remota.  
**Esito C7:** review offline completata; nessuna eligibility assegnata; Domain Owner sign-off ancora pendente; Gate D resta `BLOCKED`.

## Sintesi decisionale

Gli otto sample C7 sono evidenza diagnostica, non una misura esaustiva della capacità del prodotto né una base per cambiare modello o registry. Il ledger contiene 41 claim rappresentativi, non il denominatore completo: `SOURCE_FACT >=95%` resta `NOT_EVALUATED`. Si applicano Dossier 04 §47 e Dossier 05 §57: affidabilità fattuale, copertura didattica e qualità pedagogica sono distinte; parafrasi e nuovi contesti autosufficienti sono leciti; precisione su coordinate/formule è richiesta solo quando il testo afferma di descrivere il workbook effettivo.

La causa non è unica. Nei longform Excel concorrono evidenza strutturata insufficiente per il modello e affermazioni non supportate introdotte nella pianificazione/generazione; nei DBMS alcuni errori sono vere inesattezze disciplinari dell'output. Il caso `\\n` di CORR-02 R1 è già presente nel testo prodotto dal modello: non è stato introdotto dal renderer. Un prerequisito DBMS (database pronto e scala di `sconto_percento`) manca dai materiali disponibili e va risolto come dato/setup, non inventato dal modello.

### Diagnosi per causa

| Categoria | Evidenza C7 | Interpretazione e responsabilità |
|---|---|---|
| **Errore di modello / contenuto generato** | CORR-03 R1 descrive `ROUND(...,2)` come troncamento; CORR-03 R2 sostiene che `SELECT nome prezzo FROM prodotti` fallisca per la virgola mancante, mentre la verifica locale SQLite lo accetta come alias; CORR-03 R1 formula inoltre una conseguenza categorica di `SELECT *` non universale. CORR-02 R2 usa apici singoli per il criterio testuale `'>=100'`. CORR-04 R1 attribuisce al corso PivotTable/dashboard e usa `C4` come codice prodotto benché sia quantità; CORR-04 R1/R2 riportano colonne/righe non corrispondenti alle operazioni descritte. | Sono errori reali nel testo generato (claim `03R1-03`, `03R1-05`, `03R2-03`, `02R2-04`, `04R1-01`, `04R1-03..05`, `04R2-02..05`). Non dimostrano da soli un difetto stabile o specifico del modello. Prima si devono ridurre lacune di contesto e introdurre controlli circoscritti; solo una ricorrenza in un test adeguatamente grounded giustificherebbe valutare un intervento model-specific. |
| **Prompt / specifica del deliverable** | Il prompt Stage 2 per CORR-02 richiede materiale studente distinto e coerente, ma lo schema chiede solo una stringa (`minLength: 60`); non specifica una struttura leggibile, intestazioni o interruzioni di paragrafo. Le istruzioni longform delimitano fonti/evidence e vietano di spacciare risposte simulate per osservazioni, ma il planner può produrre specifiche didattiche e ancore che le evidenze effettivamente passate non sostengono. | La mancanza di vincoli di presentazione è un fattore plausibile per la forma monolitica; non è prova che il prompt abbia causato da solo gli errori fattuali. Per una futura versione, precisare formattazione/leggibilità e dire esplicitamente di omettere o dichiarare come proposta ogni dettaglio workbook-specific non presente nell'evidence visibile. Non è stato ritoccato il prompt congelato. |
| **Evidence pack / visibilità** | Nei request Stage 1/2 Excel CORR-02 il contesto include `excel_demo_b1.md` e l'evidence prompt espone cinque elementi: tre medie venditore, le celle M3/M4; non espone l'intero AST del workbook. Nel request longform di CORR-04 per `sec_summary_criteria`, `source_context` è vuoto e `prompt_evidence` contiene i tre risultati medi venditore, mentre l'output pianificato tratta formule/range come istruzioni concrete. Il manifest/ledger conservano i request e i relativi hash. | La verifica locale dispone di dati AST che non erano nel contesto model-visible. Il modello non aveva evidenza sufficiente per formule/range esatti. L'adapter Excel deve passare solo i fatti minimi necessari e verificati, o vietare di presentare coordinate/formule esatte come fatti; non deve riversare l'AST completo né imporre coordinate a tutorial generici. |
| **Rendering** | Il contenuto finale della risposta SSE Stage 2 ricomposto e il `student_material` nel `generation-output.json` decodificato di CORR-02 R1 contengono **96** sequenze letterali backslash+n e **0** newline reali. CORR-02 R2 è anch'esso una singola stringa continua. | Il difetto R1 è già nel contenuto della risposta/artifact; il rendering/serializzatore lo ha preservato, non creato. Non normalizzare né riscrivere retroattivamente l'output storico. Una futura regola di formato può chiedere leggibilità e segnalare stringhe escape letterali, ma non è stata aggiunta una conversione automatica. |
| **Dati/prerequisiti mancanti** | CORR-01 R1/R2 e CORR-03 R1/R2 presuppongono una base SQLite pre-popolata non presente nel Source Set; la scala di `sconto_percento` (0–1 o 0–100) e i valori effettivi non sono specificati. Claim `01R1-04`, `01R2-04`, `03R1-04`, `03R2-04..05`. | È `NOT_VERIFIABLE` / prerequisito operativo, non un errore fattuale dimostrato. Fornire il database e documentarne i valori oppure rendere l'attività indipendente da tali dati; non chiedere al modello di indovinare. |
| **Validazione** | L'evaluator aveva prodotto un falso positivo M3/M4, già corretto nell'audit separato; la review C7 conferma che la mappatura etichetta M3/valore M4 è corretta. Il controllo longform copriva i requisiti dichiarati (commission-cell-role/ranking), non ogni formula o range del workbook. Il `QUALITY_PASS` storico non ha intercettato vari errori di contenuto. | Non riaprire il falso positivo né cambiare gli stati storici. Rafforzare controlli solo dove la fonte e l'adapter forniscono autorità verificabile. Non trasformare la precisione Excel storica in requisito generale per materiali di testo o per il prodotto. |

## Correzione locale eseguita

È stata aggiunta una regola circoscritta in `validation/work/C6/scripts/excel_generation_validator.py` (versione `c6-excel-generation-artifact-validator-1.1.0`): rileva un criterio relazionale tra apici singoli nel secondo argomento di `CONTA.SE`/`COUNTIF`, e produce `INVALID_EXCEL_CRITERION_QUOTING`. Riconosce entrambi i nomi funzione e separatori `;`/`,`; non penalizza un nome foglio tra apici nell'argomento intervallo né un esempio esplicitamente etichettato come errato. Il validator segnala e conserva il materiale: **non** ripara la formula.

Il fake scenario di test `countif_single_quote` è stato aggiunto in `validation/work/C6/scripts/scenario_builders.py`; i test mirati sono in `validation/work/C6/tests/test_c6_harness_transport.py`. È una protezione **specifica dell'adapter Excel**, non un controllo universale per generazione didattica. Non sono stati modificati prompt, contratti, Source Set, renderer, evaluator overlay/ledger, output C7, registry, profili o eligibility. Non è stato introdotto alcun intervento sul modello.

## Test e preservazione

- Sintassi Python dei due script e del test: **PASS** (`ast.parse`; Python 3.14).
- Suite locale `validation.work.C6.tests.test_c6_harness_transport`: **82/82 PASS**. Le chiamate HTTP presenti nei test sono simulate/mocked; nessun provider è stato contattato.
- Regressione dedicata: criterio `CONTA.SE(...; '>=100')` e `COUNTIF(..., '>=100')` respinti; `">=100"` e nome foglio tra apici accettati; esempio dichiarato errato non respinto.
- Manifest C7: **325/325** artifact finali presenti e con SHA-256 uguale al manifest. In aggiunta sono rimasti byte-identici il report C7 (`9e21b6f3…b276a7`), il claim ledger (`ad871eba…aee1f916`), il packet Domain Owner (`2496227b…aaad7b`) e i due output CORR-02 R1/R2 (`311d1694…4f8e8b`, `58c3de2f…b66415`). Il report C7 registra inoltre la verifica storica di 329/329 file dell'execution contro il baseline; in questa review ho ricontrollato direttamente i 325 artifact elencati nel manifest. Nessun output storico è stato corretto in place.
- Contratti C6, corrective matrix e source pins non sono stati modificati. Gli hash dei quattro contratti corrispondono al `validate-only.json` C6 congelato; `source-pins.json` mantiene `8856d998…a50f3c4a6`. Le fonti e gli output C7 non sono target di scrittura.
- Chiamate remote/inferenze: **0**. Corpus inviato: **no**. Modifiche registry/Gate D: **0**.

## Interventi non giustificati in questa fase

1. **Nessun cambio o fine-tuning/sostituzione del modello:** otto sample e 41 righe rappresentative non distinguono un limite sistematico da errori episodici e input incompleti.
2. **Nessuna riscrittura di CORR-01…04:** i record C7 sono storici; ogni nuova bozza, se richiesta, deve essere un nuovo artifact con provenienza distinta.
3. **Nessun controllo coordinate generalizzato:** applicarlo a output che non dichiarano fatti su uno specifico workbook violerebbe D4 §47. Per Excel, coordinate e formule vanno controllate solo quando sono richieste e l'evidence dell'adapter le supporta.
4. **Nessuna riparazione automatica di `\\n`:** trasformare testo letterale in struttura potrebbe cambiare contenuto. Nessuna conversione è stata fatta.
5. **Nessuna promozione:** il Domain Owner packet resta non firmato; `SOURCE_FACT >=95%` non è calcolabile dal ledger; eligibility non cambia; Gate D resta bloccato.

## Piccolo E2E proposto — materiali prevalentemente testuali

Dopo autorizzazione e senza cambiare eligibility, eseguire un solo micro-caso su un modello già autorizzato per la prova (non è una selezione di modello): un testo disciplinare breve e congelato, prevalentemente narrativo/espositivo, un obiettivo osservabile e una lezione di circa 45–50 minuti. Conservare source/request/output hash e due repliche indipendenti soltanto se il budget previsto le consente.

1. **Fonti → Teacher Material:** generare un piano/bozza docente. Il reviewer elenca claim source-specific e ad alto impatto; ogni claim attribuito alla fonte deve essere rintracciabile e corretto. Nessun errore fattuale materiale, falsa attribuzione o fonte inventata; conoscenza generale/proposte sono etichettate o distinte, e punti incerti sono segnalati invece di essere asseriti.
2. **Conferma copertura:** il docente conferma quali obiettivi/contenuti sono stati effettivamente trattati; la bozza del piano da sola non li certifica.
3. **Teacher Material → Student Material:** generare una dispensa leggibile e autonoma rispetto alle sole conoscenze concordate. Valutare accuratezza, chiarezza, livello, esempi/scaffolding, utilità e reale editing richiesto separatamente; non usare similarità testuale come criterio di fedeltà.
4. **Student Material → Assessment:** produrre una breve verifica e chiave di risposta. Ogni item deve mappare a un obiettivo e alla lezione/dispensa; nuovi contesti sono ammessi se i dati sono autosufficienti. Verificare prerequisiti, risolvibilità, univocità, correttezza della chiave e assenza di tecniche non insegnate.
5. **Decisione:** revisione umana con rubriche separate per affidabilità fattuale, qualità pedagogica/copertura e coerenza lesson–handout–assessment, più editing effort. Richiedere zero errori fattuali critici e zero prerequisiti indebiti; registrare anche difetti minori e incertezze. Un singolo E2E dà evidenza esplorativa, non eligibility o sblocco automatico di Gate D.

Questa proposta esercita D4 §47 e D5 §57 senza benchmark esteso, senza dipendenza da XLSX e senza reintrodurre una soglia di copia letterale. Richiede approvazione e non è stata eseguita in questo task.

## Fonti locali consultate

`STATUS.md`; C7 report, triage, claim ledger e Domain Owner packet; i request/artifact C7 identificati nel ledger; `validation/work/Gate-C-v2/inputs/scenario_sources/{excel_demo_b1.md,dbms_student_lesson.md}`; contratti, source pins e test C6; Dossier 04 §47 e Dossier 05 §57; convenzioni `development-environment/AGENTS.md`, `docs/environment/README.md`, `docs/engineering/{README.md,agent-protocol.md,testing.md,coding.md,documentation.md}`. La root del progetto non contiene `.git`; la review scope e la preservazione sono state controllate mediante hash/manifest.
