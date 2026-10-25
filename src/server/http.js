/**
 * Teacher Service — MCP Streamable HTTP & Web Server
 *
 * Implements:
 * 1. MCP Streamable HTTP specification over Node.js http.Server
 * 2. Fail-closed Cloudflare Access & OAuth Bearer token authentication for both /mcp and /api/*
 * 3. Session-to-principal isolation
 * 4. Protected Teacher REST API with role-based access control (protecting teacher scripts and solutions)
 * 5. Complete Teacher Management Web Interface with XSS prevention
 */
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../mcp/server.js';
import { authenticateRequest, SessionPrincipalRegistry, validateCsrf } from './auth.js';
import { parseMultipartFormData } from './multipart.js';
import { createStaticFileHandler } from './static.js';
import path from 'node:path';
import { resolveClientIp } from './client-ip.js';
import { ClaimRateLimiter } from './claim-rate-limiter.js';
import { createTeacherPrincipalAuthorizer } from './teacher-authorization.js';
import { TeacherService } from '../services/teacher-service.js';
import { PedagogicalRoles } from '../core/contracts.js';
import { NotFoundError, ValidationError, AuthorizationError, SecurityError, ConflictError } from '../core/errors.js';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 8770;
export const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024; // 25MB
export const REQUEST_TIMEOUT_MS = 30 * 1000;
export const MAX_CONCURRENT_SESSIONS = 100;
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://chatgpt.com',
  'https://mcp-teacher.simogatti.it',
  'https://class.simogatti.it'
];

export function isInit(body) {
  if (!body || typeof body !== 'object') return false;
  return isInitializeRequest(body) || body.method === 'initialize';
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let bytesRead = 0;
    const chunks = [];

    req.on('data', chunk => {
      bytesRead += chunk.length;
      if (bytesRead > maxBytes) {
        const err = new Error(`Request body exceeded limit of ${maxBytes} bytes`);
        err.statusCode = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
}

export async function createHttpApp(options = {}) {
  const isProduction =
    options.isProduction !== undefined
      ? options.isProduction
      : process.env.NODE_ENV === 'production';

  const defaultAuthMode = 'strict';
  const authMode = options.authMode || process.env.TEACHER_SERVICE_AUTH_MODE || defaultAuthMode;
  if (isProduction && authMode !== 'strict') {
    throw new Error(`Security violation: authMode "${authMode}" is strictly forbidden in production`);
  }

  const service = options.service || new TeacherService({ mockAi: options.mockAi });
  // Authentication establishes identity only. Teacher membership is a distinct
  // application authorization decision and defaults to deny.
  const authorizeTeacher = options.authorizeTeacher || createTeacherPrincipalAuthorizer({
    teacherEmails: options.teacherEmails ?? process.env.TEACHER_SERVICE_TEACHER_EMAILS ?? ''
  });
  const isTeacherGrant = (grant) => grant === true || grant?.teacherAuthorized === true;
  const sessionRegistry = options.sessionRegistry || new SessionPrincipalRegistry();
  const activeTransports = new Map();
  const sessionActivity = new Map();

  function pruneInactive() {
    const now = Date.now();
    for (const [sid, lastSeen] of sessionActivity.entries()) {
      if (now - lastSeen > SESSION_IDLE_TIMEOUT_MS) {
        const trans = activeTransports.get(sid);
        if (trans) {
          try { trans.close(); } catch {}
          activeTransports.delete(sid);
        }
        sessionActivity.delete(sid);
        sessionRegistry.unregister(sid);
      }
    }
  }

  const configuredAllowedOrigins = options.allowedOrigins || (
    process.env.TEACHER_SERVICE_ALLOWED_ORIGINS
      ? process.env.TEACHER_SERVICE_ALLOWED_ORIGINS.split(',').map(s => s.trim())
      : DEFAULT_ALLOWED_ORIGINS
  );
  const claimRateLimiter = options.claimRateLimiter || new ClaimRateLimiter(service.dbManager, options.rateLimiterOptions);
  const trustedProxyCidrs = options.trustedProxyCidrs ??
    (process.env.TEACHER_SERVICE_TRUSTED_PROXY_CIDRS || '').split(',').map(value => value.trim()).filter(Boolean);

  const mcpAud = options.authConfig?.mcpAud
    || (options.authConfig?.webAud ? null : options.authConfig?.expectedAud)
    || process.env.TEACHER_SERVICE_CF_ACCESS_AUD
    || '';

  const webAud = options.authConfig?.webAud
    || (options.authConfig?.mcpAud ? null : options.authConfig?.expectedAud)
    || process.env.TEACHER_SERVICE_WEB_CF_ACCESS_AUD
    || '';

  const baseAuthConfig = {
    isProduction,
    allowSyntheticAuth: isProduction ? false : (options.authConfig?.allowSyntheticAuth ?? (process.env.NODE_ENV !== 'production')),
    expectedIss: options.authConfig?.expectedIss ?? process.env.TEACHER_SERVICE_CF_ACCESS_ISS,
    certsUrl: options.authConfig?.certsUrl,
    authMode,
    bearerToken: options.authConfig?.bearerToken || process.env.TEACHER_SERVICE_BEARER_TOKEN
  };

  const mcpAuthConfig = {
    ...baseAuthConfig,
    expectedAud: mcpAud
  };

  const webAuthConfig = {
    ...baseAuthConfig,
    expectedAud: webAud
  };

  const staticHandler = createStaticFileHandler({ rootDir: options.staticDir || path.resolve(process.cwd(), 'client') });

  const handleHttpRequest = async (req, res) => {
    pruneInactive();

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;

    // API and MCP responses can contain student or teacher-only records. Never
    // allow browsers, shared devices, reverse proxies, or intermediaries to cache them.
    if (pathname.startsWith('/api/') || pathname === '/mcp' || pathname.startsWith('/mcp/')) {
      res.setHeader('Cache-Control', 'no-store');
    }

    // CORS preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
      const origin = req.headers['origin'];
      if (origin && !configuredAllowedOrigins.includes(origin)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden', message: `Invalid Origin "${origin}"` }));
        return;
      }
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cf-Access-Jwt-Assertion, Mcp-Session-Id',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }

    // 1. Health check (unauthenticated public probe)
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          {
            status: 'ok',
            service: 'teacher-service',
            transport: 'streamable-http',
            version: '0.1.0',
            uptimeSec: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
          },
          null,
          2
        )
      );
      return;
    }

    // 2. Web UI Dashboard & Static Assets (SPA)
    if (pathname === '/' || pathname.startsWith('/client/') || (!pathname.startsWith('/api/') && !pathname.startsWith('/mcp') && pathname !== '/health')) {
      const handled = staticHandler(req, res, pathname);
      if (handled) return;
    }

    // 3. REST API endpoint (/api/*) — Strict authentication & authorization
    if (pathname.startsWith('/api/')) {
      // Origin check if present
      const originHeader = req.headers['origin'];
      if (originHeader && typeof originHeader === 'string') {
        let isOriginAllowed = configuredAllowedOrigins.includes(originHeader);
        if (!isOriginAllowed) {
          try {
            const parsed = new URL(originHeader);
            const reqHost = (req.headers['host'] || '').trim().toLowerCase();
            if (parsed.host.toLowerCase() === reqHost) {
              isOriginAllowed = true;
            }
          } catch {}
        }
        if (!isOriginAllowed) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden', message: `Invalid Origin "${originHeader}"` }));
          return;
        }
      }

      // Request size limit check
      const contentLengthHeader = req.headers['content-length'];
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (contentLength > MAX_PAYLOAD_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload Too Large', message: `Max allowed payload is ${MAX_PAYLOAD_BYTES} bytes` }));
          return;
        }
      }

      // CSRF validation for non-safe methods (Dossier 01, Web security)
      const csrfCheck = validateCsrf(req, configuredAllowedOrigins);
      if (!csrfCheck.valid) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden', message: csrfCheck.error }));
        return;
      }

      let bodyBuffer = Buffer.alloc(0);
      let parsedBody = null;
      let multipartData = null;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
          bodyBuffer = await readRequestBody(req, MAX_PAYLOAD_BYTES);
          const ctype = req.headers['content-type'] || '';
          if (ctype.includes('multipart/form-data')) {
            multipartData = parseMultipartFormData(bodyBuffer, ctype);
          } else if (bodyBuffer.length > 0) {
            try {
              parsedBody = JSON.parse(bodyBuffer.toString('utf8'));
            } catch {
              parsedBody = null;
            }
          }
        } catch (err) {
          res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Request', message: err.message }));
          return;
        }
      }

      // Branch 3a: Student API (/api/student/*) — Public Student Space, zero teacher privilege
      if (pathname.startsWith('/api/student/')) {
        return handleStudentApi(req, res, pathname, parsedUrl, service, parsedBody, multipartData, trustedProxyCidrs, claimRateLimiter);
      }

      // Branch 3b: Protected Teacher REST API (/api/*) — Strict authentication & teacher authorization
      const authResult = await authenticateRequest(req, webAuthConfig);
      if (!authResult.authenticated) {
        const sc = authResult.statusCode || 401;
        const errType = sc === 500 ? 'Internal Server Error' : (sc === 403 ? 'Forbidden' : 'Unauthorized');
        res.writeHead(sc, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errType, message: authResult.error || 'Authentication required for Teacher Service REST API' }));
        return;
      }

      let teacherGrant = false;
      try { teacherGrant = isTeacherGrant(await authorizeTeacher(authResult)); } catch { teacherGrant = false; }
      if (!teacherGrant) {
        if (pathname === '/api/auth/me' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            authenticated: true,
            principal: authResult.principal,
            user: authResult.user || null,
            teacherAuthorized: false,
            role: 'unauthorized',
            features: {
              integrityAnalysis: Boolean(service.enableIntegrityAnalysis),
              allowExternalStudentGrading: Boolean(service.assessments?.allowExternalStudentGrading)
            }
          }));
          return;
        }
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Authenticated principal is not authorized as a teacher' }));
        return;
      }
      authResult.teacherAuthorized = true;

      return handleRestApi(req, res, pathname, parsedUrl, service, authResult, parsedBody, multipartData);
    }

    // 4. MCP Streamable HTTP endpoint (/mcp)
    if (pathname === '/mcp') {
      // Validate Origin header if present
      const originHeader = req.headers['origin'];
      if (originHeader && typeof originHeader === 'string') {
        if (!configuredAllowedOrigins.includes(originHeader)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: `Forbidden: Invalid Origin "${originHeader}"` },
              id: null
            })
          );
          return;
        }
      }

      // Check Content-Length header
      const contentLengthHeader = req.headers['content-length'];
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (contentLength > MAX_PAYLOAD_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: `Payload Too Large: Maximum allowed request size is ${MAX_PAYLOAD_BYTES} bytes`
              },
              id: null
            })
          );
          return;
        }
      }

      // Authenticate
      const authResult = await authenticateRequest(req, mcpAuthConfig);
      if (!authResult.authenticated) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: `Unauthorized: ${authResult.error || 'Invalid or missing authentication credentials'}` },
            id: null
          })
        );
        return;
      }

      const clientPrincipal = authResult.principal;
      let teacherGrant = false;
      try { teacherGrant = await authorizeTeacher(authResult); } catch { teacherGrant = false; }
      if (!isTeacherGrant(teacherGrant)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32003, message: 'Authenticated principal is not authorized as a teacher' }, id: null }));
        return;
      }
      const teacherActor = {
        teacherAuthorized: true,
        actorId: typeof teacherGrant === 'object' ? (teacherGrant.actorId || teacherGrant.principal || clientPrincipal) : clientPrincipal,
        principal: clientPrincipal
      };

      // Read Body
      let bodyBuffer;
      try {
        bodyBuffer = await readRequestBody(req, MAX_PAYLOAD_BYTES);
      } catch (err) {
        res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: err.message },
            id: null
          })
        );
        return;
      }

      let parsedBody = null;
      if (bodyBuffer.length > 0) {
        try {
          parsedBody = JSON.parse(bodyBuffer.toString('utf8'));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32700, message: 'Parse error: Request body must be valid JSON' },
              id: null
            })
          );
          return;
        }
      }

      const sessionIdHeader = req.headers['mcp-session-id'];
      let transport = null;

      if (sessionIdHeader) {
        if (!sessionRegistry.has(sessionIdHeader)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Session Not Found: Unknown or expired session' },
              id: null
            })
          );
          return;
        }

        // Validate session-to-principal isolation
        if (!sessionRegistry.validate(sessionIdHeader, clientPrincipal)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Forbidden: Session belongs to a different principal' },
              id: null
            })
          );
          return;
        }

        transport = activeTransports.get(sessionIdHeader);
        if (!transport) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Session Not Found: Inactive session transport' },
              id: null
            })
          );
          return;
        }
        sessionActivity.set(sessionIdHeader, Date.now());
      } else if (isInit(parsedBody)) {
        if (activeTransports.size >= MAX_CONCURRENT_SESSIONS) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Service Unavailable: Maximum concurrent sessions reached' },
              id: null
            })
          );
          return;
        }

        transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: () => `session-${crypto.randomUUID()}`,
          enableJsonResponse: true,
          onsessioninitialized: (newSessionId) => {
            activeTransports.set(newSessionId, transport);
            sessionActivity.set(newSessionId, Date.now());
            sessionRegistry.bind(newSessionId, clientPrincipal);
          },
          onsessionclosed: (closedSessionId) => {
            activeTransports.delete(closedSessionId);
            sessionActivity.delete(closedSessionId);
            sessionRegistry.unregister(closedSessionId);
          }
        });

        const mcpServer = createMcpServer(service, { authorizeTeacher: async () => teacherActor });
        await mcpServer.connect(transport);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: Must be initialize request or include valid Mcp-Session-Id header' },
            id: null
          })
        );
        return;
      }

      // Build Web Standards Request
      const webHeaders = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            for (const v of value) webHeaders.append(key, v);
          } else {
            webHeaders.set(key, value);
          }
        }
      }

      if (!webHeaders.has('accept') || !webHeaders.get('accept').includes('text/event-stream')) {
        webHeaders.set('accept', 'application/json, text/event-stream');
      }

      const webReq = new Request(parsedUrl.toString(), {
        method: req.method,
        headers: webHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' && bodyBuffer.length > 0 ? bodyBuffer : undefined,
        duplex: 'half'
      });

      try {
        const webRes = await transport.handleRequest(webReq, { parsedBody });
        const resHeaders = {};
        for (const [k, v] of webRes.headers.entries()) {
          resHeaders[k] = v;
        }

        res.writeHead(webRes.status, resHeaders);
        if (webRes.body) {
          const reader = webRes.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }
        res.end();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: `Internal server error: ${err.message}` },
            id: null
          })
        );
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', message: `Route not found: ${pathname}` }));
  };

  const server = http.createServer(handleHttpRequest);

  return {
    server,
    handleHttpRequest,
    start: (port = DEFAULT_PORT, host = DEFAULT_HOST) => {
      return new Promise((resolve, reject) => {
        server.listen(port, host, () => {
          const address = server.address();
          const boundPort = address && typeof address === 'object' ? address.port : port;
          resolve({ port: boundPort, host, url: `http://${host}:${boundPort}` });
        });
        server.on('error', reject);
      });
    },
    close: async () => {
      for (const trans of activeTransports.values()) {
        try { await trans.close(); } catch {}
      }
      activeTransports.clear();
      service.close();
      if (server.listening) {
        return new Promise((resolve) => server.close(resolve));
      }
      return Promise.resolve();
    }
  };
}

/**
 * Student Public API Handler (/api/student/*)
 * Lightweight student access without account/password.
 * ZERO access to teacher scripts, rubrics, solutions, or management endpoints.
 */
const claimRateLimitMap = new Map();
const MAX_FAILED_CLAIM_ATTEMPTS = 5;
const CLAIM_BLOCK_WINDOW_MS = 5 * 60 * 1000;

export async function handleStudentApi(req, res, pathname, parsedUrl, service, parsedBody, multipartData, trustedProxyCidrs = [], rateLimiter = null) {
  const activeRateLimiter = rateLimiter || new ClaimRateLimiter(service.dbManager);
  res.setHeader('Content-Type', 'application/json');

  const normalizeStudentResponses = (responses) => {
    if (!Array.isArray(responses)) throw new ValidationError('responses deve essere un array');
    return responses.map((response) => {
      if (!response || typeof response.itemId !== 'string' || !response.itemId) {
        throw new ValidationError('Ogni risposta deve specificare itemId');
      }
      if (response.responseText !== undefined && typeof response.responseText !== 'string') {
        throw new ValidationError('responseText deve essere una stringa');
      }
      if (Object.hasOwn(response, 'attachmentPath') || Object.hasOwn(response, 'attachment_path')) {
        throw new SecurityError('Il percorso di un allegato non può essere specificato dal client');
      }
      if (response.attachmentId !== undefined && response.attachmentId !== null && typeof response.attachmentId !== 'string') {
        throw new ValidationError('attachmentId non valido');
      }
      return {
        itemId: response.itemId,
        responseText: response.responseText ?? '',
        ...(Object.hasOwn(response, 'attachmentId') ? { attachmentId: response.attachmentId } : {})
      };
    });
  };

  const getStudentSession = (assessmentId = null) => {
    const authHeader = req.headers['authorization'] || "";
    let token = null;
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (req.headers['x-student-token']) {
      token = String(req.headers['x-student-token']).trim();
    }
    if (!token) {
      const err = new AuthorizationError("Autenticazione studente richiesta: token di sessione mancante");
      err.statusCode = 401;
      throw err;
    }
    return service.validateStudentSession(token, assessmentId);
  };

  try {
    // POST /api/student/claim-code (Access via 6-char code / QR)
    if (pathname === '/api/student/claim-code' && req.method === 'POST') {
      // Forwarded client IPs are trusted only when the immediate TCP peer is
      // explicitly configured as a reverse proxy. In particular, private
      // address space alone is not evidence that a forwarded header is safe.
            const clientIp = resolveClientIp(req, trustedProxyCidrs);
      const accessCode = parsedBody?.accessCode;
      const rawDeviceId = req.headers["x-student-device-id"] || req.headers["x-device-id"] || parsedBody?.deviceId;
      let cookieDeviceId = null;
      if (req.headers["cookie"]) {
        const match = req.headers["cookie"].match(/(?:^|;\s*)ts_device_id=([^;]*)/);
        if (match) cookieDeviceId = decodeURIComponent(match[1].trim());
      }
      // Note: X-Student-Device-Id is an untrusted client hint used solely for localized
      // device rate-limiting bucketing so an individual student does not exhaust the room quota.
      // It is never treated as an authentication token, authorization credential, or security boundary.
      let clientDeviceId = (typeof rawDeviceId === "string" && rawDeviceId.trim().length > 0)
        ? rawDeviceId.trim()
        : (cookieDeviceId || null);

      // If client did not provide a cookie-based device identifier, issue a cookie hint so
      // subsequent browser requests are bucketed per-device instead of relying purely on IP.
      // We never bucket anonymous requests into a shared anon:IP bucket, which would lock out
      // 30+ students in a classroom after only 5 typos. Each browser without a device header
      // receives an isolated device cookie and its own independent 5-typo allowance.
      if (!cookieDeviceId) {
        const assignedCookieId = clientDeviceId || crypto.randomUUID();
        res.setHeader("Set-Cookie", `ts_device_id=${encodeURIComponent(assignedCookieId)}; Path=/api/student; HttpOnly; SameSite=Lax; Max-Age=2592000`);
        if (!clientDeviceId) {
          clientDeviceId = assignedCookieId;
        }
      }

      const deviceId = `dev:${clientDeviceId}`;
      const now = Date.now();

      const blockInfo = activeRateLimiter.checkLimit({ ip: clientIp, deviceId, code: accessCode, now });
      if (blockInfo?.blocked) {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": String(blockInfo.remainingSec)
        });
        res.end(JSON.stringify({
          error: "TooManyRequests",
          message: blockInfo.message || "Troppi tentativi falliti di riscatto codice. Riprova tra qualche minuto."
        }));
        return;
      }

      try {
        const session = service.claimStudentSession(accessCode);
        activeRateLimiter.recordSuccess({ ip: clientIp, deviceId, code: accessCode });
        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", session }));
        return;
      } catch (err) {
        activeRateLimiter.recordFailure({ ip: clientIp, deviceId, code: accessCode, now });
        throw err;
      }
    }

    // GET /api/student/session (Verify existing token on reload / resume)
    if (pathname === '/api/student/session' && req.method === 'GET') {
      const session = getStudentSession();
      res.writeHead(200);
      res.end(JSON.stringify({ status: "ok", session }));
      return;
    }

    // GET /api/student/classes
    if (pathname === '/api/student/classes' && req.method === 'GET') {
      const classes = service.listClasses().map(c => ({
        id: c.id,
        name: c.name,
        section: c.section,
        academicYear: c.academic_year
      }));
      res.writeHead(200);
      res.end(JSON.stringify({ classes }));
      return;
    }

    // GET /api/student/classes/:id/students (Privacy-preserving roster)
    if (pathname.match(/^\/api\/student\/classes\/([^/]+)\/students$/) && req.method === 'GET') {
      const classId = pathname.split('/')[4];
      const students = service.listStudents(classId).map(s => ({
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name ? (s.last_name.charAt(0) + '.') : '',
        fullName: `${s.first_name} ${s.last_name ? (s.last_name.charAt(0) + '.') : ''}`.trim()
      }));
      res.writeHead(200);
      res.end(JSON.stringify({ students }));
      return;
    }

    // GET /api/student/classes/:id/activities (Only ready and active, NEVER drafts)
    if (pathname.match(/^\/api\/student\/classes\/([^/]+)\/activities$/) && req.method === 'GET') {
      const classId = pathname.split('/')[4];
      const all = service.listAssessments({ classId });
      const activities = all
        .filter(a => a.is_active !== 0 && (a.status === 'ready' || a.status === 'active'))
        .map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          activityType: a.activity_type || 'test',
          durationMinutes: a.duration_minutes,
          maxScore: a.max_score,
          status: a.status
        }));
      res.writeHead(200);
      res.end(JSON.stringify({ activities }));
      return;
    }

    // GET /api/student/activities/:id (Protected questions view, teacher solutions stripped)
    if (pathname.match(/^\/api\/student\/activities\/([^/]+)$/) && req.method === 'GET') {
      const id = pathname.split('/')[4];
      const session = getStudentSession(id);
      const activity = service.getAssessment(id, { role: 'student', includeTeacherSolutions: false });
      if (activity.status === 'draft') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'NotFoundError', message: `Attività '${id}' non trovata o in bozza` }));
        return;
      }
      if (activity.status === 'ready') {
        res.writeHead(200);
        res.end(JSON.stringify({
          activity: {
            id: activity.id,
            title: activity.title,
            description: activity.description,
            activityType: activity.activity_type || 'test',
            durationMinutes: activity.duration_minutes,
            maxScore: activity.max_score,
            status: 'ready',
            items: [],
            message: 'La verifica è pronta ma non è ancora stata avviata dal docente. I quesiti saranno visibili non appena il docente attiverà la prova.'
          }
        }));
        return;
      }
      if (activity && activity.items) {
        activity.items = activity.items.map(item => ({
          ...item,
          teacher_solution: null,
          rubric: null,
          rubric_json: null
        }));
      }
      res.writeHead(200);
      res.end(JSON.stringify({ activity }));
      return;
    }

    // GET /api/student/activities/:id/neighbors (For Seat Map declaration with session)
    if (pathname.match(/^\/api\/student\/activities\/([^/]+)\/neighbors$/) && req.method === 'GET') {
      const id = pathname.split('/')[4];
      const session = getStudentSession(id);
      const classmates = service.listStudents(session.classId)
        .filter(s => s.id !== session.studentId)
        .map(s => ({
          id: s.id,
          fullName: `${s.first_name} ${s.last_name ? (s.last_name.charAt(0) + '.') : ''}`.trim()
        }));
      res.writeHead(200);
      res.end(JSON.stringify({
        neighbors: [
          { id: 'none', fullName: 'Nessuno' },
          ...classmates
        ]
      }));
      return;
    }

    // GET /api/student/activities/:id/submission (Strictly bound to authenticated student session)
    if (pathname.match(/^\/api\/student\/activities\/([^/]+)\/submission$/) && req.method === 'GET') {
      const id = pathname.split('/')[4];
      const session = getStudentSession(id);
      const submission = service.getStudentSubmission(id, session.studentId);
      res.writeHead(200);
      res.end(JSON.stringify({ submission }));
      return;
    }

    // POST /api/student/activities/:id/start
    if (pathname.match(/^\/api\/student\/activities\/([^/]+)\/start$/) && req.method === 'POST') {
      const id = pathname.split('/')[4];
      const session = getStudentSession(id);
      const reqRevision = parsedBody?.revision;
      if (reqRevision === undefined || reqRevision === null || !Number.isInteger(reqRevision) || reqRevision < 0) {
        throw new ValidationError("Il parametro 'revision' (intero non negativo) è obbligatorio per l'avvio della prova");
      }
      const payload = {
        assessmentId: id,
        studentId: session.studentId,
        studentName: session.studentName,
        seatRow: parsedBody?.seatRow || null,
        seatDesk: parsedBody?.seatDesk || null,
        leftNeighborId: parsedBody?.leftNeighborId || null,
        leftNeighborName: parsedBody?.leftNeighborName || null,
        rightNeighborId: parsedBody?.rightNeighborId || null,
        rightNeighborName: parsedBody?.rightNeighborName || null,
        responses: normalizeStudentResponses(parsedBody?.responses || []),
        revision: reqRevision,
        isFinal: false,
        attemptStatus: "in_progress"
      };
      const submission = service.saveDraftSubmission(payload);
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'started', submission, revision: submission.revision, timer: submission.timer }));
      return;
    }

    // POST /api/student/activities/:id/autosave
    if (pathname.match(/^\/api\/student\/activities\/([^/]+)\/autosave$/) && req.method === 'POST') {
      const id = pathname.split('/')[4];
      const session = getStudentSession(id);
      const reqRevision = parsedBody?.revision;
      if (reqRevision === undefined || reqRevision === null || !Number.isInteger(reqRevision) || reqRevision < 0) {
        throw new ValidationError("Il parametro 'revision' (intero non negativo) è obbligatorio per l'autosalvataggio");
      }
      const payload = {
        assessmentId: id,
        studentId: session.studentId,
        studentName: session.studentName,
        seatRow: parsedBody?.seatRow || null,
        seatDesk: parsedBody?.seatDesk || null,
        leftNeighborId: parsedBody?.leftNeighborId || null,
        leftNeighborName: parsedBody?.leftNeighborName || null,
        rightNeighborId: parsedBody?.rightNeighborId || null,
        rightNeighborName: parsedBody?.rightNeighborName || null,
        responses: normalizeStudentResponses(parsedBody?.responses || []),
        revision: reqRevision,
        isFinal: false,
        attemptStatus: "in_progress"
      };
      const submission = service.saveDraftSubmission(payload);
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'saved', lastSavedAt: submission.last_saved_at, revision: submission.revision, timer: submission.timer }));
      return;
    }

    // POST /api/student/activities/:id/submit
    if (pathname.match(/^\/api\/student\/activities\/([^/]+)\/submit$/) && req.method === 'POST') {
      const id = pathname.split('/')[4];
      const session = getStudentSession(id);
      const reqRevision = parsedBody?.revision;
      if (reqRevision === undefined || reqRevision === null || !Number.isInteger(reqRevision) || reqRevision < 0) {
        throw new ValidationError("Il parametro 'revision' (intero non negativo) è obbligatorio per la consegna");
      }
      const payload = {
        assessmentId: id,
        studentId: session.studentId,
        studentName: session.studentName,
        seatRow: parsedBody?.seatRow || null,
        seatDesk: parsedBody?.seatDesk || null,
        leftNeighborId: parsedBody?.leftNeighborId || null,
        leftNeighborName: parsedBody?.leftNeighborName || null,
        rightNeighborId: parsedBody?.rightNeighborId || null,
        rightNeighborName: parsedBody?.rightNeighborName || null,
        responses: normalizeStudentResponses(parsedBody?.responses || []),
        revision: reqRevision,
        isFinal: true,
        attemptStatus: "submitted"
      };
      const submission = service.saveDraftSubmission(payload);
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'submitted', submission, revision: submission.revision, timer: submission.timer }));
      return;
    }

    // GET /api/student/attachment?assessmentId=...&attachmentId=...
    // The opaque ID is resolved only inside the authenticated student's own scope.
    if (pathname === '/api/student/attachment' && req.method === 'GET') {
      const assessmentId = parsedUrl.searchParams.get('assessmentId');
      const attachmentId = parsedUrl.searchParams.get('attachmentId');
      if (!assessmentId || !attachmentId) {
        throw new ValidationError("assessmentId e attachmentId sono obbligatori");
      }
      const session = getStudentSession(assessmentId);
      const attachment = service.getStudentAttachment({
        assessmentId,
        studentId: session.studentId,
        attachmentId
      });
      const stored = service.fileStore.readStoredFile(attachment.storage_path);
      res.writeHead(200, {
        'Content-Type': attachment.content_type,
        'Content-Length': stored.size,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store'
      });
      res.end(stored.buffer);
      return;
    }

    // POST /api/student/upload — upload ownership is persisted before a client can reference it.
    if (pathname === '/api/student/upload' && req.method === 'POST') {
      const file = (multipartData?.files && multipartData.files[0]) || multipartData?.file;
      if (!file) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'ValidationError', message: 'Nessun file caricato' }));
        return;
      }
      const fileBuffer = file.data || file.buffer;
      if (!fileBuffer || fileBuffer.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'ValidationError', message: 'Nessun file caricato o file vuoto' }));
        return;
      }
      const MAX_FILE_BYTES = 10 * 1024 * 1024;
      if (fileBuffer.length > MAX_FILE_BYTES) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'ValidationError', message: 'Dimensione file eccedente il limite di 10MB' }));
        return;
      }

      const assessmentId = multipartData.fields?.assessmentId || parsedUrl.searchParams.get('assessmentId');
      const itemId = multipartData.fields?.itemId;
      if (!assessmentId || !itemId) {
        throw new ValidationError('assessmentId e itemId sono obbligatori per associare l’allegato al quesito');
      }
      const session = getStudentSession(assessmentId);
      const ext = path.extname(file.filename || '').toLowerCase();
      const contentTypes = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.sql': 'text/plain; charset=utf-8',
        '.js': 'text/plain; charset=utf-8',
        '.py': 'text/plain; charset=utf-8',
        '.json': 'application/json'
      };
      const contentType = contentTypes[ext];
      if (!contentType) {
        throw new ValidationError('Formato non supportato. Carica PDF, immagine o file di testo/codice.');
      }
      const attachment = service.registerStudentAttachment({
        assessmentId,
        studentId: session.studentId,
        itemId,
        filename: file.filename,
        contentType,
        buffer: fileBuffer
      });
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, ...attachment }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found', message: `Route studente non trovata: ${pathname}` }));
  } catch (err) {
    const statusCode = err.statusCode || (
      err instanceof ValidationError ? 400 :
      err instanceof NotFoundError ? 404 :
      err instanceof ConflictError ? 409 :
      err instanceof AuthorizationError ? (err.statusCode || 403) :
      err instanceof SecurityError ? 400 : 500
    );
    res.writeHead(statusCode);
    res.end(JSON.stringify({ error: err.name || 'Error', message: err.message }));
  }
}

async function handleRestApi(req, res, pathname, parsedUrl, service, authResult, parsedBody, multipartData) {
  res.setHeader('Content-Type', 'application/json');

  // Never derive roles from request parameters. The route is reached only after
  // the trusted application teacher-authorizer grants this principal.
  if (authResult.teacherAuthorized !== true) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: 'Forbidden', message: 'Teacher authorization required' }));
    return;
  }
  const callerRole = 'teacher';
  const isStudent = callerRole === 'student';

  try {
    // GET /api/auth/me
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        authenticated: true,
        principal: authResult.principal,
        user: authResult.user || null,
        teacherAuthorized: true,
        role: callerRole,
        features: {
          integrityAnalysis: Boolean(service.enableIntegrityAnalysis),
          allowExternalStudentGrading: Boolean(service.assessments?.allowExternalStudentGrading)
        }
      }));
      return;
    }

    // POST /api/classes
    if (pathname === '/api/classes' && req.method === 'POST') {
      const cls = service.createClass(parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ class: cls }));
      return;
    }

    // POST /api/subjects
    if (pathname === '/api/subjects' && req.method === 'POST') {
      const sub = service.createSubject(parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ subject: sub }));
      return;
    }

    // POST /api/lessons
    if (pathname === '/api/lessons' && req.method === 'POST') {
      const les = service.createLesson(parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ lesson: les }));
      return;
    }

    // GET /api/lessons/:id/pack
    if (pathname.match(/^\/api\/lessons\/([^/]+)\/pack$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const pack = service.getLessonPack(id, { role: callerRole, includeTeacherSolutions: !isStudent });
      res.writeHead(200);
      res.end(JSON.stringify({ pack }));
      return;
    }

    // POST /api/lessons/:id/generate-pack
    if (pathname.match(/^\/api\/lessons\/([^/]+)\/generate-pack$/) && req.method === 'POST') {
      const id = pathname.split('/')[3];
      const pack = await service.generateLessonPack({
        lessonId: id,
        ...(parsedBody || {})
      });
      res.writeHead(200);
      res.end(JSON.stringify({ pack }));
      return;
    }

    // POST /api/lessons/:id/confirm-preparation
    if (pathname.match(/^\/api\/lessons\/([^/]+)\/confirm-preparation$/) && req.method === 'POST') {
      const id = pathname.split('/')[3];
      const confirmation = service.confirmLessonPreparation({
        lessonId: id,
        notes: parsedBody?.notes || '',
        actorId: authResult.principal
      });
      res.writeHead(200);
      res.end(JSON.stringify({ confirmation }));
      return;
    }

    // GET /api/lessons/:id
    if (pathname.match(/^\/api\/lessons\/([^/]+)$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const lesson = service.getLesson(id);
      res.writeHead(200);
      res.end(JSON.stringify({ lesson }));
      return;
    }

    // PUT /api/lessons/:id
    if (pathname.match(/^\/api\/lessons\/([^/]+)$/) && req.method === 'PUT') {
      const id = pathname.split('/')[3];
      const lesson = service.updateLesson(id, parsedBody || {});
      res.writeHead(200);
      res.end(JSON.stringify({ lesson }));
      return;
    }

    // POST /api/materials/upload
    if (pathname === '/api/materials/upload' && req.method === 'POST') {
      if (!multipartData || !multipartData.file) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'ValidationError', message: 'No file uploaded in multipart request' }));
        return;
      }
      const { file, fields } = multipartData;
      const result = await service.importFile({
        fileBuffer: file.buffer,
        filename: file.filename,
        title: fields.title || file.filename,
        classId: fields.classId || null,
        subjectId: fields.subjectId || null,
        lessonId: fields.lessonId || null,
        pedagogicalRole: fields.pedagogicalRole || 'support_material',
        tags: fields.tags ? fields.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      });
      res.writeHead(201);
      res.end(JSON.stringify(result));
      return;
    }

    // PUT /api/materials/:id
    if (pathname.match(/^\/api\/materials\/([^/]+)$/) && req.method === 'PUT') {
      const id = pathname.split('/')[3];
      const mat = service.updateMaterial(id, {
        ...(parsedBody || {}),
        updatedBy: authResult.principal
      });
      res.writeHead(200);
      res.end(JSON.stringify({ material: mat }));
      return;
    }

    // POST /api/materials/:id/revise
    if (pathname.match(/^\/api\/materials\/([^/]+)\/revise$/) && req.method === 'POST') {
      const id = pathname.split('/')[3];
      const result = await service.reviseMaterial({
        materialId: id,
        ...(parsedBody || {})
      });
      res.writeHead(200);
      res.end(JSON.stringify({ result }));
      return;
    }

    // POST /api/materials/:id/regenerate-section
    if (pathname.match(/^\/api\/materials\/([^/]+)\/regenerate-section$/) && req.method === 'POST') {
      const id = pathname.split('/')[3];
      const result = await service.regenerateSection({
        materialId: id,
        ...(parsedBody || {})
      });
      res.writeHead(200);
      res.end(JSON.stringify({ result }));
      return;
    }

    // GET /api/classes
    if (pathname === '/api/classes' && req.method === 'GET') {
      const classes = service.listClasses();
      res.writeHead(200);
      res.end(JSON.stringify({ classes }));
      return;
    }

    // GET /api/classes/:id/students (Teacher view of class roster)
    if (pathname.match(/^\/api\/classes\/([^/]+)\/students$/) && req.method === 'GET') {
      const classId = pathname.split('/')[3];
      const students = service.listStudents(classId);
      res.writeHead(200);
      res.end(JSON.stringify({ students }));
      return;
    }

    // POST /api/classes/:id/students (Teacher adds student or imports roster)
    if (pathname.match(/^\/api\/classes\/([^/]+)\/students$/) && req.method === 'POST') {
      const classId = pathname.split('/')[3];
      if (parsedBody && Array.isArray(parsedBody.students)) {
        const imported = service.importStudents(classId, parsedBody.students);
        res.writeHead(201);
        res.end(JSON.stringify({ count: imported.length, students: imported }));
        return;
      }
      const student = service.addStudent({ classId, ...(parsedBody || {}) });
      res.writeHead(201);
      res.end(JSON.stringify({ student }));
      return;
    }

    // DELETE /api/classes/:classId/students/:id (Teacher removes student)
    if (pathname.match(/^\/api\/classes\/([^/]+)\/students\/([^/]+)$/) && req.method === 'DELETE') {
      const studentId = pathname.split('/')[5];
      service.deleteStudent(studentId);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, deletedId: studentId }));
      return;
    }

    // DELETE /api/students/:id (Alternative direct delete)
    if (pathname.match(/^\/api\/students\/([^/]+)$/) && req.method === 'DELETE') {
      const studentId = pathname.split('/')[3];
      service.deleteStudent(studentId);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, deletedId: studentId }));
      return;
    }

    // GET /api/subjects
    if (pathname === '/api/subjects' && req.method === 'GET') {
      const classId = parsedUrl.searchParams.get('classId');
      const subjects = service.listSubjects({ classId });
      res.writeHead(200);
      res.end(JSON.stringify({ subjects }));
      return;
    }

    // GET /api/lessons
    if (pathname === '/api/lessons' && req.method === 'GET') {
      const classId = parsedUrl.searchParams.get('classId');
      const subjectId = parsedUrl.searchParams.get('subjectId');
      const lessons = service.listLessons({ classId, subjectId });
      res.writeHead(200);
      res.end(JSON.stringify({ lessons }));
      return;
    }

    // GET /api/materials
    if (pathname === '/api/materials' && req.method === 'GET') {
      const classId = parsedUrl.searchParams.get('classId');
      const subjectId = parsedUrl.searchParams.get('subjectId');
      const lessonId = parsedUrl.searchParams.get('lessonId');
      let materials = service.listMaterials({ classId, subjectId, lessonId });

      if (isStudent) {
        // Exclude teacher-only materials
        materials = materials.filter(m => m.pedagogical_role !== PedagogicalRoles.TEACHER_MATERIAL);
      }

      res.writeHead(200);
      res.end(JSON.stringify({ materials }));
      return;
    }

    // GET /api/materials/:id/export
    if (pathname.match(/^\/api\/materials\/([^/]+)\/export$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const format = parsedUrl.searchParams.get('format') || 'markdown';
      const exported = service.exportMaterialFile(id, format, { includeTeacherSolutions: !isStudent });

      res.setHeader('Content-Type', exported.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      res.writeHead(200);
      res.end(exported.data);
      return;
    }

    // GET /api/materials/:id
    if (pathname.match(/^\/api\/materials\/([^/]+)$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const material = service.getMaterial(id, null, { role: callerRole, includeTeacherSolutions: !isStudent });

      if (isStudent && material.pedagogical_role === PedagogicalRoles.TEACHER_MATERIAL) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Access denied to teacher-only material' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ material }));
      return;
    }

    // POST /api/materials
    if (pathname === '/api/materials' && req.method === 'POST') {
      if (isStudent) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Only teachers can create materials' }));
        return;
      }
      const mat = service.createMaterial(parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ material: mat }));
      return;
    }

    // GET /api/ai-rules
    if (pathname === '/api/ai-rules' && req.method === 'GET') {
      const scope = parsedUrl.searchParams.get('scope');
      const targetId = parsedUrl.searchParams.get('targetId');
      const rules = service.listAiRules({ scope, targetId });
      res.writeHead(200);
      res.end(JSON.stringify({ rules }));
      return;
    }

    // POST /api/ai-rules
    if (pathname === '/api/ai-rules' && req.method === 'POST') {
      if (isStudent) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Only teachers can modify AI rules' }));
        return;
      }
      const rule = service.setAiRule(parsedBody || {}, {
        teacherAuthorized: true,
        actorId: authResult.principal
      });
      res.writeHead(201);
      res.end(JSON.stringify({ rule }));
      return;
    }

    // GET /api/assessments
    if (pathname === '/api/assessments' && req.method === 'GET') {
      const classId = parsedUrl.searchParams.get('classId');
      const assessments = service.listAssessments({ classId });
      res.writeHead(200);
      res.end(JSON.stringify({ assessments }));
      return;
    }

    // GET /api/assessments/:id
    if (pathname.match(/^\/api\/assessments\/([^/]+)$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const assessment = service.getAssessment(id, { role: callerRole, includeTeacherSolutions: !isStudent });
      res.writeHead(200);
      res.end(JSON.stringify({ assessment }));
      return;
    }

    // GET /api/assessments/:id/statistics (teacher-confirmed grading statistics)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/statistics$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const statistics = service.getAssessmentStatistics(id);
      res.writeHead(200);
      res.end(JSON.stringify({ statistics }));
      return;
    }

    // GET /api/assessments/:id/items/:itemId/responses (question-centric review)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/items\/([^/]+)\/responses$/) && req.method === 'GET') {
      const parts = pathname.split('/');
      const responses = service.getSubmissionsForItem(parts[3], parts[5]);
      res.writeHead(200);
      res.end(JSON.stringify(responses));
      return;
    }

    // GET /api/assessments/:id/live-monitor (Live monitoring: answers saved, seat map, attendance)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/live-monitor$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const liveData = service.getLiveMonitoringData(id);
      res.writeHead(200);
      res.end(JSON.stringify({ liveMonitoring: liveData }));
      return;
    }

    // Teacher-only integrity analysis. Reports are computed on demand; the
    // persisted record contains review decisions, not answer excerpts.
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/integrity-preview$/) && req.method === 'GET') {
      if (!service.enableIntegrityAnalysis) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found', message: "L'analisi dell'integrità è disabilitata in questo ambiente (TEACHER_SERVICE_ENABLE_INTEGRITY_ANALYSIS=false)" }));
        return;
      }
      const id = pathname.split('/')[3];
      const integrityAnalysis = service.analyzeIntegrityEvidence(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ integrityAnalysis }));
      return;
    }

    if (pathname.match(/^\/api\/assessments\/([^/]+)\/integrity-reviews$/) && req.method === 'POST') {
      if (!service.enableIntegrityAnalysis) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found', message: "L'analisi dell'integrità è disabilitata in questo ambiente (TEACHER_SERVICE_ENABLE_INTEGRITY_ANALYSIS=false)" }));
        return;
      }
      const assessmentId = pathname.split('/')[3];
      const review = service.recordIntegrityReview({
        assessmentId,
        evidenceId: parsedBody?.evidenceId,
        decision: parsedBody?.decision,
        note: parsedBody?.note,
        idempotencyKey: parsedBody?.idempotencyKey,
        actor: authResult.principal
      });
      const integrityAnalysis = service.analyzeIntegrityEvidence(assessmentId);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ review, integrityAnalysis }));
      return;
    }

    // POST /api/assessments
    if (pathname === '/api/assessments' && req.method === 'POST') {
      if (isStudent) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Only teachers can create assessments' }));
        return;
      }
      const asm = service.createAssessment(parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ assessment: asm }));
      return;
    }

    // PUT /api/assessments/:id (Update metadata)
    if (pathname.match(/^\/api\/assessments\/([^/]+)$/) && req.method === 'PUT') {
      const id = pathname.split('/')[3];
      const updated = service.updateAssessment(id, parsedBody || {});
      res.writeHead(200);
      res.end(JSON.stringify({ assessment: updated }));
      return;
    }

    // PUT /api/assessments/:id/status (Set status draft/ready/active/closed)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/status$/) && req.method === 'PUT') {
      const id = pathname.split('/')[3];
      const updated = service.setAssessmentStatus(id, parsedBody?.status);
      res.writeHead(200);
      res.end(JSON.stringify({ assessment: updated }));
      return;
    }

    // POST /api/assessments/:id/items (Add question item)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/items$/) && req.method === 'POST') {
      const id = pathname.split('/')[3];
      const item = service.addAssessmentItem(id, parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ item }));
      return;
    }

    // PUT /api/assessments/:id/items/:itemId (Update question item)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/items\/([^/]+)$/) && req.method === 'PUT') {
      const parts = pathname.split('/');
      const assessmentId = parts[3];
      const itemId = parts[5];
      const item = service.updateAssessmentItem(assessmentId, itemId, parsedBody || {});
      res.writeHead(200);
      res.end(JSON.stringify({ item }));
      return;
    }

    // DELETE /api/assessments/:id/items/:itemId (Delete question item)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/items\/([^/]+)$/) && req.method === 'DELETE') {
      const parts = pathname.split('/');
      const assessmentId = parts[3];
      const itemId = parts[5];
      const result = service.deleteAssessmentItem(assessmentId, itemId);
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // GET /api/assessments/:id/credentials (List student access codes)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/credentials$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const credentials = service.listActivityCredentials(id);
      res.writeHead(200);
      res.end(JSON.stringify({ credentials }));
      return;
    }

    // POST /api/assessments/:id/credentials/generate (Generate/refresh student access codes)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/credentials\/generate$/) && req.method === 'POST') {
      const id = pathname.split('/')[3];
      const credentials = service.generateActivityCredentials(id, parsedBody || {});
      res.writeHead(200);
      res.end(JSON.stringify({ credentials }));
      return;
    }

    // POST /api/assessments/:id/credentials/:credId/revoke (Revoke student access code/session)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/credentials\/([^/]+)\/revoke$/) && req.method === 'POST') {
      const parts = pathname.split('/');
      const credId = parts[5];
      const result = service.revokeActivityCredential(credId);
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // POST /api/assessments/:id/credentials/:credId/reissue (Reissue lost access code/session)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/credentials\/([^/]+)\/reissue$/) && req.method === 'POST') {
      const parts = pathname.split('/');
      const credId = parts[5];
      const result = service.reissueActivityCredential(credId, parsedBody || {});
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // POST /api/assessments/:id/submissions/:studentId/extra-time (Teacher grant extra time)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/submissions\/([^/]+)\/extra-time$/) && req.method === 'POST') {
      const parts = pathname.split('/');
      const asmId = parts[3];
      const studentId = parts[5];
      const extraMinutes = Number(parsedBody?.extraMinutes || 0);
      const updated = service.grantExtraTime(asmId, studentId, extraMinutes, {
        idempotencyKey: parsedBody?.idempotencyKey,
        reason: parsedBody?.reason,
        teacherPrincipal: authResult.principal
      });
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, submission: updated }));
      return;
    }

    // POST /api/submissions/:id/withdraw (Teacher-controlled termination; preserves saved answers)
    if (pathname.match(/^\/api\/submissions\/([^/]+)\/withdraw$/) && req.method === 'POST') {
      const submissionId = pathname.split('/')[3];
      const submission = service.withdrawSubmission(submissionId, {
        reason: parsedBody?.reason,
        idempotencyKey: parsedBody?.idempotencyKey,
        teacherPrincipal: authResult.principal
      });
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, submission }));
      return;
    }

    // POST /api/assessments/:id/submissions/:subId/reopen (Reopen student attempt)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/submissions\/([^/]+)\/reopen$/) && req.method === 'POST') {
      const parts = pathname.split('/');
      const subId = parts[5];
      const sub = service.reopenSubmission(subId, {
        reason: parsedBody?.reason,
        extraMinutes: parsedBody?.extraMinutes,
        idempotencyKey: parsedBody?.idempotencyKey,
        teacherPrincipal: authResult.principal
      });
      res.writeHead(200);
      res.end(JSON.stringify({ submission: sub }));
      return;
    }

    // POST /api/submissions/:id/reopen (Direct reopen submission)
    if (pathname.match(/^\/api\/submissions\/([^/]+)\/reopen$/) && req.method === 'POST') {
      const subId = pathname.split('/')[3];
      const sub = service.reopenSubmission(subId, {
        reason: parsedBody?.reason,
        extraMinutes: parsedBody?.extraMinutes,
        idempotencyKey: parsedBody?.idempotencyKey,
        teacherPrincipal: authResult.principal
      });
      res.writeHead(200);
      res.end(JSON.stringify({ submission: sub }));
      return;
    }

    // GET /api/submissions/:id
    if (pathname.match(/^\/api\/submissions\/([^/]+)$/) && req.method === 'GET') {
      const submissionId = pathname.split('/')[3];
      const submission = service.getSubmission(submissionId);
      res.writeHead(200);
      res.end(JSON.stringify({ submission }));
      return;
    }

    // GET /api/assessments/:id/submissions
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/submissions$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const submissions = service.listSubmissions(id);
      res.writeHead(200);
      res.end(JSON.stringify({ submissions }));
      return;
    }

    // POST /api/assessments/:id/submissions (Submit student attempt)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/submissions$/) && req.method === 'POST') {
      const assessmentId = pathname.split('/')[3];
      const submission = service.importSubmission({ assessmentId, ...(parsedBody || {}) });
      res.writeHead(201);
      res.end(JSON.stringify({ submission }));
      return;
    }

    // POST /api/submissions/:id/grade
    if (pathname.match(/^\/api\/submissions\/([^/]+)\/grade$/) && req.method === 'POST') {
      const submissionId = pathname.split('/')[3];
      const result = await service.gradeSubmission({ submissionId, ...(parsedBody || {}) });
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // POST /api/submissions/:id/review
    if (pathname.match(/^\/api\/submissions\/([^/]+)\/review$/) && req.method === 'POST') {
      if (isStudent) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Only teachers can review grades' }));
        return;
      }
      const submissionId = pathname.split('/')[3];
      const result = service.reviewGrading({
        submissionId,
        ...(parsedBody || {}),
        teacherPrincipal: authResult.principal,
        reviewer: authResult.principal
      });
      res.writeHead(200);
      res.end(JSON.stringify({ submission: result }));
      return;
    }

    // GET /api/assessments/:id/export
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/export$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const format = parsedUrl.searchParams.get('format') || 'csv';
      const results = service.exportAssessmentResults(id, format);
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="assessment_${id}_results.csv"`);
        res.writeHead(200);
        res.end(results);
      } else if (format === 'json') {
        res.writeHead(200);
        res.end(JSON.stringify(results, null, 2));
      } else {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.writeHead(200);
        res.end(results);
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found', path: pathname }));
  } catch (err) {
    const statusCode = err.statusCode || (
      err instanceof NotFoundError ? 404 :
      err instanceof ValidationError ? 400 :
      err instanceof ConflictError ? 409 :
      err instanceof AuthorizationError ? (err.statusCode || 403) :
      err instanceof SecurityError ? 400 : 500
    );
    res.writeHead(statusCode);
    res.end(JSON.stringify({ error: err.name || 'Error', message: err.message }));
  }
}
