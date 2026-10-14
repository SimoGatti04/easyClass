import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { OrganizationService } from '../../src/services/organization-service.js';
import { MaterialService } from '../../src/services/material-service.js';
import { PedagogicalRoles, ResourceTypes, ContentFormats } from '../../src/core/contracts.js';
import fs from 'node:fs';
import path from 'node:path';

test('MaterialService & OrganizationService Unit Tests', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', 'test-storage-' + Date.now());
  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);
  const orgService = new OrganizationService(dbManager);
  const matService = new MaterialService(dbManager, fileStore, orgService);

  t.after(() => {
    dbManager.close();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('create class, subject, lesson, and collection', () => {
    const cls = orgService.createClass({
      name: '4A Informatica',
      academicYear: '2026/2027',
      section: 'A',
      description: 'Corso Tecnico Informatico'
    });
    assert.ok(cls.id);
    assert.equal(cls.name, '4A Informatica');

    const subj = orgService.createSubject({
      classId: cls.id,
      name: 'Basi di Dati',
      code: 'BD4'
    });
    assert.ok(subj.id);
    assert.equal(subj.class_id, cls.id);

    const les = orgService.createLesson({
      classId: cls.id,
      subjectId: subj.id,
      title: 'Lezione 1: Normalizzazione Relazionale',
      orderIndex: 1
    });
    assert.ok(les.id);
    assert.equal(les.title, 'Lezione 1: Normalizzazione Relazionale');

    const col = orgService.createCollection({
      name: 'Dispense Database',
      classId: cls.id
    });
    assert.ok(col.id);

    return { cls, subj, les, col };
  });

  await t.test('create and version materials with pedagogical roles', () => {
    const cls = orgService.listClasses()[0];
    const subj = orgService.listSubjects(cls.id)[0];
    const les = orgService.listLessons({ classId: cls.id })[0];

    // 1. Teacher Material (e.g. Lesson Plan)
    const mat = matService.createMaterial({
      title: 'Piano di Lezione: Normalizzazione',
      contentText: 'Obiettivi: comprendere 1NF, 2NF e 3NF.\nAttività: spiegazione ed esempi pratici.',
      pedagogicalRole: PedagogicalRoles.TEACHER_MATERIAL,
      resourceType: ResourceTypes.LESSON_PLAN,
      classId: cls.id,
      subjectId: subj.id,
      lessonId: les.id,
      tags: ['sql', 'database', '1nf']
    });

    assert.ok(mat.id);
    assert.equal(mat.current_version, 1);
    assert.equal(mat.pedagogical_role, PedagogicalRoles.TEACHER_MATERIAL);
    assert.match(mat.content, /Obiettivi: comprendere 1NF/);

    // 2. Update material (creates version 2)
    const matV2 = matService.updateMaterial(mat.id, {
      contentText: 'Obiettivi: comprendere 1NF, 2NF, 3NF e BCNF.\nAttività: spiegazione ed esercizi guidati.',
      changeSummary: 'Aggiunta BCNF ed esercizi'
    });

    assert.equal(matV2.current_version, 2);
    assert.match(matV2.content, /BCNF/);

    // 3. Inspect version history
    const history = matService.getMaterialVersionHistory(mat.id);
    assert.equal(history.length, 2);
    assert.equal(history[0].version_number, 2);
    assert.equal(history[1].version_number, 1);

    // 4. Retrieve older version
    const oldVersion = matService.getMaterial(mat.id, 1);
    assert.equal(oldVersion.selected_version, 1);
    assert.doesNotMatch(oldVersion.content, /BCNF/);
  });

  await t.test('FTS5 full text search', () => {
    const results = matService.searchMaterials('BCNF');
    assert.ok(results.length >= 1);
    assert.equal(results[0].title, 'Piano di Lezione: Normalizzazione');

    const emptyResults = matService.searchMaterials('QuantumPhysics');
    assert.equal(emptyResults.length, 0);
  });

  await t.test('Duplicate, Move, Archive, Restore, Trash, Delete', () => {
    const list = matService.listMaterials();
    const original = list[0];

    // Duplicate
    const copy = matService.duplicateMaterial(original.id, { newTitle: 'Copia del Piano' });
    assert.ok(copy.id);
    assert.equal(copy.title, 'Copia del Piano');
    assert.equal(copy.current_version, 1);

    // Archive & restore
    const archived = matService.archiveMaterial(copy.id);
    assert.equal(archived.status, 'archived');
    const restored = matService.restoreMaterial(copy.id);
    assert.equal(restored.status, 'active');

    // Soft delete (trash)
    const trashed = matService.deleteMaterial(copy.id, { permanent: false });
    assert.equal(trashed.status, 'trashed');
    const activeList = matService.listMaterials({ status: 'active' });
    assert.ok(!activeList.some(m => m.id === copy.id));

    // Permanent delete
    const deleted = matService.deleteMaterial(copy.id, { permanent: true });
    assert.equal(deleted.status, 'deleted_permanently');
  });

  await t.test('Assessable material authorization', () => {
    const cls = orgService.listClasses()[0];
    const les = orgService.listLessons({ classId: cls.id })[0];

    const studentMat = matService.createMaterial({
      title: 'Dispensa per Studenti: Forme Normali',
      contentText: 'Testo canonico distribuito alla classe.',
      pedagogicalRole: PedagogicalRoles.STUDENT_MATERIAL,
      classId: cls.id,
      lessonId: les.id
    });

    assert.equal(studentMat.pedagogical_role, PedagogicalRoles.STUDENT_MATERIAL);

    assert.equal(matService.isVersionAssessable(studentMat.id, 1), false, 'draft Student Material is not assessable');
    assert.throws(() => matService.authorizeAssessable(studentMat.id, {
      lessonId: les.id, versionNumber: 1
    }), /Only Support Material/);

    const publication = matService.publishMaterial(studentMat.id, {
      versionNumber: 1,
      notes: 'Versione effettivamente consegnata alla classe'
    });
    assert.equal(publication.isAvailable, true);
    assert.equal(matService.isVersionAssessable(studentMat.id, 1), true);
    assert.equal(matService.getMaterial(studentMat.id).pedagogical_role, PedagogicalRoles.STUDENT_MATERIAL);

    const v2 = matService.updateMaterial(studentMat.id, { contentText: 'Nuova versione non ancora distribuita.' });
    assert.equal(v2.current_version, 2);
    assert.equal(matService.isVersionAssessable(studentMat.id, 1), true, 'published historical version remains pinned/eligible');
    assert.equal(matService.isVersionAssessable(studentMat.id, 2), false, 'publication does not transfer to a new version');

    const mislabeledScript = matService.createMaterial({
      title: 'Script privato classificato male',
      contentText: 'Note riservate del docente.',
      pedagogicalRole: PedagogicalRoles.SUPPORT_MATERIAL,
      resourceType: ResourceTypes.TEACHER_SCRIPT,
      lessonId: les.id
    });
    assert.throws(() => matService.publishMaterial(mislabeledScript.id, { versionNumber: 1 }), /Only student-facing/);
    assert.throws(() => matService.authorizeAssessable(mislabeledScript.id, { versionNumber: 1 }), /Only Support Material/);
    assert.equal(matService.isVersionAssessable(mislabeledScript.id, 1), false);

    const supportMat = matService.createMaterial({
      title: 'Esercizi di supporto',
      contentText: 'Esercizi assegnati come supporto.',
      pedagogicalRole: PedagogicalRoles.SUPPORT_MATERIAL,
      lessonId: les.id
    });
    const supportAuth = matService.authorizeAssessable(supportMat.id, {
      lessonId: les.id,
      versionNumber: 1,
      notes: 'Esercizi disponibili agli studenti'
    });
    assert.ok(supportAuth.authorizationId);
    assert.equal(supportAuth.sourceRole, PedagogicalRoles.SUPPORT_MATERIAL);
    assert.equal(matService.getMaterial(supportMat.id).pedagogical_role, PedagogicalRoles.SUPPORT_MATERIAL);
    assert.equal(matService.isVersionAssessable(supportMat.id, 1, { lessonId: les.id }), false, 'authorization alone does not make Support Material available');
    matService.publishMaterial(supportMat.id, { versionNumber: 1 });
    assert.equal(matService.isVersionAssessable(supportMat.id, 1, { lessonId: les.id }), true);
    assert.equal(matService.isVersionAssessable(supportMat.id, 1, { lessonId: 'another-lesson' }), false);

    matService.unpublishMaterial(studentMat.id, { versionNumber: 1 });
    assert.equal(matService.isVersionAssessable(studentMat.id, 1), false, 'withdrawn material is not currently assessable');
  });

  await t.test('Export material in multiple formats', () => {
    const list = matService.listMaterials();
    const mat = list[0];

    const expMd = matService.exportMaterial(mat.id, { format: 'markdown' });
    assert.equal(expMd.mimeType, 'text/markdown');
    assert.match(expMd.data, /---/);

    const expJson = matService.exportMaterial(mat.id, { format: 'json' });
    assert.equal(expJson.mimeType, 'application/json');
    const parsed = JSON.parse(expJson.data);
    assert.equal(parsed.id, mat.id);
  });
});
