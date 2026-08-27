import { getApiBase } from "./api";

/**
 * Turn API-relative upload paths into absolute Image-ready URIs.
 * Appends the session token when available so Image can load private files
 * (and older servers that still require auth on all upload GETs).
 */
export function resolveMediaUrl(
  url: string | null | undefined,
  opts?: { token?: string | null },
): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Local device / data URIs — leave alone
  if (
    trimmed.startsWith("file:") ||
    trimmed.startsWith("content:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("ph://") ||
    trimmed.startsWith("assets-library:")
  ) {
    return trimmed;
  }

  const apiBase = getApiBase().replace(/\/$/, "");
  let absolute = trimmed;
  if (trimmed.startsWith("/")) {
    absolute = `${apiBase}${trimmed}`;
  } else if (!/^https?:\/\//i.test(trimmed)) {
    absolute = `${apiBase}/${trimmed.replace(/^\.\//, "")}`;
  }

  const isUploadApi = absolute.includes("/api/uploads/file");
  if (isUploadApi && opts?.token && !/[?&](access_token|token)=/.test(absolute)) {
    const sep = absolute.includes("?") ? "&" : "?";
    absolute = `${absolute}${sep}access_token=${encodeURIComponent(opts.token)}`;
  }

  return absolute;
}
