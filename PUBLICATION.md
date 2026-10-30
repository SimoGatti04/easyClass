# Pubblicazione — Politica del mirror pubblico

Questo repository è la base della candidata destinata alla pubblicazione su GitHub
(`easyClass`). Il file descrive **cosa è pubblicabile**, cosa è stato rimosso o redatto e cosa
resta deliberatamente incluso, così che nessun dato didattico reale, dato personale o
identificativo riservato venga esposto senza autorizzazione.

Stato: **content-final, metadata-pending** (vedi §5).

## 1. Dati esclusi dal repository e dalla sua cronologia

| Categoria | Percorsi storici | Motivo |
|---|---|---|
| Corpus didattico reale (6 documenti PDF/DOCX/XLSX) | `validation/corpus/source/` | materiale didattico reale di terzi; non autorizzato alla pubblicazione |
| Conversioni testuali integrali del corpus | `validation/artifacts/B1/` | riproducono verbatim il testo delle lezioni |
| Chunk store derivato dal corpus | `validation/artifacts/B2/` | contiene il testo delle lezioni a chunk |
| Gold set e annotazioni umane | `validation/corpus/gold/` | contengono estratti verbatim e giudizi su materiale reale |
| Artifact di gate con estratti testuali | `Gate-C-v2/attempt-09/{deterministic-checks,profile-validation,combined-phase1-phase2-matrix}.json`, `Gate-B-v2/predictions.jsonl`, `Spreadsheet-Adapter/workbook-ast.json` | incorporano porzioni del corpus |
| Copia duplicata dell'albero di validazione | `validation/validation/` | duplicato storico degli stessi dati |
| Cache Python (`__pycache__`) | `validation/shared/**` | artefatti di build con percorsi locali |
| Configurazione PM2 ritirata | `ecosystem.config.cjs` | runtime dismesso (produzione = K3s) |

Sono stati esclusi da **tutti i 38 commit** della cronologia, non solo dall'ultima revisione.
Verifica: `git log --all --name-only --pretty=format: | grep -c '<percorso>'` → `0`.

## 2. Redazioni applicate (cronologia inclusa)

| Rilievo | Sostituzione applicata |
|---|---|
| Indirizzo e-mail personale del Domain Owner | indirizzo sintetico riservato `teacher@school.example` |
| Principal di anteprima contenente il cognome | `sha256:preview_teacher_synthetic` |
| Nome proprio hardcoded nel mock di autenticazione | `Synthetic Teacher` |
| Dominio scolastico negli esempi e nel roster illustrativo | `scuola.example` (TLD riservato RFC 2606) |
| Acronimo dell'istituto | token neutro `CORPUS` |
| IP LAN del laboratorio e IP dell'overlay privato | `198.51.100.13`, `198.51.100.62` (TEST-NET-3, RFC 5737) |
| Alias host del server di backup | `<backup-host>` |
| Percorso home assoluto nei documenti | `~` |
| Roster illustrativo nell'help di import | segnaposto neutri (`Cognome Nome`, `email@esempio.example`) |
| Nomi dei file originali della libreria privata | rimossi da `docs/validation/01-benchmark-corpus.md` e `validation/corpus/SOURCES.md` |

## 3. Dati deliberatamente conservati

| Elemento | Classificazione | Motivazione |
|---|---|---|
| Endpoint pubblici di produzione e issuer OIDC (`*.simogatti.it`, Cloudflare Access) | `SAFE` | URL pubblici, nessuna credenziale; usati dai test come issuer |
| IP interni K3s `10.42.0.0/16` e `10.43.0.0/16` | `SAFE` | RFC 1918, effimeri, non instradabili, nessun valore di accesso |
| Hash di integrità SHA-256 e digest | `SAFE` | valori di verifica, non segreti |
| Nome e email dell'autore nei metadati dei commit | `REVIEW REQUIRED` | vedi §5 |
| Report aggregati del gate di validazione (`validation/results/`) | `SAFE` | metriche e decisioni, senza testo delle lezioni né dati di studenti |
| Screenshot UI in `.impeccable/` | `SAFE` | dati sintetici di sviluppo; nessun metadato testuale incorporato |

## 4. Segreti

Nessuna chiave privata, token JWT, chiave cloud, token GitHub/Slack/OpenAI, service account o
credenziale runtime è presente nella cronologia. `.env.example` contiene solo chiavi vuote.
La configurazione di produzione resta su Infisical/ESO e non è nel repository.

## 5. Metadati dei commit — in attesa di autorizzazione

La cronologia conserva l'attribuzione degli autori, ma 36 commit su 38 espongono ancora
l'indirizzo e-mail personale del Domain Owner nei campi author/committer.

La riscrittura degli indirizzi verso un indirizzo GitHub noreply **verificato** richiede la
conferma esplicita del Domain Owner e non viene eseguita automaticamente. Fino a quella conferma
la pubblicazione della cronologia resta `HOLD`.

Mappatura proposta (da applicare solo dopo conferma, senza inventare indirizzi):

- autore/committer con indirizzo personale → indirizzo noreply dell'account GitHub proprietario,
  solo se verificato sul profilo;
- nessuna attribuzione di contributi altrui a un unico account.

## 6. Riproduzione della verifica

```bash
# 1. Nessuna occorrenza dei dati esclusi/redatti in nessun commit
git rev-list --all | xargs -I{} git grep -I -l -e '<pattern>' {}

# 2. Nessun percorso escluso raggiungibile
git log --all --name-only --pretty=format: | sort -u | grep -E 'corpus/source|corpus/gold|artifacts/B1|artifacts/B2'

# 3. Integrità del repository
git fsck --full --strict
git count-objects -v
```

## 7. Regola operativa

Non reintrodurre nel mirror pubblico corpus, conversioni, gold set o screenshot contenenti
materiale didattico reale. Ogni nuova esclusione o redazione va registrata in questo file e
verificata sull'intera cronologia, non solo sull'ultimo commit.
