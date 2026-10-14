import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicNetworkAddress, resolvePublicAddresses } from '../../src/network/file-import-network.js';
import { FileService, MAX_ATTACHMENT_SIZE_BYTES } from '../../src/services/file-service.js';
import { SecurityError, ValidationError } from '../../src/core/errors.js';

test('ChatGPT Attachment Transport & Network Security Unit Tests', async (t) => {
  await t.test('isPublicNetworkAddress blocks private, loopback, link-local, and special ranges', () => {
    // Private IPv4
    assert.equal(isPublicNetworkAddress('127.0.0.1'), false, 'loopback 127.0.0.1 must be blocked');
    assert.equal(isPublicNetworkAddress('127.0.0.2'), false, 'loopback range must be blocked');
    assert.equal(isPublicNetworkAddress('10.0.0.1'), false, 'RFC1918 10.0.0.0/8 must be blocked');
    assert.equal(isPublicNetworkAddress('172.16.0.1'), false, 'RFC1918 172.16.0.0/12 must be blocked');
    assert.equal(isPublicNetworkAddress('172.31.255.254'), false, 'RFC1918 172.16.0.0/12 top must be blocked');
    assert.equal(isPublicNetworkAddress('192.168.1.1'), false, 'RFC1918 192.168.0.0/16 must be blocked');
    assert.equal(isPublicNetworkAddress('169.254.169.254'), false, 'cloud metadata link-local must be blocked');
    assert.equal(isPublicNetworkAddress('0.0.0.0'), false, '0.0.0.0/8 must be blocked');
    assert.equal(isPublicNetworkAddress('100.64.0.1'), false, 'shared CGNAT must be blocked');
    assert.equal(isPublicNetworkAddress('224.0.0.1'), false, 'multicast must be blocked');
    assert.equal(isPublicNetworkAddress('240.0.0.1'), false, 'reserved must be blocked');

    // IPv6
    assert.equal(isPublicNetworkAddress('::1'), false, 'IPv6 loopback must be blocked');
    assert.equal(isPublicNetworkAddress('fe80::1'), false, 'IPv6 link-local must be blocked');
    assert.equal(isPublicNetworkAddress('fc00::1'), false, 'IPv6 ULA must be blocked');
    assert.equal(isPublicNetworkAddress('2001:db8::1'), false, 'IPv6 documentation range must be blocked');

    // Valid Public IP
    assert.equal(isPublicNetworkAddress('8.8.8.8'), true, 'public DNS must be allowed');
    assert.equal(isPublicNetworkAddress('1.1.1.1'), true, 'public Cloudflare must be allowed');
    assert.equal(isPublicNetworkAddress('2606:4700:4700::1111'), true, 'public IPv6 must be allowed');
  });

  await t.test('resolvePublicAddresses enforces bounded resolution and rejects private answers', async () => {
    // 1. Success on public DNS answers
    const mockPublicLookup = async () => [
      { address: '20.150.1.1', family: 4 },
      { address: '20.150.1.2', family: 4 }
    ];
    const resolved = await resolvePublicAddresses('files.oaiusercontent.com', { lookupImpl: mockPublicLookup });
    assert.equal(resolved.length, 2);
    assert.equal(resolved[0].address, '20.150.1.1');

    // 2. Rejection on private DNS answers
    const mockPrivateLookup = async () => [{ address: '127.0.0.1', family: 4 }];
    await assert.rejects(
      () => resolvePublicAddresses('internal.server', { lookupImpl: mockPrivateLookup }),
      (err) => {
        assert.ok(err instanceof SecurityError);
        assert.deepEqual(err.details.reasons, ['NON_PUBLIC_ADDRESS_BLOCKED']);
        return true;
      }
    );

    // 3. Rejection on empty or excessive answers
    const mockEmptyLookup = async () => [];
    await assert.rejects(
      () => resolvePublicAddresses('nowhere.test', { lookupImpl: mockEmptyLookup }),
      (err) => {
        assert.ok(err instanceof SecurityError);
        assert.deepEqual(err.details.reasons, ['DNS_ADDRESS_SET_INVALID']);
        return true;
      }
    );
  });

  await t.test('importAttachmentFromChatGPTFile rejects missing or invalid file references', async () => {
    const service = new FileService(null, null);

    await assert.rejects(
      () => service.importAttachmentFromChatGPTFile(null),
      /ChatGPT file input must be a file reference object/
    );
    await assert.rejects(
      () => service.importAttachmentFromChatGPTFile({}),
      /ChatGPT did not provide a complete file reference/
    );
    await assert.rejects(
      () => service.importAttachmentFromChatGPTFile({ file_id: '123' }),
      /ChatGPT did not provide a complete file reference/
    );
    await assert.rejects(
      () => service.importAttachmentFromChatGPTFile({ download_url: 'https://files.oaiusercontent.com/test' }),
      /ChatGPT did not provide a complete file reference/
    );
  });

  await t.test('importAttachmentFromChatGPTFile enforces HTTPS, port 443, no credentials, and host allowlist', async () => {
    const service = new FileService(null, null, {
      lookupImpl: async () => [{ address: '8.8.8.8', family: 4 }]
    });

    // 1. Non-HTTPS
    await assert.rejects(
      () => service.importAttachmentFromChatGPTFile({
        download_url: 'http://files.oaiusercontent.com/attachment.pdf',
        file_id: 'test-1'
      }),
      (err) => {
        assert.ok(err instanceof SecurityError);
        assert.ok(err.details.reasons.includes('HTTPS_REQUIRED'));
        return true;
      }
    );

    // 2. Embedded credentials
    await assert.rejects(
      () => service.importAttachmentFromChatGPTFile({
        download_url: 'https://user:pass@files.oaiusercontent.com/attachment.pdf',
        file_id: 'test-2'
      }),
      (err) => {
        assert.ok(err instanceof SecurityError);
        assert.ok(err.details.reasons.includes('URL_CREDENTIALS_NOT_ALLOWED'));
        return true;
      }
    );

    // 3. Non-standard port
    await assert.rejects(
      () => service.importAttachmentFromChatGPTFile({
        download_url: 'https://files.oaiusercontent.com:8443/attachment.pdf',
        file_id: 'test-3'
      }),
      (err) => {
        assert.ok(err instanceof SecurityError);
        assert.ok(err.details.reasons.includes('NONSTANDARD_PORT_NOT_ALLOWED'));
        return true;
      }
    );

    // 4. Disallowed Host
    for (const badHost of [
      'evil.com',
      'malicious.attacker.com',
      'oaisdmntprnortheu.blob.core.windows.net.attacker.com',
      'bad_azure.blob.core.windows.net',
      'files.oaiusercontent.com.spoof.net'
    ]) {
      await assert.rejects(
        () => service.importAttachmentFromChatGPTFile({
          download_url: `https://${badHost}/attachment.pdf?token=sensitive-query-param`,
          file_id: 'test-bad-host'
        }),
        (err) => {
          assert.ok(err instanceof SecurityError);
          assert.ok(err.details.reasons.includes('HOST_NOT_ALLOWLISTED'));
          assert.equal(err.details.hostname, badHost);
          // Invariant: safe diagnostic must not leak query params or sensitive path
          const errString = JSON.stringify(err.toJSON());
          assert.equal(errString.includes('sensitive-query-param'), false, 'Diagnostic must never leak query token');
          return true;
        }
      );
    }
  });

  await t.test('importAttachmentFromChatGPTFile accepts allowlisted OpenAI and Azure Blob hosts', async () => {
    const requestedUrls = [];
    const service = new FileService(null, null, {
      lookupImpl: async () => [{ address: '20.150.1.1', family: 4 }],
      fetchImpl: async (url) => {
        requestedUrls.push(url.href);
        return {
          status: 200,
          url: url.href,
          headers: { get: (h) => (h === 'content-length' ? '14' : null) },
          async arrayBuffer() {
            return Buffer.from('Test content.');
          }
        };
      }
    });

    // Mock material service to avoid database overhead in transport test
    service.materialService = {
      createMaterial: (m) => ({ id: 'mat-test-1', ...m })
    };
    service.fileStore = {
      saveFile: (name, bytes) => `storage/files/raw/${name}`
    };

    // 1. files.oaiusercontent.com
    const res1 = await service.importAttachmentFromChatGPTFile({
      download_url: 'https://files.oaiusercontent.com/dispensa.txt',
      file_id: 'file-123'
    });
    assert.equal(res1.status, 'imported');

    // 2. Verified Azure Blob North Europe
    const res2 = await service.importAttachmentFromChatGPTFile({
      download_url: 'https://oaisdmntprnortheu.blob.core.windows.net/container/dispensa.txt',
      file_id: 'file-456'
    });
    assert.equal(res2.status, 'imported');

    // 3. Verified Azure Blob West US 3
    const res3 = await service.importAttachmentFromChatGPTFile({
      download_url: 'https://oaisdmntprwestus3.blob.core.windows.net/container/dispensa.txt',
      file_id: 'file-789'
    });
    assert.equal(res3.status, 'imported');

    assert.equal(requestedUrls.length, 3);
  });

  await t.test('importAttachmentFromChatGPTFile rejects HTTP redirects and non-200 responses', async () => {
    const service = new FileService(null, null, {
      lookupImpl: async () => [{ address: '20.150.1.1', family: 4 }],
      fetchImpl: async () => ({
        status: 302,
        redirected: true,
        headers: { get: () => null }
      })
    });

    await assert.rejects(
      () => service.importAttachmentFromChatGPTFile({
        download_url: 'https://files.oaiusercontent.com/redirect.txt',
        file_id: 'f-302'
      }),
      /ChatGPT file download returned HTTP 302; redirects and non-success responses are not followed/
    );
  });

  await t.test('importAttachmentFromChatGPTFile enforces payload size limits', async () => {
    // 1. Content-Length header limit
    const service1 = new FileService(null, null, {
      maxFileSize: 1024,
      lookupImpl: async () => [{ address: '20.150.1.1', family: 4 }],
      fetchImpl: async (url) => ({
        status: 200,
        url: url.href,
        headers: { get: (h) => (h === 'content-length' ? '2048' : null) }
      })
    });

    await assert.rejects(
      () => service1.importAttachmentFromChatGPTFile({
        download_url: 'https://files.oaiusercontent.com/large.txt',
        file_id: 'f-large'
      }),
      (err) => {
        assert.ok(err instanceof SecurityError);
        assert.match(err.message, /exceeds maximum allowed size/);
        return true;
      }
    );

    // 2. Stream byte limit without Content-Length
    const service2 = new FileService(null, null, {
      maxFileSize: 1024,
      lookupImpl: async () => [{ address: '20.150.1.1', family: 4 }],
      fetchImpl: async (url) => ({
        status: 200,
        url: url.href,
        headers: { get: () => null },
        async arrayBuffer() {
          return Buffer.alloc(2048);
        }
      })
    });

    await assert.rejects(
      () => service2.importAttachmentFromChatGPTFile({
        download_url: 'https://files.oaiusercontent.com/stream-large.txt',
        file_id: 'f-stream-large'
      }),
      (err) => {
        assert.ok(err instanceof SecurityError);
        assert.match(err.message, /exceeds maximum allowed size/);
        return true;
      }
    );
  });
});
