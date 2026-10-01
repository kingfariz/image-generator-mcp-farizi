import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AVAILABLE_MODELS, getDefaultModel } from "../config.js";
import { saveImageToSandbox } from "../sandbox.js";
import { getPngDimensions } from "../utils/image.js";
import { sanitizeError } from "../utils/security.js";
import { callVertexGenerateImage, VertexContentPart } from "../vertex.js";
import { formatSuccessResponse, getWorkspaceRoot } from "./common.js";

export function registerGenerateTextureTool(server: McpServer): void {
  server.tool(
    "generate_texture",
    "Generate a game texture or visual asset (such as seamless materials, PBR layers, UI elements, or tiles) from a description using Vertex AI Nano Banana. Saved directly into the project's sandbox.",
    {
      prompt: z
        .string()
        .describe(
          "Description of the texture to generate (e.g. 'cracked medieval stone wall', 'futuristic sci-fi metal panel').",
        ),
      aspectRatio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4", "2:1", "1:2"])
        .optional()
        .describe("Aspect ratio of the texture. Default is '1:1'."),
      seamless: z
        .boolean()
        .optional()
        .describe(
          "Whether the texture should be designed as a seamless, tileable pattern. Default: false.",
        ),
      textureType: z
        .string()
        .optional()
        .describe(
          "Optional texture type or style (e.g. 'diffuse/albedo', 'normal map', 'roughness', 'stylized hand-painted', 'isometric tile').",
        ),
      model: z
        .enum(AVAILABLE_MODELS)
        .optional()
        .describe(
          `Vertex AI image model. Default: '${getDefaultModel()}'. Prioritize 'gemini-3-pro-image' as the primary high-quality model. Only use 'gemini-3.1-flash-image' if the user explicitly asks for a cheap/budget model, faster speed, or to save quota.`
        ),
      imageSize: z
        .enum(["1K", "2K"])
        .optional()
        .describe("Output image resolution size. Default is '2K'."),
      filenamePrefix: z
        .string()
        .optional()
        .describe("Optional prefix for the saved filename in the sandbox."),
    },
    async (args) => {
      try {
        const workspaceRoot = await getWorkspaceRoot(server);
        const model = args.model || getDefaultModel();
        const aspectRatio = args.aspectRatio || "1:1";

        let promptWithContext = args.prompt;
        if (args.seamless) {
          promptWithContext = `Seamless tileable texture: ${promptWithContext}. Repeating pattern, orthogonal perspective, uniform lighting, no vignette.`;
        }
        if (args.textureType) {
          promptWithContext = `${promptWithContext} (Texture type: ${args.textureType})`;
        }

        const parts: VertexContentPart[] = [{ text: promptWithContext }];
        const vertexRes = await callVertexGenerateImage({
          parts,
          model,
          aspectRatio,
          imageSize: args.imageSize || "2K",
          useGoogleSearchGrounding: false,
        });

        const saved = await saveImageToSandbox(
          workspaceRoot,
          vertexRes.buffer,
          args.filenamePrefix || "texture",
        );

        const dimensions = getPngDimensions(vertexRes.buffer);
        const outputText = formatSuccessResponse(
          "Generated texture successfully.",
          saved.filePath,
          saved.filename,
          vertexRes.mimeType,
          model,
          aspectRatio,
          saved.bytes,
          dimensions,
        );

        return { content: [{ type: "text", text: outputText }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${sanitizeError(err)}` }],
        };
      }
    },
  );
}
