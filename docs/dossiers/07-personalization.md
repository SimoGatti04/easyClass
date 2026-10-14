# Dossier 07 — Personalization

## 1. Domanda centrale

Come adattare materiali, esercizi, recuperi, attività e verifiche alle esigenze reali di studenti o gruppi senza costruire prematuramente profili complessi, etichette permanenti o inferenze opache?

L'obiettivo iniziale non è conoscere tutto dello studente.

L'obiettivo è poter rispondere bene a domande operative come:

- serve un esercizio più guidato?
- conviene riprendere un prerequisito?
- quali studenti beneficerebbero dello stesso recupero?
- esiste un accomodamento esplicito da rispettare?
- questa verifica richiede una Form o condizioni diverse?

## 2. Principio fondamentale

La personalizzazione deve essere modellata come **decisione contestuale**, non come caratteristica permanente dello studente.

Modello proposto:

```text
EVIDENZE OSSERVABILI
+ REQUISITI / ACCOMODAMENTI ESPLICITI
+ ISTRUZIONI DEL DOCENTE
+ CONTESTO DIDATTICO
        ↓
PERSONALIZATION SIGNAL
        ↓
ADAPTATION PROPOSAL
        ↓
DECISIONE / POLICY DEL DOCENTE
        ↓
ADAPTATION / INTERVENTION
        ↓
NUOVE EVIDENZE
```

Il sistema può aiutare a individuare pattern e preparare adattamenti, ma non deve trasformare automaticamente pattern recenti in etichette stabili.

## 3. Vincoli già approvati

Questo dossier assume come già deciso:

- la profilazione avanzata non è una priorità delle prime versioni;
- il modello studente iniziale resta minimale;
- Learning Evidence descrive prestazioni osservabili;
- voto e media non rappresentano da soli lo studente;
- difficoltà recenti non diventano caratteristiche permanenti;
- note e osservazioni del docente possono contribuire al contesto;
- gruppi possono essere temporanei;
- materiali, esercizi, feedback, recuperi e verifiche possono essere adattati;
- il docente decide se applicare le proposte;
- accomodamenti espliciti devono poter influenzare Assessment e Delivery;
- Assessment Form e condizioni di svolgimento sono separabili;
- il sistema non deve inferire motivazione, psicologia o diagnosi da dati scolastici.

## 4. Tre categorie da non confondere

Propongo di distinguere nettamente:

### A. Requirement / Accommodation

Requisito esplicito da rispettare.

Esempi:

- tempo aggiuntivo;
- formato accessibile;
- strumento consentito;
- modalità specifica di consegna;
- istruzione autorizzata dal docente/istituzione.

### B. Learning Evidence / Signal

Evidenza osservata o pattern derivato.

Esempio:

```text
3 errori recenti sulle subquery correlate
```

### C. Adaptation

Azione concreta applicata.

Esempi:

- 3 esercizi guidati;
- spiegazione alternativa;
- materiale con esempi aggiuntivi;
- attività di recupero;
- Form accessibile;
- tempo diverso in un Assessment Event.

Questi tre livelli hanno origine e autorità diverse.

## 5. Explicit Requirement / Accommodation

Un Requirement esplicito deve essere un oggetto strutturato e non una semplice nota libera quando deve influenzare automaticamente i workflow.

Può avere:

- studente o gruppo destinatario;
- tipo;
- descrizione;
- ambito;
- data di validità;
- origine/autore;
- eventuale priorità/obbligatorietà;
- workflow a cui si applica;
- stato attivo/inattivo.

Il dettaglio di autorizzazioni e dati sensibili appartiene al Dossier Governance.

## 6. Nessuna inferenza automatica di accomodamenti o diagnosi

Il sistema non deve dedurre da voti, errori, linguaggio o comportamento che uno studente abbia una condizione, diagnosi o bisogno formale.

Un accomodamento formale entra nel sistema perché:

- inserito da un docente autorizzato;
- importato da una fonte autorizzata;
- confermato esplicitamente secondo il workflow previsto.

Le evidenze possono suggerire un intervento didattico ordinario, non una diagnosi.

## 7. Learning Evidence come input

Le Learning Evidence del Dossier 06 sono uno degli input principali.

Esempi:

- errore ricorrente;
- criterio frequentemente non soddisfatto;
- miglioramento recente;
- risposta corretta dopo recupero;
- prerequisito mancante;
- prestazione stabile su uno specifico obiettivo.

Le evidenze restano collegate a:

- Curriculum Item/obiettivo;
- attività/Assessment;
- periodo;
- studente o classe;
- provenance.

## 8. Teacher Observation

Una nota del docente può contribuire alla personalizzazione solo quando è appropriato.

Non tutte le note devono essere automaticamente usate.

Può quindi esistere concettualmente un flag/scopo come:

```text
Usabile per personalizzazione: sì/no
```

oppure una classificazione equivalente.

Questo evita che una nota contestuale o riservata influenzi inconsapevolmente materiali e verifiche.

## 9. Preference non equivale a bisogno

Indicazioni come:

```text
Con esempi grafici comprende più rapidamente
```

possono diventare una preferenza didattica operativa se il docente la considera utile.

Non devono diventare etichette rigide come:

```text
studente visivo
```

Il sistema adatta il metodo quando utile senza pretendere una teoria permanente sul modo in cui la persona apprende.

## 10. Personalization Signal

Un `Personalization Signal` è una sintesi derivata e temporale di evidenze.

Esempio:

```text
Rossi
Subquery correlate

Evidenze recenti:
- 2 errori in verifica
- 1 esercizio incompleto

Possibile necessità:
pratica guidata
```

Il Signal deve conservare:

- evidenze di origine;
- oggetto/argomento;
- periodo;
- stato;
- eventuale confidence dell'inferenza;
- data di ultimo aggiornamento;
- eventuale scadenza/revisione.

## 11. Signal non è stato canonico dello studente

Un Signal è derivato.

Può:

- rafforzarsi;
- indebolirsi;
- scadere;
- essere ignorato;
- essere corretto;
- essere chiuso dopo un intervento.

Non deve diventare automaticamente un attributo permanente nel record Student.

## 12. Positive signals

Il sistema non deve cercare solo difficoltà.

Può rilevare anche:

- miglioramento;
- obiettivo recentemente consolidato;
- autonomia crescente;
- recupero riuscito;
- prestazione positiva ripetuta.

Questo evita un modello personalizzato costruito solo sui problemi.

## 13. Adaptation Proposal

Un `Adaptation Proposal` è una proposta concreta derivata da Requirements, Signals e contesto.

Esempi:

```text
Rossi — Subquery

Proposta:
3 esercizi guidati con schema progressivo

Perché:
2 errori recenti + 1 esercizio incompleto

[Prepara]
[Ignora]
```

Oppure a livello classe:

```text
14/22 studenti hanno difficoltà
sulle subquery correlate.

[Inserisci recupero nella prossima lezione]
[Prepara esercizi]
[Ignora]
```

## 14. Adaptation Proposal non modifica automaticamente il profilo

Accettare una proposta significa applicare un intervento o creare un'istruzione contestuale.

Non significa necessariamente salvare:

```text
Rossi = livello basso su subquery
```

Il sistema conserva l'intervento e le evidenze, non un'etichetta arbitraria.

## 15. Adaptation / Intervention

Un intervento è l'azione effettivamente applicata.

Può riguardare:

- materiale;
- esercizi;
- spiegazione;
- compito;
- attività in classe;
- recupero;
- feedback;
- Assessment Form;
- condizioni di Assessment Event;
- gruppo temporaneo.

Deve poter essere collegato alle evidenze che lo hanno motivato.

## 16. Tre livelli di personalizzazione

Il sistema dovrebbe poter agire a tre granularità:

### Classe

Quando il pattern riguarda molti studenti.

### Gruppo temporaneo

Quando un sottoinsieme condivide un bisogno operativo.

### Individuo

Quando l'adattamento è realmente personale.

Non dobbiamo individualizzare tutto se un intervento di classe o gruppo è sufficiente.

## 17. Preferire il livello meno complesso sufficiente

Principio:

> usare la granularità minima che risolve bene il bisogno.

Esempio:

Se 16 studenti su 22 sbagliano lo stesso prerequisito, è probabilmente un problema da trattare a livello classe, non creare 16 percorsi individuali.

Questo riduce complessità e lavoro del docente.

## 18. Temporary Group

Un gruppo può essere creato per uno scopo concreto.

Esempio:

```text
Recupero subquery
• Rossi
• Bianchi
• Conti
```

Il gruppo deve avere almeno concettualmente:

- scopo;
- membri;
- contesto;
- data/periodo;
- origine manuale o proposta;
- stato attivo/chiuso.

## 19. Membership contestuale, non etichetta

`Rossi appartiene al gruppo recupero subquery` significa:

> in questo periodo partecipa a questo intervento.

Non significa:

> Rossi appartiene permanentemente agli studenti deboli.

Il gruppo può essere chiuso quando non serve più.

## 20. Gruppi suggeriti

In futuro il sistema può proporre gruppi sulla base di evidenze simili.

Nei primi checkpoint questa capacità può essere semplice:

- stesso Curriculum Item;
- difficoltà recente simile;
- stesso recupero utile.

Il docente approva o modifica la composizione.

Non serve clustering sofisticato inizialmente.

## 21. Personalizzazione dei materiali

Un materiale personalizzato deve seguire il modello Artifact del Dossier 04.

Esempio:

```text
Scheda JOIN standard
       ↓ derived-from
Scheda JOIN guidata — gruppo recupero
```

È una variante intenzionale che può evolvere indipendentemente.

La provenance e il motivo dell'adattamento restano ricostruibili.

## 22. Tipi di adattamento materiale

Possibili trasformazioni:

- più esempi;
- maggiore gradualità;
- esercizi aggiuntivi;
- riduzione del carico non essenziale;
- linguaggio più diretto;
- spiegazione alternativa;
- supporti visivi;
- prerequisiti richiamati;
- versione più avanzata;
- formato accessibile.

Il tipo di trasformazione deve derivare dal bisogno concreto, non da una classificazione generale dello studente.

## 23. Esercizi e pratica

La personalizzazione degli esercizi può agire su:

- quantità;
- scaffolding;
- prerequisiti;
- tipo di errore;
- difficoltà;
- esempi;
- sequenza;
- feedback.

Un adattamento può essere temporaneo e mirato a un solo Curriculum Item.

## 24. Difficoltà e target didattico

Abbassare la difficoltà non deve essere il default della personalizzazione.

Spesso l'adattamento corretto può essere:

- più supporto;
- più passaggi;
- esempio alternativo;
- pratica aggiuntiva;
- tempo diverso;

mantenendo lo stesso obiettivo.

Il sistema deve distinguere **accesso/supporto** da **modifica del target didattico**.

## 25. Assessment personalization — tre categorie

Per le verifiche propongo di distinguere:

### A. Delivery accommodation

Cambia condizioni/accessibilità senza cambiare ciò che viene valutato.

Esempi:

- tempo aggiuntivo;
- formato diverso;
- strumenti consentiti;
- layout accessibile.

### B. Equivalent Form adaptation

Cambia la traccia mantenendo l'Equivalence Contract.

Esempi:

- dati diversi;
- formulazione più chiara;
- Form equivalente.

### C. Assessment target modification

Cambia effettivamente obiettivi, contenuti, peso o difficoltà.

Questa non deve essere trattata come semplice variante equivalente.

Richiede una decisione/giustificazione esplicita secondo policy.

## 26. Equivalence Contract resta valido

Un adattamento individuale non deve fingere equivalenza quando modifica davvero il target.

Quindi:

```text
stesso obiettivo + accessibilità diversa
→ può restare equivalente

obiettivi/contenuti differenti
→ Assessment/Form con target modificato
→ non dichiarare equivalenza automatica
```

Questo è importante per correttezza e trasparenza.

## 27. Authorized accommodations come vincoli

Quando un accomodamento esplicito è attivo e applicabile, il sistema deve trattarlo come requisito del workflow, non come suggerimento facoltativo.

Esempio:

```text
Assessment Event
Rossi
tempo previsto standard: 60 min
accomodamento attivo: +20 min
→ sessione configurata a 80 min
```

Il modo in cui requisiti obbligatori vengono autorizzati, modificati e protetti sarà definito in Governance.

## 28. Conflict detection

Il sistema deve rilevare conflitti tra:

- accomodamento;
- Assessment policy;
- Form;
- strumenti consentiti;
- timing;
- istruzioni del docente.

Esempio:

```text
Accomodamento: calcolatrice consentita
Verifica: calcolatrice vietata

→ Da controllare
```

Non deve scegliere silenziosamente quale regola ignorare.

## 29. Feedback personalizzato

Il Feedback Package può essere adattato per:

- dettaglio;
- linguaggio;
- esempi;
- riferimenti;
- esercizi di recupero;
- prossima azione.

Il punteggio/Final Grade non deve cambiare solo perché cambia la forma del feedback.

## 30. Intervention outcome

Quando possibile, il sistema deve poter collegare un intervento alle evidenze successive.

Esempio:

```text
4 ottobre
assegnati esercizi guidati

15 ottobre
nuova Assessment Evidence: miglioramento
```

Questo permette di capire se un intervento è stato utile senza richiedere un questionario al docente.

## 31. Nessuna causalità automatica

Se il risultato migliora dopo un intervento, il sistema può registrare la sequenza temporale ma non deve concludere automaticamente:

> l'intervento X ha causato il miglioramento.

Può dire:

> dopo l'intervento X le evidenze successive sono migliorate.

## 32. Temporalità e scadenza

Signals, gruppi e adattamenti possono avere validità temporale.

Esempio:

```text
Difficoltà recente su subquery
evidenze: ultime 3 attività
ultimo aggiornamento: 15 ottobre
```

Se non emergono nuove evidenze, il Signal può diventare stale e smettere di influenzare automaticamente le proposte.

## 33. Scope della personalizzazione

Un'adattamento/instruction può essere limitato a:

- singola attività;
- Curriculum Item;
- materia;
- classe;
- periodo;
- Assessment;
- tipo di Artifact;
- studente;
- gruppo.

Non trasformare automaticamente un adattamento locale in regola permanente.

## 34. Teacher-approved personalization rule

Quando il docente vuole rendere persistente una scelta, può creare una regola esplicita.

Esempio:

```text
Per Rossi, nelle schede di SQL:
richiama sempre brevemente il prerequisito
prima degli esercizi sulle subquery.
```

Questa è una configurazione esplicita e modificabile, non un'inferenza nascosta.

Il modello generale dell'ereditarietà sarà definito nel Dossier 09.

## 35. One-off vs persistent

Come nel resto del prodotto, distinguere sempre:

- solo questa volta;
- per questa attività;
- per questo argomento/periodo;
- persistente finché attivo.

La persistenza deve essere una scelta esplicita o una conferma del docente.

## 36. Student-facing transparency

Nelle prime versioni la Student Experience resta minimale.

Lo studente può ricevere il materiale/Assessment adattato senza dover vedere un profilo o etichette interne.

Quando un accomodamento o adattamento deve essere comunicato, la forma e la visibilità saranno definite da Governance/Student Experience.

## 37. Privacy by minimization

Il personalization layer deve usare solo i dati necessari al workflow.

Non deve raccogliere nuovi dati 'nel caso possano servire in futuro'.

Preferire dati già prodotti naturalmente da:

- Assessment;
- grading;
- lezioni;
- attività;
- note esplicitamente utilizzabili;
- requisiti autorizzati.

## 38. Sensitive data boundary

Alcuni Requirements/accomodamenti possono implicare dati sensibili.

Questo dossier definisce solo che tali requisiti possono esistere e influenzare workflow autorizzati.

Il Dossier Governance dovrà definire:

- chi può vederli;
- chi può modificarli;
- quanto dettaglio conservare;
- retention;
- audit;
- quali componenti/AI possono riceverli.

## 39. Personalization e AI

L'AI può essere utile per:

- sintetizzare evidenze;
- proporre adattamenti;
- generare varianti di materiale;
- spiegazioni alternative;
- esercizi mirati;
- raggruppare casi simili;
- formulare feedback.

Ma non deve essere usata come autorità per:

- diagnosticare;
- attribuire tratti psicologici;
- determinare accomodamenti formali;
- decidere automaticamente opportunità educative ad alto impatto.

Il Dossier AI definirà tecniche e modelli.

## 40. Deterministic first dove possibile

Molti adattamenti derivano da regole semplici.

Esempio:

```text
Requirement attivo: +20 min
→ Assessment Event +20 min
```

Non serve un LLM.

Allo stesso modo:

```text
gruppo recupero associato a Curriculum Item X
→ assegna Artifact Y
```

può essere deterministico.

## 41. Cosa non costruire nei primi checkpoint

Non sono prerequisiti iniziali:

- mastery model completo;
- profilo multidimensionale dello studente;
- learning-style classification;
- predizione del successo scolastico;
- ranking degli studenti;
- raccomandazioni di percorso ad alto impatto;
- clustering psicopedagogico;
- dashboard longitudinali sofisticate;
- adaptive testing continuo;
- personal tutor autonomo per studente.

Queste capacità potranno essere rivalutate solo se emergono valore, dati adeguati e garanzie sufficienti.

## 42. Minimal personalization scope

Per i primi checkpoint la priorità deve essere ancora più conservativa.

### Priorità iniziale

Supportare bene soprattutto:

1. annotazioni del docente rapide e contestuali;
2. Requirements/accomodamenti espliciti essenziali;
3. collegamento delle annotazioni a studente, lezione, Assessment, Curriculum Item o periodo;
4. possibilità di indicare se una nota può o non può essere usata dall'automazione;
5. adattamenti manuali essenziali di materiali/Artifact;
6. condizioni/Form di Assessment diverse quando richieste da accomodamenti autorizzati;
7. storico minimo di note, requisiti e adattamenti applicati.

### Non prioritario nei primi checkpoint

Pur restando compatibili con il modello di dominio, rimandare:

- profilazione dello studente;
- Personalization Signal automatici;
- suggerimenti sulla metodologia didattica;
- proposte automatiche di recupero;
- gruppi suggeriti automaticamente;
- inferenze su preferenze didattiche;
- analisi longitudinali;
- adattamenti automatici derivati da pattern di performance.

Learning Evidence, Signals, Adaptation Proposal e Temporary Group restano foundation valide per l'evoluzione, ma non sono prerequisiti per i primi checkpoint.

## 43. Foundation decisions approvate

Le seguenti decisioni sono considerate approvate come base strutturale, pur con priorità implementative differenziate:

1. la personalizzazione è una decisione contestuale, non un profilo permanente;
2. distinguere Requirement/Accommodation, Learning Evidence/Signal e Adaptation;
3. accomodamenti formali non vengono inferiti automaticamente;
4. Learning Evidence resta osservabile e collegata alla provenance;
5. note del docente influenzano la personalizzazione solo quando appropriate/abilitate;
6. preferenze operative non diventano etichette di learning style;
7. Personalization Signal è derivato, temporale, correggibile e non canonico sullo Student;
8. supportare anche segnali positivi;
9. Adaptation Proposal esplicita evidenze e motivo;
10. accettare una proposta non crea automaticamente un'etichetta permanente;
11. Intervention è un oggetto/relazione tracciabile collegato alle evidenze;
12. personalizzazione a livello classe, gruppo e individuo;
13. usare la granularità meno complessa sufficiente;
14. Temporary Group ha scopo e durata e non è un'etichetta permanente;
15. Artifact personalizzati sono varianti derived-from secondo il Dossier 04;
16. distinguere supporto/accessibilità da modifica del target didattico;
17. Assessment personalization distingue Delivery Accommodation, Equivalent Form Adaptation e Assessment Target Modification;
18. l'Equivalence Contract non viene dichiarato valido quando cambia davvero il target;
19. accomodamenti autorizzati e attivi sono vincoli del workflow;
20. conflitti tra accomodamenti e regole generano review;
21. feedback personalizzato è separato dal voto;
22. gli interventi possono essere collegati alle evidenze successive senza inferire causalità certa;
23. Signals e adattamenti possono scadere/diventare stale;
24. scope e persistenza della personalizzazione sono espliciti;
25. una regola persistente nasce da decisione del docente, non da inferenza silenziosa;
26. personalizzazione rispetta data minimization;
27. dati sensibili e accessi sono demandati a Governance;
28. AI può proporre/adattare ma non diagnosticare o determinare accomodamenti formali;
29. logica deterministica è preferita quando sufficiente;
30. il core iniziale non richiede mastery model, learning-style profile o analytics sofisticati;
31. annotazioni contestuali del docente sono una capacità prioritaria dei primi checkpoint;
32. profilazione, Personalization Signal automatici e suggerimenti metodologici sono esplicitamente rimandati a una fase successiva;
33. il modello deve supportare queste capacità future senza renderle necessarie per il funzionamento iniziale.

## 44. Evolution decisions

Da rimandare:

- mastery model;
- algoritmo di signal detection;
- soglie temporali/staleness;
- clustering/gruppi suggeriti avanzati;
- effectiveness analysis degli interventi;
- adaptive sequencing;
- adaptive testing;
- recommender personale;
- dashboard longitudinali;
- cross-subject personalization;
- tutoring autonomo lato studente;
- modelli predittivi.

## 45. Edge cases da supportare

Il modello deve reggere almeno:

1. difficoltà recente poi risolta;
2. accomodamento temporaneo con scadenza;
3. accomodamento in conflitto con impostazioni della prova;
4. studente in più gruppi temporanei;
5. gruppo chiuso dopo recupero;
6. materiale personalizzato poi riutilizzato;
7. Assessment Form equivalente ma con layout accessibile;
8. Assessment con target realmente modificato;
9. docente ignora un Signal automatico;
10. docente corregge un Signal errato;
11. nota riservata esclusa dalla personalizzazione;
12. evidenze positive dopo un intervento;
13. peggioramento successivo senza trasformare la difficoltà in etichetta permanente;
14. adattamento one-off che non deve diventare persistente;
15. Requirement importato ma non ancora confermato/autorizzato;
16. classe intera con difficoltà comune;
17. studente senza dati sufficienti: nessuna inferenza forzata.

## 46. Checkpoint di dominio proposto — P1: Notes and explicit needs first

Problema:

> Il sistema deve permettere al docente di conservare rapidamente contesto utile sugli studenti e rispettare esigenze esplicite, senza richiedere profilazione o inferenze automatiche.

Scenario minimo:

1. il docente aggiunge una nota da studente, lezione, Assessment o altro contesto;
2. la nota conserva automaticamente il contesto di origine;
3. il docente può indicare se è utilizzabile o esclusa dall'automazione;
4. un Requirement/Accommodation esplicito può essere associato allo studente;
5. il requisito viene applicato ai workflow pertinenti, per esempio tempo aggiuntivo in una verifica;
6. eventuali conflitti vengono inviati a review;
7. il docente può creare manualmente un Artifact adattato o una regola contestuale essenziale;
8. storico e provenance restano ricostruibili.

Primitive necessarie subito:

- Teacher Annotation;
- Annotation Context Link;
- Automation Eligibility / visibility policy della nota;
- Explicit Requirement / Accommodation;
- Adaptation / Intervention essenziale;
- Personalization Rule/Instruction esplicita.

Primitive già previste ma non necessarie al primo checkpoint:

- Personalization Signal;
- Adaptation Proposal automatica;
- Temporary Group suggerito;
- Intervention Outcome analysis.

Non-goals:

- profiling dello studente;
- suggerimenti metodologici automatici;
- mastery model completo;
- predizione;
- tutor autonomo;
- adaptive testing avanzato.

## 47. Metriche utili

- numero di proposte accettate/modificate/ignorate;
- tempo necessario per preparare un recupero;
- percentuale di adattamenti generati a livello classe/gruppo invece che individuale quando sufficiente;
- numero di Signals stale/non più pertinenti correttamente chiusi;
- interventi che richiedono correzione manuale;
- frequenza di conflitti con Requirements rilevati prima del delivery;
- percentuale di Artifact personalizzati riutilizzati;
- carico aggiuntivo richiesto al docente.

## 48. Decisioni aperte residue

Le decisioni residue riguardano quasi tutte l'evoluzione futura:

1. quando introdurre Personalization Signal automatici;
2. quando introdurre suggerimenti metodologici;
3. quando introdurre gruppi suggeriti;
4. eventuale mastery model;
5. criteri di staleness/decadimento dei Signals;
6. effectiveness analysis degli interventi;
7. personalizzazione trasversale tra materie;
8. eventuale tutor/adaptive sequencing futuro.

## 49. Stato del dossier

Il nucleo del Dossier 07 — Personalization è considerato **approvato come foundation di dominio**, con una precisa scelta di priorità.

Per i primi checkpoint sono prioritarie:
- annotazioni contestuali del docente;
- requisiti/accomodamenti espliciti;
- controllo sull'uso delle note da parte dell'automazione;
- adattamenti manuali essenziali;
- applicazione corretta di accomodamenti ai workflow;
- conflict detection e provenance.

Sono invece volutamente rimandati:
- profilazione avanzata;
- Personalization Signal automatici;
- suggerimenti sulla metodologia;
- gruppi automatici/suggeriti;
- analisi longitudinali;
- mastery model;
- adaptive personalization.

La struttura resta predisposta a queste estensioni future senza renderle necessarie nel prodotto iniziale.