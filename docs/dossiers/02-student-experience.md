# Dossier 02 — Student Experience

## 1. Domanda centrale

Qual è la minima esperienza studente necessaria affinché il Teacher Service funzioni bene nelle prime versioni, senza trasformare subito il progetto in un LMS o in una piattaforma scolastica completa?

La risposta iniziale è intenzionalmente semplice:

> **il prodotto è principalmente per il docente; lo studente deve poter accedere facilmente a ciò che il docente gli mette a disposizione e svolgere le verifiche, senza necessità di un account completo.**

## 2. Priorità di prodotto

Nelle prime fasi la Student Experience è **supporto al Teacher Experience**, non un prodotto autonomo equivalente.

Non dobbiamo investire inizialmente in:
- profilo studente avanzato;
- dashboard personale;
- autenticazione/account completi;
- gestione password;
- gamification;
- analytics personali;
- chat;
- community;
- portfolio;
- calendario personale sofisticato;
- personalizzazione self-service;
- gestione completa dei voti;
- LMS completo.

Queste capacità potranno essere valutate in futuro.

## 3. Scope iniziale

Lo studente deve poter fare essenzialmente quattro cose:

1. **accedere alla propria classe o a uno spazio condiviso dal docente;**
2. **vedere, leggere e scaricare materiali;**
3. **leggere comunicazioni;**
4. **svolgere e consegnare verifiche digitali.**

Eventualmente, quando serve al workflow:
- scaricare file/esercizi;
- caricare un allegato come risposta;
- riprendere una verifica interrotta;
- ottenere una conferma di consegna.

## 4. Nessun account completo, ma identità studente leggera

Non è richiesta una vera autenticazione studente con:
- username;
- password;
- recupero password;
- credenziali personali;
- gestione account tradizionale.

Il docente però può **configurare o importare l'elenco degli studenti della classe**, informazione che serve già alla Teacher Experience.

Lo studente, entrando nello spazio classe, seleziona il proprio profilo.

Esempio:

```text
Chi sei?

○ Rossi Mario
○ Bianchi Luca
○ Verdi Anna

[Continua]
```

Da quella selezione viene creata una sessione studente locale.

**Una sessione studente attiva è obbligatoria per accedere a qualunque sezione del sito lato studente.**

Senza profilo selezionato non devono essere accessibili:
- materiali;
- comunicazioni;
- verifiche;
- profilo;
- eventuali altre sezioni future.

Questa è **identificazione leggera**, non autenticazione forte.

Il sistema non deve fingere che la selezione del nome dimostri realmente l'identità della persona.

## 5. Accesso leggero senza account

"Senza account" non deve obbligarci a rendere ogni contenuto pubblicamente enumerabile.

Il modello iniziale può essere:

```text
LINK / CODICE CLASSE
        ↓
SELEZIONE PROFILO STUDENTE
        ↓
SESSIONE LOCALE
        ↓
CLASSE / MATERIALI / COMUNICAZIONI / VERIFICHE
```

Possibili ingressi:

### Link diretto alla classe

```text
https://servizio/.../classe/<token>
```

### Codice classe

```text
Classe: 4B
Codice: ABC123
```

Dopo l'ingresso, lo studente seleziona il proprio profilo tra quelli configurati dal docente.

Il token/codice classe:
- non costituisce un account personale;
- deve essere semplice da usare;
- può essere rigenerato/revocato dal docente;
- evita di rendere inutilmente enumerabili tutti gli spazi classe.

La sessione studente resta valida solo mentre almeno una scheda/finestra del browser è attivamente aperta sul sito.

Comportamento target:

```text
prima scheda aperta
→ selezione studente
→ sessione attiva

seconda/terza scheda
→ stessa sessione

chiudo una scheda ma ne resta almeno una
→ sessione invariata

chiudo l'ultima scheda del sito
→ sessione invalidata

nuovo accesso successivo
→ nuova selezione studente
```

Il dettaglio tecnico dovrà essere robusto rispetto ai limiti dei browser: non fare affidamento esclusivamente sugli eventi di chiusura pagina. La Platform Architecture definirà un meccanismo coordinato tra schede e una scadenza breve della sessione quando non risultano più client attivi.

## 6. Home / spazio classe studente

La UI iniziale deve essere estremamente semplice.

Esempio:

```text
4B · Informatica

MATERIALI
• JOIN SQL — scheda
• Esercizi JOIN
• Ripasso GROUP BY

COMUNICAZIONI
• Verifica SQL spostata a lunedì
• Portare il portatile venerdì

VERIFICHE
• SQL — disponibile
```

Non serve una dashboard analitica.

## 7. Materiali

Lo studente deve poter:
- vedere il titolo;
- leggere una descrizione essenziale;
- aprire il materiale;
- visualizzarlo nel browser quando possibile;
- scaricarlo;
- aprire eventuali link;
- distinguere materiali recenti/importanti.

Possibili tipi:
- PDF;
- documenti;
- slide;
- immagini;
- testo/Markdown/HTML;
- esercizi;
- link;
- file generici.

La UI non deve esporre provenance, workflow o metadati tecnici interni.

## 8. Organizzazione materiali

La vista studente deve seguire un'organizzazione semplice, ad esempio:
- recenti;
- per argomento;
- per lezione;
- eventualmente per periodo.

Non deve replicare la complessità della libreria del docente.

Il docente decide cosa è effettivamente pubblicato/visibile.

## 9. Comunicazioni

Nella prima versione le comunicazioni sono **read-only** lato studente.

Lo studente può:
- vedere le comunicazioni pertinenti;
- aprirle;
- vedere data e eventuali allegati/link.

Non servono inizialmente:
- risposte;
- chat;
- reazioni;
- thread;
- notifiche push;
- messaggistica privata.

Esempio:

```text
22 ottobre

Verifica SQL
La verifica prevista per venerdì è spostata a lunedì.
Gli argomenti restano SELECT, JOIN e GROUP BY.
```

## 10. Verifiche — accesso

Se esiste già una sessione studente attiva, la verifica non deve chiedere nuovamente nome, cognome o email.

La prova può essere aperta tramite:
- spazio classe;
- link diretto;
- codice verifica;
- eventuale QR in aula.

Esempio:

```text
Verifica SQL · 4B

Studente
Rossi Mario

[Inizia]
```

Il sistema ricava automaticamente:
- studente;
- classe;
- verifica;
- eventuale variante assegnata;
- eventuali regole specifiche.

Se nessuna sessione studente è presente, il sistema chiede prima di selezionare il profilo.

Lo studente non deve conoscere né inserire manualmente il codice della propria variante quando il sistema può determinarla dal contesto.

## 11. Identità studente e sessione

Nelle prime versioni esiste un'identità studente strutturata, ma **non autenticata**.

Il record studente è gestito dal docente e contiene almeno:
- identificativo interno;
- nome;
- cognome;
- classe/i associate;
- eventuale email facoltativa;
- eventuali dati minimi necessari ai workflow già previsti.

Nome e cognome non sono modificabili dallo studente.

La sessione studente deve mantenere distinti:
- identificativo dello studente;
- identificativo tecnico della sessione/browser;
- classi accessibili;
- verifica;
- variante;
- data/ora;
- eventuali dati temporanei di sessione.

Questo evita di usare una stringa nome/cognome come identità tecnica.

## 12. Sessione studente e sessione di verifica

La sessione studente nasce dalla selezione del profilo e può persistere nel browser/dispositivo.

Da questa sessione il sistema ricava:
- identità selezionata;
- classi accessibili;
- materiali visibili;
- comunicazioni pertinenti;
- verifiche disponibili.

Quando inizia una verifica viene creata anche una sessione tecnica della prova.

La sessione verifica deve poter supportare:
- autosalvataggio;
- ripristino dopo refresh/chiusura accidentale;
- allegati quando previsti;
- tempo di inizio;
- eventuale limite di tempo;
- stato in corso/consegnata;
- variante assegnata.

La sessione verifica deve essere collegata allo studente selezionato, non al semplice testo del nome.

Il dettaglio tecnico dei token/session storage sarà deciso nel Platform dossier.

## 13. Autosalvataggio

Durante una verifica le risposte devono essere salvate automaticamente.

La UI deve comunicare lo stato in modo discreto:

```text
Salvato
```

oppure, in caso di problema:

```text
Connessione assente.
Le risposte restano sul dispositivo e verranno inviate appena possibile.
```

La gestione offline completa sarà valutata successivamente, ma la perdita accidentale delle risposte deve essere minimizzata.

## 14. Tipi di risposta

La Student Experience deve poter visualizzare i tipi di domanda previsti dal sistema di verifica, ad esempio:
- scelta singola;
- scelta multipla;
- vero/falso;
- numerica;
- testo breve;
- testo lungo;
- riordinamento;
- matching;
- codice;
- upload file;
- esercizi strutturati.

La UI deve scegliere il controllo più naturale per ciascun tipo.

## 15. Navigazione durante la verifica

La prova deve mostrare chiaramente:
- progresso;
- domande risposte/non risposte;
- eventuale tempo residuo;
- possibilità di spostarsi tra le domande quando consentito;
- eventuali allegati o materiali ammessi.

Esempio:

```text
Verifica SQL

Domanda 5 di 12

● ● ● ● ○ ○ ○ ○ ○ ○ ○ ○

[Precedente] [Successiva]
```

Niente elementi non pertinenti durante la prova.

## 16. Consegna

Prima della consegna definitiva:

```text
Hai risposto a 11 domande su 12.

1 domanda è ancora vuota.

[Continua verifica]
[Consegna comunque]
```

Dopo la conferma, la submission deve essere immutabile lato studente salvo esplicita riapertura del docente.

## 17. Ricevuta di consegna

Dopo la consegna:

```text
Verifica consegnata

SQL · 4B
22 ottobre · 10:54

La consegna è stata registrata.
```

Può essere disponibile:
- identificativo/ricevuta;
- copia delle proprie risposte, se consentito;
- eventuale download.

Non mostrare automaticamente soluzione, voto o feedback se il docente non li ha pubblicati.

## 18. Piccolo profilo studente

Lo studente può avere una pagina profilo estremamente limitata.

Funzioni iniziali:
- vedere nome e cognome;
- vedere le classi associate;
- aggiungere o modificare la propria email facoltativa;
- "cambiare studente".

L'azione **Cambia studente** deve essere sempre facilmente accessibile dall'interfaccia lato studente, non nascosta in impostazioni profonde.

Quando viene usata:
- la sessione studente corrente viene invalidata;
- si torna alla selezione del profilo;
- eventuali sessioni di verifica in corso devono essere gestite secondo una policy esplicita, senza perdere risposte già salvate.

Nome, cognome e appartenenza alle classi restano gestibili solo dal docente.

Esempio:

```text
Profilo

Rossi Mario
4B

Email
mario.rossi@example.com
[Modifica]

[Cambia studente]
```

Non devono comparire configurazioni avanzate o dati scolastici non necessari.

## 19. Risultati e voti

Nelle prime versioni **non è necessario costruire un'area voti studente completa**.

Il sistema deve però essere progettato in modo che in futuro il docente possa decidere di pubblicare:
- voto;
- punteggio;
- feedback;
- correzione;
- soluzione.

Per ora la visualizzazione può essere assente o estremamente semplice.

## 20. Anti-copiatura lato studente

Quando la verifica è svolta nel nostro sistema, eventuali controlli previsti dal Teacher Experience devono essere implementati senza degradare inutilmente l'esperienza.

La UI deve:
- evitare distrazioni;
- rendere chiaro cosa è consentito;
- registrare solo i segnali previsti dalla policy;
- non accusare lo studente automaticamente;
- non mostrare "AI detector" o giudizi automatici.

## 21. Varianti

Lo studente non deve percepire la complessità del sistema di varianti.

Per lui esiste semplicemente:

```text
La tua verifica
```

Il sistema associa internamente:
- verifica;
- variante;
- sessione;
- eventuale identità dichiarata.

## 22. Errori e robustezza

Messaggi orientati al risultato.

Non:

```text
HTTP 500
```

Ma:

```text
Non riesco a salvare questa risposta in questo momento.

La risposta è ancora presente sul dispositivo.
[Riprova]
```

Oppure:

```text
Questo codice verifica non è valido o la prova non è più disponibile.
```

## 23. Mobile e responsive

Anche se il prodotto principale è per docenti, l'esperienza studente deve funzionare bene almeno su:
- smartphone;
- tablet;
- notebook/desktop.

Materiali e comunicazioni devono essere pienamente consultabili da mobile.

Per verifiche complesse il docente può eventualmente indicare un dispositivo consigliato/richiesto.

## 24. Accessibilità di base

La prima versione deve già evitare errori strutturali difficili da correggere dopo:
- HTML semantico;
- navigazione da tastiera;
- contrasto sufficiente;
- campi con label;
- messaggi di errore leggibili;
- non affidarsi solo al colore;
- layout responsive.

Non serve costruire subito un sistema avanzato di personalizzazione accessibilità, ma la base deve essere corretta.

## 25. Privacy by minimization

Poiché non vogliamo account studente completi, il modello iniziale deve raccogliere il minimo necessario.

Per consultare materiali:
- identità studente selezionata solo se necessaria alla classe/sessione;
- nessun ulteriore dato personale obbligatorio.

Per il profilo:
- nome/cognome gestiti dal docente;
- email facoltativa modificabile dallo studente.

Per verifiche:
- identificativo studente già presente nella sessione;
- dati tecnici necessari alla prova.

Retention, autorizzazioni e privacy dettagliate saranno definite nel dossier Governance.

## 26. Cosa migliorare rispetto a portale-classi

`portale-classi` resta solo un riferimento operativo, non una base architetturale.

Manteniamo le idee semplici che funzionano:
- accesso immediato;
- classe come ingresso naturale;
- materiali;
- comunicazioni;
- verifica con codice;
- autosave;
- allegati;
- possibilità di riprendere una sessione.

Da rendere più solido:
- identità studente strutturata gestita dal docente;
- selezione del profilo senza login;
- sessione tecnica persistente distinta dall'identità;
- recupero sessione non basato sul testo del nome;
- controlli di accesso leggeri;
- associazione robusta verifica/variante/sessione;
- gestione errori;
- prevenzione doppie consegne;
- stato di disponibilità della prova;
- UX responsive;
- ricevuta di consegna;
- componenti e contratti riutilizzabili;
- modello estendibile verso eventuali account futuri senza richiederli oggi.

## 27. Target iniziale

### S1 — "Students can consume"

Lo studente:
- apre classe/spazio;
- seleziona una volta il proprio profilo;
- mantiene una sessione locale;
- vede materiali;
- legge comunicazioni;
- apre/scarica contenuti;
- può modificare solo la propria email facoltativa.

### S2 — "Students can take a test"

Aggiunge:
- identificazione minima;
- codice/link prova;
- sessione robusta;
- autosave;
- domande;
- allegati;
- consegna;
- ricevuta.

Questi due checkpoint sono sufficienti per supportare i primi checkpoint Teacher Experience.

## 28. Target futuro

Solo successivamente valutare:
- account studente;
- login;
- profilo personale;
- storico personale;
- voti/feedback completi;
- consegne più ricche;
- notifiche;
- calendario personale;
- personalizzazione;
- esercitazioni autonome;
- percorsi di recupero;
- messaggistica;
- dashboard;
- portfolio;
- funzionalità collaborative.

Queste capacità non devono condizionare l'architettura UX delle prime versioni, ma il modello dati non deve renderle impossibili.

## 29. Decisioni approvate

Le seguenti decisioni sono state discusse e approvate:

1. nelle prime versioni il servizio è principalmente teacher-first;
2. la Student Experience iniziale deve restare minimale;
3. nessun account/login completo per gli studenti;
4. il docente configura/importa gli studenti della classe;
5. lo studente seleziona il proprio profilo e da questo viene creata una sessione locale;
6. una sessione studente attiva è obbligatoria per navigare in qualsiasi sezione lato studente;
7. la sessione resta valida finché almeno una scheda/finestra del sito rimane attiva e viene invalidata dopo la chiusura dell'ultima;
8. nome e cognome sono gestiti solo dal docente;
9. email facoltativa modificabile dallo studente;
10. la sessione studente determina classi, materiali, comunicazioni e verifiche accessibili;
11. materiali consultabili e scaricabili;
12. comunicazioni read-only;
13. verifiche digitali svolgibili direttamente nel servizio;
14. accesso alla classe tramite link/codici leggeri;
15. autosalvataggio e ripristino robusto delle verifiche;
16. sessione tecnica distinta dall'identità studente;
17. ricevuta di consegna;
18. il comando "Cambia studente" deve essere sempre facilmente accessibile;
19. nessuna area voti/profilo avanzato necessaria nella prima fase;
20. UI semplice, responsive e più solida rispetto a portale-classi;
21. eventuale Student Experience ricca rimandata a una fase successiva;
22. il sistema considera questa modalità identificazione leggera e non autenticazione forte.

## 30. Stato del dossier

Il perimetro iniziale della Student Experience è considerato **sostanzialmente definito**.

Resta da definire tecnicamente, nel dossier Platform Architecture, il meccanismo che:
- coordina più schede/finestra dello stesso sito;
- mantiene viva una sola sessione studente condivisa finché almeno una scheda è attiva;
- invalida la sessione dopo la chiusura dell'ultima scheda;
- gestisce correttamente crash, browser terminati e dispositivi sospesi;
- evita la perdita di una sessione verifica già salvata.

Questa scelta tecnica non modifica il comportamento UX approvato.
