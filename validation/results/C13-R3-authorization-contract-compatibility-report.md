# Teacher Service — C13-R3: Authorization Contract Compatibility

**Data:** 12 ottobre 2026 (Europe/Rome)  
**Esito:** `PASS` per compatibilità dei contratti, regressioni offline e preparazione della request projection.  
**Stato generazione:** fermata prima di qualunque inferenza o invio della fonte.

## 1. Causa concreta e correzione minima

Il piano/record v004 rappresenta le decisioni esplicite del Domain Owner come `DOMAIN_OWNER_EXPLICIT_RELAYED`, con provenienza `USER_RELAYED_EXPLICIT_DOMAIN_OWNER_DECISIONS` e `identity_record.verification_status=NOT_PERFORMED`. Il gate di avvio remoto C11 accettava soltanto `DOMAIN_OWNER_EXPLICIT`; pertanto il run non poteva essere creato anche se il validator C13 aveva già accettato il record relayed. Non era un problema di modello o della preflight Gemini: era una discrepanza tra i contratti di autorità C13 e C11.

La correzione è una seam di compatibilità circoscritta al modo C13 sperimentale, mantenendo C11 come unica autorità per run, stati, checkpoint, manifest, versioni, gates e continuazioni:

- I contratti C13 v2/v3 conservano la semantica storica `DOMAIN_OWNER_EXPLICIT`.
- I contratti C13 v4/v5 possono usare `DOMAIN_OWNER_EXPLICIT_RELAYED` solo se il record vincolato al piano dichiara la provenienza relayed e `identity_record` esatto `NOT_PERFORMED`/`attestation=null`.
- L'avvio del run valida schema, decisione, hash del piano, route e stato non simulato. La provenance relayed non diventa attestazione d'identità.
- Ogni generazione richiede un gate separato, non simulato e vincolato alla proiezione esatta, ai relativi hash, alla fase, al run, al piano e a una sola chiamata.
- Ogni continuazione resta separata e riferita alla versione/hash dell'output completato e all'esatta proiezione/hash della fase successiva.
- I template hanno decisione `REQUIRES_DOMAIN_OWNER_APPROVAL`/`REQUIRES_DOMAIN_OWNER_DECISION`; non sono autorizzazioni. Non sono state create stage authorization approvate.
- Nessuna regola generica di C11 è stata allentata; i contratti C11 ordinari e i record storici mantengono il comportamento preesistente.

Il piano/record v004 non è stato riscritto. È stato preparato v005 come rebinding versionato delle sole decisioni già riferite: non aggiunge una decisione, una prova indipendente d'identità o l'autorizzazione della richiesta Teacher Material.

## 2. Piano, record e implementazione

- Piano corrente: `validation/work/C13/plans/authorization-plan-v005.json`.
- SHA-256 canonico vincolato dal record: **`8e7098177b529d0dc71578280a5f49c4f081f2284454e5c0999c2ae31cfac9e6`**.
- SHA-256 dei byte del file piano: `c1898fb983dd629c17a2c89ae43ea8c2c1a6d95fc05342a46189440bf280a96c`.
- Record relayed v005: `validation/work/C13/authorizations/domain-owner-authorization-v005.json`; SHA-256 canonico `0f295f7d77e844c530839b448c87e57d9a26d271423958e93371ed6d7316686a`; SHA-256 dei byte `107fe721a150df19cac07314ccd07b66c193512c028c13221345de666808d113`.
- Template non autorizzante: `validation/work/C13/authorizations/domain-owner-authorization-template-v005.json`; SHA-256 dei byte `5f3b1d0a08b31d0a2e7f4fe3304c48736111c4f055bbdfe2147c2e2d60a9ac24`.
- v004 e le versioni anteriori sono state lasciate inalterate. I pin implementativi del piano v005 sono stati ricalcolati/validati dal validator contro i file correnti; `start_remote_experiment` e `_approved_remote_inputs` hanno verificato hash piano/record, sorgente C9, snapshot identità, limiti, destinazione, parametri e pin prima della creazione del run.
- Pin aggiornati/validati pertinenti nel piano v005: `c11_lifecycle=895be2982c3c7cec7a8811fd7c6d2d895a270740a1ccb7705bbe689d8fbcfd9f`; `c13_adapter=37b28f3e6f94c5b655363118b7cb75481b2c0f06590f4dea073df6da1ec27fe3`; `c13_preflight_runner=9015d097a9a7cd4bcc150bbfbc477dc3da73d13d446e489dc7abee553634b402`. Il piano valida inoltre i pin invariati di C6, C11/C12 contract e runtime loader.
- Il record mantiene `authority=DOMAIN_OWNER_EXPLICIT_RELAYED`, `decision_source=USER_RELAYED_EXPLICIT_DOMAIN_OWNER_DECISIONS`, identità `NOT_PERFORMED`, e `stage_request_authorization=NOT_GRANTED_PENDING_EXACT_REQUEST_REVIEW`.

## 3. Regressioni e test

Il test della preflight C13 è stato aggiornato per usare il piano e il record reali v005, invece di una fixture v4 costruita a mano; i fake catalog/route restano offline e non effettuano rete. Le verifiche includono inoltre i record storici effettivi v004.

- C10–C13: **80/80 PASS** (C10 23, C11 18, C12 15, C13 24 inclusa preflight).
- C6: **82/82 PASS**.
- Totale: **162/162 PASS**.
- Copertura C13 pertinente: creazione run C11 con v004 reale; v004/v005 relayed; rifiuto di record simulato, autorità/provenienza/identità non compatibili e hash errati; stage authorization non concessa; template non autorizzante; gate Student Material e Assessment; decisioni di continuazione vincolate all'output e alla request successiva; parametri e route invariati.
- Nessuna chiamata di rete durante i test; nessun caricamento della configurazione runtime o lettura di credenziali.

## 4. Run C11 remoto preparato, senza generazione

- Run ID: **`c11-20261012T004527Z-03177a92`**.
- Modalità/stato: `C13_EXPERIMENTAL_REMOTE` / `C13_READY_FOR_TEACHER_MATERIAL`.
- Run persistito con C11, checkpoint iniziale e manifest; piano e record v005 sono snapshot versionati nel run.
- Proiezione Teacher Material persistita in: `validation/work/C13/runs/c11-20261012T004527Z-03177a92/gates/experiment/teacher_material-request-projection-v0001.json`.
- SHA-256 file proiezione: `adacd0224a9c6d0f84ce3a0eaebb0f5884e273300425902ae1cd3547c335d8d1`.
- SHA-256 request canonica: `1a25dcd97a2a8adb99910116e890dae8f77d884af948ddfe44791f0f220509d7`.
- SHA-256 rendered messages: `ec0514cad5d34f9328153df5c764880d793a065515105520960fc395bacba7d2`.
- SHA-256 response schema/format: `1dfcc1790a8d0b758a9641b607f3c076ca5ea41e18d9a70c0151ec0483d1bcd1`.
- Fonte C9 `validation/work/C9/inputs/sources/dbms_student_lesson.md`: SHA-256 `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`; corrisponde alla fonte congelata nel piano e al testo `source_text` della request. La request ha `source_context={}` e `evidence_prompt_view=null`; la visibilità della fonte è esplicita nel payload Teacher Material.
- Il payload HTTP JSON completo preparato, senza header Authorization né credenziali, è salvato byte-per-byte in `validation/work/C13/reviews/c13-r3-teacher-material-request-review-c11-20261012T004527Z-03177a92-v0001.request.json`; SHA-256 `4ecbfb784233366202ac67df9beafbcd295fb41aeb38fe70c0374e081968dfc2`.
- Packet leggibile per revisione ChatGPT/Domain Owner: `validation/work/C13/reviews/c13-r3-teacher-material-request-review-c11-20261012T004527Z-03177a92-v0001.md`; SHA-256 `2f37cc338f09ab552a07b43d37c924be729f7eae15a058b1ac5f55e5bd25d05e`. Include prompt effettivo, testo fonte esattamente visibile al modello, endpoint/route, parametri, schema, hash e decisioni ancora richieste. Packet e payload sono owner-only (`0600`).
- La proiezione salvata è stata rigenerata deterministicamente dal run C11 e confrontata con l'artifact persistito; renderer C6 e parametri C6 hanno passato la verifica offline. I controlli statici del request guard generico C6 sono passati con `secret=None`; non è stato caricato un segreto per il confronto del secret sentinel.
- Stato contatori del run al termine della preparazione: remote `0`, inference `0`, corpus remote `0`, generation attempted/completed/uncertain `0/0/0`.

La preflight sintetica Gemini-only PASS precedente è stata preservata in `validation/work/C13/preflight/c13-gemini-preflight-20261012T001710139655Z-05957652.json`; in questo task **non** è stata ripetuta. Non è considerata fresca per una futura chiamata: il piano v005 richiede una nuova preflight immediatamente prima della generazione, successiva alla review/autorizzazione della request esatta.

## 5. Richiesta esatta da revisionare

Il testo completo e la fonte visibile sono incorporati nel packet di review sopra. Il body JSON effettivo, con route, messaggi, parametri e schema, è il sidecar byte-exact `.request.json`. I valori principali sono:

- route: `agy/gemini-3.8-flash-tiered`;
- endpoint: `http://198.51.100.13/v1/chat/completions` (HTTP LAN non cifrato, eccezione limitata già registrata);
- parametri C6: `temperature=0.2`, `top_p=0.9`, `stream=true`, `stream_options.include_usage=true`;
- `max_tokens=3000`, una richiesta per la fase, nessun retry inference;
- risposta structured JSON secondo lo schema persistito e hashato nella proiezione.

Il body esatto da sottoporre a review è disponibile nel file payload indicato; non è stato inviato.

## 6. Blocchi e confine operativo

Non è stato eseguito `remote-stage`; non sono state eseguite inferenze, né trasmessa la fonte. La preflight storica non autorizza da sola la generazione e non è più una verifica fresca. Restano necessari:

1. review di ChatGPT del packet/request esatta;
2. autorizzazione separata del Domain Owner per una sola generazione Teacher Material, legata a run, piano e hash della request/proiezione, route e limite token;
3. nuova preflight Gemini-only synthetic-only PASS immediatamente prima della chiamata;
4. successiva decisione esplicita per continuare a Student Material, legata all'esatta versione/hash generata e alla successiva request.

Nessun record di autorizzazione per la generazione è stato creato o simulato. Nessuna credenziale è stata letta. Registry, eligibility, C7 e Gate D non sono stati modificati; Gate D resta `BLOCKED`.
