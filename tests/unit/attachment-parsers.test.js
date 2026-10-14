import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { OrganizationService } from '../../src/services/organization-service.js';
import { MaterialService } from '../../src/services/material-service.js';
import { FileService } from '../../src/services/file-service.js';
import { PedagogicalRoles, ContentFormats, ProvenanceKinds } from '../../src/core/contracts.js';
import { ValidationError } from '../../src/core/errors.js';

// Minimal valid PDF binary
const MINIMAL_PDF_BYTES = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 58 >>
stream
BT
/F1 24 Tf
100 700 Td
(Architettura del calcolatore e bus di sistema) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000353 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
430
%%EOF
`);

test('Attachment Parsers & Material Ingestion Unit Tests', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', 'test-parsers-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(path.join(tmpDir, 'filestore'));
  const org = new OrganizationService(dbManager);
  const materialService = new MaterialService(dbManager, fileStore, org);
  const fileService = new FileService(materialService, fileStore);

  const testClass = org.createClass({ name: '3A Informatica', academicYear: '2026/2027' });
  const testSubject = org.createSubject({ name: 'Sistemi e Reti', classId: testClass.id });
  const testLesson = org.createLesson({ title: 'Architettura CPU', classId: testClass.id, subjectId: testSubject.id });

  t.after(() => {
    dbManager.close();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('PDF parser extracts readable text and persists binary with SHA-256', async () => {
    const rawSha256 = crypto.createHash('sha256').update(MINIMAL_PDF_BYTES).digest('hex');

    const fakeFetch = async () => ({
      status: 200,
      headers: { get: () => String(MINIMAL_PDF_BYTES.length) },
      arrayBuffer: async () => MINIMAL_PDF_BYTES
    });

    const pdfService = new FileService(materialService, fileStore, {
      fetchImpl: fakeFetch,
      lookupImpl: async () => [{ address: '20.150.1.1', family: 4 }]
    });

    const result = await pdfService.importAttachmentFromChatGPTFile({
      download_url: 'https://files.oaiusercontent.com/dispensa-cpu.pdf',
      file_id: 'chatgpt-file-pdf-001',
      file_name: 'dispensa-cpu.pdf',
      mime_type: 'application/pdf'
    }, {
      title: 'Dispensa Bus e CPU',
      pedagogicalRole: PedagogicalRoles.STUDENT_MATERIAL,
      classId: testClass.id,
      subjectId: testSubject.id,
      lessonId: testLesson.id,
      tags: ['hardware', 'sistemi']
    });

    assert.equal(result.status, 'imported');
    assert.equal(result.original_file_sha256, rawSha256);
    assert.equal(result.originalFile.name, 'dispensa-cpu.pdf');
    assert.ok(result.material.id);
    assert.equal(result.material.pedagogical_role, PedagogicalRoles.STUDENT_MATERIAL);

    // Verify extracted text
    assert.match(result.material.content, /Architettura del calcolatore/);

    // Verify raw file stored in FileStore
    assert.ok(fs.existsSync(result.originalFile.storedPath));
    const storedBytes = fs.readFileSync(result.originalFile.storedPath);
    assert.equal(crypto.createHash('sha256').update(storedBytes).digest('hex'), rawSha256);

    // Verify provenance & telemetry
    assert.equal(result.material.provenance.type, ProvenanceKinds.IMPORTED);
    assert.equal(result.material.provenance.telemetry.extractor, 'pdftotext');
    assert.equal(result.material.provenance.telemetry.fileHash, rawSha256);
    assert.equal(result.material.provenance.telemetry.fileId, 'chatgpt-file-pdf-001');

    // OriginUri must NOT be considered proof of ingestion (it is metadata only)
    assert.equal(result.material.origin_type, 'chatgpt_attachment');
    assert.equal(result.material.origin_uri, 'chatgpt-file-pdf-001');
  });

  await t.test('DOCX parser extracts Markdown text via pandoc and preserves original binary', async () => {
    // Generate real docx file using pandoc
    const mdSource = path.join(tmpDir, 'source.md');
    const docxTarget = path.join(tmpDir, 'dispensa.docx');
    fs.writeFileSync(mdSource, '# Memoria Centrale\n\nLa RAM è una memoria volatile ad accesso casuale.', 'utf8');

    const pandocRes = spawnSync('pandoc', ['-f', 'markdown', '-t', 'docx', '-o', docxTarget, mdSource]);
    assert.equal(pandocRes.status, 0, 'pandoc must successfully create docx');

    const docxBytes = fs.readFileSync(docxTarget);
    const docxSha256 = crypto.createHash('sha256').update(docxBytes).digest('hex');

    const fakeFetch = async () => ({
      status: 200,
      headers: { get: () => String(docxBytes.length) },
      arrayBuffer: async () => docxBytes
    });

    const docxService = new FileService(materialService, fileStore, {
      fetchImpl: fakeFetch,
      lookupImpl: async () => [{ address: '20.150.1.1', family: 4 }]
    });

    const result = await docxService.importAttachmentFromChatGPTFile({
      download_url: 'https://oaisdmntprnortheu.blob.core.windows.net/uploads/dispensa.docx',
      file_id: 'chatgpt-file-docx-002',
      file_name: 'dispensa.docx',
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }, {
      title: 'Dispensa Memoria RAM',
      pedagogicalRole: PedagogicalRoles.SUPPORT_MATERIAL
    });

    assert.equal(result.status, 'imported');
    assert.equal(result.original_file_sha256, docxSha256);
    assert.match(result.material.content, /Memoria Centrale/);
    assert.match(result.material.content, /RAM/);
    assert.equal(result.material.provenance.telemetry.extractor, 'pandoc-docx');
    assert.equal(result.material.provenance.telemetry.fileHash, docxSha256);
  });

  await t.test('Markdown and plain text attachments are ingested cleanly', async () => {
    const mdText = '# Protocollo TCP/IP\n\nIl modello TCP/IP si compone di 4 livelli gerarchici.';
    const mdBytes = Buffer.from(mdText, 'utf8');

    const fakeFetch = async () => ({
      status: 200,
      headers: { get: () => String(mdBytes.length) },
      arrayBuffer: async () => mdBytes
    });

    const mdService = new FileService(materialService, fileStore, {
      fetchImpl: fakeFetch,
      lookupImpl: async () => [{ address: '20.150.1.1', family: 4 }]
    });

    const result = await mdService.importAttachmentFromChatGPTFile({
      download_url: 'https://files.oaiusercontent.com/tcpip.md',
      file_id: 'chatgpt-file-md-003',
      file_name: 'tcpip.md',
      mime_type: 'text/markdown'
    }, {
      title: 'Dispensa TCP/IP'
    });

    assert.equal(result.status, 'imported');
    assert.match(result.material.content, /Protocollo TCP\/IP/);
    assert.equal(result.material.format, ContentFormats.MARKDOWN);
    assert.equal(result.material.provenance.telemetry.extractor, 'utf8-markdown');
  });

  await t.test('Empty files or files without readable text are strictly rejected', async () => {
    const emptyBytes = Buffer.alloc(0);

    const fakeFetch = async () => ({
      status: 200,
      headers: { get: () => '0' },
      arrayBuffer: async () => emptyBytes
    });

    const emptyService = new FileService(materialService, fileStore, {
      fetchImpl: fakeFetch,
      lookupImpl: async () => [{ address: '20.150.1.1', family: 4 }]
    });

    await assert.rejects(
      () => emptyService.importAttachmentFromChatGPTFile({
        download_url: 'https://files.oaiusercontent.com/empty.txt',
        file_id: 'chatgpt-empty-004',
        file_name: 'empty.txt'
      }),
      /Downloaded file is empty \(0 bytes\)/
    );
  });

  await t.test('Remote MCP invocation strictly denies arbitrary filesystem paths', () => {
    assert.throws(
      () => fileService.importFile({
        filePath: '/etc/passwd',
        isRemote: true
      }),
      (err) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /Remote MCP invocation cannot access server filesystem paths/);
        return true;
      }
    );
  });
});
