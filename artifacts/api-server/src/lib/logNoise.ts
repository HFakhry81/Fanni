/** Paths commonly hit by bots; skip routine access logs to keep PM2 output readable. */
const QUIET_EXACT = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

/** Probes for sensitive files (/.env, /.git, WordPress paths, etc.). */
const PROBE_PREFIX_RE =
  /^\/(\.env|\.git|\.htaccess|\.htpasswd|wp-admin|wp-login\.php|phpmyadmin|admin\.php|xmlrpc\.php)(\/|$)/i;

export function isQuietRequestPath(url: string | undefined): boolean {
  const path = (url ?? "/").split("?")[0] ?? "/";
  return QUIET_EXACT.has(path) || PROBE_PREFIX_RE.test(path);
}
