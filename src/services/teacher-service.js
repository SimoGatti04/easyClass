import crypto from 'node:crypto';
/**
 * Teacher Service — Unified Application Facade
 *
 * Coordinates:
 * - OrganizationService (Classes, Subjects, Lessons, Collections)
 * - MaterialService (Materials CRUD, Versioning, FTS5 Search, Assessable Authorizations)
 * - AiRuleService (AI Operational Rules, Contextual Inheritance, Dossier 09)
 * - SourceService (Internal & External Sources, Dossier 04)
 * - FileService (Real attachment import with PDF/DOCX parsers, multi-format exports)
 * - AssessmentService (Assessments, Blueprint, Protected solutions, Grading, Dossier 05/06)
 * - GenerationService (AI pedagogical workflows via OmniRoute)
 */
import { DatabaseManager, createProductionDatabase } from '../db/database.js';
import { FileStore } from '../storage/filestore.js';
import { OrganizationService } from './organization-service.js';
import { MaterialService } from './material-service.js';
import { OmniRouteClient } from '../ai/omniroute-client.js';
import { WebResearchClient } from '../ai/web-research-client.js';
import { ValidationError, ConflictError } from '../core/errors.js';
import { AiRuleService } from './ai-rule-service.js';
import { SourceService } from './source-service.js';
import { FileService } from './file-service.js';
import { AssessmentService } from './assessment-service.js';
import { GenerationService } from './generation-service.js';

export class TeacherService {
  /**
   * @param {Object} [options]
   * @param {DatabaseManager} [options.dbManager]
   * @param {FileStore} [options.fileStore]
   * @param {OmniRouteClient} [options.omniRouteClient]
   * @param {boolean} [options.mockAi]
   */
  constructor({
    dbManager = null,
    fileStore = null,
    omniRouteClient = null,
    webResearchClient = null,
    mockAi = false,
    fileServiceOptions = {}
  } = {}) {
    this.dbManager = dbManager || createProductionDatabase();
    this.fileStore = fileStore || new FileStore();
    this.org = new OrganizationService(this.dbManager);
    this.materials = new MaterialService(this.dbManager, this.fileStore, this.org);
    const mockEnabled = Boolean(mockAi || process.env.TEACHER_SERVICE_MOCK_AI === 'true');
    if (mockEnabled && process.env.NODE_ENV === 'production') {
      throw new ValidationError('Mock AI generation is prohibited in production');
    }
    this.ai = omniRouteClient || new OmniRouteClient({ mockOffline: mockEnabled });
    this.aiRules = new AiRuleService(this.dbManager, this.org);
    this.webResearch = webResearchClient || new WebResearchClient();
    this.sources = new SourceService(this.dbManager, this.materials, this.org, this.webResearch);
    this.fileService = new FileService(this.materials, this.fileStore, fileServiceOptions);
    this.assessments = new AssessmentService(this.dbManager, this.materials, this.ai, this.aiRules);
    this.generation = new GenerationService(this.ai, this.materials, this.org, this.aiRules, this.assessments, this.sources);
    this._activeArtifactLocks = new Set();
  }

  /* -------------------------------------------------------------------------- */
  /* ORGANIZATION                                                               */
  /* -------------------------------------------------------------------------- */

  createClass(data) { return this.org.createClass(data); }
  listClasses() { return this.org.listClasses(); }
  getClass(id) { return this.org.getClass(id); }
  updateClass(id, data) { return this.org.updateClass(id, data); }
  deleteClass(id) { return this.org.deleteClass(id); }

  createSubject(data) { return this.org.createSubject(data); }
  listSubjects(filter) { return this.org.listSubjects(filter); }
  getSubject(id) { return this.org.getSubject(id); }
  updateSubject(id, data) { return this.org.updateSubject(id, data); }
  deleteSubject(id) { return this.org.deleteSubject(id); }

  createLesson(data) { return this.org.createLesson(data); }
  listLessons(filter) { return this.org.listLessons(filter); }
  getLesson(id) { return this.org.getLesson(id); }
  updateLesson(id, data) { return this.org.updateLesson(id, data); }
  deleteLesson(id) { return this.org.deleteLesson(id); }

  createCollection(data) { return this.org.createCollection(data); }
  listCollections(filter) { return this.org.listCollections(filter); }
  getCollection(id) { return this.org.getCollection(id); }
  addResourceToCollection(colId, resId) { return this.org.addResourceToCollection(colId, resId); }
  removeResourceFromCollection(colId, resId) { return this.org.removeResourceFromCollection(colId, resId); }
  listCollectionResources(colId) { return this.org.listCollectionResources(colId); }
  updateCollection(id, data) { return this.org.updateCollection(id, data); }
  deleteCollection(id) { return this.org.deleteCollection(id); }

  /* -------------------------------------------------------------------------- */
  /* MATERIALS                                                                  */
  /* -------------------------------------------------------------------------- */

  createMaterial(data) { return this.materials.createMaterial(data); }
  importMaterial(data) { return this.materials.importMaterial(data); }
  getMaterial(id, version, options) { return this.materials.getMaterial(id, version, options); }
  listMaterials(filter) { return this.materials.listMaterials(filter); }
  searchMaterials(query, options) { return this.materials.searchMaterials(query, options); }
  updateMaterial(id, data) { return this.materials.updateMaterial(id, data); }
  getMaterialVersionHistory(id) { return this.materials.getMaterialVersionHistory(id); }
  moveMaterial(id, data) { return this.materials.moveMaterial(id, data); }
  duplicateMaterial(id, options) { return this.materials.duplicateMaterial(id, options); }
  archiveMaterial(id) { return this.materials.archiveMaterial(id); }
  restoreMaterial(id) { return this.materials.restoreMaterial(id); }
  trashMaterial(id) { return this.materials.deleteMaterial(id, { permanent: false }); }
  deleteMaterial(id, options) { return this.materials.deleteMaterial(id, options); }
  deleteMaterialPermanently(id) { return this.materials.deleteMaterial(id, { permanent: true }); }
  publishMaterial(id, options) { return this.materials.publishMaterial(id, options); }
  unpublishMaterial(id, options) { return this.materials.unpublishMaterial(id, options); }
  getVersionPublication(id, version, options) { return this.materials.getVersionPublication(id, version, options); }
  authorizeAssessable(id, options) { return this.materials.authorizeAssessable(id, options); }
  isVersionAssessable(id, version) { return this.materials.isVersionAssessable(id, version); }
  getAssessableAuthorization(id, version) { return this.materials.getAssessableAuthorization(id, version); }
  exportMaterial(id, options) { return this.materials.exportMaterial(id, options); }

  /* -------------------------------------------------------------------------- */
  /* AI OPERATIONAL RULES (Dossier 09)                                          */
  /* -------------------------------------------------------------------------- */

  setAiRule(data, actor) { return this.aiRules.setRule(data, actor); }
  getAiRule(id) { return this.aiRules.getRule(id); }
  getAiRuleVersion(id, version) { return this.aiRules.getRuleVersion(id, version); }
  getAiRuleVersionHistory(id) { return this.aiRules.getRuleVersionHistory(id); }
  listAiRules(filter) { return this.aiRules.listRules(filter); }
  archiveAiRule(id, actor, note) { return this.aiRules.archiveRule(id, actor, note); }
  restoreAiRule(id, actor, note) { return this.aiRules.restoreRule(id, actor, note); }
  deleteAiRule(id, options, actor) { return this.aiRules.deleteRule(id, options, actor); }
  restoreAiRuleVersion(id, version, actor, note) { return this.aiRules.restoreRuleVersion(id, version, actor, note); }
  resolveEffectiveAiRules(context) { return this.aiRules.resolveEffectiveRules(context); }

  /* -------------------------------------------------------------------------- */
  /* SOURCES LIFECYCLE (Dossier 04)                                             */
  /* -------------------------------------------------------------------------- */

  registerSource(data) { return this.sources.registerSource(data); }
  getSource(id) { return this.sources.getSource(id); }
  getSourceContent(id, versionNumber) { return this.sources.getSourceContent(id, versionNumber); }
  getSourceHistory(id) { return this.sources.getSourceHistory(id); }
  listSources(filter) { return this.sources.listSources(filter); }
  consultSource(id, data) { return this.sources.consultSource(id, data); }
  searchWebSources(query, options) { return this.sources.searchWebSources(query, options); }
  selectGenerationSources(options) { return this.sources.selectGenerationSources(options); }
  markSourcesUsed(ids) { return this.sources.markSourcesUsed(ids); }
  saveExternalSource(id, options) { return this.sources.saveExternalSource(id, options); }
  searchInternalSources(query, options) { return this.sources.searchInternalSources(query, options); }
  searchSources(query, options) { return this.sources.searchInternalSources(query, options); }
  getPreviousLessonsContext(classId, subjectId, options) { return this.sources.getPreviousLessonsContext(classId, subjectId, options); }
  getPreviousLessons(classId, subjectId, options) { return this.sources.getPreviousLessonsContext(classId, subjectId, options); }

  /* -------------------------------------------------------------------------- */
  /* REAL FILE IMPORT & EXPORT                                                  */
  /* -------------------------------------------------------------------------- */

  importAttachmentFile(options) {
    const file = options?.file;
    return this.fileService.importAttachmentFromChatGPTFile(file, options);
  }

  importFile(options) {
    const opts = { ...options };
    if (opts.file) {
      return this.fileService.importAttachmentFromChatGPTFile(opts.file, opts);
    }
    if (opts.fileBufferBase64 && !opts.fileBuffer) {
      opts.fileBuffer = Buffer.from(opts.fileBufferBase64, "base64");
    }
    return this.fileService.importFile(opts);
  }
  exportMaterialFile(id, format, options) { return this.fileService.exportMaterialFile(id, format, options); }

  /* -------------------------------------------------------------------------- */
  /* ASSESSMENTS & GRADING (Dossier 05, Dossier 06)                             */
  /* -------------------------------------------------------------------------- */

  createAssessment(data) { return this.assessments.createAssessment(data); }
  getAssessment(id, options) { return this.assessments.getAssessment(id, options); }
  listAssessments(filter) { return this.assessments.listAssessments(filter); }
  addAssessmentItem(assessmentId, itemData) { return this.assessments.addItem(assessmentId, itemData); }
  updateAssessment(id, updates) { return this.assessments.updateAssessment(id, updates); }
  setAssessmentStatus(id, newStatus) { return this.assessments.setAssessmentStatus(id, newStatus); }
  updateAssessmentItem(assessmentId, itemId, updates) { return this.assessments.updateItem(assessmentId, itemId, updates); }
  deleteAssessmentItem(assessmentId, itemId) { return this.assessments.deleteItem(assessmentId, itemId); }
  generateActivityCredentials(assessmentId, options) { return this.assessments.generateActivityCredentials(assessmentId, options); }
  listActivityCredentials(assessmentId) { return this.assessments.listActivityCredentials(assessmentId); }
  revokeActivityCredential(credentialId) { return this.assessments.revokeActivityCredential(credentialId); }
  reissueActivityCredential(credentialId, options) { return this.assessments.reissueActivityCredential(credentialId, options); }
  claimStudentSession(accessCode) { return this.assessments.claimStudentSession(accessCode); }
  validateStudentSession(token, assessmentId) { return this.assessments.validateStudentSession(token, assessmentId); }
  reopenSubmission(submissionId, options) { return this.assessments.reopenSubmission(submissionId, options); }
  importSubmission(data) { return this.assessments.importSubmission(data); }
  getSubmission(id) { return this.assessments.getSubmission(id); }
  listSubmissions(assessmentId) { return this.assessments.listSubmissions(assessmentId); }
  gradeSubmission(data) { return this.assessments.gradeSubmission(data); }
  reviewGrading(data) { return this.assessments.reviewGrading(data); }
  exportAssessmentResults(assessmentId, format) { return this.assessments.exportAssessmentResults(assessmentId, format); }

  /* -------------------------------------------------------------------------- */
  /* AI GENERATION WORKFLOWS                                                    */
  /* -------------------------------------------------------------------------- */

  generateLessonPlan(options) { return this.generation.generateLessonPlan(options); }
  generateTeacherScript(options) { return this.generation.generateTeacherScript(options); }
  generateStudentMaterial(options) { return this.generation.generateStudentMaterial(options); }
  generateExercises(options) { return this.generation.generateExercises(options); }
  generateAssessmentDraft(options) { return this.generation.generateAssessmentDraft(options); }
  reviseMaterial(options) { return this.generation.reviseMaterial(options); }
  regenerateSection(options) { return this.generation.regenerateSection(options); }
  listAiModels(options) { return this.ai.listModels(options); }


  /* -------------------------------------------------------------------------- */
  /* T1 LESSON PACK & PREPARATION WORKFLOW (Dossier 01 §5-8, §26-31)           */
  /* -------------------------------------------------------------------------- */

  getLessonPack(lessonId, { role = 'teacher', includeTeacherSolutions = true } = {}) {
    const lesson = this.org.getLesson(lessonId);
    const materials = this.materials.listMaterials({ lessonId, status: 'all' });

    let lessonPlan = null;
    let teacherScript = null;
    let exercises = null;
    let studentMaterial = null;
    const supportMaterials = [];
    const otherMaterials = [];

    const activeMaterials = materials.filter(m => m.status !== 'trashed');
    activeMaterials.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    for (const m of activeMaterials) {
      if (m.resource_type === 'lesson_plan' && !lessonPlan) {
        lessonPlan = this.materials.getMaterial(m.id, null, { role, includeTeacherSolutions });
      } else if (m.resource_type === 'teacher_script' && !teacherScript) {
        teacherScript = this.materials.getMaterial(m.id, null, { role, includeTeacherSolutions });
      } else if (m.resource_type === 'exercise_sheet' && !exercises) {
        exercises = this.materials.getMaterial(m.id, null, { role, includeTeacherSolutions });
      } else if (m.resource_type === 'student_note' && !studentMaterial) {
        studentMaterial = this.materials.getMaterial(m.id, null, { role, includeTeacherSolutions });
      } else if (m.pedagogical_role === 'support_material') {
        supportMaterials.push(m);
      } else {
        otherMaterials.push(m);
      }
    }

    const isComplete = Boolean(lessonPlan && teacherScript && exercises && studentMaterial);

    let confirmation = null;
    let preparationStatus = isComplete ? 'draft_ready' : 'incomplete';

    try {
      const stmt = this.dbManager.prepare(`
        SELECT * FROM lesson_preparation_confirmations
        WHERE lesson_id = ?
        ORDER BY confirmed_at DESC
        LIMIT 1
      `);
      const row = stmt.get(lessonId);
      if (row) {
        let artifactVersions = {};
        try {
          artifactVersions = JSON.parse(row.artifact_versions_json);
        } catch {}

        confirmation = {
          id: row.id,
          lessonId: row.lesson_id,
          confirmedAt: row.confirmed_at,
          confirmedBy: row.confirmed_by,
          notes: row.notes,
          artifactVersions
        };

        if (!isComplete) {
          preparationStatus = 'incomplete';
        } else {
          const matches =
            artifactVersions.lessonPlan?.id === lessonPlan.id &&
            artifactVersions.lessonPlan?.version === lessonPlan.current_version &&
            artifactVersions.teacherScript?.id === teacherScript.id &&
            artifactVersions.teacherScript?.version === teacherScript.current_version &&
            artifactVersions.exercises?.id === exercises.id &&
            artifactVersions.exercises?.version === exercises.current_version &&
            artifactVersions.studentMaterial?.id === studentMaterial.id &&
            artifactVersions.studentMaterial?.version === studentMaterial.current_version;

          if (matches) {
            preparationStatus = 'confirmed';
          } else {
            preparationStatus = 'modified_since_confirmation';
          }
        }
      }
    } catch {}

    return {
      lesson,
      artifacts: {
        lessonPlan,
        teacherScript,
        exercises,
        studentMaterial
      },
      supportMaterials,
      otherMaterials,
      confirmation,
      preparationStatus,
      isComplete
    };
  }

    async generateLessonPack({
    lessonId,
    topic = null,
    durationMinutes = null,
    additionalInstructions = '',
    selectedSourceIds = [],
    sourceSelectionMode = 'selected_only',
    targetArtifacts = null,
    model = undefined,
    signal = null
  }) {
    if (!lessonId) throw new ValidationError('lessonId is required to generate a Lesson Pack');
    const lesson = this.org.getLesson(lessonId);
    const effectiveTopic = (topic || lesson.title || '').trim();
    if (!effectiveTopic) throw new ValidationError('Topic or lesson title is required');

    const effectiveDuration = durationMinutes || lesson.duration_minutes || 60;

    // Keep lesson record in sync with edited topic/duration
    if (topic && topic !== lesson.title || durationMinutes && durationMinutes !== lesson.duration_minutes) {
      this.org.updateLesson(lessonId, {
        title: effectiveTopic,
        durationMinutes: effectiveDuration
      });
    }

    const artifactsToRun = (targetArtifacts && Array.isArray(targetArtifacts) && targetArtifacts.length > 0)
      ? targetArtifacts
      : ['lessonPlan', 'teacherScript', 'exercises', 'studentMaterial'];

    for (const art of artifactsToRun) {
      const lockKey = `${lessonId}:${art}`;
      if (this._activeArtifactLocks.has(lockKey)) {
        throw new ConflictError(`Artifact "${art}" is currently being generated for lesson "${lessonId}". Concurrent duplicate requests are rejected.`);
      }
    }
    for (const art of artifactsToRun) {
      this._activeArtifactLocks.add(`${lessonId}:${art}`);
    }

    try {
      const shouldRun = (name) => artifactsToRun.includes(name);

      let pack = this.getLessonPack(lessonId);

      const isSelectedOnly = sourceSelectionMode === 'selected_only';
      const includePreviousLessons = !isSelectedOnly;
      const searchInternal = !isSelectedOnly;
      const searchWeb = false;

      // Filter out pack artifacts from candidate external support sources
      const requiredSources = [];
      for (const item of (selectedSourceIds || [])) {
        if (!item) continue;
        if (typeof item === 'object') {
          requiredSources.push(item);
          continue;
        }
        try {
          const mat = this.materials.getMaterial(item);
          const isPackArtifact = [
            'lesson_plan',
            'teacher_script',
            'exercise_sheet',
            'student_material'
          ].includes(mat.resource_type) && mat.lesson_id === lessonId;

          if (!isPackArtifact) {
            requiredSources.push({
              resourceId: item,
              versionNumber: mat.current_version || 1
            });
          }
        } catch {
          requiredSources.push({ resourceId: item, versionNumber: 1 });
        }
      }

      // Step 1: Lesson Plan
      if (shouldRun('lessonPlan')) {
        await this.generation.generateLessonPlan({
          lessonId,
          topic: effectiveTopic,
          durationMinutes: effectiveDuration,
          additionalInstructions,
          classId: lesson.class_id,
          subjectId: lesson.subject_id,
          requiredSources,
          includePreviousLessons,
          searchInternal,
          searchWeb,
          model,
          signal,
          existingMaterialId: pack.artifacts.lessonPlan?.id || null,
          sourceSelectionMode
        });
        pack = this.getLessonPack(lessonId);
      }

      // Step 2: Teacher Script (conduzione riga per riga con timecodes)
      if (shouldRun('teacherScript')) {
        const plan = pack.artifacts.lessonPlan;
        await this.generation.generateTeacherScript({
          lessonPlanId: plan?.id || null,
          lessonPlanVersionNumber: plan?.current_version || null,
          lessonId,
          topic: effectiveTopic,
          durationMinutes: effectiveDuration,
          additionalInstructions,
          classId: lesson.class_id,
          subjectId: lesson.subject_id,
          requiredSources,
          includePreviousLessons,
          searchInternal,
          searchWeb,
          model,
          signal,
          existingMaterialId: pack.artifacts.teacherScript?.id || null,
          sourceSelectionMode
        });
        pack = this.getLessonPack(lessonId);
      }

      // Step 3: Exercises
      if (shouldRun('exercises')) {
        await this.generation.generateExercises({
          topic: effectiveTopic,
          count: 3,
          withSolutions: true,
          lessonId,
          classId: lesson.class_id,
          subjectId: lesson.subject_id,
          additionalInstructions,
          requiredSources,
          includePreviousLessons,
          searchInternal,
          searchWeb,
          model,
          signal,
          existingMaterialId: pack.artifacts.exercises?.id || null,
          sourceSelectionMode
        });
        pack = this.getLessonPack(lessonId);
      }

      // Step 4: Student Material (dispensa canonica priva di soluzioni)
      if (shouldRun('studentMaterial')) {
        const script = pack.artifacts.teacherScript;
        await this.generation.generateStudentMaterial({
          teacherScriptId: script?.id || null,
          teacherScriptVersionNumber: script?.current_version || null,
          lessonId,
          topic: effectiveTopic,
          additionalInstructions,
          classId: lesson.class_id,
          subjectId: lesson.subject_id,
          requiredSources,
          includePreviousLessons,
          searchInternal,
          searchWeb,
          model,
          signal,
          existingMaterialId: pack.artifacts.studentMaterial?.id || null,
          sourceSelectionMode
        });
        pack = this.getLessonPack(lessonId);
      }

      return pack;
    } finally {
      for (const art of artifactsToRun) {
        this._activeArtifactLocks.delete(lessonId + ":" + art);
      }
    }
  }

  confirmLessonPreparation({ lessonId, notes = '', actorId = 'teacher' }) {
    if (!lessonId) throw new ValidationError('lessonId is required');
    const pack = this.getLessonPack(lessonId);
    if (!pack.isComplete) {
      throw new ValidationError(
        'Cannot confirm preparation: Lesson Pack is incomplete. All 4 artifacts (Lesson Plan, Teacher Script, Exercises, Student Material) must be present.'
      );
    }

    const artifactVersions = {
      lessonPlan: { id: pack.artifacts.lessonPlan.id, version: pack.artifacts.lessonPlan.current_version },
      teacherScript: { id: pack.artifacts.teacherScript.id, version: pack.artifacts.teacherScript.current_version },
      exercises: { id: pack.artifacts.exercises.id, version: pack.artifacts.exercises.current_version },
      studentMaterial: { id: pack.artifacts.studentMaterial.id, version: pack.artifacts.studentMaterial.current_version }
    };

    const id = `lpc-${crypto.randomUUID()}`;
    const confirmedAt = new Date().toISOString();
    const stmt = this.dbManager.prepare(`
      INSERT INTO lesson_preparation_confirmations (
        id, lesson_id, confirmed_at, confirmed_by, notes, artifact_versions_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, lessonId, confirmedAt, actorId, notes, JSON.stringify(artifactVersions));

    return {
      id,
      lessonId,
      confirmedAt,
      confirmedBy: actorId,
      notes,
      artifactVersions,
      preparationStatus: 'confirmed'
    };
  }

  close() {
    this.dbManager.close();
  }

  /* -------------------------------------------------------------------------- */
  /* STUDENTS FACADE (Dossier 02, Dossier 05)                                   */
  /* -------------------------------------------------------------------------- */

  addStudent(params) { return this.org.addStudent(params); }
  getStudent(id) { return this.org.getStudent(id); }
  listStudents(classId) { return this.org.listStudents(classId); }
  importStudents(classId, list) { return this.org.importStudents(classId, list); }
  deleteStudent(id) { return this.org.deleteStudent(id); }

  /* -------------------------------------------------------------------------- */
  /* ASSESSMENT & LIVE MONITORING FACADE (Dossier 05, Dossier 06)              */
  /* -------------------------------------------------------------------------- */

  getStudentSubmission(assessmentId, studentId) { return this.assessments.getStudentSubmission(assessmentId, studentId); }
  saveDraftSubmission(params) { return this.assessments.saveDraftSubmission(params); }
  getLiveMonitoringData(assessmentId) { return this.assessments.getLiveMonitoringData(assessmentId); }
  getIntegrityPreviewData(assessmentId) { return this.assessments.getIntegrityPreviewData(assessmentId); }

}
