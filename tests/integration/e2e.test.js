import test from 'node:test';
import assert from 'node:assert/strict';
import { TeacherService } from '../../src/services/teacher-service.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { PedagogicalRoles, ResourceTypes } from '../../src/core/contracts.js';
import fs from 'node:fs';
import path from 'node:path';

test('End-to-End Pedagogical Workflow Integration Test', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', 'test-e2e-' + Date.now());
  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);
  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true
  });

  t.after(() => {
    service.close();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // 1. Setup Organization
  const cls = service.createClass({
    name: '3A Liceo Scientifico',
    academicYear: '2026/2027',
    section: 'A',
    description: 'Corso Scientifico Tradizionale'
  });
  assert.ok(cls.id);

  const subject = service.createSubject({
    classId: cls.id,
    name: 'Fisica',
    code: 'FIS-3'
  });
  assert.ok(subject.id);

  const lesson = service.createLesson({
    classId: cls.id,
    subjectId: subject.id,
    title: 'Termodinamica: Primo Principio ed Entalpia',
    date: '2026-10-25',
    orderIndex: 4
  });
  assert.ok(lesson.id);

  const collection = service.createCollection({
    name: 'Modulo Termodinamica',
    classId: cls.id,
    subjectId: subject.id
  });
  assert.ok(collection.id);

  // 2. Import External Reference Source
  const importedSource = service.importMaterial({
    title: 'Estratto Manuale: Lavoro ed Energia Interna',
    contentText: 'Il primo principio della termodinamica stabilisce che Delta U = Q - W per sistemi chiusi.',
    originUri: 'attachment://manuale_fisica_cap7.pdf',
    originType: 'textbook_pdf',
    pedagogicalRole: PedagogicalRoles.SUPPORT_MATERIAL,
    classId: cls.id,
    subjectId: subject.id,
    lessonId: lesson.id,
    tags: ['termodinamica', 'teoria', 'energia']
  });
  assert.ok(importedSource.id);

  // 3. AI: Generate Lesson Plan
  const lpResult = await service.generateLessonPlan({
    lessonId: lesson.id,
    durationMinutes: 60,
    objectives: ['Definire il primo principio', 'Calcolare lavoro ed energia interna', 'Analizzare trasformazioni adiabatiche']
  });
  const lessonPlan = lpResult.material;
  assert.equal(lessonPlan.pedagogical_role, PedagogicalRoles.TEACHER_MATERIAL);
  assert.equal(lessonPlan.current_version, 1);

  // 4. AI: Generate Detailed Teacher Script
  const tsResult = await service.generateTeacherScript({
    lessonId: lesson.id,
    lessonPlanId: lessonPlan.id,
    sourceMaterialIds: [importedSource.id],
    durationMinutes: 60
  });
  const teacherScript = tsResult.material;
  assert.equal(teacherScript.pedagogical_role, PedagogicalRoles.TEACHER_MATERIAL);

  // 5. AI: Generate Canonical Student Material
  const smResult = await service.generateStudentMaterial({
    lessonId: lesson.id,
    teacherScriptId: teacherScript.id,
    sourceMaterialIds: [importedSource.id],
    targetLevel: 'Terzo Anno Liceo Scientifico'
  });
  const studentMaterial = smResult.material;
  assert.equal(studentMaterial.pedagogical_role, PedagogicalRoles.STUDENT_MATERIAL);

  // 6. AI: Generate Exercises
  const exResult = await service.generateExercises({
    topic: 'Primo Principio della Termodinamica',
    materialId: studentMaterial.id,
    count: 3,
    withSolutions: true
  });
  const exercises = exResult.material;
  assert.equal(exercises.pedagogical_role, PedagogicalRoles.SUPPORT_MATERIAL);

  // 7. Publish the exact Student Material version actually available to students.
  const publication = service.publishMaterial(studentMaterial.id, {
    versionNumber: 1,
    notes: 'Versione effettivamente consegnata agli studenti'
  });
  assert.equal(publication.isAvailable, true);
  assert.equal(service.isVersionAssessable(studentMaterial.id, 1), true);

  // 8. Generate a teacher-only draft with exact source-version provenance.
  const asResult = await service.generateAssessmentDraft({
    topic: 'Verifica di Termodinamica',
    assessableMaterialIds: [{ id: studentMaterial.id, versionNumber: 1 }],
    durationMinutes: 50,
    maxScore: 100
  });
  const assessmentDraft = asResult.material;
  assert.match(assessmentDraft.content, /TEACHER_ONLY_SOLUTION/);

  // 9. Teacher edits Student Material (Revision incrementing to v2)
  const revisedSm = service.updateMaterial(studentMaterial.id, {
    contentText: studentMaterial.content + '\n\n## Approfondimento sul Lavoro Quasistatico\nNelle trasformazioni reversibili W = int P dV.',
    changeSummary: 'Aggiunto approfondimento su trasformazioni reversibili'
  });
  assert.equal(revisedSm.current_version, 2);

  // 10. Link all deliverables to curriculum collection
  service.addResourceToCollection(collection.id, lessonPlan.id);
  service.addResourceToCollection(collection.id, teacherScript.id);
  service.addResourceToCollection(collection.id, studentMaterial.id);
  service.addResourceToCollection(collection.id, exercises.id);
  service.addResourceToCollection(collection.id, assessmentDraft.id);

  const colItems = service.listCollectionResources(collection.id);
  assert.equal(colItems.length, 5);

  // 11. Full-Text Search across repository
  const searchResults = service.searchMaterials('Termodinamica');
  assert.ok(searchResults.length >= 4);

  // 12. Multi-Format Exports
  const mdExport = service.exportMaterial(studentMaterial.id, { format: 'markdown' });
  assert.match(mdExport.data, /Approfondimento sul Lavoro Quasistatico/);

  const jsonExport = service.exportMaterial(assessmentDraft.id, { format: 'json' });
  const parsedJson = JSON.parse(jsonExport.data);
  assert.equal(parsedJson.id, assessmentDraft.id);

  // 13. Audit and Provenance Verification
  const versions = service.getMaterialVersionHistory(studentMaterial.id);
  assert.equal(versions.length, 2);
  assert.ok(versions[0].content_hash);
  assert.ok(versions[1].content_hash);
  assert.notEqual(versions[0].content_hash, versions[1].content_hash);
});
