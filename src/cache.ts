import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR } from "./paths.ts";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

// Keys starting with "user-" hold account data and are wiped on logout.
export interface CacheOptions {
  fresh?: boolean;
}

function fileFor(key: string): string {
  return join(CACHE_DIR, key.replace(/[^a-zA-Z0-9._-]/g, "_") + ".json");
}

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, opts: CacheOptions = {}): Promise<T> {
  const file = fileFor(key);
  if (!opts.fresh) {
    try {
      const entry = JSON.parse(readFileSync(file, "utf8")) as { savedAt: number; value: T };
      if (Date.now() - entry.savedAt < ttlMs) return entry.value;
    } catch {
      // missing or corrupt entry: reload
    }
  }
  const value = await load();
  try {
    mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(file, JSON.stringify({ savedAt: Date.now(), value }), { mode: 0o600 });
  } catch {
    // caching is best-effort
  }
  return value;
}

export function clearUserCache(): void {
  try {
    for (const name of readdirSync(CACHE_DIR)) {
      if (name.startsWith("user-")) rmSync(join(CACHE_DIR, name), { force: true });
    }
  } catch {
    // no cache dir yet
  }
}
