/**
 * Teacher Service — Assessment & Grading Service
 *
 * Implements Dossier 05 (Assessment System) and Dossier 06 (Grading & Feedback):
 * - Blueprint & Item Management with rubrics and protected teacher-only solutions
 * - Strict Assessable Material grounding & validation
 * - Deterministic grading for self-correcting / objective items
 * - AI-assisted grading for open questions and problem cases with criteria evidence & confidence
 * - Teacher review and manual correction as the final authority
 * - Immutable evaluation rounds for non-destructive regrading
 * - Export of assessment results (JSON, CSV, Markdown report)
 */
import crypto from 'node:crypto';
import { NotFoundError, ValidationError, AuthorizationError } from '../core/errors.js';
import {
  ItemTypes,
  AssessmentStatuses,
  SubmissionStatuses,
  EvaluationTypes,
  EvaluationStatuses,
  PedagogicalRoles,
  ResourceTypes
} from '../core/contracts.js';

export class AssessmentService {
  /**
   * @param {import('../db/database.js').DatabaseManager} dbManager
   * @param {import('./material-service.js').MaterialService} materialService
   * @param {import('../ai/omniroute-client.js').OmniRouteClient} omniRouteClient
   * @param {import('./ai-rule-service.js').AiRuleService} [aiRuleService]
   */
  constructor(dbManager, materialService, omniRouteClient, aiRuleService = null) {
    this.dbManager = dbManager;
    this.materialService = materialService;
    this.omniRouteClient = omniRouteClient;
    this.aiRuleService = aiRuleService;
  }

  /* -------------------------------------------------------------------------- */
  /* ASSESSMENT BLUEPRINT & ITEMS CRUD                                          */
  /* -------------------------------------------------------------------------- */

  createAssessment({
    title,
    description = '',
    classId = null,
    subjectId = null,
    lessonId = null,
    durationMinutes = 60,
    maxScore = 100,
    createdBy = 'teacher',
    items = []
  }) {
    if (!title || typeof title !== 'string' || title.trim() === '') {
      throw new ValidationError('Assessment title is required');
    }

    const id = `asm-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    return this.dbManager.transaction(() => {
      const stmt = this.dbManager.prepare(`
        INSERT INTO assessments (
          id, title, description, class_id, subject_id, lesson_id, status,
          duration_minutes, max_score, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        title.trim(),
        description,
        classId,
        subjectId,
        lessonId,
        AssessmentStatuses.DRAFT,
        durationMinutes,
        maxScore,
        createdBy,
        now,
        now
      );

      // Add items if provided
      if (Array.isArray(items) && items.length > 0) {
        items.forEach((item, index) => {
          this.addItem(id, { ...item, orderIndex: index + 1 });
        });
      }

      return this.getAssessment(id);
    });
  }

  getAssessment(id, { role = 'teacher', includeTeacherSolutions = true } = {}) {
    const stmt = this.dbManager.prepare('SELECT * FROM assessments WHERE id = ?');
    const assessment = stmt.get(id);
    if (!assessment) {
      throw new NotFoundError('Assessment', id);
    }

    const itemsStmt = this.dbManager.prepare(`
      SELECT * FROM assessment_items WHERE assessment_id = ? ORDER BY order_index ASC
    `);
    const rawItems = itemsStmt.all(id);

    const isStudent = role === 'student' || !includeTeacherSolutions;

    const items = rawItems.map(item => {
      let options = null;
      if (item.options_json) {
        try {
          const parsed = JSON.parse(item.options_json);
          options = isStudent
            ? parsed.map(o => ({ id: o.id, text: o.text })) // Strip isCorrect from students
            : parsed;
        } catch {
          options = null;
        }
      }

      let rubric = null;
      if (item.rubric_json) {
        try { rubric = JSON.parse(item.rubric_json); } catch {}
      }

      return {
        id: item.id,
        assessment_id: item.assessment_id,
        order_index: item.order_index,
        type: item.type,
        question_text: item.question_text,
        max_score: item.max_score,
        options,
        rubric,
        is_self_correcting: Boolean(item.is_self_correcting),
        assessable_source_id: item.assessable_source_id,
        assessable_source_version: item.assessable_source_version,
        // APPLICATION-LAYER PROTECTION: strip teacher_solution for student role
        teacher_solution: isStudent ? null : item.teacher_solution,
        created_at: item.created_at
      };
    });

    return {
      ...assessment,
      items,
      itemCount: items.length
    };
  }

  listAssessments({ classId = null, subjectId = null, lessonId = null, status = null } = {}) {
    let sql = 'SELECT * FROM assessments WHERE 1=1';
    const params = [];
    if (classId) {
      sql += ' AND class_id = ?';
      params.push(classId);
    }
    if (subjectId) {
      sql += ' AND subject_id = ?';
      params.push(subjectId);
    }
    if (lessonId) {
      sql += ' AND lesson_id = ?';
      params.push(lessonId);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    return this.dbManager.prepare(sql).all(...params);
  }

  addItem(assessmentId, {
    orderIndex = 0,
    type = ItemTypes.OPEN_QUESTION,
    questionText,
    maxScore = 10,
    rubric = null,
    teacherSolution = '',
    options = null,
    isSelfCorrecting = false,
    assessableSourceId = null,
    assessableSourceVersion = null
  }) {
    if (!questionText || typeof questionText !== 'string' || questionText.trim() === '') {
      throw new ValidationError('Question text is required for assessment item');
    }

    // Every item must be traceable to an exact, currently available Assessable
    // Source Set version. A missing version must never resolve to "current".
    if (typeof assessableSourceId !== 'string' || !assessableSourceId) {
      throw new ValidationError('Assessment items require assessableSourceId grounding');
    }
    if (!Number.isInteger(assessableSourceVersion) || assessableSourceVersion < 1) {
      throw new ValidationError('Assessment items require an exact positive assessableSourceVersion');
    }

    const assessment = this.dbManager.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
    if (!assessment) throw new NotFoundError('Assessment', assessmentId);
    const mat = this.materialService.getMaterial(assessableSourceId, assessableSourceVersion);
    if (mat.pedagogical_role === PedagogicalRoles.TEACHER_MATERIAL ||
        mat.pedagogical_role === PedagogicalRoles.ASSESSABLE_MATERIAL ||
        [ResourceTypes.TEACHER_SCRIPT, ResourceTypes.LESSON_PLAN, ResourceTypes.ASSESSMENT].includes(mat.resource_type)) {
      throw new ValidationError(`Material "${mat.title}" is teacher-only or otherwise ineligible as assessable grounding.`);
    }
    for (const [field, label] of [['class_id', 'class'], ['subject_id', 'subject'], ['lesson_id', 'lesson']]) {
      if (assessment[field] && mat[field] && assessment[field] !== mat[field]) {
        throw new ValidationError(`Material "${mat.title}" is linked to a different ${label} and cannot ground this assessment item.`);
      }
    }
    if (!this.materialService.isVersionAssessable(assessableSourceId, assessableSourceVersion, {
      lessonId: assessment.lesson_id || mat.lesson_id || null
    })) {
      throw new ValidationError(`Material "${mat.title}" version ${assessableSourceVersion} is not currently published and explicitly eligible as assessable material.`);
    }

    const id = `item-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      INSERT INTO assessment_items (
        id, assessment_id, order_index, type, question_text, max_score,
        rubric_json, teacher_solution, options_json, is_self_correcting,
        assessable_source_id, assessable_source_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      assessmentId,
      orderIndex,
      type,
      questionText.trim(),
      maxScore,
      rubric ? JSON.stringify(rubric) : null,
      teacherSolution ? teacherSolution.trim() : '',
      options ? JSON.stringify(options) : null,
      isSelfCorrecting ? 1 : (type === ItemTypes.MULTIPLE_CHOICE ? 1 : 0),
      assessableSourceId,
      assessableSourceVersion,
      now,
      now
    );

    return {
      id,
      assessmentId,
      type,
      questionText,
      maxScore,
      teacherSolution,
      assessableSourceId,
      assessableSourceVersion
    };
  }

  /* -------------------------------------------------------------------------- */
  /* SUBMISSIONS & RESPONSES                                                    */
  /* -------------------------------------------------------------------------- */

  importSubmission({
    assessmentId,
    studentId,
    studentName = '',
    responses = []
  }) {
    this.getAssessment(assessmentId); // Ensure assessment exists

    if (!studentId || typeof studentId !== 'string') {
      throw new ValidationError('studentId is required for submission');
    }

    const id = `sub-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    return this.dbManager.transaction(() => {
      const stmtSub = this.dbManager.prepare(`
        INSERT INTO assessment_submissions (
          id, assessment_id, student_id, student_name, submitted_at, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmtSub.run(id, assessmentId, studentId, studentName, now, SubmissionStatuses.SUBMITTED, now, now);

      const stmtResp = this.dbManager.prepare(`
        INSERT INTO submission_responses (id, submission_id, item_id, response_text, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const resp of responses) {
        if (!resp.itemId || typeof resp.responseText !== 'string') {
          throw new ValidationError('Each response requires itemId and responseText');
        }
        stmtResp.run(`resp-${crypto.randomUUID()}`, id, resp.itemId, resp.responseText, now);
      }

      return this.getSubmission(id);
    });
  }

  getSubmission(submissionId) {
    const stmt = this.dbManager.prepare('SELECT * FROM assessment_submissions WHERE id = ?');
    const sub = stmt.get(submissionId);
    if (!sub) {
      throw new NotFoundError('Submission', submissionId);
    }

    const respStmt = this.dbManager.prepare(`
      SELECT r.*, i.question_text, i.type, i.max_score, i.options_json, i.rubric_json, i.teacher_solution
      FROM submission_responses r
      JOIN assessment_items i ON r.item_id = i.id
      WHERE r.submission_id = ?
    `);
    const responses = respStmt.all(submissionId);

    // Get latest evaluations for this submission
    const evalStmt = this.dbManager.prepare(`
      SELECT * FROM evaluations WHERE submission_id = ?
      ORDER BY evaluation_round DESC, created_at DESC
    `);
    const evaluations = evalStmt.all(submissionId);

    return {
      ...sub,
      responses,
      evaluations
    };
  }

  listSubmissions(assessmentId) {
    const stmt = this.dbManager.prepare(`
      SELECT * FROM assessment_submissions WHERE assessment_id = ? ORDER BY submitted_at ASC
    `);
    return stmt.all(assessmentId);
  }

  /* -------------------------------------------------------------------------- */
  /* GRADING ENGINE: DETERMINISTIC + AI ASSISTED (Dossier 06)                   */
  /* -------------------------------------------------------------------------- */

  async gradeSubmission({
    submissionId,
    evaluator = 'system',
    model = undefined
  }) {
    const submission = this.getSubmission(submissionId);
    this.getAssessment(submission.assessment_id);
    if (submission.responses.length === 0) {
      throw new ValidationError('Cannot grade a submission with no responses');
    }

    let totalScore = 0;
    let maxPossibleScore = 0;
    const itemResults = [];
    const now = new Date().toISOString();

    // Prepare the entire evaluation round in memory first. Any AI or validation
    // failure aborts before persistence, so the database never contains a
    // partial round or a heuristic substitute for a failed model response.
    for (const resp of submission.responses) {
      maxPossibleScore += resp.max_score;
      let awardedScore = 0;
      let feedback = '';
      let confidence = 1.0;
      let evalType = EvaluationTypes.DETERMINISTIC;
      let criteriaBreakdown = null;

      if (resp.type === ItemTypes.MULTIPLE_CHOICE) {
        let options = [];
        try { options = resp.options_json ? JSON.parse(resp.options_json) : []; } catch {}
        const correctOptions = Array.isArray(options) ? options.filter(o => o?.isCorrect === true) : [];
        if (correctOptions.length !== 1) {
          throw new ValidationError(`Multiple-choice item ${resp.item_id} must have exactly one valid correct option before grading`);
        }
        const correctOption = correctOptions[0];
        const studentAnswer = (resp.response_text || '').trim();
        const isMatch = studentAnswer.toUpperCase() === String(correctOption.id || '').toUpperCase() ||
          studentAnswer.toLowerCase() === String(correctOption.text || '').toLowerCase();
        awardedScore = isMatch ? resp.max_score : 0;
        feedback = isMatch ? 'Risposta esatta.' : 'Risposta errata.';
      } else {
        evalType = EvaluationTypes.AI_ASSISTED;
        const gradingPrompt = [
          {
            role: 'system',
            content: `Sei un docente valutatore rigoroso ed empatico. Valuta la risposta secondo i criteri e la soluzione attesa. Il punteggio massimo è ${resp.max_score}. Restituisci esclusivamente JSON valido: {"score": numero tra 0 e ${resp.max_score}, "confidence": numero tra 0 e 1, "reasoning": stringa, "criteriaScores": array, "feedback": stringa}.` 
          },
          {
            role: 'user',
            content: `Quesito: ${resp.question_text}\nSoluzione attesa docente: ${resp.teacher_solution || 'N/A'}\nRubrica: ${resp.rubric_json || 'Valutazione basata su accuratezza, chiarezza e completezza'}\n\nRisposta fornita dallo studente:\n"${resp.response_text}"`
          }
        ];

        const aiRes = await this.omniRouteClient.complete({ messages: gradingPrompt, model, temperature: 0.2 });
        let parsed;
        try {
          parsed = JSON.parse(aiRes.content);
        } catch {
          const jsonMatch = typeof aiRes.content === 'string' ? aiRes.content.match(/\{[\s\S]*\}/) : null;
          if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[0]); } catch {}
          }
        }
        if (!parsed || typeof parsed.score !== 'number' || !Number.isFinite(parsed.score) ||
            parsed.score < 0 || parsed.score > resp.max_score) {
          throw new ValidationError(`AI grading returned an invalid score for item ${resp.item_id}`);
        }
        if (parsed.confidence !== undefined &&
            (typeof parsed.confidence !== 'number' || !Number.isFinite(parsed.confidence) || parsed.confidence < 0 || parsed.confidence > 1)) {
          throw new ValidationError(`AI grading returned invalid confidence for item ${resp.item_id}`);
        }
        if (parsed.feedback !== undefined && typeof parsed.feedback !== 'string') {
          throw new ValidationError(`AI grading returned invalid feedback for item ${resp.item_id}`);
        }
        if (parsed.reasoning !== undefined && typeof parsed.reasoning !== 'string') {
          throw new ValidationError(`AI grading returned invalid reasoning for item ${resp.item_id}`);
        }
        if (parsed.criteriaScores !== undefined && !Array.isArray(parsed.criteriaScores)) {
          throw new ValidationError(`AI grading returned invalid criteria breakdown for item ${resp.item_id}`);
        }

        awardedScore = parsed.score;
        confidence = parsed.confidence ?? 0.85;
        feedback = parsed.feedback || parsed.reasoning || '';
        if (!feedback) throw new ValidationError(`AI grading returned no feedback for item ${resp.item_id}`);
        criteriaBreakdown = parsed.criteriaScores ?? null;
      }

      totalScore += awardedScore;
      itemResults.push({
        itemId: resp.item_id,
        score: awardedScore,
        maxScore: resp.max_score,
        feedback,
        confidence,
        evalType,
        criteriaBreakdown
      });
    }

    const normalized10 = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 10 : 0;
    const proposedGrade = (Math.round(normalized10 * 10) / 10).toFixed(1);

    const evaluationRound = this.dbManager.transaction(() => {
      const roundStmt = this.dbManager.prepare(`
        SELECT COALESCE(MAX(evaluation_round), 0) + 1 AS next_round FROM evaluations WHERE submission_id = ?
      `);
      const nextRound = roundStmt.get(submissionId).next_round;
      const insertEval = this.dbManager.prepare(`
        INSERT INTO evaluations (
          id, submission_id, item_id, evaluation_round, evaluation_type, score, max_score,
          confidence, feedback, criteria_breakdown_json, status, evaluator, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const result of itemResults) {
        insertEval.run(
          `eval-${crypto.randomUUID()}`,
          submissionId,
          result.itemId,
          nextRound,
          result.evalType,
          result.score,
          result.maxScore,
          result.confidence,
          result.feedback,
          result.criteriaBreakdown ? JSON.stringify(result.criteriaBreakdown) : null,
          EvaluationStatuses.PROPOSED,
          evaluator,
          now
        );
      }
      this.dbManager.prepare(`
        UPDATE assessment_submissions
        SET status = ?, total_score = ?, proposed_grade = ?, updated_at = ?
        WHERE id = ?
      `).run(SubmissionStatuses.GRADED, totalScore, proposedGrade, now, submissionId);
      return nextRound;
    });

    return { submissionId, evaluationRound, totalScore, maxPossibleScore, proposedGrade, itemResults };
  }

  /* -------------------------------------------------------------------------- */
  /* TEACHER REVIEW & MANUAL CORRECTION (Dossier 06 §2)                         */
  /* -------------------------------------------------------------------------- */

  reviewGrading({
    submissionId,
    itemOverrides = [],
    finalGrade = null,
    teacherNotes = '',
    reviewer = 'teacher'
  }) {
    const submission = this.getSubmission(submissionId);
    const now = new Date().toISOString();

    return this.dbManager.transaction(() => {
      let currentTotal = submission.total_score || 0;

      for (const override of itemOverrides) {
        if (!override.itemId || typeof override.score !== 'number') {
          throw new ValidationError('Each override requires itemId and numeric score');
        }

        // Get item max_score
        const itemStmt = this.dbManager.prepare('SELECT max_score FROM assessment_items WHERE id = ?');
        const item = itemStmt.get(override.itemId);
        const maxScore = item ? item.max_score : 10;

        const evalId = `eval-${crypto.randomUUID()}`;
        const stmt = this.dbManager.prepare(`
          INSERT INTO evaluations (
            id, submission_id, item_id, evaluation_round, evaluation_type, score, max_score,
            confidence, feedback, status, evaluator, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1.0, ?, ?, ?, ?)
        `);
        stmt.run(
          evalId,
          submissionId,
          override.itemId,
          999, // manual review marker
          EvaluationTypes.MANUAL_TEACHER,
          override.score,
          maxScore,
          override.feedback || 'Revisione manuale docente',
          EvaluationStatuses.OVERRIDDEN,
          reviewer,
          now
        );
      }

      // Recompute total score if overrides given
      if (itemOverrides.length > 0) {
        const latestScoresStmt = this.dbManager.prepare(`
          SELECT item_id, score FROM (
            SELECT item_id, score, ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY evaluation_round DESC, created_at DESC, rowid DESC) as rn
            FROM evaluations WHERE submission_id = ?
          ) WHERE rn = 1
        `);
        const latestScores = latestScoresStmt.all(submissionId);
        currentTotal = latestScores.reduce((acc, curr) => acc + curr.score, 0);
      }

      const effectiveFinalGrade = finalGrade !== null ? String(finalGrade) : (submission.proposed_grade || `${currentTotal}`);

      const stmtSub = this.dbManager.prepare(`
        UPDATE assessment_submissions
        SET status = ?, total_score = ?, final_grade = ?, teacher_notes = ?, updated_at = ?
        WHERE id = ?
      `);
      stmtSub.run(SubmissionStatuses.REVIEWED, currentTotal, effectiveFinalGrade, teacherNotes, now, submissionId);

      return this.getSubmission(submissionId);
    });
  }

  /* -------------------------------------------------------------------------- */
  /* RESULT EXPORT                                                              */
  /* -------------------------------------------------------------------------- */

  exportAssessmentResults(assessmentId, format = 'csv') {
    const assessment = this.getAssessment(assessmentId);
    const submissions = this.listSubmissions(assessmentId);

    if (format === 'json') {
      return {
        assessmentId,
        assessment,
        submissions,
        exportedAt: new Date().toISOString()
      };
    }

    if (format === 'report' || format === 'markdown') {
      let report = `# Report Risultati Verifica: ${assessment.title}\n\n`;
      report += `Data di emissione: ${new Date().toLocaleDateString('it-IT')}\n`;
      report += `Punteggio Massimo: ${assessment.max_score} | Durata: ${assessment.duration_minutes} min\n\n`;
      report += `## Riepilogo Studenti\n\n`;
      report += `| Studente | Punteggio Totale | Voto Proposto | Voto Finale | Stato |\n`;
      report += `| :--- | :---: | :---: | :---: | :---: |\n`;

      for (const s of submissions) {
        report += `| ${s.student_name || s.student_id} | ${s.total_score ?? 'N/D'} | ${s.proposed_grade ?? 'N/D'} | ${s.final_grade ?? 'N/D'} | ${s.status} |\n`;
      }
      return report;
    }

    // Default: CSV
    let csv = 'student_id,student_name,submitted_at,status,total_score,proposed_grade,final_grade,teacher_notes\n';
    for (const s of submissions) {
      csv += `"${s.student_id}","${s.student_name || ''}","${s.submitted_at}","${s.status}",${s.total_score ?? ''},"${s.proposed_grade ?? ''}","${s.final_grade ?? ''}","${(s.teacher_notes || '').replace(/"/g, '""')}"\n`;
    }
    return csv;
  }
}
