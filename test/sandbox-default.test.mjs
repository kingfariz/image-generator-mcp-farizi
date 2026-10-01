import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DEFAULT_PUBLIC_DIR, MCP_PROJECT_DIR } from "../build/config.js";
import { getSandboxDir, saveImageToSandbox } from "../build/sandbox.js";
import { resolveActiveWorkspace } from "../build/workspace.js";

test("Default Path: Resolves to MCP project /public directory", async () => {
  // Test when no client roots or when running inside VS Code / AppData
  const resolvedWorkspace = await resolveActiveWorkspace();
  const sandboxDir = getSandboxDir(resolvedWorkspace);

  assert.equal(sandboxDir, path.resolve(MCP_PROJECT_DIR, "public"));
  assert.equal(sandboxDir, DEFAULT_PUBLIC_DIR);

  // Test saving an image with default workspace
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
  buf.writeUInt32BE(256, 16);
  buf.writeUInt32BE(256, 20);

  const res = await saveImageToSandbox(resolvedWorkspace, buf, "mcp_default_test");

  assert.ok(
    res.filePath.startsWith(DEFAULT_PUBLIC_DIR),
    `File path ${res.filePath} must be inside ${DEFAULT_PUBLIC_DIR}`
  );

  // Verify file exists
  const stat = await fs.stat(res.filePath);
  assert.equal(stat.size, buf.length);

  // Cleanup test file
  await fs.unlink(res.filePath);
});
