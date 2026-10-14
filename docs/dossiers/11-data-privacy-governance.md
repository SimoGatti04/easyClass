# Dossier 11 — Data / Privacy / Governance

> Stato: proposta semplificata, non ancora approvata.
>
> Obiettivo: introdurre solo le protezioni realmente necessarie al prodotto, senza trasformare il Teacher Service in una piattaforma di compliance.

## 1. Principio

La governance iniziale deve essere semplice:

> raccogliere solo i dati che servono, dare accesso solo a chi ne ha bisogno, non inviare dati sensibili dove non devono andare e mantenere tracciabili soltanto le operazioni importanti.

Non costruire inizialmente:
- compliance engine;
- risk scoring;
- enterprise IAM;
- policy-as-code;
- registri regolatori complessi;
- monitoraggio degli studenti.

## 2. Verifiche in presenza

Le verifiche sono considerate **svolte in presenza**.

Il prodotto non prevede:
- webcam;
- registrazione video/audio;
- emotion recognition;
- attention tracking;
- mouse/keyboard tracking;
- focus/tab tracking;
- browser/app monitoring;
- behavioural profiling;
- remote proctoring.

La Digital Session, quando la verifica viene svolta sul nostro sistema, serve soltanto a:
- mostrare la prova;
- autosalvare;
- gestire timer quando previsto;
- gestire upload;
- consegnare;
- ripristinare la sessione in caso di problema tecnico.

## 3. Anti-copiatura: unico obiettivo di integrità

L'obiettivo è esclusivamente individuare **possibili copie**.

Possibili evidenze:

### Tra studenti
- risposte identiche o molto simili;
- stessi errori rari;
- stessa sequenza insolita di passaggi;
- somiglianze anomale nelle risposte aperte;
- risposta incompatibile con la variante assegnata;
- Seat Map come semplice contesto per sapere chi era vicino a chi.

### Da fonti esterne
- frasi identiche o fortemente sovrapponibili;
- porzioni copiate testualmente;
- corrispondenza con soluzioni o fonti pubblicamente disponibili.

Output:

~~~text
Possibile copiatura

Rossi / Bianchi
• 3 risposte molto simili
• stesso errore raro in 2 esercizi

[Confronta]
[Ignora]
[Aggiungi nota]
~~~

Il sistema mostra l'evidenza; **la decisione resta del docente**.

Non serve un AI detector e non serve analizzare lo stile dello studente.

## 4. Categorie dati minime

Per i primi checkpoint bastano quattro categorie operative.

### Public / non-personal
Materiali pubblici, documentazione, contenuti web, fonti senza dati personali.

### Teacher internal
Pianificazione, draft, preferenze, configurazioni e note non riferite a studenti.

### Student personal
Nome, classe, email opzionale, risposte, voti, feedback, tentativi e altri dati riferibili allo studente.

### Restricted
Accomodamenti, note sensibili o altri dati che richiedono protezione maggiore.

Le credenziali e API key sono secrets infrastrutturali e restano fuori dai dati di dominio.

## 5. Minimizzazione

Il sistema conserva solo ciò che serve.

Esempio:

~~~text
grading AI
needs:
- response
- rubric
- relevant sources

does not need:
- email
- all previous grades
- all teacher notes
~~~

Una capability AI riceve quindi una **projection minima** del contesto, non l'intero Student object.

## 6. Accomodamenti

Quando possibile separare:

~~~text
dato operativo
extra_time = 20 min
~~~

da:

~~~text
motivazione sensibile
~~~

La verifica deve conoscere il requisito operativo, non necessariamente la ragione sottostante.

## 7. Servizi locali, altre macchine e API

Il sistema può essere distribuito.

~~~text
Teacher Service
├─ oMLX su un Mac
├─ MinerU su un altro host
├─ Rizzo Flow su altra macchina
├─ retrieval service
└─ API esterne via OmniRoute
~~~

Distinguere soltanto due grandi destinazioni:

### Private / controlled
Macchine e server controllati dal deployment, anche se differenti.

### External
Provider/API esterni.

Il fatto che un servizio sia su un'altra macchina non lo rende automaticamente esterno.

## 8. Regola di routing dati

### Public / Teacher internal
Possono usare servizi privati e, quando configurato, provider esterni.

### Student personal
Preferire privato. Provider esterno solo quando utile e configurato, inviando il minimo necessario e rimuovendo identità quando non serve.

### Restricted
Privato di default.

Non esiste fallback automatico:

~~~text
servizio privato non disponibile
→ invia al cloud
~~~

per dati Restricted.

## 9. OmniRoute

OmniRoute è un gateway tecnico.

Può instradare modelli/API, ma non decide quali dati possono uscire.

Prima viene scelta una implementation consentita; poi eventualmente la richiesta passa da OmniRoute.

## 10. Student Session leggera

La selezione:

~~~text
link/codice classe
→ scegli studente
~~~

non è autenticazione forte.

È sufficiente inizialmente per:
- materiali pubblicati;
- comunicazioni;
- verifica assegnata;
- Attempt corrente;
- ricevuta.

Non deve mostrare:
- note docente;
- accomodamenti;
- dati sensibili;
- dettagli interni di grading;
- Integrity Evidence.

Se in futuro vogliamo pubblicare storico personale, voti e feedback privati completi, valuteremo autenticazione più forte.

## 11. Annotazioni

Le annotazioni sono importanti e devono essere facili da usare.

Una nota dovrebbe poter essere:
- normale;
- riservata;
- utilizzabile o non utilizzabile dall'automazione.

Non servono classificazioni più sofisticate nella prima versione.

## 12. Logging

I log normali devono contenere soprattutto metadata tecnici:

- request/action;
- componente;
- esito;
- errore;
- durata;
- riferimenti agli oggetti.

Evitare di copiare automaticamente nei log:
- risposte complete degli studenti;
- note sensibili;
- interi documenti;
- prompt contenenti dati personali.

## 13. Retention

Non fissiamo adesso una matrice complessa di retention.

Principio:

- conservare gli oggetti scolastici finché utili/necessari;
- eliminare file temporanei;
- cache, embeddings e indici sono rigenerabili;
- note o dati non più utili devono poter essere rimossi;
- backup e cancellazioni devono essere coerenti.

Le durate precise si decidono quando conosciamo il deployment reale.

## 14. Access control

Per il primo deployment può bastare un modello semplice.

Il docente vede i propri dati e le proprie classi.

I servizi tecnici ricevono soltanto ciò che serve al loro compito.

Esempio:

~~~text
MinerU
→ documento da parsare
→ nessun accesso all'elenco studenti

Embedding service
→ testo da indicizzare
→ nessun permesso di modificare voti
~~~

## 15. Audit minimo

Audit solo per operazioni importanti, per esempio:
- modifica voto finale;
- pubblicazione/riapertura verifica;
- modifica accomodamento;
- invio/pubblicazione esterna;
- cancellazioni importanti.

Non registrare ogni click.

## 16. Backup

Servono backup ripristinabili di:
- database canonico;
- documenti/file necessari;
- configurazioni importanti.

Cache, embeddings e output rigenerabili possono essere ricostruiti.

## 17. Deployment personale vs scolastico

Il prodotto deve poter funzionare inizialmente come servizio personale/private del docente.

Se in futuro viene adottato formalmente da un istituto, verificheremo in quel momento:
- ruoli e accessi;
- basi giuridiche;
- retention istituzionale;
- eventuale DPIA;
- requisiti specifici per funzioni AI valutative.

Non serve costruire ora un sistema dedicato alla compliance dell'istituto.

## 18. T1 resta semplice

Il checkpoint “Tomorrow is ready” richiede quasi soltanto:

~~~text
materiali
classe + materia
programma
pianificazione docente
Lesson Plan
Teacher Script
Student Material
~~~

Può quindi essere sviluppato e benchmarkato **senza dati personali individuali degli studenti**.

Questo deve essere il nostro primo confine operativo.

## 19. Governance gate prima di Assessment/Grading reali

Prima di usare T3/T4 con studenti reali devono essere presenti almeno:

- accesso corretto ai dati studente;
- routing privato/external coerente;
- minimizzazione degli input AI;
- gestione degli accomodamenti;
- backup;
- audit delle operazioni importanti.

Niente infrastruttura regolatoria ulteriore finché non emerge un bisogno concreto.

## 20. Foundation decisions approvate

1. governance minima e proporzionata al rischio;
2. verifiche considerate in presenza;
3. nessun proctoring o monitoraggio comportamentale;
4. anti-copiatura limitata al confronto delle risposte, varianti, fonti esterne e contesto della Seat Map;
5. decisione sulla copiatura sempre del docente;
6. quattro categorie dati operative semplici;
7. minimizzazione e projection degli input AI;
8. accomodamento operativo separato dalla motivazione sensibile quando possibile;
9. infrastruttura privata può essere multi-macchina;
10. external provider opzionali, non fallback impliciti per dati sensibili;
11. Student Session leggera non espone dati riservati;
12. annotazioni semplici con possibilità di marcarle riservate/escluse dall'automazione;
13. log content-minimized;
14. retention semplice e definita più precisamente solo quando serve;
15. least privilege tra servizi;
16. audit solo per operazioni importanti;
17. backup ripristinabili;
18. compliance istituzionale approfondita solo quando esiste un deployment scolastico reale;
19. T1 senza dati personali individuali;
20. governance minima operativa prima di Assessment/Grading con studenti reali.

## 21. Stato del dossier

Il Dossier 11 — Data / Privacy / Governance è considerato **approvato e stabile per i primi checkpoint** nella sua versione ridotta e pragmatica.

Sono consolidate in particolare:
- governance minima e proporzionata al rischio;
- verifiche in presenza;
- assenza di proctoring e monitoraggio comportamentale;
- anti-copiatura limitata a evidenze concrete tra risposte, varianti, fonti esterne e semplice contesto della Seat Map;
- decisione finale sempre del docente;
- categorie dati semplici;
- minimizzazione degli input AI;
- infrastruttura privata anche multi-macchina;
- provider esterni opzionali e senza fallback implicito per dati riservati;
- Student Session leggera esclusa dall'accesso a dati riservati;
- logging minimizzato;
- least privilege tra servizi;
- backup e audit essenziali;
- T1 realizzabile senza dati personali individuali degli studenti.

Le regole più dettagliate di compliance istituzionale restano volutamente rimandate a un eventuale deployment scolastico reale.
