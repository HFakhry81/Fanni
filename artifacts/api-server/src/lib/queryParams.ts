/**
 * Safe query-parameter helpers.
 *
 * Express v5 types: values inside `req.query` are
 *   string | ParsedQs | string[] | ParsedQs[]
 * so bare `as string` casts are unsound.  These helpers narrow the value
 * properly and return a typed result (or a safe fallback).
 */

/**
 * Returns the value only when it is a plain string, otherwise `undefined`.
 */
export function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Parses an integer query parameter.
 * Returns `fallback` when the param is absent, not a plain string, or
 * not a valid integer.
 */
export function queryInt(value: unknown, fallback: number): number {
  const str = queryString(value);
  if (str === undefined) return fallback;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parses a float query parameter.
 * Returns `NaN` when the param is absent or not a valid float — callers
 * should always check `isNaN()` on the result.
 */
export function queryFloat(value: unknown): number {
  const str = queryString(value);
  return str !== undefined ? parseFloat(str) : NaN;
}
