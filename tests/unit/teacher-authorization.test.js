import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeacherPrincipalAuthorizer, parseTeacherEmailAllowlist } from '../../src/server/teacher-authorization.js';

test('teacher authorization requires a verified Cloudflare identity explicitly mapped by email', async (t) => {
  const authorize = createTeacherPrincipalAuthorizer({ teacherEmails: ' Teacher@School.edu,other@school.edu\n' });

  await t.test('matches signed Access email case-insensitively and returns opaque actor attribution', async () => {
    const grant = await authorize({
      authenticated: true,
      authMethod: 'cloudflare_access',
      principal: 'sha256:opaque-principal',
      user: { email: 'TEACHER@school.edu' }
    });
    assert.deepEqual(grant, {
      teacherAuthorized: true,
      actorId: 'sha256:opaque-principal',
      principal: 'sha256:opaque-principal'
    });
  });

  await t.test('rejects bearer authentication even when authenticated', async () => {
    assert.equal(await authorize({
      authenticated: true,
      authMethod: 'shared_bearer',
      principal: 'sha256:bearer_authenticated_token',
      user: { email: 'teacher@school.edu' }
    }), false);
  });

  await t.test('rejects unmapped and missing identities', async () => {
    assert.equal(await authorize({ authenticated: true, authMethod: 'cloudflare_access', principal: 'p', user: { email: 'other@example.net' } }), false);
    assert.equal(await authorize({ authenticated: true, authMethod: 'cloudflare_access', principal: 'p', user: {} }), false);
    assert.equal(await authorize({ authenticated: false, authMethod: 'cloudflare_access', principal: 'p', user: { email: 'teacher@school.edu' } }), false);
  });

  await t.test('fails closed for wildcard or malformed allowlist entries', () => {
    assert.throws(() => parseTeacherEmailAllowlist('*'), /wildcards/);
    assert.throws(() => parseTeacherEmailAllowlist('teacher at school'), /invalid entries/);
    assert.equal(parseTeacherEmailAllowlist('').size, 0);
  });
});
