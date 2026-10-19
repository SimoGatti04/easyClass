/**
 * Safe Static File Server for Teacher Service Web Client
 * Supports SPA fallback, MIME type detection, Vite asset hashes, and path traversal protection.
 */
import fs from "node:fs";
import path from "node:path";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

export function createStaticFileHandler({
  rootDir = path.resolve(process.cwd(), "client"),
  distDir = path.resolve(process.cwd(), "client/dist"),
  fallbackIndex = "index.html"
} = {}) {
  // If distDir contains built index.html, prefer distDir
  const resolvedDist = path.resolve(distDir);
  const resolvedClient = path.resolve(rootDir);
  const useDist = fs.existsSync(path.join(resolvedDist, "index.html"));
  const effectiveRoot = useDist ? resolvedDist : resolvedClient;

  return function handleStaticRequest(req, res, pathname) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return true;
    }

    let cleanPath = pathname;
    if (cleanPath === "/" || cleanPath === "/client" || cleanPath === "/client/") {
      cleanPath = "/" + fallbackIndex;
    } else if (cleanPath.startsWith("/client/")) {
      cleanPath = cleanPath.slice("/client".length);
    }

    let safePath = path.normalize(path.join(effectiveRoot, cleanPath));

    if (!safePath.startsWith(effectiveRoot)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return true;
    }

    let filePathToServe = null;
    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      filePathToServe = safePath;
    } else if (!path.extname(pathname)) {
      // SPA route fallback
      const indexPath = path.join(effectiveRoot, fallbackIndex);
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        filePathToServe = indexPath;
      }
    }

    if (!filePathToServe) {
      return false; // Not handled by static server
    }

    const ext = path.extname(filePathToServe).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    try {
      const stat = fs.statSync(filePathToServe);
      const headers = {
        "Content-Type": contentType,
        "Content-Length": stat.size,
        "Cache-Control": filePathToServe.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
        "X-Content-Type-Options": "nosniff"
      };

      res.writeHead(200, headers);
      if (req.method === "HEAD") {
        res.end();
        return true;
      }

      const stream = fs.createReadStream(filePathToServe);
      stream.pipe(res);
      return true;
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
      return true;
    }
  };
}
