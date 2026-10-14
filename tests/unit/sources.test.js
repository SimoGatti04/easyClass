import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { OrganizationService } from '../../src/services/organization-service.js';
import { MaterialService } from '../../src/services/material-service.js';
import { SourceService } from '../../src/services/source-service.js';
import { SourceStates, PedagogicalRoles, ResourceTypes } from '../../src/core/contracts.js';
import { ValidationError, NotFoundError } from '../../src/core/errors.js';
import path from 'node:path';
import fs from 'node:fs';

const webFixture = {
  async search(query) {
    return [{ title: 'RFC 791 - Internet Protocol Specification', url: 'https://datatracker.ietf.org/doc/html/rfc791', snippet: `Results for ${query}`, provider: 'test-search' }];
  },
  async fetchPage(url) {
    return {
      title: 'RFC 791 - Internet Protocol Specification',
      url,
      content: 'The Internet Protocol is designed for use in interconnected systems of packet-switched networks.',
      contentHash: 'sha256-rfc-fixture',
      accessedAt: '2026-10-13T10:00:00.000Z',
      contentType: 'text/html'
    };
  }
};

test('Source workflow: FOUND -> CONSULTED -> USED -> SAVED, exact versions, and source provenance', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', 'test-sources-' + Date.now());
  const db = new DatabaseManager(':memory:').init();
  const files = new FileStore(tmpDir);
  const org = new OrganizationService(db);
  const materials = new MaterialService(db, files, org);
  const sources = new SourceService(db, materials, org, webFixture);
  t.after(() => {
    db.close();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const cls = org.createClass({ name: '5B Telecomunicazioni', academicYear: '2026/2027' });
  const subject = org.createSubject({ name: 'Sistemi e Reti', classId: cls.id });
  const lesson1 = org.createLesson({ title: 'Architettura TCP/IP', classId: cls.id, subjectId: subject.id, orderIndex: 1 });
  const lesson2 = org.createLesson({ title: 'Routing OSPF e BGP', classId: cls.id, subjectId: subject.id, orderIndex: 2 });
  const current = org.createLesson({ title: 'Routing e Datagrammi', classId: cls.id, subjectId: subject.id, orderIndex: 3 });
  const studentMaterial = materials.createMaterial({
    title: 'Dispensa TCP/IP - Modello a 4 Strati',
    contentText: 'Il modello TCP/IP è composto da Applicazione, Trasporto, Internet e Accesso alla rete.',
    pedagogicalRole: PedagogicalRoles.STUDENT_MATERIAL,
    resourceType: ResourceTypes.STUDENT_NOTE,
    lessonId: lesson1.id
  });
  materials.createMaterial({ title: 'Appunti BGP', contentText: 'BGP scambia informazioni di raggiungibilità fra sistemi autonomi.', pedagogicalRole: PedagogicalRoles.TEACHER_MATERIAL, lessonId: lesson2.id });

  await t.test('external registration is FOUND and unverified until real retrieval', async () => {
    const found = sources.registerSource({
      sourceType: 'external_web', title: 'RFC 791', url: 'https://datatracker.ietf.org/doc/html/rfc791',
      authorityLevel: 'official', contentSnippet: 'Unverified caller snippet must not be treated as page content.'
    });
    assert.equal(found.state, SourceStates.FOUND);
    assert.equal(found.authority_level, 'unverified');
    assert.throws(() => sources.getSourceContent(found.id), ValidationError);

    const consulted = await sources.consultSource(found.id);
    assert.equal(consulted.state, SourceStates.CONSULTED);
    assert.equal(consulted.content_version, 1);
    assert.match(consulted.consultedContent, /packet-switched networks/);
    assert.notEqual(consulted.consultedContent, found.content_snippet);
    assert.equal(consulted.authority_level, 'official');

    const used = sources.markSourcesUsed([found.id], { [found.id]: { referenceKey: 'S1', usageEvidence: 'Included in test prompt.' } });
    assert.equal(used[0].state, SourceStates.USED);
    const saved = sources.saveExternalSource(found.id, { lessonId: lesson1.id, tags: ['rfc', 'tcp-ip'] });
    assert.equal(saved.source.state, SourceStates.SAVED);
    assert.ok(saved.savedMaterial.id);
    assert.equal(saved.savedMaterial.pedagogical_role, PedagogicalRoles.SUPPORT_MATERIAL);
    assert.equal(saved.savedMaterial.resource_type, ResourceTypes.REFERENCE_SOURCE);
    const history = sources.getSourceHistory(found.id).map((event) => event.state);
    assert.deepEqual(history, ['found', 'consulted', 'used', 'saved']);
  });

  await t.test('internal source search and previous lessons return exact consulted versions', () => {
    const results = sources.searchInternalSources('TCP/IP');
    assert.ok(results.length >= 1);
    assert.equal(results[0].resourceId, studentMaterial.id);
    assert.equal(results[0].versionNumber, 1);
    assert.equal(results[0].isAssessable, false);

    materials.publishMaterial(studentMaterial.id, { versionNumber: 1 });
    assert.equal(sources.searchInternalSources('TCP/IP')[0].isAssessable, true);

    const previous = sources.getPreviousLessonsContext(cls.id, subject.id, { currentLessonOrder: 3, limit: 2 });
    assert.deepEqual(previous.map((lesson) => lesson.lessonId), [lesson2.id, lesson1.id]);
    assert.ok(previous.flatMap((lesson) => lesson.materials).some((item) => item.version === 1));
    const previousMaterialSource = sources.listSources({ sourceType: 'internal_material', resourceId: studentMaterial.id })[0];
    assert.equal(previousMaterialSource.state, SourceStates.CONSULTED);
    assert.ok(sources.getSourceHistory(previousMaterialSource.id).some((event) => event.state === SourceStates.CONSULTED && event.content_version === 1));
  });

  await t.test('selection pins source versions, exclusions, and required-source retrieval failures', async () => {
    const exact = await sources.selectGenerationSources({
      query: 'TCP/IP BGP datagram', classId: cls.id, subjectId: subject.id,
      lessonId: current.id, includePreviousLessons: true, previousLessonLimit: 2,
      searchInternal: false, searchWeb: true, webSourceLimit: 1,
      requiredSources: [{ resourceId: studentMaterial.id, versionNumber: 1 }]
    });
    assert.ok(exact.some((source) => source.resourceId === studentMaterial.id && source.versionNumber === 1 && source.required));
    const web = exact.find((source) => source.sourceType === 'external_web');
    assert.equal(web.contentVersionNumber, 1);
    assert.equal(web.state, SourceStates.CONSULTED);
    assert.equal(web.trustedInstruction, false);

    await assert.rejects(() => sources.selectGenerationSources({
      query: 'TCP/IP', searchInternal: false, searchWeb: false,
      requiredSources: [{ resourceId: 'missing-material', versionNumber: 1 }]
    }), NotFoundError);
    await assert.rejects(() => sources.selectGenerationSources({
      query: 'TCP/IP', searchInternal: false, searchWeb: false,
      requiredSources: [{ resourceId: studentMaterial.id }]
    }), /exact versionNumber/);
  });
});
