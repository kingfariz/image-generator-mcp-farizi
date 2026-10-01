#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerEditImageTool } from "./tools/editImage.js";
import { registerGenerateImageTool } from "./tools/generateImage.js";
import { registerGenerateTextureTool } from "./tools/generateTexture.js";
import { logDiagnostic, sanitizeError } from "./utils/security.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "image-generator-mcp-farizi",
    version: "1.0.0",
  });

  registerGenerateImageTool(server);
  registerEditImageTool(server);
  registerGenerateTextureTool(server);

  return server;
}

export const server = createServer();

export async function startStdioServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logDiagnostic("image-generator-mcp-farizi server started via stdio transport");

  process.on("SIGINT", async () => {
    logDiagnostic("Received SIGINT, shutting down gracefully");
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logDiagnostic("Received SIGTERM, shutting down gracefully");
    await server.close();
    process.exit(0);
  });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  startStdioServer().catch((err) => {
    logDiagnostic(`Fatal server error: ${sanitizeError(err)}`);
    process.exit(1);
  });
}

