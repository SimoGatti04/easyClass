import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import { createMcpServer } from '../../src/mcp/server.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

test('MCP Attachment Ingestion & File Workflow Tests', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', 'test-mcp-attach-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);

  const sampleDocText = '# Sistemi Operativi: Concorrenza e Semafori\n\nI semafori di Dijkstra regolano la mutua esclusione delle sezioni critiche.';
  const sampleDocBytes = Buffer.from(sampleDocText, 'utf8');
  const sampleSha = crypto.createHash('sha256').update(sampleDocBytes).digest('hex');

  const fileServiceOptions = {
    fetchImpl: async (url) => ({
      status: 200,
      url: url.href,
      headers: { get: () => String(sampleDocBytes.length) },
      arrayBuffer: async () => sampleDocBytes
    }),
    lookupImpl: async () => [{ address: '20.150.1.1', family: 4 }]
  };

  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true,
    fileServiceOptions
  });

  const authorizeTeacher = async () => ({ teacherAuthorized: true, actorId: 'test-teacher-mcp' });
  const server = createMcpServer(service, { authorizeTeacher });

  t.after(() => {
    service.close();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  async function listTools() {
    const handler = server._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
    return handler({ method: 'tools/list', params: {} });
  }

  async function callTool(name, args = {}) {
    const handler = server._requestHandlers.get(CallToolRequestSchema.shape.method.value);
    return handler({ method: 'tools/call', params: { name, arguments: args } });
  }

  await t.test('tools/list exposes import_attachment_file with openai/fileParams metadata', async () => {
    const res = await listTools();
    const tool = res.tools.find((t) => t.name === 'import_attachment_file');
    assert.ok(tool, 'import_attachment_file must be listed in MCP tools');
    assert.equal(tool.annotations?.openWorldHint, true);
    assert.deepEqual(tool._meta?.['openai/fileParams'], ['file']);
    assert.ok(tool.inputSchema.$defs?.OpenAIFile);
    assert.deepEqual(tool.inputSchema.$defs.OpenAIFile.required, ['download_url', 'file_id']);
  });

  await t.test('import_attachment_file creates persistent material from ChatGPT file reference', async () => {
    const classObj = service.createClass({ name: '4B Informatica', academicYear: '2026/2027' });
    const subject = service.createSubject({ name: 'Sistemi Operativi', classId: classObj.id });
    const lesson = service.createLesson({ title: 'Semafori e Concorrenza', classId: classObj.id, subjectId: subject.id });

    const importRes = await callTool('import_attachment_file', {
      file: {
        download_url: 'https://files.oaiusercontent.com/semafori.md',
        file_id: 'chatgpt-file-sem-99',
        file_name: 'semafori.md',
        mime_type: 'text/markdown'
      },
      title: 'Dispensa Concorrenza e Semafori',
      pedagogicalRole: 'student_material',
      classId: classObj.id,
      subjectId: subject.id,
      lessonId: lesson.id,
      tags: ['concorrenza', 'semafori']
    });

    assert.ok(!importRes.isError, importRes.content?.[0]?.text);
    const parsed = JSON.parse(importRes.content[0].text);
    assert.equal(parsed.status, 'imported');
    assert.equal(parsed.original_file_sha256, sampleSha);
    assert.ok(parsed.material.id);
    assert.equal(parsed.material.title, 'Dispensa Concorrenza e Semafori');

    // 1. Verify readable via get_material
    const getRes = await callTool('get_material', { id: parsed.material.id });
    const readMaterial = JSON.parse(getRes.content[0].text);
    assert.equal(readMaterial.id, parsed.material.id);
    assert.match(readMaterial.content, /Dijkstra/);
    assert.equal(readMaterial.provenance.telemetry.fileHash, sampleSha);

    // 2. Verify searchable via search_materials
    const searchRes = await callTool('search_materials', { query: 'Dijkstra' });
    const found = JSON.parse(searchRes.content[0].text);
    assert.ok(found.length >= 1);
    assert.equal(found[0].id, parsed.material.id);
  });

  await t.test('import_file blocks arbitrary server filesystem paths but accepts base64 and file reference', async () => {
    // 1. Attempt local file path traversal through MCP
    const rejectRes = await callTool('import_file', {
      filePath: '/etc/shadow'
    });
    assert.equal(rejectRes.isError, true);
    assert.match(rejectRes.content[0].text, /Remote MCP invocation cannot access server filesystem paths/);

    // 2. Base64 invocation through MCP
    const b64 = Buffer.from('Contenuto base64 di prova', 'utf8').toString('base64');
    const b64Res = await callTool('import_file', {
      fileBufferBase64: b64,
      filename: 'test-base64.txt',
      title: 'Materiale Base64'
    });
    assert.ok(!b64Res.isError);
    const b64Parsed = JSON.parse(b64Res.content[0].text);
    assert.match(b64Parsed.content, /Contenuto base64/);

    // 3. File reference invocation through import_file
    const refRes = await callTool('import_file', {
      file: {
        download_url: 'https://files.oaiusercontent.com/semafori.md',
        file_id: 'chatgpt-ref-via-import-file',
        file_name: 'via-import-file.md'
      },
      title: 'Materiale tramite import_file'
    });
    assert.ok(!refRes.isError);
    const refParsed = JSON.parse(refRes.content[0].text);
    assert.equal(refParsed.status, 'imported');
    assert.equal(refParsed.original_file_sha256, sampleSha);
  });
});
