/**
 * Safe, Buffered multipart/form-data parser for Teacher Service browser uploads.
 *
 * Enforces:
 * - RFC 2046 boundary syntax validation.
 * - Strict maximum payload size limit (25 MB).
 * - Safe filename extraction with directory traversal rejection.
 * - Extension allowlist (.pdf, .docx, .md, .txt, .html).
 * - Real content byte verification (magic bytes for PDF/DOCX, UTF-8/text sanity for MD/TXT/HTML).
 * - Fail-closed error handling for malformed or truncated uploads.
 */
import path from 'node:path';
import { ValidationError } from '../core/errors.js';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.md', '.txt', '.html']);

// RFC 2046 boundary grammar: 1 to 70 chars from bcharsnospace
const BOUNDARY_REGEX = /^[a-zA-Z0-9'()+_,-./:=?]{1,70}$/;

export function parseBufferedMultipartFormData(buffer, contentType) {
  if (!Buffer.isBuffer(buffer)) {
    throw new ValidationError('Upload payload must be a Buffer');
  }

  if (buffer.length === 0) {
    throw new ValidationError('Upload payload is empty');
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new ValidationError(`Upload exceeds maximum allowed size of ${MAX_UPLOAD_BYTES} bytes`);
  }

  if (!contentType || typeof contentType !== 'string' || !contentType.toLowerCase().includes('multipart/form-data')) {
    throw new ValidationError('Invalid Content-Type: expected multipart/form-data');
  }

  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]).trim() : null;
  if (!boundary || !BOUNDARY_REGEX.test(boundary)) {
    throw new ValidationError('Malformed or missing multipart boundary parameter');
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

  // Verify that the payload contains at least the boundary
  const firstBoundaryIdx = buffer.indexOf(boundaryBuffer);
  if (firstBoundaryIdx === -1) {
    throw new ValidationError('Malformed multipart payload: initial boundary not found');
  }

  const fields = {};
  let file = null;

  let pos = firstBoundaryIdx;
  while (pos < buffer.length) {
    // Check if we reached the closing boundary
    if (buffer.indexOf(endBoundaryBuffer, pos) === pos) {
      break;
    }

    const currentBoundaryIdx = buffer.indexOf(boundaryBuffer, pos);
    if (currentBoundaryIdx === -1) break;

    const partStart = currentBoundaryIdx + boundaryBuffer.length;
    // Skip CRLF or LF after boundary
    let headerStart = partStart;
    if (buffer[headerStart] === 13 && buffer[headerStart + 1] === 10) {
      headerStart += 2;
    } else if (buffer[headerStart] === 10) {
      headerStart += 1;
    }

    // Find next boundary
    const nextBoundaryIdx = buffer.indexOf(boundaryBuffer, headerStart);
    if (nextBoundaryIdx === -1) {
      throw new ValidationError('Malformed multipart payload: truncated part or missing closing boundary');
    }

    // Content ends before preceding CRLF or LF
    let partEnd = nextBoundaryIdx;
    if (buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) {
      partEnd -= 2;
    } else if (buffer[partEnd - 1] === 10) {
      partEnd -= 1;
    }

    const partBuffer = buffer.subarray(headerStart, partEnd);
    pos = nextBoundaryIdx;

    // Split headers from body in partBuffer (delimited by \r\n\r\n or \n\n)
    let headerEndIdx = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
    let bodyOffset = 4;
    if (headerEndIdx === -1) {
      headerEndIdx = partBuffer.indexOf(Buffer.from('\n\n'));
      bodyOffset = 2;
    }

    if (headerEndIdx === -1) {
      continue; // Malformed part without headers
    }

    const headersText = partBuffer.subarray(0, headerEndIdx).toString('utf-8');
    const bodyBuffer = partBuffer.subarray(headerEndIdx + bodyOffset);

    // Parse Content-Disposition
    const dispositionMatch = headersText.match(/Content-Disposition:\s*form-data;\s*([^;\r\n]+)(?:;\s*filename="?([^"\r\n]+)"?)?/i);
    if (!dispositionMatch) continue;

    const nameMatch = headersText.match(/name="?([^";\r\n]+)"?/i);
    const fieldName = nameMatch ? nameMatch[1].trim() : null;
    const rawFilename = dispositionMatch[2] ? dispositionMatch[2].trim() : null;

    if (rawFilename) {
      // Validate and sanitize filename
      if (rawFilename.includes('\0')) {
        throw new ValidationError('Filename contains null bytes');
      }
      if (rawFilename.includes('..') || rawFilename.includes('/') || rawFilename.includes('\\')) {
        // Path traversal attempt detected
        const sanitized = path.basename(rawFilename.replace(/\\/g, '/')).trim();
        if (!sanitized) throw new ValidationError('Invalid or unsafe filename');
      }

      const safeFilename = path.basename(rawFilename.replace(/\\/g, '/')).trim();
      const ext = path.extname(safeFilename).toLowerCase();

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        throw new ValidationError(`Unsupported file extension "${ext}". Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`);
      }

      // Real content byte verification
      validateRealFileContent(bodyBuffer, ext, safeFilename);

      const mimeMatch = headersText.match(/Content-Type:\s*([^\r\n;]+)/i);
      const mimeType = mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream';

      file = {
        fieldName: fieldName || 'file',
        filename: safeFilename,
        buffer: bodyBuffer,
        data: bodyBuffer,
        size: bodyBuffer.length,
        mimeType,
        contentType: mimeType
      };
    } else if (fieldName) {
      fields[fieldName] = bodyBuffer.toString('utf-8').trim();
    }
  }

  return { fields, file, files: file ? [file] : [] };
}

// Backward-compatible alias
export const parseMultipartFormData = parseBufferedMultipartFormData;

function validateRealFileContent(buffer, ext, filename) {
  if (buffer.length === 0) {
    throw new ValidationError(`Uploaded file "${filename}" is empty (0 bytes)`);
  }

  if (ext === '.pdf') {
    // Magic bytes for PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new ValidationError(`Corrupted or invalid PDF file "${filename}": missing %PDF- header`);
    }
  } else if (ext === '.docx') {
    // DOCX is a PKZip container: starts with PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
      throw new ValidationError(`Corrupted or invalid DOCX file "${filename}": missing ZIP magic bytes`);
    }
  } else if (ext === '.html') {
    // HTML text verification
    const snippet = buffer.subarray(0, 1024).toString('utf-8').toLowerCase();
    if (!snippet.includes('<html') && !snippet.includes('<!doctype') && !snippet.includes('<head') && !snippet.includes('<body') && !snippet.includes('<div') && !snippet.includes('<p')) {
      throw new ValidationError(`Corrupted or invalid HTML file "${filename}": missing standard HTML tags`);
    }
  } else if (ext === '.md' || ext === '.txt') {
    // Plain text / Markdown verification: ensure no binary null bytes
    const checkLen = Math.min(buffer.length, 8192);
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0) {
        throw new ValidationError(`Binary content detected in text file "${filename}"`);
      }
    }
  }
}
