import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const MCP_PROJECT_DIR = path.resolve(__dirname, "..");
export const DEFAULT_PUBLIC_DIR = path.resolve(MCP_PROJECT_DIR, "public");
export const PUBLIC_DIR_NAME = "public";

export const AVAILABLE_MODELS = [
  "gemini-3-pro-image",
  "gemini-3.1-flash-image",
] as const;

export type SupportedModel = (typeof AVAILABLE_MODELS)[number];

export const FALLBACK_DEFAULT_MODEL: SupportedModel = "gemini-3-pro-image";

export function getDefaultModel(): SupportedModel {
  const envModel =
    process.env.VERTEX_MODEL?.trim() || process.env.NANO_BANANA_MODEL?.trim();
  if (envModel && (AVAILABLE_MODELS as readonly string[]).includes(envModel)) {
    return envModel as SupportedModel;
  }
  return FALLBACK_DEFAULT_MODEL;
}

export const DEFAULT_MODEL = FALLBACK_DEFAULT_MODEL;

export const DEFAULT_TIMEOUT_SECONDS = 120;

export function getTimeoutMs(): number {
  const envTimeout = process.env.VERTEX_TIMEOUT_SECONDS?.trim();
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed * 1000;
    }
  }
  return DEFAULT_TIMEOUT_SECONDS * 1000;
}

export const SYSTEM_INSTRUCTION_TEXT =
  "You are an expert game artist and visual creator specializing in high-fidelity 2D/3D game assets, textures, concept art, and illustrations. Adhere strictly to the requested aspect ratios, stylistic nuances, and compositions.";

export const DEFAULT_VERTEX_BASE_URL = "https://aiplatform.googleapis.com";

export function getApiKey(): string | undefined {
  return process.env.AI_GATEWAY_API_KEY?.trim();
}

export function getVertexBaseUrl(): string {
  const custom = process.env.AI_GATEWAY_BASE_URL?.trim();
  if (custom && custom.length > 0) {
    return custom.replace(/\/+$/, "");
  }
  return DEFAULT_VERTEX_BASE_URL;
}
