// Author: be-api-router
import { isIP } from "net";
import dns from "dns/promises";

// RFC 1918, loopback, link-local, and IPv6 equivalents
const BLOCKED_IPV4_RANGES: ReadonlyArray<{ prefix: number; mask: number }> = [
  { prefix: 0x7F000000, mask: 0xFF000000 },  // 127.0.0.0/8
  { prefix: 0x0A000000, mask: 0xFF000000 },  // 10.0.0.0/8
  { prefix: 0xAC100000, mask: 0xFFF00000 },  // 172.16.0.0/12
  { prefix: 0xC0A80000, mask: 0xFFFF0000 },  // 192.168.0.0/16
  { prefix: 0xA9FE0000, mask: 0xFFFF0000 },  // 169.254.0.0/16
  { prefix: 0x00000000, mask: 0xFFFFFFFF },  // 0.0.0.0
];

const BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set([
  "localhost",
  "localhost.",
]);

const ipv4ToInt = (ip: string): number => {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

const isBlockedIPv4 = (ip: string): boolean => {
  const num = ipv4ToInt(ip);
  return BLOCKED_IPV4_RANGES.some(({ prefix, mask }) => ((num & mask) >>> 0) === (prefix >>> 0));
};

const isBlockedIPv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  // fc00::/7 (unique local)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // fe80::/10 (link-local)
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  return false;
};

const isBlockedIP = (ip: string): boolean => {
  if (isIP(ip) === 4) return isBlockedIPv4(ip);
  if (isIP(ip) === 6) return isBlockedIPv6(ip);
  return false;
};

interface EndpointCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

const checkEndpointUrl = (endpoint: string, requireHttps: boolean): EndpointCheckResult => {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { allowed: false, reason: "Invalid URL" };
  }

  if (requireHttps && parsed.protocol !== "https:") {
    return { allowed: false, reason: "HTTPS required in production" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { allowed: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname;

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    return { allowed: false, reason: "Blocked hostname: localhost" };
  }

  // If hostname is a literal IP, check it directly
  if (isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      return { allowed: false, reason: `Blocked IP address: ${hostname}` };
    }
  }

  return { allowed: true };
};

const resolveAndCheckEndpoint = async (endpoint: string, requireHttps: boolean): Promise<EndpointCheckResult> => {
  // First do the static check
  const staticResult = checkEndpointUrl(endpoint, requireHttps);
  if (!staticResult.allowed) return staticResult;

  const parsed = new URL(endpoint);
  const hostname = parsed.hostname;

  // If it's already an IP, static check was sufficient
  if (isIP(hostname)) return { allowed: true };

  // Resolve hostname and check all returned IPs.
  // If DNS fails entirely, allow — the actual fetch will fail anyway.
  // The goal is to catch hostnames that resolve to private IPs (DNS rebinding).
  try {
    const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
    const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    const allAddresses = [...addresses, ...addresses6];

    for (const addr of allAddresses) {
      if (isBlockedIP(addr)) {
        return { allowed: false, reason: `Hostname ${hostname} resolves to blocked IP ${addr}` };
      }
    }
  } catch {
    // DNS lookup infrastructure failure — allow, actual fetch will fail
  }

  return { allowed: true };
};

export { checkEndpointUrl, resolveAndCheckEndpoint, isBlockedIP, isBlockedIPv4, isBlockedIPv6 };
export type { EndpointCheckResult };
