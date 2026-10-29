/**
 * Teacher Service — Filesystem Content & Artifact Store
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class FileStore {
  /**
   * @param {string} baseDir
   */
  constructor(baseDir) {
    this.baseDir = baseDir || process.env.TEACHER_SERVICE_STORAGE_DIR || path.resolve(process.cwd(), 'storage', 'files');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Compute sha256 of text
   */
  hashContent(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Save content snapshot for a resource version
   */
  saveVersionContent(resourceId, versionNumber, contentText, format = 'md') {
    const resourceDir = path.join(this.baseDir, resourceId);
    if (!fs.existsSync(resourceDir)) {
      fs.mkdirSync(resourceDir, { recursive: true });
    }
    const ext = format === 'markdown' ? 'md' : (format || 'txt');
    const filename = `v${String(versionNumber).padStart(4, '0')}.${ext}`;
    const filePath = path.join(resourceDir, filename);

    fs.writeFileSync(filePath, contentText, 'utf8');
    const hash = this.hashContent(contentText);

    return {
      filePath,
      hash,
      bytes: Buffer.byteLength(contentText, 'utf8')
    };
  }

  /**
   * Read content snapshot
   */

  /**
   * Save arbitrary binary or text file to raw storage
   */
  /**
   * Save student attachment file safely
   */
  saveAttachment(filename, buffer) {
    const attachDir = path.join(this.baseDir, 'attachments');
    if (!fs.existsSync(attachDir)) {
      fs.mkdirSync(attachDir, { recursive: true });
    }
    const safeName = path.basename(filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeName}`;
    const filePath = path.join(attachDir, uniqueName);
    fs.writeFileSync(filePath, buffer);
    return {
      filePath,
      filename: safeName,
      bytes: buffer.length
    };
  }

  /** Read a FileStore-relative path only when it resolves to an in-root regular file. */
  readStoredFile(relativePath) {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) {
      throw new Error('Invalid FileStore-relative path');
    }
    const root = fs.realpathSync(this.baseDir);
    const resolved = path.resolve(root, relativePath);
    if (!this._isWithin(root, resolved) || !fs.existsSync(resolved)) {
      throw new Error('Stored file is missing or outside FileStore');
    }
    const stat = fs.lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('Stored path is not a regular FileStore file');
    }
    const realPath = fs.realpathSync(resolved);
    if (!this._isWithin(root, realPath)) {
      throw new Error('Stored file resolves outside FileStore');
    }
    return { buffer: fs.readFileSync(realPath), realPath, size: stat.size };
  }

  /** Remove only one safe regular file under the FileStore root. */
  deleteStoredFile(relativePath) {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) return false;
    const root = fs.realpathSync(this.baseDir);
    const resolved = path.resolve(root, relativePath);
    if (!this._isWithin(root, resolved) || !fs.existsSync(resolved)) return false;
    const stat = fs.lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink() || !this._isWithin(root, fs.realpathSync(resolved))) {
      throw new Error('Refusing to delete an unsafe FileStore path');
    }
    fs.unlinkSync(resolved);
    return true;
  }

  saveFile(filename, buffer) {
    const rawDir = path.join(this.baseDir, "raw");
    if (!fs.existsSync(rawDir)) {
      fs.mkdirSync(rawDir, { recursive: true });
    }
    const filePath = path.join(rawDir, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  /**
   * Read raw file
   */
  readFile(filenameOrPath) {
    const filePath = path.isAbsolute(filenameOrPath)
      ? filenameOrPath
      : path.join(this.baseDir, "raw", filenameOrPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    return fs.readFileSync(filePath);
  }

  readVersionContent(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  }

  /** Validate material-owned paths before a permanent database deletion. */
  prepareMaterialDeletion(resourceId, filePaths = []) {
    if (typeof resourceId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(resourceId)) {
      throw new Error('Invalid material identifier for FileStore cleanup');
    }

    const root = fs.realpathSync(this.baseDir);
    const resourceDirectory = path.resolve(root, resourceId);
    if (!this._isWithin(root, resourceDirectory)) {
      throw new Error('Material directory is outside FileStore');
    }
    if (fs.existsSync(resourceDirectory)) {
      const stat = fs.lstatSync(resourceDirectory);
      if (!stat.isDirectory() || stat.isSymbolicLink() ||
          !this._isWithin(root, fs.realpathSync(resourceDirectory))) {
        throw new Error('Material directory is not a safe FileStore directory');
      }
    }

    const uniquePaths = [...new Set(filePaths.filter((value) => typeof value === 'string' && value.length > 0))];
    for (const filePath of uniquePaths) {
      const resolved = path.resolve(filePath);
      if (!this._isWithin(root, resolved)) {
        throw new Error('Material file path is outside FileStore');
      }
      if (!fs.existsSync(resolved)) continue;
      const stat = fs.lstatSync(resolved);
      if (!stat.isFile() || stat.isSymbolicLink() ||
          !this._isWithin(root, fs.realpathSync(resolved))) {
        throw new Error('Material file path is not a safe regular FileStore file');
      }
    }

    return { resourceId, resourceDirectory, filePaths: uniquePaths };
  }

  /** Remove only the regular files in a previously validated deletion plan. */
  deletePreparedMaterialFiles(plan) {
    let removedCount = 0;
    let missingCount = 0;
    let failureCount = 0;

    for (const filePath of plan.filePaths) {
      try {
        if (!fs.existsSync(filePath)) {
          missingCount++;
          continue;
        }
        const root = fs.realpathSync(this.baseDir);
        const resolved = path.resolve(filePath);
        const stat = fs.lstatSync(resolved);
        if (!stat.isFile() || stat.isSymbolicLink() ||
            !this._isWithin(root, fs.realpathSync(resolved))) {
          failureCount++;
          continue;
        }
        fs.unlinkSync(resolved);
        removedCount++;
      } catch {
        failureCount++;
      }
    }

    try {
      if (fs.existsSync(plan.resourceDirectory)) {
        const root = fs.realpathSync(this.baseDir);
        const stat = fs.lstatSync(plan.resourceDirectory);
        if (stat.isDirectory() && !stat.isSymbolicLink() &&
            this._isWithin(root, fs.realpathSync(plan.resourceDirectory))) {
          fs.rmdirSync(plan.resourceDirectory);
        } else {
          failureCount++;
        }
      }
    } catch {
      // Never recursively remove unknown files from a non-empty resource folder.
      failureCount++;
    }

    return { removedCount, missingCount, failureCount, complete: failureCount === 0 };
  }

  _isWithin(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative !== '' && relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  }
}
