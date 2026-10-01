import fs from "node:fs/promises";
import path from "node:path";

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Extracts width and height from PNG IHDR chunk without external dependencies.
 */
export function getPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;

  // PNG magic bytes: \x89PNG\r\n\x1a\n
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (!isPng) return null;

  // IHDR width is at offset 16, height at offset 20 (big-endian 32-bit uint)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return { width, height };
}

/**
 * Detects MIME type using magic bytes with fallback to file extension.
 */
export function detectMimeType(buffer: Buffer, filePath?: string): string {
  if (buffer.length >= 8) {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return "image/png";
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }

    // GIF: 47 49 46
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return "image/gif";
    }

    // WebP: RIFF....WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer.length >= 12 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return "image/webp";
    }
  }

  // Fallback by extension
  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".webp":
        return "image/webp";
      case ".gif":
        return "image/gif";
    }
  }

  return "image/png";
}

/**
 * Reads a local image file and returns base64 and MIME type.
 */
export async function readLocalImage(
  resolvedPath: string
): Promise<{ base64Data: string; mimeType: string }> {
  const stat = await fs.stat(resolvedPath);
  if (!stat.isFile()) {
    throw new Error(`Input path is not a file: ${resolvedPath}`);
  }

  const buffer = await fs.readFile(resolvedPath);
  const mimeType = detectMimeType(buffer, resolvedPath);
  const base64Data = buffer.toString("base64");

  return { base64Data, mimeType };
}
