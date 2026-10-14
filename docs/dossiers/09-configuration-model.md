# Dossier 09 — Configuration Model

## 1. Domanda centrale

Come rappresentare preferenze, policy, regole, istruzioni e override in modo coerente tra tutto il prodotto, così che il docente possa impostare un comportamento una volta, specializzarlo dove serve e capire sempre quale configurazione effettiva sta agendo?

Il sistema deve evitare due estremi:

- configurazioni duplicate in ogni modulo;
- un enorme pannello globale pieno di opzioni astratte.

## 2. Principio fondamentale

La configurazione deve essere **contestuale, composabile, esplicita e ricostruibile**.

Il modello concettuale è:

```text
DEFAULT DI SISTEMA
        +
CONFIGURAZIONI APPLICABILI AL CONTESTO
        +
OVERRIDE PIÙ SPECIFICI
        +
EVENTUALE ONE-OFF
        ↓
EFFECTIVE CONFIGURATION
```

Il docente normalmente vede solo il valore effettivo e, quando serve, la sua provenienza.

## 3. Vincoli già approvati

Questo dossier assume come già deciso:

- preferenze e istruzioni possono essere Global → Subject → Class → Lesson/Assessment → one-off;
- le configurazioni più specifiche prevalgono dove entrano in conflitto;
- una richiesta occasionale non diventa automaticamente persistente;
- il docente può salvare esplicitamente una preferenza;
- grading rules sono gerarchiche/ereditarie;
- Automation Policy dipende dal contesto;
- fonti consentite/escluse possono essere configurate per contesto;
- feedback policy può essere gerarchica;
- accomodamenti autorizzati sono constraint, non semplici preferenze;
- manual edits e Final Grade hanno protezioni proprie;
- configurazione e Automation sono domini distinti;
- l'onboarding deve essere progressivo.

## 4. Un'unica gerarchia rigida sarebbe insufficiente

La scorciatoia:

```text
Global
  ↓
Subject
  ↓
Class
  ↓
Lesson
```

è utile per spiegare la UX, ma non descrive sempre correttamente il dominio.

Esempi:

- una classe può avere più materie;
- una regola può valere per tutte le verifiche SQL indipendentemente dalla classe;
- un requisito studente può valere solo per Assessment;
- una preference può riguardare Teacher Script ma non Student Material;
- una policy può valere per una materia + una classe + un tipo di Action.

Quindi internamente preferisco **Configuration Scope + Context Match** rispetto a un solo albero.

## 5. Configuration Scope

Uno `Configuration Scope` descrive dove una configurazione si applica.

Dimensioni possibili:

- teacher/user;
- subject;
- class;
- class + subject / TeachingContext;
- student;
- group;
- Curriculum Item;
- period;
- Lesson;
- Assessment;
- Assessment Event;
- Artifact type;
- question type;
- Automation Action type;
- delivery channel;
- integration/provider;
- altra capability futura.

Non tutte le configurazioni possono o devono usare tutte le dimensioni.

## 6. TeachingContext come scope centrale

Per gran parte del prodotto quotidiano lo scope naturale sarà:

```text
Teacher
+ Subject
+ Class
```

cioè il TeachingContext già emerso nei dossier precedenti.

Esempio:

```text
4B + Informatica
→ usa più esempi pratici
```

Questo non deve influenzare automaticamente 4B + Sistemi se sono contesti didattici distinti.

## 7. Configuration Entry

L'unità configurabile proposta è una `Configuration Entry`.

Contiene concettualmente:

- configuration key/capability;
- valore o frammento di configurazione;
- scope;
- provenienza;
- autore;
- stato;
- validità temporale;
- priority/authority quando necessaria;
- versione;
- eventuale motivazione/nota.

Esempio:

```text
key: assessment.grade.step
value: 0.5
scope: Subject=Informatica, Class=4B
```

## 8. Configuration Fragment, non copia completa

Un override specifico deve definire solo ciò che cambia.

Esempio:

```text
Globale
min grade = 2
max grade = 10
step = 0.5

4B
min grade = 3
```

Effective Configuration:

```text
min = 3
max = 10
step = 0.5
```

Non copiare l'intera configurazione globale nella 4B.

Questo evita drift e rende l'ereditarietà reale.

## 9. Effective Configuration

L'`Effective Configuration` è il risultato risolto per un contesto concreto.

Esempio:

```text
Context:
4B · Informatica · Assessment SQL

Effective:
duration = 60 min
web search = disabled
question types = no multiple choice
grade step = 0.5
feedback = detailed
```

Deve essere ricostruibile da quali Entry deriva ogni valore.

## 10. Provenance del valore

Quando utile il docente deve poter vedere:

```text
Step voto: 0.5
Ereditato da: Informatica

Ricerca web: disabilitata
Impostata in: questa verifica
```

Non serve mostrare questa provenance nella UX normale, ma deve essere disponibile.

## 11. Specificity resolution

Quando più Entry sono applicabili, il sistema deve scegliere in modo deterministico.

Principio:

> una configurazione più specifica prevale solo sui campi che definisce.

Esempio concettuale:

```text
Global
< Subject
< TeachingContext (Class + Subject)
< Lesson / Assessment
< Student-specific applicable scope
< One-off instruction
```

Ma la precedenza non deve essere implementata come semplice profondità numerica universale: alcune categorie, come hard constraints Governance o Accommodation, hanno autorità diversa.

## 12. Specificità e autorità sono dimensioni diverse

Questa distinzione è fondamentale.

Una regola più specifica non può necessariamente sovrascrivere una regola più autorevole.

Esempio:

```text
Assessment one-off:
calcolatrice vietata

Authorized Accommodation:
calcolatrice consentita
```

Non possiamo dire semplicemente:

> one-off è più specifico, quindi vince.

Serve distinguere:

- specificity;
- authority / constraint level.

## 13. Configuration authority

Propongo almeno tre categorie concettuali:

### Preference

Comportamento desiderato e sovrascrivibile.

Esempio:

- usa esempi pratici;
- feedback sintetico;
- preferisci fonti locali.

### Policy / Rule

Regola operativa esplicita.

Esempio:

- auto-approva closed questions;
- voto in step 0.5;
- web search disabled.

### Constraint

Vincolo che non può essere superato da configurazioni ordinarie.

Esempio:

- Governance permission;
- Accommodation autorizzato;
- Form frozen;
- external side-effect approval requirement iniziale.

Il dettaglio di chi possa creare ciascun livello viene definito in Governance.

## 14. Default di sistema

Ogni capability dovrebbe avere default sensati che permettano al prodotto di funzionare senza setup completo.

Principio:

> configurare deve migliorare il comportamento, non essere un prerequisito per usarlo.

Esempi:

- Teacher Script dettagliato di default;
- external sending approval-gated;
- grading deterministico automatico;
- web search local-first;
- niente profiling avanzato.

## 15. Default di prodotto vs preferenza utente

Un default non è una scelta del docente.

Quindi il sistema deve distinguere:

```text
system default
teacher-configured value
```

Questo permette di aggiornare in futuro i default per nuovi utenti senza alterare silenziosamente configurazioni esplicite già scelte.

## 16. Persistenza esplicita

Una modifica one-off non deve diventare Configuration Entry persistente automaticamente.

Esempio:

> Per questa lezione fai meno esercizi.

produce:

```text
one-off instruction
```

non:

```text
Class preference: fewer exercises forever
```

## 17. Preference suggestion

Il sistema può osservare pattern ripetuti e proporre:

```text
Nelle ultime 5 verifiche hai rimosso
le domande a scelta multipla.

Vuoi salvarlo come default per la 4B?
```

Solo l'accettazione crea una configurazione persistente.

## 18. One-off Instruction

Una `One-off Instruction` è una configurazione temporanea collegata a un singolo comando/workflow/versione.

Può avere priorità elevata tra le preferenze ordinarie, ma resta subordinata a constraints.

Esempio:

```text
Per questa verifica:
- niente web
- 45 minuti
- almeno un esercizio applicativo
```

## 19. Scope temporale

Una Entry può essere:

- permanente finché modificata;
- valida in un periodo;
- valida fino a una data;
- valida per un anno scolastico;
- valida per una singola Activity;
- one-off.

Questo è utile per:

- accomodamenti temporanei;
- sperimentazioni;
- regole di periodo;
- preferenze per una unità.

## 20. Active vs expired configuration

Le Entry scadute non vengono necessariamente cancellate.

Restano nello storico per audit e ricostruzione, ma non partecipano alla Effective Configuration corrente.

## 21. Configuration Version

Le configurazioni che influenzano output significativi devono essere versionabili.

Serve poter ricostruire:

- quali regole hanno generato una verifica;
- quale Grade Policy era attiva;
- quale Automation Policy ha autorizzato una Action;
- quali source preferences hanno prodotto un Artifact.

Non ogni toggle UI deve avere una UX di version control, ma il dominio deve preservare la storia rilevante.

## 22. Snapshot vs live resolution

Distinguere due casi:

### Live resolution

Usato per decidere il comportamento corrente.

### Configuration snapshot/reference

Registrato su output/run significativi per ricostruire ciò che era effettivo in quel momento.

Esempio:

```text
Assessment generated
→ effective config v17
```

Se domani cambia il default, la prova storica resta ricostruibile.

## 23. Configuration namespaces / capability ownership

Per evitare un grande dizionario di key senza disciplina, ogni configurazione deve appartenere a una capability/domain owner.

Esempi:

```text
lesson.script.*
materials.search.*
assessment.variant.*
grading.score.*
grading.grade.*
automation.*
feedback.*
```

Il naming tecnico verrà definito più avanti; il principio è ownership chiara e schema validato.

## 24. Typed configuration

Le configurazioni non devono essere blob JSON arbitrari privi di schema.

Ogni capability deve conoscere:

- tipo;
- valori ammessi;
- default;
- scope validi;
- merge semantics;
- eventuali constraints;
- versione dello schema.

Questo rende possibili validation, migrazioni e UI coerenti.

## 25. Merge semantics per tipo

Non tutte le configurazioni si combinano con `last value wins`.

Esempi:

### Scalar

```text
duration = 60
```

più specifico sostituisce.

### Object / partial fields

```text
grade policy
```

merge campo per campo.

### Set allowlist/blocklist

```text
allowed sources
blocked domains
```

può richiedere union/intersection/replace esplicito.

### Ordered preferences

```text
source priority
```

può richiedere ordering semantics.

Le semantics devono appartenere allo schema della capability.

## 26. Replace vs extend

Per liste e set il docente deve poter esprimere la differenza tra:

- aggiungi a ciò che eredito;
- rimuovi un elemento ereditato;
- sostituisci completamente.

Esempio:

```text
Materia Informatica:
fonti preferite = [libro, appunti]

Verifica SQL:
+ documentazione PostgreSQL
- web generico
```

Un semplice overwrite della lista sarebbe troppo limitante.

## 27. Negative override / exclusion

Serve poter dire esplicitamente:

```text
questa regola ereditata qui NON si applica
```

senza dover ricostruire tutta la configurazione.

Esempi:

- web normalmente consentito, ma vietato per questa lezione;
- feedback dettagliato di default, ma solo voto per questa verifica;
- una specifica fonte esclusa.

## 28. Reset to inherited

Ogni override dovrebbe poter essere rimosso tornando semplicemente all'eredità.

UX concettuale:

```text
Durata: 45 min
Override di questa verifica

[Ripristina valore ereditato: 60 min]
```

Rimuovere override non deve copiare il valore superiore nello scope locale.

## 29. Conflict detection

Un conflitto di configurazione si verifica quando due Entry applicabili non possono essere composte coerentemente.

Esempi:

- allow + deny della stessa capability con authority equivalente;
- due constraints incompatibili;
- schema/versione incompatibile;
- Instruction locale viola un Requirement.

Il resolver deve distinguere:

- conflitto risolvibile deterministicamente;
- warning;
- blocking conflict / ReviewItem.

## 30. Explain resolution

Per problemi o debugging il sistema deve poter spiegare:

```text
Perché la ricerca web è disabilitata?

Global: consentita
Informatica: consentita
4B: consentita
Questa lezione: disabilitata

→ valore effettivo: disabilitata
```

Oppure:

```text
Assessment: calcolatrice vietata
Accommodation autorizzato: consentita

→ conflitto / review
```

## 31. Configuration is data, not code

Le preferenze del docente non devono tradursi in logica hardcoded sparsa nel prodotto.

Il dominio deve leggere una configurazione risolta attraverso contratti stabili.

Questo è fondamentale per rendere sostituibili UI, API, MCP e automation workers.

## 32. Configuration Resolver

Serve concettualmente una capability condivisa di `Configuration Resolver`.

Input:

- configuration key/schema;
- context;
- timestamp;
- actor quando rilevante.

Output:

- effective value;
- provenance per campo;
- conflicts/warnings;
- version/snapshot reference.

Non implica ancora un microservizio separato.

## 33. Resolver deterministico

Con lo stesso insieme di Entry/versioni e lo stesso Context, il risultato deve essere deterministico.

Questo è importante per:

- test;
- audit;
- agenti;
- riproducibilità;
- debug.

## 34. Configuration Context

Il resolver deve ricevere contesto strutturato, non una stringa generica.

Esempio:

```text
Teacher
Subject=Informatica
Class=4B
Lesson=42
ArtifactType=TeacherScript
```

Il `TeachingContext` è una parte frequente di questo Configuration Context.

## 35. Applicability rules

Ogni Configuration Entry deve dichiarare scope compatibile con la propria capability.

Esempio:

`grade.step` può essere configurabile per:

- teacher/global;
- subject;
- TeachingContext;
- Assessment;

ma probabilmente non per:

- singola pagina PDF.

Questo previene configurazioni senza significato.

## 36. Student-specific configuration

Le configurazioni individuali devono essere usate con prudenza.

Per i primi checkpoint sono appropriate soprattutto per:

- Requirements/Accommodations;
- regole manuali esplicite;
- condizioni Assessment autorizzate.

Non usarle come scorciatoia per profilazione automatica.

## 37. Group configuration

Un Temporary Group può avere istruzioni contestuali proprie.

Esempio:

```text
Gruppo recupero subquery
→ assegna scheda guidata
```

Quando il gruppo chiude, la configurazione scoped al gruppo non deve continuare a influenzare gli studenti.

## 38. Cross-domain precedence

Il resolver ordinario gestisce configurazioni della stessa capability.

Quando domini diversi producono constraints, serve un livello di policy/application validation.

Esempio:

```text
Configuration Resolver:
Assessment calculator = false

Personalization Requirement:
calculator = true

→ Automation/Application validation
→ conflict/review
```

Non cerchiamo di far risolvere ogni conflitto cross-domain a un unico mega-resolver.

## 39. Configuration vs canonical state

Una configurazione influenza come il sistema opera.

Non deve riscrivere retroattivamente lo stato canonico già approvato.

Esempio:

cambiare:

```text
Teacher Script default detail = high → medium
```

non modifica automaticamente tutti i Teacher Script esistenti.

Influenza le nuove generazioni e può rendere alcuni derived artifact candidati all'aggiornamento solo secondo Automation Policy.

## 40. Configuration change impact

Quando cambia una Entry, il sistema deve poter determinare quali oggetti futuri o derived state possono essere impattati.

Processo:

```text
CONFIG CHANGE
↓
scope affected
↓
dependency/impact analysis
↓
future behavior changes immediately
existing derived objects → no-op / stale / prepare / review
```

## 41. No silent historical recalculation

Cambiare oggi:

- Grade Conversion Policy;
- Rubric default;
- Automation Policy;
- source priority

non ricalcola silenziosamente output storici.

Le regole storiche restano ricostruibili tramite snapshot/versioning.

## 42. Import/export configuration

Nel tempo può essere utile:

- esportare preferenze;
- riusare una configurazione tra anni/classi;
- creare template;
- importare setup.

Non è priorità iniziale, ma il modello a Entry/Scope lo rende possibile senza copiare oggetti applicativi.

## 43. Configuration Template

Un `Configuration Template` futuro può essere un insieme versionato di Entry da applicare come baseline.

Esempi:

- Informatica biennio;
- stile verifiche personale;
- configurazione nuova classe.

L'applicazione di un template non deve creare dipendenza nascosta se poi la classe deve divergere.

Possibili modalità future:

- copy baseline;
- linked template con override;
- update proposal.

Non decidiamo ora quale.

## 44. Progressive configuration UX

Il docente non deve aprire una pagina con centinaia di opzioni al primo avvio.

Tre modalità già coerenti col progetto:

### Setup essenziale

Solo poche impostazioni necessarie.

### Contextual settings

Configura mentre usa una capability.

### Preference suggestions

Il sistema propone di salvare pattern ripetuti.

Le impostazioni avanzate restano ricercabili ma secondarie.

## 45. Settings surface vs effective control

Non ogni configurazione deve comparire in una pagina Settings.

Esempio:

```text
Durante creazione verifica:
Durata 60 min
[Salva come default per Informatica]
```

è spesso migliore di cercare manualmente `Settings > Assessment > Duration`.

## 46. Natural language configuration

Il docente può in futuro dire:

> Con la 4B non usare mai più di due domande a scelta multipla.

Il sistema può tradurre l'intento in una Configuration Entry proposta.

Prima di renderla persistente deve mostrare scope e significato:

```text
Salvare per:
4B · Informatica

Max scelta multipla: 2

[Conferma]
```

## 47. API/MCP configuration parity

Come per Automation, UI/API/MCP devono usare lo stesso resolver e gli stessi contratti.

Un client esterno può:

- leggere effective config se autorizzato;
- proporre/modificare Entry secondo permessi;

ma non deve creare configurazioni che bypassino constraints o Governance.

## 48. Configuration validation

Prima di salvare un'Entry:

- schema valido;
- valore valido;
- scope consentito;
- authority consentita;
- conflict check;
- eventuale impact preview.

Per modifiche ad alto impatto può servire review/confirmation.

## 49. Bulk changes

Il docente può voler cambiare una regola per molte classi.

Il sistema deve preferire creare una Entry nello scope comune corretto anziché duplicare 10 override.

Esempio:

> In Informatica usa sempre step voto 0.5.

→ una Entry Subject=Informatica

non 10 Entry per 10 classi.

## 50. Avoid configuration drift

Segnali di drift possibili:

- molti override identici;
- override non più diversi dal parent;
- configurazioni obsolete;
- scope duplicati;
- regole contraddittorie.

Il sistema può proporre cleanup, ma non deve riorganizzare silenziosamente configurazioni esplicite.

## 51. Configuration deletion

Eliminare un override significa normalmente:

> torna all'ereditarietà.

Non significa:

> cancella il concetto dal sistema.

Lo storico della Entry può essere conservato secondo audit/governance.

## 52. Configuration ownership

Ogni Entry deve avere un owner/authority context.

Nei primi checkpoint sarà principalmente il docente.

In futuro potrebbero esistere:

- school/admin policy;
- department baseline;
- teacher preference;
- student accommodation autorizzato.

Il modello deve poterli rappresentare senza assumere che ogni livello sia sovrascrivibile dal docente.

## 53. Priority non deve diventare un numero arbitrario

Eviterei un campo generico:

```text
priority = 847
```

usato per risolvere tutto.

La precedence deve derivare principalmente da:

- authority class;
- applicability;
- specificity;
- temporal validity;
- explicit override semantics.

Numeri di priorità possono esistere internamente solo dove un dominio specifico ne ha davvero bisogno.

## 54. Foundation decisions approvate

Le seguenti decisioni sono state discusse e approvate:

1. Configuration Scope + Context Match al posto di un unico albero rigido;
2. TeachingContext come scope centrale ma non esclusivo;
3. Configuration Entry come unità fondamentale;
4. override rappresentati come fragment, non copie complete;
5. Effective Configuration risolta per contesto;
6. provenance per campo/valore ricostruibile;
7. specificity e authority sono dimensioni distinte;
8. distinguere Preference, Policy/Rule e Constraint;
9. system default distinto da scelta esplicita dell'utente;
10. one-off non diventa persistente automaticamente;
11. preference suggestion richiede conferma;
12. scope temporale/validità esplicito;
13. configurazioni significative versionabili;
14. live resolution distinta da snapshot storico;
15. configuration ownership per capability/namespace;
16. configurazioni typed/schema-validated;
17. merge semantics definite per capability/tipo;
18. supportare extend/remove/replace per set/list;
19. negative override/exclusion esplicito;
20. reset to inherited senza copiare parent value;
21. conflict detection e explain resolution;
22. Configuration Resolver condiviso e deterministico;
23. Configuration Context strutturato;
24. applicability rules per capability;
25. configurazioni individuali usate con prudenza;
26. group config limitata al ciclo di vita del gruppo;
27. conflitti cross-domain non forzati dentro un mega-resolver;
28. config change non riscrive canonical/history;
29. impact analysis per cambi config;
30. niente historical recalculation silenzioso;
31. UX progressiva/contextual settings;
32. natural-language config produce Entry proposta da confermare;
33. UI/API/MCP condividono resolver e validation;
34. bulk change va nello scope comune più corretto;
35. evitare config drift e cleanup silenzioso;
36. deletion di override = ritorno a inheritance;
37. ownership/authority futura supporta teacher/admin/accommodation;
38. niente priority number arbitrario come meccanismo universale;
39. nei primi checkpoint si può partire da scalar e object partial override, mantenendo però il contratto per set/list add-remove-replace dove necessario;
40. il Configuration Resolver deve restare focalizzato sulla risoluzione delle configurazioni della stessa capability, lasciando i conflitti cross-domain al layer application/automation.

## 55. Evolution decisions

Da rimandare:

- schema/storage tecnico delle Entry;
- DSL delle condizioni;
- algoritmo esatto di specificity ordering;
- configuration cache;
- template linked vs copied;
- admin/school hierarchy completa;
- UI Settings definitiva;
- migration framework degli schema;
- feature flags;
- multi-tenant organization policies;
- policy-as-code eventuale.

## 56. Edge cases da supportare

Il modello deve reggere almeno:

1. classe con più materie;
2. stessa materia in più classi;
3. override solo di un campo;
4. override uguale al parent poi parent cambia;
5. one-off che non persiste;
6. Entry temporanea scaduta;
7. Assessment con override su durata e feedback;
8. student accommodation in conflitto con Assessment;
9. group config dopo chiusura gruppo;
10. configurazione globale cambiata dopo Assessment storico;
11. policy globale più autorevole di override locale;
12. due Entry equivalenti duplicate;
13. exclude di una fonte ereditata;
14. lista locale che estende lista parent;
15. reset to inherited;
16. configurazione proposta via linguaggio naturale;
17. bulk change di 10 classi;
18. schema config aggiornato tra versioni;
19. client MCP tenta override non autorizzato;
20. TeachingContext non completamente noto durante onboarding.

## 57. Checkpoint di dominio proposto — Cfg1: Configure once, specialize only when needed

Problema:

> Il docente non deve ripetere le stesse preferenze in ogni lezione o verifica, ma deve poter fare eccezioni senza perdere il controllo.

Scenario minimo:

1. il prodotto funziona con system defaults;
2. il docente modifica una preferenza durante una lezione;
3. sceglie di salvarla per `4B · Informatica`;
4. le lezioni successive ereditano quel valore;
5. una singola Lesson usa un one-off diverso;
6. il one-off non altera il default della classe;
7. la UI può mostrare da dove arriva il valore effettivo;
8. rimuovendo l'override si torna automaticamente all'ereditarietà.

Primitive necessarie:

- Configuration Schema;
- Configuration Entry;
- Configuration Scope;
- Configuration Context;
- Effective Configuration;
- Configuration Resolver;
- Configuration Provenance;
- Configuration Snapshot/Version.

Non-goals:

- pannello settings completo;
- gerarchia amministrativa scolastica;
- template complessi;
- policy-as-code.

## 58. Metriche utili

- numero medio di override per TeachingContext;
- percentuale di configurazioni impostate contestualmente vs Settings;
- numero di one-off erroneamente salvati come persistenti;
- numero di conflict/review di configurazione;
- tempo per capire perché un valore è attivo;
- duplicati/override ridondanti;
- frequenza reset-to-inherited;
- percentuale Preference Suggestion accettate;
- numero di configurazioni richieste prima di ottenere valore dal prodotto.

## 59. Decisioni aperte residue

Le decisioni residue riguardano soprattutto l'evoluzione tecnica:

1. schema/storage tecnico delle Configuration Entry;
2. algoritmo preciso di specificity ordering;
3. representation tecnica di add/remove/replace per set e liste;
4. configuration cache;
5. template linked vs copied;
6. gerarchia amministrativa scolastica futura;
7. UI Settings definitiva;
8. migration framework degli schema;
9. feature flags;
10. eventuale policy-as-code.

## 60. Stato del dossier

Il nucleo del Dossier 09 — Configuration Model è considerato **approvato e stabile per i primi checkpoint**.

Sono consolidate in particolare:
- Configuration Scope + Context Match al posto di un unico albero rigido;
- TeachingContext come scope centrale ma non esclusivo;
- Configuration Entry come fragment, non copia completa;
- Effective Configuration risolta per contesto;
- provenance per valore/campo;
- specificity separata da authority;
- Preference, Policy/Rule e Constraint come categorie distinte;
- system default distinto da scelta esplicita del docente;
- one-off non persistente automaticamente;
- configurazioni typed e schema-validated;
- merge semantics definite per capability;
- reset-to-inherited come operazione primaria;
- versioning e snapshot storico per output/run significativi;
- Configuration Resolver condiviso, strutturato e deterministico;
- config change sottoposto a impact analysis senza historical rewrite;
- UI progressiva e contextual settings;
- natural-language configuration come proposta da confermare;
- parity tra UI, API, MCP e Automation;
- partenza pragmatica da scalar/object partial override mantenendo il contratto per add/remove/replace;
- conflitti cross-domain lasciati al layer application/automation e non assorbiti da un mega-resolver.

Le decisioni residue non impediscono di procedere al Dossier 10 — AI Architecture.