import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { OrganizationService } from '../../src/services/organization-service.js';
import { MaterialService } from '../../src/services/material-service.js';
import { FileService } from '../../src/services/file-service.js';
import { PedagogicalRoles, ContentFormats } from '../../src/core/contracts.js';
import path from 'node:path';
import fsMod from 'node:fs';

test('Real File Import & Export Service Unit Tests', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', 'test-files-' + Date.now());
  fsMod.mkdirSync(tmpDir, { recursive: true });
  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);
  const org = new OrganizationService(dbManager);
  const materialService = new MaterialService(dbManager, fileStore, org);
  const fileService = new FileService(materialService, fileStore);

  t.after(() => {
    if (fsMod.existsSync(tmpDir)) {
      fsMod.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('import Markdown and plain text files', () => {
    const mdFilePath = path.join(tmpDir, 'lezione-algoritmi.md');
    fsMod.writeFileSync(mdFilePath, '# Algoritmi di Ordinamento\n\nBubble sort, Quick sort e Merge sort.', 'utf8');

    const res = fileService.importFile({
      filePath: mdFilePath,
      title: 'Dispensa Algoritmi',
      pedagogicalRole: PedagogicalRoles.STUDENT_MATERIAL
    });

    assert.ok(res.id);
    assert.equal(res.title, 'Dispensa Algoritmi');
    assert.equal(res.pedagogical_role, PedagogicalRoles.STUDENT_MATERIAL);
    assert.match(res.content, /Bubble sort, Quick sort/);
    assert.ok(res.original_file_sha256);
  });

  await t.test('import base64 buffer directly', () => {
    const rawText = 'Esercizi di chimica: reazioni redox e bilanciamento.';
    const b64 = Buffer.from(rawText, 'utf8').toString('base64');

    const res = fileService.importFile({
      fileBufferBase64: b64,
      filename: 'chimica-redox.txt',
      title: 'Esercizi Redox',
      pedagogicalRole: PedagogicalRoles.SUPPORT_MATERIAL
    });

    assert.ok(res.id);
    assert.equal(res.title, 'Esercizi Redox');
    assert.match(res.content, /reazioni redox/);
  });

  await t.test('import real DOCX using pandoc', () => {
    // Create a real docx file using pandoc
    const sampleMd = path.join(tmpDir, 'sample.md');
    const sampleDocx = path.join(tmpDir, 'sample.docx');
    fsMod.writeFileSync(sampleMd, '# Capitolo 1: Termodinamica\n\nIl primo principio stabilisce la conservazione dell energia.', 'utf8');
    const pandocCreate = spawnSync('pandoc', ['-f', 'markdown', '-t', 'docx', '-o', sampleDocx, sampleMd]);

    if (pandocCreate.status === 0 && fsMod.existsSync(sampleDocx)) {
      const res = fileService.importFile({
        filePath: sampleDocx,
        title: 'Documento Word Termodinamica',
        pedagogicalRole: PedagogicalRoles.STUDENT_MATERIAL
      });
      assert.ok(res.id);
      assert.match(res.content, /Termodinamica/);
      assert.match(res.content, /conservazione/);
    }
  });

  await t.test('multi-format downloadable exports', () => {
    const mat = materialService.createMaterial({
      title: 'Verifica di Informatica con Soluzioni',
      contentText: '# Domanda 1: Cos è una chiave primaria?\n\n<!-- TEACHER_ONLY_START -->\nSoluzione: Un attributo che identifica univocamente una tupla.\n<!-- TEACHER_ONLY_END -->\n\n# Domanda 2: Cos è una foreign key?',
      pedagogicalRole: PedagogicalRoles.TEACHER_MATERIAL,
      teacherSolutionText: 'Soluzione Protetta Teacher: chiave primaria univoca, foreign key referenziale.'
    });

    // 1. Markdown export with frontmatter
    const mdExp = fileService.exportMaterialFile(mat.id, ContentFormats.MARKDOWN);
    assert.equal(mdExp.mimeType, 'text/markdown; charset=utf-8');
    assert.match(mdExp.data, /---/);
    assert.match(mdExp.data, /title: "Verifica di Informatica con Soluzioni"/);
    assert.match(mdExp.data, /Soluzione Protetta Teacher/);

    // 2. Markdown export for student (stripping solutions)
    const studentExp = fileService.exportMaterialFile(mat.id, ContentFormats.MARKDOWN, { includeTeacherSolutions: false });
    assert.doesNotMatch(studentExp.data, /Soluzione Protetta Teacher/);
    assert.doesNotMatch(studentExp.data, /TEACHER_ONLY_START/);

    // 3. JSON export
    const jsonExp = fileService.exportMaterialFile(mat.id, 'json');
    assert.equal(jsonExp.mimeType, 'application/json');
    const parsedJson = JSON.parse(jsonExp.data);
    assert.equal(parsedJson.resource.id, mat.id);
    assert.ok(Array.isArray(parsedJson.versions));

    // 4. HTML export
    const htmlExp = fileService.exportMaterialFile(mat.id, 'html');
    assert.equal(htmlExp.mimeType, 'text/html; charset=utf-8');
    assert.match(htmlExp.data, /<html lang="it">/);
    assert.match(htmlExp.data, /Verifica di Informatica con Soluzioni/);

    // 5. DOCX export using pandoc
    const docxExp = fileService.exportMaterialFile(mat.id, 'docx');
    assert.equal(docxExp.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal(docxExp.isBinary, true);
    assert.ok(Buffer.isBuffer(docxExp.data));
    assert.ok(docxExp.data.length > 100);
  });
});