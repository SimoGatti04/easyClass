# Dossier 04 — Knowledge & Materials

## 1. Domanda centrale

Come raccogliere, identificare, versionare, collegare, cercare e riutilizzare contenuti provenienti da fonti diverse senza trasformare il docente nel bibliotecario del sistema e senza perdere provenance o controllo?

Il modello deve supportare contemporaneamente:

- upload e creazione manuale;
- import e sincronizzazione;
- email, calendari e piattaforme scolastiche;
- web e fonti esterne;
- materiali del docente;
- libri, dispense e documentazione;
- artefatti generati dal sistema;
- riuso tra lezioni, classi e anni;
- versioni e aggiornamenti;
- ricerca locale ed esterna.

## 2. Vincoli già approvati

Questo dossier assume come decisioni già consolidate:

- classificazione tramite collegamenti, non cartelle rigide;
- uno stesso materiale può appartenere a più contesti senza duplicazione;
- classificazione automatica sempre correggibile;
- materiali anche volutamente generici/non classificati;
- deduplicazione prudente e non distruttiva;
- una stessa risorsa può avere più origini;
- fonti e materiali derivati devono essere distinguibili;
- provenance visibile su richiesta ma non invasiva;
- riuso prima della rigenerazione quando utile;
- ricerca globale e semantica;
- ricerca esterna come capacità nativa;
- distinzione tra fonte trovata, consultata, usata e salvata;
- selezione delle fonti guidata da contesto, autorevolezza, rilevanza e preferenze;
- aggiornamento selettivo degli artefatti dipendenti;
- modifiche manuali preservate;
- progetto free e provider sostituibili.

## 3. Problema concettuale principale

Il termine "materiale" viene usato nella vita quotidiana per cose molto diverse:

- un PDF caricato;
- lo stesso PDF importato da Teams;
- una pagina web;
- un capitolo di libro;
- una scheda generata dal sistema;
- una versione modificata della scheda;
- un file PDF esportato dalla scheda.

Se modelliamo tutto come semplice file, perdiamo identità logica, versioni e provenance.

Se modelliamo ogni provenienza come oggetto distinto, creiamo duplicati.

Serve quindi separare almeno origine, risorsa logica, versione e artefatto derivato.

## 4. Modello concettuale proposto

```text
ORIGIN
dove il contenuto è stato trovato
        ↓
KNOWLEDGE RESOURCE
identità logica riutilizzabile
        ↓
RESOURCE VERSION
contenuto esatto in un momento
        ↓
DERIVED ARTIFACT
output creato/adattato per uno scopo
```

Le frecce non costituiscono una pipeline obbligatoria: un artefatto può successivamente essere usato come fonte per altri artefatti.

## 5. Origin — origine

Origin rappresenta il luogo o canale da cui un contenuto proviene.

Esempi:

- upload manuale;
- allegato email;
- file Teams;
- file Google Drive;
- URL web;
- repository;
- documento scolastico sincronizzato;
- file locale;
- contenuto creato direttamente nel servizio.

L'Origin conserva informazioni di provenance e, quando possibile:

- provider/tipo;
- identificativo esterno;
- URL o riferimento;
- data di acquisizione;
- data/modifica della fonte;
- autore/editore quando noto;
- stato di sincronizzazione;
- eventuale disponibilità futura.

Uno stesso contenuto logico può avere più Origin.

## 6. Knowledge Resource — risorsa logica

La Knowledge Resource è l'identità riutilizzabile del contenuto.

Esempio:

```text
Regolamento laboratorio

Origini:
- allegato email
- Teams
- upload manuale
```

Il docente vede idealmente una sola risorsa, non tre copie.

La Resource può essere:

- documento;
- pagina;
- presentazione;
- video;
- testo;
- esercizio;
- nota;
- libro/capitolo;
- regolamento;
- risorsa web;
- altro contenuto utile.

Non è obbligatorio che abbia un file fisico unico.

## 7. Resource Version — versione immutabile del contenuto

Una Resource può cambiare nel tempo.

Esempio:

```text
Regolamento laboratorio
v1 — settembre
v2 — novembre
```

Ogni versione rappresenta il contenuto effettivamente disponibile in quel momento.

Questo consente di sapere esattamente quale versione è stata usata per generare una lezione o una verifica.

La versione precedente non viene distrutta quando arriva quella nuova.

## 8. Derived Artifact — artefatto derivato

Un Artifact è un contenuto prodotto o adattato per uno scopo operativo.

Esempi:

- Lesson Plan;
- Teacher Script;
- Student Material;
- scheda;
- slide;
- esercizi;
- verifica;
- soluzione;
- rubrica;
- riassunto;
- glossario.

Un Artifact:

- ha una propria identità;
- ha versioni;
- può essere modificato manualmente;
- conserva le dipendenze dalle versioni esatte delle fonti usate;
- può essere riutilizzato in futuro;
- può diventare input per un altro artefatto.

## 9. Fonte è anche un ruolo

È importante non trattare "fonte" solo come tipo di oggetto.

Qualunque contenuto versionato può svolgere il ruolo di fonte per una generazione.

Esempio:

```text
Libro + PDF docente
        ↓
Teacher Script
        ↓
scheda studenti
        ↓
verifica di ripasso
```

Teacher Script e scheda sono artefatti, e possono diventare fonti di artefatti successivi. Questo evita conversioni artificiali tra tipi di oggetto.

**Eccezione vincolante per gli Assessment:** essere una fonte tecnicamente utilizzabile non significa essere una fonte *valutabile*. Un Teacher Script non autorizza, da solo, a porre domande su contenuti non distribuiti agli studenti. La selezione del Source Set valutabile è disciplinata dal Dossier 05 e dalla policy didattica della sezione 46.

## 10. Rappresentazione/file non equivale a contenuto

Lo stesso Artifact può avere più rappresentazioni:

- editor interno;
- PDF;
- DOCX/ODT;
- HTML;
- versione stampabile.

Queste non devono necessariamente diventare cinque materiali distinti.

Concettualmente il contenuto ha una propria identità e i file sono rappresentazioni/export.

Il dettaglio tecnico verrà definito in Platform Architecture.

## 11. Provenance graph

Il sistema deve poter ricostruire almeno:

```text
Origine
→ Resource
→ Resource Version usata
→ Artifact Version generata
→ eventuale Artifact successivo
```

Esempio:

```text
Libro cap. 7 v3 ─┐
PDF Routing v2 ──┼→ Teacher Script #12 v4
Appunti docente ─┘          ↓
                       Scheda studenti v2
```

La UI mostra solo il livello necessario; il grafo completo resta disponibile internamente.

## 12. Dipendenze e aggiornamenti

Se una nuova Resource Version sostituisce quella corrente, gli artefatti che dipendono dalla versione precedente possono diventare potenzialmente obsoleti.

Il sistema non deve rigenerarli indiscriminatamente.

Può:

- ignorare se il cambiamento non è rilevante;
- segnalare l'impatto;
- preparare una nuova versione;
- rigenerare secondo policy;
- chiedere review.

Il dependency model è condiviso con quanto già definito nella Teacher Experience.

## 13. Modifiche manuali agli artefatti

Una modifica manuale crea nuovo stato canonico dell'Artifact.

Una futura rigenerazione non deve cancellarla.

Il sistema deve poter distinguere:

- contenuto derivato automaticamente;
- modifiche manuali;
- nuova versione rigenerata;
- eventuale conflitto.

Il merge preciso sarà definito nei dossier Automation/Platform, ma la lineage deve essere preservata fin dall'inizio.

## 14. Collegamenti di contesto

Resource e Artifact possono essere collegati molti-a-molti a:

- materia;
- classe;
- Curriculum Item;
- lezione;
- verifica;
- periodo;
- attività;
- studente/gruppo quando necessario.

Questi sono collegamenti, non cartelle fisiche.

Un contenuto può anche essere completamente generico.

## 15. Provenienza del collegamento

Un collegamento contestuale può essere:

- inserito manualmente;
- importato;
- suggerito automaticamente;
- applicato automaticamente secondo policy.

Il docente deve poter correggere qualunque collegamento.

Una correzione manuale prevale sulle successive inferenze automatiche finché non viene esplicitamente cambiata.

## 16. Acquisizione unificata

Qualunque canale di ingresso deve convergere nello stesso processo concettuale:

```text
ACQUISIZIONE
↓
identificazione origine
↓
rilevamento duplicati/versioni
↓
creazione/aggiornamento Resource
↓
classificazione e collegamenti
↓
indicizzazione
↓
disponibile per ricerca e generazione
```

Il canale di ingresso non deve influenzare il modo in cui il contenuto viene usato successivamente.

## 17. Inbox di acquisizione

L'inbox esiste solo per i casi che richiedono una decisione.

Non deve diventare un passaggio obbligatorio per ogni import.

Esempi da inviare in inbox:

- contesto ambiguo;
- dubbio duplicato/versione;
- file non leggibile;
- conflitto tra classificazioni;
- fonte importante con metadata mancanti.

Gli import affidabili possono essere classificati senza intervento secondo policy.

## 18. Deduplicazione — quattro casi distinti

### A. Duplicato esatto

Contenuto identico.

Il sistema può riusare la stessa Resource/Version e aggiungere una nuova Origin.

### B. Stessa risorsa da origini diverse

Esempio: stesso regolamento da Teams e email.

Una Resource, più Origins.

### C. Nuova versione della stessa risorsa

Nuova Resource Version, stessa Resource.

### D. Quasi duplicato

Contenuti molto simili ma non certamente equivalenti.

Il sistema suggerisce merge/confronto ma non elimina automaticamente.

## 19. Merge non distruttivo

Un merge di identità non deve cancellare provenance o storico.

Se due record vengono riconosciuti come stessa Resource:

- le origini vengono conservate;
- le versioni vengono conservate;
- i collegamenti vengono unificati;
- le dipendenze restano ricostruibili;
- l'operazione deve poter essere auditata.

## 20. Varianti intenzionali

Se il docente vuole una variante indipendente, non è un duplicato.

Esempio:

```text
Scheda JOIN — standard
        ↓ adatta
Scheda JOIN — semplificata
```

Si crea un nuovo Artifact collegato tramite derived-from/fork, non una nuova versione della stessa identità se le due varianti devono evolvere indipendentemente.

Questa distinzione è importante per non sovrascrivere adattamenti.

## 21. Riutilizzo

Prima di generare nuovo materiale il sistema deve cercare contenuti già pertinenti.

Possibili azioni:

- usa così com'è;
- aggiorna;
- adatta per la classe;
- crea variante;
- genera nuovo.

Il riuso non deve essere imposto quando il contenuto è vecchio, inadatto o il docente richiede qualcosa di nuovo.

## 22. Ricerca locale

La ricerca deve coprire almeno:

- Resource;
- Artifact;
- versioni rilevanti;
- metadati;
- Curriculum Item collegati;
- classi/materie;
- lezioni e verifiche collegate;
- testo/contenuto indicizzato.

Deve supportare query naturali come:

- materiale sulle JOIN;
- esercizi di subnetting usati l'anno scorso;
- PDF collegato alla verifica SQL;
- appunti che parlano di routing dinamico.

Il risultato deve mostrare identità, contesto e origine, non solo filename.

## 23. Ranking contestuale

La pertinenza non dipende solo dalla similarità testuale.

Per una generazione il sistema deve combinare:

- relazione strutturale col Curriculum Item;
- classe/materia;
- lezione/verifica;
- recenza/freschezza;
- autorevolezza;
- preferenze del docente;
- storico d'uso;
- qualità/adattamento al livello;
- eventuali esclusioni.

Non è necessario esporre punteggi numerici al docente.

## 24. Autorità e preferenza

Come default concettuale:

```text
alta
- materiale del docente
- libro adottato
- documenti esplicitamente indicati

media
- materiali già usati
- dispense interne
- fonti scolastiche pertinenti

contestuale/opzionale
- web
- fonti generiche
```

Questa non è una gerarchia assoluta e deve poter essere sovrascritta dalle istruzioni.

## 25. Ricerca esterna

La ricerca esterna segue il processo:

```text
contesto
↓
gap informativo
↓
ricerca mirata
↓
valutazione candidati
↓
consultazione
↓
selezione
↓
uso
↓
eventuale salvataggio
```

Il sistema non deve cercare fuori quando il patrimonio locale è già sufficiente, salvo richiesta esplicita o necessità di freschezza/verifica.

## 26. Stati delle fonti esterne

Distinguere almeno:

- trovata: apparsa nei risultati;
- consultata: il contenuto è stato esaminato;
- usata: ha contribuito a un output;
- salvata: è stata promossa a Resource persistente nella libreria.

Queste condizioni non coincidono.

## 27. Fonte esterna usata ma non salvata

Se una fonte esterna contribuisce materialmente a un Artifact ma non viene salvata nella libreria, il sistema deve comunque conservare provenance sufficiente a ricostruire l'uso.

Almeno concettualmente:

- URL/riferimento;
- titolo/autore quando disponibili;
- data di accesso;
- porzione o fingerprint del contenuto effettivamente usato, nei limiti di copyright e governance;
- Artifact Version dipendente.

La retention esatta verrà definita nel dossier Governance.

## 28. Salvataggio persistente

Una fonte può essere promossa a Resource persistente:

- manualmente;
- automaticamente secondo policy;
- perché usata frequentemente;
- perché istituzionale/strategica;
- perché richiesta dal docente.

Non salviamo indiscriminatamente tutto il web consultato.

## 29. Aggiornamento e sincronizzazione

Per Origins sincronizzabili il sistema deve poter rilevare che il contenuto è cambiato.

Possibili esiti:

- metadata cambiati ma contenuto uguale;
- nuova Resource Version;
- origine non più disponibile;
- contenuto spostato;
- conflitto con una modifica locale.

Una nuova versione non deve cancellare quella precedente.

## 30. Fonte non più disponibile

Se una fonte esterna o sincronizzata scompare:

- la provenance storica resta;
- gli Artifact già creati non vengono invalidati retroattivamente;
- il sistema segnala solo quando serve ancora accedere alla fonte;
- eventuali snapshot consentiti dalla governance possono preservare la riproducibilità.

## 31. Parsing e contenuto non leggibile

Il fatto che il sistema non riesca a estrarre testo non significa che il file debba essere perso.

Una Resource può essere disponibile anche se:

- parsing fallisce;
- alcune pagine sono illeggibili;
- il formato non è supportato;
- il contenuto è principalmente visuale.

Il sistema conserva l'originale e segnala le limitazioni solo quando influenzano un workflow.

## 32. Materiale temporaneo vs patrimonio

Non tutto deve entrare permanentemente nella libreria.

Possibili categorie concettuali:

- persistente;
- temporaneo di lavoro;
- riferimento esterno;
- transitorio/amministrativo.

La retention definitiva appartiene al dossier Governance.

## 33. Materiali generati per la settimana

Gli Artifact operativi della settimana devono emergere dalla lezione e dal calendario, non dalla libreria generale.

La libreria completa serve per:

- ricerca;
- riuso;
- storico;
- confronto;
- gestione fonti/versioni.

Questa distinzione mantiene semplice la UX quotidiana.

## 34. Selezione fonti per una generazione

Il processo proposto:

```text
Teaching Context
+ Curriculum Item
+ tipo di Artifact richiesto
+ preferenze/istruzioni
        ↓
candidate locali
        ↓
valutazione copertura e gap
        ↓
eventuale ricerca esterna
        ↓
source set selezionato
        ↓
generazione
```

Il source set deve essere registrato insieme all'Artifact Version.

## 35. Set di fonti esplicito

Per ogni Artifact Version deve essere possibile sapere quali versioni di Resource/Artifact sono state effettivamente utilizzate.

Questo source set è distinto dai materiali semplicemente collegati alla classe o all'argomento.

Essere pertinente non significa essere stato usato.

## 36. Esclusioni

Il docente deve poter dire:

- non usare questa Resource;
- non usare il web;
- non usare questa versione;
- usa obbligatoriamente queste due fonti;
- cerca fuori solo per esempi.

Le esclusioni possono seguire la gerarchia Global → Subject → Class → Lesson/Test → one-off già approvata.

## 37. Qualità e fiducia

Il sistema non deve presentare una fonte come autorevole solo perché è semanticamente simile.

Autorevolezza, pertinenza, freschezza e coerenza didattica sono dimensioni separate.

Per contenuti fattuali o aggiornabili può essere necessario verificare più fonti.

Le policy precise verranno definite nei dossier Automation/AI.

## 38. Knowledge non equivale a library

Il Knowledge layer comprende più della sola libreria visibile:

- Resource persistenti;
- Artifact;
- provenance;
- versioni;
- collegamenti curricolari;
- source sets;
- riferimenti esterni usati;
- indici di ricerca;
- dipendenze.

La UI può continuare a chiamare semplicemente questa superficie "Materiali".

## 39. Foundation decisions approvate

Le seguenti decisioni sono state discusse e approvate:

1. distinguere Origin, Knowledge Resource, Resource Version e Derived Artifact;
2. trattare "fonte" anche come ruolo: un Artifact può diventare fonte di un altro Artifact;
3. separare identità del contenuto dalle sue rappresentazioni/file quando utile;
4. una Resource può avere più Origins;
5. una Resource può avere più versioni immutabili;
6. gli Artifact sono versionati e modificabili;
7. ogni Artifact Version conserva il source set esatto usato;
8. provenance e dipendenze formano un grafo ricostruibile;
9. i collegamenti a classe/materia/curriculum/lezione sono molti-a-molti;
10. la provenance del collegamento automatico/manuale deve essere preservata;
11. la deduplica distingue duplicato esatto, stessa risorsa da più origini, nuova versione e quasi duplicato;
12. merge e deduplica non sono distruttivi;
13. una variante intenzionale è un nuovo Artifact derivato, non un duplicato;
14. la ricerca locale considera sia contenuto sia contesto strutturale;
15. il ranking delle fonti non si basa sulla sola similarità semantica;
16. found / consulted / used / saved sono stati distinti della ricerca esterna;
17. una fonte esterna usata ma non salvata deve lasciare provenance sufficiente;
18. non tutto il contenuto acquisito deve diventare patrimonio permanente;
19. aggiornare una fonte crea una nuova versione e non sovrascrive la precedente;
20. parsing fallito non elimina l'originale;
21. il source set effettivamente usato è distinto dai contenuti semplicemente pertinenti;
22. il docente resta autorevole su collegamenti, merge, versioni preferite, esclusioni e salvataggio;
23. la distinzione tra identità del contenuto e sue rappresentazioni/file è una foundation concettuale, mentre lo schema tecnico delle rappresentazioni viene rimandato alla Platform Architecture;
24. nei primi checkpoint il salvataggio permanente delle fonti esterne è conservativo: una fonte usata lascia provenance, ma diventa Resource persistente solo quando richiesto o giustificato da policy esplicita.

## 40. Evolution decisions

Da rimandare:

- schema tecnico delle representation/rendition;
- algoritmo esatto di deduplicazione;
- soglie di auto-merge;
- algoritmo di semantic search;
- embedding model;
- chunking/indexing;
- ranking formula;
- provider web/search;
- strategia di snapshot delle fonti web;
- politiche di caching;
- retention;
- formati interni;
- UI dettagliata della libreria.

## 41. Edge cases da supportare

Il modello deve reggere almeno:

1. stesso PDF caricato due volte;
2. stesso documento proveniente da Teams ed email;
3. documento aggiornato mantenendo la stessa origine;
4. due documenti molto simili ma diversi;
5. artefatto modificato manualmente dopo la generazione;
6. artefatto derivato da un altro artefatto;
7. fonte web usata ma non salvata;
8. fonte web successivamente scomparsa;
9. file non parsabile;
10. stessa Resource collegata a più classi e argomenti;
11. variante semplificata che deve evolvere indipendentemente;
12. fonte aggiornata che impatta solo alcuni artefatti;
13. materiale temporaneo che non deve affollare la libreria;
14. import ambiguo che richiede inbox;
15. correzione manuale di una classificazione automatica;
16. Resource con più rappresentazioni/file;
17. contenuto generato quest'anno riusato come fonte l'anno prossimo.

## 42. Checkpoint di dominio proposto — K1: The system knows what it already has

Problema:

> Prima di generare o importare altro, il sistema deve sapere quali contenuti possiede già, da dove arrivano e a cosa sono collegati.

Scenario minimo:

1. il docente carica o importa alcuni file;
2. il sistema crea Origins e Resources;
3. rileva duplicati esatti;
4. propone classe/materia/Curriculum Item;
5. il docente può correggere i collegamenti;
6. la ricerca trova i contenuti per testo e contesto;
7. una lezione può selezionare un source set;
8. l'Artifact generato registra le fonti usate.

Nuove primitive:

- Origin;
- Knowledge Resource;
- Resource Version;
- Artifact Version;
- Context Link;
- Source Set;
- Dependency/Provenance Edge.

Non-goals:

- sincronizzazione con ogni provider;
- ricerca web avanzata;
- auto-merge sofisticato;
- knowledge graph generale;
- retention definitiva.

## 43. Metriche utili

- percentuale di import classificati senza intervento;
- percentuale di duplicati rilevati correttamente;
- falsi merge evitati/segnalati;
- tempo necessario per trovare un materiale noto;
- tasso di riuso prima della nuova generazione;
- percentuale di Artifact con source set ricostruibile;
- numero medio di interventi richiesti dall'inbox;
- percentuale di fonti esterne usate che vengono poi salvate;
- numero di rigenerazioni causate da aggiornamenti realmente rilevanti.

## 44. Decisioni aperte residue

Le scelte rimaste aperte riguardano principalmente l'evoluzione tecnica:

1. algoritmo e soglie di deduplicazione/merge automatico;
2. schema tecnico delle rappresentazioni ed export;
3. strategie di indicizzazione, chunking e semantic search;
4. formula di ranking contestuale;
5. provider e modalità di ricerca esterna;
6. politiche di caching, snapshot e retention.

## 45. Stato del dossier

Il nucleo del Dossier 04 — Knowledge & Materials è considerato **approvato e stabile per i primi checkpoint**.

Sono consolidate in particolare:
- distinzione Origin / Knowledge Resource / Resource Version / Derived Artifact;
- fonte come ruolo, non solo come tipo;
- Artifact riutilizzabile come fonte di altri Artifact;
- distinzione concettuale contenuto / rappresentazione-file;
- provenance e dependency graph ricostruibili;
- source set esatto per ogni Artifact Version;
- collegamenti contestuali molti-a-molti;
- deduplica non distruttiva;
- varianti intenzionali distinte dalle versioni;
- ricerca locale + contestuale;
- found / consulted / used / saved distinti per le fonti esterne;
- salvataggio permanente selettivo e conservativo.

Le decisioni residue sono soprattutto tecniche e non impediscono di procedere ai dossier successivi.

## 46. Aggiornamento approvato — ruoli didattici, non formati (2026-10)

Questa sezione integra e, in caso di conflitto, prevale sulle formulazioni precedenti relative ai materiali; non modifica il modello Origin / Resource / Version / Artifact.

### 46.1 Quattro ruoli didattici

- **Teacher Material:** contenuto preparato per il docente (guida, piano, copione, appunti, soluzioni riservate). Serve a preparare e condurre la lezione; non è automaticamente valutabile.
- **Student Material:** contenuto canonico destinato allo studio degli studenti. La versione effettivamente pubblicata/consegnata costituisce la base ordinaria per stabilire ciò che è valutabile.
- **Support Material:** esercizi, esempi, file dimostrativi, database, dataset, strumenti o risorse complementari. Non è valutabile per semplice associazione a una lezione.
- **Assessable Material:** *ruolo autorizzativo esplicito*, non un quarto formato o tipo di file. Raccoglie la versione di Student Material pubblicata e gli eventuali Support Material dichiarati valutabili dal docente e messi a disposizione degli studenti nei termini previsti.

I ruoli sono indipendenti da formato, canale d'origine e classe tecnica della risorsa. Una stessa Resource/Artifact Version può essere collegata a più contesti e ruoli, mantenendo identità, lineage, stato e versioni. L'assegnazione di un ruolo non pubblica né rende valutabile una risorsa: servono un atto/stato di disponibilità e, quando necessario, l'autorizzazione didattica.

### 46.2 Formato e rappresentazione sono ortogonali

PDF, Markdown, testo, HTML, DOCX, immagini, pagine web, XLSX e altri formati sono mezzi di acquisizione/rappresentazione, non categorie di contenuto didattico. Parser e adapter sono selezionati secondo il contenuto tecnico reale; l'orchestrazione didattica opera sui ruoli e sulle versioni normalizzate, non su un workflow privilegiato per Excel o per qualunque altra estensione. XLSX resta un caso utile per la regressione di tabelle e file tecnici, non il caso guida del prodotto.

### 46.3 Provenance e contenuto generato

Per ogni affermazione derivata da una fonte (*source-specific fact*), conservare riferimenti verificabili alla Resource/Artifact Version e al passaggio che la supporta. Non inventare valori, citazioni, coordinate, definizioni o dettagli assenti per completare una bozza. Se una fonte è insufficiente, il sistema deve segnalare il gap, richiedere un'integrazione oppure usare un'altra fonte autorizzata tracciandola. Un esempio pedagogico o conoscenza generale aggiunta può essere utile a una lezione, ma deve essere riconoscibile come integrazione e non falsamente attribuito al materiale caricato.

Una generazione non acquisisce automaticamente lo stato pubblicato. Modifiche e approvazione del docente determinano la versione canonica distribuita; le future rigenerazioni non cancellano tale versione né gli interventi manuali.

### 46.4 Vincolo di valutabilità

Per gli Assessment, **concetti e prerequisiti necessari** a risolvere ogni Item devono essere coperti dalla versione Student Material distribuita o da Support Material esplicitamente valutabile e disponibile. Il Teacher Material privato e le altre fonti non diventano automaticamente valutabili. Traccia richiesta: *Item → concetto/competenza/prerequisiti → sezione/evidenza semantica valutabile → versione → stato di disponibilità*. Una risposta non deve comparire letteralmente nella dispensa: sono leciti problemi nuovi risolvibili con competenze insegnate. Un generico link curricolare o la mera similarità lessicale non bastano.

Queste regole sono **foundation decisions approvate**; la forma dello schema, degli adapter e della UI resta materia dell'architettura tecnica.

## 47. Decisione integrativa — affidabilità senza letteralismo (2026-10-09)

**Principio approvato:** verificare la verità e il perimetro didattico, non imporre che output, esempi, formule o parole riproducano la fonte. Evitare tanto l'invenzione fattuale quanto la rigidità dei precedenti benchmark orientati a coordinate Excel.

### 47.1 I tre passaggi didattici

1. **Fonti → Teacher Material:** generare spiegazioni accurate dalle fonti realmente consultate e, dove appropriato, da conoscenza disciplinare generale consolidata del modello. È ammesso usare ricerca web quando utile/autorizzata. Affermazioni specifiche, aggiornabili, contestabili o dubbie richiedono verifica con fonti attendibili; la knowledge parametrica del modello, da sola, non è una certificazione indipendente. Non inventare fonti, fatti, riferimenti o dettagli presentati come veri. Sono lecite analogie, esempi, approfondimenti e proposte originali, purché corretti e distinti da ciò che era effettivamente nella fonte.
2. **Teacher Material → Student Material:** creare dispense coerenti con ciò che è stato effettivamente spiegato/confermato dal docente, senza introdurre nuovi argomenti sostanziali o prerequisiti non trattati. Consentire sintesi, riordino, semplificazione, spiegazioni equivalenti, approfondimenti esplicativi ed esempi diversi. Una bozza di copione non prova da sola che l'argomento sia stato trattato: il docente mantiene l'autorità sulla copertura effettiva. Se servono nozioni aggiuntive, proporre l'integrazione e richiedere revisione.
3. **Student Material pubblicato + Support valutabile → Assessment:** la prova deve richiedere competenze e prerequisiti insegnati, ma può presentare nuovi contesti, dati ipotetici esplicitamente definiti, casi applicativi, confronti, deduzioni e rielaborazioni; non deve limitarsi alla riproduzione letterale dei testi.

### 47.2 Precisione proporzionata al compito

- Le cinque classi epistemiche restano distinte: `SOURCE_FACT`, `SOURCE_SPECIFIC_DETAIL`, `SOURCE_DERIVED`, `GENERAL_DOMAIN_KNOWLEDGE`, `PEDAGOGICAL_PROPOSAL`. Non attribuire conoscenza generale o esempi originali alla fonte. Non richiedere un classificatore frase-per-frase o coordinate per affermazioni che non pretendono di descrivere un file specifico.
- **Rigorosi quando serve:** se si dichiara una cella reale, un dato, un risultato calcolato, una citazione o un fatto tecnico specifico, controllarlo. **Flessibili quando è meglio:** non costringere un copione di introduzione a Excel ad avere indirizzi di cella, né una verifica a ripetere frasi delle dispense.
- Contraddizioni, falsi riferimenti, errori sostanziali o conoscenze richieste agli studenti senza copertura restano violazioni gravi. Parafrasi accurate e nuovi esempi applicativi non sono violazioni.

### 47.3 Formati non vincolanti

Si prevedono spesso PDF/Markdown/HTML (anche con websearch) per il docente, PDF per dispense studenti e HTML/PDF per verifiche. Sono preferenze operative, non vincoli di sorgente, formato o architettura. Il contenuto ha identità e ruolo indipendenti dalla sua rappresentazione.

### 47.4 Qualità multidimensionale

Distinguere **affidabilità fattuale**, **copertura degli obiettivi/prerequisiti**, **qualità pedagogica/rielaborazione** e **lavoro reale di editing del docente**. Il matching testuale, la sola sovrapposizione fra documenti o i controlli specializzati di spreadsheet non sostituiscono queste valutazioni. Benchmark storici e loro metriche rimangono immutati; i prossimi test devono includere sia parafrasi/applicazioni legittime sia allucinazioni e prerequisiti indebiti.

## 48. Chiarimento lifecycle — preparazione anticipata e uso effettivo (C11, 2026-10-10)

La preparazione dei materiali non è subordinata allo svolgimento della lezione. Il docente può creare, revisionare e approvare versioni draft di Teacher Material, Student Material e Assessment in anticipo, sulla base del piano e delle competenze previste. L'approvazione di preparazione è legata alla versione esatta e non equivale a conferma di copertura effettiva, pubblicazione, disponibilità agli studenti o autorizzazione alla somministrazione.

Le regole delle §§46.4 e 47 restano invariate per l'uso: prima dell'impiego, ogni item deve essere riconciliato con i prerequisiti realmente affrontati e con l'esatta versione Student Material distribuita/disponibile, oltre agli eventuali Support Material esplicitamente valutabili. Le discrepanze tra Planned e Actual Study Plan bloccano gli item interessati fino a revisione o esclusione esplicita. Le revisioni generano nuove versioni; approvazioni precedenti non si trasferiscono automaticamente.

Questa integrazione chiarisce il lifecycle senza trasformare bozze non pubblicate in Assessable Material e senza modificare le evidenze o i contratti storici C9/C10.

