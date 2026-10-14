# C2 — Semantic Deliverable Completeness Gate

> **Esito:** **PASS** — Slice C2 soltanto; nessuna autorizzazione implicita a iniziare C3.
> **Ruolo:** Validation Engineer
> **Data:** 1 ottobre 2026
> **Workspace:** `~/Workspace/teacher-service-design`
> **Ambiente:** macOS 27.0.1, arm64; Python 3.14.7
> **Esecuzione:** locale e deterministica; nessun modello o provider invocato.

## Executive result

**C2 supera i criteri di accettazione sulla matrice eseguita.** Il controllo distingue la coppia reale positiva CANDIDATE-B dalla coppia reale negativa CANDIDATE-C, passa la fixture sintetica di storia, preserva le istruzioni imperative legittime, rileva la copia quasi integrale del piano e tratta un marker isolato non dominante come `WARN`, non come fallimento.

- Runner fixture: **16/16 casi attesi**.
- Unit test: **17/17 superati**.
- Chiamate remote: **0**.
- Branch specifici di dominio nel core: **0**.
- Containment filesystem: **PASS**.
- Prossimo stato: **READY_FOR_C3_REVIEW**; il lavoro si ferma qui. C3 non è stato iniziato.

Il PASS è circoscritto alla funzione del gate e alle fixture riportate: non equivale a certificare correttezza fattuale, qualità didattica, grounding o assenza universale di falsi positivi.

## Scope e non-goals

C2 risponde alla sola domanda: il campo di contenuto contiene sostanza del tipo richiesto dal contratto, oppure soltanto una descrizione/placeholder del deliverable atteso? Il gate opera dopo la validazione strutturale e prima della review qualitativa.

Non valuta correttezza fattuale, grounding o provenienza, qualità pedagogica complessiva, stile, accuratezza di dati/formule/coordinate, né confronta modelli. Non implementa C3–C7 o Gate D. Non sono stati eseguiti remote calls, installazioni, modifiche a OmniRoute/model registry o modifiche agli artifact storici Gate C.

## Fonti e precondizioni

Consultati i due report Gate C indicati dal task, `docs/ai/model-routing-and-registry.md`, `docs/validation/00-feasibility-benchmark-gate.md`, `docs/validation/01-benchmark-corpus.md`, `docs/00-design-method.md`, i dossier 08 e 10 e le regole/template di validazione. Il task indica `docs/dossiers/11-governance.md`, che non esiste con quel nome nel checkout; è stato consultato il dossier presente e canonico `docs/dossiers/11-data-privacy-governance.md`.

Le fixture reali sono gli output blindati di Gate C v2, letti senza modificarli:

| Fixture | Percorso relativo | SHA-256 | Esito C2 |
|---|---|---|---|
| CANDIDATE-B, generation DBMS (positiva) | `validation/work/Gate-C-v2/outputs/attempt-09/blinded/CANDIDATE-B/dbms_sql/phase1-attempt-07-run-01/generation-output.json` | `ffbacbd3b3fc9f43e42e0fdc007a14bd2eadf98aa5dd3534e92bff4e1c606e95` | PASS |
| CANDIDATE-C, generation DBMS (negativa) | `validation/work/Gate-C-v2/outputs/attempt-09/blinded/CANDIDATE-C/dbms_sql/phase1-attempt-07-run-01/generation-output.json` | `6c25ae60d734f170b82467eb1adb212b57c7b993d68b8b0881c331aa62eff329` | FAIL |

La discrepanza nel nome del dossier 11 è l'unica deviazione documentale rilevata; non ha impedito la verifica.

## Implementazione e API

Il core è una libreria Python piccola, tipizzata e standard-library-only in `validation/shared/semantic_completeness.py`. Espone `DeliverableCompletenessContract`, `RequiredElement`, `evaluate_deliverable()` ed `evaluate_bundle()`. L'adattamento dal JSON storico di Gate C è confinato al test harness; il core non dipende dal runner, da OmniRoute, da provider, né da nomi o schemi Gate C.

Il contratto dichiara tipo di deliverable, percorsi obbligatori, conteggi minimi di elementi, soglie di contenuto, elementi richiesti, marker di placeholder, soglia di dominanza e relazioni di distinzione tra deliverable. Il risultato è tipizzato e serializzabile con `status` (`PASS`/`FAIL`), tipo, lista di check, `failure_codes`, metriche, versione del contratto e versione del checker. Non produce un quality score.

Regole implementate:

1. **Struttura:** verifica path richiesti e numero minimo di attività/elementi dichiarati nel contratto.
2. **Sostanza:** conteggio normalizzato delle parole e dei token distinti, più un pavimento per contenuti vuoti/quasi vuoti.
3. **Placeholder/meta-template:** marker espliciti o dichiarati dal contratto, misurati per frase. Marker dominanti causano FAIL; segnale non dominante causa solo WARN.
4. **Elementi richiesti:** presenza di almeno una delle forme dichiarate dal contratto, non conoscenza codificata della materia.
5. **Distinzione:** containment di trigrammi lessicali, semplice e interpretabile, tra i deliverable indicati dal contratto.

I verbi imperativi non sono una blacklist: consegne autentiche rivolte allo studente restano accettabili se il contenuto supera gli altri requisiti.

### Reason codes

Codici machine-readable osservati: `EMPTY_OR_NEAR_EMPTY`, `INSUFFICIENT_SUBSTANCE`, `PLACEHOLDER_DOMINATED`, `PLACEHOLDER_SIGNAL` (solo WARN), `MISSING_REQUIRED_STRUCTURE`, `MISSING_REQUIRED_ELEMENT` e `NEAR_DUPLICATE_DELIVERABLE`. I codici sono parte del contratto API versionato (`contract_version=1.0`, `checker_version=1.0.0`); cambiamenti semantici futuri dovranno essere versionati e non riutilizzare silenziosamente codici con significato diverso.

## Calibrazione delle euristiche

Le soglie sono configurabili per task e non sono principi pedagogici universali.

- Il contratto della coppia reale richiede almeno **40 parole e 20 token distinti** per campo: B supera ampiamente il requisito (**503** parole nel piano, **513** nel materiale); C resta sotto (**19** e **32** parole secondo la tokenizzazione del checker) e contiene marker meta-template in tutte le frasi (**ratio 1.0**). La soglia 40 separa queste fixture e le fixture sintetiche positive (252/224 parole) dai negativi brevi (18/25); è una `FIXTURE_DERIVED_HEURISTIC`, non una soglia universale.
- Per la dominanza dei marker, il contratto usa `0.4` come soglia configurabile. La fixture mista T14 ha rapporto `0.2`: passa con `PLACEHOLDER_SIGNAL` a severità WARN. Le fixture negative canoniche hanno rapporto `1.0` e falliscono. Evidenza ancora limitata: la soglia andrà ricalibrata se cambiano lingue, lunghezze e forme dei deliverable.
- La soglia di near-copy è configurabile e fissata a `0.82` nei contratti di test. Il containment è `1.0` per la copia identica e per il piano copiato con una breve consegna aggiunta; è `0.026749` per la coppia reale B e `0.0` per la coppia sintetica distinta. È un segnale lessicale, non un giudizio semantico.
- Il default del core (8 parole, 5 token distinti) è un pavimento conservativo per evitare di rifiutare automaticamente output brevi; il chiamante deve impostare un contratto adatto allo specifico deliverable.

## Fixture reali: lettura qualitativa

**CANDIDATE-B — positivo, PASS.** Il piano non si limita a dichiarare le sezioni: contiene sette fasi operative che coprono 120 minuti, obiettivi, azioni docente/studenti, dimostrazioni, esercizi, check formativi e chiusura. La scheda studente è un artefatto distinto: contiene schema, glossario/promemoria SQL, query d'esempio, esercizi numerati e sfida finale. Il checker misura 503 e 513 parole e un containment Plan/Student pari a `0.026749`; gli elementi e la struttura richiesti sono presenti. La conclusione è limitata alla sostanza/completeness: non rivaluta correttezza didattica o fattuale.

**CANDIDATE-C — negativo, FAIL.** Il contenuto del piano è una singola frase meta-descrittiva («piano operativo per 120 minuti…») e quello dello Student Material è una descrizione di ciò che la scheda dovrebbe contenere. La metadata contiene comunque sei attività e tre obiettivi: il caso dimostra che la sola presenza strutturale o la validità sintattica non basta. Il gate fallisce entrambi i campi con `PLACEHOLDER_DOMINATED` e `INSUFFICIENT_SUBSTANCE`; il materiale fallisce inoltre `MISSING_REQUIRED_ELEMENT`. Le stringhe storiche riportano 18/29 parole per semplice split whitespace; le metriche riproducibili del checker sono 19/32 perché il tokenizer separa anche termini con slash/punteggiatura.

## Matrice T1–T16

`Expected` descrive l'esito del gate sulla fixture; `matrix PASS` significa che l'esito osservato coincide con quello atteso.

| Test | Caso | Atteso / osservato | Evidenza/rule principale | Matrice |
|---|---|---|---|---|
| T1 | CANDIDATE-B reale positivo | PASS / PASS | 503/513 parole; attività e obiettivi presenti; Plan/Student distinti | PASS |
| T2 | CANDIDATE-C reale negativo | FAIL / FAIL | `PLACEHOLDER_DOMINATED`, `INSUFFICIENT_SUBSTANCE`; anche elemento studente assente | PASS |
| T3 | Coppia positiva sintetica di storia | PASS / PASS | Piano 252 parole, scheda 224; richieste presenti | PASS |
| T4 | Coppia placeholder di storia | FAIL / FAIL | Marker dominanti; sostanza ed elementi/azioni richiesti mancanti | PASS |
| T5 | Istruzioni imperative legittime per lo studente | PASS / PASS | 65 parole; nessun marker; `Confronta`/`Rispondi` presenti | PASS |
| T6 | Piano e materiale identici | FAIL / FAIL | `NEAR_DUPLICATE_DELIVERABLE`, containment `1.0` | PASS |
| T7 | Sovrapposizione tematica, deliverable distinti | PASS / PASS | Coppia storia sostanziale; containment `0.0` | PASS |
| T8 | Struttura richiesta assente | FAIL / FAIL | `MISSING_REQUIRED_STRUCTURE` | PASS |
| T9 | Vuoto, whitespace, meta-string minima | FAIL / FAIL | `EMPTY_OR_NEAR_EMPTY`; per la meta-string anche insufficienza/placeholder | PASS |
| T10 | Sezione opzionale assente | PASS / PASS | Il contratto non la richiede; contenuto 19 parole | PASS |
| T11 | Medesimo contratto su storia ed elettronica | PASS / PASS | Entrambi PASS; contenuti 49 e 43 parole | PASS |
| T12 | `CORE_HAS_NO_DOMAIN_BRANCHES` | PASS / PASS | Scan core: zero hit dei termini vietati | PASS |
| T13 | Metadata popolata, contenuto meta-vuoto | FAIL / FAIL | Attività/obiettivi presenti ma testo 19 parole, marker ratio 1.0 | PASS |
| T14 | Un marker TODO non dominante | PASS / PASS | Ratio `0.2`; `PLACEHOLDER_SIGNAL` è WARN, nessun failure code | PASS |
| T15 | Caso breve ma valido secondo contratto breve | PASS / PASS | 11 parole, 9 token distinti; contratto dedicato | PASS |
| T16 | Piano copiato con breve consegna aggiunta | FAIL / FAIL | `NEAR_DUPLICATE_DELIVERABLE`, containment `1.0` | PASS |

## Analisi dei falsi positivi

Nelle fixture eseguite non si osservano falsi positivi: le istruzioni imperative legittime T5 passano; la coppia tematicamente affine ma con scopi e testi distinti T7 passa; la fixture mista T14 conserva `PASS` e registra il solo WARN. Il controllo della copia non reagisce alla semplice presenza di argomento/terminologia condivisi nei casi positivi.

Questo non dimostra assenza generale di falsi positivi. Marker lessicali dichiarati possono apparire legittimamente in una frase didattica; in tal caso un hit isolato produce WARN, ma molti hit o marker ripetuti potrebbero superare la soglia. Le soglie/marker vanno quindi definiti per contratto e il gate va mantenuto come controllo preliminare, non come revisore semantico completo.

## Genericità, determinismo e containment

Il test `CORE_HAS_NO_DOMAIN_BRANCHES` scandisce il solo modulo core per `sql`, `dbms`, `excel`, `spreadsheet`, `join`, `select`, `vendite`, `prodotti` e `riepilogo`: **0 hit**. DBMS e SQL compaiono esclusivamente nei dati di benchmark e nei contratti/fixture, non in branch o regole del core. La fixture sintetica di storia e quella di elettronica passano senza cambiare contratto; configurazione e requisiti specifici sono esterni alla libreria.

Non sono presenti chiamate HTTP o dipendenze esterne nell'implementazione; l'esecuzione è offline e ha registrato **0 network calls**. Il controllo di containment ha verificato che core, input, script, output, metriche, log e questo report si risolvano sotto `~/Workspace/teacher-service-design/`.

## Limiti e rischi residui

- Il rilevamento di placeholder si basa su marker espliciti/dichiarati e densità per frase: parafrasi evasive o meta-testi senza marker possono passare; una fixture ridotta non consente stime statistiche di precision/recall.
- Il conteggio parole/varietà non prova che le parole siano contenuto valido; un testo lungo ma vuoto semanticamente può ancora superarlo.
- La similarità a trigrammi rileva copie e containment lessicale, non parafrasi: un near-copy riscritto può sfuggire. Al contrario, boilerplate identico potrebbe generare un falso positivo. La soglia deve restare configurabile e osservabile.
- I path strutturali verificano presenza e conteggio, non la qualità semantica degli oggetti contenuti in quei path; T13 dimostra che il testo deve essere controllato separatamente.
- Il campione reale è una singola coppia positiva/negativa di generation Gate C; la copertura ortogonale è sintetica. Non sono stati testati corpus multilingui, materiali molto brevi senza contratto dedicato, contenuti lunghi con marker incidentali frequenti o un'ampia varietà di schemi applicativi.
- La scansione di genericità copre il set di termini vietati indicato dal task, non è una prova formale di non-dipendenza da ogni possibile dominio.
- Il workspace non è un repository Git (`git status` ha restituito “not a git repository”); non è stato possibile produrre un audit diff basato su Git.

## Verifiche eseguite e file prodotti

Comandi eseguiti:

```text
python3 -m unittest validation.work.C2.scripts.test_semantic_completeness -v
python3 validation/work/C2/scripts/run_c2.py
```

Risultati: **17/17 unit test OK**, **16/16 fixture matrix attese**, runner status `PASS`.

- Report: `validation/results/C2-semantic-completeness-gate-report.md`
- Core: `validation/shared/semantic_completeness.py`
- Contratti: `validation/work/C2/inputs/contracts.json`
- Fixture: `validation/work/C2/inputs/fixtures.json`
- Runner: `validation/work/C2/scripts/run_c2.py`
- Test: `validation/work/C2/scripts/test_semantic_completeness.py`
- Esiti completi per fixture/check/metriche: `validation/work/C2/outputs/c2-fixture-results.json`
- Metriche aggregate e hash real fixture: `validation/work/C2/metrics/c2-metrics.json`
- Log runner: `validation/work/C2/logs/c2-run.log`
- Log unit test: `validation/work/C2/logs/c2-unit-tests.log`

**Filesystem containment check: PASS.**

## Decisione

**C2: PASS.** Il gate intercetta i due casi placeholder canonici senza rifiutare le consegne imperative testate, opera con contratti dichiarativi generici e non contiene branch di dominio. Limiti lessicali e copertura ridotta sono esplicitati sopra e impediscono di interpretare il PASS come validazione semantica generale.

**Stato conclusivo: READY_FOR_C3_REVIEW.** Fermarsi a C2; nessun lavoro C3 è stato avviato.
