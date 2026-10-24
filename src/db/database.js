/**
 * Teacher Service — Database Connection & Lifecycle Management
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { SCHEMA_SQL } from './schema.js';

export class DatabaseManager {
  /**
   * @param {string} [dbPath] - Defaults to ':memory:' or filepath
   */
  constructor(dbPath = ':memory:') {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Initialize database and apply migrations/DDL
   */
  init() {
    if (this.db) return this;

    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(this.dbPath);
    if (this.dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
    }
    this.db.exec(SCHEMA_SQL);
    this._migrateExistingSchema();
    return this;
  }

  _migrateExistingSchema() {
    // CREATE TABLE IF NOT EXISTS does not add columns to local MVP databases.
    // Keep these additive migrations explicit and safe to run on every startup.
    const ensureColumn = (table, column, definition) => {
      const columns = this.db.prepare(`PRAGMA table_info(${table})`).all();
      if (!columns.some((entry) => entry.name === column)) {
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    };

    ensureColumn('provenance', 'source_set_json', 'TEXT');
    ensureColumn('provenance', 'configuration_snapshot_json', 'TEXT');
    ensureColumn('provenance', 'prompt_template_version', 'TEXT');
    ensureColumn('sources', 'content_version', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumn('sources', 'content_hash', 'TEXT');
    ensureColumn('sources', 'accessed_at', 'TEXT');
    ensureColumn('sources', 'authority_basis', 'TEXT');
    ensureColumn('lessons', 'duration_minutes', 'INTEGER DEFAULT 60');

    this.db.exec(`
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
    `);


    
    ensureColumn('assessments', 'activity_type', "TEXT NOT NULL DEFAULT 'test'");
    ensureColumn('assessments', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
    ensureColumn('assessment_items', 'starter_code', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_items', 'language', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'seat_row', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'seat_desk', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'left_neighbor_id', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'left_neighbor_name', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'right_neighbor_id', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'right_neighbor_name', 'TEXT DEFAULT NULL');
    ensureColumn('evaluations', 'teacher_notes', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'last_saved_at', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'started_at', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'extra_time_minutes', 'INTEGER DEFAULT 0');
    ensureColumn('assessment_submissions', 'attempt_status', "TEXT NOT NULL DEFAULT 'submitted'");
    ensureColumn('submission_responses', 'updated_at', 'TEXT DEFAULT NULL');
    ensureColumn('submission_responses', 'attachment_path', 'TEXT DEFAULT NULL');
    ensureColumn('submission_responses', 'attachment_name', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'reopened_at', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'reopened_by', 'TEXT DEFAULT NULL');
    ensureColumn('assessment_submissions', 'reopen_reason', 'TEXT DEFAULT NULL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS student_activity_credentials (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        access_code TEXT NOT NULL,
        token TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'issued',
        expires_at TEXT NOT NULL,
        claimed_at TEXT,
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(assessment_id, student_id),
        UNIQUE(assessment_id, access_code)
      );
      CREATE INDEX IF NOT EXISTS idx_student_cred_assessment ON student_activity_credentials(assessment_id);
      CREATE INDEX IF NOT EXISTS idx_student_cred_code ON student_activity_credentials(access_code);
      CREATE INDEX IF NOT EXISTS idx_student_cred_token ON student_activity_credentials(token);
    `);

    // Backfill one truthful baseline snapshot for rules that predate history.
    // This is a state snapshot, not an assertion about older edits.
    this.db.prepare(`
      INSERT OR IGNORE INTO instruction_rule_versions (
        id, rule_id, version, scope, target_id, secondary_target_id,
        title, instruction_text, status, changed_by, change_note, created_at
      )
      SELECT 'rule-version-migration-' || id || '-' || version, id, version,
        scope, target_id, secondary_target_id, title, instruction_text, status,
        COALESCE(created_by, 'legacy'), 'Baseline snapshot during rule-history migration', updated_at
      FROM instruction_rules
    `).run();
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Transaction helper
   * @template T
   * @param {() => T} fn
   * @returns {T}
   */
  transaction(fn) {
    if (this._inTransaction) {
      return fn();
    }
    this._inTransaction = true;
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    } finally {
      this._inTransaction = false;
    }
  }

  /**
   * Run raw statement
   */
  prepare(sql) {
    return this.db.prepare(sql);
  }

  exec(sql) {
    return this.db.exec(sql);
  }
}

/**
 * Creates default production database connection
 */
export function createProductionDatabase(customPath) {
  const defaultPath = process.env.TEACHER_SERVICE_DB_PATH || path.resolve(process.cwd(), 'storage', 'teacher_service.db');
  const targetPath = customPath || defaultPath;
  const manager = new DatabaseManager(targetPath);
  return manager.init();
}
