import path from "node:path";
import { getApiKey } from "../config.js";

/**
 * Strips sensitive API keys, auth headers, and query parameters from text.
 */
export function sanitizeText(text: string, apiKey?: string): string {
  if (!text) return "";
  let result = text;

  const keyToRedact = apiKey || getApiKey();
  if (keyToRedact && keyToRedact.length > 3) {
    result = result.split(keyToRedact).join("[REDACTED_API_KEY]");
  }

  // Redact URL query parameter ?key=... or &key=...
  result = result.replace(/([?&]key=)[^&\s"']+/gi, "$1[REDACTED_API_KEY]");
  // Redact x-goog-api-key header
  result = result.replace(
    /(x-goog-api-key\s*:\s*)[^\r\n,;]+/gi,
    "$1[REDACTED_API_KEY]"
  );
  // Redact Authorization headers
  result = result.replace(
    /(Authorization\s*:\s*Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi,
    "$1[REDACTED_TOKEN]"
  );

  return result;
}

/**
 * Sanitizes errors and exceptions, returning a clean, credential-free message.
 */
export function sanitizeError(err: unknown, apiKey?: string): string {
  if (!err) return "Unknown error occurred";
  const message =
    err instanceof Error ? err.stack || err.message : String(err);
  return sanitizeText(message, apiKey);
}

/**
 * Diagnostic logger that logs strictly to stderr with credentials redacted.
 * stdout MUST remain pristine for MCP JSON-RPC communication.
 */
export function logDiagnostic(message: string): void {
  const sanitized = sanitizeText(message);
  process.stderr.write(`[image-generator-mcp-farizi] ${sanitized}\n`);
}

/**
 * Sanitizes a filename prefix or name to only contain safe alphanumeric,
 * dash, and underscore characters. Strips any path traversal tokens.
 */
export function sanitizeFilenamePrefix(rawPrefix?: string): string {
  if (!rawPrefix) return "image";
  const sanitized = rawPrefix
    .replace(/[\\/:\*\?"<>\|]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return sanitized.length > 0 ? sanitized : "image";
}

/**
 * Validates that a resolved target path resides strictly inside a parent directory.
 * Prevents traversal attacks and directory escapes across both POSIX and Windows.
 */
export function isPathInside(parentDir: string, targetPath: string): boolean {
  const resolvedParent = path.resolve(parentDir);
  const resolvedTarget = path.resolve(targetPath);

  // Normalize Windows paths by converting to lower case for case-insensitive comparison
  const parentNorm =
    process.platform === "win32"
      ? resolvedParent.toLowerCase()
      : resolvedParent;
  const targetNorm =
    process.platform === "win32"
      ? resolvedTarget.toLowerCase()
      : resolvedTarget;

  const rel = path.relative(parentNorm, targetNorm);

  // If rel starts with '..' or is absolute, it is outside parent
  return (
    !rel.startsWith("..") &&
    !path.isAbsolute(rel) &&
    rel !== "" &&
    !rel.includes(".." + path.sep)
  );
}
