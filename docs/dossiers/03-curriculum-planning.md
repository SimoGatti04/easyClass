# Dossier 03 — Curriculum & Planning

## 1. Domanda centrale

Come rappresentare programma, argomenti, obiettivi e avanzamento reale in modo abbastanza strutturato da alimentare automaticamente lezioni, verifiche e ripianificazione, senza obbligare il docente a compilare un curriculum rigido o burocratico?

Il sistema deve sapere cosa si vuole affrontare, cosa dipende da cosa, cosa è stato realmente affrontato, cosa è stato rimandato o ripreso e cosa viene dopo. Il docente deve però poter partire anche da una semplice lista di argomenti.

## 2. Principio generale

Il curriculum deve essere strutturato internamente ma progressivamente formalizzato.

Il docente non deve essere costretto subito a definire tassonomie complete, codici obiettivo, ore precise, prerequisiti per ogni elemento o livelli di competenza.

Può iniziare, per esempio, da:

```text
Database
SQL
SELECT
JOIN
Subquery
Normalizzazione
```

e il sistema può successivamente proporre struttura, sottoargomenti, prerequisiti e obiettivi. La struttura proposta resta sempre modificabile.

## 3. Vincoli già approvati

Questo dossier assume come già deciso:

- distinzione tra piano previsto e programma effettivamente svolto;
- planner centrato sugli argomenti, non sulle ore come metrica principale;
- calendario come vincolo centrale della pianificazione;
- lezioni future derivate da calendario + piano + stato reale;
- verifiche basate per default su ciò che risulta realmente affrontato;
- possibilità di spostare una verifica oppure adattarne i contenuti;
- modifiche manuali del docente sempre autorevoli;
- propagazione selettiva agli artefatti dipendenti;
- piano iniziale e piano finale effettivo esportabili.

## 4. Problemi da evitare

Non vogliamo né un piano annuale definito lezione per lezione mesi prima, né una lista tanto vaga da non poter guidare il sistema.

Evitiamo inoltre:

- percentuali di completamento artificialmente precise;
- un unico stato FATTO/NON FATTO che perda lo storico;
- un albero rigido come unico modello possibile;
- la confusione tra contenuto insegnato e contenuto realmente appreso dagli studenti.

## 5. Curriculum Item

L'unità elementare proposta è un Curriculum Item, che può rappresentare modulo, unità, argomento, sottoargomento, concetto o obiettivo didattico.

Non tutti i piani devono avere lo stesso livello di dettaglio.

Esempio:

```text
DATABASE
└─ SQL
   ├─ SELECT
   ├─ JOIN
   │  ├─ INNER JOIN
   │  └─ LEFT JOIN
   └─ SUBQUERY
```

La gerarchia serve soprattutto per comprensione, navigazione, aggregazione ed export.

## 6. Argomento e obiettivo

È utile distinguere concettualmente:

- Argomento: JOIN SQL
- Obiettivo: saper scegliere e scrivere una JOIN appropriata tra due o più tabelle.

Gli obiettivi non devono essere obbligatori nelle prime versioni. Il docente può lavorare solo con argomenti; il sistema può proporre obiettivi e il docente decide se conservarli.

## 7. Gerarchia più relazioni trasversali

La struttura proposta ha due livelli concettuali:

1. una gerarchia di organizzazione, per esempio materia → modulo → unità → argomento → sottoargomento;
2. relazioni trasversali, per esempio prerequisito, ordine suggerito, collegato a, approfondimento di.

Per il core iniziale probabilmente bastano prerequisito e ordine suggerito. Non serve costruire subito un knowledge graph sofisticato.

## 8. Ordine indicativo, non assoluto

Il docente deve poter anticipare, posticipare, saltare, riprendere, dividere, unire o inserire argomenti.

Il sistema deve ricalcolare solo le conseguenze pertinenti.

## 9. Planned Curriculum

Il piano previsto descrive l'intenzione didattica.

Ogni elemento può avere, quando utile:

- posizione nel piano;
- periodo indicativo;
- priorità;
- eventuale scadenza;
- prerequisiti;
- obiettivi;
- eventuale profondità desiderata;
- collegamento a verifiche;
- note del docente.

Le ore possono esistere come stima accessoria, non come unità fondamentale.

## 10. Priorità del contenuto

Per reagire agli imprevisti il curriculum dovrebbe poter distinguere almeno:

- obbligatorio;
- importante;
- opzionale;
- approfondimento.

Non ogni argomento deve avere una priorità esplicita: può esistere un default.

## 11. Actual Curriculum come risultato delle evidenze

Il programma svolto non deve essere una seconda lista compilata manualmente.

Deve derivare soprattutto da evidenze come lezioni svolte, conferme post-lezione, attività, recuperi e modifiche manuali.

Concettualmente:

```text
CURRICULUM ITEM
      ↓
COVERAGE / EVIDENZE NEL TEMPO
      ↓
STATO ATTUALE DERIVATO
```

## 12. Coverage

Ogni lezione può collegarsi a uno o più argomenti e uno stesso argomento può comparire in molte lezioni.

Esempio:

```text
Lezione 21 ottobre

JOIN
- INNER JOIN → svolto
- LEFT JOIN → introdotto
- multiple JOIN → non affrontato
```

Questo consente di riprendere un argomento senza duplicarne l'identità.

## 13. Stati di avanzamento

Per il core iniziale eviterei percentuali.

Due alternative da discutere:

- scala semplice: non svolto / parziale / svolto;
- scala leggermente più ricca: non iniziato / introdotto / in corso / svolto / da riprendere.

Lo storico delle evidenze resta comunque separato dallo stato sintetico corrente.

## 14. Ripresa e consolidamento

Lo stesso argomento può essere introdotto, esercitato, ripassato e riutilizzato mesi dopo. Questi sono eventi diversi collegati allo stesso Curriculum Item, non quattro copie dell'argomento.

## 15. Svolto non significa appreso

Il Curriculum dossier descrive soprattutto cosa è stato insegnato o affrontato dalla classe.

Lo stato individuale di apprendimento appartiene principalmente ad Assessment, Grading e Personalization.

Possiamo usare le evidenze di apprendimento per suggerire un recupero, ma non confondere i due concetti.

## 16. Curriculum, calendario e planner

I tre concetti devono restare separati:

```text
CURRICULUM
cosa / ordine / dipendenze

CALENDARIO
quando esistono occasioni reali di lezione

PLANNER
come i contenuti vengono proiettati sulle occasioni
```

Una festività cambia la proiezione, non il curriculum.

## 17. Planning Projection

Serve un livello concettuale tra piano annuale e singola lezione: la proiezione corrente di come il programma potrà distribuirsi sulle prossime lezioni.

Esempio:

```text
Lun 12 — JOIN completamento
Mer 14 — JOIN esercizi
Ven 16 — Subquery introduzione
```

Questa proiezione può cambiare continuamente senza alterare il piano annuale originario.

## 18. Tre livelli distinti

```text
PLANNED CURRICULUM
Cosa si intende insegnare
        ↓
PLANNING PROJECTION
Come oggi prevediamo di distribuirlo
        ↓
ACTUAL COVERAGE
Cosa è successo davvero
```

Questa distinzione è una delle foundation principali proposte.

## 19. Ripianificazione

La ripianificazione modifica soprattutto la Planning Projection.

Cause possibili:

- lezione saltata;
- argomento incompleto;
- approfondimento;
- recupero;
- cambio verifica;
- modifica del calendario;
- modifica manuale;
- nuovo vincolo.

Una differenza importante:

- ripianificazione operativa: Routing parte una settimana dopo;
- revisione del piano: quest'anno non svolgerò IPv6 avanzato.

Solo la seconda modifica davvero il Planned Curriculum.

## 20. Versionamento del piano

Il piano iniziale deve restare ricostruibile.

Il sistema deve sapere cosa è cambiato, quando e, se disponibile, perché.

Non serve mostrare un sistema di version control tecnico al docente.

## 21. Import del curriculum

Il piano può nascere da documento del docente, programma dell'anno precedente, PDF, indice di libro, documento di dipartimento, testo incollato, file strutturato, generazione assistita o inserimento manuale.

L'import deve produrre una bozza di struttura, non una verità definitiva.

Il docente può anche iniziare solo dal prossimo argomento e formalizzare il resto successivamente, coerentemente con l'onboarding progressivo già approvato.

## 22. Identità degli argomenti e duplicati

Dobbiamo evitare sia di fondere automaticamente ogni voce con lo stesso nome, sia di creare una nuova entità per ogni apparizione.

Proposta:

- nello stesso contesto classe + materia il sistema prova a riusare lo stesso Curriculum Item;
- propone merge quando gli elementi sono chiaramente equivalenti;
- non fonde automaticamente casi ambigui;
- può conservare alias e sinonimi.

Una tassonomia globale condivisa può arrivare più avanti solo se porta valore reale.

## 23. Template e piani di classe

È utile distinguere:

- Curriculum Template: programma riutilizzabile;
- Class Curriculum Plan: istanza per una specifica classe + materia + anno.

Esempio:

```text
Template: Informatica quarta — base
            ↓
4A 2026/27
4B 2026/27
```

Le istanze possono poi divergere indipendentemente. Una modifica nella 4A non deve alterare automaticamente la 4B.

## 24. Collegamento alle lezioni

Una Lesson può coprire più Curriculum Item, coprire solo parte di un item, riprendere item già svolti o introdurre contenuti non previsti.

Se emerge un nuovo argomento durante la lezione, il sistema può proporre:

```text
Hai affrontato Window Functions, che non erano nel piano.

[Aggiungi al programma svolto]
[Aggiungi anche al piano]
[Tratta come nota occasionale]
```

Non deve riscrivere automaticamente il piano annuale.

## 25. Collegamento alle verifiche

Una verifica deve dichiarare internamente quali argomenti o obiettivi valuta.

Prima della prova il sistema confronta target della verifica e Actual Coverage.

Se manca qualcosa può proporre di spostare la verifica, adattarne il blueprint, avvisare o lasciare invariato su decisione docente.

## 26. Collegamento ai materiali

I Curriculum Item possono essere collegati a fonti, Teacher Script, Student Material, esercizi, verifiche e attività.

La relazione deve essere molti-a-molti e non creare ownership rigida del materiale.

## 27. Prerequisiti e vincoli

I prerequisiti devono essere utilizzabili ma leggeri.

Distinguere tra:

- vincolo forte: questo contenuto non ha senso prima di X;
- preferenza: normalmente conviene fare X prima di Y.

La maggior parte delle relazioni didattiche dovrebbe inizialmente essere suggerimento, non blocco. Il docente resta autorevole.

## 28. Profondità

Lo stesso argomento può essere affrontato a profondità diversa.

Una possibile scala futura è introduzione / standard / approfondimento, ma non la renderei obbligatoria nel core iniziale.

Questa resta una decisione aperta.

## 29. Stati particolari

Il modello deve distinguere almeno concettualmente:

- svolto ma non ancora verificato;
- previsto ma rimandato;
- rimosso/escluso dal piano corrente;
- aggiunto durante l'anno;
- affrontato solo parzialmente;
- da riprendere.

Un contenuto rimosso non deve continuare a generare alert come se fosse semplicemente in ritardo.

## 30. Piano finale effettivo

A fine anno il sistema deve poter ricostruire automaticamente il programma effettivamente svolto dalle evidenze consolidate.

Esempio:

```text
PROGRAMMA EFFETTIVAMENTE SVOLTO

Database
✓ modello ER
✓ normalizzazione
✓ SQL
  ✓ SELECT
  ✓ JOIN
  ✓ subquery
+ Window Functions — aggiunte durante l'anno

NON SVOLTO
- IPv6 avanzato
```

Devono poter essere esportati piano iniziale, piano corrente e piano finale svolto.

## 31. Query naturali supportabili

In futuro il sistema deve poter rispondere a domande come:

- Cosa manca prima della verifica SQL?
- Quali argomenti avevo previsto ma non ho ancora affrontato?
- Quando abbiamo fatto JOIN?
- Cosa ho aggiunto rispetto al programma iniziale?
- Quali lezioni hanno coperto normalizzazione?

Le risposte devono derivare dai dati strutturati e dalle evidenze, non solo da ricerca testuale.

## 32. Modifica manuale e stato canonico

Il docente può sempre correggere struttura, ordine, priorità, stato, collegamenti, prerequisiti, piano e coverage.

Una correzione manuale diventa il nuovo stato canonico. Gli elementi derivati vengono aggiornati secondo il dependency model già approvato.

## 33. Cosa non decidiamo qui

Non decidiamo ancora:

- algoritmo di ripianificazione;
- modello AI che estrae argomenti;
- embeddings;
- database graph vs relational;
- formato tecnico delle versioni;
- provider calendario;
- meccanismo di automazione;
- UI definitiva del planner.

Queste scelte vengono dopo.

## 34. Foundation decisions approvate

Le seguenti decisioni sono state discusse e approvate:

1. il curriculum ha come unità fondamentale un Curriculum Item;
2. la gerarchia serve per organizzare ma non è l'unica relazione;
3. argomenti e obiettivi sono concetti distinti;
4. gli obiettivi sono opzionali nelle prime versioni;
5. prerequisiti e ordine suggerito sono relazioni esplicite ma leggere;
6. calendario e curriculum restano separati;
7. esiste una Planning Projection distinta dal piano annuale;
8. Planned Curriculum, Planning Projection e Actual Coverage sono tre concetti separati;
9. il programma svolto deriva da evidenze collegate alle lezioni, non da una seconda lista manuale;
10. uno stesso argomento può avere più eventi di coverage;
11. svolto non significa appreso;
12. il piano di classe è distinto dai template riutilizzabili;
13. istanze di classi diverse possono divergere indipendentemente;
14. modifiche operative al calendario non riscrivono il piano annuale;
15. revisioni vere del piano sono versionate;
16. verifiche e lezioni si collegano ai Curriculum Item;
17. contenuti aggiunti durante l'anno possono entrare nel piano finale senza essere retroattivamente presenti nel piano iniziale;
18. contenuti rimossi smettono di apparire come semplicemente in ritardo;
19. niente percentuali di completamento senza una base informativa reale;
20. il docente resta autorevole su struttura, stato e relazioni;
21. nei primi checkpoint lo stato sintetico di coverage parte da non svolto / parziale / svolto;
22. eventuali concetti come "da riprendere" appartengono alla pianificazione futura o alle evidenze, non devono necessariamente diventare uno stato base del coverage;
23. gli obiettivi didattici restano opzionali nelle prime versioni e possono essere proposti automaticamente;
24. la profondità non è un campo obbligatorio del core iniziale;
25. la Planning Projection è un concetto interno modificabile indirettamente tramite planner/calendario, non un oggetto tecnico da esporre al docente;
26. un argomento extra confermato come realmente svolto entra nel programma finale effettivo;
27. l'aggiunta dello stesso argomento extra al piano previsto corrente resta una decisione separata del docente;
28. i primi checkpoint devono privilegiare semplicità operativa pur mantenendo queste primitive stabili.

## 35. Evolution decisions

Da rimandare:

- scala esatta degli stati di coverage;
- livelli di profondità;
- numero e tipo di relazioni curricolari;
- eventuale tassonomia globale condivisa;
- algoritmo di merge dei topic;
- generazione automatica degli obiettivi;
- livello di formalizzazione dei prerequisiti;
- sofisticazione del planner;
- visualizzazione finale del curriculum.

## 36. Edge cases da supportare

Il modello deve reggere almeno:

1. argomento svolto in più lezioni;
2. lezione che tratta più argomenti;
3. argomento affrontato fuori ordine;
4. argomento non previsto ma svolto;
5. argomento previsto ma eliminato;
6. argomento rimandato al periodo successivo;
7. recupero di un prerequisito;
8. due classi partono dallo stesso piano e divergono;
9. verifica pianificata prima che tutti i contenuti siano coperti;
10. programma importato con duplicati;
11. topic rinominato durante l'anno;
12. modulo diviso o unito;
13. classe cambia ritmo senza modificare gli obiettivi annuali;
14. piano iniziale incompleto e costruito progressivamente.

## 37. Implicazioni sugli altri dossier

- Knowledge & Materials: collega materiali e fonti ai Curriculum Item senza ownership rigida.
- Assessment: blueprint e domande possono riferirsi a topic e obiettivi.
- Grading: le evidenze di valutazione restano separate dall'Actual Coverage.
- Personalization: lo stato individuale può riferirsi agli stessi obiettivi ma resta distinto dallo stato della classe.
- Automation: definirà quando aggiornare la Planning Projection e quando chiedere review.
- Configuration: priorità, profondità e policy di ripianificazione potranno essere contestuali.
- AI Architecture: sceglierà come estrarre, classificare e mettere in relazione i topic.
- Governance: definirà provenance e audit.
- Platform Architecture: tradurrà questi concetti in persistenza e contratti.

## 38. Checkpoint di dominio proposto — C1: The course knows where it is

Problema:

> Il sistema non può preparare bene la prossima lezione se non sa cosa era previsto e cosa è stato realmente svolto.

Scenario minimo:

1. il docente crea o importa una piccola sequenza di argomenti;
2. una lezione viene collegata a uno o più argomenti;
3. dopo la lezione il docente conferma svolto/parziale/non svolto;
4. il sistema aggiorna l'Actual Coverage;
5. propone il prossimo argomento;
6. una modifica non altera retroattivamente il piano iniziale.

Nuove primitive:

- Curriculum Item;
- Curriculum Plan;
- Plan Revision;
- Coverage;
- Planning Projection;
- relazione topic ↔ lesson.

Non-goals:

- knowledge graph completo;
- mastery individuale;
- ottimizzazione avanzata;
- standard curricolari globali.

## 39. Metriche utili

- tempo necessario per impostare o importare un piano;
- numero di correzioni manuali alla struttura proposta;
- percentuale di lezioni correttamente collegate agli argomenti;
- tempo post-lezione necessario per aggiornare lo svolto;
- frequenza con cui il prossimo argomento proposto è corretto;
- numero di falsi alert di ritardo;
- percentuale di verifiche coerenti con Actual Coverage.

## 40. Decisioni aperte residue

Le principali scelte ancora da rifinire riguardano soprattutto l'evoluzione, non il core iniziale:

1. eventuale scala più ricca di coverage oltre a non svolto / parziale / svolto;
2. eventuale modello di profondità quando emergerà un caso d'uso concreto;
3. numero e tipo di relazioni curricolari oltre a prerequisito e ordine suggerito;
4. eventuale tassonomia globale condivisa tra classi, materie o docenti;
5. algoritmo di merge/alias degli argomenti importati;
6. sofisticazione futura della ripianificazione e della previsione.

## 41. Stato del dossier

Il nucleo del Dossier 03 — Curriculum & Planning è considerato **approvato e stabile per i primi checkpoint**.

In particolare sono consolidate:
- distinzione Planned Curriculum / Planning Projection / Actual Coverage;
- Curriculum Item come unità fondamentale;
- gerarchia non esclusiva;
- relazioni leggere di prerequisito/ordine;
- coverage derivato dalle lezioni;
- separazione tra svolto e appreso;
- template distinti dai piani di classe;
- versionamento delle revisioni reali del piano;
- collegamento a lezioni, verifiche e materiali;
- stato iniziale semplice non svolto / parziale / svolto.

Le decisioni residue riguardano estensioni future e non impediscono di procedere al dossier successivo.