/**
 * Teacher Service — Material Service
 *
 * Implements complete Materials lifecycle:
 * - Pedagogical roles (Teacher, Student, Support, Assessable)
 * - Versioning (immutable content snapshots with SHA-256)
 * - Full-Text Search (SQLite FTS5)
 * - Lifecycle: Create, Import, Edit, Move, Duplicate, Archive, Restore, Trash/Delete
 * - Provenance tracking & Assessable authorization
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { NotFoundError, ValidationError } from '../core/errors.js';
import { PedagogicalRoles, ResourceTypes, ContentFormats, ProvenanceKinds } from '../core/contracts.js';

export class MaterialService {
  /**
   * @param {import('../db/database.js').DatabaseManager} dbManager
   * @param {import('../storage/filestore.js').FileStore} fileStore
   * @param {import('./organization-service.js').OrganizationService} [orgService]
   */
  constructor(dbManager, fileStore, orgService = null) {
    this.dbManager = dbManager;
    this.fileStore = fileStore;
    this.orgService = orgService;
  }

  /* -------------------------------------------------------------------------- */
  /* CREATE & IMPORT                                                            */
  /* -------------------------------------------------------------------------- */

  createMaterial({
    title,
    contentText,
    teacherSolutionText = null,
    description = '',
    pedagogicalRole = PedagogicalRoles.TEACHER_MATERIAL,
    resourceType = ResourceTypes.CUSTOM,
    format = ContentFormats.MARKDOWN,
    classId = null,
    subjectId = null,
    lessonId = null,
    tags = [],
    originType = 'manual_creation',
    originUri = null,
    createdBy = 'teacher',
    changeSummary = 'Initial version',
    collectionId = null,
    provenance = null
  }) {
    if (!title || typeof title !== 'string' || title.trim() === '') {
      throw new ValidationError('Material title is required and cannot be empty');
    }
    if (contentText === undefined || contentText === null) {
      throw new ValidationError('Material contentText is required');
    }

    const validRoles = Object.values(PedagogicalRoles);
    if (!validRoles.includes(pedagogicalRole)) {
      throw new ValidationError(`Invalid pedagogical role '${pedagogicalRole}'. Allowed: ${validRoles.join(', ')}`);
    }

    const id = `mat-${crypto.randomUUID()}`;
    let effectiveContent = contentText;
    if (teacherSolutionText && typeof teacherSolutionText === "string" && teacherSolutionText.trim()) {
      effectiveContent += "\n\n[TEACHER_ONLY_SOLUTION]\n" + teacherSolutionText.trim() + "\n[/TEACHER_ONLY_SOLUTION]";
    }
    const versionId = `ver-${crypto.randomUUID()}`;
    const versionNumber = 1;
    const now = new Date().toISOString();
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');

    return this.dbManager.transaction(() => {
      // 1. Save file content
      const { filePath, hash } = this.fileStore.saveVersionContent(id, versionNumber, effectiveContent, format);

      // 2. Insert resource record
      const stmtResource = this.dbManager.prepare(`
        INSERT INTO resources (
          id, title, description, resource_type, pedagogical_role, format,
          class_id, subject_id, lesson_id, origin_type, origin_uri,
          status, current_version, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)
      `);
      stmtResource.run(
        id, title.trim(), description, resourceType, pedagogicalRole, format,
        classId, subjectId, lessonId, originType, originUri,
        tagsStr, now, now
      );

      // 3. Insert initial version
      const stmtVersion = this.dbManager.prepare(`
        INSERT INTO resource_versions (
          id, resource_id, version_number, title, content_text, file_path,
          content_hash, change_summary, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmtVersion.run(
        versionId, id, versionNumber, title.trim(), effectiveContent, filePath,
        hash, changeSummary, createdBy, now
      );

      // 4. Index in FTS5
      const stmtFts = this.dbManager.prepare(`
        INSERT INTO resources_fts (resource_id, title, description, tags, content_text)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmtFts.run(id, title.trim(), description, tagsStr, contentText);

      // 5. Provenance and exact Source Set snapshot for this immutable version.
      if (provenance) this._insertProvenance(id, versionNumber, provenance, null, null, now);

      // 6. Link to collection if requested
      if (collectionId && this.orgService) {
        this.orgService.addResourceToCollection(collectionId, id);
      }

      return this.getMaterial(id);
    });
  }

  importMaterial({
    title,
    contentText,
    originUri = null,
    originType = 'attachment_import',
    pedagogicalRole = PedagogicalRoles.SUPPORT_MATERIAL,
    format = ContentFormats.MARKDOWN,
    classId = null,
    subjectId = null,
    lessonId = null,
    tags = ['imported'],
    description = ''
  }) {
    return this.createMaterial({
      title,
      contentText,
      description,
      pedagogicalRole,
      format,
      classId,
      subjectId,
      lessonId,
      tags,
      originType,
      originUri,
      changeSummary: `Imported from ${originUri || originType}`,
      provenance: {
        type: ProvenanceKinds.IMPORTED,
        prompt: `Imported from source: ${originUri || originType}`
      }
    });
  }

  /* -------------------------------------------------------------------------- */
  /* READ & LIST                                                                */
  /* -------------------------------------------------------------------------- */

  getMaterial(id, versionNumber = null, { role = 'teacher', includeTeacherSolutions = true } = {}) {
    const stmt = this.dbManager.prepare(`
      SELECT * FROM resources WHERE id = ?
    `);
    const resource = stmt.get(id);
    if (!resource) {
      throw new NotFoundError('Material', id);
    }

    const targetVersion = versionNumber !== null ? Number(versionNumber) : resource.current_version;
    if (!Number.isInteger(targetVersion) || targetVersion < 1) {
      throw new ValidationError('versionNumber must be a positive integer');
    }
    const stmtVersion = this.dbManager.prepare(`
      SELECT * FROM resource_versions WHERE resource_id = ? AND version_number = ?
    `);
    const version = stmtVersion.get(id, targetVersion);
    if (!version && versionNumber !== null) {
      throw new NotFoundError(`Material version ${targetVersion} for resource`, id);
    }

    // Get collections this material belongs to
    const stmtCols = this.dbManager.prepare(`
      SELECT c.* FROM collections c
      JOIN collection_items ci ON c.id = ci.collection_id
      WHERE ci.resource_id = ?
    `);
    const collections = stmtCols.all(id);
    const provenanceRow = this.dbManager.prepare(`
      SELECT * FROM provenance WHERE resource_id = ? AND version_number = ? ORDER BY created_at DESC LIMIT 1
    `).get(id, targetVersion) || null;
    const sourceSetRow = this.dbManager.prepare(`
      SELECT * FROM artifact_source_sets WHERE resource_id = ? AND version_number = ?
    `).get(id, targetVersion) || null;
    const parseJson = (value, fallback = null) => {
      if (!value) return fallback;
      try { return JSON.parse(value); } catch { return fallback; }
    };
    const provenance = provenanceRow ? {
      ...provenanceRow,
      type: provenanceRow.provenance_type,
      telemetry: parseJson(provenanceRow.telemetry_json, null),
      sourceSet: parseJson(provenanceRow.source_set_json, null),
      configurationSnapshot: parseJson(provenanceRow.configuration_snapshot_json, null)
    } : null;

    let contentText = version ? version.content_text : '';
    if (role === 'student' || !includeTeacherSolutions) {
      contentText = contentText.replace(/\[TEACHER_ONLY_SOLUTION\][\s\S]*?\[\/TEACHER_ONLY_SOLUTION\]/gi, '').replace(/<!--\s*TEACHER_ONLY_START\s*-->[\s\S]*?<!--\s*TEACHER_ONLY_END\s*-->/gi, '').trim();
    }

    return {
      ...resource,
      tags: resource.tags ? resource.tags.split(',').filter(Boolean) : [],
      selected_version: targetVersion,
      content: contentText,
      content_hash: version ? version.content_hash : null,
      version_details: version || null,
      provenance,
      sourceSet: sourceSetRow ? {
        ...sourceSetRow,
        sources: parseJson(sourceSetRow.source_set_json, []),
        configurationSnapshot: parseJson(sourceSetRow.configuration_snapshot_json, null)
      } : null,
      collections
    };
  }

  listMaterials({
    classId = null,
    subjectId = null,
    lessonId = null,
    pedagogicalRole = null,
    status = 'active',
    collectionId = null,
    tag = null,
    limit = 50,
    offset = 0
  } = {}) {
    let sql = `
      SELECT r.*,
        v.content_hash,
        substr(v.content_text, 1, 300) as content_preview
      FROM resources r
      LEFT JOIN resource_versions v ON r.id = v.resource_id AND r.current_version = v.version_number
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (classId) {
      sql += ' AND r.class_id = ?';
      params.push(classId);
    }
    if (subjectId) {
      sql += ' AND r.subject_id = ?';
      params.push(subjectId);
    }
    if (lessonId) {
      sql += ' AND r.lesson_id = ?';
      params.push(lessonId);
    }
    if (pedagogicalRole) {
      sql += ' AND r.pedagogical_role = ?';
      params.push(pedagogicalRole);
    }
    if (tag) {
      sql += ' AND instr(r.tags, ?) > 0';
      params.push(tag);
    }
    if (collectionId) {
      sql += ' AND r.id IN (SELECT resource_id FROM collection_items WHERE collection_id = ?)';
      params.push(collectionId);
    }

    sql += ' ORDER BY r.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.dbManager.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map(r => ({
      ...r,
      tags: r.tags ? r.tags.split(',').filter(Boolean) : []
    }));
  }

  /* -------------------------------------------------------------------------- */
  /* EDIT & VERSIONING                                                          */
  /* -------------------------------------------------------------------------- */

  updateMaterial(id, {
    title,
    description,
    contentText,
    pedagogicalRole,
    tags,
    changeSummary = 'Updated material',
    updatedBy = 'teacher',
    provenance = null
  }) {
    const current = this.getMaterial(id);
    const now = new Date().toISOString();

    return this.dbManager.transaction(() => {
      let nextVersion = current.current_version;
      const titleToSave = title !== undefined ? title.trim() : current.title;
      const descToSave = description !== undefined ? description : current.description;
      let roleToSave = pedagogicalRole !== undefined ? pedagogicalRole : current.pedagogical_role;
      if (pedagogicalRole === undefined && current.pedagogical_role === PedagogicalRoles.ASSESSABLE_MATERIAL) {
        // Dossier 04 §46.4: Revisions generate new versions; prior approvals do not transfer automatically
        roleToSave = PedagogicalRoles.STUDENT_MATERIAL;
      }
      const tagsToSave = tags !== undefined
        ? (Array.isArray(tags) ? tags.join(',') : tags)
        : (current.tags ? current.tags.join(',') : '');

      const contentChanged = contentText !== undefined && contentText !== current.content;

      if (contentChanged) {
        nextVersion = current.current_version + 1;
        const versionId = `ver-${crypto.randomUUID()}`;
        const { filePath, hash } = this.fileStore.saveVersionContent(id, nextVersion, contentText, current.format);

        const stmtVersion = this.dbManager.prepare(`
          INSERT INTO resource_versions (
            id, resource_id, version_number, title, content_text, file_path,
            content_hash, change_summary, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmtVersion.run(
          versionId, id, nextVersion, titleToSave, contentText, filePath,
          hash, changeSummary, updatedBy, now
        );

        // Update FTS5
        const stmtFtsDel = this.dbManager.prepare(`DELETE FROM resources_fts WHERE resource_id = ?`);
        stmtFtsDel.run(id);

        const stmtFtsIns = this.dbManager.prepare(`
          INSERT INTO resources_fts (resource_id, title, description, tags, content_text)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmtFtsIns.run(id, titleToSave, descToSave, tagsToSave, contentText);

        if (provenance) this._insertProvenance(id, nextVersion, provenance, id, current.current_version, now);
      } else {
        // Just update FTS metadata if title/desc/tags changed without content
        const stmtFtsDel = this.dbManager.prepare(`DELETE FROM resources_fts WHERE resource_id = ?`);
        stmtFtsDel.run(id);

        const stmtFtsIns = this.dbManager.prepare(`
          INSERT INTO resources_fts (resource_id, title, description, tags, content_text)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmtFtsIns.run(id, titleToSave, descToSave, tagsToSave, current.content);
      }

      // Update resource master row
      const stmtResource = this.dbManager.prepare(`
        UPDATE resources
        SET title = ?, description = ?, pedagogical_role = ?, current_version = ?, tags = ?, updated_at = ?
        WHERE id = ?
      `);
      stmtResource.run(titleToSave, descToSave, roleToSave, nextVersion, tagsToSave, now, id);

      return this.getMaterial(id);
    });
  }

  _insertProvenance(resourceId, versionNumber, provenance, fallbackBaseResourceId, fallbackBaseVersionNumber, now) {
    const sourceSet = Array.isArray(provenance.sourceSet) ? provenance.sourceSet : null;
    const configurationSnapshot = provenance.configurationSnapshot || null;
    const provId = `prov-${crypto.randomUUID()}`;
    this.dbManager.prepare(`
      INSERT INTO provenance (
        id, resource_id, version_number, provenance_type, base_resource_id,
        base_version_number, model, prompt, telemetry_json, source_set_json,
        configuration_snapshot_json, prompt_template_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      provId, resourceId, versionNumber, provenance.type || ProvenanceKinds.MANUAL,
      provenance.baseResourceId || fallbackBaseResourceId || null,
      provenance.baseVersionNumber || fallbackBaseVersionNumber || null,
      provenance.model || null, provenance.prompt || null,
      provenance.telemetry ? JSON.stringify(provenance.telemetry) : null,
      sourceSet ? JSON.stringify(sourceSet) : null,
      configurationSnapshot ? JSON.stringify(configurationSnapshot) : null,
      provenance.promptTemplateVersion || null,
      now
    );
    if (sourceSet) {
      this.dbManager.prepare(`
        INSERT INTO artifact_source_sets (
          id, resource_id, version_number, source_set_json,
          configuration_snapshot_json, prompt_template_version, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `sourceset-${crypto.randomUUID()}`, resourceId, versionNumber,
        JSON.stringify(sourceSet),
        configurationSnapshot ? JSON.stringify(configurationSnapshot) : null,
        provenance.promptTemplateVersion || null,
        now
      );
    }
  }

  getMaterialVersionHistory(id) {
    this.getMaterial(id); // Ensure exists
    const stmt = this.dbManager.prepare(`
      SELECT v.*, p.provenance_type, p.model, p.prompt,
        p.source_set_json, p.configuration_snapshot_json, p.prompt_template_version,
        s.source_set_json AS artifact_source_set_json
      FROM resource_versions v
      LEFT JOIN provenance p ON v.resource_id = p.resource_id AND v.version_number = p.version_number
      LEFT JOIN artifact_source_sets s ON v.resource_id = s.resource_id AND v.version_number = s.version_number
      WHERE v.resource_id = ?
      ORDER BY v.version_number DESC
    `);
    return stmt.all(id);
  }

  /* -------------------------------------------------------------------------- */
  /* MOVE, DUPLICATE & REORGANIZATION                                           */
  /* -------------------------------------------------------------------------- */

  moveMaterial(id, { classId = undefined, subjectId = undefined, lessonId = undefined, collectionId = undefined }) {
    const current = this.getMaterial(id);
    const now = new Date().toISOString();

    const targetClassId = classId !== undefined ? classId : current.class_id;
    const targetSubjectId = subjectId !== undefined ? subjectId : current.subject_id;
    const targetLessonId = lessonId !== undefined ? lessonId : current.lesson_id;

    return this.dbManager.transaction(() => {
      const stmt = this.dbManager.prepare(`
        UPDATE resources
        SET class_id = ?, subject_id = ?, lesson_id = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(targetClassId, targetSubjectId, targetLessonId, now, id);

      if (collectionId !== undefined && this.orgService) {
        if (collectionId) {
          this.orgService.addResourceToCollection(collectionId, id);
        }
      }

      return this.getMaterial(id);
    });
  }

  duplicateMaterial(id, { newTitle = null, targetLessonId = undefined, targetClassId = undefined } = {}) {
    const source = this.getMaterial(id);
    const title = newTitle || `${source.title} (Copy)`;

    return this.createMaterial({
      title,
      contentText: source.content,
      description: source.description,
      pedagogicalRole: source.pedagogical_role,
      resourceType: source.resource_type,
      format: source.format,
      classId: targetClassId !== undefined ? targetClassId : source.class_id,
      subjectId: source.subject_id,
      lessonId: targetLessonId !== undefined ? targetLessonId : source.lesson_id,
      tags: [...source.tags, 'duplicated'],
      originType: 'duplicate',
      originUri: `material://${source.id}`,
      changeSummary: `Duplicated from ${source.id} v${source.current_version}`,
      provenance: {
        type: ProvenanceKinds.DUPLICATED,
        baseResourceId: source.id,
        baseVersionNumber: source.current_version,
        prompt: `Duplicated from material ${source.id}`
      }
    });
  }

  /* -------------------------------------------------------------------------- */
  /* ARCHIVE, RESTORE & DELETE                                                  */
  /* -------------------------------------------------------------------------- */

  archiveMaterial(id) {
    this.getMaterial(id);
    const now = new Date().toISOString();
    const stmt = this.dbManager.prepare(`
      UPDATE resources SET status = 'archived', updated_at = ? WHERE id = ?
    `);
    stmt.run(now, id);
    return this.getMaterial(id);
  }

  restoreMaterial(id) {
    this.getMaterial(id);
    const now = new Date().toISOString();
    const stmt = this.dbManager.prepare(`
      UPDATE resources SET status = 'active', updated_at = ? WHERE id = ?
    `);
    stmt.run(now, id);
    return this.getMaterial(id);
  }

  deleteMaterial(id, { permanent = false } = {}) {
    this.getMaterial(id);
    if (!permanent) {
      // Soft-delete to trash
      const now = new Date().toISOString();
      const stmt = this.dbManager.prepare(`
        UPDATE resources SET status = 'trashed', updated_at = ? WHERE id = ?
      `);
      stmt.run(now, id);
      return { success: true, id, status: 'trashed' };
    }

    // Plan FileStore cleanup before changing authoritative database state.
    // Raw attachment blobs can be shared, so delete only when no other
    // material's provenance still references the same normalized path.
    const versionRows = this.dbManager.prepare(`
      SELECT file_path FROM resource_versions WHERE resource_id = ? AND file_path IS NOT NULL
    `).all(id);
    const ownProvenance = this.dbManager.prepare(`
      SELECT telemetry_json FROM provenance WHERE resource_id = ?
    `).all(id);
    const otherProvenance = this.dbManager.prepare(`
      SELECT telemetry_json FROM provenance WHERE resource_id != ?
    `).all(id);
    const storedPath = (row) => {
      try {
        const telemetry = JSON.parse(row.telemetry_json || 'null');
        return typeof telemetry?.storedPath === 'string' ? path.resolve(telemetry.storedPath) : null;
      } catch {
        return null;
      }
    };
    const otherRawPaths = new Set(otherProvenance.map(storedPath).filter(Boolean));
    const ownRawPaths = ownProvenance.map(storedPath).filter(Boolean)
      .filter((filePath) => !otherRawPaths.has(filePath));
    const cleanupPlan = this.fileStore.prepareMaterialDeletion(id, [
      ...versionRows.map((row) => row.file_path),
      ...ownRawPaths
    ]);

    // Resource versions, provenance, collections, publication/authorization
    // rows and assessment source links are handled by explicit deletion and
    // declared FK actions; the FTS index is maintained as a derived projection.
    const result = this.dbManager.transaction(() => {
      this.dbManager.prepare(`DELETE FROM resources_fts WHERE resource_id = ?`).run(id);

      // Internal source records cache snippets and version references. External
      // source snapshots are independent and remain available after unlinking.
      this.dbManager.prepare(`
        DELETE FROM sources WHERE source_type = 'internal_material' AND resource_id = ?
      `).run(id);

      const deletion = this.dbManager.prepare(`DELETE FROM resources WHERE id = ?`).run(id);
      if (Number(deletion.changes) !== 1) throw new NotFoundError('Material', id);
      return { success: true, id, status: 'deleted_permanently' };
    });

    // SQLite and the filesystem cannot share a transaction. The database
    // delete is authoritative; surface any post-commit cleanup failure instead
    // of claiming that the complete permanent deletion succeeded.
    const cleanup = this.fileStore.deletePreparedMaterialFiles(cleanupPlan);
    return { ...result, cleanup };
  }

  /* -------------------------------------------------------------------------- */
  /* PUBLICATION & ASSESSABLE AUTHORIZATION (D4 §46 / D5 §56)                  */
  /* -------------------------------------------------------------------------- */

  publishMaterial(resourceId, {
    versionNumber = null,
    availableUntil = null,
    publishedBy = 'teacher',
    notes = ''
  } = {}) {
    if (!Number.isInteger(versionNumber) || versionNumber < 1) throw new ValidationError('An exact positive versionNumber is required to publish material');
    const material = this.getMaterial(resourceId, versionNumber);
    if (material.status !== 'active') throw new ValidationError('Only active materials can be published');
    if (![PedagogicalRoles.STUDENT_MATERIAL, PedagogicalRoles.SUPPORT_MATERIAL].includes(material.pedagogical_role) ||
        [ResourceTypes.TEACHER_SCRIPT, ResourceTypes.LESSON_PLAN, ResourceTypes.ASSESSMENT].includes(material.resource_type)) {
      throw new ValidationError('Only student-facing Student Material or Support Material can be published for student availability');
    }
    if (availableUntil !== null && (!Number.isFinite(Date.parse(availableUntil)) || Date.parse(availableUntil) <= Date.now())) {
      throw new ValidationError('availableUntil must be a valid future date');
    }

    const event = {
      id: `pub-${crypto.randomUUID()}`,
      resource_id: resourceId,
      version_number: material.selected_version,
      state: 'published',
      pedagogical_role: material.pedagogical_role,
      occurred_at: new Date().toISOString(),
      available_until: availableUntil ? new Date(availableUntil).toISOString() : null,
      actor: publishedBy,
      notes
    };
    this.dbManager.prepare(`
      INSERT INTO material_publication_events
        (id, resource_id, version_number, state, pedagogical_role, occurred_at, available_until, actor, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.resource_id, event.version_number, event.state, event.pedagogical_role,
      event.occurred_at, event.available_until, event.actor, event.notes);
    return { ...event, isAvailable: true };
  }

  unpublishMaterial(resourceId, { versionNumber = null, unpublishedBy = 'teacher', notes = '' } = {}) {
    if (!Number.isInteger(versionNumber) || versionNumber < 1) throw new ValidationError('An exact positive versionNumber is required to unpublish material');
    const material = this.getMaterial(resourceId, versionNumber);
    const publication = this.getVersionPublication(resourceId, material.selected_version);
    if (!publication?.isAvailable) {
      throw new ValidationError(`Material ${resourceId} v${material.selected_version} is not currently published`);
    }
    const event = {
      id: `pub-${crypto.randomUUID()}`,
      resource_id: resourceId,
      version_number: material.selected_version,
      state: 'unpublished',
      pedagogical_role: publication.pedagogical_role,
      occurred_at: new Date().toISOString(),
      available_until: null,
      actor: unpublishedBy,
      notes
    };
    this.dbManager.prepare(`
      INSERT INTO material_publication_events
        (id, resource_id, version_number, state, pedagogical_role, occurred_at, available_until, actor, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.resource_id, event.version_number, event.state, event.pedagogical_role,
      event.occurred_at, event.available_until, event.actor, event.notes);
    return { ...event, isAvailable: false };
  }

  getVersionPublication(resourceId, versionNumber, { at = new Date() } = {}) {
    const material = this.getMaterial(resourceId, versionNumber);
    const atIso = (at instanceof Date ? at : new Date(at)).toISOString();
    const event = this.dbManager.prepare(`
      SELECT * FROM material_publication_events
      WHERE resource_id = ? AND version_number = ? AND occurred_at <= ?
      ORDER BY occurred_at DESC, rowid DESC LIMIT 1
    `).get(resourceId, material.selected_version, atIso);
    const isAvailable = Boolean(
      event && event.state === 'published' && material.status === 'active' &&
      (!event.available_until || event.available_until > atIso) &&
      event.pedagogical_role === material.pedagogical_role &&
      [PedagogicalRoles.STUDENT_MATERIAL, PedagogicalRoles.SUPPORT_MATERIAL].includes(event.pedagogical_role) &&
      ![ResourceTypes.TEACHER_SCRIPT, ResourceTypes.LESSON_PLAN, ResourceTypes.ASSESSMENT].includes(material.resource_type)
    );
    return event ? { ...event, isAvailable } : null;
  }

  authorizeAssessable(resourceId, { lessonId = null, authorizedBy = 'teacher', notes = '', versionNumber = null } = {}) {
    if (!Number.isInteger(versionNumber) || versionNumber < 1) throw new ValidationError('An exact positive versionNumber is required for assessability authorization');
    const material = this.getMaterial(resourceId, versionNumber);
    const targetVersion = material.selected_version;

    // Student Material becomes assessable through publication. This explicit
    // authorization path is only for Support Material; private teacher material is never eligible.
    if (material.pedagogical_role !== PedagogicalRoles.SUPPORT_MATERIAL ||
        [ResourceTypes.TEACHER_SCRIPT, ResourceTypes.LESSON_PLAN, ResourceTypes.ASSESSMENT].includes(material.resource_type)) {
      throw new ValidationError('Only Support Material can receive explicit assessability authorization. Student Material is eligible only when its exact version is published; Teacher Material is never eligible.');
    }
    if (!Number.isInteger(targetVersion) || targetVersion < 1) {
      throw new ValidationError('A valid exact material version is required');
    }

    const id = `auth-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    return this.dbManager.transaction(() => {
      const stmtAuth = this.dbManager.prepare(`
        INSERT OR REPLACE INTO assessable_authorizations (
          id, resource_id, version_number, lesson_id, authorized_at, authorized_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmtAuth.run(id, resourceId, targetVersion, lessonId || material.lesson_id, now, authorizedBy, notes);
      return {
        success: true,
        authorizationId: id,
        resourceId,
        versionNumber: targetVersion,
        lessonId: lessonId || material.lesson_id,
        authorizationType: 'explicit_assessable_source',
        sourceRole: material.pedagogical_role,
        authorizedAt: now,
        notes
      };
    });
  }

  isVersionAssessable(resourceId, versionNumber, { lessonId = null } = {}) {
    // Assessment sources must be pinned to an exact immutable version. Omitting
    // it is deliberately not shorthand for "whatever is current".
    if (!Number.isInteger(Number(versionNumber)) || Number(versionNumber) < 1) return false;
    const targetVersion = Number(versionNumber);
    const material = this.getMaterial(resourceId, targetVersion);
    const publication = this.getVersionPublication(resourceId, targetVersion);
    if (!publication?.isAvailable || publication.pedagogical_role !== material.pedagogical_role) return false;

    // Published Student Material is the default Assessable Source Set. Support
    // Material additionally requires a teacher authorization for this version
    // and compatible lesson scope. The legacy assessable_material role itself
    // never constitutes publication or authorization.
    if (material.pedagogical_role === PedagogicalRoles.STUDENT_MATERIAL) return true;
    if (material.pedagogical_role !== PedagogicalRoles.SUPPORT_MATERIAL ||
        [ResourceTypes.TEACHER_SCRIPT, ResourceTypes.LESSON_PLAN, ResourceTypes.ASSESSMENT].includes(material.resource_type)) return false;

    const authorization = this.getAssessableAuthorization(resourceId, targetVersion);
    if (!authorization) return false;
    if (lessonId !== null && authorization.lesson_id !== null && authorization.lesson_id !== lessonId) return false;
    if (lessonId === null && authorization.lesson_id !== null) return false;
    return true;
  }

  getAssessableAuthorization(resourceId, versionNumber = null) {
    const material = this.getMaterial(resourceId);
    const targetVersion = versionNumber !== null ? Number(versionNumber) : material.current_version;
    if (!Number.isInteger(targetVersion) || targetVersion < 1) {
      throw new ValidationError('versionNumber must be a positive integer');
    }
    const stmt = this.dbManager.prepare(`
      SELECT * FROM assessable_authorizations
      WHERE resource_id = ? AND version_number = ?
      ORDER BY authorized_at DESC LIMIT 1
    `);
    return stmt.get(resourceId, targetVersion) || null;
  }

  /* -------------------------------------------------------------------------- */
  /* SEARCH                                                                     */
  /* -------------------------------------------------------------------------- */

  searchMaterials(query, {
    classId = null,
    subjectId = null,
    pedagogicalRole = null,
    status = 'active',
    limit = 20
  } = {}) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return this.listMaterials({ classId, subjectId, pedagogicalRole, status, limit });
    }

    const cleanQuery = query.replace(/[^\w\s\u00C0-\u017F]/g, ' ').trim();
    if (!cleanQuery) return [];

    let sql = `
      SELECT r.*,
        snippet(resources_fts, 4, '<mark>', '</mark>', '...', 20) as snippet,
        bm25(resources_fts) as rank
      FROM resources_fts fts
      JOIN resources r ON fts.resource_id = r.id
      WHERE resources_fts MATCH ?
    `;
    const params = [cleanQuery];

    if (status && status !== 'all') {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (classId) {
      sql += ' AND r.class_id = ?';
      params.push(classId);
    }
    if (subjectId) {
      sql += ' AND r.subject_id = ?';
      params.push(subjectId);
    }
    if (pedagogicalRole) {
      sql += ' AND r.pedagogical_role = ?';
      params.push(pedagogicalRole);
    }

    sql += ' ORDER BY rank ASC LIMIT ?';
    params.push(limit);

    try {
      const stmt = this.dbManager.prepare(sql);
      const rows = stmt.all(...params);
      return rows.map(r => ({
        ...r,
        tags: r.tags ? r.tags.split(',').filter(Boolean) : []
      }));
    } catch {
      // Fallback to LIKE if FTS expression parsing fails
      return this._fallbackLikeSearch(cleanQuery, { classId, subjectId, pedagogicalRole, status, limit });
    }
  }

  _fallbackLikeSearch(term, { classId, subjectId, pedagogicalRole, status, limit }) {
    let sql = `
      SELECT r.*, '' as snippet, 0 as rank
      FROM resources r
      WHERE (r.title LIKE ? OR r.description LIKE ? OR r.tags LIKE ?)
    `;
    const wildcard = `%${term}%`;
    const params = [wildcard, wildcard, wildcard];

    if (status && status !== 'all') {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (classId) {
      sql += ' AND r.class_id = ?';
      params.push(classId);
    }
    if (subjectId) {
      sql += ' AND r.subject_id = ?';
      params.push(subjectId);
    }
    if (pedagogicalRole) {
      sql += ' AND r.pedagogical_role = ?';
      params.push(pedagogicalRole);
    }

    sql += ' ORDER BY r.updated_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.dbManager.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map(r => ({
      ...r,
      tags: r.tags ? r.tags.split(',').filter(Boolean) : []
    }));
  }

  /* -------------------------------------------------------------------------- */
  /* EXPORT                                                                     */
  /* -------------------------------------------------------------------------- */

  exportMaterial(id, { format = 'markdown', versionNumber = null } = {}) {
    const material = this.getMaterial(id, versionNumber);

    if (format === 'json') {
      return {
        mimeType: 'application/json',
        filename: `${material.title.toLowerCase().replace(/\s+/g, '_')}_v${material.selected_version}.json`,
        data: JSON.stringify(material, null, 2)
      };
    }

    if (format === 'text') {
      return {
        mimeType: 'text/plain',
        filename: `${material.title.toLowerCase().replace(/\s+/g, '_')}_v${material.selected_version}.txt`,
        data: `${material.title}\n${'='.repeat(material.title.length)}\nRole: ${material.pedagogical_role}\nVersion: ${material.selected_version}\n\n${material.content}`
      };
    }

    // Default: Markdown with frontmatter
    const md = `---
title: "${material.title}"
role: "${material.pedagogical_role}"
version: ${material.selected_version}
updated_at: "${material.updated_at}"
tags: [${material.tags.map(t => `"${t}"`).join(', ')}]
---

# ${material.title}

${material.content}
`;
    return {
      mimeType: 'text/markdown',
      filename: `${material.title.toLowerCase().replace(/\s+/g, '_')}_v${material.selected_version}.md`,
      data: md
    };
  }
}
