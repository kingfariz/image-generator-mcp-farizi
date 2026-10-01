import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PUBLIC_DIR, PUBLIC_DIR_NAME } from "./config.js";
import { isPathInside, sanitizeFilenamePrefix } from "./utils/security.js";

export interface SavedImageResult {
  filePath: string;
  filename: string;
  bytes: number;
}

/**
 * Resolves the sandbox / public directory for saving images.
 * Defaults to the MCP project folder's /public directory.
 */
export function getSandboxDir(workspaceRoot?: string): string {
  if (workspaceRoot && workspaceRoot.trim().length > 0) {
    const resolved = path.resolve(workspaceRoot);
    if (path.basename(resolved).toLowerCase() === PUBLIC_DIR_NAME) {
      return resolved;
    }
    return path.resolve(resolved, PUBLIC_DIR_NAME);
  }
  return DEFAULT_PUBLIC_DIR;
}

/**
 * Ensures the sandbox directory exists.
 */
export async function ensureSandboxDir(workspaceRoot?: string): Promise<string> {
  const sandboxDir = getSandboxDir(workspaceRoot);
  await fs.mkdir(sandboxDir, { recursive: true });
  return sandboxDir;
}

/**
 * Generates a unique, sanitized filename within the sandbox.
 */
export function generateUniqueFilename(rawPrefix?: string): string {
  const safePrefix = sanitizeFilenamePrefix(rawPrefix);
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(4).toString("hex");
  return `${safePrefix}_${timestamp}_${randomHex}.png`;
}

/**
 * Saves generated image buffer into the sandbox.
 * Enforces strict path containment, symlink checks, and no-overwrite guarantees.
 */
export async function saveImageToSandbox(
  workspaceRoot: string | undefined,
  imageBuffer: Buffer,
  rawPrefix?: string
): Promise<SavedImageResult> {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("Cannot save empty image buffer.");
  }

  // 1. Resolve sandbox directory
  const sandboxDir = await ensureSandboxDir(workspaceRoot);

  // 2. Generate unique sanitized filename
  let filename = generateUniqueFilename(rawPrefix);
  let targetPath = path.resolve(sandboxDir, filename);

  // 3. Pre-write containment check
  if (!isPathInside(sandboxDir, targetPath)) {
    throw new Error(
      `Sandbox violation: target path "${targetPath}" is outside sandbox "${sandboxDir}".`
    );
  }

  // 4. Ensure file does not already exist (retry with new random suffix if exists)
  let attempts = 0;
  while (attempts < 5) {
    try {
      await fs.access(targetPath);
      // File exists, generate new name
      filename = generateUniqueFilename(rawPrefix);
      targetPath = path.resolve(sandboxDir, filename);
      attempts++;
    } catch {
      // File does not exist, ready to write
      break;
    }
  }

  // 5. Write using 'wx' flag (exclusive write, fails if file exists)
  await fs.writeFile(targetPath, imageBuffer, { flag: "wx" });

  // 6. Post-write canonical verification (guards against symlink escapes)
  const realSandbox = await fs.realpath(sandboxDir);
  const realTarget = await fs.realpath(targetPath);
  if (!isPathInside(realSandbox, realTarget)) {
    try {
      await fs.unlink(targetPath);
    } catch {
      // Ignore deletion failure
    }
    throw new Error(
      `Sandbox violation: target realpath "${realTarget}" is outside sandbox "${realSandbox}".`
    );
  }

  return {
    filePath: targetPath,
    filename,
    bytes: imageBuffer.length,
  };
}

