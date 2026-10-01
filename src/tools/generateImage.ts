import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AVAILABLE_MODELS, getDefaultModel } from "../config.js";
import { saveImageToSandbox } from "../sandbox.js";
import { getPngDimensions } from "../utils/image.js";
import { sanitizeError } from "../utils/security.js";
import {
  callVertexGenerateImage,
  VertexContentPart,
} from "../vertex.js";
import { formatSuccessResponse, getWorkspaceRoot } from "./common.js";

export function registerGenerateImageTool(server: McpServer): void {
  server.tool(
    "generate_image",
    "Generate a new image from a text prompt using Vertex AI Nano Banana. The resulting image is saved directly into the project's sandbox directory.",
    {
      prompt: z.string().describe("Prompt describing the image to generate."),
      aspectRatio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4", "2:1", "1:2"])
        .optional()
        .describe("Aspect ratio of the generated image. Default is '1:1'."),
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
      useGoogleSearchGrounding: z
        .boolean()
        .optional()
        .describe(
          "Whether to enable Google Search grounding for real-time references. Default is false."
        ),
      filenamePrefix: z
        .string()
        .optional()
        .describe(
          "Optional prefix for the saved filename in the sandbox."
        ),
    },
    async (args) => {
      try {
        const workspaceRoot = await getWorkspaceRoot(server);
        const model = args.model || getDefaultModel();
        const aspectRatio = args.aspectRatio || "1:1";

        const parts: VertexContentPart[] = [{ text: args.prompt }];
        const vertexRes = await callVertexGenerateImage({
          parts,
          model,
          aspectRatio,
          imageSize: args.imageSize || "2K",
          useGoogleSearchGrounding: args.useGoogleSearchGrounding,
        });

        const saved = await saveImageToSandbox(
          workspaceRoot,
          vertexRes.buffer,
          args.filenamePrefix || "image"
        );

        const dimensions = getPngDimensions(vertexRes.buffer);
        const outputText = formatSuccessResponse(
          "Generated image successfully.",
          saved.filePath,
          saved.filename,
          vertexRes.mimeType,
          model,
          aspectRatio,
          saved.bytes,
          dimensions
        );

        return { content: [{ type: "text", text: outputText }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${sanitizeError(err)}` }],
        };
      }
    }
  );
}


