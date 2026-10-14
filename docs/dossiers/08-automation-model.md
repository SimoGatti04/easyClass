# Dossier 08 — Automation Model

## 1. Domanda centrale

Come far sì che il sistema completi autonomamente il maggior lavoro possibile senza perdere controllo, tracciabilità e prevedibilità, e senza costringere il docente a supervisionare ogni micro-operazione?

L'obiettivo non è massimizzare il numero di azioni automatiche.

L'obiettivo è minimizzare il lavoro umano inutile mantenendo il docente autorevole sulle decisioni importanti.

## 2. Principio fondamentale

L'automazione deve essere **policy-driven, contestuale e subordinata allo stato canonico**.

Non esiste quindi un unico interruttore:

```text
AI AUTOMATICA: ON / OFF
```

ma una decisione per azione:

```text
TRIGGER
+ CONTESTO
+ POLICY
+ PRECONDIZIONI
+ IMPATTO
+ REVERSIBILITÀ
+ INCERTEZZA
        ↓
AUTOMATION DECISION
        ↓
esegui / prepara / proponi / chiedi review / blocca
```

## 3. Vincoli già approvati

Questo dossier assume come già deciso:

- modifiche manuali del docente sono canoniche;
- dipendenze tra oggetti sono esplicite;
- aggiornamenti downstream devono essere selettivi;
- Review Inbox è unica e trasversale;
- confidence e review policy sono concetti distinti;
- nessuna comunicazione esterna viene inviata automaticamente nelle prime versioni;
- bozze possono essere preparate automaticamente;
- verifiche/materiali possono essere rigenerati o aggiornati secondo policy;
- Final Grade confermato non viene sovrascritto automaticamente;
- accomodamenti autorizzati possono costituire vincoli;
- Integrity Evidence non produce sanzioni automatiche;
- annotazioni possono essere escluse dall'automazione;
- preferenze persistenti richiedono scelta/approvazione esplicita;
- il sistema deve evitare notifiche per attività automatiche riuscite normalmente.

## 4. Automation Action

L'unità fondamentale dell'automazione è una `Automation Action`.

Un'Action rappresenta un'intenzione applicativa concreta, per esempio:

- prepara la prossima lezione;
- aggiorna una Planning Projection;
- classifica un materiale;
- crea una nuova Artifact Version;
- genera una bozza di verifica;
- correggi Item deterministici;
- prepara feedback;
- crea un ReviewItem;
- sincronizza metadati;
- suggerisci un adattamento;
- pubblica/invia un contenuto.

L'Action deve parlare il linguaggio del dominio, non quello dell'infrastruttura.

## 5. Action Contract

Ogni tipo di Action dovrebbe dichiarare concettualmente:

- input richiesti;
- precondizioni;
- effetti previsti;
- oggetti letti;
- oggetti modificati/creati;
- reversibilità;
- impatto;
- eventuali side effect esterni;
- policy applicabile;
- failure modes;
- idempotenza attesa;
- necessità o meno di review.

Il dettaglio tecnico sarà definito nella Platform Architecture.

## 6. Trigger

Una Automation Action può nascere da trigger diversi:

- comando esplicito del docente;
- evento di dominio;
- modifica di stato;
- scadenza/calendario;
- nuova fonte/import;
- dependency change;
- risultato di grading;
- sincronizzazione esterna;
- condizione rilevata;
- job pianificato.

Esempi:

```text
lezione domani
→ prepara lesson pack

Resource Version aggiornata
→ analizza Artifact dipendenti

Assessment tra 5 giorni
→ prepara bozza verifica

Criterion Evaluation incerta
→ crea ReviewItem
```

## 7. Trigger non implica esecuzione

Il fatto che un trigger si verifichi non significa che l'Action debba essere eseguita.

Il trigger crea una **Automation Candidate** o richiesta di valutazione.

Solo dopo vengono controllati:

- precondizioni;
- policy;
- conflitti;
- freshness;
- impatto;
- confidence;
- autorizzazioni;
- eventuali lock/manual override.

## 8. Livelli di autonomia

Propongo una scala concettuale comune:

### L0 — Disabled

Nessuna automazione per quella capability.

### L1 — Detect

Il sistema rileva una situazione ma non propone ancora un'azione.

### L2 — Suggest

Propone cosa fare.

### L3 — Prepare

Prepara una bozza/versione senza applicarla al mondo esterno.

### L4 — Execute internal

Esegue automaticamente un'azione interna, reversibile e coerente con policy.

### L5 — Execute external / high-impact

Comporta side effect esterni o decisioni ad alto impatto.

Nelle prime versioni questo livello richiede normalmente approvazione esplicita e, per alcune categorie, resta disabilitato.

Questa scala è concettuale: la UI può usare parole semplici.

## 9. Preparare non significa pubblicare

Distinzione fondamentale:

```text
GENERARE
≠
APPLICARE
≠
PUBBLICARE / INVIARE
```

Esempio:

```text
crea bozza comunicazione
→ automatico

invia comunicazione
→ approvazione esplicita nelle prime versioni
```

Lo stesso principio vale per feedback, verifiche, materiali studenti e sincronizzazioni esterne.

## 10. Internal vs external side effects

Le Actions devono distinguere:

### Internal

Modificano solo lo stato interno del servizio.

Esempi:

- creare una bozza;
- aggiornare un indice;
- preparare una nuova Artifact Version;
- marcare un oggetto stale;
- creare un ReviewItem.

### External

Producono un effetto fuori dal servizio.

Esempi:

- inviare email;
- pubblicare materiale;
- sincronizzare voto nel registro;
- creare/modificare un Form esterno;
- inviare messaggio a studenti.

Le Actions esterne hanno policy più conservative.

## 11. Reversibilità

Un'altra dimensione fondamentale è:

- facilmente reversibile;
- reversibile con conseguenze;
- difficilmente reversibile;
- irreversibile.

Esempio:

```text
creare bozza interna
→ facilmente reversibile

pubblicare un voto
→ reversibile con conseguenze

inviare una comunicazione
→ non realmente ritirabile
```

Più un'azione è difficile da annullare, più alta deve essere la soglia di controllo.

## 12. Impact class

Ogni Action può avere una classe d'impatto concettuale.

Esempi:

### Low

- indicizzazione;
- deduplica esatta;
- creazione di bozza;
- aggiornamento metadata.

### Medium

- rigenerazione di materiale non pubblicato;
- ripianificazione futura;
- regrading proposto;
- modifica batch di collegamenti.

### High

- modifica di Final Grade;
- pubblicazione risultati;
- modifica target di Assessment;
- invio esterno;
- cancellazione/archiviazione distruttiva;
- decisioni che coinvolgono accomodamenti obbligatori.

Non serve mostrare queste categorie nella UI.

## 13. Automation Policy

Una `Automation Policy` decide il livello di autonomia ammesso per una capability in un dato contesto.

Può dipendere da:

- action type;
- ambito;
- classe/materia;
- tipo di Artifact;
- confidence;
- impact class;
- reversibilità;
- presenza di side effect esterni;
- stato dell'oggetto;
- manual override;
- requirement/accomodamenti;
- eventuali vincoli Governance.

Le regole di ereditarietà verranno formalizzate nel Dossier 09.

## 14. Policy result

Il risultato della valutazione può essere almeno:

- execute;
- prepare draft;
- suggest;
- require review;
- blocked;
- no-op.

`no-op` è importante: molte volte la cosa migliore è non fare nulla.

## 15. Preconditions

Un'Action non deve partire solo perché la policy consente automazione.

Deve prima verificare le proprie precondizioni.

Esempi:

- lesson context sufficiente;
- source set disponibile;
- Assessment ancora modificabile;
- Student mapping certo;
- accomodamento autorizzato;
- dipendenze non in conflitto;
- oggetto non già elaborato alla stessa versione.

Precondizione fallita può produrre no-op, retry o review a seconda del caso.

## 16. Hard constraints vs soft signals

Distinguere:

### Hard constraint

Non può essere ignorato automaticamente.

Esempi:

- Requirement autorizzato;
- Final Grade manuale protetto;
- Form già iniziata/frozen;
- permesso mancante;
- policy Governance.

### Soft signal

Contribuisce alla decisione ma può essere superato dalla policy/docente.

Esempi:

- source confidence media;
- possibile materiale più recente;
- stima di difficoltà;
- suggerimento di recupero.

## 17. Conflict

Un `Automation Conflict` nasce quando due regole o stati non possono essere soddisfatti contemporaneamente.

Esempi:

- accomodamento consente calcolatrice, Assessment la vieta;
- docente ha modificato manualmente Artifact mentre una rigenerazione era in preparazione;
- due fonti autorevoli hanno versioni incompatibili;
- calendario sposta la lezione oltre la verifica.

Il sistema non deve risolvere silenziosamente conflitti ad alto impatto.

## 18. ReviewItem

`ReviewItem` è l'interfaccia trasversale tra automazione e supervisione umana.

Una Automation Action genera ReviewItem solo quando serve davvero una decisione.

Motivi tipici:

- approval required;
- conflict;
- low confidence;
- high impact;
- policy requirement;
- incomplete context;
- external side effect;
- failed automation;
- manual change conflict.

## 19. ReviewItem minimo

Deve spiegare almeno:

- cosa è successo;
- perché serve attenzione;
- impatto;
- proposta;
- evidenze essenziali;
- azioni disponibili;
- scadenza se rilevante.

Esempio:

```text
La verifica SQL usa SUBQUERY,
ma l'argomento risulta ancora parziale.

[Adatta verifica]
[Sposta verifica]
[Mantieni così]
```

## 20. Review state

Possibili stati concettuali:

- open;
- snoozed;
- resolved;
- dismissed;
- superseded;
- expired.

Un ReviewItem superato da eventi successivi non deve restare nella inbox come problema attivo.

## 21. Review deduplication

La stessa causa non deve generare dieci ReviewItem.

Esempio:

```text
Resource X aggiornata
→ 8 Artifact potenzialmente impattati
```

meglio:

```text
1 ReviewItem
8 elementi coinvolti
```

quando la decisione è comune.

## 22. Batch review

Azioni omogenee devono poter essere approvate o risolte in batch.

Esempio:

```text
20 feedback high confidence
3 da controllare

[Approva i 20]
```

Il batch non deve nascondere differenze sostanziali.

## 23. Automation Run

Ogni esecuzione significativa può essere rappresentata da una `Automation Run`.

Stati concettuali:

- planned/candidate;
- evaluating;
- running;
- waiting review;
- completed;
- partially completed;
- failed;
- cancelled;
- superseded.

Non tutte le micro-operazioni devono diventare oggetti visibili al docente.

## 24. Automation Run provenance

Una Run deve poter ricostruire:

- trigger;
- action type;
- contesto;
- input/versioni;
- policy/versione;
- decisione presa;
- output;
- side effect;
- review collegata;
- errori;
- eventuali retry.

Questo appartiene all'audit/activity, non alla normale UX.

## 25. Activity Log vs Review Inbox

Separazione fondamentale:

```text
ACTIVITY LOG
cosa è successo

REVIEW INBOX
cosa richiede una decisione
```

Le automazioni riuscite vanno nell'Activity Log e non occupano `Da controllare`.

## 26. Dependency propagation

Quando cambia un oggetto upstream, il sistema non deve rigenerare immediatamente tutto.

Processo proposto:

```text
CHANGE
↓
calcola dependency impact
↓
marca dipendenze stale/potentially stale
↓
valuta policy per ciascun impatto
↓
no-op / update / prepare / review
```

Questo evita cascade incontrollate.

## 27. Stale non significa invalid

Un Artifact dipendente da una fonte cambiata può essere:

- ancora valido;
- potenzialmente obsoleto;
- sicuramente obsoleto.

Non trattare ogni cambio upstream come necessità di rigenerazione.

## 28. Selective recomputation

Una modifica deve aggiornare solo ciò che dipende realmente dalla parte cambiata quando il sistema dispone di granularità sufficiente.

Esempio:

```text
modifica Item 4
→ aggiorna soluzione/rubrica/varianti coinvolte
≠ rigenera intero Assessment
```

Lo stesso principio vale per Lesson, Artifact, Grading e Planning.

## 29. Manual edits as anchors

Una modifica manuale significativa del docente deve essere trattata come anchor/protected state.

Un'Automation Action non la sovrascrive silenziosamente.

Può:

- preservarla;
- creare nuova proposta parallela;
- fare merge quando sicuro;
- generare conflict/review.

## 30. Derived state can be regenerated

Distinguere chiaramente:

- canonical/manual state;
- derived state;
- released/external state.

Il derived state può essere rigenerato.

Il canonical state richiede rispetto delle regole di modifica.

Il released state può richiedere una nuova release/versione invece di overwrite.

## 31. Idempotency

Una stessa Action ripetuta con gli stessi input/versioni non dovrebbe produrre duplicati o effetti multipli involontari.

Esempi:

- import dello stesso file;
- preparazione della stessa lezione;
- sync dello stesso risultato;
- invio di una stessa richiesta interna.

Il meccanismo tecnico verrà definito in Platform Architecture.

## 32. Retry

Un fallimento tecnico temporaneo può essere ritentato automaticamente quando:

- l'Action è idempotente o compensabile;
- non aumenta il rischio;
- non produce side effect esterni duplicati.

Un retry non deve richiedere il docente se non cambia la decisione sostanziale.

## 33. Partial failure

Una Automation Run composta può riuscire solo in parte.

Esempio:

```text
lesson pack
✓ Lesson Plan
✓ Teacher Script
✗ Student Material
```

Il sistema deve conservare i risultati validi e segnalare il problema rilevante senza buttare via tutto.

## 34. Compensation / rollback concettuale

Per Actions reversibili deve essere possibile concettualmente:

- annullare;
- ripristinare versione precedente;
- disattivare output;
- creare una nuova versione correttiva.

Non ogni side effect esterno è realmente rollbackable.

## 35. Cancellation

Un'Automation Run non ancora completata può essere annullata quando tecnicamente possibile.

Una cancellazione non deve lasciare oggetti in stato ambiguo.

Dettagli tecnici nel Dossier Platform.

## 36. Freshness e superseding

Un risultato automatico può diventare obsoleto prima ancora di essere approvato.

Esempio:

```text
bozza verifica preparata lunedì
martedì cambia Actual Coverage
```

Il sistema deve poter marcare la bozza/review precedente come `superseded` e generarne una aggiornata invece di chiedere al docente di valutare una proposta ormai vecchia.

## 37. Scheduling horizon

Le automazioni pianificate devono rispettare l'orizzonte già definito:

- oggi/prossima lezione: output definitivo/pronto;
- prossimi ~7 giorni: materiale preparabile;
- settimane successive: pianificazione più leggera;
- lungo periodo: evitare generazioni costose premature.

Non preparare mesi di Artifact dettagliati destinati a diventare obsoleti.

## 38. Cost-aware automation

Il progetto deve restare free.

Quindi una Automation Policy deve poter considerare anche costo/risorse.

Esempi:

- non rigenerare se output esistente è ancora valido;
- riusare Artifact;
- batch processing;
- preferire checker deterministici;
- cercare web solo quando serve;
- evitare LLM per operazioni semplici;
- differire lavori non urgenti.

Il costo non deve compromettere correttezza, ma deve evitare spreco.

## 39. Confidence-aware automation

La confidence può contribuire alla policy quando l'Action dipende da inferenze.

Esempio:

```text
classificazione materiale
alta confidence → applica automaticamente
media → proposta/inbox
bassa → lascia non classificato
```

Ma una confidence alta non supera automaticamente:

- hard constraints;
- external side effect policy;
- impact limits;
- manual protected state.

## 40. Deterministic actions

Quando un'Action è deterministica e le precondizioni sono soddisfatte, la policy può normalmente essere più automatica.

Esempi:

- applicare +20 minuti da accomodamento autorizzato;
- calcolare punteggio deterministico;
- aggiornare indice;
- deduplicare hash identico;
- associare mapping esterno certo.

Non serve review artificiale.

## 41. External actions — policy iniziale

Per le prime versioni:

### Preparazione automatica consentita

- bozza comunicazione;
- materiale pronto per pubblicazione;
- feedback pronto;
- export pronto;
- Form esterno pronto quando l'integrazione lo consente senza pubblicazione definitiva.

### Esecuzione esterna automatica non consentita di default

- invio messaggi/email;
- pubblicazione materiale;
- pubblicazione feedback/voti;
- sincronizzazione valutazioni;
- modifiche ad account/sistemi esterni con conseguenze per studenti.

Serve azione esplicita del docente.

Questa policy potrà essere rivalutata in futuro per categorie specifiche.

## 42. High-impact decisions

Alcune decisioni non devono essere delegate automaticamente nei primi checkpoint:

- Final Grade manuale;
- sanzioni disciplinari;
- conseguenze da Integrity Evidence;
- Assessment Target Modification individuale;
- creazione di accomodamenti formali;
- pubblicazione/invio esterno;
- cancellazioni distruttive importanti.

Il sistema può preparare evidenze e proposte.

## 43. Ask / Command e automazione

Un comando naturale del docente non bypassa le policy.

Esempio:

> Manda agli studenti la comunicazione.

Il sistema può interpretare l'intento e preparare l'Action, ma:

- verifica autorizzazioni;
- mostra destinatari/contenuto se richiesto dalla policy;
- richiede conferma per side effect esterno.

Lo stesso vale per future interfacce API/MCP.

## 44. API/MCP parity

Le regole di Automation devono essere applicate nel dominio/application layer e non solo nella UI.

Quindi:

```text
Web UI ─┐
MCP ────┼→ Automation / Application Policy → Domain
API ────┘
```

Un client esterno non deve poter bypassare approval, hard constraints o audit.

Questa è una foundation utile anche per la futura integrazione MCP discussa nel progetto.

## 45. Automation e Configuration

Automation definisce **quali decisioni devono essere prese**.

Configuration definirà **dove vivono le regole e come vengono ereditate**.

Esempio:

```text
Automation:
questa Action può essere auto-eseguita?

Configuration:
la 4B eredita questa policy dalla materia o ha un override?
```

## 46. Default conservativi, non inutilmente manuali

Il default deve essere prudente sulle azioni ad alto impatto, ma non deve costringere il docente a confermare operazioni banali.

Buono:

- classificare automaticamente un duplicato esatto;
- preparare la prossima lezione;
- correggere risposte chiuse;
- applicare Requirement deterministico.

Da evitare:

- chiedere conferma per ogni salvataggio;
- mettere ogni generazione in Review Inbox;
- chiedere approvazione per metadata innocui.

## 47. Trust ramp

Il sistema può in futuro proporre di aumentare l'autonomia di una capability sulla base di utilizzo ripetuto.

Esempio:

```text
Hai approvato senza modifiche
le ultime 8 classificazioni automatiche.

Vuoi applicarle automaticamente
quando la confidence è alta?
```

Il passaggio a una policy più automatica richiede conferma esplicita.

Non deve avvenire silenziosamente.

## 48. Per-action policy, non global trust score

Non costruire un unico:

```text
AI trust = 82%
```

Il docente può fidarsi dell'autocorrezione delle scelte multiple ma voler controllare sempre i feedback aperti.

Quindi l'autonomia è per capability/action/context.

## 49. Automation feedback loop

Il sistema può misurare:

- quante proposte vengono approvate;
- quante vengono modificate;
- quante vengono ignorate;
- quali Action generano troppo review;
- dove gli automatismi sbagliano;
- quanto tempo umano viene risparmiato.

Questi dati servono a migliorare policy e prodotto, non a creare un profilo opaco del docente.

## 50. Failure UX

Un fallimento deve essere espresso in termini di risultato.

Esempio:

```text
La scheda studenti non è pronta.
Il PDF sorgente non è stato letto completamente.

[Usa il resto]
[Sostituisci fonte]
[Riprova]
```

Non mostrare job IDs o stack trace nella UX normale.

## 51. Foundation decisions approvate

Le seguenti decisioni sono state discusse e approvate:

1. Automation Action come unità applicativa fondamentale;
2. Trigger crea una candidate, non implica esecuzione;
3. policy decision separata dall'esecuzione;
4. scala comune Disabled / Detect / Suggest / Prepare / Execute internal / External-high impact;
5. generate/prepare/apply/publish sono concetti distinti;
6. Actions interne ed esterne hanno policy diverse;
7. reversibilità e impact class contribuiscono alla decisione;
8. Automation Policy restituisce execute/prepare/suggest/review/blocked/no-op;
9. precondizioni e hard constraints vengono valutati prima dell'esecuzione;
10. hard constraints non vengono superati dalla confidence;
11. conflitti ad alto impatto producono review;
12. ReviewItem è l'interfaccia trasversale tra automazione e docente;
13. ReviewItem duplicati vengono aggregati quando la decisione è comune;
14. Activity Log è distinto dalla Review Inbox;
15. Automation Run è versionata/auditabile per operazioni significative;
16. dependency propagation passa da impact analysis prima del recompute;
17. stale non significa automaticamente invalid;
18. recomputation deve essere selettiva;
19. manual edits sono protected anchors;
20. canonical/derived/released state hanno regole diverse;
21. Actions devono essere idempotenti dove possibile;
22. retry automatico solo quando sicuro;
23. partial failure conserva risultati validi;
24. rollback/compensation quando possibile;
25. risultati/review possono essere superseded da contesto più recente;
26. horizon e cost-aware automation evitano lavoro prematuro/inutile;
27. confidence contribuisce alla policy ma non sostituisce i vincoli;
28. Actions deterministiche possono essere più autonome;
29. side effect esterni restano approval-gated nelle prime versioni;
30. decisioni ad alto impatto restano human-controlled;
31. natural language/API/MCP non bypassano policy e approval;
32. Automation Policy vive nel dominio/application layer, non nella sola UI;
33. default prudenti per impatto alto ma automatici per operazioni banali;
34. aumento dell'autonomia futuro richiede conferma esplicita;
35. autonomia per action/capability/context, non global trust score;
36. metriche di automazione misurano valore e attrito;
37. nei primi checkpoint il livello massimo automatico consentito di default è Execute internal;
38. side effect esterni e decisioni high-impact restano approval-gated;
39. UI, API e futuro MCP devono passare dallo stesso Automation/Application layer e rispettare le stesse policy.

## 52. Evolution decisions

Da rimandare:

- sintassi/schema tecnico delle Automation Policy;
- motore di regole;
- scheduler/job runner;
- queue architecture;
- lock/concurrency;
- retry/backoff tecnici;
- transaction/compensation implementation;
- confidence calibration;
- trust ramp UX;
- auto-tuning policy;
- distribuzione dei worker;
- workflow engine specifico.

## 53. Edge cases da supportare

Il modello deve reggere almeno:

1. stessa Action triggerata due volte;
2. trigger mentre una Run precedente è ancora attiva;
3. docente modifica manualmente durante una generazione;
4. output pronto ma contesto cambia prima della review;
5. Action interna riuscita e side effect esterno fallito;
6. partial failure di un lesson pack;
7. retry dopo timeout con esito precedente sconosciuto;
8. conflict tra Requirement e Assessment;
9. Final Grade protetto mentre cambia Grade Proposal;
10. Resource Version nuova con molti Artifact dipendenti;
11. ReviewItem duplicati sullo stesso problema;
12. ReviewItem divenuto obsoleto;
13. provider esterno indisponibile;
14. comando MCP/API che tenta un'azione non autorizzata;
15. policy globale cambiata mentre esistono Run pendenti;
16. Action costosa non urgente;
17. cancellazione mentre una Run è parzialmente completata;
18. automazione disabilitata dopo che la candidate è stata creata.

## 54. Checkpoint di dominio proposto — AU1: Prepare automatically, interrupt only when needed

Problema:

> Il docente deve trovare lavoro già preparato senza ricevere una coda infinita di conferme.

Scenario minimo:

1. calendario/contesto genera trigger per la prossima lezione;
2. il sistema valuta policy e precondizioni;
3. prepara automaticamente Lesson Plan, Teacher Script e Student Material;
4. le operazioni riuscite finiscono nell'Activity Log;
5. solo problemi reali generano ReviewItem;
6. una modifica manuale protegge l'Artifact da overwrite;
7. un cambio upstream produce impact analysis selettiva;
8. comunicazioni/pubblicazioni esterne restano approval-gated.

Primitive necessarie:

- Automation Action;
- Trigger/Candidate;
- Automation Policy Decision;
- Automation Run;
- ReviewItem;
- Conflict;
- Impact Analysis;
- stale/superseded state;
- Action provenance.

Non-goals:

- workflow engine distribuito;
- automazione esterna completa;
- auto-tuning delle policy;
- agenti autonomi generali.

## 55. Metriche utili

- percentuale Action completate senza intervento;
- numero medio ReviewItem per settimana;
- percentuale ReviewItem realmente utili;
- tempo medio di review;
- percentuale proposte modificate/rifiutate;
- numero di automazioni duplicate evitate;
- numero di cascade/recompute non necessari evitati;
- percentuale Run con partial failure recuperabile;
- tempo docente risparmiato;
- numero di side effect esterni eseguiti solo dopo approval corretta.

## 56. Decisioni aperte residue

Le decisioni residue riguardano soprattutto l'evoluzione tecnica:

1. schema tecnico delle Automation Policy;
2. motore di regole;
3. scheduler/job runner;
4. queue e worker architecture;
5. lock e concurrency control;
6. retry/backoff e compensation tecnici;
7. calibrazione della confidence;
8. UX del trust ramp;
9. eventuale auto-tuning delle policy;
10. workflow engine specifico, se mai necessario.

## 57. Stato del dossier

Il nucleo del Dossier 08 — Automation Model è considerato **approvato e stabile per i primi checkpoint**.

Sono consolidate in particolare:
- Automation Action come unità applicativa;
- Trigger/Candidate separati dall'esecuzione;
- Policy Decision esplicita;
- scala Disabled / Detect / Suggest / Prepare / Execute internal / External-high impact;
- distinzione generate / apply / publish-send;
- internal vs external side effects;
- reversibilità, impatto e hard constraints come input della policy;
- ReviewItem come interfaccia trasversale di supervisione;
- Activity Log separato dalla Review Inbox;
- Automation Run auditabile;
- impact analysis prima della propagazione;
- stale distinto da invalid;
- selective recomputation;
- manual edits come protected anchors;
- canonical / derived / released state distinti;
- idempotenza, retry sicuri e partial failure;
- superseding di output/review obsoleti;
- cost-aware e confidence-aware automation;
- approval obbligatoria iniziale per side effect esterni/high-impact;
- Execute internal come massimo livello automatico di default nei primi checkpoint;
- stessa policy enforcement per UI, API e futuro MCP;
- aumento futuro dell'autonomia per capability e solo con conferma esplicita.

Le decisioni residue non impediscono di procedere al Dossier 09 — Configuration Model.