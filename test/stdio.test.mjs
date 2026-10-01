import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.resolve(__dirname, "../build/index.js");

test("Stdio Process: Spawns server, performs MCP initialize handshake and tools/list", async () => {
  const child = spawn("node", [serverScript], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let initResponseReceived = false;
  let toolsListReceived = false;

  const promise = new Promise((resolve, reject) => {
    let buffer = "";

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line.trim());
          if (msg.id === 1) {
            initResponseReceived = true;
            assert.equal(msg.result.serverInfo.name, "image-generator-mcp-farizi");

            // Send initialized notification
            child.stdin.write(
              JSON.stringify({
                jsonrpc: "2.0",
                method: "notifications/initialized",
              }) + "\n"
            );

            // Send tools/list request
            child.stdin.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list",
                params: {},
              }) + "\n"
            );
          } else if (msg.id === 2) {
            toolsListReceived = true;
            const names = msg.result.tools.map((t) => t.name);
            assert.ok(names.includes("generate_image"));
            assert.ok(names.includes("edit_image"));
            assert.ok(names.includes("generate_texture"));
            child.kill();
            resolve();
          }
        } catch (e) {
          // ignore partial JSON parse errors
        }
      }
    });

    child.stderr.on("data", (data) => {
      // Diagnostic logging to stderr is expected and normal
    });

    child.on("error", (err) => reject(err));

    const timeoutId = setTimeout(() => {
      child.kill();
      if (!initResponseReceived || !toolsListReceived) {
        reject(new Error("Timeout waiting for stdio responses"));
      }
    }, 4000);

    const cleanup = () => clearTimeout(timeoutId);
    const originalResolve = resolve;
    resolve = () => {
      cleanup();
      originalResolve();
    };
    const originalReject = reject;
    reject = (err) => {
      cleanup();
      originalReject(err);
    };
  });

  // Send initialize request
  const initRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-runner", version: "1.0.0" },
    },
  };

  child.stdin.write(JSON.stringify(initRequest) + "\n");

  await promise;
  assert.ok(initResponseReceived, "Initialize response must be received");
  assert.ok(toolsListReceived, "Tools list response must be received");
});
