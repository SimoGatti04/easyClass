# Benchmark Corpus — Manifest (public mirror)

> Provenienza: corpus didattico reale conservato privatamente dal Domain Owner e **non pubblicato**.
> Scopo: corpus di fattibilità iniziale B1/B2/B3.
> Profilo privacy: materiali didattici; nessun dato personale individuale di studenti atteso.

## Perché questo corpus

Il corpus reale conteneva già le famiglie di artefatti che il Teacher Service deve produrre:
script docente lunghi, dispense studente, materiale per lo studio autonomo, esercizi, file
tecnici/demo e più materie/formati.

## Core scenarios

### S1 — DBMS & SQL — 2 ore
Script docente, scheda lezione, dispensa, guida d'uso, setup database, esercizi e soluzioni SQL.

Use case: Teacher Script lungo, distinzione materiale studente, retrieval tecnico, esercizi/soluzioni.

### S2 — Cybersecurity / crittografia simmetrica — 2 ore
Script docente, scheda lezione, dispensa, scaletta lavagna, demo/lab offline e self-test.

Use case: lezione teorica + pratica, più sorgenti correlate, retrieval tra artefatti simili.

### S3 — Storia dell'informatica / Enigma / Turing
Materiale docente, materiale studente e dispensa di studio.

Use case: parsing DOCX, generazione narrativa, differenziazione docente/studente.

### S4 — Excel — 2 ore
Materiale docente, materiale studente, workbook demo e workbook soluzioni.

Use case: DOCX + PDF + XLSX, lezione ricca di esercizi, parsing di fogli di calcolo.

## Initial B1 parsing set

Il set iniziale copriva 22 artefatti su quattro materie, raggruppati per famiglia:

1. script docente (PDF/DOCX);
2. schede lezione e dispense studente (PDF);
3. guide d'uso, scalette e note di schema (Markdown);
4. demo e self-test offline (HTML);
5. setup, esercizi e soluzioni SQL;
6. workbook demo e soluzioni (XLSX).

## Reference-output rule

Gli output preesistenti sono riferimenti, non ground truth perfetta. Per ogni scenario vanno
registrati i topic richiesti, la durata prevista, esempi/esercizi importanti, i fatti di sorgente
da preservare e i limiti noti dell'artefatto esistente.

## B3 generation scenarios

- G1 DBMS/SQL: pacchetto da 2 ore.
- G2 Cybersecurity: pacchetto teorico/pratico da 2 ore.
- G3 Storia: lezione narrativa da 45–60 minuti.
- G4 Excel: lezione da 2 ore ricca di esercizi.
- G5 Partial-source case: set di sorgenti volutamente incompleto per testare grounding e gap handling.

## Corpus expansion rule

Aggiungere documenti solo quando introducono un caso mancante (scansione, tabella complessa,
formule, slide ricche di immagini, documento molto lungo, OCR scarso). La diversità conta più del
raggiungimento di una soglia numerica.

## Stato attuale

`WITHHELD` — il corpus reale e i suoi derivati non sono pubblicati in questo repository. Nel mirror
restano i report aggregati del gate; vedi [`PUBLICATION.md`](../../PUBLICATION.md).
