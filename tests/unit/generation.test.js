import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { OrganizationService } from '../../src/services/organization-service.js';
import { MaterialService } from '../../src/services/material-service.js';
import { OmniRouteClient } from '../../src/ai/omniroute-client.js';
import { GenerationService } from '../../src/services/generation-service.js';
import { AiRuleService } from '../../src/services/ai-rule-service.js';
import { SourceService } from '../../src/services/source-service.js';
import { PedagogicalRoles, ResourceTypes } from '../../src/core/contracts.js';
import fs from 'node:fs';
import path from 'node:path';

test('GenerationService & AI Workflows Unit Tests', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', 'test-gen-' + Date.now());
  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);
  const orgService = new OrganizationService(dbManager);
  const matService = new MaterialService(dbManager, fileStore, orgService);
  const aiClient = new OmniRouteClient({ mockOffline: true });
  const aiRules = new AiRuleService(dbManager, orgService);
  const webResearchClient = {
    async search(query) { return [{ title: 'Synthetic reference', url: 'https://example.org/reference', snippet: query }]; },
    async fetchPage(url) { return { title: 'Synthetic reference', url, content: 'Synthetic retrieved reference content.', contentHash: 'sha256-synthetic-reference', accessedAt: '2026-10-13T10:00:00.000Z', contentType: 'text/html' }; }
  };
  const sourceService = new SourceService(dbManager, matService, orgService, webResearchClient);
  const genService = new GenerationService(aiClient, matService, orgService, aiRules, null, sourceService);
  const promptCaptures = [];
  const complete = aiClient.complete.bind(aiClient);
  aiClient.complete = async (options) => { promptCaptures.push(options.messages); return complete(options); }

  t.after(() => {
    dbManager.close();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const cls = orgService.createClass({ name: '5A Informatica', academicYear: '2026/2027' });
  const subj = orgService.createSubject({ classId: cls.id, name: 'Sistemi e Reti' });
  const les = orgService.createLesson({ classId: cls.id, subjectId: subj.id, title: 'Architettura TCP/IP' });

  let lessonPlan = null;
  let teacherScript = null;

  await t.test('generate Lesson Plan', async () => {
    const res = await genService.generateLessonPlan({
      lessonId: les.id,
      durationMinutes: 60,
      objectives: ['Comprendere i 4 livelli dello stack TCP/IP', 'Analizzare handshake a tre vie']
    });

    assert.ok(res.material.id);
    assert.equal(res.material.pedagogical_role, PedagogicalRoles.TEACHER_MATERIAL);
    assert.equal(res.material.resource_type, ResourceTypes.LESSON_PLAN);
    assert.match(res.material.content, /Piano di Lezione/);
    assert.ok(res.telemetry.durationMs >= 0);
    lessonPlan = res.material;
  });

  await t.test('generate detailed Teacher Script', async () => {
    const res = await genService.generateTeacherScript({
      lessonId: les.id,
      lessonPlanId: lessonPlan.id,
      durationMinutes: 60
    });

    assert.ok(res.material.id);
    assert.equal(res.material.pedagogical_role, PedagogicalRoles.TEACHER_MATERIAL);
    assert.equal(res.material.resource_type, ResourceTypes.TEACHER_SCRIPT);
    assert.match(res.material.content, /Copione Docente/);
    assert.equal(res.sourceSet[0].state, 'consulted', 'Source presence in prompt alone is not usage evidence');
    assert.equal(res.sourceSet[0].citationObserved, false);
    teacherScript = res.material;
  });

  await t.test('generate canonical Student Material', async () => {
    const res = await genService.generateStudentMaterial({
      lessonId: les.id,
      teacherScriptId: teacherScript.id
    });

    assert.ok(res.material.id);
    assert.equal(res.material.pedagogical_role, PedagogicalRoles.STUDENT_MATERIAL);
    assert.equal(res.material.resource_type, ResourceTypes.STUDENT_NOTE);
    assert.match(res.material.content, /Guida allo Studio/);
  });

  await t.test('student generation strips teacher-only solutions in the application layer', async () => {
    const privateScript = matService.createMaterial({
      title: 'Copione privato con soluzione',
      contentText: 'Spiegazione per il docente.\n\n[TEACHER_ONLY_SOLUTION]RISPOSTA SEGRETA XYZ[/TEACHER_ONLY_SOLUTION]',
      pedagogicalRole: PedagogicalRoles.TEACHER_MATERIAL,
      resourceType: ResourceTypes.TEACHER_SCRIPT,
      lessonId: les.id
    });
    const result = await genService.generateStudentMaterial({
      lessonId: les.id, teacherScriptId: privateScript.id,
      includePreviousLessons: false, searchInternal: false
    });
    assert.equal(result.material.pedagogical_role, PedagogicalRoles.STUDENT_MATERIAL);
    const submittedPrompt = JSON.stringify(promptCaptures.at(-1));
    assert.match(submittedPrompt, /Spiegazione per il docente/);
    assert.doesNotMatch(submittedPrompt, /RISPOSTA SEGRETA XYZ/);
    await assert.rejects(() => genService.generateAssessmentDraft({
      topic: 'Verifica non ammessa', assessableMaterialIds: [{ id: privateScript.id, versionNumber: 1 }]
    }), /teacher-only/);
  });

  await t.test('generate Exercises', async () => {
    const res = await genService.generateExercises({
      topic: 'Handshake TCP a tre vie',
      count: 4,
      withSolutions: true
    });

    assert.ok(res.material.id);
    assert.equal(res.material.pedagogical_role, PedagogicalRoles.SUPPORT_MATERIAL);
    assert.equal(res.material.resource_type, ResourceTypes.EXERCISE_SHEET);
  });

  await t.test('generate Assessment draft only from an exact published student version', async () => {
    const assessable = matService.createMaterial({
      title: 'Dispensa pubblicata TCP/IP',
      contentText: 'Concetti didattici effettivamente disponibili agli studenti.',
      pedagogicalRole: PedagogicalRoles.STUDENT_MATERIAL,
      lessonId: les.id
    });
    await assert.rejects(() => genService.generateAssessmentDraft({
      topic: 'Verifica TCP/IP e Routing',
      assessableMaterialIds: [{ id: assessable.id, versionNumber: 1 }]
    }), /not currently published/);
    await assert.rejects(() => genService.generateAssessmentDraft({
      topic: 'Verifica TCP/IP e Routing',
      assessableMaterialIds: [{ id: teacherScript.id, versionNumber: 1 }]
    }), /teacher-only/);
    await assert.rejects(() => genService.generateAssessmentDraft({
      topic: 'Verifica TCP/IP e Routing',
      assessableMaterialIds: [{ id: assessable.id }]
    }), /exact versionNumber/);

    matService.publishMaterial(assessable.id, { versionNumber: 1 });
    const res = await genService.generateAssessmentDraft({
      topic: 'Verifica TCP/IP e Routing',
      assessableMaterialIds: [{ id: assessable.id, versionNumber: 1 }],
      durationMinutes: 50,
      maxScore: 100
    });

    assert.ok(res.material.id);
    assert.equal(res.material.pedagogical_role, PedagogicalRoles.TEACHER_MATERIAL);
    assert.equal(res.material.resource_type, ResourceTypes.ASSESSMENT);
    assert.match(res.material.content, /TEACHER_ONLY_SOLUTION/);
    assert.equal(res.sourcesUsed[0].versionNumber, 1);
    assert.ok(res.sourcesUsed[0].publicationEventId);

    const unpublishedV2 = matService.updateMaterial(assessable.id, { contentText: 'Nuova versione non consegnata.' });
    assert.equal(unpublishedV2.current_version, 2);
    await assert.rejects(() => genService.generateAssessmentDraft({
      topic: 'Verifica non ancora distribuibile',
      assessableMaterialIds: [{ id: assessable.id, versionNumber: 2 }]
    }), /not currently published/);

    const supportMaterial = matService.createMaterial({
      title: 'Esercizi integrativi assessabili',
      contentText: 'Esercizi disponibili in classe.',
      pedagogicalRole: PedagogicalRoles.SUPPORT_MATERIAL,
      lessonId: les.id
    });
    const supportAuthorization = matService.authorizeAssessable(supportMaterial.id, {
      versionNumber: 1,
      lessonId: les.id,
      notes: 'Incluso nell Assessable Source Set della lezione'
    });
    await assert.rejects(() => genService.generateAssessmentDraft({
      topic: 'Verifica support non pubblicato',
      lessonId: les.id,
      assessableMaterialIds: [{ id: supportMaterial.id, versionNumber: 1 }]
    }), /not currently published/);
    matService.publishMaterial(supportMaterial.id, { versionNumber: 1 });
    const supportDraft = await genService.generateAssessmentDraft({
      topic: 'Verifica support pubblicato',
      lessonId: les.id,
      assessableMaterialIds: [{ id: supportMaterial.id, versionNumber: 1 }]
    });
    assert.equal(supportDraft.sourcesUsed[0].authorizationId, supportAuthorization.authorizationId);
    assert.equal(supportDraft.sourcesUsed[0].versionNumber, 1);

    await assert.rejects(() => genService.generateAssessmentDraft({
      topic: 'Verifica senza fonti', assessableMaterialIds: []
    }), /exact, published/);
  });

  await t.test('revise material iteratively', async () => {
    const res = await genService.reviseMaterial({
      materialId: lessonPlan.id,
      instruction: 'Aggiungi enfasi su sicurezza TLS e crittografia'
    });

    assert.equal(res.material.current_version, 2);
    const history = matService.getMaterialVersionHistory(lessonPlan.id);
    assert.equal(history.length, 2);
    assert.equal(history.find((row) => row.version_number === 2).provenance_type, 'ai_revised');
  });

  await t.test('regenerate selected section', async () => {
    const res = await genService.regenerateSection({
      materialId: lessonPlan.id,
      sectionTitle: '2. Struttura Temporale (60 minuti)',
      instructions: 'Ricalibra le tempistiche per dedicare 25 minuti al laboratorio'
    });

    assert.equal(res.material.current_version, 3);
  });
});
