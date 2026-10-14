/**
 * Minimal application-level teacher authorization for Cloudflare Access principals.
 * Authentication alone is never treated as a teacher grant. The only accepted
 * production identity is the email claim from a cryptographically verified
 * Cloudflare Access assertion, matched against an operator-owned allowlist.
 */

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function parseTeacherEmailAllowlist(value = '') {
  const entries = String(value)
    .split(/[;,\n]/)
    .map(normalizeEmail)
    .filter(Boolean);

  for (const email of entries) {
    if (email === '*' || /\s/.test(email) || !/^[^@]+@[^@]+$/.test(email)) {
      throw new Error('TEACHER_SERVICE_TEACHER_EMAILS must contain explicit email identities; wildcards and invalid entries are not allowed');
    }
  }

  return new Set(entries);
}

export function createTeacherPrincipalAuthorizer({
  teacherEmails = process.env.TEACHER_SERVICE_TEACHER_EMAILS || ''
} = {}) {
  const allowedEmails = parseTeacherEmailAllowlist(teacherEmails);

  return async (authResult) => {
    if (authResult?.authenticated !== true || authResult.authMethod !== 'cloudflare_access') return false;

    const email = normalizeEmail(authResult.user?.email);
    if (!email || !allowedEmails.has(email)) return false;

    return {
      teacherAuthorized: true,
      // Use the already-derived opaque principal identifier for audit attribution.
      actorId: authResult.principal,
      principal: authResult.principal
    };
  };
}
