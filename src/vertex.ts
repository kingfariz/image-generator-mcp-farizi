import {
  DEFAULT_MODEL,
  DEFAULT_VERTEX_BASE_URL,
  getApiKey,
  getDefaultModel,
  getTimeoutMs,
  getVertexBaseUrl,
  SYSTEM_INSTRUCTION_TEXT,
} from "./config.js";
import { sanitizeText } from "./utils/security.js";

export interface VertexImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export interface VertexTextPart {
  text: string;
}

export type VertexContentPart = VertexImagePart | VertexTextPart;

export interface BuildRequestBodyOptions {
  parts: VertexContentPart[];
  useGoogleSearchGrounding?: boolean;
  model: string;
  aspectRatio?: string;
  imageSize?: string;
  timeoutMs?: number;
}

export function buildExperimentalRequestBody(
  parts: VertexContentPart[],
  useGoogleSearchGrounding = false,
  model: string = DEFAULT_MODEL,
  aspectRatio = "1:1",
  imageSize = "2K"
) {
  const requestBody: any = {
    contents: [{ role: "user", parts }],
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION_TEXT }],
    },
    ...(useGoogleSearchGrounding
      ? {
          tools: [{ googleSearch: {} }],
          toolConfig: { retrievalConfig: { languageCode: "en_US" } },
        }
      : {}),
    generationConfig: {
      temperature: 1,
      maxOutputTokens: 32768,
      topP: 0.95,
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio || "1:1",
        imageSize: imageSize || "2K",
        imageOutputOptions: {
          mimeType: "image/png",
        },
        personGeneration: "ALLOW_ALL",
      },
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
    ],
  };

  if (!useGoogleSearchGrounding || model === "gemini-3-pro-image") {
    delete requestBody.tools;
    delete requestBody.toolConfig;
  }

  return requestBody;
}

export interface GenerateImageResult {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Invokes Google Vertex AI Nano Banana to generate or edit an image.
 */
export async function callVertexGenerateImage(
  options: BuildRequestBodyOptions
): Promise<GenerateImageResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "AI_GATEWAY_API_KEY environment variable is not set. Please configure AI_GATEWAY_API_KEY in your MCP server configuration."
    );
  }

  const model = options.model || getDefaultModel();
  const baseUrl = getVertexBaseUrl();

  const modelPath = model.startsWith("publishers/")
    ? model
    : `publishers/google/models/${model}`;

  const requestUrl = new URL(
    `${baseUrl}/v1/${modelPath}:generateContent`
  );
  requestUrl.searchParams.set("key", apiKey);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };

  // If using a custom AI gateway, add Authorization header for compatibility
  if (baseUrl !== DEFAULT_VERTEX_BASE_URL) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const requestBody = buildExperimentalRequestBody(
    options.parts,
    options.useGoogleSearchGrounding ?? false,
    model,
    options.aspectRatio || "1:1",
    options.imageSize || "2K"
  );

  const timeoutMs = options.timeoutMs ?? getTimeoutMs();
  let response: Response;
  try {
    response = await fetch(requestUrl.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (networkErr) {
    const cleanErr = sanitizeText(
      networkErr instanceof Error ? networkErr.message : String(networkErr),
      apiKey
    );
    throw new Error(`Failed to connect to Vertex AI: ${cleanErr}`);
  }

  if (!response.ok) {
    let errorDetails = "";
    try {
      const errJson = (await response.json()) as any;
      errorDetails =
        errJson?.error?.message ||
        errJson?.message ||
        JSON.stringify(errJson);
    } catch {
      errorDetails = await response.text();
    }
    const cleanDetails = sanitizeText(errorDetails, apiKey);
    throw new Error(
      `Vertex AI API error (${response.status} ${response.statusText}): ${cleanDetails}`
    );
  }

  const data = (await response.json()) as any;
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const imagePart = parts.find(
    (p: any) => p.inlineData?.data || p.inline_data?.data
  );

  if (!imagePart) {
    const textPart = parts.find((p: any) => p.text);
    const finishReason = candidate?.finishReason || "UNKNOWN";
    const textMsg = textPart?.text ? ` Model response: "${textPart.text}"` : "";
    throw new Error(
      `Vertex AI did not return image data. Finish reason: ${finishReason}.${textMsg}`
    );
  }

  const rawBase64 =
    imagePart.inlineData?.data || imagePart.inline_data?.data;
  const mimeType =
    imagePart.inlineData?.mimeType ||
    imagePart.inline_data?.mime_type ||
    "image/png";

  const buffer = Buffer.from(rawBase64, "base64");
  return { buffer, mimeType };
}
