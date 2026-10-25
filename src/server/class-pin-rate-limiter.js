import crypto from 'node:crypto';

const FIVE_MINUTES = 5 * 60 * 1000;
const BURST_WINDOW = 10 * 1000;
const BLOCK_DURATION = 5 * 60 * 1000;

/**
 * PIN limiter scoped by class and a trusted peer IP, with a separate per-browser
 * bucket. The IP comes from resolveClientIp; client-supplied forwarding headers
 * are not trusted unless the immediate peer is configured as a proxy.
 */
export class ClassPinRateLimiter {
  constructor(dbManager, { deviceMaxFailures = 8, ipMaxFailures = 120, burstMaxFailures = 75 } = {}) {
    this.dbManager = dbManager;
    this.deviceMaxFailures = deviceMaxFailures;
    this.ipMaxFailures = ipMaxFailures;
    this.burstMaxFailures = burstMaxFailures;
  }

  _identifier(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
  }

  _bucket(scope, classId, value) {
    return { scope, identifier: this._identifier(`${classId}\0${value}`) };
  }

  check({ classId, ip = null, deviceId = null, now = Date.now() }) {
    const checks = [];
    if (deviceId) checks.push(this._bucket('class_pin_device', classId, deviceId));
    if (ip) {
      const ipBucket = this._bucket('class_pin_ip', classId, ip);
      checks.push(ipBucket, { ...ipBucket, scope: 'class_pin_ip_burst' });
    }
    for (const { scope, identifier } of checks) {
      const row = this.dbManager.prepare(`
        SELECT blocked_until FROM student_claim_rate_limits WHERE scope = ? AND identifier = ?
      `).get(scope, identifier);
      if (row?.blocked_until > now) {
        return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil((row.blocked_until - now) / 1000)) };
      }
    }
    return { blocked: false, retryAfterSeconds: 0 };
  }

  recordFailure({ classId, ip = null, deviceId = null, now = Date.now() }) {
    const buckets = [];
    if (deviceId) buckets.push({ ...this._bucket('class_pin_device', classId, deviceId), limit: this.deviceMaxFailures, windowMs: FIVE_MINUTES });
    if (ip) {
      const ipBucket = this._bucket('class_pin_ip', classId, ip);
      buckets.push({ ...ipBucket, limit: this.ipMaxFailures, windowMs: FIVE_MINUTES });
      buckets.push({ ...ipBucket, scope: 'class_pin_ip_burst', limit: this.burstMaxFailures, windowMs: BURST_WINDOW });
    }
    this.dbManager.transaction(() => {
      for (const bucket of buckets) this._increment(bucket, now);
    });
  }

  _increment({ scope, identifier, limit, windowMs }, now) {
    const current = this.dbManager.prepare(`
      SELECT failed_count, first_attempt_at FROM student_claim_rate_limits
      WHERE scope = ? AND identifier = ?
    `).get(scope, identifier);
    const freshWindow = !current || now - current.first_attempt_at > windowMs;
    const failedCount = freshWindow ? 1 : current.failed_count + 1;
    const firstAttemptAt = freshWindow ? now : current.first_attempt_at;
    const blockedUntil = failedCount >= limit ? now + BLOCK_DURATION : 0;
    this.dbManager.prepare(`
      INSERT INTO student_claim_rate_limits
        (scope, identifier, failed_count, first_attempt_at, last_attempt_at, blocked_until)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(scope, identifier) DO UPDATE SET
        failed_count = excluded.failed_count,
        first_attempt_at = excluded.first_attempt_at,
        last_attempt_at = excluded.last_attempt_at,
        blocked_until = excluded.blocked_until
    `).run(scope, identifier, failedCount, firstAttemptAt, now, blockedUntil);
  }
}
