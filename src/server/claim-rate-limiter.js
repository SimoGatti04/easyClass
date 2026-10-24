/**
 * Teacher Service — Classroom-Compatible Claim Code Rate Limiter
 *
 * Supports 30+ students under the same NAT router making ordinary typos
 * without blocking the entire classroom.
 * Defends against automated brute force (rotating codes) and targeted code attacks.
 * Persists state in SQLite so rate limiting survives process restarts
 * and is shared across instances.
 */

export const DEVICE_MAX_FAILS = Number(process.env.TEACHER_SERVICE_CLAIM_RATE_LIMIT_DEVICE_MAX || 5);
export const CODE_MAX_FAILS = Number(process.env.TEACHER_SERVICE_CLAIM_RATE_LIMIT_CODE_MAX || 5);
export const IP_MAX_FAILS = Number(process.env.TEACHER_SERVICE_CLAIM_RATE_LIMIT_IP_MAX || 60);
export const IP_BURST_MAX_FAILS = Number(process.env.TEACHER_SERVICE_CLAIM_RATE_LIMIT_IP_BURST || 35);
export const CLAIM_WINDOW_MS = Number(process.env.TEACHER_SERVICE_CLAIM_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
export const CLAIM_BLOCK_MS = Number(process.env.TEACHER_SERVICE_CLAIM_RATE_LIMIT_BLOCK_MS || 5 * 60 * 1000);
export const BURST_WINDOW_MS = 10 * 1000;

export class ClaimRateLimiter {
  constructor(dbManager = null, options = {}) {
    this.dbManager = dbManager;
    this.deviceMaxFails = options.deviceMaxFails ?? DEVICE_MAX_FAILS;
    this.codeMaxFails = options.codeMaxFails ?? CODE_MAX_FAILS;
    this.ipMaxFails = options.ipMaxFails ?? IP_MAX_FAILS;
    this.ipBurstMaxFails = options.ipBurstMaxFails ?? IP_BURST_MAX_FAILS;
    this.windowMs = options.windowMs ?? CLAIM_WINDOW_MS;
    this.blockMs = options.blockMs ?? CLAIM_BLOCK_MS;
    this.burstWindowMs = options.burstWindowMs ?? BURST_WINDOW_MS;
    this.memoryMap = new Map();
  }

  checkLimit({ ip, deviceId = null, code = null, now = Date.now() }) {
    if (this.dbManager?.db) {
      // 1. Check IP aggregate block
      if (ip) {
        const ipRow = this.dbManager.prepare(
          "SELECT failed_count, first_attempt_at, blocked_until FROM student_claim_rate_limits WHERE scope = ? AND identifier = ?"
        ).get("ip", ip);
        if (ipRow && ipRow.blocked_until > now) {
          return {
            blocked: true,
            remainingSec: Math.ceil((ipRow.blocked_until - now) / 1000),
            message: "Troppi tentativi falliti di riscatto codice da questo indirizzo. Riprova tra qualche minuto."
          };
        }

        // 2. Check IP burst block (rapid succession attack)
        const burstRow = this.dbManager.prepare(
          "SELECT failed_count, first_attempt_at, blocked_until FROM student_claim_rate_limits WHERE scope = ? AND identifier = ?"
        ).get("ip_burst", ip);
        if (burstRow && burstRow.blocked_until > now) {
          return {
            blocked: true,
            remainingSec: Math.ceil((burstRow.blocked_until - now) / 1000),
            message: "Troppi tentativi falliti in rapida successione da questo indirizzo. Riprova tra qualche minuto."
          };
        }
      }

      // 3. Check Device block
      if (deviceId) {
        const devRow = this.dbManager.prepare(
          "SELECT failed_count, first_attempt_at, blocked_until FROM student_claim_rate_limits WHERE scope = ? AND identifier = ?"
        ).get("device", deviceId);
        if (devRow && devRow.blocked_until > now) {
          return {
            blocked: true,
            remainingSec: Math.ceil((devRow.blocked_until - now) / 1000),
            message: "Troppi tentativi falliti di riscatto codice da questo dispositivo. Riprova tra qualche minuto."
          };
        }
      }

      // 4. Check Code block
      if (ip && code && typeof code === "string" && code.trim().length > 0) {
        const cleanCode = code.trim().toUpperCase();
        const codeKey = `${ip}:${cleanCode}`;
        const codeRow = this.dbManager.prepare(
          "SELECT failed_count, first_attempt_at, blocked_until FROM student_claim_rate_limits WHERE scope = ? AND identifier = ?"
        ).get("code", codeKey);
        if (codeRow && codeRow.blocked_until > now) {
          return {
            blocked: true,
            remainingSec: Math.ceil((codeRow.blocked_until - now) / 1000),
            message: "Troppi tentativi falliti per questo codice di accesso. Riprova tra qualche minuto."
          };
        }
      }

      return null;
    }

    // In-memory fallback
    if (ip) {
      const rec = this.memoryMap.get(`ip:${ip}`);
      if (rec && rec.blockedUntil > now) {
        return {
          blocked: true,
          remainingSec: Math.ceil((rec.blockedUntil - now) / 1000),
          message: "Troppi tentativi falliti di riscatto codice da questo indirizzo. Riprova tra qualche minuto."
        };
      }
      const burstRec = this.memoryMap.get(`ip_burst:${ip}`);
      if (burstRec && burstRec.blockedUntil > now) {
        return {
          blocked: true,
          remainingSec: Math.ceil((burstRec.blockedUntil - now) / 1000),
          message: "Troppi tentativi falliti in rapida successione da questo indirizzo. Riprova tra qualche minuto."
        };
      }
    }
    if (deviceId) {
      const rec = this.memoryMap.get(`device:${deviceId}`);
      if (rec && rec.blockedUntil > now) {
        return {
          blocked: true,
          remainingSec: Math.ceil((rec.blockedUntil - now) / 1000),
          message: "Troppi tentativi falliti di riscatto codice da questo dispositivo. Riprova tra qualche minuto."
        };
      }
    }
    if (ip && code && typeof code === "string" && code.trim().length > 0) {
      const cleanCode = code.trim().toUpperCase();
      const rec = this.memoryMap.get(`code:${ip}:${cleanCode}`);
      if (rec && rec.blockedUntil > now) {
        return {
          blocked: true,
          remainingSec: Math.ceil((rec.blockedUntil - now) / 1000),
          message: "Troppi tentativi falliti per questo codice di accesso. Riprova tra qualche minuto."
        };
      }
    }
    return null;
  }

  recordFailure({ ip, deviceId = null, code = null, now = Date.now() }) {
    if (this.dbManager?.db) {
      const updateScope = (scope, id, maxLimit, windowMs) => {
        if (!id) return;
        const existing = this.dbManager.prepare(
          "SELECT failed_count, first_attempt_at, last_attempt_at, blocked_until FROM student_claim_rate_limits WHERE scope = ? AND identifier = ?"
        ).get(scope, id);

        let count = 1;
        let firstAttempt = now;
        let blockedUntil = 0;

        if (existing) {
          if (now - existing.first_attempt_at > windowMs) {
            count = 1;
            firstAttempt = now;
            blockedUntil = 0;
          } else {
            count = existing.failed_count + 1;
            firstAttempt = existing.first_attempt_at;
            if (count >= maxLimit) {
              blockedUntil = now + this.blockMs;
            }
          }
        } else if (count >= maxLimit) {
          blockedUntil = now + this.blockMs;
        }

        this.dbManager.prepare(`
          INSERT INTO student_claim_rate_limits (scope, identifier, failed_count, first_attempt_at, last_attempt_at, blocked_until)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(scope, identifier) DO UPDATE SET
            failed_count = excluded.failed_count,
            first_attempt_at = excluded.first_attempt_at,
            last_attempt_at = excluded.last_attempt_at,
            blocked_until = excluded.blocked_until
        `).run(scope, id, count, firstAttempt, now, blockedUntil);
      };

      if (deviceId) updateScope("device", deviceId, this.deviceMaxFails, this.windowMs);
      if (ip && code && typeof code === "string" && code.trim().length > 0) {
        updateScope("code", `${ip}:${code.trim().toUpperCase()}`, this.codeMaxFails, this.windowMs);
      }
      if (ip) {
        updateScope("ip_burst", ip, this.ipBurstMaxFails, this.burstWindowMs);
        updateScope("ip", ip, this.ipMaxFails, this.windowMs);
      }
      return;
    }

    // In-memory fallback
    const updateMem = (key, maxLimit, windowMs) => {
      const existing = this.memoryMap.get(key) || { count: 0, firstAttempt: now, lastAttempt: now, blockedUntil: 0 };
      if (now - existing.firstAttempt > windowMs) {
        existing.count = 0;
        existing.firstAttempt = now;
        existing.blockedUntil = 0;
      }
      existing.count += 1;
      if (existing.count >= maxLimit) {
        existing.blockedUntil = now + this.blockMs;
      }
      existing.lastAttempt = now;
      this.memoryMap.set(key, existing);
    };

    if (deviceId) updateMem(`device:${deviceId}`, this.deviceMaxFails, this.windowMs);
    if (ip && code && typeof code === "string" && code.trim().length > 0) {
      updateMem(`code:${ip}:${code.trim().toUpperCase()}`, this.codeMaxFails, this.windowMs);
    }
    if (ip) {
      updateMem(`ip_burst:${ip}`, this.ipBurstMaxFails, this.burstWindowMs);
      updateMem(`ip:${ip}`, this.ipMaxFails, this.windowMs);
    }
  }

  recordSuccess({ ip, deviceId = null, code = null }) {
    if (this.dbManager?.db) {
      if (deviceId) {
        this.dbManager.prepare(
          "DELETE FROM student_claim_rate_limits WHERE scope = ? AND identifier = ?"
        ).run("device", deviceId);
      }
      if (ip && code && typeof code === "string" && code.trim().length > 0) {
        this.dbManager.prepare(
          "DELETE FROM student_claim_rate_limits WHERE scope = ? AND identifier = ?"
        ).run("code", `${ip}:${code.trim().toUpperCase()}`);
      }
      // Note: We deliberately do NOT delete IP aggregate tracking to prevent bypasses.
      return;
    }

    if (deviceId) this.memoryMap.delete(`device:${deviceId}`);
    if (ip && code && typeof code === "string" && code.trim().length > 0) {
      this.memoryMap.delete(`code:${ip}:${code.trim().toUpperCase()}`);
    }
  }

  reset() {
    if (this.dbManager?.db) {
      this.dbManager.prepare("DELETE FROM student_claim_rate_limits").run();
    }
    this.memoryMap.clear();
  }
}
