import { isAllowedObjectKey } from "./fileStorage";

const MIN_REFERENCE_LEN = 4;
const MAX_REFERENCE_LEN = 120;

/** Normalize transfer reference for storage and uniqueness checks. */
export function normalizePaymentReference(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_REFERENCE_LEN);
}

export function isValidPaymentReference(normalized: string | null): boolean {
  if (!normalized) return false;
  if (normalized.length < MIN_REFERENCE_LEN) return false;
  // Reject obviously fake / placeholder refs
  if (/^(test|xxx+|000+|n\/?a|none)$/i.test(normalized)) return false;
  return true;
}

/**
 * Accept relative upload URLs or raw object keys under uploads|id|carnehat.
 * Returns the object key for storage / ACL checks.
 */
export function extractProofObjectKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  if (isAllowedObjectKey(value)) return value;

  try {
    const asUrl = value.startsWith("http")
      ? new URL(value)
      : value.startsWith("/")
        ? new URL(value, "http://localhost")
        : null;
    if (asUrl) {
      const key = asUrl.searchParams.get("key");
      if (key && isAllowedObjectKey(key)) return key;
    }
  } catch {
    /* ignore */
  }

  const keyMatch = value.match(/[?&]key=([^&]+)/);
  if (keyMatch?.[1]) {
    const decoded = decodeURIComponent(keyMatch[1]);
    if (isAllowedObjectKey(decoded)) return decoded;
  }

  return null;
}

export function proofImageUrlFromKey(objectKey: string): string {
  return `/api/uploads/file?key=${encodeURIComponent(objectKey)}`;
}
