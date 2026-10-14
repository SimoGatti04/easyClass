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
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
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
  const defaultPath = path.resolve(process.cwd(), 'storage', 'teacher_service.db');
  const targetPath = customPath || defaultPath;
  const manager = new DatabaseManager(targetPath);
  return manager.init();
}
