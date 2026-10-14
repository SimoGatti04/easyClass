#!/usr/bin/env node
/**
 * Explicit live smoke check. Sends only synthetic teaching content and a public
 * documentation page to the configured OmniRoute gateway. It writes an
 * isolated database and sanitized diagnostics to validation/live-integrations.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { OmniRouteClient } from '../src/ai/omniroute-client.js';
import { WebResearchClient } from '../src/ai/web-research-client.js';
import { DatabaseManager } from '../src/db/database.js';
import { FileStore } from '../src/storage/filestore.js';
import { createMcpServer } from '../src/mcp/server.js';
import { TeacherService } from '../src/services/teacher-service.js';

const REQUIRED_ENDPOINT = 'http://198.51.100.62:32128/v1';
const PUBLIC_DOC_URL = 'https://docs.python.org/3/library/urllib.parse.html';
const argv = new Set(process.argv.slice(2));

if (!argv.has('--confirm-live')) {
  console.error('Refusing live calls. Re-run with --confirm-live after reviewing the configured endpoint and synthetic-data scope.');
  process.exit(2);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the synthetic live check with NODE_ENV=production.');
  process.exit(2);
}
if (process.env.TEACHER_SERVICE_MOCK_AI === 'true') {
  console.error('Refusing the live check while explicit mock AI mode is enabled.');
  process.exit(2);
}

const omniRoute = new OmniRouteClient();
const configuredEndpoint = omniRoute.baseUrl.replace(/\/+$/, '');
if (configuredEndpoint !== REQUIRED_ENDPOINT) {
  console.error(`Refusing to send credentials: configured OmniRoute endpoint is not the approved exact endpoint (${REQUIRED_ENDPOINT}).`);
  process.exit(2);
}
if (!omniRoute.apiKey) {
  console.error('OmniRoute API key is not loaded. Configure it through the private local environment file or process environment.');
  process.exit(2);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runId = `teacher-service-live-${timestamp}-${crypto.randomBytes(4).toString('hex')}`;
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'validation', 'live-integrations', runId);
process.umask(0o077);
fs.mkdirSync(outDir, { recursive: false, mode: 0o700 });

const report = {
  runId,
  startedAt: new Date().toISOString(),
  endpoint: REQUIRED_ENDPOINT,
  modelConfigured: omniRoute.defaultModel,
  syntheticDataOnly: true,
  publicPageUrl: PUBLIC_DOC_URL,
  stages: {
    publicPageRetrieval: { status: 'NOT_RUN' },
    webSearch: { status: 'NOT_CONFIGURED' },
    directOmniRouteCompletion: { status: 'NOT_RUN' },
    integratedMcpContextualGeneration: { status: 'NOT_RUN' }
  }
};
const secret = omniRoute.apiKey;
const safeError = (error) => String(error?.message || error || 'Unknown failure')
  .replaceAll(secret, '[REDACTED]')
  .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
const safeErrorCode = (error) => error?.code || safeError(error).match(/\"code\"\s*:\s*\"([^\"]+)\"/)?.[1] || null;
const capturePartialState = () => {
  if (!service) return null;
  return {
    materials: service.listMaterials({ status: 'active' }).map((material) => ({ id: material.id, title: material.title, role: material.pedagogical_role, version: material.current_version })),
    rules: service.listAiRules({ status: 'active' }).map((rule) => ({ id: rule.id, scope: rule.scope, version: rule.version })),
    sources: service.listSources().map((source) => ({ id: source.id, type: source.source_type, url: source.url, state: source.state, contentVersion: source.content_version, contentHash: source.content_hash })),
    sourceEventCounts: service.listSources().map((source) => ({ sourceId: source.id, states: service.getSourceHistory(source.id).map((event) => event.state) }))
  };
};
const saveReport = () => fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'w', mode: 0o600 });
const saveText = (filename, text) => fs.writeFileSync(path.join(outDir, filename), `${String(text).trim()}\n`, { flag: 'wx', mode: 0o600 });

let failures = 0;

// Each external integration is checked independently; failures do not suppress
// the remaining stages or their diagnostics.
try {
  const page = await new WebResearchClient().fetchPage(PUBLIC_DOC_URL);
  report.stages.publicPageRetrieval = {
    status: 'PASS', title: page.title, url: page.url, contentBytes: Buffer.byteLength(page.content),
    contentHash: page.contentHash, tlsVerification: 'enforced by Node HTTPS client'
  };
  saveText('public-page-extract.txt', page.content);
} catch (error) {
  failures++;
  report.stages.publicPageRetrieval = { status: 'FAIL', code: safeErrorCode(error), error: safeError(error) };
}
saveReport();

const searchClient = new WebResearchClient();
if (searchClient.searchUrl) {
  try {
    const results = await searchClient.search('Python URL parsing official documentation', { limit: 3 });
    report.stages.webSearch = { status: results.length ? 'PASS' : 'FAIL', resultCount: results.length, results };
    if (!results.length) failures++;
    saveText('web-search-results.json', JSON.stringify(results, null, 2));
  } catch (error) {
    failures++;
    report.stages.webSearch = { status: 'FAIL', code: safeErrorCode(error), error: safeError(error) };
  }
} else {
  report.stages.webSearch = { status: 'NOT_CONFIGURED', dependency: 'TEACHER_SERVICE_WEB_SEARCH_URL (SearXNG-compatible /search?format=json endpoint)' };
}
saveReport();

try {
  const completion = await omniRoute.complete({
    messages: [
      { role: 'system', content: 'Answer accurately and concisely. This is a synthetic integration check.' },
      { role: 'user', content: 'For a synthetic lesson on web addressing, explain in two short sentences the difference between a URL path and query. Do not invent citations.' }
    ],
    temperature: 0.2
  });
  report.stages.directOmniRouteCompletion = {
    status: completion.content.trim() ? 'PASS' : 'FAIL',
    model: completion.model, generationMode: completion.telemetry?.isMock ? 'mock' : 'real',
    telemetry: completion.telemetry, outputFile: 'omniroute-completion.md'
  };
  if (completion.telemetry?.isMock || !completion.content.trim()) failures++;
  saveText('omniroute-completion.md', completion.content);
} catch (error) {
  failures++;
  report.stages.directOmniRouteCompletion = { status: 'FAIL', code: safeErrorCode(error), error: safeError(error) };
}
saveReport();

let service;
try {
  const dbPath = path.join(outDir, 'teacher-service.sqlite');
  const fileStorePath = path.join(outDir, 'files');
  const dbManager = new DatabaseManager(dbPath).init();
  const fileStore = new FileStore(fileStorePath);
  service = new TeacherService({ dbManager, fileStore, omniRouteClient: omniRoute, webResearchClient: new WebResearchClient() });
  const mcp = createMcpServer(service, {
    authorizeTeacher: async () => ({ teacherAuthorized: true, actorId: 'synthetic-live-check-teacher' })
  });
  const listTools = mcp._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
  const callTool = mcp._requestHandlers.get(CallToolRequestSchema.shape.method.value);
  const availableTools = (await listTools({ method: 'tools/list', params: {} })).tools.map((tool) => tool.name);
  for (const name of ['set_ai_rule', 'resolve_effective_ai_rules', 'search_sources', 'consult_source', 'generate_lesson_plan', 'get_material', 'revise_material']) {
    if (!availableTools.includes(name)) throw new Error(`MCP discovery omitted required tool: ${name}`);
  }
  const call = async (name, args = {}) => {
    const response = await callTool({ method: 'tools/call', params: { name, arguments: args } });
    if (response.isError) throw new Error(`${name}: ${response.content?.[0]?.text || 'MCP tool failed'}`);
    const text = response.content?.[0]?.text;
    if (!text) throw new Error(`${name} returned no text content`);
    return JSON.parse(text);
  };

  const classroom = await call('create_class', { name: '4A Reti — live integration fixture', academicYear: '2026/2027' });
  const subject = await call('create_subject', { classId: classroom.id, name: 'Reti e servizi — synthetic' });
  const priorOne = await call('create_lesson', { classId: classroom.id, subjectId: subject.id, title: 'Reti locali — synthetic', orderIndex: 1 });
  const priorTwo = await call('create_lesson', { classId: classroom.id, subjectId: subject.id, title: 'DNS — synthetic', orderIndex: 2 });
  const currentLesson = await call('create_lesson', { classId: classroom.id, subjectId: subject.id, title: 'Componenti di un URL — synthetic', orderIndex: 3 });
  await call('create_material', {
    title: 'Appunti rete locale — synthetic',
    contentText: 'Una rete locale collega dispositivi vicini; il router inoltra pacchetti fra reti diverse.',
    pedagogicalRole: 'student_material', classId: classroom.id, subjectId: subject.id, lessonId: priorOne.id
  });
  await call('create_material', {
    title: 'Appunti DNS — synthetic',
    contentText: 'Il DNS permette di risolvere nomi di dominio in record associati agli indirizzi utilizzati dai client.',
    pedagogicalRole: 'student_material', classId: classroom.id, subjectId: subject.id, lessonId: priorTwo.id
  });

  const courseId = `curriculum-course-${subject.id}`;
  await call('set_ai_rule', {
    scope: 'global', title: 'Live check — grounding',
    instructionText: 'For source-specific facts, use only retrieved sources and cite them with the supplied [Sx] marker.'
  });
  await call('set_ai_rule', {
    scope: 'class_subject', targetId: classroom.id, secondaryTargetId: courseId,
    title: 'Live check — class level',
    instructionText: 'Use accessible language for a secondary-school lesson and build on the two previous lesson notes.'
  });
  const effectiveRules = await call('resolve_effective_ai_rules', {
    classId: classroom.id, subjectId: subject.id, courseId, lessonId: currentLesson.id, capability: 'lesson_plan'
  });

  const generated = await call('generate_lesson_plan', {
    lessonId: currentLesson.id, classId: classroom.id, subjectId: subject.id, courseId,
    topic: 'Componenti di un URL', sourceQuery: 'URL path query scheme authority DNS',
    includePreviousLessons: true, previousLessonLimit: 2,
    searchInternal: false, searchWeb: false,
    requiredSources: [{ url: PUBLIC_DOC_URL, title: 'Python urllib.parse documentation' }]
  });
  if (generated.generationMode !== 'real' || generated.isMock === true) throw new Error('Integrated generation did not report real AI mode');
  const persisted = await call('get_material', { id: generated.material.id, versionNumber: 1 });
  const external = persisted.sourceSet.sources.find((source) => source.sourceType === 'external_web');
  const previous = persisted.sourceSet.sources.filter((source) => source.priorLessonId === priorOne.id || source.priorLessonId === priorTwo.id);
  if (!external || !external.contentHash || external.contentVersionNumber !== 1) throw new Error('Persisted Source Set does not contain the retrieved exact external page version');
  if (previous.length !== 2) throw new Error(`Expected two previous-lesson sources in persisted Source Set; found ${previous.length}`);
  const externalHistory = await call('get_source_history', { id: external.sourceId });

  report.stages.integratedMcpContextualGeneration = {
    status: 'PASS', generationMode: generated.generationMode, model: generated.model,
    materialId: persisted.id, materialVersion: persisted.current_version, role: persisted.pedagogical_role,
    resolvedRuleScopes: effectiveRules.appliedRules.map((rule) => ({ id: rule.id, scope: rule.scope, version: rule.version })),
    previousLessons: previous.map((source) => ({ lessonId: source.priorLessonId, resourceId: source.resourceId, version: source.versionNumber, state: source.state })),
    externalSource: {
      sourceId: external.sourceId, url: external.url, contentVersionNumber: external.contentVersionNumber,
      contentHash: external.contentHash, authorityLevel: external.authorityLevel, state: external.state,
      citationObserved: external.citationObserved, history: externalHistory.map((entry) => entry.state)
    },
    sourceSetId: persisted.sourceSet.id, sourceSetVersion: persisted.sourceSet.version_number,
    artifactFile: 'contextual-mcp-lesson-plan.md', sourceSetFile: 'contextual-mcp-source-set.json',
    databaseFile: 'teacher-service.sqlite'
  };
  saveText('contextual-mcp-lesson-plan.md', persisted.content);
  saveText('contextual-mcp-source-set.json', JSON.stringify(persisted.sourceSet, null, 2));
  saveText('contextual-mcp-rules.json', JSON.stringify({ rules: effectiveRules, generationResolvedRules: generated.resolvedRules }, null, 2));
} catch (error) {
  failures++;
  report.stages.integratedMcpContextualGeneration = { status: 'FAIL', code: safeErrorCode(error), error: safeError(error), partialState: capturePartialState() };
} finally {
  try { service?.close(); } catch {}
}

report.completedAt = new Date().toISOString();
report.overallStatus = failures === 0 ? 'PASS_WITH_WEB_SEARCH_NOT_CONFIGURED' : 'PARTIAL_OR_FAILED';
saveReport();
console.log(JSON.stringify({ runId, outputDirectory: outDir, overallStatus: report.overallStatus, stages: report.stages }, null, 2));
if (failures > 0) process.exitCode = 1;
