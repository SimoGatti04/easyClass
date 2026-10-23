import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { OrganizationService } from '../../src/services/organization-service.js';
import { MaterialService } from '../../src/services/material-service.js';
import { AssessmentService } from '../../src/services/assessment-service.js';
import { OmniRouteClient } from '../../src/ai/omniroute-client.js';
import { ItemTypes, PedagogicalRoles, ResourceTypes, SubmissionStatuses, EvaluationTypes } from '../../src/core/contracts.js';
import { ValidationError, AuthorizationError } from '../../src/core/errors.js';
import path from 'node:path';
import fsMod from 'node:fs';

test('Assessment Blueprint, Protected Solutions & Grading (Dossiers 05 & 06) Unit Tests', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', 'test-assess-' + Date.now());
  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);
  const org = new OrganizationService(dbManager);
  const materialService = new MaterialService(dbManager, fileStore, org);
  const aiClient = new OmniRouteClient({ mockOffline: true });
  const assessmentService = new AssessmentService(dbManager, materialService, aiClient);

  const testClass = org.createClass({ name: '3A Liceo Scientifico', academicYear: '2026/2027' });
  const testSubject = org.createSubject({ name: 'Fisica', classId: testClass.id });
  const testLesson = org.createLesson({ title: 'Principi della Dinamica', classId: testClass.id, subjectId: testSubject.id, orderIndex: 1 });

  const studentMaterial = materialService.createMaterial({
    title: 'Dispensa Dinamica Newtoniana',
    contentText: 'Tre leggi della dinamica: principio d inerzia, F=ma, azione e reazione.',
    pedagogicalRole: PedagogicalRoles.STUDENT_MATERIAL,
    resourceType: ResourceTypes.STUDENT_NOTE,
    lessonId: testLesson.id
  });

  const teacherScript = materialService.createMaterial({
    title: 'Teacher Script - Dinamica',
    contentText: '[TEACHER ONLY] Domande trappola per verificare misconcezioni su inerzia.',
    pedagogicalRole: PedagogicalRoles.TEACHER_MATERIAL,
    resourceType: ResourceTypes.TEACHER_SCRIPT,
    lessonId: testLesson.id
  });

  t.after(() => {
    if (fsMod.existsSync(tmpDir)) {
      fsMod.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  let assessment = null;
  let itemMcq = null;
  let itemOpen = null;

  await t.test('create assessment blueprint and enforce exact published grounding', () => {
    // Draft Student Material is not assessable until its exact version is published.

    // 2. Reject binding to teacher script (Dossier 04 §46 / Dossier 05 §56)
    assert.throws(() => {
      assessmentService.createAssessment({
        title: 'Test Dinamica Errato',
        items: [{
          type: ItemTypes.OPEN_QUESTION,
          questionText: 'Descrivi le misconcezioni sull inerzia',
          maxScore: 10,
          assessableSourceId: teacherScript.id,
          assessableSourceVersion: 1
        }]
      });
    }, ValidationError);

    // Unpublished Student Material and ungrounded items are blocking errors.
    assert.throws(() => assessmentService.createAssessment({
      title: 'Verifica senza grounding',
      items: [{ type: ItemTypes.OPEN_QUESTION, questionText: 'Domanda non grounded' }]
    }), /assessableSourceId grounding/);
    assert.throws(() => assessmentService.createAssessment({
      title: 'Verifica su bozza non pubblicata',
      items: [{ type: ItemTypes.OPEN_QUESTION, questionText: 'Domanda', assessableSourceId: studentMaterial.id, assessableSourceVersion: 1 }]
    }), /not currently published/);

    materialService.publishMaterial(studentMaterial.id, { versionNumber: 1 });
    assert.equal(materialService.getMaterial(studentMaterial.id).pedagogical_role, PedagogicalRoles.STUDENT_MATERIAL);

    // 3. Create valid assessment
    assessment = assessmentService.createAssessment({
      title: 'Verifica Dinamica Newtoniana',
      description: 'Verifica scritta sommativa',
      classId: testClass.id,
      subjectId: testSubject.id,
      lessonId: testLesson.id,
      durationMinutes: 45,
      maxScore: 30,
      items: [
        {
          type: ItemTypes.MULTIPLE_CHOICE,
          questionText: 'Qual è l unità di misura della forza nel S.I.?',
          maxScore: 5,
          options: [
            { id: 'A', text: 'Joule', isCorrect: false },
            { id: 'B', text: 'Newton', isCorrect: true },
            { id: 'C', text: 'Pascal', isCorrect: false },
            { id: 'D', text: 'Watt', isCorrect: false }
          ],
          isSelfCorrecting: true,
          assessableSourceId: studentMaterial.id,
          assessableSourceVersion: 1
        },
        {
          type: ItemTypes.OPEN_QUESTION,
          questionText: 'Enuncia il secondo principio della dinamica e spiega il significato fisico della massa inerziale.',
          maxScore: 25,
          rubric: {
            enunciazione: { max: 10, criteria: 'Correttezza formale F=ma' },
            massa_inerziale: { max: 15, criteria: 'Spiegazione del concetto di inerzia e resistenza all accelerazione' }
          },
          teacherSolution: 'Il secondo principio afferma che la forza risultante agente su un corpo è pari al prodotto tra massa e accelerazione (F=m*a). La massa inerziale misura la resistenza del corpo a variare il proprio stato di moto.',
          assessableSourceId: studentMaterial.id,
          assessableSourceVersion: 1
        }
      ]
    });

    assert.ok(assessment.id);
    assert.equal(assessment.items.length, 2);
    itemMcq = assessment.items[0];
    itemOpen = assessment.items[1];
  });

  await t.test('protect teacher solutions from student role inspection', () => {
    // Teacher sees solutions
    const teacherView = assessmentService.getAssessment(assessment.id, { role: 'teacher', includeTeacherSolutions: true });
    assert.ok(teacherView.items[1].teacher_solution);

    // Student view strips teacher solutions
    const studentView = assessmentService.getAssessment(assessment.id, { role: 'student', includeTeacherSolutions: false });
    assert.equal(studentView.items[1].teacher_solution, null);
    // Also strips isCorrect markers from MCQ options for students
    const studentOpts = studentView.items[0].options;
    assert.ok(studentOpts.every(o => o.isCorrect === undefined));
  });

  let submission = null;

  await t.test('import student submission and execute deterministic + AI grading', async () => {
    submission = assessmentService.importSubmission({
      assessmentId: assessment.id,
      studentId: 'student-mario-rossi',
      studentName: 'Mario Rossi',
      responses: [
        { itemId: itemMcq.id, responseText: 'B' }, // Correct answer
        {
          itemId: itemOpen.id,
          responseText: 'La seconda legge dice che F = m * a. La massa inerziale rappresenta la quantita di materia che si oppone ad accelerare quando applichiamo una forza.'
        }
      ]
    });
    assert.ok(submission.id);
    assert.equal(submission.status, SubmissionStatuses.SUBMITTED);

    // Grade submission
    const gradeRes = await assessmentService.gradeSubmission({
      submissionId: submission.id,
      evaluator: 'AI-Assisted-Tutor',
      model: 'test-model'
    });

    assert.equal(gradeRes.submissionId, submission.id);
    assert.equal(gradeRes.evaluationRound, 1);
    assert.ok(gradeRes.totalScore >= 5);
    assert.equal(gradeRes.itemResults[0].score, 5); // Deterministic MCQ passed
    assert.equal(gradeRes.itemResults[0].evalType, EvaluationTypes.DETERMINISTIC);

    const updatedSub = assessmentService.getSubmission(submission.id);
    assert.equal(updatedSub.status, SubmissionStatuses.GRADED);
    assert.ok(updatedSub.proposed_grade);
  });

  await t.test('AI grading failures do not persist partial rounds or heuristic grades', async () => {
    const failingSubmission = assessmentService.importSubmission({
      assessmentId: assessment.id,
      studentId: 'student-ai-failure',
      responses: [
        { itemId: itemMcq.id, responseText: 'B' },
        { itemId: itemOpen.id, responseText: 'Risposta di prova' }
      ]
    });
    const originalComplete = aiClient.complete.bind(aiClient);
    aiClient.complete = async () => { throw new Error('synthetic AI outage'); };
    await assert.rejects(() => assessmentService.gradeSubmission({ submissionId: failingSubmission.id }), /synthetic AI outage/);
    aiClient.complete = originalComplete;
    assert.equal(dbManager.prepare('SELECT COUNT(*) AS n FROM evaluations WHERE submission_id = ?').get(failingSubmission.id).n, 0);
    assert.equal(assessmentService.getSubmission(failingSubmission.id).status, SubmissionStatuses.SUBMITTED);
  });

  await t.test('teacher review, manual override and non-destructive regrading', async () => {
    const reviewed = assessmentService.reviewGrading({
      submissionId: submission.id,
      reviewer: 'Prof.ssa Bianchi',
      finalGrade: '8.5/10',
      teacherNotes: 'Ottima comprensione del principio di inerzia',
      itemOverrides: [
        {
          itemId: itemOpen.id,
          score: 22,
          feedback: 'Risposta completa ed esauriente, ottima precisione terminologica.'
        }
      ]
    });

    assert.equal(reviewed.status, SubmissionStatuses.REVIEWED);
    assert.equal(reviewed.final_grade, '8.5/10');
    assert.equal(reviewed.total_score, 27); // 5 (MCQ) + 22 (Override)

    // Verify non-destructive history: previous evaluation round is preserved
    const allEvals = dbManager.prepare('SELECT * FROM evaluations WHERE submission_id = ? ORDER BY evaluation_round ASC').all(submission.id);
    assert.ok(allEvals.length >= 3);
    const round1 = allEvals.filter(e => e.evaluation_round === 1);
    const roundReview = allEvals.filter(e => e.evaluation_round > 1);
    assert.ok(round1.length >= 2, 'Round 1 evaluations preserved intact');
    assert.ok(roundReview.length >= 1, 'Review override recorded in a progressive evaluation round');
    assert.equal(roundReview[0].evaluator, 'Prof.ssa Bianchi');

    const savedReview = assessmentService.reviewGrading({
      submissionId: submission.id,
      reviewer: 'Prof.ssa Bianchi',
      finalize: false,
      itemOverrides: [{ itemId: itemOpen.id, score: 20, feedback: 'Seconda revisione' }]
    });
    assert.equal(savedReview.status, SubmissionStatuses.REVIEWED, 'an unfinished correction pass does not revoke the confirmed grade');
    assert.equal(savedReview.final_grade, '8.5/10');
    assert.equal(savedReview.total_score, 27, 'the confirmed total remains current until explicit re-finalization');
    assert.equal(savedReview.teacher_notes, 'Ottima comprensione del principio di inerzia', 'question-level edits preserve prior teacher-only notes');

    await assessmentService.gradeSubmission({ submissionId: submission.id, evaluator: 'AI-Assisted-Tutor', model: 'test-model' });
    const afterRegrade = assessmentService.getSubmission(submission.id);
    assert.equal(afterRegrade.status, SubmissionStatuses.REVIEWED);
    assert.equal(afterRegrade.final_grade, '8.5/10', 'automatic regrading must not overwrite a teacher-confirmed grade');
    assert.equal(afterRegrade.total_score, 27);
  });

  await t.test('export assessment results in CSV, JSON and Markdown', () => {
    // CSV
    const csv = assessmentService.exportAssessmentResults(assessment.id, 'csv');
    assert.match(csv, /student-mario-rossi/);
    assert.match(csv, /Mario Rossi/);
    assert.match(csv, /8\.5\/10/);

    // JSON
    const json = assessmentService.exportAssessmentResults(assessment.id, 'json');
    assert.equal(json.assessmentId, assessment.id);
    assert.equal(json.submissions.length, 2, 'also includes the intentionally ungraded AI-failure submission');
    assert.equal(json.submissions[0].final_grade, '8.5/10');

    // Markdown Report
    const report = assessmentService.exportAssessmentResults(assessment.id, 'markdown');
    assert.match(report, /# Report Risultati Verifica/);
    assert.match(report, /Mario Rossi/);
  });
});