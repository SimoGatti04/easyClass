import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../../src/db/database.js';
import { OrganizationService } from '../../src/services/organization-service.js';
import { AiRuleService } from '../../src/services/ai-rule-service.js';
import { RuleScopes } from '../../src/core/contracts.js';
import { AuthorizationError, ValidationError } from '../../src/core/errors.js';

test('AI operational rules: scopes, authorization, inheritance, and recoverable history', async (t) => {
  const dbManager = new DatabaseManager(':memory:').init();
  const org = new OrganizationService(dbManager);
  const rules = new AiRuleService(dbManager, org);
  const actor = { teacherAuthorized: true, actorId: 'teacher-test' };
  const cls = org.createClass({ name: '4A Informatica', academicYear: '2026/2027' });
  const subject = org.createSubject({ name: 'Informatica', code: 'INF', classId: cls.id });
  const lesson1 = org.createLesson({ title: 'Normalizzazione', classId: cls.id, subjectId: subject.id, orderIndex: 1 });
  const lesson2 = org.createLesson({ title: 'Query SQL', classId: cls.id, subjectId: subject.id, orderIndex: 2 });
  t.after(() => dbManager.close());

  await t.test('persistent changes require the trusted teacher authorization context', () => {
    assert.throws(() => rules.setRule({ scope: RuleScopes.GLOBAL, title: 'No actor', instructionText: 'Denied.' }), AuthorizationError);
    assert.throws(() => rules.archiveRule('missing', null), AuthorizationError);
  });

  await t.test('global, course, class, class/course, lesson, assessment and capability scopes resolve with provenance', () => {
    const created = [
      rules.setRule({ scope: RuleScopes.GLOBAL, title: 'Global', instructionText: 'Be precise and accessible.' }, actor),
      rules.setRule({ scope: RuleScopes.SUBJECT, targetId: subject.id, title: 'Subject', instructionText: 'Use subject terminology.' }, actor),
      rules.setRule({ scope: RuleScopes.COURSE, targetId: 'course-synthetic-4a', title: 'Course', instructionText: 'Use database examples.' }, actor),
      rules.setRule({ scope: RuleScopes.CLASS, targetId: cls.id, title: 'Class', instructionText: 'Use concise recaps.' }, actor),
      rules.setRule({ scope: RuleScopes.CLASS_SUBJECT, targetId: cls.id, secondaryTargetId: 'course-synthetic-4a', title: 'Teaching context', instructionText: 'Use SQLite examples.' }, actor),
      rules.setRule({ scope: RuleScopes.LESSON, targetId: lesson2.id, title: 'Lesson', instructionText: 'Focus on SELECT and WHERE.' }, actor),
      rules.setRule({ scope: RuleScopes.ASSESSMENT, targetId: 'assessment-synthetic', title: 'Assessment', instructionText: 'Keep the draft unpublished.' }, actor),
      rules.setRule({ scope: RuleScopes.CAPABILITY, targetId: 'lesson_plan', title: 'Capability', instructionText: 'Include timing.' }, actor)
    ];
    const resolved = rules.resolveEffectiveRules({
      classId: cls.id, subjectId: subject.id, courseId: 'course-synthetic-4a', lessonId: lesson2.id,
      assessmentId: 'assessment-synthetic', capability: 'lesson_plan',
      oneOffInstruction: 'For this operation only, add a warm-up.'
    });
    assert.equal(resolved.appliedRules.length, 9);
    for (const phrase of ['Be precise', 'subject terminology', 'database examples', 'concise recaps', 'SQLite examples', 'SELECT and WHERE', 'unpublished', 'Include timing', 'warm-up']) {
      assert.ok(resolved.effectiveInstructions.includes(phrase), `missing ${phrase}`);
    }
    assert.equal(resolved.context.classId, cls.id);
    assert.equal(resolved.context.subjectId, subject.id);
    assert.deepEqual(resolved.resolutionTrace.map((entry) => entry.scope), [
      'global', 'subject', 'course', 'class', 'class_subject', 'lesson', 'assessment', 'capability', 'one_off'
    ]);
    assert.equal(resolved.resolutionTrace.at(-1).persistent, false);
    assert.equal(created.length, 8);
  });

  await t.test('updates preserve recoverable versions; restore creates a new immutable version', () => {
    const initial = rules.setRule({ scope: RuleScopes.GLOBAL, title: 'Generation style', instructionText: 'Use short paragraphs.' }, actor);
    const updated = rules.setRule({ id: initial.id, scope: RuleScopes.GLOBAL, title: 'Generation style', instructionText: 'Use short paragraphs and worked examples.', changeNote: 'Teacher preference' }, actor);
    assert.equal(updated.version, 2);
    assert.match(rules.getRuleVersion(initial.id, 1).instruction_text, /short paragraphs\./);
    assert.match(rules.getRuleVersion(initial.id, 2).instruction_text, /worked examples/);
    const history = rules.getRuleVersionHistory(initial.id);
    assert.deepEqual(history.map((row) => row.version), [2, 1]);

    const restored = rules.restoreRuleVersion(initial.id, 1, actor, 'Restore v1 wording');
    assert.equal(restored.version, 3);
    assert.equal(restored.instruction_text, 'Use short paragraphs.');
    assert.equal(rules.getRuleVersionHistory(initial.id).length, 3);

    const archived = rules.archiveRule(initial.id, actor);
    assert.equal(archived.status, 'archived');
    assert.equal(archived.version, 4);
    const active = rules.restoreRule(initial.id, actor);
    assert.equal(active.status, 'active');
    assert.equal(active.version, 5);
    const deleted = rules.deleteRule(initial.id, { changeNote: 'Recoverable delete' }, actor);
    assert.equal(deleted.status, 'deleted');
    assert.equal(rules.getRuleVersionHistory(initial.id).length, 6);
    assert.equal(rules.restoreRule(initial.id, actor).status, 'active');
  });

  await t.test('validation and permanent deletion are explicit', () => {
    assert.throws(() => rules.setRule({ scope: 'invalid', title: 'X', instructionText: 'Y' }, actor), ValidationError);
    assert.throws(() => rules.setRule({ scope: RuleScopes.CLASS_SUBJECT, targetId: cls.id, title: 'Missing secondary', instructionText: 'X' }, actor), ValidationError);
    const disposable = rules.setRule({ scope: RuleScopes.GLOBAL, title: 'Erase me', instructionText: 'Historical record.' }, actor);
    const result = rules.deleteRule(disposable.id, { permanent: true }, actor);
    assert.equal(result.status, 'deleted_permanently');
    assert.equal(result.historyDeleted, true);
    assert.throws(() => rules.getRule(disposable.id));
    assert.ok(!rules.listRules({ status: 'all' }).some((rule) => rule.id === disposable.id));
    assert.throws(() => rules.getRuleVersionHistory(disposable.id));
  });
});
