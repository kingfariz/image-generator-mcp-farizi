import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveActiveWorkspace } from "../workspace.js";

export async function getWorkspaceRoot(server: McpServer): Promise<string> {
  let clientRoots: Array<{ uri: string; name?: string }> | undefined;
  try {
    const res = await server.server.listRoots();
    clientRoots = res?.roots;
  } catch {
    // Client may not support roots/list
  }
  return await resolveActiveWorkspace(clientRoots);
}

export function formatSuccessResponse(
  title: string,
  filePath: string,
  filename: string,
  mimeType: string,
  model: string,
  aspectRatio: string,
  bytes: number,
  dimensions: { width: number; height: number } | null
): string {
  const sizeMb = (bytes / (1024 * 1024)).toFixed(2);
  const dimStr = dimensions
    ? `${dimensions.width}x${dimensions.height}`
    : "Unknown";

  return `${title}

Path:
${filePath}

Details:
- Filename: ${filename}
- MIME Type: ${mimeType}
- Dimensions: ${dimStr}
- Aspect Ratio: ${aspectRatio}
- Model: ${model}
- File Size: ${sizeMb} MB (${bytes.toLocaleString()} bytes)`;
}
