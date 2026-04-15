import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function loadLocalEnv() {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(serverDir, "..");
  const envPath = path.join(projectRoot, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
