/**
 * Teacher Service — Database Schema & DDL
 *
 * Implements relational schema with foreign keys, indexes, version history,
 * provenance tracking, SQLite FTS5 full-text search, AI operational rules (Dossier 09),
 * sources lifecycle (Dossier 04), and assessment/grading models (Dossier 05, Dossier 06).
 */

export const SCHEMA_SQL = `
-- Enforce foreign keys and WAL mode
PRAGMA foreign_keys = ON;

-- 1. Classes
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  section TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subjects_class ON subjects(class_id);

-- 3. Lessons
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT,
  duration_minutes INTEGER DEFAULT 60,
  order_index INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lessons_class_subject ON lessons(class_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons(date);

-- 4. Collections
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 5. Resources (Logical Materials)
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL DEFAULT 'custom',
  pedagogical_role TEXT NOT NULL DEFAULT 'teacher_material',
  format TEXT NOT NULL DEFAULT 'markdown',
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  origin_type TEXT NOT NULL DEFAULT 'manual_creation',
  origin_uri TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_version INTEGER NOT NULL DEFAULT 1,
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_class_subject ON resources(class_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_resources_lesson ON resources(lesson_id);
CREATE INDEX IF NOT EXISTS idx_resources_role ON resources(pedagogical_role);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);

-- 6. Resource Versions (Immutable Content Snapshots)
CREATE TABLE IF NOT EXISTS resource_versions (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content_text TEXT NOT NULL,
  file_path TEXT,
  content_hash TEXT NOT NULL,
  change_summary TEXT,
  created_by TEXT DEFAULT 'teacher',
  created_at TEXT NOT NULL,
  UNIQUE(resource_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_versions_resource ON resource_versions(resource_id);

-- 7. Provenance
CREATE TABLE IF NOT EXISTS provenance (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  provenance_type TEXT NOT NULL,
  base_resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
  base_version_number INTEGER,
  model TEXT,
  prompt TEXT,
  telemetry_json TEXT,
  source_set_json TEXT,
  configuration_snapshot_json TEXT,
  prompt_template_version TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provenance_resource_version ON provenance(resource_id, version_number);

-- 8. Collection Items
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL,
  PRIMARY KEY (collection_id, resource_id)
);

-- 9. Assessable Authorizations (Dossier 04 §46 / Dossier 05 §56)
CREATE TABLE IF NOT EXISTS assessable_authorizations (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  authorized_at TEXT NOT NULL,
  authorized_by TEXT DEFAULT 'teacher',
  notes TEXT,
  UNIQUE(resource_id, version_number, lesson_id)
);

-- Publication/availability is distinct from resource lifecycle status. These are
-- append-only events bound to exact immutable versions so withdrawal is auditable.
CREATE TABLE IF NOT EXISTS material_publication_events (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('published', 'unpublished')),
  pedagogical_role TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  available_until TEXT,
  actor TEXT NOT NULL DEFAULT 'teacher',
  notes TEXT,
  FOREIGN KEY(resource_id, version_number) REFERENCES resource_versions(resource_id, version_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_material_publication_version
  ON material_publication_events(resource_id, version_number, occurred_at);

-- 10. FTS5 Full-Text Search
CREATE VIRTUAL TABLE IF NOT EXISTS resources_fts USING fts5(
  resource_id UNINDEXED,
  title,
  description,
  tags,
  content_text
);

-- 11. Instruction Rules (AI Operational Rules, Dossier 09)
CREATE TABLE IF NOT EXISTS instruction_rules (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL, -- 'global', 'subject', 'class', 'class_subject', 'lesson', 'assessment', 'capability', 'one_off'
  target_id TEXT, -- e.g. class_id, subject_id, lesson_id, assessment_id, capability_name
  secondary_target_id TEXT, -- e.g. subject_id when scope is 'class_subject'
  title TEXT NOT NULL,
  instruction_text TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'archived'
  created_by TEXT DEFAULT 'teacher',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rules_scope_target ON instruction_rules(scope, target_id);
CREATE INDEX IF NOT EXISTS idx_rules_status ON instruction_rules(status);

-- Immutable snapshots of each meaningful rule mutation. The live row is the
-- current projection; this table is the authority for historical resolution.
CREATE TABLE IF NOT EXISTS instruction_rule_versions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES instruction_rules(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  scope TEXT NOT NULL,
  target_id TEXT,
  secondary_target_id TEXT,
  title TEXT NOT NULL,
  instruction_text TEXT NOT NULL,
  status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  change_note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(rule_id, version)
);

CREATE INDEX IF NOT EXISTS idx_rule_versions_rule ON instruction_rule_versions(rule_id, version DESC);

-- 12. Sources (Internal and External Sources Lifecycle, Dossier 04)
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL, -- 'internal_material', 'external_web'
  resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
  version_number INTEGER,
  url TEXT,
  title TEXT NOT NULL,
  content_snippet TEXT,
  content_version INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  accessed_at TEXT,
  authority_level TEXT DEFAULT 'reference', -- 'official', 'academic', 'reference', 'unverified'
  authority_basis TEXT,
  relevance_score REAL DEFAULT 1.0,
  state TEXT NOT NULL DEFAULT 'found', -- 'found', 'consulted', 'used', 'saved'
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sources_state ON sources(state);
CREATE INDEX IF NOT EXISTS idx_sources_resource ON sources(resource_id, version_number);

-- External page snapshots are immutable and addressable from artifact Source Sets.
CREATE TABLE IF NOT EXISTS source_content_versions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  accessed_at TEXT NOT NULL,
  UNIQUE(source_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_source_content_versions_source
  ON source_content_versions(source_id, version_number DESC);

CREATE TABLE IF NOT EXISTS source_state_events (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('found', 'consulted', 'used', 'saved')),
  content_version INTEGER,
  details_json TEXT,
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_source_events_source ON source_state_events(source_id, occurred_at);

-- Exact Source Set and resolved AI configuration snapshot for each immutable
-- generated material version. Content itself remains owned by resources/sources.
CREATE TABLE IF NOT EXISTS artifact_source_sets (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  source_set_json TEXT NOT NULL,
  configuration_snapshot_json TEXT,
  prompt_template_version TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(resource_id, version_number),
  FOREIGN KEY(resource_id, version_number)
    REFERENCES resource_versions(resource_id, version_number) ON DELETE CASCADE
);

-- 13. Assessments (Dossier 05)
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'published', 'archived'
  duration_minutes INTEGER DEFAULT 60,
  max_score REAL DEFAULT 100,
  activity_type TEXT NOT NULL DEFAULT 'test',
  is_active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT DEFAULT 'teacher',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessments_class ON assessments(class_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);

-- 14. Assessment Items / Questions (Dossier 05 §7, §11, §12)
CREATE TABLE IF NOT EXISTS assessment_items (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'open_question', -- 'multiple_choice', 'open_question', 'practical_problem'
  question_text TEXT NOT NULL,
  max_score REAL NOT NULL DEFAULT 10,
  rubric_json TEXT, -- criteria, scoring levels, weights
  teacher_solution TEXT, -- PROTECTED TEACHER-ONLY SOLUTION & ANSWER KEY
  options_json TEXT, -- array of options for multiple choice
  is_self_correcting INTEGER DEFAULT 0,
  starter_code TEXT DEFAULT NULL,
  language TEXT DEFAULT NULL,
  assessable_source_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
  assessable_source_version INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessment_items_assessment ON assessment_items(assessment_id);

-- 15. Assessment Submissions / Student Attempts (Dossier 05 §24, §28, Dossier 06)
CREATE TABLE IF NOT EXISTS assessment_submissions (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT,
  submitted_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted', 'grading_in_progress', 'graded', 'reviewed'
  total_score REAL DEFAULT NULL,
  proposed_grade TEXT DEFAULT NULL,
  final_grade TEXT DEFAULT NULL,
  teacher_notes TEXT DEFAULT NULL,
  seat_row TEXT DEFAULT NULL,
  seat_desk TEXT DEFAULT NULL,
  left_neighbor_id TEXT DEFAULT NULL,
  left_neighbor_name TEXT DEFAULT NULL,
  right_neighbor_id TEXT DEFAULT NULL,
  right_neighbor_name TEXT DEFAULT NULL,
  last_saved_at TEXT DEFAULT NULL,
  attempt_status TEXT NOT NULL DEFAULT 'submitted',
  revision INTEGER NOT NULL DEFAULT 0,
  assessment_version INTEGER NOT NULL DEFAULT 1,
  started_at TEXT DEFAULT NULL,
  extra_time_minutes INTEGER DEFAULT 0,
  reopened_at TEXT DEFAULT NULL,
  reopened_by TEXT DEFAULT NULL,
  reopen_reason TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_assessment ON assessment_submissions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON assessment_submissions(student_id);

-- 16. Submission Responses (Student answers per item)
CREATE TABLE IF NOT EXISTS submission_responses (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES assessment_items(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  attachment_path TEXT DEFAULT NULL,
  attachment_name TEXT DEFAULT NULL,
  updated_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(submission_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_submission_responses_sub ON submission_responses(submission_id);

-- Student uploads are opaque, session-owned attachments. The storage path is
-- never accepted from or returned to the student client.
CREATE TABLE IF NOT EXISTS student_attachments (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES assessment_items(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_attachments_owner
  ON student_attachments(assessment_id, student_id, item_id);

-- 17. Evaluations (Dossier 06 §2, §3 - preserves evaluation rounds for regrading)
CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES assessment_items(id) ON DELETE CASCADE,
  evaluation_round INTEGER NOT NULL DEFAULT 1,
  evaluation_type TEXT NOT NULL DEFAULT 'deterministic', -- 'deterministic', 'ai_assisted', 'manual_teacher'
  score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 0,
  confidence REAL DEFAULT 1.0,
  feedback TEXT,
  teacher_notes TEXT,
  criteria_breakdown_json TEXT,
  status TEXT NOT NULL DEFAULT 'proposed', -- 'proposed', 'approved', 'overridden'
  evaluator TEXT DEFAULT 'system',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evaluations_submission_round ON evaluations(submission_id, evaluation_round);

-- 17a. Auditable teacher actions and grading decisions (Checkpoint C5)
CREATE TABLE IF NOT EXISTS assessment_action_events (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  submission_id TEXT REFERENCES assessment_submissions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  idempotency_key TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(assessment_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_assessment_action_events_submission
  ON assessment_action_events(submission_id, created_at);

-- 18. Lesson Preparation Confirmations (Dossier 01 §7, §20, §30)
CREATE TABLE IF NOT EXISTS lesson_preparation_confirmations (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  confirmed_at TEXT NOT NULL,
  confirmed_by TEXT NOT NULL DEFAULT 'teacher',
  notes TEXT,
  artifact_versions_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lesson_prep_confirmations ON lesson_preparation_confirmations(lesson_id);

-- 23. Students (Roster managed/imported by teacher - Dossier 02 §4, Dossier 05 §43)
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- 24. Student Activity Credentials & Temporary Access Codes (Checkpoint C3.1)
CREATE TABLE IF NOT EXISTS student_activity_credentials (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  access_code TEXT NOT NULL,
  token_hash TEXT UNIQUE,
  token TEXT, -- Legacy backwards compatibility during migration
  status TEXT NOT NULL DEFAULT 'issued', -- 'issued', 'active', 'submitted', 'revoked', 'expired'
  reissue_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT DEFAULT NULL,
  revoked_reason TEXT DEFAULT NULL,
  expires_at TEXT NOT NULL,
  claimed_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(assessment_id, student_id),
  UNIQUE(access_code)
);

CREATE INDEX IF NOT EXISTS idx_student_cred_assessment ON student_activity_credentials(assessment_id);
CREATE INDEX IF NOT EXISTS idx_student_cred_code ON student_activity_credentials(access_code);
CREATE INDEX IF NOT EXISTS idx_student_cred_token ON student_activity_credentials(token);

-- 25. Public class access: one shared class PIN, independent from student
-- navigation sessions and individual attempt bearer sessions. Existing
-- student_activity_credentials rows are retained as historical data.
CREATE TABLE IF NOT EXISTS class_activity_pins (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_class_activity_pin
  ON class_activity_pins(class_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS student_class_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  pin_id TEXT NOT NULL REFERENCES class_activity_pins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_student_class_sessions_class
  ON student_class_sessions(class_id, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS student_attempt_sessions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
  class_session_id TEXT REFERENCES student_class_sessions(id) ON DELETE CASCADE,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_live_attempt_session
  ON student_attempt_sessions(submission_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_attempt_sessions_submission
  ON student_attempt_sessions(submission_id, expires_at, revoked_at);

-- Rate-limit buckets use the existing SQLite limiter table. Identifiers are
-- opaque hashes, never raw IP addresses or PINs.

-- Integrity decisions are teacher-only and append-only. Analysis reports are
-- computed on demand; answer text is deliberately not persisted here.
CREATE TABLE IF NOT EXISTS integrity_review_events (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  submission_ids_json TEXT NOT NULL,
  analysis_version TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('pending', 'reviewed_no_action', 'needs_follow_up')),
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (assessment_id, evidence_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_integrity_review_evidence
  ON integrity_review_events(assessment_id, evidence_id, created_at);

-- 26. Student Claim Rate Limits (Shared across instances and restarts)
CREATE TABLE IF NOT EXISTS student_claim_rate_limits (
  scope TEXT NOT NULL,
  identifier TEXT NOT NULL,
  failed_count INTEGER NOT NULL DEFAULT 0,
  first_attempt_at INTEGER NOT NULL,
  last_attempt_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, identifier)
);

CREATE INDEX IF NOT EXISTS idx_claim_rate_limits_blocked
  ON student_claim_rate_limits(scope, identifier, blocked_until);

`;
