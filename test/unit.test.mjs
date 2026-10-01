import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getSandboxDir, saveImageToSandbox } from "../build/sandbox.js";
import { getPngDimensions } from "../build/utils/image.js";
import {
  isPathInside,
  sanitizeError,
  sanitizeFilenamePrefix,
  sanitizeText,
} from "../build/utils/security.js";
import { buildExperimentalRequestBody } from "../build/vertex.js";
import {
  MCP_INSTALL_DIR,
  validateWorkspacePath,
} from "../build/workspace.js";

function createSyntheticPng(width, height) {
  const buf = Buffer.alloc(33);
  buf.writeUInt8(0x89, 0);
  buf.writeUInt8(0x50, 1);
  buf.writeUInt8(0x4e, 2);
  buf.writeUInt8(0x47, 3);
  buf.writeUInt8(0x0d, 4);
  buf.writeUInt8(0x0a, 5);
  buf.writeUInt8(0x1a, 6);
  buf.writeUInt8(0x0a, 7);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

test("Security: Redacts credentials from text and errors", () => {
  const secretKey = "AIzaSyFakeKey123456789";
  const rawText = `Request: https://aiplatform.googleapis.com/v1/models?key=${secretKey}`;
  const sanitized = sanitizeText(rawText, secretKey);
  assert.ok(!sanitized.includes(secretKey));
  assert.ok(sanitized.includes("[REDACTED_API_KEY]"));

  const err = new Error(`Header x-goog-api-key: ${secretKey}`);
  const sanitizedErr = sanitizeError(err, secretKey);
  assert.ok(!sanitizedErr.includes(secretKey));
});

test("Security: Filename sanitization & path containment", () => {
  assert.equal(sanitizeFilenamePrefix("../../etc/passwd"), "etc_passwd");
  assert.equal(sanitizeFilenamePrefix("..\\windows\\sys32"), "windows_sys32");
  assert.equal(sanitizeFilenamePrefix("hero:image*01?"), "hero_image_01");

  const sandbox = path.resolve("F:/proj/public");
  assert.ok(isPathInside(sandbox, path.resolve(sandbox, "test.png")));
  assert.ok(!isPathInside(sandbox, path.resolve(sandbox, "../escape.png")));
  assert.ok(!isPathInside(sandbox, path.resolve("F:/proj/src/index.ts")));
});

test("Image Utility: getPngDimensions parsing", () => {
  const png1 = createSyntheticPng(1920, 1080);
  assert.deepEqual(getPngDimensions(png1), { width: 1920, height: 1080 });

  const corrupt = Buffer.from([0x00, 0x01, 0x02]);
  assert.equal(getPngDimensions(corrupt), null);
});

test("Workspace: Rejects root, home, desktop, and AppData/VSCode directories", async () => {
  const rootDir = path.parse(process.cwd()).root;
  assert.equal((await validateWorkspacePath(rootDir)).valid, false);

  const home = os.homedir();
  assert.equal((await validateWorkspacePath(home)).valid, false);
  assert.equal((await validateWorkspacePath(path.join(home, "Desktop"))).valid, false);
  assert.equal((await validateWorkspacePath(path.join(home, "AppData"))).valid, false);
  assert.equal(
    (await validateWorkspacePath(path.join(home, "AppData", "Local", "Programs", "Microsoft VS Code"))).valid,
    false,
    "VS Code AppData directory must be rejected"
  );
  // MCP Install dir is accepted as default workspace location
  assert.equal((await validateWorkspacePath(MCP_INSTALL_DIR)).valid, true);
});

test("Workspace: Accepts project directory with project marker", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "test-game-"));
  try {
    await fs.writeFile(path.join(tmp, "project.godot"), "; Godot\n");
    assert.equal((await validateWorkspacePath(tmp, false)).valid, true);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("Sandbox: Physical file saving inside sandbox", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "test-sb-"));
  try {
    await fs.writeFile(path.join(tmp, "package.json"), "{}");
    const png = createSyntheticPng(512, 512);
    const result = await saveImageToSandbox(tmp, png, "player");

    assert.ok(result.filePath.startsWith(getSandboxDir(tmp)));
    assert.ok(result.filename.startsWith("player_"));
    assert.ok(result.filename.endsWith(".png"));

    const stat = await fs.stat(result.filePath);
    assert.equal(stat.size, png.length);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("Vertex AI: buildExperimentalRequestBody matches baseline", () => {
  const parts = [{ text: "Character portrait" }];
  const body = buildExperimentalRequestBody(parts, false, "gemini-3-pro-image", "16:9", "2K");
  assert.equal(body.contents[0].parts[0].text, "Character portrait");
  assert.equal(body.generationConfig.imageConfig.aspectRatio, "16:9");
  assert.equal(body.generationConfig.imageConfig.imageSize, "2K");
  assert.equal(body.generationConfig.imageConfig.personGeneration, "ALLOW_ALL");
});
