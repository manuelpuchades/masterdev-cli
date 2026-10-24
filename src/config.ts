import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "./paths.ts";

export type AuthMethod = "browser" | "password" | "cookie";

export interface AuthConfig {
  method: AuthMethod;
  browser?: string;
  profile?: string;
  email?: string;
  savedAt: string;
}

export interface Config {
  auth?: AuthConfig;
}

const FILE = join(CONFIG_DIR, "config.json");

export function readConfig(): Config {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as Config;
  } catch {
    return {};
  }
}

export function writeConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(FILE, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}
