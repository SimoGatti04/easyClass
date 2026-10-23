import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { OrganizationService } from '../../src/services/organization-service.js';
import { MaterialService } from '../../src/services/material-service.js';
import { AssessmentService } from '../../src/services/assessment-service.js';
import { IntegrityAnalysisService } from '../../src/services/integrity-analysis-service.js';
import { OmniRouteClient } from '../../src/ai/omniroute-client.js';
import { AuthorizationError, ConflictError, ValidationError } from '../../src/core/errors.js';

test('C6 integrity analysis uses final synthetic submissions, exact published sources, and teacher-only append-only reviews', async (t) => {
  const root = path.resolve(process.cwd(), '.tmp', `integrity-analysis-${process.pid}-${Date.now()}`);
  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(root);
  const org = new OrganizationService(dbManager);
  const materialService = new MaterialService(dbManager, fileStore, org);
  const assessmentService = new AssessmentService(dbManager, materialService, new OmniRouteClient({ mockOffline: true }), null, fileStore);
  const integrity = new IntegrityAnalysisService({ dbManager, assessmentService, materialService });

  t.after(() => {
    dbManager.close();
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  });

  const classroom = org.createClass({ name: '4A Sintetica C6', academicYear: '2026/2027' });
  const subject = org.createSubject({ name: 'Informatica C6', classId: classroom.id });
  const lesson = org.createLesson({ title: 'Tabelle e chiavi', classId: classroom.id, subjectId: subject.id, orderIndex: 1 });
  const publishedSource = materialService.createMaterial({
    title: 'Dispensa C6 sintetica',
    contentText: 'Una chiave primaria identifica in modo univoco ogni riga. Una chiave esterna collega tabelle tramite valori corrispondenti.',
    pedagogicalRole: 'student_material', classId: classroom.id, subjectId: subject.id, lessonId: lesson.id
  });
  materialService.publishMaterial(publishedSource.id, { versionNumber: 1 });
  const privateMaterial = materialService.createMaterial({
    title: 'Appunti riservati C6',
    contentText: 'C6_PRIVATE_TEACHER_ONLY_SECRET',
    pedagogicalRole: 'teacher_material', classId: classroom.id, subjectId: subject.id, lessonId: lesson.id
  });

  const assessment = assessmentService.createAssessment({
    title: 'Confronto sintetico C6', classId: classroom.id, subjectId: subject.id, lessonId: lesson.id,
    items: [
      {
        type: 'open_extended', questionText: 'Descrivi un possibile comportamento anomalo nel percorso dati.', maxScore: 5,
        teacherSolution: 'TEACHER_SOLUTION_PRIVATE_C6', assessableSourceId: publishedSource.id, assessableSourceVersion: 1
      },
      {
        type: 'open_short', questionText: 'Che cosa identifica una chiave primaria?', maxScore: 2,
        assessableSourceId: publishedSource.id, assessableSourceVersion: 1
      },
      {
        type: 'code', questionText: 'Implementa una funzione che somma i valori di un array.', maxScore: 3,
        language: 'javascript', starterCode: '', assessableSourceId: publishedSource.id, assessableSourceVersion: 1
      }
    ]
  });
  const [longItem, shortItem, codeItem] = assessment.items;
  const submissions = [
    {
      studentId: 'student-c6-a', studentName: 'Ada Demo', seat_row: 'B', seat_desk: 2,
      responses: [
        { itemId: longItem.id, responseText: 'Il processo visita il nodo iniziale; poi l’indice viola la barriera gialla mentre aggiorna il puntatore circolare e registra il valore residuo nel buffer temporaneo.' },
        { itemId: shortItem.id, responseText: 'Una chiave primaria identifica in modo univoco ogni riga.' },
        { itemId: codeItem.id, responseText: 'function calculateSum(values) { let result = 0; for (let index = 0; index < values.length; index++) { result += values[index]; } return result; }' }
      ]
    },
    {
      studentId: 'student-c6-b', studentName: 'Luca Demo', seat_row: 'B', seat_desk: 3,
      responses: [
        { itemId: longItem.id, responseText: 'A ogni ciclo l’indice viola la barriera gialla, quindi il puntatore circolare viene aggiornato e il valore residuo passa nel buffer temporaneo prima del nodo iniziale.' },
        { itemId: shortItem.id, responseText: 'Una chiave primaria identifica in modo univoco ogni riga.' },
        { itemId: codeItem.id, responseText: 'function sum(items) { let total = 0; for (let i = 0; i < items.length; i++) { total += items[i]; } return total; }' }
      ]
    },
    {
      studentId: 'student-c6-c', studentName: 'Mia Demo', seat_row: 'D', seat_desk: 1,
      responses: [
        { itemId: longItem.id, responseText: 'Il percorso usa un controllo ordinario; poi l’indice viola la barriera gialla, ma il registro principale mantiene il valore previsto durante il ciclo.' },
        { itemId: shortItem.id, responseText: 'Una chiave primaria identifica in modo univoco ogni riga.' },
        { itemId: codeItem.id, responseText: 'const sumValues = values => values.reduce((total, value) => total + value, 0);' }
      ]
    },
    {
      studentId: 'student-c6-d', studentName: 'Noa Demo', seat_row: 'D', seat_desk: 2,
      responses: [
        { itemId: longItem.id, responseText: 'La procedura termina quando la tabella raggiunge la soglia prevista e restituisce il conteggio accumulato nel registro principale.' },
        { itemId: shortItem.id, responseText: 'Una chiave primaria identifica in modo univoco ogni riga.' },
        { itemId: codeItem.id, responseText: 'function countRows(rows) { return rows.length; }' }
      ]
    }
  ].map(({ seat_row, seat_desk, ...submission }) => {
    const saved = assessmentService.importSubmission({ assessmentId: assessment.id, ...submission });
    dbManager.prepare('UPDATE assessment_submissions SET seat_row = ?, seat_desk = ? WHERE id = ?').run(seat_row, seat_desk, saved.id);
    return saved;
  });

  const report = integrity.analyzeAssessment(assessment.id);
  assert.equal(report.scope.submittedAttempts, 4);
  assert.equal(report.assessment.version, assessment.version);
  assert.ok(report.sourceContexts.some((context) => context.source.id === publishedSource.id && context.source.version === 1),
    'exact published material version should be recognized as legitimate context');
  assert.ok(!JSON.stringify(report).includes(privateMaterial.id));
  assert.ok(!JSON.stringify(report).includes('C6_PRIVATE_TEACHER_ONLY_SECRET'));
  assert.ok(!JSON.stringify(report).includes('TEACHER_SOLUTION_PRIVATE_C6'));

  const textEvidence = report.evidence.find((entry) => entry.kind === 'shared_distinctive_phrase' && entry.itemId === longItem.id && entry.attempts.some((attempt) => attempt.submissionId === submissions[0].id) && entry.attempts.some((attempt) => attempt.submissionId === submissions[1].id));
  assert.ok(textEvidence, 'distinctive phrase shared by changed long answers should be reported');
  assert.match(textEvidence.matchedExcerpt, /indice viola la barriera/i);
  assert.equal(textEvidence.attempts.length, 2);
  assert.equal(textEvidence.seatContext?.[0]?.relation, 'adjacent_seats');
  assert.ok(report.evidence.some((entry) => entry.attempts.some((attempt) => attempt.submissionId === submissions[0].id) && entry.attempts.some((attempt) => attempt.submissionId === submissions[2].id)),
    'similarity should be compared even when the students are not seated nearby');
  assert.ok(!report.seatContexts.some((context) => context.attempts.some((attempt) => attempt.submissionId === submissions[0].id) && context.attempts.some((attempt) => attempt.submissionId === submissions[2].id)),
    'distant similar submissions should not acquire fabricated proximity context');
  assert.match(textEvidence.interpretation, /non costituisce prova/i);

  const codeEvidence = report.evidence.find((entry) => entry.kind === 'shared_code_token_shape' && entry.itemId === codeItem.id);
  assert.ok(codeEvidence, 'renamed code with the same token shape should be reported');
  assert.match(codeEvidence.method, /Non è un AST/);
  assert.ok(!report.evidence.some((entry) => entry.itemId === shortItem.id), 'brief standard answers should not be flagged as identical extended responses');
  assert.ok(report.seatContexts.some((context) => context.attempts.some((attempt) => attempt.submissionId === submissions[0].id)),
    'seat adjacency should be reported separately as context');
  assert.ok(report.seatContexts.some((context) => context.attempts.some((attempt) => attempt.submissionId === submissions[2].id) && context.attempts.some((attempt) => attempt.submissionId === submissions[3].id)),
    'adjacent students with different answers should have a separate context record');
  assert.ok(!report.evidence.some((entry) => entry.attempts.some((attempt) => attempt.submissionId === submissions[2].id) && entry.attempts.some((attempt) => attempt.submissionId === submissions[3].id)),
    'seat proximity alone must not produce similarity evidence');

  const repeated = integrity.analyzeAssessment(assessment.id);
  assert.deepEqual(repeated.evidence.map((entry) => entry.id), report.evidence.map((entry) => entry.id), 'evidence identifiers should be stable for unchanged submissions');

  assert.throws(() => integrity.recordReview({
    assessmentId: assessment.id, evidenceId: textEvidence.id, decision: 'needs_follow_up', idempotencyKey: 'review-test-0001'
  }), AuthorizationError);
  const review = integrity.recordReview({
    assessmentId: assessment.id, evidenceId: textEvidence.id, decision: 'needs_follow_up', note: 'Verificare la traccia con il docente.',
    actor: 'teacher:c6-test', idempotencyKey: 'review-test-0001'
  });
  assert.equal(review.actor, 'teacher:c6-test');
  assert.equal(integrity.getReviewHistory(assessment.id, textEvidence.id).length, 1);
  const replay = integrity.recordReview({
    assessmentId: assessment.id, evidenceId: textEvidence.id, decision: 'needs_follow_up', note: 'Verificare la traccia con il docente.',
    actor: 'teacher:c6-test', idempotencyKey: 'review-test-0001'
  });
  assert.equal(replay.id, review.id, 'exact retries should be idempotent');
  assert.throws(() => integrity.recordReview({
    assessmentId: assessment.id, evidenceId: textEvidence.id, decision: 'reviewed_no_action', note: 'different payload',
    actor: 'teacher:c6-test', idempotencyKey: 'review-test-0001'
  }), ConflictError, 'reusing an idempotency key for a different decision must conflict');
  assert.throws(() => integrity.recordReview({
    assessmentId: assessment.id, evidenceId: textEvidence.id, decision: 'pending', note: 'x'.repeat(2001),
    actor: 'teacher:c6-test', idempotencyKey: 'review-test-0002'
  }), ValidationError);

  const refreshed = integrity.analyzeAssessment(assessment.id);
  assert.equal(refreshed.evidence.find((entry) => entry.id === textEvidence.id).review.decision, 'needs_follow_up');
  assert.equal(refreshed.evidence.find((entry) => entry.id === textEvidence.id).review.history.length, 1);
});
