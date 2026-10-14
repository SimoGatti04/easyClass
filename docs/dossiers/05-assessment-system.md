# Dossier 05 — Assessment System

## 1. Domanda centrale

Come rappresentare una verifica in modo indipendente da generazione, variante, canale di svolgimento e correzione, così che la stessa prova possa essere progettata una volta, distribuita in forme diverse e produrre risultati sempre riconducibili allo stesso oggetto didattico?

Il sistema deve supportare senza rifondazioni:

- verifiche cartacee;
- verifiche digitali interne;
- Forms/Teams/Classroom o altre piattaforme;
- più varianti, anche una per studente;
- prove con domande riutilizzate o generate;
- import di risposte e risultati esterni;
- prove annullate, corrette, riaperte o recuperate;
- future estensioni senza legare il dominio a un singolo formato.

## 2. Vincoli già approvati

Questo dossier assume come già deciso:

- blueprint prima delle domande;
- verifica basata per default sull'Actual Coverage;
- struttura e domande sempre modificabili dal docente;
- varianti fino a una per studente;
- equivalenza tra varianti per obiettivi, difficoltà, durata, punti e copertura;
- canale di svolgimento separato dalla verifica;
- export/import quando tecnicamente possibile;
- fallback manuali/semi-automatici;
- sessione digitale robusta con autosave;
- segnali di integrità come evidenze da verificare, mai come sanzioni automatiche;
- seat map legata alla singola sessione/evento di verifica;
- correzione e grading separabili per strategia e tipo di risposta;
- strumenti deterministici preferiti quando appropriati.

## 3. Principio fondamentale

La verifica non deve essere modellata come un file né come un form.

Il modello proposto è:

```text
ASSESSMENT
   ↓
BLUEPRINT
   ↓
ASSESSMENT ITEMS
   ↓
FORM / VARIANT
   ↓
DELIVERY / TEST EVENT
   ↓
ATTEMPT / SUBMISSION
   ↓
RESPONSES
```

Correzione, punteggio, voto e feedback si innestano dopo e verranno formalizzati soprattutto nel Dossier 06.

## 4. Assessment — identità della prova

`Assessment` rappresenta la verifica come oggetto didattico stabile.

Esempio:

```text
Verifica SQL · 4B · novembre
```

Contiene il significato della prova:

- classe/materia;
- scopo;
- Curriculum Item/obiettivi valutati;
- periodo;
- eventuale data prevista;
- stato;
- preferenze e istruzioni specifiche;
- relazione con il blueprint;
- versioni/storico.

Non contiene necessariamente una sola sequenza immutabile di domande.

## 5. Blueprint — contratto della prova

Il Blueprint descrive **cosa deve essere la verifica**, prima di decidere le tracce concrete.

Può definire:

- durata attesa;
- punteggio totale;
- Curriculum Item/obiettivi coperti;
- pesi o quote di copertura;
- tipologie di item;
- difficoltà desiderata;
- numero indicativo/esatto di item;
- vincoli obbligatori;
- criteri di equivalenza delle varianti;
- materiali consentiti;
- eventuali capacità/prerequisiti rilevanti.

Esempio:

```text
SQL · 60 minuti · 30 punti

JOIN        35%
GROUP BY    25%
SELECT      20%
SUBQUERY    20%

4 domande brevi
3 esercizi SQL
1 esercizio applicativo
```

Il Blueprint è modificabile e versionato.

## 6. Blueprint non significa solo percentuali

La copertura può essere espressa anche con vincoli discreti.

Esempio:

```text
- almeno 1 esercizio JOIN
- massimo 1 domanda puramente teorica
- almeno 10 punti su query eseguibili
- nessun contenuto non ancora svolto
```

Questo evita di forzare percentuali quando non sono il modo naturale di descrivere la prova.

## 7. Assessment Item

L'unità base della prova è l'`Assessment Item`.

Può essere:

- domanda;
- esercizio;
- problema;
- traccia;
- task pratico;
- upload/elaborato;
- blocco di domande;
- attività eseguibile.

Un Item deve poter conoscere almeno:

- testo/consegna;
- tipo;
- Curriculum Item/obiettivo collegato;
- difficoltà stimata/desiderata;
- punti massimi;
- risposta/risultato atteso quando esiste;
- criteri o Evaluation Spec quando utile;
- fonti/source set;
- eventuali vincoli;
- versioni.

## 8. Item indipendente dalla prova

Un Assessment Item può essere riutilizzabile in più prove.

Esempio:

```text
Item: query JOIN tra Cliente e Ordine
      ↓
Verifica 4A novembre
Verifica 4B dicembre
Esercitazione di recupero
```

Il riuso non deve però far sì che modificare oggi l'Item alteri retroattivamente una prova già svolta.

## 9. Item Version e snapshot

Quando una prova utilizza un Item deve essere ricostruibile la **versione esatta** usata.

Quindi:

- Item logico riutilizzabile;
- versioni immutabili o ricostruibili;
- Assessment/Form collega la versione precisa.

Una modifica successiva genera una nuova Item Version.

Questo segue lo stesso principio Resource/Artifact Version del dossier Knowledge & Materials.

## 10. Item Group

Alcune domande condividono un contesto comune.

Esempio:

```text
Schema database allegato
 ├─ Q1 SELECT
 ├─ Q2 JOIN
 └─ Q3 GROUP BY
```

Serve quindi supportare concettualmente gruppi/sezioni con:

- testo comune;
- allegati/dataset comuni;
- regole comuni;
- ordine interno.

Non è necessario renderlo complesso nel primo checkpoint.

## 11. Question type come capability estendibile

Il tipo di domanda non deve essere un enum rigido destinato a esplodere.

Il core può partire con tipi essenziali:

- scelta singola;
- scelta multipla;
- vero/falso;
- numerica;
- testo breve;
- testo lungo;
- riordinamento;
- matching;
- codice/SQL;
- upload file.

Ma il modello deve poter aggiungere nuovi tipi attraverso capability/handler specifici senza cambiare l'identità generale dell'Item.

## 12. Evaluation Spec come ponte verso Grading

L'Assessment deve poter dichiarare **come ci si aspetta che una risposta possa essere valutata**, ma il calcolo effettivo appartiene al Grading.

Esempi di Evaluation Spec:

- chiave esatta;
- set di risposte ammesse;
- tolleranza numerica;
- test eseguibili;
- risultato atteso;
- rubrica per criteri;
- review manuale obbligatoria.

Questo consente di separare:

```text
COSA CHIEDIAMO
Assessment

COME VALUTIAMO
Evaluation Spec / Grading
```

## 13. Form / Variant

Una `Assessment Form` è la forma concreta della prova consegnabile.

Può coincidere con la verifica base oppure essere una variante.

Esempio:

```text
Assessment SQL
├─ Form A
├─ Form B
├─ Form C
└─ Form Rossi
```

La Form stabilisce:

- Item/versioni inclusi;
- ordine;
- dati parametrizzati;
- eventuali tracce equivalenti;
- punteggi;
- rappresentazione pronta per il canale.

## 14. Variante non è versione

Distinzione fondamentale:

- **Versione**: evoluzione nel tempo dello stesso oggetto;
- **Variante/Form**: forma alternativa contemporaneamente valida della stessa prova.

Esempio:

```text
Assessment SQL v3
   ├─ Form A
   └─ Form B
```

Se correggo un errore della prova creo una nuova versione/revisione; se creo una traccia equivalente creo una Form diversa.

## 15. Equivalence Contract

Le Form della stessa verifica devono poter essere controllate rispetto a un contratto di equivalenza.

Dimensioni principali:

- obiettivi;
- copertura;
- punteggio;
- difficoltà;
- durata stimata;
- tipologia/complessità dei task.

L'equivalenza non significa identità.

Il sistema deve poter segnalare scostamenti senza pretendere una precisione falsa.

## 16. Diversification Policy

La generazione delle varianti deve essere controllata da una policy esplicita.

Dimensioni possibili:

- ordine;
- dati/numeri;
- nomi/contesti;
- stessa abilità con traccia diversa;
- Item alternativi sullo stesso obiettivo;
- diversa composizione ma stesso blueprint.

Il docente può anche bloccare Item comuni a tutte le Form.

## 17. Assignment studente → Form

L'associazione studente-variante deve essere una relazione esplicita e ricostruibile.

Può essere:

- manuale;
- casuale;
- automatica;
- basata sulla seat map;
- generata una per studente.

Lo studente non deve conoscere la logica di assegnazione.

Una volta iniziata la prova, la Form assegnata non cambia silenziosamente.

## 18. Assessment revision lifecycle

Finché la prova è in preparazione può essere modificata liberamente.

Quando una Form viene effettivamente distribuita o iniziata da uno studente, la versione utilizzata deve diventare **frozen/ricostruibile**.

Se il docente modifica successivamente la prova:

- crea una nuova revisione;
- non altera retroattivamente i tentativi già iniziati/consegnati;
- il sistema mostra quali Form/eventi sono ancora sulla revisione precedente.

## 19. Stati della verifica

Stati concettuali possibili:

- pianificata;
- in preparazione;
- pronta;
- disponibile/pubblicata;
- in svolgimento;
- conclusa;
- in correzione;
- corretta;
- archiviata;
- annullata.

La UI può mostrarne solo un sottoinsieme semplice.

Gli stati non devono sostituire versioni/eventi: una verifica può avere più eventi o tentativi pur restando lo stesso Assessment.

## 20. Delivery Channel

Il canale è un adapter della prova, non parte della sua identità.

Canali:

- cartaceo;
- digitale interno;
- PDF/file;
- Google Forms/Classroom;
- Microsoft Forms/Teams;
- piattaforma esterna;
- modalità ibrida.

Il modello resta:

```text
ASSESSMENT / FORM
       ↓
DELIVERY ADAPTER
       ↓
rappresentazione/canale specifico
```

## 21. Delivery Artifact

Una Form può produrre più rappresentazioni per il delivery:

- PDF studente;
- PDF docente;
- pagina digitale;
- payload per integrazione;
- file stampabile;
- QR/link;
- soluzione separata.

Queste sono rappresentazioni/Artifact derivati, non nuove verifiche concettuali.

## 22. Assessment Event

Serve distinguere la prova dal momento concreto in cui viene svolta.

`Assessment Event` rappresenta una sessione/evento reale, per esempio:

```text
Verifica SQL 4B
25 novembre 10:00–11:00
Aula 12
```

Può contenere:

- data/ora effettiva;
- classe/gruppo;
- canale;
- Form disponibili;
- regole temporali;
- seat map;
- note/eventi;
- stato dell'erogazione.

La stessa Assessment può avere più Event, per esempio recupero o seconda giornata.

## 23. Planned date vs actual event

La data prevista nel calendario e l'evento realmente svolto devono essere distinti.

Esempio:

```text
Pianificata: 20 novembre
Svolta:      25 novembre
```

Lo spostamento della prova non deve creare una nuova Assessment.

## 24. Attempt

`Attempt` rappresenta il tentativo di uno studente rispetto a un Assessment Event/Form.

Contiene almeno:

- studente;
- Assessment;
- Event;
- Form;
- stato;
- inizio/fine quando rilevante;
- canale;
- eventuali metadata tecnici;
- collegamento alla Submission.

Per una prova cartacea l'Attempt può essere creato/importato anche dopo lo svolgimento.

## 25. Attempt e retake

Uno studente può avere più Attempt per la stessa Assessment in casi giustificati:

- recupero assenza;
- prova riaperta;
- seconda opportunità;
- tentativo invalidato;
- errore tecnico.

Quindi non imporre globalmente `1 studente = 1 tentativo`.

La policy che decide quale Attempt conta ai fini valutativi appartiene soprattutto a Grading/Configuration.

## 26. Digital Session

Per il canale interno digitale, l'Attempt ha una sessione tecnica che gestisce:

- autosave;
- ripristino;
- timer quando previsto;
- upload;
- stato in corso/consegnato.

La Digital Session serve alla robustezza tecnica della prova, **non al monitoraggio del comportamento dello studente**.

Le verifiche sono considerate svolte in presenza; non sono previsti focus/tab tracking, mouse/keyboard monitoring, webcam o proctoring.

La sessione tecnica non deve diventare il modello universale delle prove: una prova cartacea non ha bisogno di simulare una sessione browser.

## 27. Response

Ogni risposta deve essere collegata a:

- Attempt;
- Item Version concreta;
- eventuale Item Group;
- payload della risposta;
- allegati;
- timestamp/eventi quando necessari.

Il payload deve poter variare in base al tipo di Item.

Il sistema deve preservare il dato originale della risposta prima della correzione.

## 28. Submission

La `Submission` è la consegna consolidata dell'Attempt.

Può includere:

- insieme di Response;
- allegati;
- data/ora;
- provenienza/import;
- stato di completezza;
- eventuale ricevuta.

Dopo la consegna, la Submission è immutabile lato studente salvo riapertura esplicita.

Le correzioni successive non devono modificare la risposta originale.

## 29. Import da canali esterni

L'import deve ricostruire il più possibile:

```text
STUDENTE
↓
ASSESSMENT
↓
EVENT
↓
FORM
↓
ATTEMPT
↓
RESPONSES / SUBMISSION
```

Se alcuni dati non sono noti, il sistema può creare uno stato di matching incompleto e inviarlo a `Da controllare`.

Non deve inventare associazioni quando l'ambiguità è significativa.

## 30. External identifiers

Oggetti esportati verso piattaforme esterne devono conservare mapping tra identificativi interni ed esterni.

Esempio:

```text
Assessment interno A123
↔ Google Form gf_987
↔ Teams assignment ta_442
```

Così l'import successivo torna allo stesso oggetto invece di creare duplicati.

## 31. Paper workflow

Il cartaceo deve essere first-class.

Possibile flusso:

```text
Assessment/Form
↓
PDF/print
↓
Assessment Event
↓
prova svolta
↓
acquisizione risposte/punteggi/scansioni
↓
Attempt/Submission
```

QR o identificatori per studente/variante possono aiutare, ma non devono essere l'unica strada.

## 32. Hybrid workflow

Una stessa Assessment Event può avere elementi misti, per esempio:

- consegna cartacea + upload file;
- esercizio su PC + risposta finale su carta;
- teoria digitale + laboratorio pratico.

Il modello non deve costringere a creare verifiche scollegate per ciascun mezzo.

## 33. Source Set della verifica

Assessment, Blueprint e Item generati devono conservare le fonti effettivamente usate, secondo il Dossier 04. Per la **valutabilità**, però, non basta il Source Set tecnico: vale solo l'**Assessable Source Set**, costruito da versioni Student Material pubblicate e da Support Material esplicitamente autorizzati e resi disponibili agli studenti.

Questo serve per:

- verificare che gli Item non richiedano contenuti assenti dal materiale effettivamente distribuito;
- aggiornare una bozza quando cambiano le fonti, senza modificare retroattivamente prove già distribuite;
- spiegare da quale passaggio e da quale versione valutabile deriva ogni Item;
- riusare/adattare Item storici soltanto previa verifica della loro valutabilità per la nuova classe/occasione.

Un Teacher Material, una soluzione riservata o una fonte web consultata non diventano valutabili per il solo fatto di essere nel Source Set di generazione.

## 34. Curriculum coverage

Blueprint e Item devono poter riferirsi ai Curriculum Item.

Il sistema può confrontare:

```text
ASSESSMENT TARGET
vs
ACTUAL COVERAGE
```

Se ci sono contenuti non coperti:

- avvisa;
- propone adattamento;
- propone spostamento;
- consente override esplicito.

Il docente resta autorevole.

## 35. Item bank e riuso

Un archivio logico di Item riutilizzabili può emergere naturalmente dal sistema.

Non serve necessariamente una UI separata 'Banca domande' nei primi checkpoint.

Il sistema deve però poter cercare:

- Item già usati;
- Item simili;
- Item mai usati con quella classe;
- varianti storiche;
- esercizi/materiali convertibili in Item.

## 36. Exposure history

Per evitare riuso involontario, il sistema dovrebbe poter sapere se uno studente/classe ha già visto un Item o una sua variante strettamente equivalente.

Non serve bloccare automaticamente il riuso.

Serve come segnale nel ranking/generazione.

## 37. Validation pipeline

Prima di marcare una Form come pronta il sistema deve poter controllare:

- coerenza col Blueprint;
- Curriculum coverage;
- somma punti;
- Item mancanti;
- duplicati/eccessiva similarità;
- soluzioni/Evaluation Spec disponibili quando richiesti;
- ambiguità evidenti;
- durata plausibile;
- difficoltà coerente;
- contenuti esclusi;
- copertura e provenance Item → concetto/obiettivo → passaggio Assessable Material → versione → disponibilità agli studenti, con blocco di Item non grounded;
- equivalenza tra Form;
- integrità di allegati/dataset.

Il risultato può essere:

- ok;
- warning;
- blocking issue secondo policy.

## 38. Difficulty come stima, non verità

La difficoltà di un Item o Form non è una proprietà oggettiva perfettamente misurabile.

Può derivare da:

- giudizio del docente;
- storico;
- struttura dell'Item;
- risultati precedenti;
- stima automatica.

Il sistema deve trattarla come stima contestuale e non mostrare precisione fittizia.

## 39. Duration come stima

Anche la durata è una stima.

Può essere migliorata nel tempo usando dati reali di svolgimento, ma non deve diventare un vincolo rigido se il docente decide diversamente.

## 40. Errori scoperti dopo la distribuzione

Se emerge un problema dopo che alcuni Attempt sono iniziati:

- non modificare silenziosamente l'Item già consegnato;
- creare una revisione/correzione;
- registrare l'impatto;
- applicare eventuali annullamenti o ricalcoli nel layer di grading;
- mantenere ricostruibile cosa ha visto ogni studente.

Questo è fondamentale per correttezza e audit.

## 41. Invalidazione di un Item

Il docente può dichiarare un Item:

- annullato;
- non valutabile;
- ambiguo;
- fuori programma;
- soluzione errata.

L'Item resta nella Submission originale ma viene marcato per il grading.

Non si cancella dalla storia.

## 42. Integrity Evidence

L'Integrity Evidence serve esclusivamente a rappresentare **evidenze di possibile copiatura**, separate dalla valutazione.

Può riferirsi a:

- Attempt;
- coppia/gruppo di Attempt;
- Response;
- Form/Variant;
- Seat Map come semplice contesto;
- confronto con fonti o soluzioni esterne.

Esempi:

- risposta quasi identica tra due studenti;
- stesso errore raro;
- stessa sequenza insolita di passaggi;
- contenuto incompatibile con la variante assegnata;
- porzione fortemente sovrapponibile a una fonte esterna.

Non comprende monitoraggio comportamentale, proctoring, webcam, focus/tab tracking, mouse/keyboard tracking o emotion recognition.

Contiene:

- tipo di evidenza;
- confronto/evidenza concreta;
- contesto strettamente utile;
- stato review;
- decisione del docente se presente.

Non contiene automaticamente colpa o sanzione.

## 43. Seat Map

La seat map appartiene all'Assessment Event.

Collega:

- posto;
- studente;
- Form assegnata;
- eventuali note/eventi.

Può influenzare la distribuzione delle varianti, ma non diventa una proprietà permanente dello studente.

## 44. Accommodations e adattamenti

Il modello deve poter supportare in futuro adattamenti legittimi per singoli studenti senza confonderli con 'facilitazioni' arbitrarie.

Esempi:

- tempo diverso;
- formato accessibile;
- istruzioni specifiche;
- strumenti consentiti;
- Form dedicata.

Nel core iniziale basta non impedire questa possibilità; le policy dettagliate appartengono a Personalization/Governance.

## 45. Scheduling e Assessment

L'Assessment può avere una data prevista, ma il calendario è esterno al suo core.

Il Planner collega:

```text
Assessment
↔ Calendar Event
↔ Actual Coverage
```

Lo spostamento di calendario non cambia l'identità della prova.

## 46. Pubblicazione e disponibilità

Per il digitale interno distinguere:

- prova pronta;
- prova disponibile agli studenti;
- finestra di accesso;
- Attempt iniziato;
- Submission consegnata.

Essere 'pronta' non significa automaticamente 'pubblicata'.

Questa distinzione è coerente col principio di controllo esplicito delle azioni esterne.

## 47. Assessment e Artifact

Nel modello Knowledge & Materials, documenti di prova, soluzioni e rubriche possono essere Artifact derivati.

L'Assessment invece è un'entità di dominio che orchestra tali Artifact.

Quindi:

```text
ASSESSMENT
entità didattica
       ↓
Artifact di rappresentazione
PDF / pagina / soluzione / rubric document
```

Questo evita di confondere la verifica con il suo PDF.

## 48. Confine con Grading

Questo dossier termina concettualmente a:

```text
Response / Submission
+ Evaluation Spec
+ eventuali Integrity Evidence
```

Il Dossier 06 definirà:

- scoring;
- rubric execution;
- confidence;
- review;
- raw/normalized score;
- grade proposal;
- final grade;
- feedback;
- consistency checks;
- propagazione delle correzioni del docente.

## 49. Foundation decisions approvate

Le seguenti decisioni sono state discusse e approvate:

1. Assessment è l'identità didattica della prova e non coincide con file/form/canale;
2. Blueprint è un oggetto versionato e modificabile separato dagli Item;
3. Assessment Item è riutilizzabile e versionato;
4. una prova collega versioni precise degli Item;
5. Item Group supporta contesti condivisi senza duplicazione;
6. question type è estendibile tramite capability/handler;
7. Evaluation Spec fa da ponte verso Grading;
8. Form/Variant rappresenta la forma concreta consegnabile;
9. variante e versione sono concetti distinti;
10. le Form rispettano un Equivalence Contract;
11. Diversification Policy controlla come creare varianti;
12. assegnazione studente→Form è esplicita e ricostruibile;
13. una revisione usata in un Attempt deve restare frozen/ricostruibile;
14. Delivery Channel è separato dall'Assessment;
15. rappresentazioni di delivery sono Artifact, non nuove verifiche;
16. Assessment Event rappresenta il momento reale di svolgimento;
17. data prevista e data/evento effettivo sono distinte;
18. Attempt rappresenta il tentativo di un singolo studente;
19. possono esistere più Attempt per studente quando la policy lo consente;
20. Digital Session è specifica del canale digitale e non il modello universale;
21. Response conserva il dato originale indipendentemente dalla correzione;
22. Submission è la consegna consolidata e immutabile lato studente salvo riapertura;
23. import/export mantengono mapping con identificativi esterni;
24. paper e hybrid sono first-class;
25. Blueprint/Item si collegano ai Curriculum Item e source set;
26. validazione della Form precede lo stato pronta;
27. difficoltà e durata sono stime contestuali, non verità numeriche assolute;
28. errori scoperti dopo il delivery si correggono tramite revisione, non modifica retroattiva;
29. Item invalidati restano nello storico e vengono esclusi/gestiti dal grading;
30. Integrity Evidence è separata da punteggio, voto e sanzione;
31. Seat Map appartiene all'Assessment Event;
32. Assessment è distinto dagli Artifact che lo rappresentano;
33. il confine del dossier Assessment termina prima del grading vero e proprio.

## 50. Evolution decisions

Da rimandare:

- schema tecnico dei question type handler;
- algoritmo di generazione varianti;
- misura/equivalenza quantitativa tra Form;
- algoritmo di stima difficoltà/durata;
- item exposure similarity;
- modello tecnico dei dataset/allegati comuni;
- integrazioni specifiche con provider esterni;
- QR/barcode workflow cartaceo;
- adaptive testing;
- accommodations avanzate;
- analytics psicometrici;
- proctoring sofisticato.

## 51. Edge cases da supportare

Il modello deve reggere almeno:

1. stessa Assessment spostata di data;
2. recupero per studenti assenti;
3. Form diverse nella stessa aula;
4. una Form per studente;
5. Item modificato dopo che qualcuno ha iniziato;
6. domanda annullata dopo la prova;
7. prova cartacea importata successivamente;
8. risultato esterno senza mapping studente certo;
9. doppia Submission accidentale;
10. Attempt riaperto dal docente;
11. prova ibrida carta + file;
12. Item condiviso da più prove;
13. nuova Item Version senza alterare prove storiche;
14. studente con tempo o Form diversa;
15. piattaforma esterna che cambia identificativo/stato;
16. prova annullata completamente;
17. Assessment con più Event in giorni diversi;
18. allegato/dataset comune corretto dopo la pubblicazione.

## 52. Checkpoint di dominio proposto — A1: One assessment, many deliveries

Problema:

> La verifica deve poter essere progettata una volta e sopravvivere a varianti, stampa e svolgimento digitale senza duplicare il dominio.

Scenario minimo:

1. il docente crea un Assessment;
2. definisce/modifica il Blueprint;
3. il sistema crea alcuni Item;
4. genera Form A e B;
5. valida equivalenza e copertura;
6. esporta una Form in PDF e rende l'altra disponibile digitalmente;
7. crea Attempt/Submission per gli studenti;
8. tutte le risposte restano collegate allo stesso Assessment e alla Form esatta.

Nuove primitive:

- Assessment;
- Blueprint;
- Assessment Item / Item Version;
- Assessment Form;
- Assessment Event;
- Form Assignment;
- Attempt;
- Response;
- Submission;
- Evaluation Spec;
- Integrity Evidence.

Non-goals:

- grading completo;
- psicometria;
- adaptive testing;
- proctoring avanzato;
- integrazione con ogni provider.

## 53. Metriche utili

- tempo per passare da intenzione a Blueprint pronto;
- numero di modifiche al Blueprint dopo generazione Item;
- percentuale di Form che superano la validazione senza intervento;
- numero di problemi di mapping import/export;
- percentuale Attempt/Submission ricostruibili fino alla Form e Item Version esatte;
- numero di modifiche retroattive evitate grazie al versioning;
- tempo per creare varianti equivalenti;
- frequenza di riuso Item senza errori di storico.

## 54. Decisioni aperte residue

Le questioni residue riguardano principalmente l'evoluzione tecnica e non il core del dominio:

1. implementazione dei question type handler;
2. algoritmo di generazione e validazione delle varianti;
3. misura dell'equivalenza tra Form;
4. stima di difficoltà e durata;
5. similarity per exposure history;
6. rappresentazione tecnica di dataset/allegati condivisi;
7. integrazioni specifiche con provider esterni;
8. eventuale UI dedicata per Item Bank;
9. workflow QR/barcode per il cartaceo;
10. adaptive testing e accommodations avanzate.

## 55. Stato del dossier

Il nucleo del Dossier 05 — Assessment System è considerato **approvato e stabile per i primi checkpoint**.

Sono consolidate in particolare:
- catena Assessment → Blueprint → Assessment Item → Form/Variant → Assessment Event → Attempt/Submission → Response;
- Assessment come identità didattica distinta da file, form e canale;
- Blueprint versionato e modificabile;
- Item riutilizzabili ma referenziati tramite versione precisa;
- distinzione tra versione e variante;
- Equivalence Contract e Diversification Policy;
- Assessment Event come rappresentazione del momento reale di svolgimento;
- Attempt distinto dalla Submission;
- freeze/versioning delle revisioni già distribuite o iniziate;
- Delivery Channel separato dal dominio della prova;
- paper, digital, external e hybrid come delivery adapter dello stesso Assessment;
- Evaluation Spec come ponte verso Grading;
- Integrity Evidence separata da punteggio, voto e sanzione;
- Item Bank inizialmente come capability di ricerca/riuso, senza obbligo di UI dedicata.

Le decisioni residue non impediscono di procedere al Dossier 06 — Grading & Feedback.

## 56. Aggiornamento approvato — Assessable Source Set e grounding (2026-10)

Questa integrazione prevale su ogni lettura più permissiva di "source set" o "contenuti svolti" nel presente dossier.

1. **Confine valutabile:** default = *Student Material canonico e pubblicato* per il contesto/classe, nella versione disponibile entro il termine didatticamente rilevante. Support Material entra nell'insieme solo su autorizzazione esplicita del docente e con disponibilità verificabile. Teacher Material e materiali non pubblicati sono esclusi per default.
2. **Trace per Item:** conservare Assessment/Item Version, concetto/competenza e prerequisiti richiesti, sezione/evidenza semanticamente pertinente (estratto/localizzatore quando utile), Resource/Artifact Version, ruolo didattico, autorizzazione e stato/data di pubblicazione. I riferimenti puntano alla versione esatta. La trace attesta la copertura delle competenze: non è necessario un match testuale fra domanda, soluzione e fonte.
3. **Generazione:** l'Item deve richiedere soltanto competenze e prerequisiti coperti dall'Assessable Source Set. Sono ammessi domande e contesti originali, nuovi dataset o dati ipotetici autosufficienti, deduzioni e applicazioni non testualmente presenti nelle dispense. Il modello non può inventare fatti attribuiti a fonti o introdurre nozioni sostanziali necessarie alla soluzione ma non insegnate. In tal caso escludere l'Item o richiedere integrazione/autorizzazione didattica.
4. **Validazione:** un Item non supportato, contraddittorio, falsamente attribuito o basato su versione non autorizzata è un *blocking issue*, non un warning eludibile tramite uno score medio elevato. La revisione del docente resta necessaria e non sostituisce la tracciabilità.
5. **Riuso e aggiornamenti:** un Item validato per una classe o una data non è automaticamente idoneo per un'altra; occorre verificare il materiale realmente disponibile per la nuova assegnazione. La pubblicazione di una nuova versione non modifica retroattivamente l'evidenza di versioni usate in verifiche precedenti.
6. **Override esplicito:** il docente può estendere il perimetro pubblicando/autorizzando ulteriore materiale per gli studenti; non è ammesso un override silenzioso che trasformi appunti privati in conoscenze presumibilmente studiate.

Caso minimo di regressione: Teacher Script contiene un fatto assente dallo Student Material distribuito; il generatore deve **escludere** quel fatto come prerequisito necessario degli Item oppure richiedere pubblicazione/integrazione esplicita, mai presumere che sia valutabile.

## 57. Decisione integrativa — verificare capacità di ragionare, non di copiare (2026-10-09)

La verifica misura il raggiungimento degli obiettivi didattici attraverso riconoscimento (quando utile), comprensione, spiegazione con parole proprie, confronto, applicazione, trasferimento e ragionamento. Non imporre domande con frasi o risposte identiche al materiale pubblicato. Il Blueprint, non un quota fissa, governa la combinazione delle tipologie.

**Esempio accettabile:** dopo aver studiato `SELECT`, `WHERE` e `JOIN`, lo studente affronta uno schema di database nuovo, descritto nella consegna, per scrivere una query mai vista. L'item è grounded nelle **competenze**, non nel testo letterale della soluzione.

**Esempio non accettabile:** chiedere una window function SQL mai spiegata senza fornire conoscenze sufficienti per risolvere l'esercizio; oppure esigere un fatto specifico presente solo negli appunti riservati del docente.

**Esempio di invenzione lecita:** dati numerici o nomi di prodotti fittizi introdotti espressamente per il problema, coerenti e autosufficienti; non vanno spacciati per dati del materiale originale.

**Controllo Item:** identificare prerequisiti necessari; individuare sezioni/materiali disponibili in cui sono stati trattati; controllare se il nuovo contesto è autosufficiente; validare soluzione, chiarezza, assenza di ambiguità e utilità cognitiva. Bloccare errori veri, falsa attribuzione e conoscenze richieste ma non insegnate. Non bloccare rielaborazioni e problemi originali per il solo mancato overlap letterale.

Metriche separate: copertura semantica, correttezza/risolvibilità, qualità cognitiva e varietà, ambiguità, editing effort. La similarità lessicale può essere un indizio di retrieval ma non una misura della legittimità didattica.

Questa sezione integra la §56 senza modificare versioning, Assessable Source Set o obbligo di review docente.

## 58. Chiarimento lifecycle — Assessment Draft e readiness d'uso (C11, 2026-10-10)

Un Assessment Draft può essere preparato e revisionato prima della lezione e della distribuzione dello Student Material. Può avere controlli tecnici preliminari e un'approvazione di preparazione, purché resti esplicitamente una bozza non autorizzata alla somministrazione e conservi la trace verso l'esatta versione Student Material prevista e le competenze pianificate.

La validazione di preparazione non rende l'item valutabile. Prima dell'uso occorre verificare versione realmente disponibile, copertura didattica confermata e prerequisiti effettivi. Se il programma svolto differisce dal piano, identificare gli item impattati e richiedere revisione o esclusione; conservare le versioni e le approvazioni precedenti senza aggiornarle silenziosamente. La readiness simulata o tecnica non è pubblicazione reale né autorizzazione docente.

La §56, l'Assessable Source Set, la review docente e il principio della §57 di valutare competenze anziché copia letterale restano invariati.

