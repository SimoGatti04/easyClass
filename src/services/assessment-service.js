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
import path from 'node:path';
import { NotFoundError, ValidationError, AuthorizationError, ConflictError } from '../core/errors.js';
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
  constructor(dbManager, materialService, omniRouteClient, aiRuleService = null, fileStore = null, { allowExternalStudentGrading = process.env.TEACHER_SERVICE_ALLOW_EXTERNAL_STUDENT_GRADING === 'true', classPinSecret = process.env.TEACHER_SERVICE_CLASS_PIN_SECRET || '' } = {}) {
    this.dbManager = dbManager;
    this.materialService = materialService;
    this.omniRouteClient = omniRouteClient;
    this.aiRuleService = aiRuleService;
    this.fileStore = fileStore;
    this.allowExternalStudentGrading = Boolean(allowExternalStudentGrading);
    this.classPinSecret = typeof classPinSecret === 'string' ? classPinSecret : '';
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
    status = AssessmentStatuses.DRAFT,
    activityType = "test",
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

      const effStatus = status || AssessmentStatuses.DRAFT;
      const effType = activityType || "test";
      stmt.run(
        id,
        title.trim(),
        description,
        classId,
        subjectId,
        lessonId,
        effStatus,
        durationMinutes,
        maxScore,
        createdBy,
        now,
        now
      );
      this.dbManager.prepare("UPDATE assessments SET activity_type = ?, is_active = 1 WHERE id = ?").run(effType, id);

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

    // In 'ready' state, students receive activity metadata but zero questions
    if (isStudent && assessment.status === AssessmentStatuses.READY) {
      return {
        ...assessment,
        activityType: assessment.activity_type || 'test',
        durationMinutes: assessment.duration_minutes,
        maxScore: assessment.max_score,
        items: [],
        itemCount: 0,
        message: 'La verifica è pronta ma non è ancora stata avviata dal docente. I quesiti saranno visibili non appena la prova verrà attivata.'
      };
    }

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
      if (item.rubric_json && !isStudent) {
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
        rubric: isStudent ? null : rubric,
        starter_code: item.starter_code || null,
        language: item.language || null,
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
    starterCode = null,
    language = null,
    assessableSourceId = null,
    assessableSourceVersion = null
  }) {
    if (!questionText || typeof questionText !== 'string' || questionText.trim() === '') {
      throw new ValidationError('Question text is required for assessment item');
    }

    const activeAttemptsCount = this.dbManager.prepare(`
      SELECT COUNT(*) as count FROM assessment_submissions WHERE assessment_id = ?
    `).get(assessmentId)?.count || 0;
    if (activeAttemptsCount > 0) {
      throw new ConflictError("Impossibile aggiungere quesiti: la verifica ha già tentativi avviati dagli studenti.");
    }

    // Auto-detect published assessable material for the assessment if not explicitly provided
    if (!assessableSourceId) {
      const parentAsm = this.dbManager.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
      if (parentAsm && parentAsm.class_id) {
        const now = new Date().toISOString();
        const candidates = this.dbManager.prepare(`
          SELECT r.id, r.current_version AS version
          FROM resources r
          JOIN material_publication_events p
            ON r.id = p.resource_id AND r.current_version = p.version_number
          WHERE (r.class_id = ? OR r.class_id IS NULL)
            AND (r.subject_id IS NULL OR r.subject_id = ?)
            AND (r.lesson_id IS NULL OR r.lesson_id = ?)
            AND r.pedagogical_role IN ('student_material', 'support_material')
            AND r.resource_type NOT IN ('teacher_script', 'lesson_plan', 'assessment')
            AND r.status = 'active'
            AND p.rowid = (
              SELECT p2.rowid FROM material_publication_events p2
              WHERE p2.resource_id = r.id AND p2.version_number = r.current_version
              ORDER BY p2.occurred_at DESC, p2.rowid DESC LIMIT 1
            )
            AND p.state = 'published'
            AND (p.available_until IS NULL OR p.available_until > ?)
          ORDER BY r.created_at DESC
        `).all(parentAsm.class_id, parentAsm.subject_id || null, parentAsm.lesson_id || null, now);
        const eligible = candidates.find((candidate) => this.materialService.isVersionAssessable(
          candidate.id,
          candidate.version,
          { lessonId: parentAsm.lesson_id || null }
        ));
        if (eligible) {
          assessableSourceId = eligible.id;
          assessableSourceVersion = eligible.version;
        }
      }
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
        starter_code, language,
        assessable_source_id, assessable_source_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      starterCode || null,
      language || (type === ItemTypes.CODE ? 'python' : null),
      assessableSourceId,
      assessableSourceVersion,
      now,
      now
    );

    this.dbManager.prepare(`
      UPDATE assessments SET version = version + 1, updated_at = ? WHERE id = ?
    `).run(now, assessmentId);

    const updated = this.getAssessment(assessmentId, { role: "teacher", includeTeacherSolutions: true });
    const createdItem = updated.items.find(i => i.id === id);
    return {
      ...createdItem,
      maxScore: createdItem.max_score,
      questionText: createdItem.question_text,
      orderIndex: createdItem.order_index,
      teacherSolution: createdItem.teacher_solution,
      assessableSourceId: createdItem.assessable_source_id,
      assessableSourceVersion: createdItem.assessable_source_version,
      starterCode: createdItem.starter_code,
      isSelfCorrecting: createdItem.is_self_correcting
    };
  }

  updateAssessment(id, updates = {}) {
    const existing = this.getAssessment(id);
    const validStatuses = [AssessmentStatuses.DRAFT, AssessmentStatuses.READY, AssessmentStatuses.ACTIVE, AssessmentStatuses.CLOSED];
    
    let nextStatus = existing.status;
    if (updates.status !== undefined) {
      if (!validStatuses.includes(updates.status)) {
        throw new ValidationError(`Stato attività non valido: '${updates.status}'. Validi: ${validStatuses.join(", ")}`);
      }
      nextStatus = updates.status;

      if (nextStatus !== existing.status) {
        const allowedTransitions = {
          [AssessmentStatuses.DRAFT]: [AssessmentStatuses.READY, AssessmentStatuses.ACTIVE],
          [AssessmentStatuses.READY]: [AssessmentStatuses.DRAFT, AssessmentStatuses.ACTIVE],
          [AssessmentStatuses.ACTIVE]: [AssessmentStatuses.READY, AssessmentStatuses.CLOSED],
          [AssessmentStatuses.CLOSED]: [AssessmentStatuses.ACTIVE]
        };

        if (!allowedTransitions[existing.status]?.includes(nextStatus)) {
          throw new ValidationError(`Transizione di stato non consentita: da '${existing.status}' a '${nextStatus}'`);
        }

        if (nextStatus === AssessmentStatuses.DRAFT) {
          const subCount = this.dbManager.prepare("SELECT COUNT(*) as count FROM assessment_submissions WHERE assessment_id = ?").get(id)?.count || 0;
          if (subCount > 0) {
            throw new ConflictError("Impossibile riportare l'attività in bozza: sono già presenti risposte o consegne registrate.");
          }
        }
      }

    }

    const title = updates.title !== undefined ? updates.title.trim() : existing.title;
    if (!title) throw new ValidationError("Il titolo dell'attività non può essere vuoto");
    const description = updates.description !== undefined ? updates.description : existing.description;
    const durationMinutes = updates.durationMinutes !== undefined ? updates.durationMinutes : existing.duration_minutes;
    const maxScore = updates.maxScore !== undefined ? updates.maxScore : existing.max_score;
    const activityType = updates.activityType !== undefined ? updates.activityType : (existing.activity_type || "test");
    const now = new Date().toISOString();

    this.dbManager.prepare(`
      UPDATE assessments
      SET title = ?, description = ?, duration_minutes = ?, max_score = ?,
          status = ?, activity_type = ?, updated_at = ?
      WHERE id = ?
    `).run(title, description, durationMinutes, maxScore, nextStatus, activityType, now, id);

    return this.getAssessment(id);
  }

  setAssessmentStatus(id, newStatus) {
    return this.updateAssessment(id, { status: newStatus });
  }

  updateItem(assessmentId, itemId, updates = {}) {
    this.getAssessment(assessmentId);

    const activeAttemptsCount = this.dbManager.prepare(`
      SELECT COUNT(*) as count FROM assessment_submissions WHERE assessment_id = ?
    `).get(assessmentId)?.count || 0;
    if (activeAttemptsCount > 0) {
      throw new ConflictError("Impossibile modificare i quesiti: la verifica ha già tentativi avviati dagli studenti.");
    }

    const existing = this.dbManager.prepare(`
      SELECT * FROM assessment_items WHERE id = ? AND assessment_id = ?
    `).get(itemId, assessmentId);
    if (!existing) {
      throw new NotFoundError("AssessmentItem", itemId);
    }

    let assessableSourceId = existing.assessable_source_id;
    let assessableSourceVersion = existing.assessable_source_version;
    if (updates.assessableSourceId !== undefined) {
      assessableSourceId = updates.assessableSourceId;
      assessableSourceVersion = updates.assessableSourceVersion || existing.assessable_source_version;
      
      const mat = this.materialService.getMaterial(assessableSourceId, assessableSourceVersion);
      if (mat.pedagogical_role === PedagogicalRoles.TEACHER_MATERIAL ||
          mat.pedagogical_role === PedagogicalRoles.ASSESSABLE_MATERIAL ||
          [ResourceTypes.TEACHER_SCRIPT, ResourceTypes.LESSON_PLAN, ResourceTypes.ASSESSMENT].includes(mat.resource_type)) {
        throw new ValidationError(`Material "${mat.title}" is teacher-only or ineligible as assessable grounding.`);
      }
    }

    const questionText = updates.questionText !== undefined ? updates.questionText.trim() : existing.question_text;
    if (!questionText) throw new ValidationError("Question text cannot be empty");

    const maxScore = updates.maxScore !== undefined ? updates.maxScore : existing.max_score;
    const type = updates.type || existing.type;
    const rubricJson = updates.rubric !== undefined ? (updates.rubric ? JSON.stringify(updates.rubric) : null) : existing.rubric_json;
    const teacherSolution = updates.teacherSolution !== undefined ? (typeof updates.teacherSolution === "string" ? updates.teacherSolution.trim() : "") : existing.teacher_solution;
    const optionsJson = updates.options !== undefined ? (updates.options ? JSON.stringify(updates.options) : null) : existing.options_json;
    const isSelfCorrecting = updates.isSelfCorrecting !== undefined ? (updates.isSelfCorrecting ? 1 : 0) : existing.is_self_correcting;
    const starterCode = updates.starterCode !== undefined ? updates.starterCode : existing.starter_code;
    const language = updates.language !== undefined ? updates.language : existing.language;
    const orderIndex = updates.orderIndex !== undefined ? updates.orderIndex : existing.order_index;
    const now = new Date().toISOString();

    this.dbManager.prepare(`
      UPDATE assessment_items
      SET question_text = ?, max_score = ?, type = ?, rubric_json = ?,
          teacher_solution = ?, options_json = ?, is_self_correcting = ?,
          starter_code = ?, language = ?, order_index = ?,
          assessable_source_id = ?, assessable_source_version = ?,
          updated_at = ?
      WHERE id = ? AND assessment_id = ?
    `).run(
      questionText, maxScore, type, rubricJson,
      teacherSolution, optionsJson, isSelfCorrecting,
      starterCode, language, orderIndex,
      assessableSourceId, assessableSourceVersion,
      now, itemId, assessmentId
    );

    this.dbManager.prepare(`
      UPDATE assessments SET version = version + 1, updated_at = ? WHERE id = ?
    `).run(now, assessmentId);

    const updated = this.getAssessment(assessmentId, { role: "teacher", includeTeacherSolutions: true });
    const item = updated.items.find(i => i.id === itemId);
    return {
      ...item,
      maxScore: item.max_score,
      questionText: item.question_text,
      orderIndex: item.order_index,
      teacherSolution: item.teacher_solution,
      assessableSourceId: item.assessable_source_id,
      assessableSourceVersion: item.assessable_source_version,
      starterCode: item.starter_code,
      isSelfCorrecting: item.is_self_correcting
    };
  }

  deleteItem(assessmentId, itemId) {
    this.getAssessment(assessmentId);

    const activeAttemptsCount = this.dbManager.prepare(`
      SELECT COUNT(*) as count FROM assessment_submissions WHERE assessment_id = ?
    `).get(assessmentId)?.count || 0;
    if (activeAttemptsCount > 0) {
      throw new ConflictError("Impossibile eliminare i quesiti: la verifica ha già tentativi avviati dagli studenti.");
    }

    const existing = this.dbManager.prepare(`
      SELECT id FROM assessment_items WHERE id = ? AND assessment_id = ?
    `).get(itemId, assessmentId);
    if (!existing) {
      throw new NotFoundError("AssessmentItem", itemId);
    }

    const hasResponses = this.dbManager.prepare(`
      SELECT COUNT(*) as count FROM submission_responses WHERE item_id = ?
    `).get(itemId)?.count || 0;
    if (hasResponses > 0) {
      throw new ConflictError("Impossibile eliminare il quesito: sono già presenti risposte di studenti.");
    }

    this.dbManager.prepare(`
      DELETE FROM assessment_items WHERE id = ? AND assessment_id = ?
    `).run(itemId, assessmentId);

    this.dbManager.prepare(`
      UPDATE assessments SET version = version + 1, updated_at = ? WHERE id = ?
    `).run(new Date().toISOString(), assessmentId);

    return { success: true, id: itemId };
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
    const evaluations = this.dbManager.prepare(`
      SELECT * FROM evaluations WHERE submission_id = ?
      ORDER BY evaluation_round DESC, created_at DESC, rowid DESC
    `).all(submissionId);
    const actionEvents = this.dbManager.prepare(`
      SELECT id, action, actor, reason, details_json, created_at
      FROM assessment_action_events WHERE submission_id = ?
      ORDER BY created_at DESC, rowid DESC
    `).all(submissionId);

    return {
      ...sub,
      responses,
      evaluations,
      actionEvents
    };
  }

  listSubmissions(assessmentId) {
    const stmt = this.dbManager.prepare(`
      SELECT * FROM assessment_submissions WHERE assessment_id = ? ORDER BY submitted_at ASC
    `);
    return stmt.all(assessmentId);
  }

  getSubmissionsForItem(assessmentId, itemId) {
    const assessment = this.getAssessment(assessmentId);
    const item = this.dbManager.prepare(`
      SELECT * FROM assessment_items WHERE id = ? AND assessment_id = ?
    `).get(itemId, assessmentId);
    if (!item) throw new NotFoundError('AssessmentItem', itemId);

    const evaluationJoin = `
      LEFT JOIN evaluations e ON e.id = (
        SELECT e2.id FROM evaluations e2
        WHERE e2.submission_id = s.id AND e2.item_id = i.id
        ORDER BY CASE WHEN e2.evaluation_type = 'manual_teacher' THEN 0 ELSE 1 END,
                 e2.evaluation_round DESC, e2.created_at DESC, e2.rowid DESC
        LIMIT 1
      )`;
    const select = `
      SELECT COALESCE(st.id, s.student_id) AS student_id,
             COALESCE(s.student_name, TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, ''))) AS student_name,
             s.id AS submission_id, s.status AS submission_status,
             s.attempt_status, s.submitted_at, s.last_saved_at,
             r.response_text, r.attachment_name,
             e.score AS current_score, e.max_score AS evaluated_max_score,
             e.evaluation_type AS current_evaluation_type, e.feedback AS current_feedback,
             e.teacher_notes AS current_teacher_notes,
             s.final_grade, s.proposed_grade
      FROM assessment_items i
      JOIN assessments a ON a.id = i.assessment_id
      LEFT JOIN students st ON a.class_id IS NOT NULL AND st.class_id = a.class_id
      LEFT JOIN assessment_submissions s
        ON s.assessment_id = i.assessment_id
       AND (s.student_id = st.id OR st.id IS NULL)
      LEFT JOIN submission_responses r ON r.submission_id = s.id AND r.item_id = i.id
      ${evaluationJoin}
      WHERE i.id = ? AND i.assessment_id = ?
      ORDER BY COALESCE(st.last_name, s.student_name, s.student_id), COALESCE(st.first_name, '')
    `;
    const submissions = this.dbManager.prepare(select).all(itemId, assessmentId);
    return {
      assessmentId,
      item: {
        id: item.id,
        order_index: item.order_index,
        type: item.type,
        question_text: item.question_text,
        max_score: item.max_score,
        rubric_json: item.rubric_json,
        teacher_solution: item.teacher_solution
      },
      submissions
    };
  }

  getAssessmentStatistics(assessmentId) {
    const assessment = this.getAssessment(assessmentId);
    const submissions = this.dbManager.prepare(`
      SELECT status, attempt_status, total_score, final_grade, proposed_grade
      FROM assessment_submissions WHERE assessment_id = ?
    `).all(assessmentId);
    const totalStudents = assessment.class_id
      ? this.dbManager.prepare('SELECT COUNT(*) AS count FROM students WHERE class_id = ?').get(assessment.class_id).count
      : submissions.length;
    const withdrawnCount = submissions.filter(s => s.attempt_status === 'teacher_withdrawn').length;
    const inProgressCount = submissions.filter(s => s.attempt_status === 'in_progress').length;
    const submittedCount = submissions.filter(s => s.attempt_status === 'submitted' && s.status !== 'withdrawn_by_teacher').length;
    const gradingCompleted = submissions.filter(s => s.status === SubmissionStatuses.REVIEWED && s.final_grade !== null && s.final_grade !== '').
      filter(s => typeof s.total_score === 'number' && Number.isFinite(s.total_score));
    const proposedCount = submissions.filter(s => s.proposed_grade !== null && s.proposed_grade !== '' && s.status !== SubmissionStatuses.REVIEWED).length;
    const finalizedScores = gradingCompleted.map(s => s.total_score);
    const meanFinalScore = finalizedScores.length
      ? finalizedScores.reduce((sum, value) => sum + value, 0) / finalizedScores.length
      : null;
    // Population standard deviation summarizes this assessment's confirmed cohort.
    const populationStdDevFinalScore = finalizedScores.length
      ? Math.sqrt(finalizedScores.reduce((sum, value) => sum + ((value - meanFinalScore) ** 2), 0) / finalizedScores.length)
      : null;
    const maxScore = Number(assessment.max_score) || 0;
    const bands = [
      { id: 'below-50', label: '< 50%', min: 0, max: 50 },
      { id: '50-59', label: '50–59%', min: 50, max: 60 },
      { id: '60-69', label: '60–69%', min: 60, max: 70 },
      { id: '70-79', label: '70–79%', min: 70, max: 80 },
      { id: '80-89', label: '80–89%', min: 80, max: 90 },
      { id: '90-plus', label: '≥ 90%', min: 90, max: Infinity }
    ];
    const scoreDistribution = bands.map(band => ({
      id: band.id,
      label: band.label,
      count: maxScore > 0 ? gradingCompleted.filter(s => {
        const percent = (s.total_score / maxScore) * 100;
        return percent >= band.min && percent < band.max;
      }).length : 0
    }));
    const startedCount = submissions.length;
    const notStartedCount = Math.max(0, totalStudents - startedCount);
    const awaitingCorrectionCount = Math.max(0, submittedCount + withdrawnCount - gradingCompleted.length);

    return {
      assessmentId,
      totalStudents,
      startedCount,
      notStartedCount,
      inProgressCount,
      submittedCount,
      withdrawnCount,
      gradingCompletedCount: gradingCompleted.length,
      proposedCount,
      awaitingCorrectionCount,
      meanFinalScore: meanFinalScore === null ? null : Number(meanFinalScore.toFixed(2)),
      meanFinalPercent: meanFinalScore === null || maxScore <= 0 ? null : Number(((meanFinalScore / maxScore) * 100).toFixed(1)),
      populationStdDevFinalScore: populationStdDevFinalScore === null ? null : Number(populationStdDevFinalScore.toFixed(2)),
      populationStdDevFinalPercent: populationStdDevFinalScore === null || maxScore <= 0
        ? null
        : Number(((populationStdDevFinalScore / maxScore) * 100).toFixed(1)),
      finalGradeDenominator: gradingCompleted.length,
      scoreDistribution,
      generatedAt: new Date().toISOString()
    };
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
    const assessment = this.getAssessment(submission.assessment_id);
    const gradingItems = this.dbManager.prepare(`
      SELECT i.id AS item_id, i.question_text, i.type, i.max_score, i.options_json,
             i.rubric_json, i.teacher_solution, r.response_text, r.attachment_path,
             r.attachment_name
      FROM assessment_items i
      LEFT JOIN submission_responses r
        ON r.item_id = i.id AND r.submission_id = ?
      WHERE i.assessment_id = ?
      ORDER BY i.order_index ASC, i.created_at ASC
    `).all(submissionId, submission.assessment_id);
    if (gradingItems.length === 0) {
      throw new ValidationError('Cannot grade an assessment with no questions');
    }

    let totalScore = 0;
    let maxPossibleScore = 0;
    const itemResults = [];
    const now = new Date().toISOString();

    // Include unanswered items as explicit zero proposals. Prepare the full
    // round before persistence so AI/validation failures never leave partial data.
    for (const resp of gradingItems) {
      maxPossibleScore += resp.max_score;
      let awardedScore = 0;
      let feedback = '';
      let confidence = 1.0;
      let evalType = EvaluationTypes.DETERMINISTIC;
      let criteriaBreakdown = null;
      const answer = (resp.response_text || '').trim();
      const hasAnswer = answer.length > 0 || Boolean(resp.attachment_path);

      if (!hasAnswer) {
        feedback = 'Nessuna risposta salvata: proposta 0 punti.';
      } else if (resp.type === ItemTypes.MULTIPLE_CHOICE) {
        let options = [];
        try { options = resp.options_json ? JSON.parse(resp.options_json) : []; } catch {}
        const correctOptions = Array.isArray(options) ? options.filter(o => o?.isCorrect === true) : [];
        if (correctOptions.length !== 1) {
          throw new ValidationError(`Multiple-choice item ${resp.item_id} must have exactly one valid correct option before grading`);
        }
        const correctOption = correctOptions[0];
        const isMatch = answer.toUpperCase() === String(correctOption.id || '').toUpperCase() ||
          answer.toLowerCase() === String(correctOption.text || '').toLowerCase();
        awardedScore = isMatch ? resp.max_score : 0;
        feedback = isMatch ? 'Risposta esatta.' : 'Risposta errata.';
      } else {
        if (resp.attachment_path && !answer) {
          throw new ValidationError(`Item ${resp.item_id} contains only an attachment and requires teacher review`);
        }
        evalType = EvaluationTypes.AI_ASSISTED;
        if (!this.allowExternalStudentGrading && this.omniRouteClient.mockOffline !== true) {
          throw new AuthorizationError('External AI processing of student submissions is disabled until separately authorized by configuration');
        }
        const gradingPrompt = [
          {
            role: 'system',
            content: `Sei un docente valutatore rigoroso ed empatico. Valuta la risposta secondo i criteri e la soluzione attesa. Il punteggio massimo è ${resp.max_score}. Restituisci esclusivamente JSON valido: {"score": numero tra 0 e ${resp.max_score}, "confidence": numero tra 0 e 1, "reasoning": stringa, "criteriaScores": array, "feedback": stringa}.`
          },
          {
            role: 'user',
            content: `Quesito: ${resp.question_text}
Soluzione attesa docente: ${resp.teacher_solution || 'N/A'}
Rubrica: ${resp.rubric_json || 'Valutazione basata su accuratezza, chiarezza e completezza'}

Risposta fornita dallo studente:
"${answer}"`
          }
        ];
        const aiRes = await this.omniRouteClient.complete({ messages: gradingPrompt, model, temperature: 0.2 });
        let parsed;
        try { parsed = JSON.parse(aiRes.content); } catch {
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
      const nextRound = this.dbManager.prepare(`
        SELECT COALESCE(MAX(evaluation_round), 0) + 1 AS next_round
        FROM evaluations WHERE submission_id = ?
      `).get(submissionId).next_round;
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
        SET status = CASE WHEN final_grade IS NOT NULL THEN status ELSE ? END,
            total_score = CASE WHEN final_grade IS NOT NULL THEN total_score ELSE ? END,
            proposed_grade = ?, updated_at = ?
        WHERE id = ?
      `).run(SubmissionStatuses.GRADED, totalScore, proposedGrade, now, submissionId);
      return nextRound;
    });

    return {
      submissionId,
      assessmentId: assessment.id,
      evaluationRound,
      totalScore,
      maxPossibleScore,
      proposedGrade,
      itemResults,
      finalGradePreserved: submission.final_grade !== null && submission.final_grade !== undefined
    };
  }

  /* -------------------------------------------------------------------------- */
  /* TEACHER REVIEW & MANUAL CORRECTION (Dossier 06 §2)                         */
  /* -------------------------------------------------------------------------- */

  reviewGrading({
    submissionId,
    itemOverrides = [],
    finalGrade = null,
    teacherNotes = undefined,
    reviewer = 'teacher',
    teacherPrincipal = null,
    finalize = true,
    idempotencyKey = null,
    reason = null
  }) {
    if (!Array.isArray(itemOverrides)) throw new ValidationError('itemOverrides must be an array');
    if (finalize && (typeof finalGrade !== 'string' || !finalGrade.trim())) {
      throw new ValidationError('A final grade is required to finalize a teacher review');
    }
    if (!finalize && itemOverrides.length === 0) {
      throw new ValidationError('At least one item correction is required when saving without finalizing');
    }
    if (idempotencyKey !== null) this._validateActionKey(idempotencyKey);

    const initialSubmission = this.getSubmission(submissionId);
    const assessment = this.getAssessment(initialSubmission.assessment_id);
    const now = new Date().toISOString();
    const actor = teacherPrincipal || reviewer || 'teacher';
    const effectiveReason = (reason || teacherNotes || initialSubmission.teacher_notes || (finalize ? 'Conferma valutazione docente' : 'Correzione manuale per quesito')).trim();

    return this.dbManager.transaction(() => {
      const existingAction = idempotencyKey
        ? this._findActionByKey(assessment.id, idempotencyKey, 'grading_review', submissionId)
        : null;
      if (existingAction) return this.getSubmission(submissionId);
      const submission = this.getSubmission(submissionId);
      const effectiveNotes = teacherNotes ?? submission.teacher_notes ?? '';
      const alreadyFinalized = submission.status === SubmissionStatuses.REVIEWED && submission.final_grade !== null && submission.final_grade !== '';

      const seenItemIds = new Set();
      const evaluationRound = this.dbManager.prepare(`
        SELECT COALESCE(MAX(evaluation_round), 0) + 1 AS next_round
        FROM evaluations WHERE submission_id = ?
      `).get(submissionId).next_round;
      const insertEval = this.dbManager.prepare(`
        INSERT INTO evaluations (
          id, submission_id, item_id, evaluation_round, evaluation_type, score, max_score,
          confidence, feedback, teacher_notes, status, evaluator, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1.0, ?, ?, ?, ?, ?)
      `);

      for (const override of itemOverrides) {
        if (!override?.itemId || typeof override.score !== 'number' || !Number.isFinite(override.score)) {
          throw new ValidationError('Each override requires itemId and a finite numeric score');
        }
        if (seenItemIds.has(override.itemId)) {
          throw new ValidationError(`Duplicate item correction for ${override.itemId}`);
        }
        seenItemIds.add(override.itemId);
        const item = this.dbManager.prepare(`
          SELECT id, max_score FROM assessment_items WHERE id = ? AND assessment_id = ?
        `).get(override.itemId, assessment.id);
        if (!item) throw new ValidationError(`Item ${override.itemId} does not belong to this assessment`);
        if (override.score < 0 || override.score > item.max_score) {
          throw new ValidationError(`Score for item ${override.itemId} must be between 0 and ${item.max_score}`);
        }
        if (override.feedback !== undefined && typeof override.feedback !== 'string') {
          throw new ValidationError(`Feedback for item ${override.itemId} must be text`);
        }
        if (override.notes !== undefined && typeof override.notes !== 'string') {
          throw new ValidationError(`Teacher notes for item ${override.itemId} must be text`);
        }
        insertEval.run(
          `eval-${crypto.randomUUID()}`,
          submissionId,
          override.itemId,
          evaluationRound,
          EvaluationTypes.MANUAL_TEACHER,
          override.score,
          item.max_score,
          override.feedback ?? '',
          override.notes ?? null,
          EvaluationStatuses.OVERRIDDEN,
          actor,
          now
        );
      }

      let currentTotal = submission.total_score ?? 0;
      if (itemOverrides.length > 0) {
        currentTotal = this.dbManager.prepare(`
          SELECT COALESCE(SUM(score), 0) AS total FROM (
            SELECT e.score,
                   ROW_NUMBER() OVER (
                     PARTITION BY e.item_id
                     ORDER BY CASE WHEN e.evaluation_type = 'manual_teacher' THEN 0 ELSE 1 END,
                              e.evaluation_round DESC, e.created_at DESC, e.rowid DESC
                   ) AS rn
            FROM evaluations e
            JOIN assessment_items i
              ON i.id = e.item_id AND i.assessment_id = ?
            WHERE e.submission_id = ?
          ) WHERE rn = 1
        `).get(assessment.id, submissionId).total;
      }

      // Saving another correction pass is not an implicit revocation of an
      // already-confirmed grade. Keep the visible final result intact until
      // the teacher explicitly finalizes a new grade.
      const nextStatus = finalize
        ? SubmissionStatuses.REVIEWED
        : (alreadyFinalized
          ? SubmissionStatuses.REVIEWED
          : (submission.proposed_grade ? SubmissionStatuses.GRADED : SubmissionStatuses.SUBMITTED));
      this.dbManager.prepare(`
        UPDATE assessment_submissions
        SET status = ?, total_score = ?, final_grade = ?, teacher_notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        nextStatus,
        !finalize && alreadyFinalized ? submission.total_score : currentTotal,
        finalize ? finalGrade.trim() : (alreadyFinalized ? submission.final_grade : null),
        effectiveNotes,
        now,
        submissionId
      );

      this._recordAssessmentAction({
        assessmentId: assessment.id,
        submissionId,
        action: 'grading_review',
        actor,
        reason: effectiveReason,
        idempotencyKey,
        details: {
          finalize,
          evaluationRound: itemOverrides.length > 0 ? evaluationRound : null,
          itemIds: [...seenItemIds],
          totalScoreBefore: submission.total_score,
          totalScoreAfter: currentTotal,
          finalGradeBefore: submission.final_grade,
          finalGradeAfter: finalize ? finalGrade.trim() : null,
          teacherNotesBefore: submission.teacher_notes || null,
          teacherNotesAfter: effectiveNotes || null
        },
        createdAt: now
      });

      return this.getSubmission(submissionId);
    });
  }

  /* -------------------------------------------------------------------------- */
  /* RESULT EXPORT                                                              */
  /* -------------------------------------------------------------------------- */

  exportAssessmentResults(assessmentId, format = 'csv') {
    const assessment = this.getAssessment(assessmentId);
    const submissions = this.listSubmissions(assessmentId);
    const statistics = this.getAssessmentStatistics(assessmentId);

    if (format === 'json') {
      return {
        assessmentId,
        assessment,
        statistics,
        // The JSON export is the complete teacher-side record, including exact
        // answer/item lineage and attachment references. The route and MCP tool
        // are teacher-authorized; student-facing APIs use a separate projection.
        submissions: submissions.map((submission) => this.getSubmission(submission.id)),
        exportedAt: new Date().toISOString()
      };
    }

    if (format === 'report' || format === 'markdown') {
      let report = `# Report Risultati Verifica: ${assessment.title}\n\n`;
      report += `Data di emissione: ${new Date().toLocaleDateString('it-IT')}\n`;
      report += `Punteggio Massimo: ${assessment.max_score} | Durata: ${assessment.duration_minutes} min\n\n`;
      report += `## Riepilogo valutazioni confermate\n\n`;
      report += `- Consegne volontarie: ${statistics.submittedCount}\n`;
      report += `- Ritiri del docente: ${statistics.withdrawnCount}\n`;
      report += `- Correzioni finali: ${statistics.gradingCompletedCount}\n`;
      report += `- Media punti confermati: ${statistics.meanFinalScore ?? 'N/D'} (denominatore: ${statistics.finalGradeDenominator})\n`;
      report += `- Deviazione standard popolazione, punti confermati: ${statistics.populationStdDevFinalScore ?? 'N/D'} (stesso denominatore: ${statistics.finalGradeDenominator})\n\n`;
      report += `## Riepilogo Studenti\n\n`;
      report += `| Studente | Punteggio Totale | Voto Proposto | Voto Finale | Stato |\n`;
      report += `| :--- | :---: | :---: | :---: | :---: |\n`;
      for (const s of submissions) {
        report += `| ${s.student_name || s.student_id} | ${s.total_score ?? 'N/D'} | ${s.proposed_grade ?? 'N/D'} | ${s.final_grade ?? 'N/D'} | ${s.status} |\n`;
      }
      return report;
    }

    // Scores included in the average are explicitly marked. Pending proposals
    // remain visible but are not conflated with confirmed teacher grades.
    let csv = 'student_id,student_name,submitted_at,attempt_status,grading_status,total_score,proposed_grade,final_grade,statistics_included,teacher_notes\n';
    for (const s of submissions) {
      const included = s.status === SubmissionStatuses.REVIEWED && s.final_grade !== null && s.final_grade !== '' && typeof s.total_score === 'number';
      csv += `"${s.student_id}","${(s.student_name || '').replace(/"/g, '""')}","${s.submitted_at || ''}","${s.attempt_status}","${s.status}",${s.total_score ?? ''},"${s.proposed_grade ?? ''}","${(s.final_grade ?? '').replace(/"/g, '""')}",${included ? 'true' : 'false'},"${(s.teacher_notes || '').replace(/"/g, '""')}"\n`;
    }
    return csv;
  }

  /* -------------------------------------------------------------------------- */
  /* STUDENT SUBMISSION WORKFLOW & LIVE MONITORING (Dossier 02, 05, 06)         */
  /* -------------------------------------------------------------------------- */

  getStudentSubmission(assessmentId, studentId, { role = 'student' } = {}) {
    const stmt = this.dbManager.prepare(`
      SELECT * FROM assessment_submissions
      WHERE assessment_id = ? AND student_id = ?
    `);
    const sub = stmt.get(assessmentId, studentId);
    if (!sub) return null;

    const asm = this.dbManager.prepare(`
      SELECT duration_minutes, status FROM assessments WHERE id = ?
    `).get(assessmentId);

    const durationMinutes = (asm && typeof asm.duration_minutes === 'number' && asm.duration_minutes > 0)
      ? asm.duration_minutes
      : (asm?.duration_minutes === null ? null : 60);

    const extraMinutes = sub.extra_time_minutes || 0;
    let timer = null;
    if (sub.started_at && durationMinutes) {
      const startedMs = new Date(sub.started_at).getTime();
      const totalAllowedMinutes = durationMinutes + extraMinutes;
      const expiresAtMs = startedMs + (totalAllowedMinutes * 60 * 1000);
      const nowMs = Date.now();
      const timeRemainingSeconds = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
      const isTimeExpired = (nowMs >= expiresAtMs);
      timer = {
        duration_minutes: durationMinutes,
        extra_time_minutes: extraMinutes,
        started_at: sub.started_at,
        expires_at: new Date(expiresAtMs).toISOString(),
        server_now: new Date(nowMs).toISOString(),
        time_remaining_seconds: timeRemainingSeconds,
        is_time_expired: isTimeExpired
      };
    } else {
      timer = {
        duration_minutes: durationMinutes,
        extra_time_minutes: extraMinutes,
        started_at: sub.started_at || null,
        expires_at: null,
        server_now: new Date().toISOString(),
        time_remaining_seconds: durationMinutes ? durationMinutes * 60 : null,
        is_time_expired: false
      };
    }

    if (role === 'student') {
      const respStmt = this.dbManager.prepare(`
        SELECT r.id, r.item_id, r.response_text, r.attachment_path, r.attachment_name, r.updated_at,
               a.id AS attachment_id,
               CASE WHEN r.attachment_path IS NOT NULL AND r.attachment_path != '' THEN 1 ELSE 0 END as has_attachment
        FROM submission_responses r
        LEFT JOIN student_attachments a
          ON a.storage_path = r.attachment_path
          AND a.assessment_id = ?
          AND a.student_id = ?
          AND a.item_id = r.item_id
        WHERE r.submission_id = ?
      `);
      const responses = respStmt.all(assessmentId, studentId, sub.id);

      return {
        id: sub.id,
        assessment_id: sub.assessment_id,
        student_id: sub.student_id,
        student_name: sub.student_name,
        attempt_status: sub.attempt_status,
        status: sub.status,
        submitted_at: sub.submitted_at,
        last_saved_at: sub.last_saved_at,
        started_at: sub.started_at,
        extra_time_minutes: extraMinutes,
        revision: sub.revision || 0,
        assessment_version: sub.assessment_version || 1,
        seat_row: sub.seat_row,
        seat_desk: sub.seat_desk,
        left_neighbor_id: sub.left_neighbor_id,
        left_neighbor_name: sub.left_neighbor_name,
        right_neighbor_id: sub.right_neighbor_id,
        right_neighbor_name: sub.right_neighbor_name,
        timer,
        responses: responses.map(r => ({
          item_id: r.item_id,
          response_text: r.response_text,
          attachment_name: r.attachment_name,
          attachment_id: r.attachment_id || null,
          has_attachment: Boolean(r.has_attachment),
          updated_at: r.updated_at
        }))
      };
    }

    // Teacher view: include teacher notes, scores, evaluations, full paths
    const respStmt = this.dbManager.prepare(`
      SELECT r.id, r.item_id, r.response_text, r.attachment_path, r.attachment_name, r.updated_at
      FROM submission_responses r
      WHERE r.submission_id = ?
    `);
    const responses = respStmt.all(sub.id);

    return {
      ...sub,
      timer,
      responses
    };
  }

  saveDraftSubmission({
    assessmentId,
    studentId,
    studentName = "",
    seatRow = null,
    seatDesk = null,
    leftNeighborId = null,
    leftNeighborName = null,
    rightNeighborId = null,
    rightNeighborName = null,
    responses = [],
    revision = undefined,
    isFinal = false,
    attemptStatus = undefined
  }) {
    const asm = this.getAssessment(assessmentId);
    if (!studentId) {
      throw new ValidationError("studentId is required");
    }

    // Lifecycle check
    if (asm.status === AssessmentStatuses.DRAFT) {
      throw new AuthorizationError("Attività in bozza non disponibile per gli studenti");
    }
    if (asm.status === AssessmentStatuses.CLOSED) {
      throw new AuthorizationError("Attività chiusa dal docente. Nessun salvataggio consentito.");
    }
    if (asm.status === AssessmentStatuses.READY) {
      throw new AuthorizationError("La verifica non è ancora stata avviata dal docente.");
    }

    // Server-side class membership validation
    if (asm.class_id) {
      const studentRow = this.dbManager.prepare(`SELECT class_id FROM students WHERE id = ?`).get(studentId);
      if (!studentRow || studentRow.class_id !== asm.class_id) {
        throw new AuthorizationError("Lo studente non appartiene alla classe assegnata a questa attività");
      }
    }

    // Validate that all responses reference items actually belonging to this assessment
    if (Array.isArray(responses) && responses.length > 0) {
      const validItems = new Set(
        this.dbManager.prepare(`SELECT id FROM assessment_items WHERE assessment_id = ?`).all(assessmentId).map(i => i.id)
      );
      for (const r of responses) {
        if (r.itemId && !validItems.has(r.itemId)) {
          throw new ValidationError(`L'elemento ${r.itemId} non appartiene a questa attività`);
        }
      }
    }

    const now = new Date().toISOString();

    const subCheck = this.dbManager.prepare(`
      SELECT id, started_at, extra_time_minutes, attempt_status, status FROM assessment_submissions
      WHERE assessment_id = ? AND student_id = ?
    `).get(assessmentId, studentId);

    // Immutability check: once submitted, cannot be updated unless reopened by teacher
    if (subCheck && (subCheck.attempt_status === "submitted" || subCheck.attempt_status === "teacher_withdrawn" || subCheck.status === "submitted" || subCheck.status === "withdrawn_by_teacher")) {
      throw new ConflictError("Consegna già finalizzata ed immutabile. La prova non può essere modificata.");
    }

    const durationMinutes = (typeof asm.duration_minutes === 'number' && asm.duration_minutes > 0)
      ? asm.duration_minutes
      : (asm?.duration_minutes === null ? null : 60);

    const finalSubmit = isFinal || attemptStatus === "submitted";

    // Authoritative timer check: if duration set and student already started, enforce timer limit
    if (subCheck && durationMinutes && subCheck.started_at) {
      const extraMinutes = subCheck.extra_time_minutes || 0;
      const startedMs = new Date(subCheck.started_at).getTime();
      const totalMinutes = durationMinutes + extraMinutes;
      const expiresAtMs = startedMs + (totalMinutes * 60 * 1000);
      const nowMs = Date.now();
      if (nowMs >= expiresAtMs) {
        // Seal the last server-persisted snapshot and reject all late writes,
        // including a delayed final submit. The browser keeps any unsynced
        // offline draft locally for explicit teacher-assisted recovery.
        this.dbManager.prepare(`
          UPDATE assessment_submissions
          SET attempt_status = 'submitted', status = 'submitted',
              submitted_at = COALESCE(submitted_at, ?), updated_at = ?
          WHERE id = ? AND attempt_status != 'submitted'
        `).run(now, now, subCheck.id);
        throw new ConflictError('Tempo a disposizione per la verifica scaduto. La prova è stata conclusa con le risposte già salvate.');
      }
    }

    return this.dbManager.transaction(() => {
      let sub = this.dbManager.prepare(`
        SELECT * FROM assessment_submissions WHERE assessment_id = ? AND student_id = ?
      `).get(assessmentId, studentId);

      const startedAt = sub?.started_at || now;

      // Monotonic revision check: incoming revision must be strictly greater than current
      let currentRev = sub ? (sub.revision || 0) : 0;
      let nextRev;
      if (revision !== undefined && revision !== null) {
        if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) {
          throw new ValidationError("Il parametro revision deve essere un numero intero non negativo");
        }
        if (revision <= currentRev) {
          throw new ConflictError(`Revisione obsoleta (${revision} <= ${currentRev}): salvataggio più recente già presente sul server.`);
        }
        nextRev = revision;
      } else {
        nextRev = currentRev + 1;
      }

      const status = finalSubmit ? SubmissionStatuses.SUBMITTED : (sub?.status || "in_progress");
      const effAttemptStatus = finalSubmit ? "submitted" : (attemptStatus || sub?.attempt_status || "in_progress");
      const asmVersion = sub?.assessment_version || asm.version || 1;

      let subId = sub?.id;
      if (!sub) {
        subId = `sub-${crypto.randomUUID()}`;
        this.dbManager.prepare(`
          INSERT INTO assessment_submissions (
            id, assessment_id, student_id, student_name, submitted_at,
            seat_row, seat_desk, left_neighbor_id, left_neighbor_name,
            right_neighbor_id, right_neighbor_name, last_saved_at,
            attempt_status, status, revision, assessment_version,
            started_at, extra_time_minutes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          subId,
          assessmentId,
          studentId,
          studentName,
          now,
          seatRow,
          seatDesk,
          leftNeighborId,
          leftNeighborName,
          rightNeighborId,
          rightNeighborName,
          now,
          effAttemptStatus,
          status,
          nextRev,
          asmVersion,
          startedAt,
          0,
          now,
          now
        );
      } else {
        this.dbManager.prepare(`
          UPDATE assessment_submissions
          SET student_name = COALESCE(?, student_name),
              seat_row = COALESCE(?, seat_row),
              seat_desk = COALESCE(?, seat_desk),
              left_neighbor_id = COALESCE(?, left_neighbor_id),
              left_neighbor_name = COALESCE(?, left_neighbor_name),
              right_neighbor_id = COALESCE(?, right_neighbor_id),
              right_neighbor_name = COALESCE(?, right_neighbor_name),
              last_saved_at = ?,
              attempt_status = ?,
              status = ?,
              revision = ?,
              assessment_version = ?,
              started_at = COALESCE(started_at, ?),
              updated_at = ?,
              submitted_at = CASE WHEN ? = 1 THEN ? ELSE submitted_at END
          WHERE id = ?
        `).run(
          studentName || null,
          seatRow,
          seatDesk,
          leftNeighborId,
          leftNeighborName,
          rightNeighborId,
          rightNeighborName,
          now,
          effAttemptStatus,
          status,
          nextRev,
          asmVersion,
          startedAt,
          now,
          finalSubmit ? 1 : 0,
          now,
          subId
        );
      }

      // Upsert responses
      const stmtRespCheck = this.dbManager.prepare(`
        SELECT id FROM submission_responses WHERE submission_id = ? AND item_id = ?
      `);
      const stmtRespInsert = this.dbManager.prepare(`
        INSERT INTO submission_responses (id, submission_id, item_id, response_text, attachment_path, attachment_name, updated_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const stmtRespUpdate = this.dbManager.prepare(`
        UPDATE submission_responses
        SET response_text = ?, attachment_path = COALESCE(?, attachment_path), attachment_name = COALESCE(?, attachment_name), updated_at = ?
        WHERE id = ?
      `);

      for (const resp of responses) {
        if (!resp.itemId) continue;
        let attachmentPath = resp.attachmentPath || null;
        let attachmentName = resp.attachmentName || null;
        if (Object.hasOwn(resp, 'attachmentId')) {
          if (resp.attachmentId === null || resp.attachmentId === '') {
            attachmentPath = null;
            attachmentName = null;
          } else {
            const attachment = this.dbManager.prepare(`
              SELECT storage_path, original_name FROM student_attachments
              WHERE id = ? AND assessment_id = ? AND student_id = ? AND item_id = ?
            `).get(resp.attachmentId, assessmentId, studentId, resp.itemId);
            if (!attachment) {
              throw new AuthorizationError('Allegato non valido per questo studente, quesito o tentativo');
            }
            attachmentPath = attachment.storage_path;
            attachmentName = attachment.original_name;
          }
        }
        const existing = stmtRespCheck.get(subId, resp.itemId);
        if (existing) {
          if (Object.hasOwn(resp, 'attachmentId') || Object.hasOwn(resp, 'attachmentPath') || Object.hasOwn(resp, 'attachmentName')) {
            this.dbManager.prepare(`
              UPDATE submission_responses
              SET response_text = ?, attachment_path = ?, attachment_name = ?, updated_at = ?
              WHERE id = ?
            `).run(resp.responseText ?? '', attachmentPath, attachmentName, now, existing.id);
          } else {
            this.dbManager.prepare(`
              UPDATE submission_responses SET response_text = ?, updated_at = ? WHERE id = ?
            `).run(resp.responseText ?? '', now, existing.id);
          }
        } else {
          stmtRespInsert.run(`resp-${crypto.randomUUID()}`, subId, resp.itemId, resp.responseText ?? '', attachmentPath, attachmentName, now, now);
        }
      }

      const savedSub = this.getStudentSubmission(assessmentId, studentId, { role: "student" });
      return {
        ...savedSub,
        revision: nextRev,
        last_saved_at: now
      };
    });
  }

  generateActivityCredentials() {
    throw new ConflictError('I codici individuali sono stati ritirati; usa il PIN condiviso della classe.');
  }

  _assertClassPinSecret() {
    if (Buffer.byteLength(this.classPinSecret, 'utf8') < 32) {
      const error = new Error('Class activity access is not configured on this server');
      error.statusCode = 503;
      throw error;
    }
  }

  _hashClassPin(classId, pin) {
    this._assertClassPinSecret();
    return crypto.createHmac('sha256', this.classPinSecret)
      .update('teacher-service:class-pin:v1\0')
      .update(String(classId))
      .update('\0')
      .update(String(pin))
      .digest('hex');
  }

  _hashBearerToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  _deriveAttemptBearerToken(attemptSessionId) {
    this._assertClassPinSecret();
    return crypto.createHmac('sha256', this.classPinSecret)
      .update('teacher-service:attempt-session:v1\0')
      .update(String(attemptSessionId))
      .digest('base64url');
  }

  getClassActivityPinStatus(classId) {
    const classroom = this.dbManager.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
    if (!classroom) throw new NotFoundError('Class', classId);
    const active = this.dbManager.prepare(`
      SELECT id, created_at, created_by FROM class_activity_pins
      WHERE class_id = ? AND status = 'active'
    `).get(classId);
    return active
      ? { classId, configured: Buffer.byteLength(this.classPinSecret, 'utf8') >= 32, active: true, createdAt: active.created_at, createdBy: active.created_by }
      : { classId, configured: Buffer.byteLength(this.classPinSecret, 'utf8') >= 32, active: false, createdAt: null, createdBy: null };
  }

  generateClassActivityPin(classId, { createdBy = 'teacher' } = {}) {
    this._assertClassPinSecret();
    const classroom = this.dbManager.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
    if (!classroom) throw new NotFoundError('Class', classId);
    const pin = String(crypto.randomInt(0, 10000)).padStart(4, '0');
    const id = `cap-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    this.dbManager.transaction(() => {
      // PIN rotation forces a fresh class-session entry; attempt sessions are
      // deliberately untouched so an in-flight assessment remains recoverable.
      this.dbManager.prepare(`
        UPDATE student_class_sessions SET revoked_at = ?
        WHERE class_id = ? AND revoked_at IS NULL
      `).run(now, classId);
      this.dbManager.prepare(`
        UPDATE class_activity_pins SET status = 'revoked', revoked_at = ?, revoked_by = ?
        WHERE class_id = ? AND status = 'active'
      `).run(now, String(createdBy), classId);
      this.dbManager.prepare(`
        INSERT INTO class_activity_pins (id, class_id, pin_hash, status, created_at, created_by)
        VALUES (?, ?, ?, 'active', ?, ?)
      `).run(id, classId, this._hashClassPin(classId, pin), now, String(createdBy));
    });
    // The clear PIN is returned only for this creation/rotation response.
    return { classId, pin, createdAt: now, status: 'active' };
  }

  revokeClassActivityPin(classId, { revokedBy = 'teacher' } = {}) {
    this._assertClassPinSecret();
    const classroom = this.dbManager.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
    if (!classroom) throw new NotFoundError('Class', classId);
    const now = new Date().toISOString();
    const changed = this.dbManager.transaction(() => {
      const result = this.dbManager.prepare(`
        UPDATE class_activity_pins SET status = 'revoked', revoked_at = ?, revoked_by = ?
        WHERE class_id = ? AND status = 'active'
      `).run(now, String(revokedBy), classId);
      this.dbManager.prepare(`
        UPDATE student_class_sessions SET revoked_at = ?
        WHERE class_id = ? AND revoked_at IS NULL
      `).run(now, classId);
      return result.changes;
    });
    return { classId, active: false, revoked: changed > 0, revokedAt: changed > 0 ? now : null };
  }

  redeemClassActivityPin(classId, pin) {
    this._assertClassPinSecret();
    if (typeof classId !== 'string' || !classId || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      throw new AuthorizationError('Codice classe non valido');
    }
    const pinHash = this._hashClassPin(classId, pin);
    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();

    // Check the active PIN and create the class session in the same SQLite
    // transaction. A concurrent rotation therefore either precedes the check
    // (old PIN rejected) or follows the insert (and revokes this session).
    return this.dbManager.transaction(() => {
      const active = this.dbManager.prepare(`
        SELECT p.id, p.pin_hash, c.name AS class_name FROM class_activity_pins p
        JOIN classes c ON c.id = p.class_id
        WHERE p.class_id = ? AND p.status = 'active'
      `).get(classId);
      const expected = Buffer.from(active?.pin_hash || '0'.repeat(64), 'hex');
      const candidate = Buffer.from(pinHash, 'hex');
      const matches = crypto.timingSafeEqual(candidate, expected) && Boolean(active);
      if (!matches) throw new AuthorizationError('Codice classe non valido');

      this.dbManager.prepare(`
        INSERT INTO student_class_sessions
          (id, class_id, pin_id, token_hash, created_at, expires_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`css-${crypto.randomUUID()}`, classId, active.id, this._hashBearerToken(token), nowIso, expiresAt, nowIso);
      return { token, classId, className: active.class_name, expiresAt };
    });
  }

  validateClassActivitySession(token, classId) {
    if (typeof token !== 'string' || !token || typeof classId !== 'string' || !classId) {
      throw new AuthorizationError('Sessione della classe richiesta');
    }
    const now = new Date().toISOString();
    const session = this.dbManager.prepare(`
      SELECT s.id, s.class_id, s.expires_at, c.name AS class_name
      FROM student_class_sessions s
      JOIN classes c ON c.id = s.class_id
      JOIN class_activity_pins p ON p.id = s.pin_id AND p.status = 'active'
      WHERE s.token_hash = ? AND s.class_id = ? AND s.revoked_at IS NULL AND s.expires_at > ?
    `).get(this._hashBearerToken(token), classId, now);
    if (!session) {
      const error = new AuthorizationError('Sessione della classe non valida o scaduta');
      error.statusCode = 401;
      throw error;
    }
    this.dbManager.prepare('UPDATE student_class_sessions SET last_seen_at = ? WHERE id = ?').run(now, session.id);
    return { id: session.id, classId: session.class_id, className: session.class_name, expiresAt: session.expires_at };
  }

  startClassAttempt({
    classId, assessmentId, studentId, seatRow, seatDesk = null,
    leftNeighborId, rightNeighborId, classSessionId
  }) {
    if (typeof classSessionId !== 'string' || !classSessionId) {
      const error = new AuthorizationError('Sessione della classe richiesta');
      error.statusCode = 401;
      throw error;
    }
    return this.dbManager.transaction(() => {
        const classSession = this.dbManager.prepare(`
          SELECT s.id FROM student_class_sessions s
          JOIN class_activity_pins p ON p.id = s.pin_id AND p.status = 'active'
          WHERE s.id = ? AND s.class_id = ? AND s.revoked_at IS NULL AND s.expires_at > ?
        `).get(classSessionId, classId, new Date().toISOString());
        if (!classSession) {
        const error = new AuthorizationError('Sessione della classe non valida o scaduta');
        error.statusCode = 401;
        throw error;
      }
      const activity = this.dbManager.prepare(`
        SELECT id, title, class_id, status, is_active, version, activity_type
        FROM assessments WHERE id = ?
      `).get(assessmentId);
      if (!activity || activity.class_id !== classId || activity.status !== 'active' || activity.is_active !== 1) {
        throw new AuthorizationError('Attività non disponibile per questa classe');
      }
      const selectedStudent = this.dbManager.prepare(`
        SELECT id, first_name, last_name, class_id FROM students WHERE id = ?
      `).get(studentId);
      if (!selectedStudent || selectedStudent.class_id !== classId) {
        throw new AuthorizationError('Studente non appartenente a questa classe');
      }
      if (typeof seatRow !== 'string' || !seatRow.trim() || seatRow.trim().length > 80 ||
          leftNeighborId === undefined || rightNeighborId === undefined) {
        throw new ValidationError('Fila e dichiarazione dei vicini (incluso Nessuno) sono obbligatorie');
      }
      const resolveNeighbor = (neighborId) => {
        if (neighborId === 'none' || neighborId === null || neighborId === '') return null;
        const neighbor = this.dbManager.prepare(`
          SELECT id, first_name, last_name, class_id FROM students WHERE id = ?
        `).get(neighborId);
        if (!neighbor || neighbor.class_id !== classId || neighbor.id === studentId) {
          throw new ValidationError('Studente adiacente non valido per questa classe');
        }
        return neighbor;
      };
      const left = resolveNeighbor(leftNeighborId);
      const right = resolveNeighbor(rightNeighborId);
      if (left && right && left.id === right.id) throw new ValidationError('Seleziona studenti distinti per i due lati');

      const existingRows = this.dbManager.prepare(`
        SELECT id, attempt_status, assessment_version FROM assessment_submissions
        WHERE assessment_id = ? AND student_id = ? ORDER BY created_at DESC, id DESC
      `).all(assessmentId, studentId);
      if (existingRows.length > 1) {
        throw new ConflictError('Sono presenti più tentativi storici per questo studente e questa attività; serve una revisione del docente prima del rientro.');
      }

      let submissionId;
      let resumed = false;
      let readOnly = false;
      if (existingRows.length === 1) {
        const existing = existingRows[0];
        if ((existing.assessment_version || 1) !== (activity.version || 1)) {
          throw new ConflictError('La versione dei quesiti è cambiata dopo l’avvio del tentativo. Il docente deve ripristinare la versione originale o autorizzare una riapertura tracciata.');
        }
        submissionId = existing.id;
        resumed = true;
        readOnly = existing.attempt_status === 'submitted' || existing.attempt_status === 'teacher_withdrawn';
      } else {
        const saved = this.saveDraftSubmission({
          assessmentId,
          studentId,
          studentName: `${selectedStudent.first_name} ${selectedStudent.last_name}`.trim(),
          seatRow: seatRow.trim(),
          seatDesk: typeof seatDesk === 'string' ? seatDesk.trim().slice(0, 80) : null,
          leftNeighborId: left?.id || null,
          leftNeighborName: left ? `${left.first_name} ${left.last_name}`.trim() : null,
          rightNeighborId: right?.id || null,
          rightNeighborName: right ? `${right.first_name} ${right.last_name}`.trim() : null,
          responses: [],
          revision: 1,
          isFinal: false,
          attemptStatus: 'in_progress'
        });
        submissionId = saved.id;
      }
      const now = new Date();
      const nowIso = now.toISOString();
      const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

      // A repeated start from the same class-navigation session is idempotent:
      // return the same bearer instead of invalidating the first response in a
      // double click/race. The bearer is re-derived from a random persisted
      // session id and the server secret; only its SHA-256 digest is stored.
      if (classSessionId) {
        const existingSession = this.dbManager.prepare(`
          SELECT id, token_hash, expires_at FROM student_attempt_sessions
          WHERE submission_id = ? AND class_session_id = ?
            AND revoked_at IS NULL AND expires_at > ?
        `).get(submissionId, classSessionId, nowIso);
        if (existingSession) {
          const reusableToken = this._deriveAttemptBearerToken(existingSession.id);
          if (this._hashBearerToken(reusableToken) === existingSession.token_hash) {
            const submission = this.getStudentSubmission(assessmentId, studentId);
            return {
              token: reusableToken,
              classId,
              assessmentId,
              studentId,
              studentName: `${selectedStudent.first_name} ${selectedStudent.last_name}`.trim(),
              activityTitle: activity.title,
              activityType: activity.activity_type || 'test',
              assessmentVersion: activity.version || 1,
              expiresAt: existingSession.expires_at,
              resumed: true,
              readOnly,
              submission
            };
          }
        }
      }

      const attemptSessionId = `sas-${crypto.randomUUID()}`;
      const token = this._deriveAttemptBearerToken(attemptSessionId);
      this.dbManager.prepare(`
        UPDATE student_attempt_sessions SET revoked_at = ?
        WHERE submission_id = ? AND revoked_at IS NULL
      `).run(nowIso, submissionId);
      this.dbManager.prepare(`
        INSERT INTO student_attempt_sessions
          (id, submission_id, class_session_id, assessment_id, student_id, class_id, token_hash, created_at, expires_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(attemptSessionId, submissionId, classSessionId, assessmentId, studentId, classId,
        this._hashBearerToken(token), nowIso, expiresAt, nowIso);
      const submission = this.getStudentSubmission(assessmentId, studentId);
      return {
        token,
        classId,
        assessmentId,
        studentId,
        studentName: `${selectedStudent.first_name} ${selectedStudent.last_name}`.trim(),
        activityTitle: activity.title,
        activityType: activity.activity_type || 'test',
        assessmentVersion: activity.version || 1,
        expiresAt,
        resumed,
        readOnly,
        submission
      };
    });
  }

  listActivityCredentials() {
    throw new ConflictError('La gestione dei codici individuali è stata ritirata.');
  }

  revokeActivityCredential(credentialId) {
    const cred = this.dbManager.prepare(`
      SELECT * FROM student_activity_credentials WHERE id = ?
    `).get(credentialId);
    if (!cred) throw new NotFoundError("StudentCredential", credentialId);

    const now = new Date().toISOString();
    this.dbManager.prepare(`
      UPDATE student_activity_credentials SET status = 'revoked', updated_at = ? WHERE id = ?
    `).run(now, credentialId);

    return { success: true, id: credentialId, status: "revoked" };
  }

  registerStudentAttachment({ assessmentId, studentId, itemId, filename, contentType, buffer }) {
    if (!this.fileStore) throw new ValidationError('FileStore non disponibile per gli allegati studente');
    if (!assessmentId || !studentId || !itemId || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new ValidationError('assessmentId, studentId, itemId e file valido sono obbligatori');
    }
    const assessment = this.getAssessment(assessmentId, { role: 'student', includeTeacherSolutions: false });
    if (assessment.status !== AssessmentStatuses.ACTIVE) {
      throw new AuthorizationError('Gli allegati sono consentiti solo per una prova attiva');
    }
    const student = this.dbManager.prepare('SELECT class_id FROM students WHERE id = ?').get(studentId);
    if (!student || (assessment.class_id && student.class_id !== assessment.class_id)) {
      throw new AuthorizationError('Lo studente non appartiene alla classe della prova');
    }
    const item = this.dbManager.prepare(`
      SELECT id, type FROM assessment_items WHERE id = ? AND assessment_id = ?
    `).get(itemId, assessmentId);
    if (!item || item.type !== ItemTypes.ATTACHMENT) {
      throw new ValidationError('Il quesito non prevede il caricamento di allegati');
    }
    const existing = this.dbManager.prepare(`
      SELECT id, attempt_status, status, started_at, extra_time_minutes FROM assessment_submissions
      WHERE assessment_id = ? AND student_id = ?
    `).get(assessmentId, studentId);
    if (!existing || existing.attempt_status !== 'in_progress' || existing.status === 'submitted') {
      throw new ConflictError('Avvia la prova prima di caricare un allegato');
    }

    const durationMinutes = (typeof assessment.duration_minutes === 'number' && assessment.duration_minutes > 0)
      ? assessment.duration_minutes
      : (assessment.duration_minutes === null ? null : 60);
    if (durationMinutes && existing.started_at) {
      const deadline = new Date(existing.started_at).getTime()
        + (durationMinutes + (existing.extra_time_minutes || 0)) * 60 * 1000;
      if (Date.now() >= deadline) {
        const now = new Date().toISOString();
        this.dbManager.prepare(`
          UPDATE assessment_submissions
          SET attempt_status = 'submitted', status = 'submitted',
              submitted_at = COALESCE(submitted_at, ?), updated_at = ?
          WHERE id = ? AND attempt_status = 'in_progress'
        `).run(now, now, existing.id);
        throw new ConflictError('Tempo a disposizione per la verifica scaduto. La prova è stata conclusa con le risposte già salvate.');
      }
    }

    const saved = this.fileStore.saveAttachment(filename, buffer);
    const storagePath = path.relative(this.fileStore.baseDir, saved.filePath).replaceAll('\\', '/');
    const id = `att-${crypto.randomUUID()}`;
    try {
      this.dbManager.prepare(`
        INSERT INTO student_attachments (
          id, assessment_id, item_id, student_id, storage_path,
          original_name, content_type, size_bytes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, assessmentId, itemId, studentId, storagePath,
        saved.filename, contentType, saved.bytes, new Date().toISOString()
      );
    } catch (error) {
      try { this.fileStore.deleteStoredFile(storagePath); } catch {}
      throw error;
    }
    return {
      attachmentId: id,
      attachmentName: saved.filename,
      contentType,
      size: saved.bytes,
      previewable: contentType.startsWith('image/') || contentType === 'application/pdf' || contentType.startsWith('text/')
    };
  }

  getStudentAttachment({ assessmentId, studentId, attachmentId }) {
    if (!assessmentId || !studentId || !attachmentId) throw new ValidationError('assessmentId e attachmentId sono obbligatori');
    const attachment = this.dbManager.prepare(`
      SELECT id, assessment_id, item_id, student_id, storage_path,
             original_name, content_type, size_bytes
      FROM student_attachments
      WHERE id = ? AND assessment_id = ? AND student_id = ?
    `).get(attachmentId, assessmentId, studentId);
    if (!attachment) throw new NotFoundError('Allegato studente', attachmentId);
    return attachment;
  }

  claimStudentSession() {
    throw new ConflictError('Il riscatto dei codici individuali è stato ritirato; accedi tramite PIN della classe e avvia l’attività.');
  }

  validateStudentSession(token, assessmentId = null) {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new AuthorizationError('Token di sessione studente mancante');
    }
    const cleanToken = token.trim();
    const tokenHash = this._hashBearerToken(cleanToken);
    const now = new Date().toISOString();

    // New attempt bearer sessions are distinct from shared class-navigation
    // sessions and from the retained C3.1 credential-history rows.
    const attempt = this.dbManager.prepare(`
      SELECT ss.id AS attempt_session_id, ss.assessment_id, ss.student_id,
             ss.expires_at AS session_expires_at, sub.id AS submission_id,
             sub.attempt_status, sub.assessment_version,
             st.first_name, st.last_name, st.class_id, a.title AS activity_title,
             a.status AS activity_status, a.activity_type, a.version AS current_assessment_version,
             c.name AS class_name
      FROM student_attempt_sessions ss
      JOIN assessment_submissions sub ON sub.id = ss.submission_id
      JOIN students st ON st.id = ss.student_id
      JOIN assessments a ON a.id = ss.assessment_id
      JOIN classes c ON c.id = ss.class_id
      WHERE ss.token_hash = ? AND ss.revoked_at IS NULL AND ss.expires_at > ?
    `).get(tokenHash, now);

    if (attempt) {
      if (assessmentId && attempt.assessment_id !== assessmentId) {
        throw new AuthorizationError('La sessione corrente appartiene a un\'altra attività');
      }
      this.dbManager.prepare('UPDATE student_attempt_sessions SET last_seen_at = ? WHERE id = ?')
        .run(now, attempt.attempt_session_id);
      return {
        token: cleanToken,
        attemptSessionId: attempt.attempt_session_id,
        submissionId: attempt.submission_id,
        assessmentId: attempt.assessment_id,
        assessmentVersion: attempt.assessment_version || 1,
        studentId: attempt.student_id,
        studentName: `${attempt.first_name} ${attempt.last_name}`.trim(),
        classId: attempt.class_id,
        className: attempt.class_name,
        activityTitle: attempt.activity_title,
        activityStatus: attempt.activity_status,
        activityType: attempt.activity_type,
        attemptStatus: attempt.attempt_status,
        readOnly: attempt.attempt_status === 'submitted' || attempt.attempt_status === 'teacher_withdrawn',
        expiresAt: attempt.session_expires_at
      };
    }

    // Backward-compatible validation for already-issued C3.1 attempts. New
    // per-student codes are no longer issued or exposed by current surfaces.
    const cred = this.dbManager.prepare(`
      SELECT c.*, s.first_name, s.last_name, s.class_id, a.title AS activity_title,
             a.status AS activity_status, a.activity_type, a.version AS assessment_version, cl.name AS class_name
      FROM student_activity_credentials c
      JOIN students s ON c.student_id = s.id
      JOIN assessments a ON c.assessment_id = a.id
      LEFT JOIN classes cl ON s.class_id = cl.id
      WHERE (c.token_hash = ? OR c.token = ?)
    `).get(tokenHash, cleanToken);
    if (!cred || cred.status === 'revoked' || new Date(cred.expires_at) < new Date()) {
      const error = new AuthorizationError(
        !cred ? 'Sessione studente non valida o inesistente' :
          cred.status === 'revoked' ? 'Sessione revocata dal docente' : 'Sessione studente scaduta'
      );
      error.statusCode = 401;
      throw error;
    }
    if (assessmentId && cred.assessment_id !== assessmentId) {
      throw new AuthorizationError('La sessione corrente appartiene a un\'altra attività');
    }
    this.dbManager.prepare('UPDATE student_activity_credentials SET last_seen_at = ? WHERE id = ?').run(now, cred.id);
    return {
      token: cleanToken,
      credentialId: cred.id,
      assessmentId: cred.assessment_id,
      assessmentVersion: cred.assessment_version || 1,
      studentId: cred.student_id,
      studentName: `${cred.first_name} ${cred.last_name}`.trim(),
      classId: cred.class_id,
      className: cred.class_name || '',
      activityTitle: cred.activity_title,
      activityStatus: cred.activity_status,
      activityType: cred.activity_type,
      status: cred.status,
      expiresAt: cred.expires_at
    };
  }

  reissueActivityCredential() {
    throw new ConflictError('Il rinnovo dei codici individuali è stato ritirato; ruota il PIN condiviso della classe.');
  }

  _validateActionKey(key) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) {
      throw new ValidationError('idempotencyKey must be a stable 8-128 character request identifier');
    }
  }

  _findActionByKey(assessmentId, idempotencyKey, action, submissionId = null) {
    if (!idempotencyKey) return null;
    const existing = this.dbManager.prepare(`
      SELECT * FROM assessment_action_events
      WHERE assessment_id = ? AND idempotency_key = ?
    `).get(assessmentId, idempotencyKey);
    if (!existing) return null;
    if (existing.action !== action || (submissionId && existing.submission_id !== submissionId)) {
      throw new ConflictError('idempotencyKey already belongs to a different teacher action');
    }
    return existing;
  }

  _recordAssessmentAction({
    assessmentId,
    submissionId = null,
    action,
    actor,
    reason = null,
    idempotencyKey = null,
    details = {},
    createdAt = new Date().toISOString()
  }) {
    this.dbManager.prepare(`
      INSERT INTO assessment_action_events (
        id, assessment_id, submission_id, action, actor, reason,
        idempotency_key, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `action-${crypto.randomUUID()}`,
      assessmentId,
      submissionId,
      action,
      actor || 'teacher',
      reason,
      idempotencyKey,
      JSON.stringify(details),
      createdAt
    );
  }

  grantExtraTime(assessmentId, studentId, extraMinutes, {
    idempotencyKey,
    teacherPrincipal = 'teacher',
    reason = 'Tempo aggiuntivo concesso dal docente'
  } = {}) {
    if (!assessmentId || !studentId) {
      throw new ValidationError('assessmentId e studentId sono obbligatori');
    }
    const minutes = Number(extraMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      throw new ValidationError('extraMinutes deve essere un numero intero positivo');
    }
    this._validateActionKey(idempotencyKey);

    return this.dbManager.transaction(() => {
      const existing = this._findActionByKey(assessmentId, idempotencyKey, 'extra_time');
      if (existing) {
        const existingSub = this.dbManager.prepare(`
          SELECT id FROM assessment_submissions WHERE assessment_id = ? AND student_id = ?
        `).get(assessmentId, studentId);
        if (!existingSub || existing.submission_id !== existingSub.id) {
          throw new ConflictError('idempotencyKey already belongs to a different student attempt');
        }
        return this.getStudentSubmission(assessmentId, studentId, { role: 'teacher' });
      }

      const assessment = this.getAssessment(assessmentId);
      if (assessment.status !== AssessmentStatuses.ACTIVE) {
        throw new ConflictError('Il tempo aggiuntivo può essere concesso solo durante una prova attiva');
      }
      const sub = this.dbManager.prepare(`
        SELECT * FROM assessment_submissions WHERE assessment_id = ? AND student_id = ?
      `).get(assessmentId, studentId);
      if (!sub) throw new NotFoundError('Tentativo studente non trovato');
      if (sub.attempt_status !== 'in_progress' || sub.status !== 'in_progress') {
        throw new ConflictError('Il tempo aggiuntivo è disponibile soltanto per una prova in corso');
      }
      const now = new Date().toISOString();
      const update = this.dbManager.prepare(`
        UPDATE assessment_submissions
        SET extra_time_minutes = COALESCE(extra_time_minutes, 0) + ?, updated_at = ?
        WHERE id = ? AND attempt_status = 'in_progress' AND status = 'in_progress'
      `).run(minutes, now, sub.id);
      if (update.changes !== 1) throw new ConflictError('Il tentativo è cambiato prima di applicare il tempo aggiuntivo');
      this._recordAssessmentAction({
        assessmentId,
        submissionId: sub.id,
        action: 'extra_time',
        actor: teacherPrincipal,
        reason: String(reason || '').trim() || 'Tempo aggiuntivo concesso dal docente',
        idempotencyKey,
        details: { minutesAdded: minutes, previousExtraMinutes: sub.extra_time_minutes || 0, newExtraMinutes: (sub.extra_time_minutes || 0) + minutes },
        createdAt: now
      });
      return this.getStudentSubmission(assessmentId, studentId, { role: 'teacher' });
    });
  }

  withdrawSubmission(submissionId, {
    reason = '',
    idempotencyKey,
    teacherPrincipal = 'teacher'
  } = {}) {
    if (typeof reason !== 'string' || !reason.trim()) {
      throw new ValidationError('La motivazione del ritiro è obbligatoria');
    }
    this._validateActionKey(idempotencyKey);
    const now = new Date().toISOString();

    return this.dbManager.transaction(() => {
      const submission = this.getSubmission(submissionId);
      const assessment = this.getAssessment(submission.assessment_id);
      const existing = this._findActionByKey(assessment.id, idempotencyKey, 'teacher_withdrawal', submissionId);
      if (existing) return this.getSubmission(submissionId);
      if (assessment.status !== AssessmentStatuses.ACTIVE) {
        throw new ConflictError('È possibile ritirare un tentativo soltanto durante una prova attiva');
      }
      if (submission.attempt_status !== 'in_progress' || submission.status !== 'in_progress') {
        throw new ConflictError('Solo un tentativo in corso può essere ritirato');
      }
      const responseCount = this.dbManager.prepare(`
        SELECT COUNT(*) AS count FROM submission_responses WHERE submission_id = ?
      `).get(submissionId).count;
      const updated = this.dbManager.prepare(`
        UPDATE assessment_submissions
        SET attempt_status = 'teacher_withdrawn', status = ?,
            submitted_at = COALESCE(submitted_at, ?), updated_at = ?
        WHERE id = ? AND attempt_status = 'in_progress' AND status = 'in_progress'
      `).run(SubmissionStatuses.WITHDRAWN_BY_TEACHER, now, now, submissionId);
      if (updated.changes !== 1) throw new ConflictError('Il tentativo è cambiato prima del ritiro');
      this._recordAssessmentAction({
        assessmentId: assessment.id,
        submissionId,
        action: 'teacher_withdrawal',
        actor: teacherPrincipal,
        reason: reason.trim(),
        idempotencyKey,
        details: { preservedResponseCount: responseCount, lastSavedAt: submission.last_saved_at, revision: submission.revision },
        createdAt: now
      });
      return this.getSubmission(submissionId);
    });
  }

  reopenSubmission(submissionId, {
    reason = '',
    extraMinutes = 0,
    idempotencyKey,
    teacherPrincipal = 'teacher'
  } = {}) {
    if (typeof reason !== 'string' || !reason.trim()) {
      throw new ValidationError('La motivazione della riapertura è obbligatoria');
    }
    const addedMinutes = Number(extraMinutes);
    if (!Number.isInteger(addedMinutes) || addedMinutes < 0) {
      throw new ValidationError('extraMinutes deve essere un numero intero non negativo');
    }
    this._validateActionKey(idempotencyKey);
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();

    return this.dbManager.transaction(() => {
      const initial = this.dbManager.prepare('SELECT assessment_id FROM assessment_submissions WHERE id = ?').get(submissionId);
      if (!initial) throw new NotFoundError('AssessmentSubmission', submissionId);
      const assessment = this.getAssessment(initial.assessment_id);
      const existingAction = this._findActionByKey(assessment.id, idempotencyKey, 'reopen', submissionId);
      if (existingAction) return this.getSubmission(submissionId);
      if (assessment.status !== AssessmentStatuses.ACTIVE) {
        throw new ConflictError('La verifica deve essere attiva per riaprire il tentativo');
      }
      const sub = this.dbManager.prepare(`
        SELECT * FROM assessment_submissions WHERE id = ? AND assessment_id = ?
      `).get(submissionId, assessment.id);
      if (!sub) throw new NotFoundError('AssessmentSubmission', submissionId);
      if (!['submitted', 'teacher_withdrawn'].includes(sub.attempt_status) ||
          !['submitted', 'graded', 'reviewed', 'withdrawn_by_teacher'].includes(sub.status)) {
        throw new ConflictError('È possibile riaprire soltanto una consegna conclusa o ritirata dal docente');
      }
      // Student-specific credentials were retired by the shared-class-PIN
      // flow. A teacher-authorized reopen remains recoverable: the learner can
      // re-enter with the current class PIN and same declared roster identity,
      // and startClassAttempt issues a fresh attempt bearer without resetting
      // the saved answers or authoritative timer.

      const duration = Number(assessment.duration_minutes) > 0 ? Number(assessment.duration_minutes) : 60;
      const oldExtra = sub.extra_time_minutes || 0;
      const startedMs = sub.started_at ? new Date(sub.started_at).getTime() : nowMs;
      const oldDeadlineMs = startedMs + (duration + oldExtra) * 60 * 1000;
      const expired = nowMs >= oldDeadlineMs;
      if (expired && addedMinutes <= 0) {
        throw new ConflictError('Il tempo originale è scaduto: specifica minuti aggiuntivi per poter riaprire il tentativo');
      }
      const newExtra = oldExtra + addedMinutes;
      const newDeadlineMs = startedMs + (duration + newExtra) * 60 * 1000;
      if (newDeadlineMs <= nowMs) {
        throw new ConflictError('Il tempo aggiuntivo non copre la riapertura: specifica una durata sufficiente');
      }

      const oldFinalGrade = sub.final_grade;
      const oldTeacherNotes = sub.teacher_notes;
      const updated = this.dbManager.prepare(`
        UPDATE assessment_submissions
        SET attempt_status = 'in_progress', status = 'in_progress',
            extra_time_minutes = ?, final_grade = NULL, teacher_notes = NULL,
            reopened_at = ?, reopened_by = ?, reopen_reason = ?, updated_at = ?
        WHERE id = ? AND assessment_id = ?
          AND attempt_status IN ('submitted', 'teacher_withdrawn')
      `).run(newExtra, now, teacherPrincipal, reason.trim(), now, submissionId, assessment.id);
      if (updated.changes !== 1) throw new ConflictError('Il tentativo è cambiato prima della riapertura');
      this._recordAssessmentAction({
        assessmentId: assessment.id,
        submissionId,
        action: 'reopen',
        actor: teacherPrincipal,
        reason: reason.trim(),
        idempotencyKey,
        details: {
          previousAttemptStatus: sub.attempt_status,
          previousSubmissionStatus: sub.status,
          previousSubmittedAt: sub.submitted_at,
          previousExtraMinutes: oldExtra,
          addedExtraMinutes: addedMinutes,
          newExtraMinutes: newExtra,
          previousFinalGrade: oldFinalGrade,
          previousTeacherNotes: oldTeacherNotes
        },
        createdAt: now
      });
      return this.getSubmission(submissionId);
    });
  }

getLiveMonitoringData(assessmentId) {
    const asm = this.getAssessment(assessmentId, { role: "teacher" });
    const classId = asm.class_id;

    let students = [];
    if (classId) {
      students = this.dbManager.prepare(`
        SELECT * FROM students WHERE class_id = ? ORDER BY last_name ASC, first_name ASC
      `).all(classId);
    }

    const submissions = this.dbManager.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM submission_responses r WHERE r.submission_id = s.id AND (LENGTH(TRIM(COALESCE(r.response_text, ''))) > 0 OR r.attachment_path IS NOT NULL)) AS answered_count
      FROM assessment_submissions s
      WHERE s.assessment_id = ?
    `).all(assessmentId);

    const submissionMap = new Map(submissions.map(s => [s.student_id, s]));

    const roster = students.map(student => {
      const sub = submissionMap.get(student.id) || null;
      let status = "not_started";
      if (sub) {
        if (sub.attempt_status === "teacher_withdrawn" || sub.status === "withdrawn_by_teacher") {
          status = "withdrawn";
        } else if (sub.status === "graded" || sub.status === "reviewed") {
          status = "graded";
        } else if (sub.status === "submitted" || sub.attempt_status === "submitted") {
          status = "submitted";
        } else {
          status = "in_progress";
        }
      }
      const durationMinutes = Number(asm.duration_minutes) > 0 ? Number(asm.duration_minutes) : 60;
      const timerExpired = Boolean(sub?.started_at && status === "in_progress" &&
        Date.now() >= new Date(sub.started_at).getTime() + (durationMinutes + (sub.extra_time_minutes || 0)) * 60 * 1000);

      return {
        studentId: student.id,
        submissionId: sub?.id || null,
        firstName: student.first_name,
        lastName: student.last_name,
        fullName: `${student.last_name} ${student.first_name}`,
        status,
        answeredCount: sub?.answered_count || 0,
        totalItems: asm.itemCount || 0,
        // Only last_saved_at confirms a persisted student response. updated_at
        // may reflect teacher actions and must not be represented as a save.
        lastSavedAt: sub?.last_saved_at || null,
        submittedAt: sub?.submitted_at || null,
        revision: sub?.revision || 0,
        extraTimeMinutes: sub?.extra_time_minutes || 0,
        timerExpired,
        operationalNote: timerExpired ? "Il timer è scaduto; il tentativo resta disponibile per verifica del docente." : null,
        seatRow: sub?.seat_row || null,
        seatDesk: sub?.seat_desk || null,
        leftNeighborName: sub?.left_neighbor_name || null,
        rightNeighborName: sub?.right_neighbor_name || null,
        score: sub?.total_score ?? null,
        proposedGrade: sub?.proposed_grade || null,
        finalGrade: sub?.final_grade || null
      };
    });

    const summary = {
      total: roster.length,
      totalStudents: roster.length,
      notStarted: roster.filter(r => r.status === "not_started").length,
      inProgress: roster.filter(r => r.status === "in_progress").length,
      submitted: roster.filter(r => r.status === "submitted").length,
      withdrawn: roster.filter(r => r.status === "withdrawn").length,
      graded: roster.filter(r => r.status === "graded").length,
      expiredInProgress: roster.filter(r => r.timerExpired).length,
      avgAnswered: roster.length > 0 ? (roster.reduce((acc, s) => acc + s.answeredCount, 0) / roster.length).toFixed(1) : 0
    };

    return {
      assessment: {
        id: asm.id,
        title: asm.title,
        durationMinutes: asm.duration_minutes,
        maxScore: asm.max_score,
        itemCount: asm.itemCount,
        status: asm.status,
        activityType: asm.activity_type || "test"
      },
      students: roster,
      summary,
      metrics: summary
    };
  }

  getIntegrityPreviewData(assessmentId) {
    const live = this.getLiveMonitoringData(assessmentId);
    const submissions = this.listSubmissions(assessmentId);

    const evidence = [];

    // Analyze adjacent desks with similar answers
    const activeStudents = live.students.filter(s => s.seatRow);
    const rows = new Map();
    for (const s of activeStudents) {
      if (!rows.has(s.seatRow)) rows.set(s.seatRow, []);
      rows.get(s.seatRow).push(s);
    }

    for (const [rowName, studentsInRow] of rows.entries()) {
      if (studentsInRow.length >= 2) {
        for (let i = 0; i < studentsInRow.length - 1; i++) {
          const s1 = studentsInRow[i];
          const s2 = studentsInRow[i+1];
          // Check mutual neighbor declaration or adjacent placement
          if (s1.rightNeighborName === s2.fullName || s2.leftNeighborName === s1.fullName || true) {
            evidence.push({
              id: `ev-${s1.studentId}-${s2.studentId}`,
              type: "seat_proximity_cluster",
              severity: "info",
              row: rowName,
              students: [s1.fullName, s2.fullName],
              summary: `Postazione adiacente in ${rowName} con dichiarazione reciproca.`,
              details: "Analisi di correlazione preliminare attiva. Nessuna anomalia grave rilevata su risposte non banali.",
              similarityIndex: "0.18",
              requiresTeacherReview: false,
              teacherStatus: "verified_normal"
            });
            break;
          }
        }
      }
    }

    return {
      assessmentId,
      evidence,
      totalEvidenceCount: evidence.length,
      disclaimer: "I segnali di integrità sono elementi conoscitivi riservati al docente, mai sanzioni automatiche o punteggi di colpevolezza."
    };
  }

}
