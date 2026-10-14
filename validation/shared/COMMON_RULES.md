# Regole comuni per tutti gli agenti di validazione

## Root obbligatoria

Tutto ciò che l'agente **crea o modifica** deve rimanere sotto:

`~/Workspace/teacher-service-design/`

È vietato produrre output persistenti altrove.

Sono ammessi file esterni solo come **input in sola lettura** o runtime già presenti, ad esempio `~/Workspace/development-environment/`.

Se un tool genera output fuori dal progetto, impostare esplicitamente output/working directory dentro `validation/`.

## Workspace operativo

Ogni task usa:

`~/Workspace/teacher-service-design/validation/work/<TASK>/`

Sottocartelle consigliate:
- `inputs/`
- `scripts/`
- `outputs/`
- `logs/`
- `tmp/`
- `metrics/`

Report finali:
`validation/results/`

Artifact condivisi downstream:
`validation/artifacts/`

## Source of truth

Prima di iniziare leggere almeno:
1. `docs/00-design-method.md`
2. `docs/dossiers/10-ai-architecture.md`
3. `docs/dossiers/11-data-privacy-governance.md`
4. `docs/validation/00-feasibility-benchmark-gate.md`
5. `docs/validation/01-benchmark-corpus.md`
6. il proprio file `roles/<role>.md`
7. il proprio file `tasks/<task>.md`

## Principi

- Non ridisegnare il prodotto durante un benchmark.
- Non modificare i dossier 01–11 salvo richiesta esplicita.
- Non installare nuovi stack per comodità.
- Preferire componenti già presenti nel development-environment.
- Un failure è un dato: documentarlo, non mascherarlo.
- Usare dati reali non sensibili.
- Rendere i test riproducibili.
- Registrare versioni, comandi, modelli, parametri e hardware.
- Separare fatti misurati, interpretazioni e raccomandazioni.
- Non scegliere una tecnologia solo per score massimo: includere semplicità, footprint, latenza, manutenzione, riuso e local/free viability.
- OmniRoute/API remote sono reference opzionali, non dipendenza obbligatoria del core.
- Per qualunque accesso OmniRoute del Teacher Service o dei suoi benchmark usare esclusivamente la configurazione dedicata del progetto (`.env.local`) tramite `validation/shared/runtime_config.py`.
- La credenziale condivisa dell'host `OMNIROUTE_API_KEY` è fuori perimetro: non deve essere letta, usata, copiata, modificata o impiegata come fallback. Sono vietati anche fallback verso `~/.omniroute/.env`, configurazioni Codex o provider API key dirette.
- Se `TEACHER_SERVICE_OMNIROUTE_API_KEY` manca o non è valida, fermarsi fail-closed con `AUTH_REQUIRED_TEACHER_SERVICE` senza cercare altre credenziali.
- Non stampare o persistere secret in log, report, JSON, manifest o request dump.
- Non modificare `development-environment` salvo autorizzazione esplicita.

## Chiusura

Prima di terminare:
1. verificare containment filesystem;
2. lasciare temporanei solo sotto `validation/work/<TASK>/tmp/` o eliminarli;
3. scrivere il report previsto;
4. elencare test eseguiti, non eseguiti, risultati, problemi e prossimo passo.
