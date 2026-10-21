/**
 * Teacher Service — Organization Service
 *
 * Manages Classes, Subjects, Lessons, Collections, and context associations.
 */
import crypto from 'node:crypto';
import { NotFoundError, ValidationError } from '../core/errors.js';

export class OrganizationService {
  /**
   * @param {import('../db/database.js').DatabaseManager} dbManager
   */
  constructor(dbManager) {
    this.dbManager = dbManager;
  }

  /* -------------------------------------------------------------------------- */
  /* CLASSES                                                                    */
  /* -------------------------------------------------------------------------- */

  createClass({ name, academicYear, section = null, description = null }) {
    if (!name || !academicYear) {
      throw new ValidationError('Class name and academicYear are required', { name, academicYear });
    }
    const id = `class-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      INSERT INTO classes (id, name, academic_year, section, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, name, academicYear, section, description, now, now);

    return this.getClass(id);
  }

  listClasses() {
    const stmt = this.dbManager.prepare(`
      SELECT * FROM classes ORDER BY academic_year DESC, name ASC
    `);
    return stmt.all();
  }

  getClass(id) {
    const stmt = this.dbManager.prepare(`
      SELECT * FROM classes WHERE id = ?
    `);
    const row = stmt.get(id);
    if (!row) {
      throw new NotFoundError('Class', id);
    }
    return row;
  }

  updateClass(id, { name, academicYear, section, description }) {
    const current = this.getClass(id);
    const updatedName = name !== undefined ? name : current.name;
    const updatedYear = academicYear !== undefined ? academicYear : current.academic_year;
    const updatedSection = section !== undefined ? section : current.section;
    const updatedDesc = description !== undefined ? description : current.description;
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      UPDATE classes
      SET name = ?, academic_year = ?, section = ?, description = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(updatedName, updatedYear, updatedSection, updatedDesc, now, id);

    return this.getClass(id);
  }

  deleteClass(id) {
    this.getClass(id); // Ensure exists
    const stmt = this.dbManager.prepare(`DELETE FROM classes WHERE id = ?`);
    stmt.run(id);
    return { success: true, deletedId: id };
  }

  /* -------------------------------------------------------------------------- */
  /* SUBJECTS                                                                   */
  /* -------------------------------------------------------------------------- */

  createSubject({ classId, name, code = null, description = null }) {
    if (!classId || !name) {
      throw new ValidationError('Subject classId and name are required', { classId, name });
    }
    this.getClass(classId); // Ensure parent class exists
    const id = `subj-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      INSERT INTO subjects (id, class_id, name, code, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, classId, name, code, description, now, now);

    return this.getSubject(id);
  }

  listSubjects(filter = null) {
    const classId = typeof filter === 'object' && filter !== null ? filter.classId : filter;
    if (classId) {
      const stmt = this.dbManager.prepare(`
        SELECT * FROM subjects WHERE class_id = ? ORDER BY name ASC
      `);
      return stmt.all(classId);
    }
    const stmt = this.dbManager.prepare(`
      SELECT * FROM subjects ORDER BY name ASC
    `);
    return stmt.all();
  }

  getSubject(id) {
    const stmt = this.dbManager.prepare(`
      SELECT * FROM subjects WHERE id = ?
    `);
    const row = stmt.get(id);
    if (!row) {
      throw new NotFoundError('Subject', id);
    }
    return row;
  }

  updateSubject(id, { name, code, description }) {
    const current = this.getSubject(id);
    const updatedName = name !== undefined ? name : current.name;
    const updatedCode = code !== undefined ? code : current.code;
    const updatedDesc = description !== undefined ? description : current.description;
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      UPDATE subjects
      SET name = ?, code = ?, description = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(updatedName, updatedCode, updatedDesc, now, id);

    return this.getSubject(id);
  }

  deleteSubject(id) {
    this.getSubject(id);
    const stmt = this.dbManager.prepare(`DELETE FROM subjects WHERE id = ?`);
    stmt.run(id);
    return { success: true, deletedId: id };
  }

  /* -------------------------------------------------------------------------- */
  /* LESSONS                                                                    */
  /* -------------------------------------------------------------------------- */

  createLesson({
    classId,
    subjectId,
    title,
    description = null,
    date = null,
    durationMinutes = 60,
    orderIndex = 0,
    status = 'planned'
  }) {
    if (!classId || !subjectId || !title) {
      throw new ValidationError('Lesson classId, subjectId, and title are required', { classId, subjectId, title });
    }
    this.getClass(classId);
    this.getSubject(subjectId);

    const id = `les-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      INSERT INTO lessons (id, class_id, subject_id, title, description, date, duration_minutes, order_index, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, classId, subjectId, title, description, date, durationMinutes, orderIndex, status, now, now);

    return this.getLesson(id);
  }

  listLessons({ classId = null, subjectId = null, status = null } = {}) {
    let sql = 'SELECT * FROM lessons WHERE 1=1';
    const params = [];

    if (classId) {
      sql += ' AND class_id = ?';
      params.push(classId);
    }
    if (subjectId) {
      sql += ' AND subject_id = ?';
      params.push(subjectId);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY order_index ASC, date ASC, created_at ASC';
    const stmt = this.dbManager.prepare(sql);
    return stmt.all(...params);
  }

  getLesson(id) {
    const stmt = this.dbManager.prepare(`
      SELECT * FROM lessons WHERE id = ?
    `);
    const row = stmt.get(id);
    if (!row) {
      throw new NotFoundError('Lesson', id);
    }
    return row;
  }

  updateLesson(id, { title, description, date, durationMinutes, orderIndex, status }) {
    const current = this.getLesson(id);
    const updatedTitle = title !== undefined ? title : current.title;
    const updatedDesc = description !== undefined ? description : current.description;
    const updatedDate = date !== undefined ? date : current.date;
    const updatedDuration = durationMinutes !== undefined ? durationMinutes : (current.duration_minutes || 60);
    const updatedOrder = orderIndex !== undefined ? orderIndex : current.order_index;
    const updatedStatus = status !== undefined ? status : current.status;
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      UPDATE lessons
      SET title = ?, description = ?, date = ?, duration_minutes = ?, order_index = ?, status = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(updatedTitle, updatedDesc, updatedDate, updatedDuration, updatedOrder, updatedStatus, now, id);

    return this.getLesson(id);
  }

  deleteLesson(id) {
    this.getLesson(id);
    const stmt = this.dbManager.prepare(`DELETE FROM lessons WHERE id = ?`);
    stmt.run(id);
    return { success: true, deletedId: id };
  }

  /* -------------------------------------------------------------------------- */
  /* COLLECTIONS                                                                */
  /* -------------------------------------------------------------------------- */

  createCollection({ name, description = null, classId = null, subjectId = null }) {
    if (!name) {
      throw new ValidationError('Collection name is required');
    }
    if (classId) this.getClass(classId);
    if (subjectId) this.getSubject(subjectId);

    const id = `col-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      INSERT INTO collections (id, name, description, class_id, subject_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, name, description, classId, subjectId, now, now);

    return this.getCollection(id);
  }

  listCollections({ classId = null, subjectId = null } = {}) {
    let sql = 'SELECT * FROM collections WHERE 1=1';
    const params = [];

    if (classId) {
      sql += ' AND class_id = ?';
      params.push(classId);
    }
    if (subjectId) {
      sql += ' AND subject_id = ?';
      params.push(subjectId);
    }

    sql += ' ORDER BY name ASC';
    const stmt = this.dbManager.prepare(sql);
    return stmt.all(...params);
  }

  getCollection(id) {
    const stmt = this.dbManager.prepare(`
      SELECT * FROM collections WHERE id = ?
    `);
    const row = stmt.get(id);
    if (!row) {
      throw new NotFoundError('Collection', id);
    }
    return row;
  }

  updateCollection(id, { name, description }) {
    const current = this.getCollection(id);
    const updatedName = name !== undefined ? name : current.name;
    const updatedDesc = description !== undefined ? description : current.description;
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      UPDATE collections
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(updatedName, updatedDesc, now, id);

    return this.getCollection(id);
  }

  deleteCollection(id) {
    this.getCollection(id);
    const stmt = this.dbManager.prepare(`DELETE FROM collections WHERE id = ?`);
    stmt.run(id);
    return { success: true, deletedId: id };
  }

  addResourceToCollection(collectionId, resourceId) {
    this.getCollection(collectionId);
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      INSERT OR IGNORE INTO collection_items (collection_id, resource_id, added_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(collectionId, resourceId, now);

    return { success: true, collectionId, resourceId };
  }

  removeResourceFromCollection(collectionId, resourceId) {
    const stmt = this.dbManager.prepare(`
      DELETE FROM collection_items WHERE collection_id = ? AND resource_id = ?
    `);
    stmt.run(collectionId, resourceId);

    return { success: true, collectionId, resourceId };
  }

  listCollectionResources(collectionId) {
    this.getCollection(collectionId);
    const stmt = this.dbManager.prepare(`
      SELECT r.*, ci.added_at as in_collection_since
      FROM resources r
      JOIN collection_items ci ON r.id = ci.resource_id
      WHERE ci.collection_id = ? AND r.status != 'deleted'
      ORDER BY ci.added_at DESC
    `);
    return stmt.all(collectionId);
  }

  /* -------------------------------------------------------------------------- */
  /* STUDENTS (CLASS ROSTER) - Dossier 02 §4, Dossier 05 §43                    */
  /* -------------------------------------------------------------------------- */

  addStudent({ classId, firstName, lastName, email = null, notes = null }) {
    if (!classId || !firstName || !lastName) {
      throw new ValidationError("classId, firstName, and lastName are required", { classId, firstName, lastName });
    }
    this.getClass(classId); // Ensure class exists

    const id = `student-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = this.dbManager.prepare(`
      INSERT INTO students (id, class_id, first_name, last_name, email, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, classId, firstName.trim(), lastName.trim(), email ? email.trim() : null, notes, now, now);

    return this.getStudent(id);
  }

  getStudent(id) {
    const stmt = this.dbManager.prepare("SELECT * FROM students WHERE id = ?");
    const row = stmt.get(id);
    if (!row) {
      throw new NotFoundError("Student", id);
    }
    return row;
  }

  listStudents(classId) {
    if (!classId) return [];
    const stmt = this.dbManager.prepare(`
      SELECT * FROM students WHERE class_id = ? ORDER BY last_name ASC, first_name ASC
    `);
    return stmt.all(classId);
  }

  importStudents(classId, studentList = []) {
    if (!classId) throw new ValidationError("classId is required");
    this.getClass(classId);

    const inserted = [];
    this.dbManager.transaction(() => {
      for (const item of studentList) {
        if (!item.firstName || !item.lastName) continue;
        const student = this.addStudent({
          classId,
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email || null,
          notes: item.notes || null
        });
        inserted.push(student);
      }
    });

    return inserted;
  }

  deleteStudent(id) {
    this.getStudent(id);
    const stmt = this.dbManager.prepare("DELETE FROM students WHERE id = ?");
    stmt.run(id);
    return { success: true, id };
  }

}
