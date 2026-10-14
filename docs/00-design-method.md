# 00 — Metodo di progettazione

## Principio centrale

Il servizio deve evolvere per **checkpoint realmente utilizzabili**, ognuno dei quali introduce un miglioramento concreto dell'esperienza, senza costruire prototipi usa-e-getta.

## Principio di semplicità architetturale

Il progetto deve evitare l'overengineering.

Principi:
- usare il metodo meno complesso che garantisce il miglior risultato pratico;
- progettare componenti con responsabilità chiare;
- rendere generici e riutilizzabili i componenti quando ciò non degrada qualità, semplicità o prestazioni;
- evitare accoppiamenti inutili tra domini;
- definire contratti chiari tra componenti;
- rendere sostituibili gli elementi variabili;
- non introdurre distribuzione, code, servizi separati o infrastruttura solo per anticipare bisogni futuri.

L'obiettivo non è costruire un monolite indivisibile, ma neppure una rete di microservizi prematuri.

La regola è:

> **modularità sempre; distribuzione solo quando porta un beneficio concreto.**

Un componente può evolvere in servizio autonomo quando esistono ragioni reali, ad esempio:
- carico o scaling indipendente;
- isolamento di sicurezza;
- dipendenze/runtime molto diversi;
- riuso da altri progetti;
- ciclo di rilascio indipendente;
- fault isolation utile;
- necessità di esecuzione separata.

Quando queste ragioni non esistono, è preferibile mantenere il componente nello stesso deployment pur preservando un confine modulare forte.

Dove opportuno, i componenti generici devono poter essere riutilizzati da altri progetti attraverso API, librerie o servizi ben definiti.

Quando una capacità generica richiede comportamento specifico per questo prodotto, preferire:

```text
COMPONENTE GENERICO RIUSABILE
        ↓
ADAPTER / DOMAIN LAYER SPECIFICO
        ↓
TEACHER SERVICE
```

Esempi possibili:
- document parsing generico + classificazione didattica specifica;
- similarity engine generico + anti-copiatura specifico;
- grading engine generico + policy scolastiche specifiche;
- search/retrieval generico + ranking contestuale per classe/materia;
- notification service generico + regole di priorità del docente.

Il dominio specifico non deve contaminare inutilmente il componente generico. Allo stesso tempo non bisogna forzare la genericità quando ciò produce astrazioni artificiali o peggiora qualità e semplicità.

Anche i componenti non riutilizzabili esternamente devono comunque:
- avere responsabilità chiare;
- esporre contratti stabili;
- limitare le dipendenze;
- poter essere sostituiti senza propagare cambiamenti in tutto il sistema;
- separare dominio, infrastruttura e integrazioni quando utile.

## Vincolo economico del prodotto

Il progetto deve essere **free**.

Questo viene trattato come vincolo architetturale, non come dettaglio commerciale successivo.

Il core deve quindi poter funzionare end-to-end senza dipendenze obbligatorie da:
- API AI a pagamento;
- SaaS a pagamento;
- database o code proprietarie;
- licenze commerciali necessarie al funzionamento;
- servizi cloud obbligatori.

Sono ammesse integrazioni opzionali con servizi esterni, inclusi eventuali servizi a pagamento scelti dall'utente, ma non devono essere necessarie per il funzionamento fondamentale.

Per l'uso opzionale di gateway AI come OmniRoute, l'utente/Domain Owner gestisce direttamente abbonamento, disponibilità dei modelli e ogni decisione economica nel gateway. Teacher Service rispetta la configurazione dei modelli consentiti esposta dal gateway, ma non ispeziona piani o billing, non stima spesa e non impone quote monetarie. Restano possibili limiti tecnici di una singola prova (chiamate, token e retry), che non sono controlli economici né limiti generali del prodotto.

Durante la progettazione tecnica dovremo distinguere:
- software gratuito/open-source;
- servizi con free tier;
- costi infrastrutturali inevitabili di hosting/hardware;
- integrazioni opzionali;
- alternative locali/self-hosted.

Ogni checkpoint deve avere una modalità realmente utilizzabile coerente con questo vincolo.

L'obiettivo è combinare:

- **stabilità strutturale**: le fondamenta corrette vengono progettate presto;
- **verticalità**: ogni checkpoint attraversa tutti i layer necessari per offrire una funzione completa;
- **incrementalità**: ogni checkpoint estende il precedente;
- **retrocompatibilità concettuale**: il dominio non viene reinventato ad ogni iterazione;
- **rapidità di apprendimento**: il servizio viene utilizzato presto per verificare le ipotesi di prodotto.

## Anti-pattern da evitare

### 1. Prototype trap
Costruire velocemente funzionalità scollegate e rifare tutto quando il prodotto cresce.

### 2. Architecture astronautics
Progettare mesi di infrastruttura senza una singola esperienza realmente utilizzabile.

### 3. Horizontal delivery
Implementare prima tutto il database, poi tutte le API, poi tutta la UI, senza un prodotto funzionante fino alla fine.

### 4. AI-first design
Scegliere agenti, modelli e prompt prima di definire l'esperienza e il dominio.

### 5. Feature accumulation
Aggiungere moduli indipendenti finché il docente deve capire come combinarli da solo.

## Regola del checkpoint

Ogni checkpoint deve soddisfare contemporaneamente quattro condizioni:

1. **Useful** — risolve davvero una parte del lavoro docente.
2. **End-to-end** — comprende UX, dominio, persistenza, automazione e supervisione necessari.
3. **Stable foundation** — le primitive introdotte sono pensate per essere riutilizzate.
4. **Measurable** — possiamo osservare se riduce tempo, errori o attrito.

## Due tipi di decisione

Durante ogni dossier separiamo:

### Foundation decisions
Decisioni che vogliamo rendere stabili presto.

Esempi:
- concetto di Teaching Context;
- versionamento degli artefatti;
- gerarchia di configurazione;
- provenance;
- approval model.

### Evolution decisions
Decisioni intenzionalmente rimandabili.

Esempi:
- provider AI;
- framework frontend;
- algoritmo specifico di ranking;
- forma esatta di una dashboard secondaria.

Questo impedisce sia rigidità prematura sia continue rifondazioni.

## Vertical Slice Contract

Ogni futuro checkpoint deve descrivere:

- problema utente risolto;
- scenario reale;
- entry point;
- azioni automatiche;
- punto di supervisione;
- risultato finale;
- nuove primitive introdotte;
- primitive riutilizzate;
- failure modes;
- metriche;
- non-goals.

## Criterio di solidità

Una base è considerata "solida" non perché supporta in anticipo ogni possibile feature, ma perché:

- rappresenta correttamente il dominio;
- espone confini chiari;
- evita coupling accidentale;
- supporta versionamento e audit;
- consente estensioni senza bypassare le invarianti;
- ha adapter per ciò che sappiamo essere variabile;
- non incorpora ipotesi UX transitorie nel modello dati.

## Cadenza progettuale

Per ciascun dossier:

1. obiettivo;
2. utenti/scenari;
3. problemi;
4. esperienza ideale;
5. concetti di dominio;
6. decisioni stabili;
7. decisioni aperte;
8. edge cases;
9. implicazioni sugli altri dossier;
10. primi checkpoint possibili;
11. domande da validare.

## I 12 dossier

1. Teacher Experience
2. Student Experience
3. Curriculum & Planning
4. Knowledge & Materials
5. Assessment System
6. Grading & Feedback
7. Personalization
8. Automation Model
9. Configuration Model
10. AI Architecture
11. Data / Privacy / Governance
12. Platform Architecture

## Relazione tra i dossier

Non sono indipendenti.

```text
Teacher Experience ─┐
Student Experience ─┼──► Domain
Curriculum ─────────┤
Materials ──────────┤
Assessment ─────────┤
Grading ────────────┤
Personalization ────┘
                     │
                     ▼
          Automation + Configuration
                     │
                     ▼
                  AI model
                     │
                     ▼
             Governance / Data
                     │
                     ▼
       Feasibility / Benchmark Gate
              su dati reali
                     │
                     ▼
          Platform Architecture
```

Prima della Platform Architecture deve quindi esistere un gate di fattibilità sui componenti che sostengono il primo vertical slice. L'obiettivo non è benchmarkare tutto, ma verificare con dati reali parsing, retrieval, modelli e integrazione end-to-end prima di progettare l'infrastruttura intorno a ipotesi non validate.

L'architettura tecnica viene quindi derivata dal prodotto **e da foundation tecniche già dimostrate fattibili**, non viceversa.
