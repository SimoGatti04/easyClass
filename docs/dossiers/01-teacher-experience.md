# Dossier 01 — Teacher Experience

## 1. Domanda centrale

Come deve apparire il lavoro quotidiano del docente quando quasi tutto il lavoro extra-lezione è già stato preparato dal sistema?

La risposta non può essere semplicemente "una dashboard più bella".

Dobbiamo ridurre:
- tempo operativo;
- decisioni ripetitive;
- navigazione;
- preparazione;
- controllo inutile;
- ricostruzione mentale del contesto.

## 2. Obiettivo UX

Il servizio deve diventare il **punto unico di lavoro del docente**, anche quando i dati originali vivono altrove.

Il sistema deve poter aggregare, manualmente o automaticamente dove possibile:
- email;
- calendari;
- PDF e documenti;
- regolamenti e circolari;
- Teams e piattaforme scolastiche;
- materiali didattici;
- piani di studio;
- verifiche e correzioni;
- note del docente;
- altre fonti future.

Il docente non deve ricordarsi in quale servizio si trova un'informazione prima di poter lavorare.

Deve interagire principalmente con:

1. **ciò che sta per succedere**;
2. **ciò che richiede una decisione**;
3. **ciò che il sistema ha già completato**;
4. **eccezioni**;
5. **un contesto aggregato e ricercabile proveniente da tutte le fonti disponibili**.

Il resto deve essere accessibile ma non dominante.

## 3. Principio di semplicità e priorità

La UI deve rimanere semplice, leggibile e priva di tecnicismi.

Il sistema può essere complesso internamente, ma il docente non deve percepirne la complessità.

La gerarchia dell'interfaccia deve seguire principalmente:
1. frequenza d'uso;
2. urgenza;
3. contesto corrente.

Quindi ciò che viene usato ogni giorno deve essere immediatamente accessibile:
- lezioni di oggi e della settimana;
- materiali necessari;
- classi;
- verifiche imminenti;
- attività che richiedono attenzione.

Elementi importanti ma meno frequenti devono restare a un livello secondario:
- programma annuale;
- voti e medie;
- storico;
- configurazioni;
- report;
- archivi.

Il fatto che un'informazione sia importante non significa che debba occupare spazio permanente nella home.

La home deve rispondere principalmente a:
- cosa devo fare oggi?
- cosa devo preparare o controllare questa settimana?
- cosa sta arrivando?
- c'è qualcosa che richiede il mio intervento?

Il linguaggio visibile deve essere naturale e scolastico. Termini tecnici come `TeachingContext`, `Artifact`, `ReviewItem`, workflow, job, confidence o provenance possono esistere internamente ma non devono comparire nell'esperienza normale del docente.

## 4. Modello mentale corretto

### Modello tradizionale

```text
Classe
→ Materiali
→ Verifiche
→ Compiti
→ Studenti
→ Comunicazioni
```

Richiede al docente di trasformare intenzioni in operazioni software.

### Modello target

```text
Cosa devo fare adesso?
Cosa succede dopo?
Cosa richiede il mio controllo?
Cosa è già stato fatto?
```

Il sistema traduce poi queste necessità nelle entità sottostanti.

## 5. Superfici principali

Proponiamo inizialmente sei superfici concettuali.

### A. Context Hub

È il livello di aggregazione delle informazioni.

Non deve necessariamente apparire come una "cartella documenti". Il suo scopo è far sì che tutto ciò che entra nel sistema possa essere:
- ricercato;
- collegato a docente, materia, classe, periodo, unità o attività;
- usato come fonte;
- versionato;
- tracciato fino all'origine;
- aggiornato se la fonte cambia.

Le fonti possono entrare:
- manualmente;
- tramite upload;
- tramite inoltro/import;
- tramite connector/sync quando disponibile;
- tramite acquisizione automatica configurata.

Gli elementi non classificabili automaticamente finiscono in una piccola inbox di importazione, non in un archivio opaco.

### B. Home / Questa settimana

Centro operativo principale.

La home deve avere come orizzonte normale **la settimana corrente**, evidenziando naturalmente ciò che accade oggi senza limitarsi alla giornata.

Contiene:
- lezioni della settimana, con priorità a oggi e alla prossima lezione;
- materiali pronti;
- verifiche imminenti;
- eventi e scadenze;
- attività che richiedono controllo;
- variazioni rilevanti rispetto al piano.

Il riepilogo delle automazioni completate deve essere discreto e non occupare spazio se non produce conseguenze utili per il docente.

### C. Class Workspace

La classe applica lo stesso principio della home generale: **prima ciò che serve spesso e adesso, poi il dettaglio completo**.

Lo spazio operativo principale deve essere contestualizzato a **classe + materia**, perché lezioni, programma, materiali e verifiche dipendono dalla materia. Se un docente insegna più materie alla stessa classe, deve poter passare facilmente da una materia all'altra senza confondere i relativi dati.

#### Overview della classe/materia

La prima schermata non deve essere una collezione di tabelle o statistiche. Deve sintetizzare:

- prossima lezione;
- materiale già pronto;
- lezioni recenti;
- verifiche imminenti;
- attività che richiedono controllo;
- stato sintetico del percorso;
- eventuali note recenti;
- studenti che richiedono attenzione solo quando rilevante.

Esempio concettuale:

```text
4B · Informatica

PROSSIMA LEZIONE
Martedì 10:00 · JOIN SQL
Materiale docente pronto
Scheda studenti pronta
[Apri lezione]

ULTIME LEZIONI
✓ SELECT e WHERE
✓ GROUP BY
✓ Subquery

VERIFICHE
18 ottobre · SQL
Bozza pronta

DA CONTROLLARE
2 consegne
1 studente con difficoltà ricorrenti

PERCORSO
Previsto: JOIN
Svolto: Subquery
Nessun ritardo significativo
```

#### Sezioni di dettaglio

Devono essere immediatamente raggiungibili ma secondarie rispetto all'overview:

- **Lezioni** — calendario, lezioni passate/future, Lesson Plan, Teacher Script, stato svolgimento.
- **Materiali** — fonti, materiali docente, materiali studenti, allegati e versioni.
- **Verifiche** — programmate, bozze, svolte, correzioni e risultati.
- **Studenti** — elenco, situazione individuale, attività e segnali rilevanti.
- **Voti** — valutazioni, medie, andamento e revisioni.
- **Programma** — piano previsto, piano svolto, scostamenti e ripianificazione.
- **Annotazioni** — note libere del docente collegate a classe, lezione, studente o periodo.
- **Attività/Consegne** — compiti, esercitazioni, consegne e stato.
- **Comunicazioni** — messaggi e comunicazioni pertinenti alla classe.

L'ordine e la prominenza delle sezioni possono adattarsi all'uso, ma la navigazione deve rimanere stabile e prevedibile.

#### Regola UX

Una sezione di dettaglio non deve diventare una dashboard permanente nella home della classe solo perché contiene dati importanti.

Esempi:
- voti e medie restano secondari durante il normale lavoro settimanale;
- il programma emerge quando serve ripianificare;
- gli studenti emergono quando c'è un motivo concreto per attirare l'attenzione;
- le verifiche diventano prominenti quando sono imminenti;
- lezioni e materiali restano invece quasi sempre centrali.

#### Navigazione contestuale

Quando il docente entra da un oggetto specifico, deve mantenere il contesto.

Esempio:

```text
4B · Informatica
  → Verifica SQL
      → Correzione Rossi
```

Il ritorno deve riportare al punto logico precedente, non costringere a ricostruire la navigazione.

#### Relazione tra overview e sezioni

L'overview non duplica tutto il contenuto delle sezioni.

Mostra solo:
- stato;
- prossima azione;
- eccezioni;
- scorciatoie verso il dettaglio.

Le sezioni contengono invece la gestione completa.

### D. Review Inbox

Unica coda per tutto ciò che richiede intervento umano.

Esempi:
- verifica pronta;
- correzione incerta;
- comunicazione da approvare;
- conflitto di calendario;
- materiale con fonte insufficiente;
- proposta di recupero.

### E. Planning

Vista temporale:
- settimana;
- unità;
- periodo;
- anno.

Serve più al controllo della traiettoria che alla microgestione quotidiana.

### F. Ask / Command

Interfaccia naturale globale:
- "sposta la verifica della 4A a venerdì";
- "fammi vedere perché hai dato 6 a Rossi";
- "riduci gli esercizi di domani";
- "preparami una versione più semplice della scheda".

Non deve sostituire le superfici strutturate.

## 6. Home settimanale — esperienza dettagliata

La schermata iniziale deve essere leggibile in pochi secondi e orientata alla settimana.

Esempio:

```text
QUESTA SETTIMANA

OGGI
08:00 · 3A Informatica
Routing statico
Materiale pronto
[Apri lezione]

10:00 · 5B Sistemi
Verifica TCP/IP
1 elemento da controllare
[Controlla]

DOMANI
09:00 · 4C Informatica
Laboratorio SQL
Materiale pronto

GIOVEDÌ
4B · Verifica SQL
Bozza pronta

────────────────────────────

DA CONTROLLARE · 3

2 correzioni incerte
1 verifica da approvare

────────────────────────────

LE MIE CLASSI
3A · 4B · 4C · 5B
```

Le attività completate automaticamente senza problemi restano nello storico e non devono occupare la home.

### Decisione importante

Il docente non deve aprire un modulo "lezioni" per sapere cosa fare.

Le lezioni sono **oggetti operativi temporali già contestualizzati** e devono emergere naturalmente nella settimana di lavoro.

## 7. Lesson View

È probabilmente la superficie più utilizzata durante la giornata.

Deve avere due modalità.

### Before lesson

La lezione deve essere preparata dal sistema sulla base di:
- calendario;
- piano di studi previsto;
- piano effettivamente svolto;
- fonti e materiali disponibili;
- modifiche recenti del docente;
- eventuali vincoli della classe.

Il lesson pack deve distinguere chiaramente almeno tre oggetti diversi:

#### 1. Lesson Plan
Struttura operativa della lezione:
- obiettivi;
- prerequisiti;
- durata;
- sequenza;
- esempi;
- attività;
- esercizi;
- punti critici;
- cosa pubblicare dopo.

#### 2. Teacher Script
Materiale **per il docente**, non per lo studente.

Deve poter essere molto lungo, completo e dettagliato, fino a essere quasi verbatim: il professore deve poterlo seguire o leggere quasi integralmente per sostenere anche lezioni di diverse ore.

Non è quindi un semplice riassunto o una scaletta.

Deve includere, secondo configurazione:
- spiegazione estesa;
- transizioni tra argomenti;
- esempi spiegati passo passo;
- definizioni;
- approfondimenti;
- domande da porre;
- possibili risposte degli studenti;
- errori frequenti;
- chiarimenti alternativi;
- indicazioni su quando passare ad attività o esercizi.

La lunghezza deve derivare dalla durata prevista e dal livello di dettaglio scelto, non da un limite fisso arbitrario.

#### 3. Student Material
Materiale eventualmente destinato agli studenti:
- sintesi;
- schede;
- slide;
- esercizi;
- consegne;
- riferimenti.

Teacher Script e Student Material non devono essere la stessa cosa né semplici trasformazioni cosmetiche dello stesso testo.


La preparazione può avvenire in anticipo: il docente può preparare e revisionare versioni draft di Teacher Material, Student Material e Assessment sulla base del piano previsto. Le approvazioni di preparazione sono version-bound e attestano soltanto la revisione di quelle bozze; non attestano che la lezione sia stata svolta, che i concetti siano stati effettivamente affrontati, né che il materiale sia stato distribuito o che la verifica sia pronta all'uso. Questi stati si registrano separatamente dopo i rispettivi eventi.

### During lesson

Interfaccia ridotta e veloce.

Azioni:
- completato;
- non completato;
- serve più tempo;
- troppo facile;
- troppo difficile;
- annotazione rapida;
- voce → nota;
- cambia attività.

L'obiettivo è catturare il minimo feedback necessario per aggiornare automaticamente il futuro.

### After lesson

Non deve esserci un obbligo di compilare un report.

Il sistema deriva lo stato dai segnali raccolti.

Se mancano informazioni importanti, può porre una domanda estremamente breve:

> Hai completato il subnetting?

`Sì` / `Parzialmente` / `No`

## 8. Review Inbox

È uno dei concetti da rendere foundation.

Qualunque workflow può produrre un `ReviewItem`.

Campi concettuali:
- cosa richiede attenzione;
- perché;
- impatto;
- confidence;
- contesto;
- azione consigliata;
- scadenza;
- possibilità di batch action.

Tipologie:
- approval;
- exception;
- conflict;
- low confidence;
- anomaly;
- policy requirement.

### Obiettivo

Non mostrare 100 cose "da controllare".

Mostrare solo ciò che non può essere completato con sufficiente affidabilità secondo le policy del docente.

## 9. Progressive disclosure

La UX deve avere almeno tre livelli.

### Livello 1 — decisione
```text
2 correzioni richiedono controllo
```

### Livello 2 — sintesi
```text
La risposta di Rossi è borderline sul criterio 3.
```

### Livello 3 — evidenze
```text
rubrica
risposta
evidenze
punteggio per criterio
modello/checker
```

Questo permette semplicità senza perdere trasparenza.

## 10. One-click operations

Azioni standard condivise in tutto il prodotto:

- Approva
- Modifica
- Rigenera
- Rigenera con istruzione
- Rifiuta
- Confronta
- Rimanda
- Applica a casi simili
- Salva come preferenza

Il significato deve essere coerente ovunque.

## 11. Batch supervision

Per ridurre davvero il lavoro, molte revisioni devono essere raggruppabili.

Esempio:

```text
23 feedback generati

20 high confidence
3 require review

[Approva i 20]
```

Non costringere il docente ad aprire 23 schermate.

## 12. Notification philosophy

Le notifiche devono essere rare.

Categorie:
- serve intervento entro breve;
- automazione bloccata;
- problema ad alto impatto.

Non notificare:
- generazione completata normalmente;
- ogni consegna ricevuta;
- ogni job completato.

Queste informazioni vanno nel digest/activity log.

## 13. Search vs navigation

Un servizio complesso non può dipendere solo dalla navigazione gerarchica.

Serve ricerca globale per:
- studente;
- classe;
- materiale;
- verifica;
- argomento;
- lezione;
- concetto.

E comandi naturali per query semantiche:

> "Fammi vedere le verifiche sul subnetting dell'anno scorso."

## 14. User intervention cost

Ogni workflow deve misurare il costo umano richiesto.

Possibile classificazione:

- 0 azioni;
- 1 click;
- review rapida;
- modifica;
- lavoro sostanziale.

Una feature può essere tecnicamente automatizzata ma UX-inefficiente se genera troppe revisioni.

## 15. Uncertainty UX

Il sistema non deve fingere certezza.

Ma non deve nemmeno scaricare complessità sul docente.

Esempio buono:

```text
Richiede controllo

La risposta soddisfa chiaramente 3 criteri su 4.
Il criterio "motivazione" è ambiguo.

Punteggio proposto: 7/10

[Conferma 7] [Apri dettaglio]
```

## 16. Failure UX

Se qualcosa fallisce, la comunicazione deve essere orientata al risultato.

Non:
```text
Job generation_423 failed.
```

Ma:
```text
La scheda per la 3A non è ancora pronta.
Non sono riuscito a leggere 4 pagine del PDF.

[Usa comunque il resto]
[Sostituisci file]
[Riprova]
```

## 17. Trust model

La fiducia si costruisce attraverso:
- risultati prevedibili;
- fonti visibili;
- spiegazioni quando servono;
- possibilità di correggere;
- nessuna azione irreversibile nascosta;
- capacità di apprendere preferenze esplicite;
- cronologia.

## 18. Teacher preferences UX

Non vogliamo una pagina impostazioni con centinaia di opzioni come unico metodo.

Tre modi di configurare:

### Setup esplicito
Preferenze iniziali.

### Contextual settings
Modifica mentre si usa una funzione.

### Preference suggestions
Il sistema osserva modifiche ripetute e propone:

```text
Nelle ultime 5 verifiche hai ridotto
le domande a scelta multipla.

Vuoi usare massimo 2 per default
nelle verifiche della 4A?
```

Il docente decide.

## 19. Planned vs Actual Study Plan

Il sistema deve distinguere in modo esplicito:

### Planned Study Plan
Ciò che si prevede di svolgere durante l'anno.

Può derivare da:
- programma ministeriale/istituzionale;
- piano del docente;
- calendario scolastico;
- ore disponibili;
- materiali adottati.

### Actual Study Plan
Ciò che è stato realmente svolto.

Si aggiorna progressivamente attraverso:
- lezioni completate;
- indicazioni del docente;
- contenuti saltati;
- approfondimenti;
- recuperi;
- variazioni del calendario;
- modifiche manuali.

I due piani non devono essere sovrascritti l'uno dall'altro.


La preparazione anticipata di dispense e Assessment Draft può riferirsi al **Planned Study Plan** e alle versioni previste dei materiali. Prima della somministrazione, la valutabilità deve però essere riconciliata con l'**Actual Study Plan** e con la versione Student Material effettivamente resa disponibile. Una differenza tra previsto e svolto deve identificare gli item coinvolti e richiedere revisione/esclusione; non modifica retroattivamente le approvazioni o le versioni già registrate.

Il sistema deve poter mostrare:
- previsto;
- svolto;
- scostamento;
- conseguenze future;
- eventuale ripianificazione proposta.

Questa distinzione è fondamentale anche per le verifiche: **per default una verifica deve essere generata sulla base di ciò che risulta realmente affrontato, non semplicemente di ciò che era previsto**.

## 20. Editable canonical state e propagazione delle modifiche

Tutto deve rimanere liberamente modificabile dal docente:
- calendari;
- lezioni;
- piani;
- fonti;
- materiali;
- verifiche;
- rubriche;
- correzioni;
- risultati;
- configurazioni.

Una modifica manuale non deve "rompere l'automazione".

Il modello concettuale deve distinguere:

```text
FONTI
  ↓
STATO CANONICO MODIFICABILE
  ↓
ARTEFATTI DERIVATI
```

Esempio:

```text
Piano previsto
      +
Lezioni svolte
      +
Fonti
      ↓
Lesson 12
      ↓
Teacher Script
      ↓
Esercizi
      ↓
Verifica
```

Se il docente modifica Lesson 12 dichiarando che un argomento non è stato trattato, il sistema deve poter determinare quali elementi a valle sono diventati obsoleti.

Non deve necessariamente rigenerare tutto senza chiedere: deve applicare la policy configurata, ad esempio:
- rigenera automaticamente;
- prepara una nuova versione;
- segnala l'impatto;
- chiede approvazione.

Ogni modifica significativa deve quindi creare una nuova versione o revisione tracciabile.

Il sistema deve conoscere le **dipendenze tra oggetti** per poter effettuare una rielaborazione selettiva invece di rigenerare indiscriminatamente tutto.

## 21. Materiali — esperienza docente

### 21.1 Principio

Il sistema deve trattare i materiali come **contenuti provenienti da fonti diverse che vengono automaticamente raccolti, compresi, collegati e resi riutilizzabili**.

Il docente non deve diventare il bibliotecario del sistema.

Dove possibile l'acquisizione deve essere automatica; dove non è possibile, l'import manuale deve essere estremamente semplice.

### 21.2 Modi di ingresso

I materiali possono entrare nel sistema tramite:

- sincronizzazione automatica da servizi collegati;
- import periodico configurato;
- acquisizione da email o allegati;
- import da calendari/eventi quando contengono materiali;
- import da piattaforme scolastiche o collaborative quando tecnicamente possibile;
- upload manuale;
- drag & drop;
- incolla testo;
- incolla link;
- inoltro/condivisione verso il servizio;
- creazione diretta nel sistema.

La UX deve rendere questi canali equivalenti dal punto di vista finale: una volta entrato, il materiale viene trattato nello stesso modo indipendentemente dall'origine.

### 21.3 Inbox di acquisizione

Quando il sistema importa automaticamente qualcosa ma non è sufficientemente sicuro del contesto, non deve:
- scartarlo;
- classificarlo arbitrariamente;
- interrompere il docente con una richiesta immediata.

Deve inserirlo in una piccola **inbox di materiali da sistemare**, proponendo già:
- classe;
- materia;
- argomento;
- tipo;
- eventuale relazione con una lezione.

Esempio:

```text
3 nuovi materiali

PDF · "Routing dinamico"
Probabile destinazione: 4B · Sistemi
[Conferma]

Allegato email · "Indicazioni laboratorio"
Probabile destinazione: 3A · Informatica
[Conferma]

Documento non classificato
[Scegli dove metterlo]
```

L'obiettivo è che la maggior parte degli elementi richieda un solo click, o nessuno se la policy permette l'auto-classificazione.

La classificazione proposta o applicata automaticamente non è mai definitiva: il docente deve poterla correggere in qualsiasi momento con la stessa semplicità con cui modifica un materiale.

Lo stesso vale per i file caricati manualmente: il sistema propone la classificazione, ma il docente può confermarla, modificarla o lasciare il materiale volutamente generico.

### 21.4 Organizzazione automatica

Il docente non dovrebbe creare manualmente decine di cartelle.

Il sistema deve poter collegare un materiale automaticamente a:
- classe;
- materia;
- unità;
- argomento;
- lezione;
- verifica;
- periodo;
- autore/origine;
- eventuali studenti o gruppi quando rilevante.

Uno stesso materiale può essere collegato a **più contesti contemporaneamente senza duplicazione fisica**.

Esempi:
- lo stesso PDF può essere usato in 3A e 4A;
- una dispensa può essere pertinente a due materie;
- un esercizio può essere collegato a più lezioni;
- un regolamento può essere valido per tutte le classi;
- una fonte può essere generica e non essere collegata a nessuna classe o lezione finché non serve.

Di conseguenza il modello non deve essere basato sul concetto rigido di "materiale dentro una cartella", ma su un'identità unica del materiale e su relazioni modificabili con i diversi contesti.

La classificazione deve quindi funzionare come insieme di **collegamenti**, non come collocazione esclusiva.

Il docente deve poter:
- aggiungere un collegamento;
- rimuoverlo;
- sostituirlo;
- collegare lo stesso materiale altrove;
- lasciare un materiale generico;
- correggere qualunque collegamento creato automaticamente.

Queste operazioni non devono creare copie del file salvo quando il docente chiede esplicitamente una variante indipendente.

### 21.5 Fonte vs materiale generato

Va mantenuta una distinzione chiara tra:

#### Fonte
Contenuto originale acquisito:
- PDF;
- email;
- pagina;
- documento;
- presentazione;
- video;
- nota;
- regolamento.

#### Materiale derivato
Contenuto prodotto dal sistema a partire dalle fonti:
- Teacher Script;
- scheda studenti;
- riassunto;
- esercizi;
- slide;
- verifica;
- soluzione;
- glossario.

Questa distinzione deve esistere internamente anche se la UI la presenta in modo semplice.

Il docente deve poter capire facilmente:
- da dove deriva un materiale;
- quali fonti sono state usate;
- se una fonte è stata aggiornata;
- quali materiali potrebbero dover essere rielaborati.

### 21.6 Provenienza visibile ma non invasiva

La provenance non deve essere mostrata come metadato tecnico.

Esempio:

```text
Materiale docente · Routing

Basato su:
• Libro di testo — cap. 7
• PDF "Routing dinamico"
• Appunti del 12 ottobre

[Mostra fonti]
```

Il dettaglio completo appare solo su richiesta.

### 21.7 Materiali della settimana

Questa deve essere una delle viste più importanti.

Il docente deve poter vedere rapidamente:

```text
QUESTA SETTIMANA

4B · Informatica
Martedì · JOIN SQL
✓ Materiale docente
✓ Scheda studenti
✓ 6 esercizi

5A · Sistemi
Mercoledì · Routing
✓ Materiale docente
! Slide da controllare

3A · Informatica
Venerdì · HTML
Preparazione in corso
```

La vista deve essere orientata alla lezione, non all'archivio.

### 21.8 Libreria materiali

Deve comunque esistere una libreria completa per:
- cercare;
- filtrare;
- riusare;
- confrontare versioni;
- vedere fonti;
- trovare materiale storico.

Ma non deve essere il punto di ingresso quotidiano.

### 21.9 Riutilizzo intelligente

Il sistema deve riconoscere quando esiste già materiale pertinente.

Prima di generare da zero può proporre:

```text
Hai già materiale su questo argomento:

• Routing statico — 4B, anno scorso
• Routing — dispensa
• 8 esercizi già usati

Vuoi:
[Riutilizzare]
[Aggiornare]
[Generare nuovo]
```

Il default può essere configurabile.

### 21.10 Aggiornamento delle fonti

Se una fonte cambia, il sistema deve capire quali materiali derivati ne dipendono.

Esempio:

```text
Il documento "Regolamento laboratorio"
è stato aggiornato.

Potrebbero essere da aggiornare:
• scheda laboratorio 3A
• istruzioni sicurezza 4B

[Controlla modifiche]
```

Non deve rigenerare tutto indiscriminatamente.

### 21.11 Modifica manuale

Ogni materiale generato deve poter essere:
- modificato direttamente;
- rigenerato in parte;
- esteso;
- accorciato;
- adattato a una classe;
- duplicato come nuova variante;
- collegato a nuove fonti.

Le modifiche manuali diventano parte dello stato corretto del materiale e non devono essere perse nelle successive rielaborazioni.

### 21.12 Ricerca

La ricerca deve essere globale e semantica, ma semplice nel linguaggio.

Esempi:

- "materiale sulle JOIN";
- "PDF usato nella 4B a ottobre";
- "esercizi di subnetting dell'anno scorso";
- "regolamento laboratorio";
- "materiale che parla di sicurezza informatica".

I risultati devono mostrare contesto e origine, non solo nomi file.

### 21.13 Materiali duplicati

Il sistema deve rilevare possibili duplicati e versioni simili, soprattutto perché lo stesso contenuto può arrivare contemporaneamente da import automatici, upload manuali e servizi diversi.

La deduplicazione deve distinguere almeno:

- **duplicato esatto** — stesso contenuto;
- **stessa risorsa, origine diversa** — lo stesso documento importato da più servizi;
- **versione successiva** — documento aggiornato;
- **quasi duplicato** — contenuto molto simile ma non necessariamente equivalente.

Non deve eliminare automaticamente contenuti senza supervisione quando esiste ambiguità.

Quando è sicuro che si tratta della stessa risorsa, il sistema dovrebbe preferire un'unica identità logica mantenendo più riferimenti di origine, invece di mostrare più copie al docente.

Esempio:

```text
Regolamento laboratorio

Disponibile da:
• allegato email
• Teams
• upload manuale
```

Il docente vede una sola risorsa, mentre il sistema conserva le diverse origini.

Nel caso di versioni diverse, deve invece preservare lo storico e identificare quale è la più recente senza distruggere le precedenti.

### 21.14 Materiali esterni temporanei

Non tutto ciò che entra deve diventare patrimonio permanente.

Serve distinguere tra:
- fonte stabile;
- materiale temporaneo per una lezione;
- documento amministrativo;
- comunicazione;
- allegato transitorio.

La retention e l'archiviazione verranno definite nel dossier governance, ma la UX deve evitare che ogni allegato diventi rumore permanente.

### 21.15 Selezione delle fonti per la generazione

Quando il sistema genera un materiale non deve trattare tutte le fonti come equivalenti.

La selezione deve combinare:

1. **regole strutturali**;
2. **rilevanza per il contesto**;
3. **autorevolezza/preferenza della fonte**;
4. **istruzioni esplicite del docente**.

Esempio di base:

```text
priorità alta
• materiale scritto dal docente
• libro adottato
• documenti indicati esplicitamente

priorità media
• materiale già usato con quella classe/materia
• dispense interne
• fonti scolastiche pertinenti

priorità bassa/opzionale
• materiale esterno
• web
• fonti generiche
```

Questa gerarchia deve essere configurabile e non assoluta.

### 21.16 Istruzioni di generazione ereditarie

Il docente deve poter aggiungere istruzioni specifiche che influenzano:
- quali fonti usare;
- quali evitare;
- stile;
- profondità;
- struttura;
- livello;
- esempi;
- terminologia;
- formato;
- approccio didattico.

Le istruzioni devono poter esistere a più livelli:

```text
Globali
  ↓
Materia
  ↓
Classe
  ↓
Lezione
  ↓
Richiesta puntuale
```

Le istruzioni più specifiche prevalgono su quelle più generali quando sono in conflitto.

Esempio:

```text
Globale:
"Preferisci sempre materiali miei rispetto a fonti esterne."

Materia Informatica:
"Usa esempi pratici e codice."

Classe 4B:
"Spiega in modo più graduale e con molti esempi."

Lezione JOIN SQL:
"Usa obbligatoriamente il PDF join-esempi.pdf e non usare materiale web."
```

Il risultato finale mantiene quindi una base algoritmica prevedibile, ma resta altamente adattabile.

### 21.17 Istruzioni persistenti vs una tantum

Ogni istruzione deve poter essere chiaramente applicata come:

- solo questa volta;
- questa lezione;
- questa classe;
- questa materia;
- globale.

Il sistema non deve trasformare automaticamente ogni richiesta occasionale in una preferenza permanente.

Esempio:

> "Per questa lezione evita esempi troppo complessi."

non deve diventare una regola globale.

Al contrario:

> "Con la 4B usa sempre esempi molto guidati."

può essere salvato come preferenza di classe.

### 21.18 Trasparenza minima

Il docente deve poter capire facilmente perché una certa fonte è stata usata o esclusa, senza vedere dettagli tecnici.

Esempio:

```text
Fonti usate:
• Appunti docente
• Libro adottato, cap. 6
• PDF JOIN esempi

Non usate:
• materiale web — escluso dalle preferenze della lezione
```

### 21.19 Riutilizzo dello stesso modello nelle verifiche

Lo stesso paradigma dovrà essere riutilizzato anche per le verifiche:

```text
regole strutturali
+
fonti selezionate
+
programma effettivamente svolto
+
preferenze globali
+
preferenze materia
+
preferenze classe
+
istruzioni della verifica
```

In questo modo materiali e verifiche condividono lo stesso modello concettuale di configurazione, pur avendo generatori e criteri diversi.

### 21.20 Ricerca esterna come capacità nativa

Il sistema deve poter cercare autonomamente materiale non ancora presente nel servizio.

Questa non è una funzione di emergenza, ma una capacità ordinaria del prodotto.

Le fonti esterne possono includere, secondo disponibilità e configurazione:
- web pubblico;
- siti istituzionali;
- documentazione tecnica;
- repository e archivi;
- risorse educative aperte;
- servizi collegati;
- librerie o basi documentali accessibili;
- altre fonti future.

Il sistema deve poter decidere quando cercare fuori dal patrimonio locale, per esempio quando:
- le fonti disponibili sono insufficienti;
- manca copertura su un argomento;
- serve un esempio aggiuntivo;
- occorre materiale più recente;
- il docente lo richiede esplicitamente;
- serve verificare o integrare una spiegazione.

### 21.21 Strategia di ricerca efficiente

La ricerca esterna deve essere selettiva e contestuale.

Prima di cercare, il sistema deve già conoscere:
- classe;
- materia;
- argomento;
- obiettivo della generazione;
- livello;
- durata;
- preferenze del docente;
- fonti già disponibili;
- fonti escluse.

Questo permette di evitare ricerche generiche e ridondanti.

Il processo ideale è:

```text
contesto
↓
gap informativo
↓
ricerca mirata
↓
valutazione delle fonti
↓
selezione
↓
acquisizione del contenuto utile
↓
generazione
```

Il sistema non deve cercare nuovamente ciò che possiede già in modo sufficiente.

### 21.22 Valutazione delle fonti esterne

Le fonti esterne non devono essere trattate tutte allo stesso modo.

La selezione deve considerare almeno:
- autorevolezza;
- pertinenza;
- aggiornamento;
- coerenza con il livello didattico;
- qualità del contenuto;
- eventuale preferenza del docente;
- compatibilità con il tipo di materiale da generare.

Le fonti istituzionali o primarie devono normalmente avere priorità rispetto a fonti generiche quando pertinenti.

### 21.23 Acquisizione selettiva

La ricerca esterna non deve trasformarsi automaticamente in accumulo indiscriminato.

Il sistema deve distinguere tra:
- fonte consultata;
- fonte effettivamente usata;
- fonte salvata in modo persistente;
- fonte temporanea usata solo per una generazione.

Una fonte trovata online può quindi essere usata senza necessariamente entrare permanentemente nella libreria del docente.

Quando utile, il sistema può proporre:

```text
Questa fonte è stata utile per la lezione.
Vuoi conservarla tra i materiali?

[Conserva]
[No]
```

oppure applicare una policy configurata.

### 21.24 Controllo del docente

Il docente deve poter controllare la ricerca esterna a più livelli:

- consentita o disabilitata globalmente;
- consentita per una materia;
- consentita per una classe;
- consentita per una singola lezione o generazione;
- limitata a certe categorie di fonti;
- esclusione di domini o tipi di fonte;
- obbligo di usare certe fonti prima di cercarne altre.

Esempio:

```text
Materia Informatica:
✓ ricerca web consentita
✓ documentazione tecnica consentita
✗ forum non prioritari

Lezione SQL:
"Usa prima il libro e gli appunti.
Cerca online solo per esempi aggiuntivi."
```

### 21.25 Efficienza come vincolo

Dato che il progetto deve restare free, la ricerca esterna deve essere progettata con particolare attenzione all'efficienza.

Il sistema dovrebbe:
- riusare risultati già acquisiti quando ancora validi;
- evitare ricerche duplicate;
- memorizzare metadati e fonti già valutate;
- interrogare prima il patrimonio locale;
- cercare esternamente solo quando porta valore;
- acquisire solo il contenuto necessario;
- evitare pipeline costose quando una fonte locale è sufficiente;
- supportare provider e metodi di ricerca sostituibili.

Questa efficienza deve essere parte della progettazione, non una successiva ottimizzazione.

### 21.26 Obiettivo operativo

Il docente dovrebbe poter compiere la maggior parte delle operazioni materiali con uno dei seguenti flussi:

```text
AUTOMATICO
fonte sincronizzata
→ classificata
→ collegata
→ usata

QUASI AUTOMATICO
fonte sincronizzata
→ proposta classificazione
→ 1 click
→ usata

MANUALE
drag & drop / link / testo
→ classificazione proposta
→ conferma
→ usata
```

La differenza tra automatico e manuale deve riguardare solo l'ingresso, non il resto dell'esperienza.

## 22. Verifiche — esperienza docente

### 22.1 Principio

La verifica non deve nascere direttamente come insieme di domande generate.

Il sistema deve prima costruire una **struttura della prova** coerente con:
- argomenti realmente svolti;
- obiettivi didattici;
- durata disponibile;
- livello della classe;
- difficoltà desiderata;
- tipologie di domanda;
- criteri di valutazione;
- eventuali istruzioni del docente;
- materiali e fonti autorizzati.

Solo dopo deve generare le singole domande.

Il docente può intervenire sia sulla struttura sia sulle domande finali.

### 22.2 Punti di ingresso

Il docente deve poter creare una verifica in più modi:

- dalla home, tra le verifiche imminenti;
- dalla classe/materia;
- dalla sezione Verifiche;
- da una lezione o unità;
- dal calendario;
- tramite comando naturale.

Esempi:

> "Preparami una verifica di 60 minuti su SQL per la 4B."

> "Crea la verifica di fine unità usando solo gli argomenti effettivamente svolti."

### 22.3 Contesto automatico

Quando il docente crea una verifica, il sistema dovrebbe già conoscere:
- classe e materia;
- periodo;
- lezioni svolte;
- programma effettivo;
- materiali usati;
- esercizi già assegnati;
- eventuali verifiche precedenti;
- preferenze della classe e della materia.

Il docente non dovrebbe dover ricostruire manualmente queste informazioni.

### 22.4 Blueprint della verifica

Prima della generazione delle domande, il sistema costruisce un blueprint leggibile e modificabile.

Esempio:

```text
Verifica SQL · 4B
Durata: 60 minuti
Punteggio: 30 punti

Copertura:
• SELECT / WHERE ........ 20%
• GROUP BY .............. 25%
• JOIN .................. 35%
• Subquery .............. 20%

Tipologie:
• 4 domande brevi
• 3 esercizi SQL
• 1 esercizio applicativo

Difficoltà:
• base .......... 30%
• intermedia .... 50%
• avanzata ...... 20%
```

Il docente può modificare qualunque elemento prima o dopo la generazione.

### 22.5 Generazione delle domande

Le domande devono essere generate in funzione del blueprint, non indipendentemente.

Per ogni domanda il sistema deve conoscere almeno:
- obiettivo;
- argomento;
- difficoltà;
- tipo;
- punteggio;
- risposta attesa;
- criterio di correzione;
- fonte o contesto da cui deriva, quando pertinente.

Questo consente:
- controllo della copertura;
- sostituzione selettiva;
- generazione di varianti;
- correzione più affidabile;
- analisi successiva dei risultati.

### 22.6 Modifica selettiva

Il docente deve poter modificare una verifica a qualunque livello.

Esempi:

> "Questa domanda è troppo facile."

> "Sostituisci solo l'esercizio 4."

> "Riduci le JOIN e aggiungi una domanda sulle subquery."

> "Porta la durata a 45 minuti."

Il sistema deve ricalcolare solo ciò che serve:
- distribuzione dei punti;
- copertura;
- soluzioni;
- rubriche;
- eventuali varianti.

Non deve rigenerare l'intera prova senza necessità.

### 22.7 Validazione automatica

Prima di dichiarare una verifica pronta, il sistema deve eseguire controlli automatici.

Almeno:
- tutti gli argomenti sono stati realmente svolti;
- la copertura rispetta il blueprint;
- il punteggio totale è corretto;
- le domande non sono duplicate;
- soluzioni e consegne sono coerenti;
- non ci sono ambiguità evidenti;
- la difficoltà complessiva è compatibile con quella richiesta;
- la durata stimata è plausibile;
- non sono presenti contenuti esclusi dalle istruzioni.

Se rileva un problema ad alta confidenza, lo corregge secondo policy o lo segnala.

### 22.8 Varianti

Il sistema deve supportare più varianti della stessa verifica, fino ad arrivare se necessario a **una variante distinta per ogni studente**.

Le varianti devono restare comparabili per:
- obiettivi;
- difficoltà complessiva;
- durata;
- punteggio;
- copertura didattica.

Il docente deve poter controllare **l'intensità della diversificazione**.

Possibili livelli o dimensioni:
- solo ordine diverso delle domande;
- stessi esercizi con dati diversi;
- stessa abilità valutata con tracce diverse;
- diversa tipologia di domanda sullo stesso obiettivo;
- domanda diversa sullo stesso argomento;
- argomenti diversi ma equivalenti per peso e difficoltà;
- combinazione delle precedenti.

Esempio:

```text
Verifica SQL

24 studenti
24 varianti

Diversificazione:
✓ ordine domande
✓ dati degli esercizi
✓ tracce equivalenti
○ argomenti diversi

Equivalenza:
Copertura ✓
Difficoltà ✓
Durata ✓
Punteggio ✓
```

Il docente può:
- scegliere quante varianti generare;
- generare una variante per studente;
- definire il livello di differenziazione;
- bloccare alcune domande comuni;
- modificare una singola variante;
- rigenerare solo alcune varianti;
- mantenere regole di equivalenza comuni a tutte.

### 22.9 Riutilizzo e storico

Prima di generare una verifica da zero, il sistema deve poter recuperare:
- verifiche precedenti;
- domande già usate;
- esercizi;
- rubriche;
- varianti.

Può proporre:
- riuso diretto;
- adattamento;
- generazione nuova evitando domande già usate.

Il docente deve poter chiedere:

> "Preparami una verifica simile a quella della 4A dell'anno scorso, ma con più JOIN."

### 22.10 Stati della verifica

La verifica deve essere un oggetto vivo.

Internamente può passare per stati come:
- pianificata;
- in preparazione;
- pronta;
- pubblicata/consegnata;
- svolta;
- in correzione;
- corretta;
- archiviata.

Nella UI vanno usate etichette semplici e solo quando utili.

### 22.11 Svolgimento e canali esterni

La verifica deve essere **indipendente dal canale in cui viene svolta**.

Possibili canali:
- cartaceo;
- digitale nel servizio;
- Google Workspace / Google Forms / Classroom quando tecnicamente possibile;
- Microsoft Teams / Forms quando tecnicamente possibile;
- consegna file;
- risposta testuale;
- piattaforme scolastiche esterne;
- modalità ibride.

La modalità non deve cambiare il modello concettuale della verifica.

La stessa prova deve poter avere:
- documento docente;
- versione studente;
- soluzioni;
- griglia di correzione;
- varianti;
- formato stampabile;
- formato digitale;
- eventuali esportazioni verso servizi esterni.

#### Export

Quando un'integrazione lo permette, il sistema deve poter esportare:
- struttura della verifica;
- domande;
- varianti;
- punteggi;
- eventuali soluzioni o criteri;
- metadati necessari.

L'export non deve creare una nuova verifica scollegata: deve restare associato all'oggetto originale nel nostro sistema.

#### Import dei risultati

Quando una verifica viene svolta fuori dal sistema, dobbiamo poter:
- importare risposte;
- importare punteggi;
- importare file consegnati;
- associare i risultati allo studente corretto;
- collegare ogni risultato alla verifica e alla variante corretta;
- completare nel nostro sistema la correzione automatica o assistita.

Se il servizio esterno non offre integrazione diretta, devono essere possibili fallback come:
- import CSV;
- import file;
- upload massivo;
- associazione guidata studente-risultato.

Il sistema deve quindi separare chiaramente:

```text
VERIFICA
↓
CANALE DI EROGAZIONE
↓
RISULTATI / RISPOSTE
↓
CORREZIONE
```

e non modellare una "verifica Google", una "verifica Teams" e una "verifica cartacea" come entità concettualmente diverse.

### 22.12 Correzione automatica e assistita

La correzione deve distinguere tra:

#### Risposte oggettive
Correzione automatica quando possibile.

#### Risposte strutturate
Correzione automatica con regole verificabili.

#### Risposte aperte
Valutazione assistita per criteri, con evidenze e livello di certezza.

Per le risposte aperte il sistema non deve limitarsi a produrre un voto unico.

Deve lavorare su una rubrica, ad esempio:

```text
Correttezza concettuale .... 4/5
Completezza ................. 2/3
Motivazione ................. 1/2

Totale: 7/10
```

Quando un criterio è dubbio, deve emergere come elemento da controllare.

### 22.13 Review della correzione

Il docente non deve dover aprire ogni risposta se non serve.

Esempio:

```text
24 verifiche corrette

19 senza problemi evidenti
3 con risposte aperte dubbie
2 con anomalia di punteggio

[Controlla le 5]
```

Deve essere possibile:
- approvare in blocco;
- modificare singoli criteri;
- cambiare punteggio;
- correggere la rubrica;
- applicare una modifica a casi simili.

### 22.14 Il voto resta del docente

Qualunque voto proposto dal sistema deve essere liberamente modificabile.

La modifica manuale diventa il risultato corretto e non deve essere sovrascritta da ricalcoli successivi senza esplicita ragione.

Se una modifica al criterio cambia molte correzioni, il sistema deve mostrare l'impatto prima di applicarla.

### 22.15 Feedback agli studenti

Dalla correzione il sistema deve poter preparare:
- punteggio;
- voto;
- commento generale;
- feedback per domanda;
- spiegazione dell'errore;
- indicazioni di recupero;
- esercizi consigliati.

Il docente può decidere cosa pubblicare.

Il feedback può essere più o meno dettagliato per classe, materia o singola verifica.

### 22.16 Errori della verifica

Il sistema deve gestire il caso in cui il problema sia nella prova e non nello studente.

Esempi:
- domanda ambigua;
- soluzione errata;
- punteggio sbagliato;
- argomento non svolto;
- domanda troppo difficile rispetto al blueprint.

Il docente deve poter segnare:

> "Annulla questa domanda."

e il sistema deve ricalcolare coerentemente:
- punteggi;
- voti;
- statistiche;
- feedback.

### 22.17 Collegamento con il percorso didattico

I risultati della verifica devono produrre evidenze utili per il percorso futuro.

Esempio:

```text
4B · Verifica SQL

JOIN:
buona comprensione

Subquery:
difficoltà diffusa

Proposta:
riprendere subquery nella prossima lezione
```

Questa proposta non deve modificare automaticamente il piano senza seguire la policy del docente.

### 22.18 Voti, limiti e registro

La verifica produce valutazioni, ma la sezione voti rimane separata.

Il sistema deve mantenere distinti:
- punteggio grezzo;
- punteggio normalizzato;
- voto proposto;
- voto finale deciso dal docente.

Le regole di voto devono essere configurabili e **gerarchiche/ereditarie**, come il resto del sistema.

Livelli possibili:

```text
Globale
  ↓
Materia
  ↓
Classe
  ↓
Verifica
  ↓
Eventuale studente/caso specifico
```

Le regole possono includere:
- voto minimo ammesso;
- voto massimo ammesso;
- presenza o assenza di decimali;
- numero di cifre decimali;
- passo consentito, ad esempio 0.5;
- voti esclusi/non utilizzabili;
- regole di arrotondamento;
- soglia di sufficienza;
- conversione punteggio → voto;
- pesi;
- eventuali bonus o penalità ammesse.

Esempio:

```text
Materia Informatica
Minimo: 2
Massimo: 10
Decimali: sì
Passo: 0.5
Esclusi: 5.5

4B
Minimo: 3

Verifica SQL
Nessuna deroga
```

La regola più specifica prevale dove definita.

Il sistema deve poter:
- calcolare il voto secondo queste regole;
- mostrare eventuali vincoli applicati;
- correggere manualmente il voto;
- preservare il voto deciso dal docente;
- esportare o sincronizzare valutazioni quando integrazioni lo permettono.

### 22.19 Istruzioni gerarchiche

Riutilizziamo il modello già approvato:

```text
Globale
  ↓
Materia
  ↓
Classe
  ↓
Verifica
  ↓
Richiesta puntuale
```

Esempio:

```text
Globale:
"Evita domande puramente mnemoniche."

Materia:
"Negli esercizi tecnici valuta anche il procedimento."

Classe 4B:
"Usa consegne molto chiare e progressive."

Verifica SQL:
"60 minuti, nessuna domanda a scelta multipla,
almeno un esercizio applicativo."
```

### 22.20 Generazione automatica anticipata

Se esiste una verifica nel calendario, il sistema può prepararla automaticamente prima della data prevista.

Esempio:

```text
Verifica 4B · venerdì

Bozza pronta
Basata sulle lezioni svolte fino a oggi

[Controlla]
```

Se nuove lezioni modificano il programma svolto prima della verifica, il sistema deve capire se la bozza è diventata parzialmente obsoleta e proporre l'aggiornamento.

### 22.21 Integrità della prova e anti-copiatura

Le verifiche sono svolte **in presenza**. Il sistema non deve trasformarsi in un sistema di proctoring o monitoraggio degli studenti.

Lo scopo dell'anti-copiatura è semplice:

> trovare evidenze concrete che possano indicare che una risposta è stata copiata da un compagno o da una fonte esterna, e mostrarle al docente.

Possibili controlli:

#### Tra compagni
- risposte identiche o molto simili;
- stessi errori rari;
- stessa sequenza insolita di passaggi;
- somiglianze anomale nelle domande aperte;
- incoerenze tra variante assegnata e risposta prodotta;
- vicinanza dei posti come semplice contesto quando è disponibile una Seat Map.

#### Rispetto a fonti esterne
- frasi identiche o fortemente sovrapponibili;
- confronto con fonti web o soluzioni pubblicamente disponibili;
- porzioni copiate testualmente.

Non sono parte del prodotto:
- monitoraggio di finestre/tab o focus;
- mouse/keyboard tracking;
- osservazione del comportamento digitale;
- video/webcam;
- riconoscimento di emozioni o attenzione;
- profilazione comportamentale;
- "AI detector" o classificazione dello stile dello studente.

Il sistema non deve stabilire automaticamente che uno studente ha copiato. Deve mostrare il confronto al docente.

Esempio:

```text
Possibile copiatura

Rossi / Bianchi
• risposte molto simili in 3 domande aperte
• stesso errore raro in 2 esercizi

[Confronta risposte]
[Ignora]
[Aggiungi nota]
```

### 22.22 Mappa posti durante la verifica

Il docente deve poter usare una rappresentazione semplice dell'aula durante la prova.

Funzioni possibili:
- disposizione dei banchi;
- assegnazione studente → posto;
- modifica rapida dei posti;
- assegnazione automatica o casuale;
- assegnazione compatibile con varianti diverse;
- annotazioni durante la verifica;
- marcatura di eventi;
- collegamento delle osservazioni allo studente e alla prova.

Esempio:

```text
LAVAGNA

[Rossi A17] [Bianchi B04] [Verdi A09]
[Neri  B11] [Gallo   A03] [Conti B18]

Rossi
• 10:24 — richiamo per parlare
• 10:47 — chiesto chiarimento consegna
```

Le annotazioni devono essere rapide e opzionali.

La mappa può aiutare anche la generazione delle varianti, per esempio evitando che studenti vicini ricevano prove troppo simili.

La posizione è una proprietà della singola sessione di verifica, non necessariamente un dato permanente sullo studente.

### 22.23 Correzione automatica — principio generale

La correzione automatica non deve essere un unico algoritmo applicato a qualunque risposta.

Ogni risposta deve passare attraverso una strategia coerente con il tipo di domanda.

Schema generale:

```text
RISPOSTA
↓
TIPO DI DOMANDA
↓
STRATEGIA DI CORREZIONE
↓
EVIDENZE
↓
PUNTEGGIO PER CRITERIO
↓
LIVELLO DI CERTEZZA
↓
AUTO-APPROVAZIONE oppure REVIEW DOCENTE
```

Il sistema deve distinguere almeno:
- risposte chiuse;
- risposte numeriche;
- risposte con risultato verificabile;
- codice;
- esercizi con procedimento;
- risposte brevi aperte;
- risposte lunghe/argomentative;
- elaborati o file;
- risposte multimodali future.

### 22.24 Risposte chiuse

Esempi:
- scelta multipla;
- vero/falso;
- matching;
- selezione multipla.

Correzione deterministica quando la chiave è definita.

Il sistema deve comunque gestire:
- più risposte corrette;
- penalità per risposte errate;
- risposte parzialmente corrette;
- domande annullate;
- variazioni della chiave decise dal docente.

Queste risposte possono normalmente essere corrette e approvate automaticamente.

### 22.25 Risposte numeriche e calcoli

Il sistema deve poter valutare:
- valore esatto;
- intervallo di tolleranza;
- unità di misura;
- arrotondamenti;
- forme equivalenti;
- eventuali passaggi intermedi.

Esempio:

```text
Risposta attesa: 3.14
Tolleranza: ±0.02
Unità: cm²
```

Quando il risultato finale è errato ma il procedimento è rilevante, la domanda deve passare a una correzione per criteri e non fermarsi al solo confronto numerico.

### 22.26 Risposte strutturate e verificabili

Per esercizi dove esiste una soluzione verificabile il sistema deve preferire controlli deterministici o eseguibili rispetto a una semplice valutazione linguistica.

Esempi:
- query SQL;
- codice;
- formule;
- output;
- strutture dati;
- configurazioni;
- esercizi con vincoli precisi.

Possibili controlli:
- test automatici;
- esecuzione in ambiente isolato;
- confronto di output;
- verifica di proprietà;
- controllo sintattico;
- controllo semantico quando possibile.

La valutazione può distinguere:
- risultato;
- correttezza del procedimento;
- robustezza;
- stile/leggibilità;
- rispetto dei vincoli.

### 22.27 Procedimento

Quando il procedimento è parte della valutazione, il sistema non deve assegnare tutto il punteggio solo perché il risultato finale è corretto.

La rubrica può includere:

```text
Impostazione .......... 2/2
Procedimento .......... 3/4
Risultato finale ...... 2/2
Motivazione ........... 1/2
```

Se il procedimento non è leggibile o sufficientemente interpretabile, il sistema deve richiedere review.

### 22.28 Risposte aperte brevi

Per risposte brevi il sistema deve confrontare:
- concetti richiesti;
- elementi essenziali;
- errori concettuali;
- eventuali formulazioni alternative valide.

Non deve richiedere corrispondenza testuale con una soluzione modello.

Esempio interno:

```text
Elementi attesi:
✓ definizione corretta
✓ differenza rispetto a LEFT JOIN
○ esempio pertinente
```

### 22.29 Risposte aperte lunghe

Le risposte lunghe devono essere valutate criterio per criterio.

Possibili criteri:
- correttezza;
- completezza;
- profondità;
- argomentazione;
- uso di esempi;
- terminologia;
- struttura;
- aderenza alla consegna.

Ogni criterio deve produrre:
- evidenze nella risposta;
- punteggio proposto;
- spiegazione sintetica;
- livello di certezza.

Esempio:

```text
Correttezza concettuale
4 / 5
Certezza: alta

Completezza
2 / 3
Certezza: media
Manca il confronto con LEFT JOIN.

Argomentazione
1 / 2
Certezza: bassa
[Richiede controllo]
```

### 22.30 Soglie di auto-approvazione

La correzione deve essere guidata da soglie configurabili.

Esempio concettuale:

```text
alta certezza
→ correzione automatica

certezza media
→ correzione proposta, eventualmente inclusa in batch review

bassa certezza
→ controllo docente obbligatorio
```

Le soglie possono essere diverse per:
- tipo di domanda;
- materia;
- classe;
- verifica;
- criterio.

Il docente può scegliere un approccio più prudente o più automatico.

### 22.31 Coerenza tra studenti

La correzione deve controllare anche la coerenza interna.

Se due risposte molto simili ricevono punteggi molto diversi, il sistema deve segnalarlo.

Se il docente modifica il criterio applicato a una risposta, il sistema può proporre:

> "Ci sono 7 risposte simili. Vuoi ricontrollarle con lo stesso criterio?"

Questo riduce incoerenze senza imporre modifiche.

### 22.32 Correzione iterativa

Il docente deve poter correggere il correttore.

Esempio:

> "Qui considero valida anche questa formulazione."

Il sistema può:
- aggiornare la rubrica della verifica;
- ricontrollare le risposte simili;
- mostrare l'impatto;
- applicare la modifica solo dopo conferma.

Le decisioni del docente devono avere priorità sui successivi ricalcoli.

### 22.33 Evidenze e spiegabilità

Ogni valutazione non deterministica deve poter essere ricostruita.

Il docente deve poter vedere:
- risposta dello studente;
- criterio;
- evidenza usata;
- punteggio proposto;
- motivo;
- eventuale incertezza.

Non deve essere necessario mostrare dettagli tecnici del modello AI.

### 22.34 Output della correzione

La correzione di una verifica deve produrre almeno:

```text
risposte
→ punteggi per domanda
→ criteri/rubriche
→ punteggio totale
→ voto proposto
→ voto finale
→ feedback
→ evidenze di apprendimento
→ eventuali anomalie anti-copiatura
```

Questi elementi devono rimanere separati ma collegati.

### 22.35 Principio di scelta tecnica per compito

Le funzionalità descritte in questo dossier non implicano l'uso di LLM per ogni operazione.

Nelle fasi di AI Architecture e Platform Architecture dovremo scegliere, per ciascun compito, lo strumento più adatto tra:
- logica deterministica;
- algoritmi tradizionali;
- motori di regole;
- ricerca full-text o semantica;
- similarità e hashing;
- esecuzione/test automatici;
- modelli statistici;
- machine learning classico;
- piccoli modelli specializzati;
- modelli multimodali;
- LLM;
- combinazioni di più tecniche.

Principio guida:

> usare il metodo meno complesso e più verificabile che soddisfa bene il requisito.

Gli LLM vanno usati soprattutto dove servono:
- comprensione semantica;
- generazione linguistica;
- trasformazione di contenuti;
- valutazioni che richiedono interpretazione;
- orchestrazione di informazioni non strutturate.

Vanno invece evitati come prima scelta quando esiste una soluzione deterministica, più economica, più verificabile o più affidabile.

Nelle fasi finali dovrà essere condotta una ricerca comparativa di:
- servizi gratuiti;
- progetti open-source;
- librerie;
- modelli locali;
- strumenti specializzati;
- motori di ricerca e retrieval;
- sistemi di grading/testing;
- strumenti di document processing;
- tecnologie di deduplicazione e similarity.

La valutazione dovrà essere fatta sui requisiti concreti emersi dai dossier, non su preferenze tecnologiche astratte.

### 22.36 Principio di libertà

Come per lezioni e materiali, tutto deve restare modificabile:
- blueprint;
- domande;
- punti;
- soluzioni;
- rubriche;
- varianti;
- voti;
- feedback;
- regole di calcolo;
- pubblicazione.

L'automazione deve ridurre lavoro, non vincolare il docente.

## 23. Studenti — esperienza docente

### 23.0 Priorità di prodotto

La gestione avanzata degli studenti è **target futuro**, non una priorità delle prime versioni.

Nelle fasi iniziali la rappresentazione dello studente deve esistere soprattutto **sotto il cofano** per permettere il funzionamento coerente di:
- verifiche;
- voti;
- varianti individuali;
- consegne;
- annotazioni;
- eventuali personalizzazioni minime;
- associazione di risultati importati da servizi esterni.

Non dobbiamo investire presto in profilazione, dashboard dettagliate, mastery model complessi o analisi longitudinali se non sono ancora necessarie per sbloccare valore concreto.

### 23.0.1 Scope iniziale minimo

Per le prime versioni può bastare:

- identità dello studente;
- appartenenza alla classe;
- voti e risultati;
- storico essenziale delle verifiche;
- annotazioni libere del docente;
- eventuali note comportamentali rilevanti;
- esigenze, richieste o accomodamenti espliciti;
- associazione a variante/verifica/consegna;
- eventuali gruppi temporanei minimi quando servono.

La UI può quindi essere inizialmente molto semplice:

```text
Rossi Mario

Voti
• Verifica SQL ........ 7
• Esercitazione ....... 8

Annotazioni
• Preferisce esempi visivi
• Durante le verifiche necessita più tempo
• 12 ottobre — richiamo durante la prova

[+ Nota]
```

### 23.0.2 Evoluzione progressiva

Solo successivamente, quando il resto del sistema produce abbastanza dati e il beneficio è chiaro, possiamo aggiungere:
- segnali automatici;
- andamento per concetto;
- difficoltà ricorrenti;
- gruppi suggeriti;
- recuperi automatici;
- personalizzazione avanzata;
- confronto temporale;
- vista trasversale tra materie;
- profilo didattico più ricco.

Questa evoluzione deve essere guidata dall'utilità reale, non dal desiderio di costruire una profilazione completa.

### 23.1 Principio

La sezione Studenti deve aiutare il docente a **capire rapidamente chi necessita attenzione e perché**, senza trasformarsi in un sistema di profilazione opaco o in una dashboard statistica permanente.

Il sistema deve mostrare soprattutto:
- evidenze concrete;
- andamento recente;
- difficoltà ricorrenti;
- progressi;
- attività/verifiche rilevanti;
- annotazioni;
- eventuali personalizzazioni già in uso;
- elementi che richiedono azione.

Il docente deve poter correggere, integrare o ignorare qualunque interpretazione proposta dal sistema.

### 23.2 Vista classe

La prima vista non deve mostrare decine di metriche.

Esempio:

```text
4B · Studenti

24 studenti

Da attenzionare
• Rossi — difficoltà ricorrenti sulle subquery
• Bianchi — 3 consegne mancanti
• Verdi — miglioramento netto nelle ultime 3 attività

[Mostra tutti gli studenti]
```

Lo scopo è portare in superficie solo i casi rilevanti.

### 23.3 Elenco studenti

L'elenco completo deve essere semplice e ricercabile.

Per ogni studente può mostrare in forma sintetica:
- nome;
- stato recente;
- ultima valutazione;
- eventuale segnale rilevante;
- annotazioni recenti;
- attività mancanti.

Esempio:

```text
Rossi Mario
Ultima verifica: 6.5
Segnale: difficoltà su JOIN

Bianchi Luca
Ultima verifica: 8
2 consegne mancanti

Verdi Anna
Ultima verifica: 7.5
Andamento in miglioramento
```

Statistiche più dettagliate restano nel profilo individuale.

### 23.4 Profilo dello studente

Il profilo individuale deve aggregare ciò che serve al docente per prendere decisioni.

Possibili sezioni:

#### Panoramica
- situazione recente;
- ultime attività;
- ultime verifiche;
- note importanti;
- segnali da controllare.

#### Valutazioni
- voti;
- punteggi;
- andamento;
- criteri di valutazione;
- modifiche manuali del docente.

#### Apprendimento
- concetti/obiettivi con evidenze positive;
- difficoltà ricorrenti;
- progressi;
- recuperi effettuati;
- attività consigliate.

#### Attività
- consegne;
- esercizi;
- partecipazione a verifiche;
- assenze quando disponibili;
- attività incomplete.

#### Annotazioni
- note libere;
- note collegate a lezione;
- note collegate a verifica;
- osservazioni durante attività;
- eventuali promemoria.

#### Personalizzazioni
- adattamenti didattici;
- preferenze operative;
- materiali personalizzati;
- regole applicate;
- eventuali accomodamenti autorizzati.

### 23.5 Evidenze prima delle etichette

Il sistema non deve mostrare:

```text
Rossi
"Scarso in matematica"
"Studente debole"
"Bassa motivazione"
```

Deve invece mostrare fatti ed evidenze:

```text
Rossi

Nelle ultime 3 attività sulle subquery:
• 2 errori ricorrenti nel correlare le tabelle;
• 1 risposta incompleta;
• miglioramento nell'ultima esercitazione.

[Apri evidenze]
```

Le interpretazioni devono essere sempre subordinate ai dati osservabili.

### 23.6 Stato dinamico, non profilo permanente

Le difficoltà non devono diventare automaticamente caratteristiche permanenti dello studente.

Esempio:

```text
Difficoltà recente:
Subquery SQL

Evidenze:
ultime 3 attività

Ultimo aggiornamento:
15 ottobre
```

Se le evidenze cambiano, il sistema deve aggiornare o rimuovere il segnale.

### 23.7 Segnali automatici

Il sistema può proporre segnali come:
- peggioramento improvviso;
- miglioramento significativo;
- errori ricorrenti;
- consegne mancanti;
- voto molto distante dal trend recente;
- difficoltà condivisa su uno specifico obiettivo;
- risultato anomalo rispetto alle attività precedenti;
- necessità potenziale di recupero;
- partecipazione irregolare alle attività disponibili.

Questi segnali devono:
- spiegare sempre da quali evidenze derivano;
- avere una durata/revisione;
- non diventare etichette statiche;
- poter essere ignorati o corretti dal docente.

### 23.8 Annotazioni del docente

Le annotazioni devono essere estremamente rapide.

Il docente deve poter aggiungere una nota:
- dalla pagina studente;
- durante una lezione;
- durante una verifica;
- dalla mappa dei posti;
- da una correzione;
- dalla home della classe.

Esempi:

> "Ha finalmente capito le JOIN con l'esempio grafico."

> "Da riprendere il prossimo lunedì."

> "Molto sicuro nella parte pratica, meno nella teoria."

La nota può essere collegata automaticamente al contesto in cui è stata creata.

### 23.9 Tipi di nota

Non imporrei categorie obbligatorie, ma il sistema può proporre tipi leggeri:
- didattica;
- verifica;
- comportamento durante attività;
- recupero;
- promemoria;
- personale/riservata;
- altro.

Il docente può lasciare una nota totalmente libera.

### 23.10 Visibilità delle note

Le note devono avere regole di visibilità chiare.

Possibili livelli:
- solo docente;
- docenti autorizzati;
- visibile allo studente;
- visibile alla famiglia quando previsto;
- usabile dal sistema per personalizzazione;
- esclusa dall'automazione.

La policy dettagliata sarà trattata nel dossier Governance.

### 23.11 Personalizzazione

Il sistema deve poter adattare:
- materiali;
- esercizi;
- difficoltà;
- quantità di pratica;
- feedback;
- verifiche quando consentito;
- recuperi;
- spiegazioni alternative.

La personalizzazione deve derivare da:
- evidenze recenti;
- istruzioni del docente;
- accomodamenti espliciti;
- obiettivi didattici.

Non deve derivare da etichette generiche o classificazioni opache.

### 23.12 Suggerimenti al docente

Esempio:

```text
Rossi

Nelle ultime 3 attività ha difficoltà
sulle subquery correlate.

Possibili azioni:
[Assegna 3 esercizi guidati]
[Prepara spiegazione alternativa]
[Ignora]
```

Il sistema può proporre, ma il docente decide.

### 23.13 Gruppi

Il docente deve poter creare gruppi:
- manualmente;
- temporaneamente;
- per attività;
- per recupero;
- per livello su uno specifico argomento;
- automaticamente come proposta.

Esempio:

```text
Recupero subquery
Rossi
Bianchi
Conti
```

Il gruppo non deve diventare un'etichetta permanente degli studenti.

### 23.14 Personalizzazione di gruppo

Un gruppo può ricevere:
- materiale;
- esercizi;
- attività;
- recuperi;
- varianti;
- feedback.

Questo permette di personalizzare senza necessariamente creare un flusso completamente individuale per ogni studente.

### 23.15 Storico

Lo storico deve esistere ma non dominare l'interfaccia.

Il docente deve poter ricostruire:
- quando è comparsa una difficoltà;
- quali evidenze la supportavano;
- quali interventi sono stati effettuati;
- come sono cambiati i risultati.

Esempio:

```text
Subquery

1 ottobre
prima difficoltà rilevata

4 ottobre
assegnati esercizi guidati

9 ottobre
lezione di recupero

15 ottobre
risultato migliorato
```

### 23.16 Relazione con voti

Il profilo studente non deve ridursi alla media.

Il voto è una delle evidenze, non l'intera rappresentazione dello studente.

Il sistema deve poter distinguere:
- risultato;
- concetto valutato;
- contesto;
- difficoltà;
- eventuali modifiche del docente;
- trend nel tempo.

### 23.17 Assenze e dati esterni

Quando integrazioni future rendono disponibili:
- assenze;
- ritardi;
- giustificazioni;
- consegne da piattaforme esterne;
- comunicazioni pertinenti;

queste informazioni possono contribuire al contesto dello studente.

Non devono però produrre inferenze automatiche non giustificate.

Esempio corretto:

```text
Ha perso 2 lezioni sull'argomento.
```

Non:

```text
È poco motivato.
```

### 23.18 Ricerca e query naturali

Il docente deve poter chiedere:

> "Chi sta avendo difficoltà con le JOIN?"

> "Mostrami gli studenti che non hanno consegnato gli ultimi due esercizi."

> "Chi è migliorato di più nell'ultimo mese?"

> "Fammi vedere le note che ho scritto su Rossi."

Il sistema deve rispondere usando evidenze concrete.

### 23.19 Azioni rapide

Dal profilo studente o dalla lista devono essere possibili azioni rapide:
- assegna esercizi;
- prepara materiale personalizzato;
- aggiungi nota;
- pianifica recupero;
- apri verifiche;
- apri voti;
- confronta andamento;
- inserisci in gruppo;
- rimuovi segnale;
- correggi classificazione/proposta del sistema.

### 23.20 Principio di minimo carico e minima profilazione

Oltre a minimizzare il carico operativo, dobbiamo minimizzare anche la profilazione anticipata.

Il sistema deve conservare solo ciò che serve davvero ai workflow correnti e a quelli già pianificati.

Non dobbiamo costruire in anticipo un profilo complesso dello studente solo perché in futuro potrebbe risultare utile.

Il sistema deve imparare soprattutto dai dati già prodotti dal normale lavoro:
- verifiche;
- esercizi;
- consegne;
- lezioni;
- correzioni;
- note;
- modifiche del docente.

Non deve costringere il professore a compilare schede periodiche sugli studenti per alimentare il sistema.

### 23.21 Separazione Teacher Experience / Student Experience

Questa sezione descrive **come il docente vede e gestisce gli studenti**.

Non definisce ancora:
- cosa vede lo studente;
- quali indicatori gli vengono mostrati;
- come riceve feedback;
- come gestisce attività e materiali;
- come interagisce con personalizzazioni.

Questi aspetti saranno trattati nel dossier Student Experience.

## 24. Pianificazione e programma — esperienza docente

### 24.1 Principio

La pianificazione deve aiutare il docente a mantenere una traiettoria didattica coerente senza trasformare il servizio in un software di project management.

Il sistema deve distinguere chiaramente:

- **programma previsto** — cosa si intende svolgere;
- **calendario reale** — quando le lezioni possono effettivamente avvenire;
- **programma svolto** — cosa è stato realmente affrontato;
- **previsione aggiornata** — come cambia il resto dell'anno alla luce di ciò che è successo.

Questi quattro livelli devono restare collegati ma distinti.

### 24.2 Piano annuale previsto

All'inizio dell'anno il docente deve poter definire o importare un piano di massima.

Può nascere da:
- programma ministeriale o istituzionale;
- piano dell'anno precedente;
- libro adottato;
- documenti del dipartimento;
- materiale del docente;
- generazione assistita;
- import da fonti esterne.

Il piano non deve necessariamente essere definito lezione per lezione.

La sua unità principale deve essere **l'argomento**, non il numero di ore.

Può essere organizzato per:
- periodo;
- unità;
- modulo;
- argomento;
- sotto-argomento;
- obiettivo;
- prerequisiti;
- priorità.

Le ore possono esistere come stima accessoria, ma non devono guidare l'esperienza principale.

Esempio:

```text
SETTEMBRE
Reti di base
  ✓ concetti fondamentali
  ✓ topologie
  ○ dispositivi di rete

Modello OSI
  ○ livelli
  ○ incapsulamento

OTTOBRE
TCP/IP
Subnetting
```

### 24.3 Calendario reale

Il calendario rappresenta i vincoli effettivi:

- orario delle lezioni;
- festività;
- sospensioni;
- uscite;
- assemblee;
- attività scolastiche;
- verifiche;
- assenze previste;
- eventi importati da calendari esterni.

Il sistema deve poter importare questi dati automaticamente quando possibile.

Se una lezione viene cancellata o spostata, il piano non viene riscritto retroattivamente: cambia la previsione futura.

### 24.4 Programma svolto

Il programma svolto deve derivare soprattutto dalle lezioni reali.

Ogni lezione aggiorna:
- argomenti affrontati;
- argomenti parziali;
- argomenti rimandati;
- tempo effettivamente usato;
- eventuali approfondimenti;
- recuperi.

Il docente deve poter correggere tutto manualmente.

Esempio:

```text
Subnetting

Previsto:
• concetto di subnet
• subnet mask
• calcolo host/reti
• esercizi applicativi

Svolto:
✓ concetto di subnet
✓ subnet mask
✓ calcolo host/reti
○ esercizi applicativi

Stato:
parzialmente completato

Nota:
serve un'altra lezione di esercizi
```

### 24.5 Vista principale della pianificazione

La prima vista non deve mostrare un Gantt o una pianificazione complessa.

Deve rispondere a poche domande:

- dove siamo;
- cosa viene dopo;
- siamo in linea;
- ci sono problemi futuri;
- serve una decisione.

Esempio:

```text
4B · Sistemi e Reti

OGGI
Subnetting
7 / 10 ore svolte

PROSSIMO
Subnetting · esercizi avanzati

POI
Routing statico

ANDAMENTO
Subnetting non ancora completato
Routing slitta rispetto al piano previsto
Nessun impatto critico al momento

[Nessuna azione necessaria]
```

### 24.6 Scostamento previsto vs svolto

Il sistema deve calcolare e mostrare lo scostamento in modo comprensibile.

Non solo un'indicazione quantitativa astratta, ma una spiegazione sugli argomenti e sulle conseguenze.

Esempio:

```text
Subnetting non è ancora completato.
Di conseguenza Routing inizierà dopo rispetto al piano iniziale.

Non sono previste conseguenze sulle verifiche già pianificate.
```

Oppure:

```text
La verifica del 12 novembre include Routing,
ma con il piano attuale l'argomento potrebbe non essere completato.

[Proponi modifica]
```

### 24.7 Ripianificazione automatica

Il sistema deve poter proporre una ripianificazione quando cambia la realtà.

Cause:
- lezione saltata;
- argomento più lungo del previsto;
- classe in difficoltà;
- recupero necessario;
- verifica spostata;
- evento scolastico;
- modifica manuale del docente.

La ripianificazione deve essere selettiva.

Esempio:

```text
La lezione di venerdì è stata annullata.

Proposta:
• sposta Routing di 1 lezione
• mantieni la verifica invariata
• riduci di 1 ora il ripasso finale

[Applica]
[Modifica]
[Ignora]
```

### 24.8 Livelli di autonomia

La ripianificazione deve seguire una policy configurabile.

Possibili modalità:

- solo segnalazione;
- proposta automatica;
- aggiornamento automatico con review;
- aggiornamento automatico entro limiti definiti.

Esempio:

```text
Puoi spostare automaticamente
lezioni future fino a 1 settimana,
ma non modificare verifiche senza approvazione.
```

### 24.9 Vincoli e priorità

Il docente deve poter indicare vincoli come:

- argomenti obbligatori;
- argomenti opzionali;
- ore minime;
- verifiche non spostabili;
- periodi di ripasso;
- prerequisiti;
- scadenze istituzionali;
- attività laboratoriali da svolgere prima di altre.

Il sistema deve rispettarli durante la ripianificazione.

### 24.10 Argomenti obbligatori vs flessibili

Non tutto il programma ha lo stesso peso.

Il piano può distinguere:
- obbligatorio;
- importante;
- opzionale;
- approfondimento;
- recupero.

Questo permette di reagire agli imprevisti in modo sensato.

Esempio:

```text
Mancano 6 ore rispetto al piano.

Possibile recupero:
• mantieni tutti gli argomenti obbligatori
• riduci approfondimento IPv6 da 4 h a 2 h
• sposta laboratorio facoltativo a dicembre
```

### 24.11 Pianificazione delle verifiche

Le verifiche devono essere parte della pianificazione.

Il sistema deve poter:
- proporre quando collocarle;
- verificare che gli argomenti siano stati realmente svolti;
- stimare se il piano porta alla copertura necessaria;
- segnalare conflitti;
- aggiornare la bozza se cambia il programma svolto.

Quando una verifica è pianificata ma alcuni contenuti previsti non sono stati ancora affrontati, devono essere possibili almeno due strategie:

#### Strategia A — mantieni i contenuti, sposta la verifica

```text
La verifica richiede anche Routing,
ma Routing non è ancora stato svolto.

[Proponi nuova data]
```

#### Strategia B — mantieni la data, adatta la verifica

```text
Mantieni la verifica al 15 novembre.

Aggiorna la prova usando solo:
✓ TCP/IP
✓ Subnetting
○ Routing escluso
```

La scelta può essere:
- manuale volta per volta;
- configurata come preferenza di materia/classe;
- suggerita automaticamente in base ai vincoli del calendario.

La verifica non deve dettare il programma in modo cieco, ma deve essere considerata come vincolo reale.

### 24.12 Calendario scolastico e fonti esterne

Il calendario è una componente centrale della pianificazione.

Deve rappresentare almeno:
- giorni e orari di lezione;
- festività;
- sospensioni;
- uscite;
- assemblee;
- attività scolastiche;
- verifiche;
- periodi di verifica;
- scadenze;
- eventi;
- eventuali finestre o periodi istituzionali.

Il sistema deve poter aggregare:
- calendario scolastico;
- calendario personale;
- calendario di istituto;
- Teams/Google Calendar/altre integrazioni;
- festività;
- eventi;
- scadenze.

L'obiettivo è evitare che il docente debba riportare manualmente gli stessi eventi in più posti.

Il calendario deve alimentare direttamente:
- generazione delle lezioni;
- preparazione delle verifiche;
- ripianificazione;
- scadenze;
- vista settimanale;
- previsione del programma.

### 24.13 Modifiche manuali

Il docente deve poter:
- spostare una lezione;
- cambiare argomento;
- anticipare un modulo;
- rimandare una verifica;
- aggiungere ore di recupero;
- saltare un approfondimento;
- modificare completamente il piano.

Ogni modifica deve propagarsi solo dove necessario.

### 24.14 Previsione futura

Il sistema deve mantenere una previsione sempre aggiornata.

Non serve mostrare ogni dettaglio ogni giorno, ma deve poter dire:

```text
Con il ritmo attuale:

Subnetting terminerà il 22 ottobre
Routing terminerà il 12 novembre
Verifica prevista il 15 novembre

Nessun conflitto rilevato
```

Oppure evidenziare il primo problema futuro.

### 24.15 Pianificazione settimanale

Per il lavoro quotidiano, la vista più utile resta quella settimanale.

Esempio:

```text
SETTIMANA 19–23 OTTOBRE

Lun · 4B
Subnetting · esercizi
Materiale pronto

Mer · 4B
Subnetting · verifica pratica
Bozza pronta

Ven · 4B
Routing statico
Pianificata
```

Il piano annuale resta sullo sfondo.

### 24.16 Programma come fonte per la generazione

Il piano previsto e quello svolto devono alimentare:
- lezioni future;
- Teacher Script;
- materiali;
- esercizi;
- verifiche;
- recuperi.

Il generatore non deve usare il programma annuale come verità assoluta: per la generazione concreta deve prevalere lo stato effettivo della classe.

### 24.17 Versioni del piano

Le modifiche significative devono essere tracciabili.

Il docente deve poter capire:
- piano iniziale;
- modifiche importanti;
- stato corrente;
- perché è cambiato.

Non serve mostrare un sistema di version control tecnico, ma una cronologia leggibile.

### 24.18 Chiusura del periodo o dell'anno

Il sistema deve poter produrre automaticamente una sintesi del programma:

```text
Previsto
Svolto
Non svolto
Approfondito
Recuperato
```

Sia il **piano annuale iniziale** sia il **piano finale effettivamente svolto** devono essere esportabili.

L'export deve poter produrre formati adatti almeno a:
- consultazione;
- stampa/PDF;
- archiviazione;
- eventuale consegna all'istituto;
- riutilizzo nell'anno successivo.

Il piano finale deve derivare dallo stato reale consolidato delle lezioni, non da una semplice copia del piano iniziale.

Questa sintesi può diventare utile per:
- documentazione finale;
- passaggio all'anno successivo;
- preparazione del piano futuro;
- comunicazioni richieste dall'istituto.

### 24.19 Programma dell'anno successivo

Lo storico reale deve poter alimentare il piano futuro.

Esempio:

```text
L'anno scorso Subnetting ha richiesto 14 h
anziché le 10 previste.

Vuoi usare 14 h come stima iniziale quest'anno?
```

Il docente decide.

### 24.20 Principio di minima gestione

La pianificazione deve aggiornarsi il più possibile dagli eventi già esistenti:
- calendario;
- lezioni svolte;
- note post-lezione;
- verifiche;
- modifiche del docente.

Non deve richiedere continui aggiornamenti manuali di stato.

### 24.21 Target iniziale vs evoluzione

Nelle prime versioni non serve implementare subito un planner sofisticato.

È sufficiente avere:
- calendario lezioni e scadenze;
- piano previsto essenziale basato sugli argomenti;
- stato degli argomenti svolti/parziali/non svolti;
- prossimi argomenti;
- ripianificazione semplice;
- collegamento con generazione delle lezioni;
- gestione base del rapporto piano ↔ verifiche;
- export del piano iniziale e del piano effettivamente svolto.

Funzioni più avanzate come ottimizzazione annuale, vincoli complessi e simulazioni possono arrivare dopo.

## 25. Annotazioni, comunicazioni e operatività accessoria — esperienza docente

### 25.1 Principio

Questa area deve raccogliere attività utili ma secondarie rispetto a lezioni, materiali, verifiche e pianificazione.

Non deve diventare un gestionale amministrativo completo.

Obiettivo:
- ridurre dispersione;
- evitare duplicazioni;
- mantenere il contesto;
- trasformare note e comunicazioni in elementi utili quando serve;
- non obbligare il docente a organizzare manualmente ogni informazione.

### 25.2 Annotazioni contestuali

Una nota deve poter essere creata da qualunque punto rilevante:
- classe;
- studente;
- lezione;
- verifica;
- materiale;
- calendario;
- comunicazione;
- home.

Il contesto deve essere associato automaticamente quando disponibile.

Esempio:

```text
Nota creata dalla lezione:
4B · Sistemi e Reti · Subnetting
21 ottobre

"Riprendere gli esercizi con VLSM prima della verifica."
```

Il docente non deve compilare manualmente classe, materia, data e collegamenti se il sistema li conosce già.

### 25.3 Note libere prima delle categorie

Le annotazioni devono rimanere prima di tutto testo libero.

Il sistema può suggerire categorie leggere:
- didattica;
- studente;
- promemoria;
- comportamento;
- verifica;
- materiale;
- comunicazione;
- amministrativa;
- privata.

Ma la classificazione non deve essere obbligatoria.

### 25.4 Nota vs azione

Una nota non è automaticamente un task.

Esempio:

> "La 4B ha trovato difficile il VLSM."

può rimanere semplice evidenza.

> "Preparare 5 esercizi VLSM per venerdì."

può essere riconosciuta come possibile azione.

Il sistema può chiedere o proporre:

```text
Vuoi trasformare questa nota in un promemoria?

"Preparare 5 esercizi VLSM per venerdì"

[Si]
[No]
```

Non deve creare task in modo incontrollato.

### 25.5 Promemoria e task

Il sistema deve supportare task leggeri.

Esempi:
- preparare una verifica;
- controllare un materiale;
- inviare una comunicazione;
- correggere 3 risposte dubbie;
- aggiornare una nota;
- ricordare una scadenza.

Ogni task può avere:
- contesto;
- scadenza;
- priorità;
- stato;
- origine.

La UI non deve trasformarsi in un task manager generalista.

### 25.6 Task automatici

Il sistema può creare o proporre task da eventi reali.

Esempi:

```text
La verifica di venerdì non è ancora pronta.
→ Controlla la bozza entro giovedì

Sono rimaste 4 correzioni dubbie.
→ Da controllare

Il piano annuale richiesto dalla scuola scade il 30 settembre.
→ Esporta e verifica il piano
```

Le attività automatiche devono essere deduplicate e raggruppate quando possibile.

### 25.7 "Da controllare" come inbox operativa

La Review Inbox già prevista può diventare il punto unico per eccezioni e attività che richiedono decisione.

Può contenere:
- correzioni dubbie;
- materiali da classificare;
- verifiche da approvare;
- conflitti di pianificazione;
- import da associare;
- comunicazioni preparate da approvare;
- modifiche con impatto su altri elementi.

Non deve contenere normali notifiche informative.

### 25.8 Notifiche informative vs azioni

Distinguere:

#### Informazione
```text
La verifica è stata esportata correttamente.
```

#### Azione richiesta
```text
3 risultati importati non sono associati a uno studente.
[Controlla]
```

Solo la seconda dovrebbe contribuire in modo forte a "Da controllare".

### 25.9 Comunicazioni

Il sistema deve poter aiutare il docente a preparare comunicazioni collegate al lavoro didattico.

Destinatari possibili:
- singolo studente;
- gruppo;
- classe;
- famiglia quando previsto;
- colleghi;
- coordinatore;
- istituto.

Esempi:
- avviso verifica;
- consegna materiale;
- recupero;
- richiesta di portare materiale;
- comunicazione su attività;
- riepilogo;
- messaggio individuale.

### 25.10 Generazione contestuale delle comunicazioni

La comunicazione deve poter essere preparata usando informazioni già presenti.

Esempio:

```text
"Avvisa la 4B che venerdì faremo la verifica
su SELECT, JOIN e GROUP BY e che devono
portare il portatile."
```

Il sistema conosce già:
- classe;
- data;
- verifica;
- argomenti;
- eventuali materiali allegati.

Il docente controlla il testo prima dell'invio secondo policy.

### 25.11 Canale separato dal contenuto

Come per le verifiche, il contenuto della comunicazione deve essere separato dal canale.

```text
COMUNICAZIONE
↓
DESTINATARI
↓
CANALE
```

Canali possibili:
- servizio interno;
- email;
- Teams;
- Google Classroom;
- piattaforme scolastiche;
- export/copia manuale.

Questo evita di modellare una "comunicazione Teams" come entità diversa da una "comunicazione email".

### 25.12 Integrazioni e fallback

Quando possibile:
- invio diretto tramite integrazione;
- pubblicazione su piattaforma esterna;
- allegati automatici;
- tracciamento dello stato tecnico dell'invio.

Quando non possibile:
- copia testo;
- export;
- download allegati;
- istruzioni minime per pubblicazione manuale.

Il core non deve dipendere da un singolo ecosistema esterno.

### 25.13 Bozza, approvazione e invio

Per le prime versioni distinguiamo:
- bozza;
- pronta;
- approvata;
- inviata/pubblicata.

**Nessuna comunicazione destinata a persone esterne al servizio deve essere inviata o pubblicata automaticamente.**

Il sistema può:
- preparare il testo;
- selezionare i destinatari;
- collegare gli allegati;
- proporre il canale;
- predisporre l'invio.

Ma prima dell'uscita dal servizio è sempre richiesta un'azione esplicita del docente.

L'automazione dell'invio potrà essere valutata solo in una fase futura, con policy dedicate e casi d'uso realmente giustificati.

### 25.14 Template e preferenze

Il docente può avere preferenze per:
- tono;
- lunghezza;
- formalità;
- firma;
- struttura;
- formule ricorrenti;
- lingua.

Queste preferenze seguono il modello gerarchico già definito quando utile:
- globale;
- materia;
- classe;
- tipo di comunicazione;
- singolo messaggio.

### 25.15 Comunicazioni come storico

Le comunicazioni importanti devono restare collegate al loro contesto.

Esempio:

```text
Verifica SQL
↓
Comunicazione inviata il 10 novembre
↓
24 destinatari
↓
Materiale allegato
```

Non serve trasformare il sistema in un client email completo.

### 25.16 Allegati e materiali

Una comunicazione può collegare:
- materiali già presenti;
- verifica;
- esercizi;
- file;
- link.

Non deve duplicare fisicamente i materiali già esistenti nel sistema.

### 25.17 Consegne e attività operative

Le attività assegnate agli studenti possono includere:
- esercizi;
- file da consegnare;
- attività pratiche;
- letture;
- lavori di gruppo;
- recuperi.

Nella Teacher Experience iniziale serve soprattutto:
- sapere cosa è stato assegnato;
- a chi;
- entro quando;
- chi ha consegnato;
- cosa manca;
- eventuale stato di correzione.

Non serve subito un LMS completo.

### 25.18 Creazione da altri oggetti

Una consegna deve poter nascere facilmente da:
- lezione;
- materiale;
- esercizio;
- verifica;
- recupero;
- comunicazione.

Esempio:

```text
Esercizi Subnetting
[Assegna alla 4B]
Scadenza: venerdì
```

### 25.19 Import da piattaforme esterne

Se attività e consegne avvengono su Teams, Classroom o altri servizi, il sistema deve poter importare quando possibile:
- stato consegna;
- file;
- punteggio;
- commenti;
- scadenze.

Quando l'integrazione non è disponibile, deve poter registrare almeno lo stato essenziale manualmente o via import.

### 25.20 Bozze automatiche da eventi

Alcuni eventi possono generare **bozze** automatiche.

Esempi:
- verifica pianificata;
- verifica spostata;
- materiale pubblicato;
- consegna imminente;
- recupero assegnato.

Esempio:

```text
Hai spostato la verifica SQL da venerdì a lunedì.

Bozza comunicazione alla 4B pronta.
[Controlla]
```

La bozza resta interna finché il docente non la approva e avvia esplicitamente l'invio o la pubblicazione.

### 25.21 Ricerca unificata

Il docente deve poter cercare anche in:
- note;
- comunicazioni;
- task;
- consegne.

Esempi:

> "Nota che avevo scritto sul laboratorio di reti."

> "Quando ho avvisato la 4B della verifica?"

> "Chi non ha consegnato gli esercizi di subnetting?"

### 25.22 Minimizzare la duplicazione

Se un'informazione esiste già, deve essere riutilizzata.

Esempio:
- la data della verifica viene dal calendario;
- gli argomenti dalla verifica;
- i destinatari dalla classe;
- gli allegati dai materiali;
- la scadenza dalla consegna.

Il docente non deve riscrivere gli stessi dati in ogni comunicazione.

### 25.23 Distinzione tra storico e stato attuale

Le note e comunicazioni storiche non devono affollare le viste operative.

La UI quotidiana deve privilegiare:
- elementi attivi;
- scadenze vicine;
- eccezioni;
- task aperti.

Lo storico resta ricercabile.

### 25.24 Privacy e visibilità

Annotazioni e comunicazioni possono avere sensibilità diversa.

Il sistema deve supportare almeno concettualmente:
- privato al docente;
- condiviso con altri docenti autorizzati;
- destinato allo studente;
- destinato alla famiglia;
- interno amministrativo.

Le regole definitive saranno trattate nel dossier Governance.

### 25.25 Attività automatiche completate

Quando il sistema svolge automaticamente un'attività **interna**, non deve necessariamente interrompere il docente.

Esempi:
- classificazione di un materiale;
- aggiornamento di una previsione;
- preparazione di una bozza;
- controllo di coerenza.

Queste attività possono finire nello storico.

Le attività che producono effetti esterni verso studenti, famiglie, colleghi o servizi terzi non devono invece essere completate automaticamente nelle prime versioni.

Un'attività interna diventa visibile in primo piano soprattutto se:
- fallisce;
- richiede approvazione;
- produce un conflitto;
- ha conseguenze importanti.

### 25.26 Target iniziale

Nelle prime versioni è sufficiente:
- annotazioni contestuali;
- promemoria semplici;
- "Da controllare";
- bozze di comunicazione;
- collegamento destinatari/materiali;
- stato essenziale delle consegne;
- ricerca basilare.

Non serve inizialmente:
- client email completo;
- chat completa;
- workflow amministrativi;
- task management avanzato;
- LMS completo;
- automazioni di comunicazione complesse.

### 25.27 Target futuro

Successivamente si possono aggiungere:
- automazioni avanzate;
- sincronizzazioni bidirezionali;
- template intelligenti;
- comunicazioni multicanale;
- workflow collaborativi;
- analytics sulle consegne;
- gestione più ricca di attività e gruppi.

Solo quando sbloccano valore reale.

## 26. Revisione complessiva e scope della Teacher Experience

### 26.1 Loop principale del prodotto

Dopo la revisione del dossier, il nucleo della Teacher Experience può essere sintetizzato così:

```text
CALENDARIO + PIANO + FONTI
          ↓
       LEZIONI
          ↓
 MATERIALI / ATTIVITÀ
          ↓
      VERIFICHE
          ↓
 CORREZIONI / RISULTATI
          ↓
PROGRAMMA EFFETTIVO
          ↓
   RIPIANIFICAZIONE
          ↺
```

Home settimanale, Class Workspace e "Da controllare" sono le superfici che rendono questo ciclo utilizzabile senza esporre la complessità interna.

### 26.2 Priorità del prodotto

#### Core iniziale — alta priorità

Da rendere realmente utilizzabile presto:
- classi + materie;
- calendario e orario;
- home settimanale;
- Class Workspace;
- lezioni;
- Lesson Plan;
- Teacher Script;
- Student Material;
- materiali/fonti;
- piano previsto e programma svolto;
- planner per argomenti;
- verifiche;
- correzione di base;
- "Da controllare";
- ricerca;
- preferenze essenziali;
- modifica/versionamento degli oggetti principali.

#### Supporto iniziale — minimo necessario

Da implementare solo quanto serve agli altri workflow:
- studenti;
- voti;
- annotazioni;
- consegne;
- comunicazioni;
- task/promemoria.

#### Evoluzione successiva

Da non usare come prerequisito per rendere utile il prodotto:
- profilazione avanzata degli studenti;
- analytics sofisticati;
- LMS completo;
- client email/chat;
- automazioni esterne senza approvazione;
- planner con ottimizzazione complessa;
- workflow collaborativi avanzati;
- personalizzazione individuale profonda;
- simulazioni annuali sofisticate.

### 26.3 Setup iniziale e bootstrap dei dati

È emersa una lacuna importante: il docente non deve impiegare ore a configurare il servizio prima di ricevere valore.

L'onboarding deve essere progressivo.

Il sistema deve poter acquisire, quando disponibili:
- classi;
- materie;
- orario;
- calendario scolastico;
- piani/programmi;
- materiali;
- verifiche già pianificate;
- eventuali elenchi studenti;
- preferenze essenziali.

Possibili canali:
- integrazioni;
- import file;
- import calendario;
- upload documenti;
- inserimento manuale minimo.

Il servizio non deve richiedere che tutto sia configurato prima di funzionare.

Primo utilizzo ideale:

```text
1. Classe + materia
2. Prossima lezione/data
3. Argomento
4. Eventuali fonti
5. Lesson pack utilizzabile
```

Dopo aver prodotto valore, il sistema può proporre progressivamente di collegare calendario, materiali e altre fonti.

### 26.4 Import prima della ricompilazione

Principio generale:

> se un'informazione esiste già in una fonte accessibile, preferire importarla o dedurla piuttosto che farla reinserire al docente.

Questo vale in particolare per:
- orari;
- calendari;
- classi;
- studenti;
- materiali;
- scadenze;
- verifiche;
- consegne.

Deve sempre esistere un fallback manuale semplice.

### 26.5 Output e portabilità degli artefatti

Gli artefatti principali non devono essere prigionieri dell'interfaccia del servizio.

Quando appropriato, il docente deve poter:
- visualizzare;
- modificare;
- stampare;
- esportare;
- condividere manualmente;
- produrre una versione docente e una versione studente.

Questo requisito riguarda almeno:
- Lesson Plan;
- Teacher Script;
- Student Material;
- esercizi;
- verifiche;
- soluzioni;
- rubriche;
- piano annuale iniziale;
- piano finale svolto;
- comunicazioni/bozze quando utile.

I formati concreti saranno scelti più avanti, ma PDF e formati modificabili comuni devono essere considerati casi fondamentali.

### 26.6 Coerenza tra sezioni

Alcuni concetti compaiono in più punti del dossier perché attraversano l'intero prodotto:
- Review Inbox / "Da controllare";
- previsto vs svolto;
- preferenze gerarchiche;
- versionamento;
- propagazione selettiva;
- ricerca;
- calendario.

Queste ripetizioni sono concettualmente intenzionali, ma in architettura devono corrispondere a primitive condivise e non a implementazioni duplicate.

### 26.7 Cosa non appartiene a questo dossier

Restano volutamente demandati ai dossier successivi:
- UX dello studente;
- modello curricolare dettagliato;
- assessment model formale;
- grading model completo;
- personalizzazione avanzata;
- policy di automazione;
- modello di configurazione;
- scelta degli strumenti AI/ML/deterministici;
- privacy, retention e autorizzazioni;
- architettura tecnica e deployment.

La Teacher Experience definisce **cosa deve poter fare e vedere il docente**, non ancora come ogni capacità sarà implementata.

### 26.8 Valutazione della completezza

Con le sezioni attuali, il dossier copre tutti i workflow quotidiani principali del docente:
- preparare;
- insegnare;
- registrare rapidamente ciò che è avvenuto;
- pianificare;
- gestire materiali;
- verificare;
- correggere;
- consultare risultati;
- prendere annotazioni;
- assegnare attività;
- preparare comunicazioni;
- gestire eccezioni.

Le questioni ancora aperte riguardano soprattutto **forma dell'interazione e piattaforme/dispositivi**, non buchi funzionali nel ciclo principale.

### 26.9 Decisioni emerse dalla revisione e approvate

Sono state approvate anche le seguenti decisioni trasversali:

1. onboarding progressivo, senza setup completo obbligatorio;
2. principio "importa/deduci prima di chiedere di reinserire";
3. fallback manuale semplice per ogni import essenziale;
4. portabilità trasversale degli artefatti principali, con output stampabili e modificabili comuni;
5. roadmap dei checkpoint successivi a T1 descritta sotto.

## 27. Decisioni approvate

Le seguenti decisioni sono state discusse e approvate:

1. la UI deve rimanere semplice, user-friendly e priva di tecnicismi;
2. home e Class Workspace devono prioritizzare frequenza, urgenza e contesto;
3. lezioni, materiali della settimana, classi e verifiche imminenti devono essere gli elementi più accessibili;
4. programma, voti, medie, storico e configurazioni restano facilmente accessibili ma secondari nel normale lavoro quotidiano;
5. una classe può contenere più materie, ma ogni materia mantiene un contesto didattico separato;
6. la sezione Lezioni deve essere centrata sulla settimana corrente e sulle lezioni vicine;
7. le lezioni future vengono preparate automaticamente in base a calendario, piano previsto, piano svolto, durata e fonti;
8. il sistema deve distinguere tra Lesson Plan, Teacher Script quasi verbatim e Student Material;
9. il Teacher Script deve poter essere abbastanza completo da sostenere quasi integralmente lezioni di più ore;
10. le lezioni future devono essere oggetti vivi, aggiornabili e dipendenti dallo stato reale del corso;
11. ogni elemento della lezione deve restare liberamente modificabile dal docente;
12. le modifiche manuali del docente devono essere preservate nelle successive rielaborazioni;
13. dopo una modifica, il sistema deve individuare e aggiornare o segnalare selettivamente gli elementi dipendenti;
14. il sistema deve distinguere sempre piano previsto e piano effettivamente svolto;
15. le verifiche devono basarsi per default sugli argomenti realmente affrontati;
16. la modalità durante la lezione deve essere disponibile e ottimizzata per uso rapido, ma mai obbligatoria;
17. il docente deve poter svolgere una lezione senza usare il sistema e aggiornare lo stato a posteriori in pochi secondi;
18. il sistema deve cercare di dedurre cosa è stato svolto da segnali minimi, chiedendo solo conferme semplici quando necessario;
19. il feedback post-lezione deve poter essere ridotto idealmente a una conferma o a poche correzioni;
20. lo stato reale della lezione aggiorna programma svolto, pianificazione futura, materiali e verifiche secondo le dipendenze;
21. le integrazioni e i dati esterni devono confluire nel servizio senza costringere il docente a ricordare dove si trovava originariamente ogni informazione;
22. il progetto deve restare free come vincolo di prodotto e architettura;
23. la classificazione automatica dei materiali è sempre modificabile manualmente;
24. anche i materiali caricati manualmente ricevono una classificazione proposta, mai obbligatoria;
25. un materiale può essere collegato contemporaneamente a più classi, materie, lezioni o altri contesti;
26. un materiale può rimanere volutamente generico e non associato a una classe o lezione specifica;
27. i collegamenti di contesto non devono creare copie del materiale;
28. la deduplicazione deve essere automatica dove affidabile, ma non deve distruggere versioni o contenuti ambigui;
29. la stessa risorsa proveniente da servizi diversi deve idealmente apparire una sola volta mantenendo però tutte le origini tracciate;
30. la selezione delle fonti per la generazione deve combinare regole strutturali, rilevanza, autorevolezza e istruzioni del docente;
31. le istruzioni del docente devono poter essere definite a livello globale, materia, classe, lezione e richiesta puntuale;
32. le istruzioni più specifiche prevalgono su quelle più generali;
33. il docente deve poter scegliere se un'istruzione è temporanea o persistente;
34. lo stesso modello gerarchico di istruzioni deve essere riutilizzabile anche nella generazione delle verifiche;
35. la ricerca esterna è una capacità nativa e ordinaria del sistema, non un semplice fallback;
36. il sistema può cercare autonomamente fonti esterne quando il patrimonio locale è insufficiente o quando la ricerca apporta valore;
37. la ricerca esterna deve essere guidata dal contesto e da un gap informativo concreto;
38. le fonti esterne devono essere valutate per autorevolezza, pertinenza, aggiornamento e qualità;
39. una fonte consultata esternamente non deve necessariamente essere salvata permanentemente nella libreria;
40. il docente deve poter controllare e limitare la ricerca esterna a livello globale, materia, classe, lezione o richiesta;
41. l'efficienza della ricerca esterna è un vincolo di progettazione, soprattutto per preservare il carattere free del progetto;
42. una verifica può avere qualunque numero di varianti, fino a una per studente;
43. il grado di diversificazione delle varianti deve essere configurabile;
44. le varianti devono restare equivalenti per obiettivi, difficoltà, durata e punteggio;
45. la verifica deve essere indipendente dal canale di svolgimento;
46. devono essere supportati, quando tecnicamente possibile, export verso servizi esterni e import dei risultati;
47. i risultati provenienti da servizi esterni devono essere ricondotti alla verifica, variante e studente corretti;
48. devono esistere fallback di import manuale o semi-automatico quando le integrazioni dirette non sono disponibili;
49. le regole di voto devono essere gerarchiche ed ereditarie;
50. le regole di voto possono definire minimo, massimo, decimali, step consentito, voti esclusi, arrotondamenti, soglie e conversioni punteggio-voto;
51. punteggio grezzo, voto proposto e voto finale devono rimanere concettualmente distinti;
52. il sistema deve poter produrre evidenze di possibile copiatura tra compagni e rispetto a fonti esterne;
53. queste evidenze non costituiscono automaticamente una decisione o sanzione: decide il docente;
54. le verifiche sono considerate in presenza e il prodotto non deve introdurre proctoring o monitoraggio comportamentale degli studenti;
55. una sessione di verifica può avere una mappa dei posti con assegnazione studente-posto e annotazioni rapide;
56. la mappa dei posti può essere usata anche per distribuire varianti meno simili tra studenti vicini e come semplice contesto per confrontare possibili copie;
57. la correzione automatica deve usare strategie diverse in base al tipo di risposta;
58. quando esistono verifiche deterministiche o eseguibili, devono essere preferite alla sola valutazione AI;
59. le risposte aperte devono essere valutate per criteri con evidenze e livello di certezza;
60. devono esistere soglie configurabili per auto-approvazione, batch review e review obbligatoria;
61. il sistema deve controllare la coerenza delle valutazioni tra risposte simili;
62. le correzioni del docente possono aggiornare rubriche o criteri e propagarsi a casi simili solo con controllo esplicito;
63. l'anti-copiatura può confrontare risposte tra studenti e contenuti con fonti/soluzioni pubblicamente disponibili;
64. AI detector, analisi dello stile, video, webcam, emotion recognition, focus/tab tracking, mouse/keyboard tracking e altri sistemi di profilazione comportamentale non fanno parte del prodotto;
65. l'Integrity Evidence deve restare limitata a evidenze concrete di possibile copiatura e al contesto strettamente utile alla verifica;
66. la progettazione tecnica deve scegliere lo strumento migliore per ciascun compito, senza assumere LLM come default;
67. quando esiste una soluzione deterministica, verificabile o più efficiente, deve essere preferita;
68. la selezione futura di strumenti e tecnologie dovrà includere ricerca comparativa di servizi free e progetti open-source coerenti con i requisiti reali del sistema;
69. il planner didattico deve essere centrato sugli argomenti e sul loro stato, non sulle ore come metrica principale;
70. il calendario è una componente centrale per lezioni, verifiche, periodi, scadenze e ripianificazione;
71. se una verifica contiene argomenti non ancora svolti, il sistema deve supportare sia lo spostamento della verifica sia l'adattamento dei contenuti mantenendo la data;
72. il piano annuale iniziale e quello finale effettivamente svolto devono essere entrambi esportabili;
73. nelle prime versioni nessuna comunicazione verso persone esterne al servizio deve essere inviata o pubblicata automaticamente;
74. il sistema può preparare automaticamente bozze, destinatari, allegati e canale, ma l'uscita dal servizio richiede sempre un'azione esplicita del docente;
75. l'automazione completa dell'invio potrà essere rivalutata solo in una fase futura;
76. la profilazione avanzata degli studenti non è una priorità delle prime versioni;
77. nelle prime versioni il modello studente deve contenere soprattutto identità, classe, risultati/voti, storico essenziale, annotazioni ed eventuali esigenze o accomodamenti espliciti;
78. la sezione Studenti iniziale deve servire soprattutto come supporto ai workflow di verifiche, voti, consegne, annotazioni e personalizzazioni minime;
79. analisi longitudinali, mastery model, gruppi suggeriti e profilazione didattica avanzata sono target futuri;
80. la home deve essere orientata principalmente alla settimana corrente, con oggi e la prossima lezione evidenziati;
81. l'onboarding deve essere progressivo e non richiedere la configurazione completa prima di poter usare il servizio;
82. quando dati utili esistono già in fonti accessibili, il sistema deve preferire import/deduzione alla ricompilazione manuale;
83. deve sempre esistere un fallback manuale semplice quando l'import automatico non è disponibile;
84. gli artefatti principali devono poter uscire dal servizio in forme stampabili e, quando appropriato, modificabili;
85. la roadmap iniziale dei checkpoint T1→T5 è approvata come sequenza di sviluppo prodotto, salvo rifiniture successive.

## 28. Foundation decisions proposte

Da considerare quasi certamente stabili:

1. esistenza di un `TeachingContext`;
2. esistenza di `Lesson` come oggetto di prima classe;
3. separazione `PlannedStudyPlan` / `ActualStudyPlan`;
4. separazione tra `LessonPlan`, `TeacherScript` e `StudentMaterial`;
5. fonti aggregate con provenance;
6. stato canonico distinto dagli artefatti derivati;
7. dipendenze esplicite tra gli oggetti derivati;
8. versionamento delle modifiche;
9. `ReviewItem` generico per l'intervento umano;
10. action model condiviso;
11. audit/activity separato dalla Review Inbox;
12. progressive disclosure;
13. configurazione contestuale;
14. preferenze esplicite/versionate;
15. tutte le attività significative collegate a tempo e contesto;
16. UI basata sul prossimo lavoro, non sui moduli.

## 29. Decisioni ancora aperte

- Quanto deve essere conversazionale la home rispetto ai controlli strutturati?
- Qual è la migliore relazione visiva tra home settimanale, calendario e "Da controllare"?
- Quanto deve essere possibile lavorare offline?
- Mobile è companion o client completo?
- Durante la lezione conviene progettare una modalità dedicata fullscreen?
- Quanto spazio dare ai suggerimenti proattivi?
- Qual è il limite generale tra automazione utile e sensazione di perdita di controllo, oltre alle policy già fissate per i singoli workflow?
- Quanto deve essere guidato il primo setup rispetto all'import automatico/progressivo?
- Quali formati di export devono essere garantiti nel core iniziale oltre a PDF e formati modificabili comuni?

## 30. Primo checkpoint UX possibile

### Checkpoint T1 — "Tomorrow is ready"

Obiettivo:

> Il docente apre il servizio e trova la prossima lezione già preparata da materiale e istruzioni preesistenti.

Esperienza:
1. seleziona/crea una classe;
2. definisce materia e prossimo argomento;
3. aggiunge fonti;
4. il sistema genera un lesson pack;
5. il docente vede un'unica schermata;
6. approva/modifica;
7. utilizza il materiale.

Il lesson pack include inizialmente:
- Lesson Plan;
- Teacher Script esteso e quasi verbatim;
- esempi;
- esercizi;
- soluzione;
- Student Material essenziale, quando utile.

Il checkpoint deve già distinguere gli artefatti destinati al docente da quelli destinati agli studenti.

### Perché è un buon checkpoint

È realmente utilizzabile ma obbliga a costruire primitive riusabili:
- classe;
- materia;
- TeachingContext;
- lesson;
- source;
- artifact;
- generation;
- review;
- version;
- preferences.

Non richiede ancora:
- studenti individuali;
- grading;
- calendario completo;
- personalizzazione;
- assessment engine completo.

Quindi è verticale senza essere enorme.

### Roadmap checkpoint approvata dopo T1

Questa roadmap è approvata come sequenza iniziale di sviluppo del prodotto e potrà essere rifinita senza alterarne il principio incrementale.

#### T2 — "My week is ready"

Il docente dispone di:
- home settimanale;
- calendario/orario;
- classi + materie;
- lezioni prossime;
- piano previsto semplice;
- stato degli argomenti svolti;
- materiali collegati;
- ripianificazione basilare.

Valore reale:
> non devo ricostruire ogni settimana cosa insegno e cosa devo preparare.

#### T3 — "The test is ready"

Aggiunge:
- blueprint;
- generazione verifica;
- soluzioni/rubrica;
- varianti;
- export stampabile/modificabile;
- collegamento al programma realmente svolto.

Valore reale:
> posso preparare una verifica completa partendo dal lavoro già fatto nel sistema.

#### T4 — "Corrections are under control"

Aggiunge:
- acquisizione risultati;
- correzione deterministica dove possibile;
- correzione assistita per criteri;
- review delle sole eccezioni;
- regole di voto;
- propagazione controllata dei criteri corretti dal docente.

Valore reale:
> gran parte della correzione ripetitiva viene eliminata mantenendo il controllo.

#### T5 — "Teacher daily loop"

Completa il primo ciclo operativo con:
- studenti minimi;
- annotazioni;
- consegne essenziali;
- bozze di comunicazione;
- ricerca più ampia;
- "Da controllare" trasversale;
- import/export essenziali.

Valore reale:
> il servizio diventa il punto quotidiano di lavoro senza cercare di essere già un LMS o gestionale completo.

Ogni checkpoint deve estendere il precedente senza sostituirne le fondamenta.

## 31. Metriche del checkpoint T1

- minuti necessari per preparare la lezione;
- percentuale lesson pack usata senza modifiche;
- numero medio di modifiche;
- tempo di review;
- contenuti rigenerati;
- motivi di rigenerazione;
- percentuale di fonti effettivamente utilizzate;
- frequenza di ritorno al sistema per la lezione successiva.

## 32. Stato del dossier

Il Dossier 01 — Teacher Experience è considerato **sostanzialmente chiuso**.

Restano aperte alcune scelte di dettaglio UX e di piattaforma:
- grado di conversazionalità della home;
- relazione visiva definitiva tra home, calendario e "Da controllare";
- offline;
- ruolo del mobile;
- eventuale modalità fullscreen durante la lezione;
- intensità dei suggerimenti proattivi;
- formati di export definitivi.

Questi punti non impediscono il passaggio ai dossier successivi e potranno essere risolti quando emergeranno vincoli più concreti da Student Experience, Automation, Configuration e Platform Architecture.

## 33. Collegamenti ai prossimi dossier

Questa UX impone domande che saranno risolte altrove:

- Student Experience: quali output della lezione diventano visibili agli studenti?
- Curriculum: come il sistema decide cosa viene dopo?
- Materials: come costruisce il lesson pack dalle fonti?
- Automation: quando parte automaticamente?
- Configuration: come eredita le preferenze?
- AI: come genera e verifica?
- Governance: quali dati può elaborare?
- Platform: come persistiamo e versioniamo tutto?
