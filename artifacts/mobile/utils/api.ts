export function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (!domain) return "";
  const isLocal =
    domain.includes("192.168.") ||
    domain.includes("10.") ||
    domain.includes("localhost") ||
    domain.includes("127.0.0.1");
  return isLocal ? `http://${domain}` : `https://${domain}`;
}
