# image-generator-mcp-farizi

A high-performance local Model Context Protocol (MCP) server for image generation, texture synthesis, and image editing powered exclusively by **Google Vertex AI** (`gemini-3-pro-image` / `gemini-3.1-flash-image`).

Designed for AI coding agents such as Cline to generate game assets, sprites, concept art, and textures directly into a local `/public/` directory.

---

## Features

- **Google Vertex AI Pro Generation**: Powered by `gemini-3-pro-image` (best quality) with fallback/budget support for `gemini-3.1-flash-image`.
- **Default `/public/` Directory**: Generated assets are saved directly into the MCP project's `/public/<filename>.png` directory.
- **Protected Locations**: Strictly refuses to write into `AppData`, `Local\Programs`, `Microsoft VS Code`, or system folders.
- **Image Editing & Textures**: Supports text-to-image, image editing with text instructions, and specialized game texture generation (including seamless tileable textures).
- **Zero Credential Leakage**: Redacts API keys and tokens from all error messages, logs, and tool responses. Diagnostic logging uses `stderr`, keeping `stdout` pure for MCP JSON-RPC.

---

## Supported Models

| Model                        | Role                  | Description                                                                                    |
| ---------------------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| **`gemini-3-pro-image`**     | **Default / Primary** | Highest fidelity, superior detail, best prompt adherence for game assets and illustrations.    |
| **`gemini-3.1-flash-image`** | **Budget / Fast**     | Use when explicitly requested to prioritize speed, save quota, or generate lightweight drafts. |

---

## MCP Tools

### 1. `generate_image`

Generates a new image or game asset from a text prompt.

- `prompt` (string, required): Detailed description of the image.
- `aspectRatio` (string, optional, dropdown): `"1:1"`, `"16:9"`, `"9:16"`, `"4:3"`, `"3:4"`, `"2:1"`, or `"1:2"`. Default: `"1:1"`.
- `model` (string, optional, dropdown):
  - `"gemini-3-pro-image"` (_Default_ — primary high-quality model)
  - `"gemini-3.1-flash-image"` (faster, cheaper model when requested)
- `imageSize` (string, optional, dropdown): `"1K"` or `"2K"`. Default: `"2K"`.
- `useGoogleSearchGrounding` (boolean, optional): Enable Google Search grounding for real-time visual references. Default: `false`.
- `filenamePrefix` (string, optional): Prefix for the saved filename in the sandbox (e.g., `'hero_knight'`).

### 2. `edit_image`

Edits an existing image file using an instruction prompt.

- `imagePath` (string, required): Absolute or project-relative path to existing source image.
- `prompt` (string, required): Instruction describing modifications or style changes.
- `aspectRatio` (string, optional, dropdown): Target aspect ratio (`"1:1"`, `"16:9"`, etc.).
- `model` (string, optional, dropdown):
  - `"gemini-3-pro-image"` (_Default_ — primary high-quality model)
  - `"gemini-3.1-flash-image"` (budget/fast model)
- `imageSize` (string, optional, dropdown): Resolution (`"1K"` or `"2K"`). Default: `"2K"`.
- `filenamePrefix` (string, optional): Prefix for the saved file.

_Note: The input image is read-only. Output is always written to the `/public/` directory and never overwrites the input image._

### 3. `generate_texture`

Generates game-oriented textures and materials.

- `prompt` (string, required): Description of the texture (e.g. `'cracked stone wall'`, `'cyberpunk metal panel'`).
- `aspectRatio` (string, optional, dropdown): Default: `"1:1"`.
- `seamless` (boolean, optional): If `true`, prompts model to produce a tileable, repeating texture pattern with orthogonal perspective and even lighting.
- `textureType` (string, optional): Material type (e.g. `'diffuse/albedo'`, `'normal map'`, `'roughness'`, `'stylized'`).
- `model` (string, optional, dropdown):
  - `"gemini-3-pro-image"` (_Default_ — primary high-quality model)
  - `"gemini-3.1-flash-image"` (budget/fast model)
- `imageSize` (string, optional, dropdown): Default: `"2K"`.
- `filenamePrefix` (string, optional): Prefix for the saved filename.

---

## Filesystem Sandbox & Security

- **Strict Sandbox Path**: Images are saved by default to the MCP project's `/public/` directory:
  ```text
  <mcp_project_root>/public/<filename>.png
  ```
- **Protected Locations**: AppData, Microsoft VS Code installation directories, system folders, user home root, and Desktop are strictly blocked from being used as target directories.
- **Path Traversal Protection**: Directory traversal (`../`, `..\`), absolute write paths outside the target sandbox, and symlink escapes are strictly blocked.
- **Safe Filenames**: Filenames are sanitized and assigned unique timestamps and random hex suffixes, preventing silent overwrites.

---

## Installation & Build

### Prerequisites

- Node.js >= 18
- pnpm

### Build Steps

```bash
# Install dependencies
pnpm install

# Compile TypeScript to build/index.js
pnpm run build

# Run comprehensive test suite
pnpm test
```

---

## Cline MCP Configuration

Add the following to your Cline MCP settings configuration (`cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "image-generator-mcp-farizi": {
      "command": "node",
      "args": ["<mcp_location>\\build\\index.js"],
      "env": {
        "AI_GATEWAY_API_KEY": "YOUR_VERTEX_API_KEY_HERE"
      }
    }
  }
}
```

If using a custom AI gateway endpoint (e.g., Cloudflare AI Gateway), you can optionally configure:

```json
"env": {
  "AI_GATEWAY_API_KEY": "YOUR_API_KEY_HERE",
  "AI_GATEWAY_BASE_URL": "https://gateway.ai.cloudflare.com/v1/ACCOUNT/GATEWAY/vertex-ai"
}
```

---

## Verification & Testing

The project includes unit, integration, and stdio end-to-end tests:

```bash
pnpm test
```

Tests verify:

1. Dynamic workspace resolution and fail-closed validation.
2. Protection against path traversal and symlink escapes.
3. Proper PNG dimension parsing without native dependencies.
4. Redaction of API credentials from logs and error stacks.
5. Physical file writing inside `.image-generator-mcp-farizi/images/`.
6. MCP protocol handshake, tool registration, and stdio communication.
