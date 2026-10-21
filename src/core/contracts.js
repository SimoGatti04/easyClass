/**
 * Teacher Service — Domain Contracts & Enums
 *
 * Implements approved domain principles:
 * - Pedagogical roles: Teacher Material, Student Material, Support Material, Assessable Material
 * - Resource Types & Formats
 * - Provenance tracking
 * - AI Instruction Scopes & Rule Types (Dossier 09)
 * - Source Selection States (Dossier 04)
 * - Assessment & Grading Contracts (Dossier 05, Dossier 06)
 */

export const PedagogicalRoles = Object.freeze({
  TEACHER_MATERIAL: 'teacher_material',
  STUDENT_MATERIAL: 'student_material',
  SUPPORT_MATERIAL: 'support_material',
  ASSESSABLE_MATERIAL: 'assessable_material'
});

export const ResourceTypes = Object.freeze({
  LESSON_PLAN: 'lesson_plan',
  TEACHER_SCRIPT: 'teacher_script',
  STUDENT_NOTE: 'student_note',
  SLIDES: 'slides',
  EXERCISE_SHEET: 'exercise_sheet',
  ASSESSMENT: 'assessment',
  REFERENCE_SOURCE: 'reference_source',
  CURRICULUM_OUTLINE: 'curriculum_outline',
  CUSTOM: 'custom'
});

export const ContentFormats = Object.freeze({
  MARKDOWN: 'markdown',
  TEXT: 'text',
  HTML: 'html',
  JSON: 'json',
  DOCX: 'docx',
  PDF: 'pdf'
});

export const GenerationTypes = Object.freeze({
  LESSON_PLAN: 'lesson_plan',
  TEACHER_SCRIPT: 'teacher_script',
  STUDENT_MATERIAL: 'student_material',
  EXERCISES: 'exercises',
  ASSESSMENT_DRAFT: 'assessment_draft'
});

export const ProvenanceKinds = Object.freeze({
  MANUAL: 'manual',
  AI_GENERATED: 'ai_generated',
  AI_REVISED: 'ai_revised',
  IMPORTED: 'imported',
  DUPLICATED: 'duplicated'
});

/**
 * AI Instruction Rule Scopes (Dossier 09 §5-§6)
 */
export const RuleScopes = Object.freeze({
  GLOBAL: 'global',
  SUBJECT: 'subject',
  COURSE: 'course',
  CLASS: 'class',
  CLASS_SUBJECT: 'class_subject',
  LESSON: 'lesson',
  ASSESSMENT: 'assessment',
  CAPABILITY: 'capability',
  ONE_OFF: 'one_off'
});

/**
 * Source Lifecycle States (Dossier 04 §26-§28)
 */
export const SourceStates = Object.freeze({
  FOUND: 'found',
  CONSULTED: 'consulted',
  USED: 'used',
  SAVED: 'saved'
});

/**
 * Assessment & Question Item Types (Dossier 05 §7, §11)
 */
export const ItemTypes = Object.freeze({
  MULTIPLE_CHOICE: 'multiple_choice',
  OPEN_QUESTION: 'open_question',
  PRACTICAL_PROBLEM: 'practical_problem',
  CODE: 'code',
  ATTACHMENT: 'attachment'
});

/**
 * Assessment Statuses (Dossier 05 §19)
 */

/**
 * Activity Types (Dossier 05 §1 - Single domain for tests and exercises)
 */
export const ActivityTypes = Object.freeze({
  TEST: 'test',         // Verifica sommativa
  EXERCISE: 'exercise'  // Esercitazione formativa
});

export const AssessmentStatuses = Object.freeze({
  DRAFT: 'draft',
  READY: 'ready',
  ACTIVE: 'active',
  CLOSED: 'closed',
  // Backward-compatibility aliases
  APPROVED: 'ready',
  PUBLISHED: 'active',
  ARCHIVED: 'closed'
});

export const AttemptStatuses = Object.freeze({
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  REOPENED: 'reopened'
});

export const CredentialStatuses = Object.freeze({
  ISSUED: 'issued',
  ACTIVE: 'active',
  SUBMITTED: 'submitted',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
});

/**
 * Submission Statuses (Dossier 05 §28, Dossier 06 §3)
 */
export const SubmissionStatuses = Object.freeze({
  SUBMITTED: 'submitted',
  GRADING_IN_PROGRESS: 'grading_in_progress',
  GRADED: 'graded',
  REVIEWED: 'reviewed'
});

/**
 * Evaluation Strategies & Types (Dossier 06 §2)
 */
export const EvaluationTypes = Object.freeze({
  DETERMINISTIC: 'deterministic',
  AI_ASSISTED: 'ai_assisted',
  MANUAL_TEACHER: 'manual_teacher'
});

/**
 * Evaluation Statuses (Dossier 06 §2-§3)
 */
export const EvaluationStatuses = Object.freeze({
  PROPOSED: 'proposed',
  APPROVED: 'approved',
  OVERRIDDEN: 'overridden'
});
