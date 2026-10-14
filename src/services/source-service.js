/**
 * Internal and external Source Service (Dossier 04).
 * FOUND, CONSULTED, USED and SAVED are separately recorded; external page text
 * is untrusted data and is never accepted from MCP caller input as consulted.
 */
import crypto from 'node:crypto';
import { NotFoundError, ValidationError } from '../core/errors.js';
import { SourceStates, ResourceTypes, PedagogicalRoles, ContentFormats } from '../core/contracts.js';

const idFor = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const stripTeacherOnly = (text) => String(text || '')
  .replace(/\[TEACHER_ONLY_SOLUTION\][\s\S]*?\[\/TEACHER_ONLY_SOLUTION\]/gi, '')
  .replace(/<!--\s*TEACHER_ONLY_START\s*-->[\s\S]*?<!--\s*TEACHER_ONLY_END\s*-->/gi, '')
  .trim();

function authorityForUrl(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    if (host.endsWith('.gov')) return { level: 'official', basis: 'Government domain suffix; publisher still requires contextual review.' };
    if (host.endsWith('.edu')) return { level: 'academic', basis: 'Academic domain suffix; publisher and document authority require contextual review.' };
    if (['docs.python.org', 'developer.mozilla.org', 'www.rfc-editor.org', 'datatracker.ietf.org', 'www.w3.org'].includes(host)) {
      return { level: 'official', basis: 'Recognized standards or project documentation host.' };
    }
    return { level: 'reference', basis: 'No recognized authority signal; verify publisher before relying on factual claims.' };
  } catch {
    return { level: 'unverified', basis: 'URL could not be parsed.' };
  }
}

function scoreRelevance(query, text) {
  const terms = [...new Set(String(query || '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])];
  if (!terms.length) return 0;
  const haystack = String(text || '').toLowerCase();
  const matches = terms.filter((term) => haystack.includes(term)).length;
  return Math.round((matches / terms.length) * 100) / 100;
}

function authorityRank(level) {
  return ({ official: 4, academic: 3, reference: 2, unverified: 1 })[level] || 0;
}

export class SourceService {
  constructor(dbManager, materialService, orgService = null, webResearchClient = null) {
    this.dbManager = dbManager;
    this.materialService = materialService;
    this.orgService = orgService;
    this.webResearchClient = webResearchClient;
  }

  registerSource({
    sourceType,
    title,
    resourceId = null,
    versionNumber = null,
    url = null,
    contentSnippet = '',
    authorityLevel = 'reference',
    authorityBasis = null,
    relevanceScore = 0,
    notes = ''
  }) {
    if (!title || typeof title !== 'string' || title.trim() === '') throw new ValidationError('Source title is required');
    if (!['internal_material', 'external_web'].includes(sourceType)) throw new ValidationError('sourceType must be "internal_material" or "external_web"');
    if (sourceType === 'internal_material') {
      if (!resourceId) throw new ValidationError('Internal source requires resourceId');
      if (!Number.isInteger(Number(versionNumber)) || Number(versionNumber) < 1) throw new ValidationError('Internal source requires an exact versionNumber');
      // Fail now rather than leave a FOUND record that points at a missing version.
      this.materialService.getMaterial(resourceId, Number(versionNumber));
    } else {
      if (!url || typeof url !== 'string') throw new ValidationError('External source requires a URL');
      // A source registered by URL alone is only FOUND and unverified. MCP
      // callers cannot promote an arbitrary domain or snippet to authority.
      authorityLevel = 'unverified';
      authorityBasis = 'URL registered but not yet retrieved or independently verified.';
    }

    const found = this._findSource({ sourceType, resourceId, versionNumber, url });
    if (found) return found;
    const id = idFor('src');
    const now = new Date().toISOString();
    const stmt = this.dbManager.prepare(`
      INSERT INTO sources (
        id, source_type, resource_id, version_number, url, title, content_snippet,
        authority_level, authority_basis, relevance_score, state, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, sourceType, resourceId, versionNumber, url, title.trim(),
      String(contentSnippet || '').slice(0, 2000), authorityLevel, authorityBasis,
      relevanceScore, SourceStates.FOUND, notes, now, now);
    this._recordEvent(id, SourceStates.FOUND, null, { discovery: sourceType });
    return this.getSource(id);
  }

  getSource(id) {
    const source = this.dbManager.prepare('SELECT * FROM sources WHERE id = ?').get(id);
    if (!source) throw new NotFoundError('Source', id);
    return source;
  }

  getSourceContent(id, versionNumber = null) {
    const source = this.getSource(id);
    if (source.source_type === 'internal_material') {
      const version = versionNumber ?? source.version_number;
      if (!Number.isInteger(Number(version)) || Number(version) < 1) throw new ValidationError('Exact internal source version is required');
      const material = this.materialService.getMaterial(source.resource_id, Number(version));
      return { ...source, versionNumber: Number(version), content: material.content, contentHash: material.content_hash, material };
    }
    const version = Number(versionNumber ?? source.content_version);
    if (!Number.isInteger(version) || version < 1) throw new ValidationError('External source has not been retrieved yet');
    const snapshot = this.dbManager.prepare(`
      SELECT * FROM source_content_versions WHERE source_id = ? AND version_number = ?
    `).get(id, version);
    if (!snapshot) throw new NotFoundError(`External source content version ${version}`, id);
    return { ...source, contentVersionNumber: version, content: snapshot.content_text, contentHash: snapshot.content_hash, snapshot };
  }

  listSources({ state = null, sourceType = null, resourceId = null, url = null } = {}) {
    let sql = 'SELECT * FROM sources WHERE 1=1';
    const params = [];
    if (state) { sql += ' AND state = ?'; params.push(state); }
    if (sourceType) { sql += ' AND source_type = ?'; params.push(sourceType); }
    if (resourceId) { sql += ' AND resource_id = ?'; params.push(resourceId); }
    if (url) { sql += ' AND url = ?'; params.push(url); }
    sql += ' ORDER BY created_at DESC';
    return this.dbManager.prepare(sql).all(...params);
  }

  getSourceHistory(id) {
    this.getSource(id);
    return this.dbManager.prepare(`SELECT * FROM source_state_events WHERE source_id = ? ORDER BY occurred_at ASC, rowid ASC`).all(id);
  }

  async consultSource(id, { relevanceScore = null, signal = null } = {}) {
    const source = this.getSource(id);
    const now = new Date().toISOString();
    if (source.source_type === 'internal_material') {
      const material = this.materialService.getMaterial(source.resource_id, source.version_number);
      const content = material.content;
      const nextState = [SourceStates.USED, SourceStates.SAVED].includes(source.state)
        ? source.state : SourceStates.CONSULTED;
      this.dbManager.prepare(`
        UPDATE sources SET state = ?, content_snippet = ?, content_hash = ?, accessed_at = ?,
          relevance_score = COALESCE(?, relevance_score), updated_at = ? WHERE id = ?
      `).run(nextState, content.slice(0, 2000), material.content_hash, now,
        relevanceScore, now, id);
      this._recordEvent(id, SourceStates.CONSULTED, source.version_number, { sourceType: 'internal_material', versionNumber: source.version_number });
      return { ...this.getSource(id), consultedContent: content, versionNumber: source.version_number, contentHash: material.content_hash };
    }

    if (!this.webResearchClient) throw new ValidationError('External web retrieval is not configured');
    // A caller-supplied body is intentionally not accepted. CONSULTED means
    // this service actually retrieved and inspected the page.
    const page = await this.webResearchClient.fetchPage(source.url, { signal });
    const currentVersion = Number(source.content_version || 0);
    let contentVersion = currentVersion;
    if (!currentVersion || source.content_hash !== page.contentHash) {
      contentVersion = currentVersion + 1;
      this.dbManager.prepare(`
        INSERT INTO source_content_versions (
          id, source_id, version_number, title, url, content_text, content_hash, accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(idFor('srcver'), id, contentVersion, page.title, page.url, page.content, page.contentHash, page.accessedAt);
    }
    const authority = authorityForUrl(page.url);
    const nextState = currentVersion && source.content_hash === page.contentHash &&
      [SourceStates.USED, SourceStates.SAVED].includes(source.state)
      ? source.state : SourceStates.CONSULTED;
    // Caller-supplied metadata must never upgrade the authority of retrieved
    // web content. The URL-based value is only a discovery signal, not proof
    // that any particular claim is true.
    const nextAuthority = authority.level;
    this.dbManager.prepare(`
      UPDATE sources SET title = ?, url = ?, state = ?, content_snippet = ?, content_version = ?,
        content_hash = ?, accessed_at = ?, authority_level = ?, authority_basis = ?,
        relevance_score = COALESCE(?, relevance_score), updated_at = ? WHERE id = ?
    `).run(page.title, page.url, nextState, page.content.slice(0, 2000), contentVersion,
      page.contentHash, page.accessedAt, nextAuthority, authority.basis, relevanceScore, now, id);
    this._recordEvent(id, SourceStates.CONSULTED, contentVersion, { finalUrl: page.url, contentHash: page.contentHash, contentType: page.contentType });
    return { ...this.getSource(id), consultedContent: page.content, contentVersionNumber: contentVersion, contentHash: page.contentHash };
  }

  markSourcesUsed(sourceIds, detailsById = {}) {
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) return [];
    const ids = [...new Set(sourceIds)];
    const now = new Date().toISOString();
    const eligible = ids.map((id) => {
      const source = this.getSource(id);
      const exactVersion = source.source_type === 'internal_material'
        ? source.version_number : source.content_version;
      if (!Number.isInteger(Number(exactVersion)) || Number(exactVersion) < 1 ||
          ![SourceStates.CONSULTED, SourceStates.USED, SourceStates.SAVED].includes(source.state)) {
        throw new ValidationError(`Source ${id} must be retrieved before it can be marked USED`);
      }
      return { id, source, exactVersion: Number(exactVersion) };
    });
    return this.dbManager.transaction(() => eligible.map(({ id, source, exactVersion }) => {
      const nextState = source.state === SourceStates.SAVED ? SourceStates.SAVED : SourceStates.USED;
      this.dbManager.prepare('UPDATE sources SET state = ?, updated_at = ? WHERE id = ?').run(nextState, now, id);
      this._recordEvent(id, SourceStates.USED, exactVersion, detailsById[id] || {});
      return this.getSource(id);
    }));
  }

  saveExternalSource(id, { classId = null, subjectId = null, lessonId = null, tags = ['external_reference'], contentVersionNumber = null } = {}) {
    const source = this.getSource(id);
    if (source.source_type !== 'external_web') throw new ValidationError('Only external web sources can be saved by this operation');
    const version = Number(contentVersionNumber ?? source.content_version);
    if (!Number.isInteger(version) || version < 1) throw new ValidationError('External source must be retrieved before it can be saved');
    const snapshot = this.getSourceContent(id, version);
    const material = this.materialService.createMaterial({
      title: `Fonte: ${snapshot.snapshot.title}`,
      contentText: `# ${snapshot.snapshot.title}\n\n**URL:** ${snapshot.snapshot.url}\n**SHA-256:** ${snapshot.snapshot.content_hash}\n**Consulted:** ${snapshot.snapshot.accessed_at}\n\n## Contenuto estratto (fonte non fidata)\n\n${snapshot.content}`,
      description: `Fonte web effettivamente consultata: ${snapshot.snapshot.url}`,
      pedagogicalRole: PedagogicalRoles.SUPPORT_MATERIAL,
      resourceType: ResourceTypes.REFERENCE_SOURCE,
      format: ContentFormats.MARKDOWN,
      classId, subjectId, lessonId,
      tags: [...tags, 'saved_source'],
      originType: 'external_source',
      originUri: snapshot.snapshot.url
    });
    const now = new Date().toISOString();
    this.dbManager.prepare(`
      UPDATE sources SET state = ?, resource_id = ?, version_number = 1, updated_at = ? WHERE id = ?
    `).run(SourceStates.SAVED, material.id, now, id);
    this._recordEvent(id, SourceStates.SAVED, version, { savedResourceId: material.id, savedResourceVersion: 1 });
    return { source: this.getSource(id), savedMaterial: material };
  }

  searchInternalSources(query, { classId = null, subjectId = null, limit = 10, excludedSourceIds = [] } = {}) {
    const excluded = new Set(excludedSourceIds || []);
    const materials = this.materialService.searchMaterials(query, { classId, subjectId, limit });
    return materials.map((material) => {
      const source = this.registerSource({
        sourceType: 'internal_material',
        resourceId: material.id,
        versionNumber: material.current_version,
        title: material.title,
        contentSnippet: material.content_preview || material.snippet || '',
        authorityLevel: 'reference',
        authorityBasis: 'Teacher Service material; pedagogical role and version remain explicit.',
        relevanceScore: scoreRelevance(query, `${material.title} ${material.description || ''} ${material.content_preview || ''}`)
      });
      return {
        sourceId: source.id,
        sourceType: 'internal_material',
        resourceId: material.id,
        versionNumber: material.current_version,
        title: material.title,
        pedagogicalRole: material.pedagogical_role,
        resourceType: material.resource_type,
        snippet: material.content_preview || material.snippet || '',
        isAssessable: this.materialService.isVersionAssessable(material.id, material.current_version, { lessonId: material.lesson_id || null }),
        state: source.state,
        excluded: excluded.has(source.id) || excluded.has(material.id)
      };
    }).filter((candidate) => !candidate.excluded);
  }

  getPreviousLessonsContext(classId, subjectId, { currentLessonOrder = 9999, limit = 2 } = {}) {
    if (!classId || !subjectId) return [];
    const lessons = this.dbManager.prepare(`
      SELECT l.* FROM lessons l
      WHERE l.class_id = ? AND l.subject_id = ? AND l.order_index < ?
      ORDER BY l.order_index DESC, l.id DESC
      LIMIT ?
    `).all(classId, subjectId, currentLessonOrder, limit);
    return lessons.map((lesson) => {
      const materials = this.materialService.listMaterials({ lessonId: lesson.id, status: 'active', limit: 100 });
      return {
        lessonId: lesson.id,
        title: lesson.title,
        orderIndex: lesson.order_index,
        materials: materials.map((entry) => {
          const material = this.materialService.getMaterial(entry.id, entry.current_version);
          const source = this.registerSource({
            sourceType: 'internal_material',
            resourceId: material.id,
            versionNumber: material.selected_version,
            title: material.title,
            contentSnippet: material.content.slice(0, 300),
            authorityLevel: 'reference',
            authorityBasis: 'Exact Teacher Service material version from a prior lesson.'
          });
          const accessedAt = new Date().toISOString();
          const nextState = [SourceStates.USED, SourceStates.SAVED].includes(source.state)
            ? source.state : SourceStates.CONSULTED;
          this.dbManager.prepare(`
            UPDATE sources SET state = ?, content_snippet = ?, content_hash = ?, accessed_at = ?, updated_at = ?
            WHERE id = ?
          `).run(nextState, material.content.slice(0, 2000), material.content_hash, accessedAt, accessedAt, source.id);
          this._recordEvent(source.id, SourceStates.CONSULTED, material.selected_version, {
            sourceType: 'internal_material', versionNumber: material.selected_version, priorLessonId: lesson.id
          });
          return {
            id: material.id,
            sourceId: source.id,
            title: material.title,
            role: material.pedagogical_role,
            resourceType: material.resource_type,
            version: material.selected_version,
            contentHash: material.content_hash,
            content: material.content,
            lessonId: lesson.id
          };
        })
      };
    });
  }

  async searchWebSources(query, { limit = 5, authorityFilter = null, signal = null } = {}) {
    if (!this.webResearchClient) throw new ValidationError('Web search is not configured');
    const results = await this.webResearchClient.search(query, { limit, signal });
    return results.map((result) => {
      const authority = authorityForUrl(result.url);
      const score = scoreRelevance(query, `${result.title} ${result.snippet}`);
      const source = this.registerSource({
        sourceType: 'external_web', title: result.title, url: result.url,
        contentSnippet: result.snippet,
        authorityLevel: authority.level,
        authorityBasis: authority.basis,
        relevanceScore: score,
        notes: `Discovery provider: ${result.provider || 'configured web search'}`
      });
      return {
        ...source,
        discoveryState: SourceStates.FOUND,
        discovery_authority_level: authority.level,
        discovery_authority_basis: authority.basis,
        relevance_score: score
      };
    }).filter((source) => !authorityFilter || source.discovery_authority_level === authorityFilter);
  }

  async selectGenerationSources({
    query,
    classId = null,
    subjectId = null,
    lessonId = null,
    currentLessonOrder = null,
    requiredSources = [],
    excludedSources = [],
    includePreviousLessons = true,
    previousLessonLimit = 2,
    searchInternal = true,
    searchWeb = false,
    internalSourceLimit = 5,
    webSourceLimit = 3,
    capability = 'teacher_material',
    signal = null
  } = {}) {
    const excludedKeys = new Set();
    const excludedResources = new Set();
    const excludedVersions = new Set();
    const excludedUrls = new Set();
    for (const excluded of excludedSources || []) {
      if (typeof excluded === 'string') {
        excludedKeys.add(excluded);
      } else if (excluded && typeof excluded === 'object') {
        const id = excluded.sourceId || excluded.id;
        if (id) excludedKeys.add(id);
        if (excluded.url) excludedUrls.add(excluded.url);
        if (excluded.resourceId && (excluded.versionNumber ?? excluded.version) !== undefined) {
          excludedVersions.add(`material:${excluded.resourceId}:v${excluded.versionNumber ?? excluded.version}`);
        } else if (excluded.resourceId) {
          excludedResources.add(excluded.resourceId);
        }
      }
    }
    const chosen = new Map();
    const selectionWarnings = [];
    const isExcluded = (source) => excludedKeys.has(source.sourceId) || excludedKeys.has(source.id) ||
      excludedKeys.has(source.resourceId) || excludedResources.has(source.resourceId) ||
      excludedUrls.has(source.url) || (source.resourceId && excludedVersions.has(`material:${source.resourceId}:v${source.versionNumber}`));
    const keyFor = (source) => source.sourceType === 'external_web'
      ? `web:${source.sourceId}`
      : `material:${source.resourceId}:v${source.versionNumber}`;

    const addInternal = async ({ resourceId, versionNumber, required = false, priorLessonId = null }) => {
      if (!resourceId || !Number.isInteger(Number(versionNumber)) || Number(versionNumber) < 1) {
        throw new ValidationError('Selected internal sources require resourceId and an exact positive versionNumber');
      }
      const material = this.materialService.getMaterial(resourceId, Number(versionNumber));
      const source = this.registerSource({
        sourceType: 'internal_material', resourceId, versionNumber: Number(versionNumber),
        title: material.title, contentSnippet: material.content.slice(0, 300),
        authorityLevel: 'reference', authorityBasis: 'Exact Teacher Service material version.'
      });
      const ref = { sourceId: source.id, sourceType: 'internal_material', resourceId, versionNumber: Number(versionNumber), title: material.title, url: null };
      if (isExcluded(ref)) {
        if (required) throw new ValidationError(`Required source ${resourceId} v${versionNumber} is also excluded`);
        return;
      }
      if (chosen.has(keyFor(ref))) return;
      const consulted = await this.consultSource(source.id);
      // Student-facing generation may use a teacher script as pedagogical
      // context, but protected solution blocks are removed in application code
      // before any prompt is built. Assessment uses its separate, stricter
      // publication/authorization path and never comes through this selector.
      const content = ['student_material', 'exercises'].includes(capability)
        ? stripTeacherOnly(material.content)
        : material.content;
      chosen.set(keyFor(ref), {
        ...ref,
        pedagogicalRole: material.pedagogical_role,
        resourceType: material.resource_type,
        classId: material.class_id,
        subjectId: material.subject_id,
        lessonId: material.lesson_id,
        priorLessonId,
        contentHash: material.content_hash,
        content,
        state: consulted.state,
        authorityLevel: consulted.authority_level,
        relevanceScore: scoreRelevance(query, `${material.title} ${material.description || ''} ${content}`),
        required
      });
    };

    // Required source references are resolved first and fail closed on any miss.
    for (const ref of requiredSources || []) {
      if (typeof ref === 'string') {
        const source = this.getSource(ref);
        if (source.source_type === 'internal_material') {
          await addInternal({ resourceId: source.resource_id, versionNumber: source.version_number, required: true });
        } else {
          await this._addRequiredWeb(source.id, chosen, isExcluded, keyFor, signal);
        }
      } else if (ref?.sourceId) {
        const source = this.getSource(ref.sourceId);
        if (source.source_type === 'internal_material') {
          await addInternal({ resourceId: source.resource_id, versionNumber: source.version_number, required: true });
        } else {
          await this._addRequiredWeb(source.id, chosen, isExcluded, keyFor, signal);
        }
      } else if (ref?.url) {
        const registered = this.registerSource({ sourceType: 'external_web', title: ref.title || ref.url, url: ref.url, authorityLevel: 'unverified', authorityBasis: 'Explicit URL supplied by teacher; publisher not independently certified.' });
        if (isExcluded(registered)) throw new ValidationError(`Required source ${ref.url} is also excluded`);
        await this._addRequiredWeb(registered.id, chosen, isExcluded, keyFor, signal);
      } else {
        const resourceId = ref?.resourceId || ref?.id;
        const versionNumber = ref?.versionNumber ?? ref?.version;
        if (!Number.isInteger(Number(versionNumber)) || Number(versionNumber) < 1) {
          throw new ValidationError(`Required material ${resourceId || '(unknown)'} must specify exact versionNumber`);
        }
        await addInternal({ resourceId, versionNumber, required: true });
      }
    }

    if (includePreviousLessons && classId && subjectId) {
      let order = currentLessonOrder;
      if (order === null && lessonId && this.orgService) order = this.orgService.getLesson(lessonId).order_index;
      if (order === null) order = 9999;
      const previous = this.getPreviousLessonsContext(classId, subjectId, { currentLessonOrder: order, limit: previousLessonLimit });
      for (const lesson of previous) {
        for (const material of lesson.materials) {
          await addInternal({ resourceId: material.id, versionNumber: material.version, priorLessonId: lesson.lessonId });
        }
      }
    }

    if (searchInternal && query) {
      const candidates = this.searchInternalSources(query, { classId, subjectId, limit: internalSourceLimit, excludedSourceIds: [...excludedKeys] });
      for (const candidate of candidates) {
        await addInternal({ resourceId: candidate.resourceId, versionNumber: candidate.versionNumber });
      }
    }

    if (searchWeb) {
      const results = await this.searchWebSources(query, { limit: webSourceLimit, signal });
      const candidates = results
        .filter((candidate) => !isExcluded({ ...candidate, sourceId: candidate.id }))
        .sort((a, b) => (authorityRank(b.discovery_authority_level) - authorityRank(a.discovery_authority_level)) || (b.relevance_score - a.relevance_score));
      if (!candidates.length) throw new ValidationError('Web search returned no source candidates after exclusions');
      for (const candidate of candidates) {
        try {
          const consulted = await this.consultSource(candidate.id);
          const exact = this.getSourceContent(candidate.id, consulted.content_version);
          const ref = {
            sourceId: candidate.id,
            sourceType: 'external_web',
            resourceId: null,
            versionNumber: null,
            contentVersionNumber: exact.contentVersionNumber,
            title: exact.snapshot.title,
            url: exact.snapshot.url,
            contentHash: exact.snapshot.content_hash,
            accessedAt: exact.snapshot.accessed_at,
            authorityLevel: consulted.authority_level,
            authorityBasis: consulted.authority_basis,
            relevanceScore: scoreRelevance(query, `${exact.snapshot.title} ${exact.content}`),
            state: SourceStates.CONSULTED,
            content: exact.content,
            required: false
          };
          if (!isExcluded(ref)) chosen.set(keyFor(ref), ref);
        } catch (error) {
          selectionWarnings.push({ sourceId: candidate.id, url: candidate.url, message: error.message });
        }
      }
      if (!candidates.length || ![...chosen.values()].some((source) => source.sourceType === 'external_web')) {
        const detail = selectionWarnings.length ? `: ${selectionWarnings.map((item) => `${item.url}: ${item.message}`).join('; ')}` : '';
        throw new ValidationError(`Web search was requested but no external source could be retrieved${detail}`);
      }
    }

    return [...chosen.values()].map((source, index) => ({
      ...source,
      referenceKey: `S${index + 1}`,
      usageState: SourceStates.CONSULTED,
      trustedInstruction: false,
      selectionWarnings: index === 0 ? selectionWarnings : []
    }));
  }

  async _addRequiredWeb(sourceId, chosen, isExcluded, keyFor, signal) {
    const source = this.getSource(sourceId);
    const consulted = await this.consultSource(sourceId, { signal });
    const exact = this.getSourceContent(sourceId, consulted.content_version);
    const ref = {
      sourceId,
      sourceType: 'external_web',
      resourceId: null,
      versionNumber: null,
      contentVersionNumber: exact.contentVersionNumber,
      title: exact.snapshot.title,
      url: exact.snapshot.url,
      contentHash: exact.snapshot.content_hash,
      accessedAt: exact.snapshot.accessed_at,
      authorityLevel: consulted.authority_level,
      authorityBasis: consulted.authority_basis,
      relevanceScore: source.relevance_score,
      state: SourceStates.CONSULTED,
      content: exact.content,
      required: true
    };
    if (isExcluded(ref)) throw new ValidationError(`Required source ${ref.url} is also excluded`);
    chosen.set(keyFor(ref), ref);
  }

  _findSource({ sourceType, resourceId, versionNumber, url }) {
    if (sourceType === 'internal_material') {
      return this.dbManager.prepare(`
        SELECT * FROM sources WHERE source_type = ? AND resource_id = ? AND version_number = ? ORDER BY created_at ASC LIMIT 1
      `).get(sourceType, resourceId, Number(versionNumber)) || null;
    }
    return this.dbManager.prepare(`
      SELECT * FROM sources WHERE source_type = ? AND url = ? ORDER BY created_at ASC LIMIT 1
    `).get(sourceType, url) || null;
  }

  _recordEvent(sourceId, state, contentVersion = null, details = {}) {
    this.dbManager.prepare(`
      INSERT INTO source_state_events (id, source_id, state, content_version, details_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(idFor('srcevent'), sourceId, state, contentVersion, JSON.stringify(details), new Date().toISOString());
  }
}
