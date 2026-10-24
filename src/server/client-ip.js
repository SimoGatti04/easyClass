import net from 'node:net';

function normalizeIp(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const mappedV4 = trimmed.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedV4 && net.isIPv4(mappedV4[1])) return mappedV4[1];
  return net.isIP(trimmed) ? trimmed : null;
}

function normalizeCidr(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const parts = trimmed.split('/');
  if (parts.length > 2) return null;
  const address = normalizeIp(parts[0]);
  if (!address) return null;
  const family = net.isIPv4(address) ? 'ipv4' : 'ipv6';
  const maxPrefix = family === 'ipv4' ? 32 : 128;
  const prefix = parts.length === 1 ? maxPrefix : Number(parts[1]);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) return null;
  return { address, family, prefix };
}

export function resolveClientIp(req, trustedProxyCidrs = []) {
  const socketPeer = normalizeIp(req?.socket?.remoteAddress) || 'unknown';
  const peerFamily = net.isIPv4(socketPeer) ? 'ipv4' : net.isIPv6(socketPeer) ? 'ipv6' : null;
  if (!peerFamily) return socketPeer;

  const allowlist = new net.BlockList();
  let hasTrustedRanges = false;
  for (const value of trustedProxyCidrs) {
    const cidr = normalizeCidr(value);
    if (!cidr) continue;
    allowlist.addSubnet(cidr.address, cidr.prefix, cidr.family);
    hasTrustedRanges = true;
  }
  if (!hasTrustedRanges || !allowlist.check(socketPeer, peerFamily)) return socketPeer;

  // Cloudflare overwrites CF-Connecting-IP at its edge. Do not use X-Forwarded-For,
  // whose client-supplied chain is ambiguous without a separately defined proxy chain.
  const forwarded = req.headers?.['cf-connecting-ip'];
  const clientIp = normalizeIp(typeof forwarded === 'string' ? forwarded : '');
  return clientIp || socketPeer;
}
