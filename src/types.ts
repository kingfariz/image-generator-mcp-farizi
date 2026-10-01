import type { SupportedModel } from "./config.js";

export type AspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "2:1"
  | "1:2";

export type ImageSize = "1K" | "2K";

export interface GenerateImageArgs {
  prompt: string;
  aspectRatio?: AspectRatio;
  model?: SupportedModel;
  imageSize?: ImageSize;
  useGoogleSearchGrounding?: boolean;
  filenamePrefix?: string;
}

export interface EditImageArgs {
  imagePath: string;
  prompt: string;
  aspectRatio?: AspectRatio;
  model?: SupportedModel;
  imageSize?: ImageSize;
  useGoogleSearchGrounding?: boolean;
  filenamePrefix?: string;
}

export interface GenerateTextureArgs {
  prompt: string;
  aspectRatio?: AspectRatio;
  seamless?: boolean;
  textureType?: string;
  model?: SupportedModel;
  imageSize?: ImageSize;
  filenamePrefix?: string;
}

export interface GeneratedImageMetadata {
  filePath: string;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
  aspectRatio: string;
  model: string;
  bytes: number;
}

