import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../build/index.js";

test("MCP Integration: Tool registration and schemas", async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const testServer = createServer();

  await testServer.connect(serverTransport);

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: { roots: { listChanged: false } } }
  );

  await client.connect(clientTransport);

  const toolsResult = await client.listTools();
  const toolNames = toolsResult.tools.map((t) => t.name);

  assert.ok(toolNames.includes("generate_image"), "Must register generate_image");
  assert.ok(toolNames.includes("edit_image"), "Must register edit_image");
  assert.ok(toolNames.includes("generate_texture"), "Must register generate_texture");

  // Check generate_image schema
  const genTool = toolsResult.tools.find((t) => t.name === "generate_image");
  assert.ok(genTool.inputSchema.properties.prompt, "prompt is required");
  assert.ok(genTool.inputSchema.properties.aspectRatio, "aspectRatio should be present");
  assert.deepEqual(
    genTool.inputSchema.properties.model.enum,
    ["gemini-3-pro-image", "gemini-3.1-flash-image"],
    "model must have enum dropdown options"
  );

  // Check edit_image schema
  const editTool = toolsResult.tools.find((t) => t.name === "edit_image");
  assert.ok(editTool.inputSchema.properties.imagePath, "imagePath is required");
  assert.ok(editTool.inputSchema.properties.prompt, "prompt is required");

  // Check generate_texture schema
  const texTool = toolsResult.tools.find((t) => t.name === "generate_texture");
  assert.ok(texTool.inputSchema.properties.prompt, "prompt is required");
  assert.ok(texTool.inputSchema.properties.seamless, "seamless is available");

  // Test calling tool without API key: must fail closed safely
  delete process.env.AI_GATEWAY_API_KEY;
  const callRes = await client.callTool({
    name: "generate_image",
    arguments: { prompt: "test prompt" },
  });

  assert.equal(callRes.isError, true, "Call must report error when API key or workspace missing");
  const textOutput = callRes.content[0].text;
  assert.ok(
    textOutput.includes("Error:") || textOutput.includes("fail-closed"),
    "Must output clear error message"
  );
  assert.ok(!textOutput.includes("undefined"), "Must not leak raw undefined");

  await client.close();
  await testServer.close();
});

