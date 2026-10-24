import { Entry } from "@napi-rs/keyring";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "./paths.ts";

// Secrets live in the OS keychain (macOS Keychain, libsecret, Windows Credential Manager).
// When no keychain is reachable (headless Linux, CI) they fall back to a 0600 file.
const SERVICE = "masterdev-cli";
const FALLBACK_FILE = join(CONFIG_DIR, "secrets.json");

export type SecretName = "cookie" | "password";

function readFallback(): Partial<Record<SecretName, string>> {
  try {
    return JSON.parse(readFileSync(FALLBACK_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeFallback(data: Partial<Record<SecretName, string>>): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(FALLBACK_FILE, JSON.stringify(data) + "\n", { mode: 0o600 });
}

export function getSecret(name: SecretName): string | null {
  try {
    const value = new Entry(SERVICE, name).getPassword();
    if (value) return value;
  } catch {
    // keychain unavailable; try the fallback file
  }
  return readFallback()[name] ?? null;
}

export function setSecret(name: SecretName, value: string): void {
  try {
    new Entry(SERVICE, name).setPassword(value);
    return;
  } catch {
    const data = readFallback();
    data[name] = value;
    writeFallback(data);
  }
}

export function deleteSecret(name: SecretName): void {
  try {
    new Entry(SERVICE, name).deletePassword();
  } catch {
    // nothing stored in the keychain
  }
  const data = readFallback();
  if (name in data) {
    delete data[name];
    writeFallback(data);
  }
}
