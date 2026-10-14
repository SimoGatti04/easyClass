/**
 * Teacher Service — versioned AI operational instructions (Dossier 09).
 * Persistent rule mutations require a trusted teacher authorization context;
 * one-off instructions remain transient and are never stored as rules.
 */
import crypto from 'node:crypto';
import { AuthorizationError, NotFoundError, ValidationError } from '../core/errors.js';
import { RuleScopes } from '../core/contracts.js';

const PERSISTENT_SCOPES = Object.values(RuleScopes).filter((scope) => scope !== RuleScopes.ONE_OFF);
const versionId = () => `rule-version-${crypto.randomUUID()}`;

function assertTeacher(actor) {
  if (actor?.teacherAuthorized !== true) {
    throw new AuthorizationError('A verified teacher authorization is required to modify persistent AI instructions');
  }
}

export class AiRuleService {
  constructor(dbManager, orgService = null) {
    this.dbManager = dbManager;
    this.orgService = orgService;
  }

  setRule({
    id = null,
    scope,
    targetId = null,
    secondaryTargetId = null,
    title,
    instructionText,
    changeNote = null
  }, actor = null) {
    assertTeacher(actor);
    this._validate({ scope, targetId, secondaryTargetId, title, instructionText });
    const now = new Date().toISOString();
    const clean = {
      scope,
      targetId,
      secondaryTargetId,
      title: title.trim(),
      instructionText: instructionText.trim()
    };

    if (id) {
      const existing = this._getRow(id);
      const unchanged = existing.scope === clean.scope &&
        existing.target_id === clean.targetId &&
        existing.secondary_target_id === clean.secondaryTargetId &&
        existing.title === clean.title &&
        existing.instruction_text === clean.instructionText;
      if (unchanged) return this.getRule(id);
      return this.dbManager.transaction(() => {
        const version = existing.version + 1;
        this.dbManager.prepare(`
          UPDATE instruction_rules
          SET scope = ?, target_id = ?, secondary_target_id = ?, title = ?,
              instruction_text = ?, version = ?, status = 'active', updated_at = ?
          WHERE id = ?
        `).run(clean.scope, clean.targetId, clean.secondaryTargetId, clean.title,
          clean.instructionText, version, now, id);
        this._insertSnapshot(id, version, clean, 'active', actor, changeNote, now);
        return this.getRule(id);
      });
    }

    const newId = `rule-${crypto.randomUUID()}`;
    return this.dbManager.transaction(() => {
      this.dbManager.prepare(`
        INSERT INTO instruction_rules (
          id, scope, target_id, secondary_target_id, title, instruction_text,
          version, status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 'active', ?, ?, ?)
      `).run(newId, clean.scope, clean.targetId, clean.secondaryTargetId,
        clean.title, clean.instructionText, actor.actorId || 'teacher', now, now);
      this._insertSnapshot(newId, 1, clean, 'active', actor, changeNote || 'Created', now);
      return this.getRule(newId);
    });
  }

  getRule(id) {
    return this._publicRule(this._getRow(id));
  }

  getRuleVersion(id, version) {
    if (!Number.isInteger(Number(version)) || Number(version) < 1) {
      throw new ValidationError('Rule version must be a positive integer');
    }
    const row = this.dbManager.prepare(`
      SELECT * FROM instruction_rule_versions WHERE rule_id = ? AND version = ?
    `).get(id, Number(version));
    if (!row) throw new NotFoundError(`Instruction Rule version ${version}`, id);
    return row;
  }

  getRuleVersionHistory(id) {
    this._getRow(id);
    return this.dbManager.prepare(`
      SELECT * FROM instruction_rule_versions WHERE rule_id = ? ORDER BY version DESC
    `).all(id);
  }

  listRules({ scope = null, targetId = null, secondaryTargetId = null, status = 'active' } = {}) {
    let sql = 'SELECT * FROM instruction_rules WHERE 1=1';
    const params = [];
    if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
    if (scope) { sql += ' AND scope = ?'; params.push(scope); }
    if (targetId) { sql += ' AND target_id = ?'; params.push(targetId); }
    if (secondaryTargetId) { sql += ' AND secondary_target_id = ?'; params.push(secondaryTargetId); }
    sql += ' ORDER BY created_at ASC, id ASC';
    return this.dbManager.prepare(sql).all(...params).map((row) => this._publicRule(row));
  }

  archiveRule(id, actor = null, changeNote = null) {
    assertTeacher(actor);
    return this._setStatus(id, 'archived', actor, changeNote || 'Archived');
  }

  restoreRule(id, actor = null, changeNote = null) {
    assertTeacher(actor);
    return this._setStatus(id, 'active', actor, changeNote || 'Restored');
  }

  /**
   * Delete is a recoverable tombstone by default, preserving rule snapshots and
   * historical generation references. `permanent` is explicit data erasure.
   */
  deleteRule(id, { permanent = false, changeNote = null } = {}, actor = null) {
    assertTeacher(actor);
    const current = this._getRow(id);
    if (permanent) {
      this.dbManager.prepare('DELETE FROM instruction_rules WHERE id = ?').run(id);
      return { success: true, id, status: 'deleted_permanently', historyDeleted: true };
    }
    return this._setStatus(id, 'deleted', actor, changeNote || 'Deleted (recoverable)');
  }

  restoreRuleVersion(id, version, actor = null, changeNote = null) {
    assertTeacher(actor);
    const historical = this.getRuleVersion(id, version);
    const current = this._getRow(id);
    const now = new Date().toISOString();
    const nextVersion = current.version + 1;
    const snapshot = {
      scope: historical.scope,
      targetId: historical.target_id,
      secondaryTargetId: historical.secondary_target_id,
      title: historical.title,
      instructionText: historical.instruction_text
    };
    return this.dbManager.transaction(() => {
      this.dbManager.prepare(`
        UPDATE instruction_rules SET scope = ?, target_id = ?, secondary_target_id = ?,
          title = ?, instruction_text = ?, version = ?, status = 'active', updated_at = ?
        WHERE id = ?
      `).run(snapshot.scope, snapshot.targetId, snapshot.secondaryTargetId,
        snapshot.title, snapshot.instructionText, nextVersion, now, id);
      this._insertSnapshot(id, nextVersion, snapshot, 'active', actor,
        changeNote || `Restored content from v${version}`, now);
      return this.getRule(id);
    });
  }

  resolveEffectiveRules({
    classId = null,
    subjectId = null,
    courseId = null,
    lessonId = null,
    assessmentId = null,
    capability = null,
    oneOffInstruction = null
  } = {}) {
    let effectiveClassId = classId;
    let effectiveSubjectId = subjectId || courseId;
    let effectiveCourseId = courseId || subjectId;

    if (lessonId && this.orgService && (!effectiveClassId || !effectiveSubjectId || !effectiveCourseId)) {
      const lesson = this.orgService.getLesson(lessonId);
      effectiveClassId ||= lesson.class_id;
      effectiveSubjectId ||= lesson.subject_id;
      effectiveCourseId ||= lesson.subject_id;
    }

    const levels = [
      { scope: RuleScopes.GLOBAL, level: 1 },
      ...(effectiveSubjectId ? [
        { scope: RuleScopes.SUBJECT, target: effectiveSubjectId, level: 2 }
      ] : []),
      ...(effectiveCourseId ? [{ scope: RuleScopes.COURSE, target: effectiveCourseId, level: 2 }] : []),
      ...(effectiveClassId ? [{ scope: RuleScopes.CLASS, target: effectiveClassId, level: 3 }] : []),
      ...(effectiveClassId && effectiveCourseId ? [
        { scope: RuleScopes.CLASS_SUBJECT, target: effectiveClassId, secondary: effectiveCourseId, level: 4 }
      ] : []),
      ...(lessonId ? [{ scope: RuleScopes.LESSON, target: lessonId, level: 5 }] : []),
      ...(assessmentId ? [{ scope: RuleScopes.ASSESSMENT, target: assessmentId, level: 6 }] : []),
      ...(capability ? [{ scope: RuleScopes.CAPABILITY, target: capability, level: 7 }] : [])
    ];

    const appliedRules = [];
    const resolutionTrace = [];
    for (const entry of levels) {
      let sql = "SELECT * FROM instruction_rules WHERE scope = ? AND status = 'active'";
      const params = [entry.scope];
      if (entry.target !== undefined) { sql += ' AND target_id = ?'; params.push(entry.target); }
      if (entry.secondary !== undefined) { sql += ' AND secondary_target_id = ?'; params.push(entry.secondary); }
      sql += ' ORDER BY created_at ASC, id ASC';
      for (const row of this.dbManager.prepare(sql).all(...params)) {
        const rule = this._publicRule(row);
        appliedRules.push(rule);
        resolutionTrace.push({
          scope: row.scope,
          targetId: row.target_id,
          secondaryTargetId: row.secondary_target_id,
          id: row.id,
          title: row.title,
          version: row.version,
          level: entry.level,
          inherited: entry.scope !== RuleScopes.GLOBAL
        });
      }
    }

    if (typeof oneOffInstruction === 'string' && oneOffInstruction.trim()) {
      const oneOff = {
        id: null,
        scope: RuleScopes.ONE_OFF,
        title: 'One-off operation instruction',
        instruction_text: oneOffInstruction.trim(),
        version: null,
        status: 'transient',
        persistent: false
      };
      appliedRules.push(oneOff);
      resolutionTrace.push({ scope: RuleScopes.ONE_OFF, id: null, title: oneOff.title, version: null, level: 8, inherited: false, persistent: false });
    }

    const effectiveInstructions = appliedRules.map((rule) =>
      `[Regola ${rule.id || 'one-off'}${rule.version ? ` v${rule.version}` : ''}: ${rule.title} (${rule.scope})]\n${rule.instruction_text}`
    ).join('\n\n');

    return {
      effectiveInstructions,
      effectiveInstructionPrompt: effectiveInstructions,
      promptText: effectiveInstructions,
      appliedRules,
      resolutionTrace,
      rulesCount: appliedRules.length,
      context: { classId: effectiveClassId, subjectId: effectiveSubjectId, courseId: effectiveCourseId, lessonId, assessmentId, capability }
    };
  }

  _validate({ scope, targetId, secondaryTargetId, title, instructionText }) {
    if (!PERSISTENT_SCOPES.includes(scope)) {
      throw new ValidationError(`Invalid persistent rule scope: "${scope}". Valid scopes: ${PERSISTENT_SCOPES.join(', ')}`);
    }
    if (!title || typeof title !== 'string' || !title.trim()) throw new ValidationError('Rule title is required');
    if (!instructionText || typeof instructionText !== 'string' || !instructionText.trim()) throw new ValidationError('Instruction text is required');
    if ([RuleScopes.SUBJECT, RuleScopes.COURSE, RuleScopes.CLASS, RuleScopes.LESSON, RuleScopes.ASSESSMENT, RuleScopes.CAPABILITY].includes(scope) && !targetId) {
      throw new ValidationError(`Scope "${scope}" requires a valid targetId`);
    }
    if (scope === RuleScopes.CLASS_SUBJECT && (!targetId || !secondaryTargetId)) {
      throw new ValidationError('class_subject scope requires targetId (classId) and secondaryTargetId (subject/course ID)');
    }
    if (scope !== RuleScopes.CLASS_SUBJECT && secondaryTargetId) {
      throw new ValidationError(`Scope "${scope}" does not accept secondaryTargetId`);
    }
  }

  _getRow(id) {
    const row = this.dbManager.prepare('SELECT * FROM instruction_rules WHERE id = ?').get(id);
    if (!row) throw new NotFoundError('Instruction Rule', id);
    return row;
  }

  _publicRule(row) {
    return { ...row, persistent: true };
  }

  _insertSnapshot(id, version, rule, status, actor, changeNote, now) {
    this.dbManager.prepare(`
      INSERT INTO instruction_rule_versions (
        id, rule_id, version, scope, target_id, secondary_target_id,
        title, instruction_text, status, changed_by, change_note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(versionId(), id, version, rule.scope, rule.targetId, rule.secondaryTargetId,
      rule.title, rule.instructionText, status, actor.actorId || 'teacher', changeNote, now);
  }

  _setStatus(id, status, actor, changeNote) {
    const current = this._getRow(id);
    if (current.status === status) return this.getRule(id);
    const now = new Date().toISOString();
    const version = current.version + 1;
    const snapshot = {
      scope: current.scope,
      targetId: current.target_id,
      secondaryTargetId: current.secondary_target_id,
      title: current.title,
      instructionText: current.instruction_text
    };
    return this.dbManager.transaction(() => {
      this.dbManager.prepare('UPDATE instruction_rules SET version = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(version, status, now, id);
      this._insertSnapshot(id, version, snapshot, status, actor, changeNote, now);
      return this.getRule(id);
    });
  }
}
