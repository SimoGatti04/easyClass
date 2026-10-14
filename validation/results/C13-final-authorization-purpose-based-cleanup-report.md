# Teacher Service — C13 Final Authorization & Purpose-Based Cleanup

**Data:** 12 ottobre 2026 (Europe/Rome)  
**Esito locale:** `PASS` per piano, record relayed, retention e regressioni offline.  
**Preflight Gemini-only:** `PASS`, synthetic-only, via il solo endpoint approvato.  
**Preparazione richiesta Teacher Material:** `BLOCKED` da un mismatch del gate di autorità tra C13 v004 e C11; nessuna proiezione o review template creati.  
**Teacher Material generation / invio della fonte C9:** non eseguiti.

## Piano v004 e conservazione

- Piano: `validation/work/C13/plans/authorization-plan-v004.json`.
- SHA-256 canonico: **`cbded01188f0ec4f83ad154f48fc0169aedf3e9a4a766fc8a36e658e58504682`**. SHA-256 dei byte del file: `d1e05a73736c6410b799bd81ff9c1a1511cbb0b34170558bbc204af1240977fa`.
- v003 è preservato byte-identico: SHA-256 dei byte `31d0df9cb4b59050ecb147171d7a92e67518c5a8ea957d90dea0c100742ca7ef`; SHA-256 canonico `a710f84e5f0f14b48fb36859dcef3ee2655e5e5d126cffb7da9024939532433d`.
- v004 non contiene retention fissa a giorni. La conservazione è limitata alla necessità della valutazione; cleanup manuale owner-controlled solo dopo il checkpoint e dopo i controlli di ownership, dipendenze, preservazione e conseguenze sui manifest immutabili.
- Artifact temporanei: candidati al cleanup dopo i controlli. Evidenze essenziali: da preservare per provenance/review. Risultati selezionati come benchmark: da preservare con provenance. Fonti originali e materiali didattici permanenti: fuori dal cleanup sperimentale. Nessuna cancellazione è stata effettuata.

## Record autorizzativo

- Record: `validation/work/C13/authorizations/domain-owner-authorization-v004.json`; SHA-256 byte `822896b4a22f6ad9d89c8930b0d9f924e2d9e201fe49e0f8c1c73a18b2ae8b5d`.
- Il record non simulato è legato allo SHA canonico v004 e riporta le decisioni esplicite riferite dal Domain Owner: endpoint esatto `http://198.51.100.13/v1`, accettazione del trasporto LAN HTTP non cifrato limitata a questa destinazione/esperimento, downstream `UNREPORTED` accettato, fonte C9 ed elaborazione esterna approvate, conservazione locale limitata alla necessità, nessun controllo economico Teacher Service e limiti tecnici C13 invariati.
- Il record dichiara esplicitamente `identity_record.verification_status=NOT_PERFORMED` e `attestation=null`; non pretende verifica indipendente dell'identità. L'approvazione della richiesta di generazione Teacher Material resta separata e non concessa.
- Validazione locale plan/record, hash del source e pin implementativi: **PASS**. Source SHA-256 `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035` coincide col pin.

## Preflight sintetica autorizzata

Dopo il blocco iniziale del controllo di egress, il Domain Owner ha confermato esplicitamente l'autorizzazione per le sole probe sintetiche, accettando HTTP LAN non cifrato e downstream `UNREPORTED`. La stessa preflight prevista dal runner è stata quindi eseguita una sola volta. Nessun workaround è stato usato.

- Artifact versionato: `validation/work/C13/preflight/c13-gemini-preflight-20261012T001710139655Z-05957652.json`.
- SHA-256 artifact: `4dbc3f4c4c6771393b7456e8a5347cbcc90364a920fdcb62b6eb6a73a37e5fa2`.
- Esito reale: `PASS`; timestamp `2026-10-12T00:17:18.647422+00:00`.
- Catalogo live: `CATALOG_AVAILABLE`, 1 GET; identity basis `LIVE_CATALOG`.
- Route Gemini: probe basic e structured entrambe HTTP 200, identity `VERIFIED`, contenuto non vuoto, `finish_reason=stop`, terminazione `done`; la structured probe ha anche JSON parse e schema `PASS`.
- Chiamate remote: **3** complessive (catalogo 1 + route probe 2; structured probe 1). Corpus calls: **0**. `synthetic_probe_only=true`; `secret_persisted=false`.
- Il runtime loader dedicato è stato usato dal percorso previsto; nessuna lettura manuale o stampa del segreto. Nessuna fonte C9, materiale didattico o dato personale è stato trasmesso.

## Blocco nella preparazione della proiezione esatta

Dopo il PASS della preflight è stato tentato il solo comando locale `remote-start`, necessario a creare il run C11-owned da cui persistere la proiezione. Il comando è terminato prima di creare/modificare un run con:

`GateRejected: remote C13 run requires explicit, non-simulated Domain Owner authorization`.

Causa concreta verificata nel codice:

- il validator C13 per schema v004 accetta e richiede `authority=DOMAIN_OWNER_EXPLICIT_RELAYED`, `decision_source=USER_RELAYED_EXPLICIT_DOMAIN_OWNER_DECISIONS` e identità non attestata;
- `C11.start_experiment()` accetta per il modo remoto solo `authority=DOMAIN_OWNER_EXPLICIT`.

Il record v004 è quindi coerente col nuovo vincolo di non attestare identità, ma incompatibile con il gate C11; i test C13 fixture usano il valore diretto legacy e non coprono questa combinazione v004→C11. Non è stato aggirato il controllo, trasformato il record, modificato codice o modificato il piano, perché il piano pinna le implementazioni e tale cambiamento richiederebbe revisione/versionamento e una nuova verifica di coerenza. Nessun run parziale, proiezione o stage-review template è stato creato; i tre run storici in `validation/work/C13/runs` sono rimasti gli unici presenti.

**Richiesta esatta da approvare:** non disponibile. La request projection Teacher Material non è stata generata né persistita; presentare una richiesta ricostruita manualmente come esatta violerebbe la provenance del percorso C11/C13. Nessuna generazione è stata avviata.

## Test, preservazione e risorse

- C10–C13 offline: **77/77 PASS**.
- C6 offline: **82/82 PASS**.
- Totale: **159/159 PASS**; syntax/import e `plan-hash` PASS.
- Artifatti v003 e precedenti preservati; preflight nuovo scritto su path versionato non-overwriting.
- Nessuna modifica a C7, registry, eligibility o Gate D; nessuna generazione né corpus call.
- I `.pyc` creati accidentalmente dalla verifica `compileall` sono stati rimossi. I test hanno completato il teardown dei propri temporary fixture.
- Le directory preesistenti `validation/work/C13/.dev-run`, `.dev-run2`…`.dev-run6` e `.hashdebug` sono state lasciate intatte: non create da questo task e ownership/consumer non verificabili. Nessun'altra risorsa temporanea nuova è stata trattenuta.
- Il progetto non contiene `.git`; non è disponibile un diff Git.

## Stato finale

Il piano e le decisioni di retention sono validati e la preflight sintetica è realmente PASS. Il seguito è **BLOCKED** esclusivamente alla preparazione della request projection dall'incompatibilità del gate C13 v004 relayed-authority con il gate remoto C11 legacy. Serve una correzione/versione coerente del contratto di autorità, mantenendo `identity verification=NOT_PERFORMED`, e relativa revisione dei pin prima di creare la proiezione. L'approvazione della request e la generazione Teacher Material restano comunque non autorizzate.
