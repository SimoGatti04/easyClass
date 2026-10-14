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
import { ValidationError } from '../core/errors.js';
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
  trashMaterial(id) { return this.materials.trashMaterial(id); }
  deleteMaterialPermanently(id) { return this.materials.deleteMaterialPermanently(id); }
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
  /* TEARDOWN                                                                   */
  /* -------------------------------------------------------------------------- */

  close() {
    this.dbManager.close();
  }
}
