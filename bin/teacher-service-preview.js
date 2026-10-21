#!/usr/bin/env node
/**
 * Teacher Service — Isolated Local Development & LAN Preview Runner (C3)
 *
 * Provides a completely self-contained, reproducible environment with:
 * - Isolated SQLite database in .tmp/dev-preview/teacher-preview.db
 * - Isolated FileStore in .tmp/dev-preview/filestore/
 * - Mock/Synthetic preview authentication (teacher@school.example)
 * - Zero production dependencies (no K3s, no Cloudflare, no Infisical required)
 * - Rich seed demo data (Classes 4A & 3B, students, lessons, activities, submissions)
 * - Dual binding: accessible on localhost and mobile devices on LAN (0.0.0.0)
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseManager } from "../src/db/database.js";
import { FileStore } from "../src/storage/filestore.js";
import { TeacherService } from "../src/services/teacher-service.js";
import { createHttpApp } from "../src/server/http.js";

const PREVIEW_ROOT = path.resolve(process.cwd(), ".tmp", "dev-preview");
const PREVIEW_DB_PATH = path.join(PREVIEW_ROOT, "teacher-preview.db");
const PREVIEW_FILESTORE_DIR = path.join(PREVIEW_ROOT, "filestore");
const PORT = parseInt(process.env.PORT || "8780", 10);
const HOST = "0.0.0.0";

// Ensure isolation directory
if (!fs.existsSync(PREVIEW_ROOT)) {
  fs.mkdirSync(PREVIEW_ROOT, { recursive: true });
}
if (!fs.existsSync(PREVIEW_FILESTORE_DIR)) {
  fs.mkdirSync(PREVIEW_FILESTORE_DIR, { recursive: true });
}

// Enforce preview environment variables
process.env.NODE_ENV = "development";
process.env.TEACHER_SERVICE_AUTH_MODE = "preview";
process.env.TEACHER_SERVICE_TEACHER_EMAILS = "teacher@school.example";
process.env.TEACHER_SERVICE_DB_PATH = PREVIEW_DB_PATH;
process.env.TEACHER_SERVICE_STORAGE_DIR = PREVIEW_FILESTORE_DIR;

async function seedPreviewData(service) {
  const existingClasses = service.listClasses();
  if (existingClasses.length > 0) {
    return; // Already seeded
  }

  console.log("🌱 Inizializzazione dati dimostrativi riproducibili...");

  // 1. Classes
  const class4A = service.createClass({
    name: "4A Informatica",
    academicYear: "2026/2027",
    section: "A",
    description: "Indirizzo Informatica e Telecomunicazioni — Articolazione Informatica"
  });

  const class3B = service.createClass({
    name: "3B Liceo Scientifico",
    academicYear: "2026/2027",
    section: "B",
    description: "Opzione Scienze Applicate"
  });

  // 2. Subjects
  const subjBD = service.createSubject({
    classId: class4A.id,
    name: "Basi di Dati e SQL",
    code: "BD4",
    description: "Progettazione concettuale, logica, normalizzazione e linguaggio SQL"
  });

  const subjSR = service.createSubject({
    classId: class4A.id,
    name: "Sistemi e Reti",
    code: "SR4",
    description: "Architetture di rete e protocolli TCP/IP"
  });

  service.createSubject({
    classId: class3B.id,
    name: "Informatica",
    code: "INF3",
    description: "Algoritmi e strutture dati in Python"
  });

  // 3. Students in 4A
  const students4A = [
    { firstName: "Mario", lastName: "Rossi", email: "mario.rossi@scuola.example" },
    { firstName: "Luigi", lastName: "Bianchi", email: "luigi.bianchi@scuola.example" },
    { firstName: "Anna", lastName: "Verdi", email: "anna.verdi@scuola.example" },
    { firstName: "Marco", lastName: "Ferrari", email: "marco.ferrari@scuola.example" },
    { firstName: "Sofia", lastName: "Russo", email: "sofia.russo@scuola.example" },
    { firstName: "Giulia", lastName: "Esposito", email: "giulia.esposito@scuola.example" },
    { firstName: "Alessandro", lastName: "Romano", email: "alessandro.romano@scuola.example" },
    { firstName: "Chiara", lastName: "Colombo", email: "chiara.colombo@scuola.example" }
  ];

  const createdStudents4A = [];
  for (const s of students4A) {
    const student = service.addStudent({
      classId: class4A.id,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email
    });
    createdStudents4A.push(student);
  }

  // Students in 3B
  const students3B = [
    { firstName: "Davide", lastName: "Ricci", email: "davide.ricci@scuola.example" },
    { firstName: "Elena", lastName: "Bruno", email: "elena.bruno@scuola.example" },
    { firstName: "Matteo", lastName: "Marini", email: "matteo.marini@scuola.example" },
    { firstName: "Sara", lastName: "Conti", email: "sara.conti@scuola.example" }
  ];
  for (const s of students3B) {
    service.addStudent({
      classId: class3B.id,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email
    });
  }

  // 4. Lessons for 4A
  const lesson1 = service.createLesson({
    classId: class4A.id,
    subjectId: subjBD.id,
    title: "Lezione 1: Modello Relazionale e Vincoli d'Integrità",
    date: "2026-10-21",
    description: "Introduzione alle relazioni, chiavi primarie, vincoli di unicità e integrità referenziale",
    status: "completed"
  });

  service.createLesson({
    classId: class4A.id,
    subjectId: subjBD.id,
    title: "Lezione 2: Normalizzazione e Forme Normali (1NF, 2NF, 3NF)",
    date: "2026-10-22",
    description: "Dipendenze funzionali, anomalie di aggiornamento e decomposizione senza perdita",
    status: "planned"
  });

  // 5. Materials (T1 Lesson Pack for Lesson 1)
  service.createMaterial({
    title: "Lesson Plan — Modello Relazionale",
    contentText: "# Lesson Plan: Modello Relazionale\n\n## Obiettivi\n- Comprendere la definizione di relazione e tupla.\n- Identificare chiavi primarie e chiavi esterne.\n- Gestire i vincoli di integrità referenziale.",
    pedagogicalRole: "teacher_material",
    resourceType: "lesson_plan",
    classId: class4A.id,
    subjectId: subjBD.id,
    lessonId: lesson1.id,
    tags: ["relazionale", "database", "lezione1"]
  });

  const dispensa = service.createMaterial({
    title: "Dispensa Studente — Guida al Modello Relazionale",
    contentText: "# Guida allo Studio: Modello Relazionale\n\nUn database relazionale organizza i dati in tabelle formate da righe (tuple) e colonne (attributi).\n\nOgni tabella deve possedere una chiave primaria univoca.",
    pedagogicalRole: "student_material",
    resourceType: "student_note",
    classId: class4A.id,
    subjectId: subjBD.id,
    lessonId: lesson1.id,
    tags: ["dispensa", "studenti"]
  });

  service.publishMaterial(dispensa.id, { versionNumber: 1 });

  // 6. Assessments / Activities
  const testActivity = service.createAssessment({
    title: "Verifica di Laboratorio: Normalizzazione e Query SQL",
    description: "Verifica sommativa sulle forme normali, vincoli referenziali e interrogazioni SQL",
    classId: class4A.id,
    subjectId: subjBD.id,
    lessonId: lesson1.id,
    status: "active",
    durationMinutes: 45,
    maxScore: 30,
    items: [
      {
        type: "multiple_choice",
        assessableSourceId: dispensa.id,
        assessableSourceVersion: 1,
        questionText: "Quale forma normale elimina le dipendenze parziali dalla chiave primaria?",
        options: [
          { id: "A", text: "Prima Forma Normale (1NF)", isCorrect: false },
          { id: "B", text: "Seconda Forma Normale (2NF)", isCorrect: true },
          { id: "C", text: "Terza Forma Normale (3NF)", isCorrect: false },
          { id: "D", text: "Boyce-Codd (BCNF)", isCorrect: false }
        ],
        teacherSolution: "Seconda Forma Normale (2NF)",
        maxScore: 5,
        isSelfCorrecting: true,
        rubricJson: { criteria: "Risposta esatta: 5pt, errata: 0pt" }
      },
      {
        type: "open_short",
        assessableSourceId: dispensa.id,
        assessableSourceVersion: 1,
        questionText: "Definisci il concetto di chiave esterna (FOREIGN KEY) e spiega la regola di integrità referenziale.",
        options: [],
        teacherSolution: "Una chiave esterna è un attributo (o insieme di attributi) che fa riferimento alla chiave primaria di un'altra tabella. L'integrità referenziale garantisce che non possano esistere valori orfani.",
        maxScore: 10,
        isSelfCorrecting: false,
        rubricJson: { criteria: "Definizione corretta: 5pt, spiegazione integrità: 5pt" }
      },
      {
        type: "code",
        assessableSourceId: dispensa.id,
        assessableSourceVersion: 1,
        questionText: "Scrivi una query SQL per selezionare nome e cognome degli studenti con voto >= 24 ordinati per cognome crescente.",
        options: [],
        teacherSolution: "SELECT nome, cognome FROM studenti WHERE voto >= 24 ORDER BY cognome ASC;",
        maxScore: 10,
        isSelfCorrecting: false,
        rubricJson: { criteria: "Sintassi corretta: 5pt, filtro WHERE: 3pt, ORDER BY: 2pt" }
      },
      {
        type: "attachment",
        assessableSourceId: dispensa.id,
        assessableSourceVersion: 1,
        questionText: "Carica il file SQL con lo script di creazione dello schema DDL realizzato durante la sessione di laboratorio.",
        options: [],
        teacherSolution: "Script DDL con CREATE TABLE, PRIMARY KEY e FOREIGN KEY vincolati.",
        maxScore: 5,
        isSelfCorrecting: false,
        rubricJson: { criteria: "Script valido e privo di errori di sintassi: 5pt" }
      }
    ]
  });

  // Second activity: Exercise
  service.createAssessment({
    title: "Esercitazione Guidata: Transazioni ACID e Concorrenza",
    description: "Esercitazione formativa sulle proprietà delle transazioni e gestione del rollback",
    classId: class4A.id,
    subjectId: subjBD.id,
    lessonId: lesson1.id,
    durationMinutes: 60,
    maxScore: 10,
    items: [
      {
        type: "open_short",
        assessableSourceId: dispensa.id,
        assessableSourceVersion: 1,
        questionText: "Elenca le 4 proprietà ACID di una transazione e spiega in cosa consiste l'Atomicità.",
        options: [],
        teacherSolution: "Atomicità, Consistenza, Isolamento, Durabilità. Atomicità: la transazione viene eseguita per intero oppure annullata (tutto o niente).",
        maxScore: 5,
        isSelfCorrecting: false,
        rubricJson: { criteria: "Elenco 4 proprietà: 2pt, spiegazione atomicità: 3pt" }
      },
      {
        type: "code",
        assessableSourceId: dispensa.id,
        assessableSourceVersion: 1,
        questionText: "Scrivi un esempio di transazione SQL con istruzioni BEGIN TRANSACTION, COMMIT e ROLLBACK su errore.",
        options: [],
        teacherSolution: "BEGIN TRANSACTION; INSERT INTO conti VALUES (...); IF ERROR ROLLBACK; ELSE COMMIT;",
        maxScore: 5,
        isSelfCorrecting: false,
        rubricJson: { criteria: "Blocco transazionale corretto: 5pt" }
      }
    ]
  });

  // 7. Seed Simulated Submissions for Activity 1 (To showcase Live Monitoring, Seat Map & Submissions immediately)
  const items = testActivity.items;
  const now = new Date();

  // Student 0: Mario Rossi (In progress, seated in Fila 1 - Banco 1)
  service.saveDraftSubmission({
    assessmentId: testActivity.id,
    studentId: createdStudents4A[0].id,
    studentName: "Mario Rossi",
    seatRow: "Fila 1",
    seatDesk: "Banco 1",
    leftNeighborId: "none",
    leftNeighborName: "Nessuno",
    rightNeighborId: createdStudents4A[1].id,
    rightNeighborName: "Luigi Bianchi",
    responses: [
      { itemId: items[0].id, responseText: "B" },
      { itemId: items[1].id, responseText: "Una chiave esterna referenzia una chiave primaria di un'altra tabella." }
    ],
    attemptStatus: "in_progress"
  });

  // Student 1: Luigi Bianchi (Submitted, seated in Fila 1 - Banco 2)
  service.saveDraftSubmission({
    assessmentId: testActivity.id,
    studentId: createdStudents4A[1].id,
    studentName: "Luigi Bianchi",
    seatRow: "Fila 1",
    seatDesk: "Banco 2",
    leftNeighborId: createdStudents4A[0].id,
    leftNeighborName: "Mario Rossi",
    rightNeighborId: createdStudents4A[2].id,
    rightNeighborName: "Anna Verdi",
    responses: [
      { itemId: items[0].id, responseText: "B" },
      { itemId: items[1].id, responseText: "La chiave esterna garantisce che una tupla figlia non esista senza la relativa tupla genitore, prevenendo record orfani." },
      { itemId: items[2].id, responseText: "SELECT nome, cognome FROM studenti WHERE voto >= 24 ORDER BY cognome ASC;" },
      { itemId: items[3].id, responseText: "CREATE TABLE studenti (id INT PRIMARY KEY, nome VARCHAR(50));", attachmentName: "schema_scuola.sql", attachmentPath: "preview-seed/schema.sql" }
    ],
    attemptStatus: "submitted"
  });

  // Student 2: Anna Verdi (Graded and Reviewed, seated in Fila 1 - Banco 3)
  const subAnna = service.saveDraftSubmission({
    assessmentId: testActivity.id,
    studentId: createdStudents4A[2].id,
    studentName: "Anna Verdi",
    seatRow: "Fila 1",
    seatDesk: "Banco 3",
    leftNeighborId: createdStudents4A[1].id,
    leftNeighborName: "Luigi Bianchi",
    rightNeighborId: "none",
    rightNeighborName: "Nessuno",
    responses: [
      { itemId: items[0].id, responseText: "B" },
      { itemId: items[1].id, responseText: "La chiave esterna implementa il vincolo di integrità referenziale collegando due relazioni correlate." },
      { itemId: items[2].id, responseText: "SELECT nome, cognome FROM studenti WHERE voto >= 24 ORDER BY cognome;" },
      { itemId: items[3].id, responseText: "Schema DDL completato.", attachmentName: "ddl_completo.sql", attachmentPath: "preview-seed/ddl.sql" }
    ],
    attemptStatus: "submitted"
  });

  // Grade Anna Verdi and save teacher review
  await service.gradeSubmission({
    submissionId: subAnna.id,
    evaluator: "omniroute-preview"
  });
  service.reviewGrading({
    submissionId: subAnna.id,
    finalGrade: "28/30",
    reviewer: "Docente",
    itemOverrides: []
  });

  // Student 3: Marco Ferrari (In progress, seated in Fila 2 - Banco 1)
  service.saveDraftSubmission({
    assessmentId: testActivity.id,
    studentId: createdStudents4A[3].id,
    studentName: "Marco Ferrari",
    seatRow: "Fila 2",
    seatDesk: "Banco 1",
    leftNeighborId: "none",
    leftNeighborName: "Nessuno",
    rightNeighborId: createdStudents4A[4].id,
    rightNeighborName: "Sofia Russo",
    responses: [
      { itemId: items[0].id, responseText: "C" }
    ],
    attemptStatus: "in_progress"
  });

  // Student 4: Sofia Russo (Submitted, seated in Fila 2 - Banco 2)
  service.saveDraftSubmission({
    assessmentId: testActivity.id,
    studentId: createdStudents4A[4].id,
    studentName: "Sofia Russo",
    seatRow: "Fila 2",
    seatDesk: "Banco 2",
    leftNeighborId: createdStudents4A[3].id,
    leftNeighborName: "Marco Ferrari",
    rightNeighborId: "none",
    rightNeighborName: "Nessuno",
    responses: [
      { itemId: items[0].id, responseText: "Seconda Forma Normale (2NF)" },
      { itemId: items[1].id, responseText: "Una foreign key definisce il legame padre-figlio tra due tabelle." },
      { itemId: items[2].id, responseText: "SELECT nome, cognome FROM studenti WHERE voto >= 24 ORDER BY cognome ASC;" },
      { itemId: items[3].id, responseText: "Allegato consegnato.", attachmentName: "script_laboratorio.sql", attachmentPath: "preview-seed/lab.sql" }
    ],
    attemptStatus: "submitted"
  });

  console.log("✅ Dati dimostrativi riproducibili generati con successo!");
}

function getLanIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal && (name.startsWith("en") || name.startsWith("eth") || name.startsWith("wlan"))) {
        return net.address;
      }
    }
  }
  // Fallback to any non-internal IPv4
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

async function main() {
  console.log("================================================================");
  console.log("     TEACHER SERVICE — LOCAL DEV & LAN PREVIEW ENVIRONMENT      ");
  console.log("================================================================");
  console.log(`📂 Isolated Storage: ${PREVIEW_ROOT}`);
  console.log(`🗄️  Isolated SQLite:  ${PREVIEW_DB_PATH}`);
  console.log(`📁 Isolated Files:   ${PREVIEW_FILESTORE_DIR}`);

  const dbManager = new DatabaseManager(PREVIEW_DB_PATH).init();
  const fileStore = new FileStore(PREVIEW_FILESTORE_DIR);
  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true
  });

  await seedPreviewData(service);

  const app = await createHttpApp({
    service,
    authMode: "preview",
    teacherEmails: "teacher@school.example",
    isProduction: false
  });

  const lanIp = getLanIpAddress();

  app.server.listen(PORT, HOST, () => {
    console.log("");
    console.log("🚀 Server di Anteprima Locale & LAN ATTIVO!");
    console.log("");
    console.log("  💻 Accesso da Mac (Browser Locale):");
    console.log(`     • Homepage Portale:    http://localhost:${PORT}/`);
    console.log(`     • Area Studenti:       http://localhost:${PORT}/#/studente`);
    console.log(`     • Area Docente:        http://localhost:${PORT}/#/docente`);
    console.log("");
    console.log("  📱 Accesso da Smartphone / Tablet sulla stessa LAN Wi-Fi:");
    console.log(`     • Homepage Portale:    http://${lanIp}:${PORT}/`);
    console.log(`     • Area Studenti:       http://${lanIp}:${PORT}/#/studente`);
    console.log(`     • Area Docente:        http://${lanIp}:${PORT}/#/docente`);
    console.log("");
    console.log("  🛡️  Sicurezza & Isolamento:");
    console.log("     • Zero connessioni al database o storage di produzione");
    console.log("     • Zero esposizione pubblica o dipendenze Cloudflare/K3s");
    console.log("     • Identificazione studente senza password (zero credenziali)");
    console.log("     • Docente autenticato con identità locale protetta");
    console.log("");
    console.log("  🧹 Per ripulire i dati temporanei di anteprima:");
    console.log("     pnpm dev:preview:clean");
    console.log("----------------------------------------------------------------");
    console.log("Premi Ctrl+C per arrestare il server di anteprima.");
  });

  const shutdown = async () => {
    console.log("\nArresto controllato del server di anteprima...");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(err => {
  console.error("Errore critico durante l'avvio dell'anteprima:", err);
  process.exit(1);
});
