/**
 * Teacher Service — Real File Import & Export Service
 *
 * Implements real attachment processing and multi-format exports:
 * - Real file ingestion (PDF via pdftotext, DOCX via pandoc, Markdown, Text, HTML)
 * - ChatGPT file-reference imports with strict SSRF protection and IP pinning
 * - Safe binary storage of original files with SHA-256 verification
 * - Reusable export generation (Markdown with frontmatter, Plain Text, JSON, HTML, DOCX)
 * - Provenance and versioning tracking
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { NotFoundError, ValidationError, SecurityError } from '../core/errors.js';
import { ContentFormats, PedagogicalRoles, ResourceTypes, ProvenanceKinds } from '../core/contracts.js';
import { resolvePublicAddresses, fetchHttpsPinned } from '../network/file-import-network.js';

export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

function escapeHtmlText(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class FileService {
  /**
   * @param {import('./material-service.js').MaterialService} materialService
   * @param {import('../storage/filestore.js').FileStore} fileStore
   * @param {Object} [options]
   * @param {Function} [options.fetchImpl]
   * @param {Function} [options.lookupImpl]
   * @param {string[]|string} [options.allowedChatGPTFileHosts]
   * @param {boolean} [options.allowAzureBlobAccounts]
   * @param {number} [options.maxFileSize]
   */
  constructor(materialService, fileStore, options = {}) {
    this.materialService = materialService;
    this.fileStore = fileStore;
    this.fetchImpl = options.fetchImpl || null;
    this.lookupImpl = options.lookupImpl || undefined;
    this.allowAzureBlobAccounts = options.allowAzureBlobAccounts !== false;

    const configuredHosts = options.allowedChatGPTFileHosts
      ?? process.env.TEACHER_SERVICE_CHATGPT_FILE_HOSTS
      ?? 'files.oaiusercontent.com,oaisdmntprnortheu.blob.core.windows.net';
    this.allowedFileHosts = (Array.isArray(configuredHosts) ? configuredHosts : configuredHosts.split(','))
      .map(h => h.trim().toLowerCase())
      .filter(Boolean);

    this.maxFileSize = options.maxFileSize || MAX_ATTACHMENT_SIZE_BYTES;
  }

  /**
   * Extract readable text and detect content format from raw bytes
   *
   * @param {Buffer} rawBytes
   * @param {string} originalName
   * @param {string} [declaredMime]
   * @returns {{ extractedText: string, detectedFormat: string, extractor: string, detectedMime: string }}
   */
  _extractTextAndDetectFormat(rawBytes, originalName, declaredMime = null) {
    if (!rawBytes || rawBytes.length === 0) {
      throw new ValidationError(`The file "${originalName}" is empty (0 bytes).`);
    }

    const ext = path.extname(originalName).toLowerCase();
    const tmpDir = os.tmpdir();
    const tempFile = path.join(tmpDir, `ts-extract-${crypto.randomUUID()}-${originalName}`);
    fs.writeFileSync(tempFile, rawBytes);

    try {
      let extractedText = '';
      let detectedFormat = ContentFormats.TEXT;
      let extractor = 'utf8-text';
      let detectedMime = declaredMime || 'application/octet-stream';

      // 1. PDF detection (magic bytes %PDF- or .pdf extension)
      const isPdfMagic = rawBytes.length >= 5 && rawBytes.subarray(0, 5).toString('ascii') === '%PDF-';
      if (isPdfMagic || ext === '.pdf') {
        detectedMime = 'application/pdf';
        const pdftotextProc = spawnSync('pdftotext', ['-layout', tempFile, '-'], {
          encoding: 'utf8',
          maxBuffer: 25 * 1024 * 1024
        });
        if (pdftotextProc.status === 0 && typeof pdftotextProc.stdout === 'string') {
          extractedText = pdftotextProc.stdout.trim();
          detectedFormat = ContentFormats.TEXT;
          extractor = 'pdftotext';
        } else {
          throw new ValidationError(`Failed to extract text from PDF "${originalName}": pdftotext exited with status ${pdftotextProc.status}. ${pdftotextProc.stderr || ''}`.trim());
        }
      }
      // 2. DOCX detection (magic bytes PK\x03\x04 or .docx extension)
      else if ((rawBytes.length >= 4 && rawBytes[0] === 0x50 && rawBytes[1] === 0x4B && rawBytes[2] === 0x03 && rawBytes[3] === 0x04) || ext === '.docx') {
        detectedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const pandocProc = spawnSync('pandoc', ['-f', 'docx', '-t', 'markdown', tempFile], {
          encoding: 'utf8',
          maxBuffer: 25 * 1024 * 1024
        });
        if (pandocProc.status === 0 && typeof pandocProc.stdout === 'string') {
          extractedText = pandocProc.stdout.trim();
          detectedFormat = ContentFormats.MARKDOWN;
          extractor = 'pandoc-docx';
        } else {
          throw new ValidationError(`Failed to extract text from DOCX "${originalName}": pandoc exited with status ${pandocProc.status}. ${pandocProc.stderr || ''}`.trim());
        }
      }
      // 3. HTML detection
      else if (ext === '.html' || ext === '.htm' || declaredMime === 'text/html') {
        detectedMime = 'text/html';
        const pandocProc = spawnSync('pandoc', ['-f', 'html', '-t', 'markdown', tempFile], {
          encoding: 'utf8',
          maxBuffer: 25 * 1024 * 1024
        });
        if (pandocProc.status === 0 && typeof pandocProc.stdout === 'string') {
          extractedText = pandocProc.stdout.trim();
          detectedFormat = ContentFormats.MARKDOWN;
          extractor = 'pandoc-html';
        } else {
          extractedText = rawBytes.toString('utf8').trim();
          detectedFormat = ContentFormats.HTML;
          extractor = 'raw-html';
        }
      }
      // 4. Markdown detection
      else if (ext === '.md' || ext === '.markdown' || declaredMime === 'text/markdown' || declaredMime === 'text/x-markdown') {
        detectedMime = 'text/markdown';
        extractedText = rawBytes.toString('utf8').trim();
        detectedFormat = ContentFormats.MARKDOWN;
        extractor = 'utf8-markdown';
      }
      // 5. JSON detection
      else if (ext === '.json' || declaredMime === 'application/json') {
        detectedMime = 'application/json';
        extractedText = rawBytes.toString('utf8').trim();
        detectedFormat = ContentFormats.JSON;
        extractor = 'utf8-json';
      }
      // 6. Plain text fallback
      else {
        detectedMime = 'text/plain';
        extractedText = rawBytes.toString('utf8').trim();
        detectedFormat = ContentFormats.TEXT;
        extractor = 'utf8-text';
      }

      if (!extractedText || extractedText.trim() === '') {
        throw new ValidationError(`The file "${originalName}" contains no readable text or is empty.`);
      }

      return { extractedText, detectedFormat, extractor, detectedMime };
    } finally {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch {}
      }
    }
  }

  /**
   * Imports a real file attachment from a verified ChatGPT file reference.
   * Enforces fail-closed host allowlists, DNS resolution with SSRF blocklist, IP pinning,
   * size limits, binary SHA-256 preservation, text extraction, and material versioning.
   *
   * @param {Object} file - ChatGPT file reference
   * @param {string} file.download_url
   * @param {string} file.file_id
   * @param {string} [file.file_name]
   * @param {string} [file.mime_type]
   * @param {Object} [options]
   * @param {string} [options.title]
   * @param {string} [options.pedagogicalRole]
   * @param {string} [options.classId]
   * @param {string} [options.subjectId]
   * @param {string} [options.lessonId]
   * @param {string[]} [options.tags]
   */
  async importAttachmentFromChatGPTFile(file, options = {}) {
    if (!file || typeof file !== 'object' || Array.isArray(file)) {
      throw new ValidationError('ChatGPT file input must be a file reference object');
    }
    const { download_url: downloadUrl, file_id: fileId, file_name: fileName, mime_type: mimeType } = file;
    if (typeof fileId !== 'string' || !fileId || typeof downloadUrl !== 'string' || !downloadUrl) {
      throw new ValidationError('ChatGPT did not provide a complete file reference (file_id and download_url). Re-attach the file or upload file content.');
    }

    let url;
    try {
      url = new URL(downloadUrl);
    } catch {
      throw new ValidationError('ChatGPT file download URL is invalid');
    }

    const hostname = url.hostname.toLowerCase();
    const rejectedReasons = [];
    if (url.protocol !== 'https:') rejectedReasons.push('HTTPS_REQUIRED');
    if (url.username || url.password) rejectedReasons.push('URL_CREDENTIALS_NOT_ALLOWED');
    if (url.port && url.port !== '443') rejectedReasons.push('NONSTANDARD_PORT_NOT_ALLOWED');

    const isAzureBlobAccountHost = /^[a-z0-9]{3,24}\.blob\.core\.windows\.net$/.test(hostname);
    if (!this.allowedFileHosts.includes(hostname) && !(this.allowAzureBlobAccounts && isAzureBlobAccountHost)) {
      rejectedReasons.push('HOST_NOT_ALLOWLISTED');
    }

    if (rejectedReasons.length > 0) {
      // Diagnostic strictly excludes path/token to prevent credential leakage
      throw new SecurityError(
        `ChatGPT file URL rejected (${rejectedReasons.join(', ')}; hostname "${hostname}")`,
        { hostname, protocol: url.protocol, reasons: rejectedReasons }
      );
    }

    const signal = AbortSignal.timeout(30_000);
    let pinnedAddresses;
    try {
      pinnedAddresses = await resolvePublicAddresses(hostname, { lookupImpl: this.lookupImpl, signal });
    } catch (err) {
      if (err instanceof SecurityError) throw err;
      throw new ValidationError(`ChatGPT file download failed: ${err?.name === 'TimeoutError' ? 'request timed out' : 'host unavailable'}`);
    }

    let response;
    try {
      response = this.fetchImpl
        ? await this.fetchImpl(url, { method: 'GET', redirect: 'manual', signal, pinnedAddresses })
        : await fetchHttpsPinned(url, pinnedAddresses, signal);
    } catch (err) {
      throw new ValidationError(`ChatGPT file download failed: ${err.name === 'TimeoutError' ? 'request timed out' : 'host unavailable'}`);
    }

    if (response.status < 200 || response.status >= 300 || response.redirected === true) {
      try { await response.body?.cancel?.(); } catch {}
      throw new ValidationError(`ChatGPT file download returned HTTP ${response.status}; redirects and non-success responses are not followed`);
    }

    if (response.url) {
      let finalUrl;
      try { finalUrl = new URL(response.url); } catch {
        throw new SecurityError('ChatGPT file response has an invalid final URL');
      }
      if (
        finalUrl.protocol !== 'https:' ||
        finalUrl.username ||
        finalUrl.password ||
        (finalUrl.port && finalUrl.port !== '443') ||
        finalUrl.hostname.toLowerCase() !== url.hostname.toLowerCase()
      ) {
        try { await response.body?.cancel?.(); } catch {}
        throw new SecurityError('ChatGPT file response escaped the configured HTTPS host allowlist');
      }
    }

    const contentLength = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(contentLength) && contentLength > this.maxFileSize) {
      try { await response.body?.cancel?.(); } catch {}
      throw new SecurityError(`ChatGPT file exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    const chunks = [];
    let total = 0;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > this.maxFileSize) {
            await reader.cancel();
            throw new SecurityError(`ChatGPT file exceeds maximum allowed size of ${this.maxFileSize} bytes`);
          }
          chunks.push(Buffer.from(value));
        }
      } catch (err) {
        try { await reader.cancel(); } catch {}
        if (err instanceof SecurityError) throw err;
        throw new ValidationError('ChatGPT file download stream failed before completion');
      } finally {
        try { reader.releaseLock(); } catch {}
      }
    } else {
      let arrayBuffer;
      try { arrayBuffer = await response.arrayBuffer(); }
      catch { throw new ValidationError('ChatGPT file download body could not be read'); }
      const data = Buffer.from(arrayBuffer);
      if (data.length > this.maxFileSize) {
        throw new SecurityError(`ChatGPT file exceeds maximum allowed size of ${this.maxFileSize} bytes`);
      }
      chunks.push(data);
      total = data.length;
    }

    const rawBytes = Buffer.concat(chunks, total);
    if (rawBytes.length === 0) {
      throw new ValidationError('Downloaded file is empty (0 bytes)');
    }

    const sanitizedFilename = typeof fileName === 'string' && fileName
      ? path.basename(fileName.replace(/[\u0000-\u001f\u007f]/g, '').trim())
      : `attachment-${fileId.slice(0, 8)}.bin`;

    const { extractedText, detectedFormat, extractor, detectedMime } = this._extractTextAndDetectFormat(rawBytes, sanitizedFilename, mimeType);

    // Save original binary file into FileStore with SHA-256
    const rawHash = crypto.createHash('sha256').update(rawBytes).digest('hex');
    const storedFileName = `attachment-${rawHash.slice(0, 16)}-${sanitizedFilename}`;
    const savedPath = this.fileStore.saveFile(storedFileName, rawBytes);

    const ext = path.extname(sanitizedFilename);
    const effectiveTitle = (typeof options.title === 'string' && options.title.trim())
      ? options.title.trim()
      : path.basename(sanitizedFilename, ext);

    const pedagogicalRole = options.pedagogicalRole || PedagogicalRoles.SUPPORT_MATERIAL;

    const material = this.materialService.createMaterial({
      title: effectiveTitle,
      contentText: extractedText,
      description: `Imported from ChatGPT attachment ${sanitizedFilename} (${(rawBytes.length / 1024).toFixed(1)} KB)`,
      pedagogicalRole,
      resourceType: ResourceTypes.CUSTOM,
      format: detectedFormat,
      classId: options.classId || null,
      subjectId: options.subjectId || null,
      lessonId: options.lessonId || null,
      tags: [...(options.tags || []), 'chatgpt_attachment', 'imported_file', ext.replace('.', '').toLowerCase()].filter(Boolean),
      originType: 'chatgpt_attachment',
      originUri: fileId, // Provenance reference; not proof of ingestion
      changeSummary: `Imported ChatGPT attachment via ${extractor}: ${sanitizedFilename}`,
      provenance: {
        type: ProvenanceKinds.IMPORTED,
        prompt: `Imported ChatGPT attachment: ${sanitizedFilename}`,
        telemetry: {
          extractor,
          fileId,
          fileSize: rawBytes.length,
          fileHash: rawHash,
          mimeType: detectedMime,
          storedPath: savedPath
        }
      }
    });

    return {
      status: 'imported',
      id: material.id,
      material,
      extractedTextLength: extractedText.length,
      original_file_sha256: rawHash,
      originalFile: {
        name: sanitizedFilename,
        size: rawBytes.length,
        hash: rawHash,
        storedPath: savedPath,
        format: detectedFormat,
        mimeType: detectedMime
      }
    };
  }

  /**
   * Import a document from disk, base64, or file reference into Teacher Service.
   * Note: filePath is rejected if isRemote is set to prevent arbitrary server path access.
   */
  importFile({
    file = null,
    filePath = null,
    fileBuffer = null,
    fileBase64 = null,
    fileBufferBase64 = null,
    filename = null,
    title = null,
    pedagogicalRole = PedagogicalRoles.SUPPORT_MATERIAL,
    classId = null,
    subjectId = null,
    lessonId = null,
    tags = [],
    isRemote = false
  }) {
    if (file) {
      return this.importAttachmentFromChatGPTFile(file, {
        title,
        pedagogicalRole,
        classId,
        subjectId,
        lessonId,
        tags
      });
    }

    if (isRemote && filePath) {
      throw new ValidationError('Remote MCP invocation cannot access server filesystem paths. Use import_attachment_file with a ChatGPT file reference or upload using fileBufferBase64.');
    }

    let effectiveBuffer = fileBuffer;
    if (!effectiveBuffer && (fileBase64 || fileBufferBase64)) {
      effectiveBuffer = Buffer.from(fileBase64 || fileBufferBase64, 'base64');
    }

    let originalName = filename;
    let rawBytes = null;

    if (filePath) {
      if (!fs.existsSync(filePath)) {
        throw new NotFoundError('Import file on filesystem', filePath);
      }
      originalName = originalName || path.basename(filePath);
      rawBytes = fs.readFileSync(filePath);
    } else if (effectiveBuffer) {
      originalName = originalName || 'imported-document.txt';
      rawBytes = effectiveBuffer;
    } else {
      throw new ValidationError('Either file reference, fileBuffer, fileBufferBase64, or filePath must be provided for import');
    }

    const { extractedText, detectedFormat, extractor, detectedMime } = this._extractTextAndDetectFormat(rawBytes, originalName);

    // Save original binary payload into FileStore
    const rawHash = crypto.createHash('sha256').update(rawBytes).digest('hex');
    const storedFileName = `attachment-${rawHash.slice(0, 16)}-${originalName}`;
    const savedPath = this.fileStore.saveFile(storedFileName, rawBytes);

    const ext = path.extname(originalName).toLowerCase();
    const effectiveTitle = (typeof title === 'string' && title.trim())
      ? title.trim()
      : path.basename(originalName, ext);

    const material = this.materialService.createMaterial({
      title: effectiveTitle,
      contentText: extractedText,
      description: `Imported from ${originalName} (${(rawBytes.length / 1024).toFixed(1)} KB)`,
      pedagogicalRole,
      resourceType: ResourceTypes.CUSTOM,
      format: detectedFormat,
      classId,
      subjectId,
      lessonId,
      tags: [...tags, 'imported_file', ext.replace('.', '')].filter(Boolean),
      originType: 'file_import',
      originUri: originalName,
      changeSummary: `File imported via ${extractor}: ${originalName}`,
      provenance: {
        type: ProvenanceKinds.IMPORTED,
        prompt: `Imported file: ${originalName}`,
        telemetry: {
          extractor,
          fileSize: rawBytes.length,
          fileHash: rawHash,
          mimeType: detectedMime,
          storedPath: savedPath
        }
      }
    });

    return {
      status: 'imported',
      id: material.id,
      ...material,
      material,
      extractedTextLength: extractedText.length,
      original_file_sha256: rawHash,
      originalFile: {
        name: originalName,
        size: rawBytes.length,
        hash: rawHash,
        storedPath: savedPath,
        format: detectedFormat,
        mimeType: detectedMime
      }
    };
  }

  /**
   * Export material as a downloadable file
   *
   * @param {string} resourceId
   * @param {'markdown'|'text'|'json'|'html'|'docx'} format
   * @param {Object} [options]
   * @param {boolean} [options.includeTeacherSolutions=true]
   * @returns {{ data: Buffer|string, filename: string, mimeType: string, isBinary: boolean }}
   */
  exportMaterialFile(resourceId, format = ContentFormats.MARKDOWN, { includeTeacherSolutions = true } = {}) {
    const material = this.materialService.getMaterial(resourceId, null, { includeTeacherSolutions });
    const safeTitle = (material.title || 'materiale').toLowerCase().replace(/[^a-z0-9_-]+/gi, '_');

    if (format === 'json') {
      const versions = this.materialService.getMaterialVersionHistory(resourceId);
      const exportObj = {
        resource: material,
        versions,
        exportedAt: new Date().toISOString()
      };
      return {
        data: JSON.stringify(exportObj, null, 2),
        filename: `${safeTitle}.json`,
        mimeType: 'application/json',
        isBinary: false
      };
    }

    if (format === 'text') {
      return {
        data: material.content,
        filename: `${safeTitle}.txt`,
        mimeType: 'text/plain; charset=utf-8',
        isBinary: false
      };
    }

    if (format === 'html') {
      const htmlContent = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtmlText(material.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 2rem auto; padding: 1rem; color: #1e293b; }
    h1, h2, h3 { color: #0f172a; }
    header { border-bottom: 2px solid #e2e8f0; margin-bottom: 2rem; padding-bottom: 1rem; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-size: 0.875rem; }
    pre { background: #f1f5f9; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    .teacher-box { border-left: 4px solid #ef4444; background: #fef2f2; padding: 1rem; margin: 1rem 0; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtmlText(material.title)}</h1>
    <div>
      <span class="badge">${escapeHtmlText(material.pedagogical_role)}</span>
      <span class="badge">${escapeHtmlText(material.format)}</span>
      <span>v${material.version_number}</span>
    </div>
  </header>
  <main>
    <pre>${escapeHtmlText(material.content)}</pre>
  </main>
</body>
</html>`;
      return {
        data: htmlContent,
        filename: `${safeTitle}.html`,
        mimeType: 'text/html; charset=utf-8',
        isBinary: false
      };
    }

    if (format === 'docx') {
      const tmpDir = os.tmpdir();
      const tmpMdPath = path.join(tmpDir, `ts-export-${crypto.randomUUID()}.md`);
      const tmpDocxPath = path.join(tmpDir, `ts-export-${crypto.randomUUID()}.docx`);
      fs.writeFileSync(tmpMdPath, material.content, 'utf8');

      try {
        const pandocProc = spawnSync('pandoc', ['-f', 'markdown', '-t', 'docx', '-o', tmpDocxPath, tmpMdPath]);
        if (pandocProc.status === 0 && fs.existsSync(tmpDocxPath)) {
          const docxBuffer = fs.readFileSync(tmpDocxPath);
          return {
            data: docxBuffer,
            filename: `${safeTitle}.docx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            isBinary: true
          };
        } else {
          return {
            data: material.content,
            filename: `${safeTitle}.md`,
            mimeType: 'text/markdown; charset=utf-8',
            isBinary: false
          };
        }
      } finally {
        if (fs.existsSync(tmpMdPath)) try { fs.unlinkSync(tmpMdPath); } catch {}
        if (fs.existsSync(tmpDocxPath)) try { fs.unlinkSync(tmpDocxPath); } catch {}
      }
    }

    // Default: Markdown with YAML frontmatter
    const frontmatter = `---
title: "${material.title.replace(/"/g, '\\"')}"
pedagogical_role: "${material.pedagogical_role}"
version: ${material.version_number}
class_id: "${material.class_id || ''}"
subject_id: "${material.subject_id || ''}"
lesson_id: "${material.lesson_id || ''}"
exported_at: "${new Date().toISOString()}"
---

${material.content}`;

    return {
      data: frontmatter,
      filename: `${safeTitle}.md`,
      mimeType: 'text/markdown; charset=utf-8',
      isBinary: false
    };
  }
}
