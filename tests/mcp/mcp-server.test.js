import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpServer } from '../../src/mcp/server.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';

test('MCP Server Protocol & Tool Integration Tests', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', 'test-mcp-' + Date.now());
  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);
  const webResearchClient = {
    async search(query) { return [{ title: 'Synthetic MCP reference', url: 'https://example.org/cpu-spec', snippet: query, provider: 'test-search' }]; },
    async fetchPage(url) { return { title: 'Synthetic MCP reference', url, content: 'Retrieved page content about CPU architecture and Hamming codes.', contentHash: 'sha256-mcp-reference', accessedAt: '2026-10-13T10:00:00.000Z', contentType: 'text/html' }; }
  };
  const service = new TeacherService({ dbManager, fileStore, mockAi: true, webResearchClient });
  const authorizeTeacher = async () => ({ teacherAuthorized: true, actorId: 'mcp-test-teacher' });
  const server = createMcpServer(service, { authorizeTeacher });

  t.after(() => {
    service.close();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // Helper to call tools directly via registered request handler
  async function callTool(name, args = {}) {
    // Invoke handler
    const handler = server._requestHandlers.get(CallToolRequestSchema.shape.method.value);
    const res = await handler({
      method: 'tools/call',
      params: { name, arguments: args }
    });
    return res;
  }

  async function listTools() {
    const handler = server._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
    const res = await handler({ method: 'tools/list', params: {} });
    return res.tools;
  }

  async function listResources() {
    const handler = server._requestHandlers.get(ListResourcesRequestSchema.shape.method.value);
    return await handler({ method: 'resources/list', params: {} });
  }

  async function readResource(uri) {
    const handler = server._requestHandlers.get(ReadResourceRequestSchema.shape.method.value);
    return await handler({ method: 'resources/read', params: { uri } });
  }

  await t.test('list_tools exposes complete MVP tool surface', async () => {
    const tools = await listTools();
    assert.ok(tools.length >= 20, `Expected >= 20 tools, found ${tools.length}`);

    const toolNames = tools.map(t => t.name);
    assert.ok(toolNames.includes('create_class'));
    assert.ok(toolNames.includes('create_subject'));
    assert.ok(toolNames.includes('create_lesson'));
    assert.ok(toolNames.includes('create_material'));
    assert.ok(toolNames.includes('import_material'));
    assert.ok(toolNames.includes('search_materials'));
    assert.ok(toolNames.includes('update_material'));
    assert.ok(toolNames.includes('authorize_assessable'));
    assert.ok(toolNames.includes('publish_material'));
    assert.ok(toolNames.includes('unpublish_material'));
    assert.ok(toolNames.includes('export_material'));
    assert.ok(toolNames.includes('generate_lesson_plan'));
    assert.ok(toolNames.includes('generate_teacher_script'));
    assert.ok(toolNames.includes('generate_student_material'));
    assert.ok(toolNames.includes('generate_assessment_draft'));
  });

  let createdClass = null;
  let createdSubject = null;
  let createdLesson = null;
  let createdMaterial = null;

  await t.test('execute organization tools through MCP', async () => {
    // 1. Create Class
    const classRes = await callTool('create_class', {
      name: '3B Informatica',
      academicYear: '2026/2027',
      section: 'B'
    });
    assert.equal(classRes.isError, undefined);
    createdClass = JSON.parse(classRes.content[0].text);
    assert.ok(createdClass.id);
    assert.equal(createdClass.name, '3B Informatica');

    // 2. List Classes
    const listClassRes = await callTool('list_classes', {});
    const classes = JSON.parse(listClassRes.content[0].text);
    assert.ok(classes.some(c => c.id === createdClass.id));

    // 3. Create Subject
    const subjRes = await callTool('create_subject', {
      classId: createdClass.id,
      name: 'Telecomunicazioni',
      code: 'TLC3'
    });
    createdSubject = JSON.parse(subjRes.content[0].text);
    assert.equal(createdSubject.class_id, createdClass.id);

    // 4. Create Lesson
    const lesRes = await callTool('create_lesson', {
      classId: createdClass.id,
      subjectId: createdSubject.id,
      title: 'Codifica di Canale e Codici di Hamming',
      date: '2026-10-20'
    });
    createdLesson = JSON.parse(lesRes.content[0].text);
    assert.equal(createdLesson.title, 'Codifica di Canale e Codici di Hamming');
  });

  await t.test('execute materials CRUD and search through MCP', async () => {
    // 1. Create Material
    const matRes = await callTool('create_material', {
      title: 'Teoria dei Codici di Hamming',
      contentText: 'I codici di Hamming aggiungono bit di parità ridondanti per rilevare e correggere errori singoli.',
      pedagogicalRole: 'student_material',
      classId: createdClass.id,
      subjectId: createdSubject.id,
      lessonId: createdLesson.id,
      tags: ['hamming', 'error-correction']
    });
    assert.equal(matRes.isError, undefined);
    createdMaterial = JSON.parse(matRes.content[0].text);
    assert.ok(createdMaterial.id);
    assert.equal(createdMaterial.current_version, 1);

    // 2. Search Materials (FTS5)
    const searchRes = await callTool('search_materials', {
      query: 'ridondanti'
    });
    const searchResults = JSON.parse(searchRes.content[0].text);
    assert.ok(searchResults.length >= 1);
    assert.equal(searchResults[0].id, createdMaterial.id);

    // 3. Update Material (bumping to v2)
    const updateRes = await callTool('update_material', {
      id: createdMaterial.id,
      contentText: 'I codici di Hamming (7,4) codificano 4 bit di dati in 7 bit trasmessi, con distanza minima 3.',
      changeSummary: 'Aggiunto dettaglio sui parametri (7,4)'
    });
    const updated = JSON.parse(updateRes.content[0].text);
    assert.equal(updated.current_version, 2);

    // 4. Version History
    const versionsRes = await callTool('get_material_versions', { id: createdMaterial.id });
    const versions = JSON.parse(versionsRes.content[0].text);
    assert.equal(versions.length, 2);

    // Student Material is made assessable by publication, not role mutation.
    const publicationRes = await callTool('publish_material', {
      resourceId: createdMaterial.id,
      versionNumber: 2,
      notes: 'Consegna effettiva agli studenti'
    });
    const publication = JSON.parse(publicationRes.content[0].text);
    assert.equal(publication.isAvailable, true);
    assert.equal(service.getMaterial(createdMaterial.id).pedagogical_role, 'student_material');

    // Explicit authorization is reserved for Support Material and remains version-bound.
    const support = service.createMaterial({ title: 'Support source MCP', contentText: 'Support content', pedagogicalRole: 'support_material', lessonId: createdLesson.id });
    const authRes = await callTool('authorize_assessable', {
      resourceId: support.id,
      versionNumber: 1,
      lessonId: createdLesson.id,
      notes: 'Autorizzazione per questa lezione'
    });
    const auth = JSON.parse(authRes.content[0].text);
    assert.equal(auth.sourceRole, 'support_material');
    assert.equal(service.getMaterial(support.id).pedagogical_role, 'support_material');

    // 6. Export Material
    const expRes = await callTool('export_material', {
      id: createdMaterial.id,
      format: 'markdown'
    });
    const exp = JSON.parse(expRes.content[0].text);
    assert.equal(exp.mimeType, 'text/markdown');
    assert.match(exp.data, /distanza minima 3/);
  });

  await t.test('execute AI generation workflows through MCP', async () => {
    // 1. Generate Lesson Plan
    const lpRes = await callTool('generate_lesson_plan', {
      topic: 'Architettura dei Calcolatori e CPU Von Neumann',
      classId: createdClass.id,
      subjectId: createdSubject.id
    });
    assert.equal(lpRes.isError, undefined);
    const lp = JSON.parse(lpRes.content[0].text);
    assert.ok(lp.material.id);
    assert.equal(lp.material.pedagogical_role, 'teacher_material');

    // 2. Generate Teacher Script
    const tsRes = await callTool('generate_teacher_script', {
      topic: 'CPU Von Neumann',
      lessonPlanId: lp.material.id
    });
    const ts = JSON.parse(tsRes.content[0].text);
    assert.ok(ts.material.id);
    assert.match(ts.material.content, /Copione Docente/);

    // 3. Generate Student Material
    const smRes = await callTool('generate_student_material', {
      topic: 'CPU Von Neumann',
      teacherScriptId: ts.material.id
    });
    const sm = JSON.parse(smRes.content[0].text);
    assert.equal(sm.material.pedagogical_role, 'student_material');

    // 4. Publish the exact student-facing version before assessment generation.
    const pubRes = await callTool('publish_material', { resourceId: sm.material.id, versionNumber: 1 });
    assert.equal(JSON.parse(pubRes.content[0].text).isAvailable, true);

    // 5. Generate Assessment Draft against a pinned version.
    const asRes = await callTool('generate_assessment_draft', {
      topic: 'CPU Von Neumann',
      assessableMaterialIds: [{ id: sm.material.id, versionNumber: 1 }]
    });
    const asObj = JSON.parse(asRes.content[0].text);
    assert.match(asObj.material.content, /TEACHER_ONLY_SOLUTION/);

    // 5. List AI Models
    const modelsRes = await callTool('list_ai_models', {});
    const models = JSON.parse(modelsRes.content[0].text);
    assert.ok(Array.isArray(models));
    assert.ok(models.length > 0);
  });


  await t.test("execute AI operational rules through MCP", async () => {
    // 1. set_ai_rule
    const setRes = await callTool("set_ai_rule", {
      scope: "global",
      title: "Linee Guida Accessibilità MCP",
      instructionText: "Fornisci sempre spiegazioni con glossario terminologico."
    });
    assert.equal(setRes.isError, undefined);
    const rule = JSON.parse(setRes.content[0].text);
    assert.ok(rule.id);
    assert.equal(rule.scope, "global");

    // 2. get_ai_rule
    const getRes = await callTool("get_ai_rule", { id: rule.id });
    const fetched = JSON.parse(getRes.content[0].text);
    assert.equal(fetched.id, rule.id);

    // 3. list_ai_rules
    const listRes = await callTool("list_ai_rules", { scope: "global" });
    const list = JSON.parse(listRes.content[0].text);
    assert.ok(list.length >= 1);

    // 4. resolve_effective_ai_rules
    const resolveRes = await callTool("resolve_effective_ai_rules", {
      capability: "lesson_plan",
      oneOffInstruction: "Includi schema ASCII"
    });
    const resolved = JSON.parse(resolveRes.content[0].text);
    assert.ok(resolved.appliedRules.length >= 1);
    assert.match(resolved.effectiveInstructions, /Linee Guida Accessibilità MCP/);
  });

  await t.test("execute sources workflow through MCP", async () => {
    // 1. register_source (FOUND)
    const regRes = await callTool("register_source", {
      sourceType: "external_web",
      title: "Documentazione Ufficiale CPU Architecture",
      url: "https://example.org/cpu-spec",
      authorityLevel: "official"
    });
    const src = JSON.parse(regRes.content[0].text);
    assert.equal(src.state, "found");

    // 2. consult_source (CONSULTED)
    const conRes = await callTool("consult_source", {
      id: src.id,
      content: "This caller-supplied content must be ignored.",
      relevanceScore: 0.9
    });
    const consulted = JSON.parse(conRes.content[0].text);
    assert.equal(consulted.state, "consulted");

    // 3. search_sources
    const searchRes = await callTool("search_sources", { query: "Hamming" });
    const searchItems = JSON.parse(searchRes.content[0].text);
    assert.ok(searchItems.length >= 1);
  });

  await t.test("execute file import & export through MCP", async () => {
    const rawContent = "# Dispensa File Import MCP\n\nContenuto didattico di test.";
    const b64 = Buffer.from(rawContent, "utf8").toString("base64");

    const impRes = await callTool("import_file", {
      fileBufferBase64: b64,
      filename: "dispensa-mcp.md",
      title: "Materiale Importato MCP",
      pedagogicalRole: "student_material"
    });
    const imported = JSON.parse(impRes.content[0].text);
    assert.ok(imported.id);
    assert.match(imported.content, /Contenuto didattico di test/);

    // Export via export_material_file
    const expRes = await callTool("export_material_file", {
      id: imported.id,
      format: "markdown"
    });
    const exported = JSON.parse(expRes.content[0].text);
    assert.equal(exported.mimeType, "text/markdown; charset=utf-8");
    assert.match(exported.content, /Contenuto didattico di test/);
  });

  await t.test("execute assessment & grading workflow through MCP", async () => {
    const assessmentSource = service.createMaterial({
      title: "Materiale studente MCP CPU",
      contentText: "La ALU esegue operazioni aritmetiche; il Program Counter indica la prossima istruzione.",
      pedagogicalRole: "student_material",
      classId: createdClass.id,
      subjectId: createdSubject.id,
      lessonId: createdLesson.id
    });
    service.publishMaterial(assessmentSource.id, { versionNumber: 1 });

    // 1. create_assessment
    const asmRes = await callTool("create_assessment", {
      title: "Verifica MCP Architettura CPU",
      durationMinutes: 30,
      maxScore: 10,
      items: [
        {
          type: "multiple_choice",
          questionText: "Quale componente esegue le operazioni aritmetiche?",
          maxScore: 5,
          options: [
            { id: "A", text: "ALU", isCorrect: true },
            { id: "B", text: "RAM", isCorrect: false }
          ],
          isSelfCorrecting: true,
          assessableSourceId: assessmentSource.id,
          assessableSourceVersion: 1
        },
        {
          type: "open_short",
          questionText: "A cosa serve il Program Counter?",
          maxScore: 5,
          teacherSolution: "Contiene l indirizzo della prossima istruzione da eseguire.",
          assessableSourceId: assessmentSource.id,
          assessableSourceVersion: 1
        }
      ]
    });
    const asm = JSON.parse(asmRes.content[0].text);
    assert.ok(asm.id);
    assert.equal(asm.items.length, 2);

    // 2. import_submission
    const subRes = await callTool("import_submission", {
      assessmentId: asm.id,
      studentId: "studente-mcp-1",
      studentName: "Luca Verdi",
      responses: [
        { itemId: asm.items[0].id, responseText: "A" },
        { itemId: asm.items[1].id, responseText: "Punta alla prossima istruzione." }
      ]
    });
    const sub = JSON.parse(subRes.content[0].text);
    assert.ok(sub.id);

    // 3. grade_submission
    const gradeRes = await callTool("grade_submission", {
      submissionId: sub.id,
      evaluator: "AI-Tutor"
    });
    const graded = JSON.parse(gradeRes.content[0].text);
    assert.equal(graded.submissionId, sub.id);
    assert.ok(graded.totalScore >= 5);

    // 4. review_grading
    const revRes = await callTool("review_grading", {
      submissionId: sub.id,
      reviewer: "Prof. Rossi",
      finalGrade: "9/10"
    });
    const reviewed = JSON.parse(revRes.content[0].text);
    assert.equal(reviewed.status, "reviewed");
    assert.equal(reviewed.final_grade, "9/10");

    // 5. export_assessment_results
    const expRes = await callTool("export_assessment_results", {
      assessmentId: asm.id,
      format: "csv"
    });
    const csvContent = JSON.parse(expRes.content[0].text);
    assert.match(csvContent, /Luca Verdi/);
    assert.match(csvContent, /9\/10/);
  });

  await t.test('MCP resources protocol inspection and read', async () => {
    const resList = await listResources();
    assert.ok(resList.resources.length > 0);

    const firstRes = resList.resources[0];
    const read = await readResource(firstRes.uri);
    assert.ok(read.contents.length > 0);
    assert.ok(read.contents[0].text.length > 0);
  });

  await t.test('MCP error reporting is compliant and robust', async () => {
    const errRes = await callTool('get_material', { id: 'non-existent-id' });
    assert.equal(errRes.isError, true);
    const errPayload = JSON.parse(errRes.content[0].text);
    assert.equal(errPayload.code, 'NOT_FOUND');
  });
});
