import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const MCP_INSTALL_DIR = path.resolve(__dirname, "..");

const PROJECT_MARKERS = [
  ".git",
  ".vscode",
  "project.godot",
  "package.json",
  "tsconfig.json",
  "Cargo.toml",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "CMakeLists.txt",
  "Makefile",
  ".editorconfig",
  ".image-generator-mcp-farizi",
  "Assets",
  "scenes",
];

export interface WorkspaceValidationResult {
  valid: boolean;
  reason?: string;
  resolvedPath?: string;
}

export async function validateWorkspacePath(
  candidatePath: string,
  isClientRoot = false
): Promise<WorkspaceValidationResult> {
  if (!candidatePath || typeof candidatePath !== "string") {
    return { valid: false, reason: "Candidate path is empty or invalid." };
  }

  const resolved = path.resolve(candidatePath);

  // 1. Verify path exists and is a directory
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      return {
        valid: false,
        reason: `Workspace path is not a directory: ${resolved}`,
      };
    }
  } catch {
    return {
      valid: false,
      reason: `Workspace directory does not exist: ${resolved}`,
    };
  }

  // 2. Reject drive roots or filesystem roots
  const root = path.parse(resolved).root;
  if (resolved === root || resolved === path.resolve("/")) {
    return {
      valid: false,
      reason: `Drive root or filesystem root cannot be used as project workspace: ${resolved}`,
    };
  }

  // 3. Reject system directories
  const systemDirs: string[] = [];
  if (process.platform === "win32") {
    if (process.env.WINDIR) systemDirs.push(process.env.WINDIR);
    if (process.env.SystemRoot) systemDirs.push(process.env.SystemRoot);
    if (process.env.ProgramFiles) systemDirs.push(process.env.ProgramFiles);
    if (process.env["ProgramFiles(x86)"])
      systemDirs.push(process.env["ProgramFiles(x86)"]);
  } else {
    systemDirs.push("/bin", "/sbin", "/usr", "/etc", "/var", "/tmp", "/dev");
  }

  for (const sysDir of systemDirs) {
    const resSys = path.resolve(sysDir);
    if (
      resolved.toLowerCase() === resSys.toLowerCase() ||
      resolved.toLowerCase().startsWith(resSys.toLowerCase() + path.sep)
    ) {
      return {
        valid: false,
        reason: `System directory cannot be used as project workspace: ${resolved}`,
      };
    }
  }

  // 4. Reject user home directory and common subfolders (Desktop, Documents, etc.)
  const homedir = path.resolve(os.homedir());
  if (resolved.toLowerCase() === homedir.toLowerCase()) {
    return {
      valid: false,
      reason: `User home directory cannot be used as project workspace: ${resolved}`,
    };
  }

  // Reject AppData and its subdirectories (including VS Code install directory)
  const appData = path.resolve(homedir, "AppData");
  if (
    resolved.toLowerCase() === appData.toLowerCase() ||
    resolved.toLowerCase().startsWith(appData.toLowerCase() + path.sep)
  ) {
    return {
      valid: false,
      reason: `AppData directory cannot be used as project workspace: ${resolved}`,
    };
  }

  const prohibitedHomeFolders = [
    "Desktop",
    "Documents",
    "Downloads",
    "Pictures",
    "Music",
    "Videos",
  ];

  for (const sub of prohibitedHomeFolders) {
    const prohibitedPath = path.resolve(homedir, sub);
    if (resolved.toLowerCase() === prohibitedPath.toLowerCase()) {
      return {
        valid: false,
        reason: `User's ${sub} directory cannot be directly used as a project workspace: ${resolved}`,
      };
    }
  }

  // 5. If candidate is MCP install directory, it is valid as the default location
  const normalizedMcp = path.resolve(MCP_INSTALL_DIR).toLowerCase();
  const normalizedResolved = resolved.toLowerCase();
  if (normalizedResolved === normalizedMcp) {
    return { valid: true, resolvedPath: resolved };
  }

  // 6. Project marker validation
  if (isClientRoot) {
    return { valid: true, resolvedPath: resolved };
  }

  for (const marker of PROJECT_MARKERS) {
    try {
      await fs.access(path.join(resolved, marker));
      return { valid: true, resolvedPath: resolved };
    } catch {
      // not found, check next
    }
  }

  try {
    const entries = await fs.readdir(resolved);
    if (entries.length > 0) {
      return { valid: true, resolvedPath: resolved };
    }
  } catch {
    // Ignore
  }

  return {
    valid: false,
    reason: `Directory "${resolved}" lacks project markers.`,
  };
}

export async function resolveActiveWorkspace(
  clientRoots?: Array<{ uri: string; name?: string }>
): Promise<string> {
  if (clientRoots && clientRoots.length > 0) {
    for (const root of clientRoots) {
      try {
        const candidatePath = root.uri.startsWith("file://")
          ? fileURLToPath(root.uri)
          : root.uri;

        const check = await validateWorkspacePath(candidatePath, true);
        if (check.valid && check.resolvedPath) {
          return check.resolvedPath;
        }
      } catch {
        // Continue
      }
    }
  }

  const cwd = process.cwd();
  const cwdCheck = await validateWorkspacePath(cwd, false);
  if (cwdCheck.valid && cwdCheck.resolvedPath) {
    return cwdCheck.resolvedPath;
  }

  // Default to the MCP project directory itself
  return MCP_INSTALL_DIR;
}
