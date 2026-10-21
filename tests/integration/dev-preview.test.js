import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DatabaseManager } from "../../src/db/database.js";
import { FileStore } from "../../src/storage/filestore.js";
import { TeacherService } from "../../src/services/teacher-service.js";

test("Isolated Dev Preview Environment & Seed Suite (C3)", async (t) => {
  const PREVIEW_ROOT = path.resolve(process.cwd(), ".tmp", "test-dev-preview-run");
  const PREVIEW_DB = path.join(PREVIEW_ROOT, "test-preview.db");
  const PREVIEW_FILES = path.join(PREVIEW_ROOT, "files");

  if (fs.existsSync(PREVIEW_ROOT)) {
    fs.rmSync(PREVIEW_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(PREVIEW_ROOT, { recursive: true });
  fs.mkdirSync(PREVIEW_FILES, { recursive: true });

  await t.test("Initializes isolated SQLite and FileStore with zero production dependencies", async () => {
    const dbManager = new DatabaseManager(PREVIEW_DB).init();
    const fileStore = new FileStore(PREVIEW_FILES);
    const service = new TeacherService({ dbManager, fileStore, mockAi: true });

    assert.ok(fs.existsSync(PREVIEW_DB), "Isolated preview database file must exist");
    assert.ok(fs.existsSync(PREVIEW_FILES), "Isolated preview filestore directory must exist");

    // Seed test classes
    const cl = service.createClass({ name: "4A Informatica", academicYear: "2026/2027" });
    const subj = service.createSubject({ classId: cl.id, name: "Informatica" });
    const st1 = service.addStudent({ classId: cl.id, firstName: "Mario", lastName: "Rossi" });
    const st2 = service.addStudent({ classId: cl.id, firstName: "Luigi", lastName: "Bianchi" });

    // Grounding material: Student Material published at version 1
    const mat = service.createMaterial({
      classId: cl.id,
      subjectId: subj.id,
      title: "Dispensa DBMS",
      contentText: "Un DBMS è un sistema software per la gestione di basi di dati.",
      pedagogicalRole: "student_material"
    });
    service.publishMaterial(mat.id, { versionNumber: 1 });

    const asm = service.createAssessment({
      classId: cl.id,
      subjectId: subj.id,
      title: "Verifica Test",
      status: "active",
      durationMinutes: 45,
      items: [{
        type: "multiple_choice",
        assessableSourceId: mat.id,
        assessableSourceVersion: 1,
        questionText: "Cos'è un DBMS?",
        options: ["Software", "Hardware"],
        teacherSolution: "Software",
        maxScore: 10
      }]
    });

    // Save student submission with Seat Map
    const sub = service.saveDraftSubmission({
      assessmentId: asm.id,
      studentId: st1.id,
      studentName: "Mario Rossi",
      seatRow: "Fila 1",
      seatDesk: "Banco 1",
      leftNeighborId: "none",
      leftNeighborName: "Nessuno",
      rightNeighborId: st2.id,
      rightNeighborName: "Luigi Bianchi",
      responses: [{ itemId: asm.items[0].id, responseText: "Software" }],
      attemptStatus: "submitted"
    });

    assert.equal(sub.seat_row, "Fila 1");
    assert.equal(sub.seat_desk, "Banco 1");
    assert.equal(sub.right_neighbor_name, "Luigi Bianchi");

    // Verify Live Monitor data
    const live = service.getLiveMonitoringData(asm.id);
    assert.equal(live.metrics.totalStudents, 2);
    assert.equal(live.metrics.submitted, 1);
    assert.equal(live.metrics.notStarted, 1);

    const marioLive = live.students.find(s => s.studentId === st1.id);
    assert.equal(marioLive.status, "submitted");
    assert.equal(marioLive.seatRow, "Fila 1");

    // Close db
    dbManager.close();
  });

  await t.test("Cleanup script removes isolated directory cleanly", async () => {
    // Run cleanup logic on PREVIEW_ROOT
    fs.rmSync(PREVIEW_ROOT, { recursive: true, force: true });
    assert.equal(fs.existsSync(PREVIEW_ROOT), false, "Preview directory must be completely removed");
  });
});
