import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import { createMcpServer } from '../../src/mcp/server.js';

const countFor = (db, table, column, value) => db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`).get(value).count;

test('permanent material deletion is exposed through application facade and MCP and cleans related state/files', async (t) => {
  const root = path.resolve(process.cwd(), '.tmp', `permanent-delete-${Date.now()}`);
  const fileStore = new FileStore(root);
  const dbManager = new DatabaseManager(':memory:').init();
  const service = new TeacherService({ dbManager, fileStore, mockAi: true });
  const server = createMcpServer(service, {
    authorizeTeacher: async () => ({ teacherAuthorized: true, actorId: 'synthetic-delete-teacher' })
  });
  const callTool = server._requestHandlers.get(CallToolRequestSchema.shape.method.value);
  t.after(() => {
    service.close();
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  });

  const material = service.createMaterial({
    title: 'Synthetic deletion target',
    contentText: 'Synthetic version one content',
    pedagogicalRole: 'student_material',
    provenance: { type: 'imported', telemetry: { storedPath: path.join(root, 'raw', 'shared-attachment.txt') } }
  });
  const versionOnePath = material.version_details.file_path;
  const updated = service.updateMaterial(material.id, { contentText: 'Synthetic version two content' });
  const versionTwoPath = updated.version_details.file_path;
  service.publishMaterial(material.id, { versionNumber: 2, notes: 'synthetic test publication' });

  const collection = service.createCollection({ name: 'Synthetic deletion collection' });
  service.addResourceToCollection(collection.id, material.id);
  const internalSource = service.registerSource({
    sourceType: 'internal_material', resourceId: material.id, versionNumber: 1,
    title: material.title, contentSnippet: 'Synthetic source snippet'
  });
  await service.consultSource(internalSource.id);

  const assessment = service.createAssessment({ title: 'Synthetic reference preservation' });
  const item = service.addAssessmentItem(assessment.id, {
    questionText: 'Synthetic question', assessableSourceId: material.id,
    assessableSourceVersion: 2, maxScore: 1
  });
  const submission = service.importSubmission({
    assessmentId: assessment.id, studentId: 'synthetic-student',
    responses: [{ itemId: item.id, responseText: 'synthetic response' }]
  });

  const sharedPath = path.join(root, 'raw', 'shared-attachment.txt');
  fileStore.saveFile(path.basename(sharedPath), Buffer.from('synthetic attachment'));
  const second = service.createMaterial({
    title: 'Synthetic shared-file reference', contentText: 'Other synthetic content',
    provenance: { type: 'imported', telemetry: { storedPath: sharedPath } }
  });

  const result = await callTool({ method: 'tools/call', params: {
    name: 'delete_material', arguments: { id: material.id, permanent: true }
  } });
  assert.equal(result.isError, undefined, result.content?.[0]?.text);
  const deleted = JSON.parse(result.content[0].text);
  assert.equal(deleted.status, 'deleted_permanently');
  assert.equal(deleted.cleanup.complete, true);
  assert.ok(deleted.cleanup.removedCount >= 2);

  assert.throws(() => service.getMaterial(material.id), /not found/i);
  assert.equal(service.searchMaterials('Synthetic deletion target', { status: 'all' }).length, 0, 'FTS entry removed');
  assert.equal(countFor(dbManager, 'resource_versions', 'resource_id', material.id), 0);
  assert.equal(countFor(dbManager, 'provenance', 'resource_id', material.id), 0);
  assert.equal(countFor(dbManager, 'artifact_source_sets', 'resource_id', material.id), 0);
  assert.equal(countFor(dbManager, 'assessable_authorizations', 'resource_id', material.id), 0);
  assert.equal(countFor(dbManager, 'material_publication_events', 'resource_id', material.id), 0);
  assert.equal(countFor(dbManager, 'collection_items', 'resource_id', material.id), 0);
  assert.equal(countFor(dbManager, 'sources', 'resource_id', material.id), 0, 'internal source associations and cached snippets removed');
  assert.equal(countFor(dbManager, 'source_state_events', 'source_id', internalSource.id), 0, 'source lifecycle events cascade');
  assert.equal(fs.existsSync(versionOnePath), false);
  assert.equal(fs.existsSync(versionTwoPath), false);
  assert.equal(fs.existsSync(path.join(root, material.id)), false, 'empty version directory removed');
  assert.equal(fs.existsSync(sharedPath), true, 'shared original attachment remains while another material references it');

  const retainedItem = dbManager.prepare('SELECT assessable_source_id FROM assessment_items WHERE id = ?').get(item.id);
  assert.equal(retainedItem.assessable_source_id, null, 'assessment is retained and its deleted source association is cleared');
  assert.equal(service.getSubmission(submission.id).id, submission.id, 'submission remains intact');

  const missing = await callTool({ method: 'tools/call', params: {
    name: 'get_material', arguments: { id: material.id }
  } });
  assert.equal(missing.isError, true, 'MCP can no longer retrieve the permanently deleted material');

  const lastDelete = service.deleteMaterialPermanently(second.id);
  assert.equal(lastDelete.cleanup.complete, true);
  assert.equal(fs.existsSync(sharedPath), false, `shared original is removed after its final material reference is deleted: ${JSON.stringify(lastDelete)}`);

  const trashed = service.trashMaterial(service.createMaterial({ title: 'Synthetic trash check', contentText: 'content' }).id);
  assert.equal(trashed.status, 'trashed', 'facade trash operation maps to the supported service lifecycle');
});
