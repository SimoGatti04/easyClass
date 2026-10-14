# Dossier 06 — Grading & Feedback

## 1. Domanda centrale

Come trasformare risposte e consegne in valutazioni affidabili, spiegabili e modificabili dal docente, separando chiaramente correzione, scoring, conversione in voto, decisione finale e feedback?

Il sistema deve ridurre la parte ripetitiva della correzione senza creare un 'voto AI' opaco.

## 2. Vincoli già approvati

Questo dossier assume come già deciso:

- ogni Response conserva il dato originale e la Item Version esatta;
- ogni Item può avere una Evaluation Spec;
- la strategia di correzione dipende dal tipo di risposta;
- quando esistono controlli deterministici/eseguibili devono essere preferiti;
- le risposte aperte vengono valutate per criteri con evidenze e confidence;
- soglie configurabili distinguono auto-approvazione, batch review e review obbligatoria;
- il sistema controlla la coerenza tra risposte simili;
- una correzione del docente può essere proposta sui casi simili ma mai propagata silenziosamente;
- punteggio grezzo, voto proposto e voto finale sono distinti;
- regole di voto gerarchiche ed ereditarie;
- domanda annullata o difettosa non viene cancellata dallo storico;
- Integrity Evidence è separata dalla valutazione;
- il docente resta autorità finale.

## 3. Pipeline concettuale

Il modello proposto è:

```text
RESPONSE / SUBMISSION
        ↓
EVALUATION STRATEGY
        ↓
CRITERION EVALUATIONS
        ↓
ITEM SCORE
        ↓
ATTEMPT SCORE
        ↓
NORMALIZATION / SCORE POLICY
        ↓
GRADE PROPOSAL
        ↓
FINAL GRADE
        ↓
FEEDBACK + LEARNING EVIDENCE
```

Questi passaggi sono collegati ma non devono essere collassati in un unico valore.

## 4. Evaluation Run

Una `Evaluation Run` rappresenta una specifica esecuzione della correzione.

Serve per sapere:

- quali Response sono state valutate;
- quale Evaluation Spec/rubrica era in vigore;
- quale strategia/checker/modello è stato usato;
- quali regole erano attive;
- quando è avvenuta la valutazione;
- quali risultati sono stati prodotti;
- se è stata automatica, assistita o manuale.

Se cambia una rubrica o un checker, possiamo creare una nuova Evaluation Run senza perdere la precedente.

## 5. Evaluation revision vs risposta originale

La Response dello studente non viene mai riscritta dalla correzione.

Concettualmente:

```text
Response originale
   ├─ Evaluation Run v1
   ├─ Evaluation Run v2
   └─ Decisione docente finale
```

Questo garantisce audit e confrontabilità.

## 6. Evaluation Strategy

La strategia è scelta in base a Evaluation Spec e tipo di Item.

Famiglie iniziali:

- deterministica;
- numerica;
- eseguibile/verificabile;
- rubric-based strutturata;
- semantica assistita;
- manuale;
- ibrida.

Il routing della strategia è dominio; la tecnologia concreta verrà scelta nel Dossier AI/Platform.

## 7. Correzione deterministica

Adatta a:

- scelta singola;
- scelta multipla;
- vero/falso;
- matching;
- riordinamento;
- chiavi esatte;
- altre risposte formalmente confrontabili.

Deve supportare:

- più risposte corrette;
- partial credit quando definito;
- penalità quando previste;
- Item annullati;
- chiavi corrette successivamente.

Quando le regole sono completamente determinate, la confidence non deve simulare incertezza artificiale.

## 8. Valutazione numerica

Può considerare:

- valore esatto;
- tolleranza;
- unità;
- arrotondamento;
- forme equivalenti;
- intervalli ammessi.

Se il procedimento conta, il confronto numerico valuta solo il criterio pertinente e non l'intero Item.

## 9. Valutazione eseguibile/verificabile

Per SQL, codice, formule, configurazioni o output verificabili, il sistema dovrebbe poter separare criteri come:

- correttezza del risultato;
- copertura dei casi;
- robustezza;
- vincoli richiesti;
- procedimento;
- stile/leggibilità quando rilevante.

Test automatici o esecuzione verificabile producono evidenze, non necessariamente il punteggio finale completo.

## 10. Rubric

La rubrica è una struttura versionata di criteri.

Esempio:

```text
Correttezza concettuale .... 5 punti
Completezza ................ 3 punti
Motivazione ................ 2 punti
```

Ogni criterio può avere:

- descrizione;
- massimo punti/peso;
- livelli o descrittori;
- condizioni;
- esempi validi/non validi;
- Evaluation Strategy;
- policy di review.

Non tutte le domande hanno bisogno di una rubrica esplicita complessa.

## 11. Criterion Evaluation

L'unità minima spiegabile della valutazione è il risultato per criterio.

Può contenere:

- criterio/versione;
- evidenze nella risposta;
- punti proposti;
- spiegazione sintetica;
- confidence quando applicabile;
- strategia usata;
- stato di review;
- eventuale decisione docente.

Esempio:

```text
Completezza
2 / 3
Evidenza: manca il confronto con LEFT JOIN
Confidence: media
```

## 12. Evidence

Una valutazione non deterministica deve poter indicare su cosa si basa.

Possibili evidenze:

- porzione della risposta;
- test superato/fallito;
- concetto presente/assente;
- errore rilevato;
- output prodotto;
- confronto con risposta attesa;
- nota del docente.

Non serve esporre chain-of-thought o dettagli interni del modello AI.

## 13. Confidence

La confidence descrive l'affidabilità della **valutazione automatica**, non la qualità dello studente.

Può esistere:

- per criterio;
- per Item;
- eventualmente per Evaluation Run.

Non deve essere usata come pseudo-probabilità precisa se il sistema non è calibrato.

Per la UI bastano categorie come:

- alta;
- media;
- bassa;
- non applicabile/deterministica.

## 14. Review State

Confidence e stato di review sono concetti diversi.

Esempio:

```text
Confidence alta
ma policy della classe → review obbligatoria
```

Possibili stati:

- auto-approvato;
- proposto;
- da controllare;
- approvato docente;
- modificato docente;
- invalidato.

## 15. Review policy

La policy decide cosa può essere accettato automaticamente.

Può dipendere da:

- tipo di Item;
- strategia;
- confidence;
- materia;
- classe;
- Assessment;
- criterio;
- importanza/peso;
- eventuali anomalie.

Esempio:

```text
scelta multipla deterministica
→ auto-approva

risposta aperta, confidence alta
→ batch review

criterio argomentazione, confidence bassa
→ review obbligatoria
```

## 16. Item Evaluation

L'Item Evaluation aggrega i criteri della Response.

Contiene almeno:

- Item Version;
- Criterion Evaluations;
- punti ottenuti;
- punti massimi effettivi;
- eventuale stato annullato/non valutabile;
- review state;
- note.

Il punteggio dell'Item deve essere derivabile dai criteri e dalle regole applicate.

## 17. Raw Score

Il Raw Score dell'Attempt è l'aggregazione dei punti degli Item validi secondo la Score Policy.

Esempio:

```text
22 / 30
```

Non è ancora necessariamente il voto.

## 18. Score Policy

La Score Policy definisce come aggregare e trattare i punti.

Può includere:

- somme;
- pesi;
- bonus/penalità ammesse;
- gestione Item annullati;
- partial credit;
- sezioni obbligatorie;
- minimi per criterio;
- regole specifiche di Assessment.

Va distinta dalla conversione punteggio → voto.

## 19. Item annullato o difettoso

Se un Item viene annullato, il sistema deve supportare policy esplicite, per esempio:

- rimuovi dal denominatore;
- assegna pieno punteggio a tutti;
- sostituisci con altra regola;
- review manuale.

La scelta è del docente/policy.

L'Item e le Response restano comunque nello storico.

## 20. Normalized Score

Quando utile, il Raw Score può essere trasformato in uno score normalizzato.

Esempio:

```text
Raw:        22 / 30
Normalized: 73.3 / 100
```

La normalizzazione è distinta dal voto scolastico.

## 21. Grade Conversion Policy

La conversione score → voto è un livello separato.

Può includere:

- minimo/massimo;
- soglia di sufficienza;
- curve o mapping;
- decimali;
- step consentito;
- voti esclusi;
- arrotondamento;
- eventuali bonus/penalità;
- regole di clamp.

Esempio:

```text
73.3/100
↓ policy
7.5 proposto
```

## 22. Regole gerarchiche di voto

Le regole seguono il modello:

```text
Globale
  ↓
Materia
  ↓
Classe
  ↓
Assessment
  ↓
Studente/caso specifico quando legittimo
```

L'override più specifico modifica solo i campi definiti, non copia tutta la configurazione.

Il dettaglio generale dell'ereditarietà verrà formalizzato nel Dossier Configuration.

## 23. Grade Proposal

Il Grade Proposal è il voto calcolato dal sistema secondo gli score e le policy correnti.

Deve conservare:

- score di partenza;
- policy/versione applicata;
- valore proposto;
- eventuali warning;
- data/calcolo.

È sempre distinto dal voto finale.

## 24. Final Grade

Il Final Grade è la decisione autorevole del docente.

Può:

- coincidere con la proposta;
- essere modificato;
- essere inserito manualmente;
- essere lasciato assente.

Una modifica manuale non deve essere sovrascritta automaticamente da un successivo ricalcolo.

Se cambiano score o policy, il sistema può mostrare una nuova proposta e l'impatto, ma il Final Grade resta fino a decisione esplicita.

## 25. Manual Override

Un override può conservare, quando utile:

- valore precedente;
- nuovo valore;
- autore;
- timestamp;
- eventuale nota/motivo.

Il motivo può essere facoltativo salvo policy specifiche.

Non dobbiamo costringere il docente a giustificare ogni modifica ordinaria.

## 26. Grade Record / gradebook

Il voto finale di un Assessment non deve automaticamente coincidere con una voce pubblicata o sincronizzata nel registro.

Concettualmente:

```text
Final Grade
     ↓ opzionale
Grade Record / registro
```

Questo permette:

- pubblicazione controllata;
- sincronizzazione esterna;
- pesi/categorie di registro;
- voti manuali non derivati da Assessment.

Una gestione completa del registro può evolvere dopo; la separazione concettuale è utile fin dall'inizio.

## 27. Voti non derivati da verifica

Il sistema deve poter supportare in futuro voti inseriti manualmente o derivati da attività diverse senza inventare un Assessment fittizio.

Per i primi checkpoint basta che il modello del Grade Record non richieda obbligatoriamente un Attempt.

## 28. Regrading

Una modifica a:

- chiave;
- rubrica;
- Evaluation Spec;
- checker;
- Score Policy;
- Grade Conversion Policy;
- Item validità

può richiedere un ricalcolo.

Il sistema deve prima determinare l'impatto.

Esempio:

```text
Hai modificato il criterio 'completezza'.
Potrebbero cambiare 18 valutazioni.

[Mostra impatto]
[Ricalcola proposta]
[Annulla]
```

## 29. Regrading non distruttivo

Il ricalcolo produce una nuova Evaluation Run/proposta.

Non cancella:

- valutazione precedente;
- decisioni del docente;
- Final Grade già confermato.

Le differenze devono essere confrontabili.

## 30. Correzione iterativa del correttore

Quando il docente dice:

> Questa formulazione è valida.

il sistema può:

- aggiornare la rubrica/Evaluation Spec della prova;
- trovare Response simili;
- stimare l'impatto;
- proporre un regrading;
- applicarlo solo dopo la policy prevista.

Una singola correzione non diventa automaticamente una regola globale.

## 31. Similar Response Consistency

Il sistema deve poter cercare incoerenze come:

```text
Response A ≈ Response B
ma
Score A molto diverso da Score B
```

Questo genera un Review Item, non una correzione automatica obbligatoria.

Il confronto può essere per risposta completa o per singolo criterio.

## 32. Batch Review

La UI deve ottimizzare le eccezioni.

Esempio:

```text
24 Attempt

18 completamente approvati
4 con 1 criterio dubbio
2 con problema di scoring

[Controlla i 6]
```

Il docente deve poter approvare batch omogenei quando appropriato.

## 33. Feedback Package

Il feedback deve essere un output distinto dal grading.

Può contenere:

- commento generale;
- feedback per Item;
- feedback per criterio;
- spiegazione errori;
- suggerimenti di recupero;
- riferimenti a materiali;
- esercizi consigliati.

Il fatto che una Evaluation produca evidenze non significa che tutte debbano essere mostrate allo studente.

## 34. Feedback Policy

Il docente decide cosa generare e cosa pubblicare.

Possibili livelli:

- solo voto;
- voto + punteggio;
- feedback sintetico;
- feedback per domanda;
- correzione completa;
- suggerimenti di recupero.

La policy può essere gerarchica per materia/classe/Assessment.

## 35. Feedback draft vs published

Il feedback generato è inizialmente una bozza interna.

Distinguere:

- feedback draft;
- feedback approved;
- feedback published/released.

Questo è coerente con il principio che le azioni verso studenti non escano automaticamente senza policy/approvazione prevista.

## 36. Release dei risultati

Voto, correzione e feedback possono avere release indipendenti.

Esempio:

- pubblica voto oggi;
- pubblica soluzione domani;
- non pubblicare rubriche interne.

Il modello non deve imporre un unico pulsante 'pubblica tutto'.

## 37. Learning Evidence

La correzione può produrre evidenze didattiche separate dal voto.

Esempi:

- JOIN corretta;
- difficoltà su subquery correlate;
- errore ricorrente su GROUP BY;
- concetto applicato correttamente.

Queste evidenze possono riferirsi a:

- studente;
- classe;
- Curriculum Item;
- obiettivo;
- Assessment/Item.

## 38. Learning Evidence non è profilo psicologico

Le evidenze devono descrivere prestazioni osservabili.

Buono:

```text
3 errori recenti su subquery correlate
```

Da evitare:

```text
studente poco logico
```

La costruzione di mastery/profile avanzati appartiene al Dossier Personalization.

## 39. Evidenza individuale vs segnale di classe

Le Learning Evidence possono essere aggregate per individuare pattern di classe.

Esempio:

```text
14/22 studenti hanno perso punti
sul criterio 'subquery correlate'
```

Questo può generare una proposta di recupero, ma non modifica automaticamente il Curriculum.

## 40. Feedback e piano futuro

Il sistema può proporre:

- ripasso;
- esercizi;
- materiale mirato;
- adattamento della prossima lezione;
- recupero.

Queste sono proposte verso Curriculum/Planning/Personalization e seguono le rispettive policy di automazione.

## 41. Integrity Evidence

I segnali anti-copiatura restano separati dal grading.

Quindi:

```text
Integrity Evidence
      ≠
Criterion Evaluation
      ≠
Grade
```

Se il docente decide che un evento di integrità ha conseguenze valutative, deve essere una decisione esplicita tracciabile secondo policy.

## 42. Errori della prova

Il sistema deve poter distinguere:

- errore dello studente;
- Item difettoso;
- Evaluation Spec errata;
- errore del correttore;
- errore di import/matching.

Non correggere lo studente per compensare un errore della prova.

## 43. Missing/Unreadable responses

Una Response può essere:

- assente;
- vuota;
- illeggibile;
- corrotta;
- non interpretabile;
- incompleta.

Questi stati non devono essere automaticamente equivalenti a zero.

La policy decide quando zero è corretto e quando serve review.

## 44. Imported scores

Da sistemi esterni possono arrivare:

- Response complete;
- punteggi per Item;
- solo punteggio totale;
- solo voto.

Il modello deve conservare il livello di granularità realmente disponibile.

Non deve inventare Criterion Evaluation inesistenti.

Un dato importato può avere provenance e confidence/matching separati.

## 45. Manual grading

Il docente deve poter correggere completamente a mano una Response o un Attempt.

Il sistema può comunque:

- conservare struttura e rubriche;
- sommare punti;
- applicare conversione voto;
- produrre feedback su richiesta.

L'automazione non è obbligatoria.

## 46. Partial grading

Una stessa prova può essere corretta in modo misto:

- Item chiusi automaticamente;
- SQL via test;
- risposta aperta assistita;
- elaborato manuale.

Tutti convergono nello stesso modello di Item Evaluation/Score.

## 47. External/manual evidence

Il docente può aggiungere evidenze o note di correzione manuali senza dover modificare la Response.

Queste diventano parte della Evaluation, non della Submission.

## 48. Provenance della valutazione

Ogni risultato deve poter indicare concettualmente se deriva da:

- regola deterministica;
- checker/test;
- modello/AI;
- import esterno;
- docente;
- combinazione.

Questo serve per audit e review, non per mostrare tecnicismi nella UI ordinaria.

## 49. Versioning delle rubriche e policy

Rubric, Evaluation Spec, Score Policy e Grade Conversion Policy devono essere versionabili.

Una prova storica deve essere ricostruibile con le regole usate allora.

Modificare la configurazione globale oggi non deve cambiare silenziosamente i voti dell'anno scorso.

## 50. Dependency model

Il sistema deve conoscere almeno queste dipendenze:

```text
Evaluation Spec / Rubric
        ↓
Criterion Evaluation
        ↓
Item Score
        ↓
Attempt Score
        ↓
Grade Proposal
        ↓
Feedback / Learning Evidence
```

Un cambiamento upstream deve permettere impact analysis e ricalcolo selettivo.

## 51. Stato canonico e derived

Proposta:

- Response/Submission: input canonico;
- Evaluation Spec/Rubric approvate: regole canoniche;
- decisioni manuali del docente: canoniche;
- valutazioni automatiche: risultati derivati/versionati;
- Grade Proposal: derivato;
- Final Grade: canonico quando confermato;
- Feedback draft: derivato;
- Feedback published: stato rilasciato/versionato.

Questo rende chiaro cosa può essere rigenerato e cosa non deve essere sovrascritto.

## 52. Foundation decisions approvate

Le seguenti decisioni sono state discusse e approvate:

1. introdurre Evaluation Run come revisione/esecuzione versionata della correzione;
2. Response originale resta immutata dalle valutazioni;
3. Evaluation Strategy è distinta dalla tecnologia concreta;
4. Criterion Evaluation è l'unità minima spiegabile;
5. Evidence, score, confidence e review state sono campi/concept separati;
6. confidence riguarda l'affidabilità della valutazione automatica, non lo studente;
7. deterministico non richiede confidence fittizia;
8. Rubric è versionata e può avere strategie diverse per criterio;
9. Item Evaluation aggrega Criterion Evaluation;
10. Raw Score, Normalized Score, Grade Proposal e Final Grade sono distinti;
11. Score Policy è distinta da Grade Conversion Policy;
12. Item annullati sono gestiti da policy senza cancellare lo storico;
13. Grade Conversion Policy è gerarchica/ereditaria;
14. Final Grade è autorevole e non sovrascrivibile automaticamente;
15. Grade Record/registro è distinto dal Final Grade dell'Assessment;
16. devono poter esistere Grade Record non derivati da Assessment;
17. regrading crea una nuova Evaluation Run/proposta e non distrugge la precedente;
18. modifiche a rubriche/criteri mostrano impatto prima della propagazione;
19. consistency check su Response simili produce review, non modifica automatica;
20. Feedback Package è distinto dal grading;
21. feedback draft/approved/published sono stati distinti;
22. voto, soluzione e feedback possono essere rilasciati separatamente;
23. Learning Evidence è distinta dal voto;
24. Learning Evidence descrive prestazioni osservabili, non etichette psicologiche;
25. segnali aggregati possono proporre recuperi ma non modificare automaticamente il curriculum;
26. Integrity Evidence resta separata dal grading;
27. Response assente/illeggibile non equivale automaticamente a zero;
28. import esterno conserva solo la granularità realmente disponibile;
29. manual grading e grading misto sono first-class;
30. provenance della valutazione deve essere ricostruibile;
31. Rubric, Evaluation Spec, Score Policy e Grade Conversion Policy sono versionabili;
32. dependency graph abilita impact analysis e ricalcolo selettivo;
33. decisioni manuali e Final Grade confermato sono stato canonico;
34. Normalized Score è una primitive concettuale esplicita, ma può essere calcolata on demand e non deve essere necessariamente persistita o mostrata quando non serve.

## 53. Evolution decisions

Da rimandare:

- algoritmo preciso di confidence/calibrazione;
- UI della rubrica;
- modello tecnico dei checker;
- metodo di semantic scoring;
- algoritmo di similar-response clustering;
- formulazione automatica del feedback;
- analytics longitudinali;
- gradebook completo;
- integrazioni con registri elettronici;
- mastery model;
- policy sofisticate su retake;
- statistiche psicometriche.

## 54. Edge cases da supportare

Il modello deve reggere almeno:

1. chiave corretta cambiata dopo la correzione;
2. rubrica modificata dopo 10 correzioni su 20;
3. Item annullato;
4. Final Grade manualmente diverso dalla proposta;
5. nuova Grade Policy dopo voti già confermati;
6. risposta vuota ma problema tecnico documentato;
7. risposta illeggibile;
8. punteggio importato senza Response;
9. voto importato senza punteggio;
10. due Response simili valutate diversamente;
11. docente accetta una formulazione prima considerata errata;
12. checker SQL corretto successivamente;
13. Assessment con grading automatico + manuale misto;
14. Attempt di recupero che sostituisce o affianca il precedente;
15. voto finale non ancora pubblicato;
16. feedback pubblicato dopo il voto;
17. Assessment senza voto numerico ma con feedback;
18. manual Grade Record senza Assessment;
19. Item fuori programma scoperto dopo la prova;
20. Integrity Evidence presente ma nessuna conseguenza valutativa.

## 55. Checkpoint di dominio proposto — G1: Exceptions only

Problema:

> Il docente non deve correggere manualmente ciò che il sistema può valutare in modo affidabile, ma deve vedere immediatamente i casi incerti.

Scenario minimo:

1. vengono acquisite le Submission;
2. ogni Response viene instradata alla strategia appropriata;
3. Item deterministici vengono valutati automaticamente;
4. risposte aperte producono Criterion Evaluation con evidenze/confidence;
5. il sistema calcola Item Score e Raw Score;
6. la Review Inbox mostra solo eccezioni secondo policy;
7. il docente corregge/approva;
8. viene prodotto Grade Proposal;
9. il docente conferma o modifica Final Grade;
10. feedback essenziale viene preparato.

Nuove primitive:

- Evaluation Run;
- Rubric / Criterion;
- Criterion Evaluation;
- Evaluation Evidence;
- Item Evaluation;
- Score Policy;
- Grade Conversion Policy;
- Grade Proposal;
- Final Grade;
- Feedback Package;
- Learning Evidence.

Non-goals:

- gradebook completo;
- mastery individuale;
- analytics sofisticati;
- pubblicazione automatica esterna;
- calibrazione statistica avanzata.

## 56. Metriche utili

- percentuale Response corrette senza intervento;
- percentuale criteri inviati a review;
- tempo medio di review per Attempt;
- numero di correzioni manuali propagate a casi simili;
- tasso di modifiche del Grade Proposal;
- differenza tra proposta e Final Grade;
- incoerenze tra Response simili intercettate;
- regrading avviati e loro impatto;
- tempo totale di correzione rispetto al processo manuale;
- percentuale feedback usato/modificato dal docente.

## 57. Decisioni aperte residue

Le scelte residue riguardano soprattutto l'evoluzione tecnica:

1. algoritmo e calibrazione della confidence;
2. rappresentazione tecnica dei checker;
3. semantic scoring;
4. clustering di risposte simili;
5. generazione del feedback;
6. gradebook completo;
7. integrazioni con registri elettronici;
8. mastery/analytics longitudinali;
9. policy avanzate per retake;
10. statistiche psicometriche.

## 58. Stato del dossier

Il nucleo del Dossier 06 — Grading & Feedback è considerato **approvato e stabile per i primi checkpoint**.

Sono consolidate in particolare:
- Evaluation Run versionata;
- Response originale immutata;
- Criterion Evaluation come unità minima spiegabile;
- Evidence, score, confidence e review state separati;
- Rubric e policy versionate;
- Raw Score, Normalized Score, Grade Proposal e Final Grade distinti;
- Score Policy distinta da Grade Conversion Policy;
- Final Grade canonico e non sovrascrivibile automaticamente;
- Grade Record distinto dal Final Grade dell'Assessment;
- regrading non distruttivo con impact analysis;
- consistency review su risposte simili;
- Feedback Package distinto dal grading;
- Learning Evidence distinta dal voto;
- Integrity Evidence separata dalla valutazione;
- grading automatico, assistito, manuale e misto come modalità first-class;
- Normalized Score mantenuto come primitive concettuale ma calcolabile on demand.

Le decisioni residue non impediscono di procedere al Dossier 07 — Personalization.