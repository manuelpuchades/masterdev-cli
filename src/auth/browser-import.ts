import { execFile } from "node:child_process";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { CliError } from "../errors.ts";

// Browser import (ADR 0006): find the learner's Master.dev session cookie in a browser
// where they are already signed in, whatever they signed in with.

const COOKIE_NAME = "fem_auth_mod";
const HOST_FILTER = "(host_key = 'master.dev' OR host_key LIKE '%.master.dev')";
const FIREFOX_HOST_FILTER = "(host = 'master.dev' OR host LIKE '%.master.dev')";
// Chromium stores times as microseconds since 1601-01-01; the SQL divides them by 1000.
const CHROMIUM_EPOCH_OFFSET_MS = 11_644_473_600_000;

const run = promisify(execFile);

interface ChromiumBrowser {
  id: string;
  name: string;
  macDir: string;
  linuxDir: string | null;
  macKeychainService: string;
  linuxSecretApp: string;
}

const CHROMIUM_BROWSERS: ChromiumBrowser[] = [
  { id: "chrome", name: "Google Chrome", macDir: "Google/Chrome", linuxDir: "google-chrome", macKeychainService: "Chrome Safe Storage", linuxSecretApp: "chrome" },
  { id: "arc", name: "Arc", macDir: "Arc/User Data", linuxDir: null, macKeychainService: "Arc Safe Storage", linuxSecretApp: "arc" },
  { id: "brave", name: "Brave", macDir: "BraveSoftware/Brave-Browser", linuxDir: "BraveSoftware/Brave-Browser", macKeychainService: "Brave Safe Storage", linuxSecretApp: "brave" },
  { id: "edge", name: "Microsoft Edge", macDir: "Microsoft Edge", linuxDir: "microsoft-edge", macKeychainService: "Microsoft Edge Safe Storage", linuxSecretApp: "chromium" },
  { id: "chromium", name: "Chromium", macDir: "Chromium", linuxDir: "chromium", macKeychainService: "Chromium Safe Storage", linuxSecretApp: "chromium" },
  { id: "vivaldi", name: "Vivaldi", macDir: "Vivaldi", linuxDir: "vivaldi", macKeychainService: "Vivaldi Safe Storage", linuxSecretApp: "vivaldi" },
];

export const SUPPORTED_BROWSERS = [...CHROMIUM_BROWSERS.map((b) => b.id), "firefox"];

export interface ImportedCookie {
  cookie: string;
  browser: string;
  profile: string;
}

interface Candidate {
  browser: string;
  profile: string;
  lastAccessMs: number;
  /** Plain value (Firefox, or old unencrypted Chromium rows). */
  value: string;
  /** Chromium only. */
  encrypted: Buffer | null;
  chromium: ChromiumBrowser | null;
  dbVersion: number;
}

interface ChromiumRow {
  value: string;
  encrypted_value: Uint8Array;
  expires: number;
  last_access: number;
}

interface FirefoxRow {
  value: string;
  expiry: number;
  lastAccessed: number;
}

const isMac = process.platform === "darwin";
const isLinux = process.platform === "linux";

function appSupport(): string {
  return join(homedir(), "Library", "Application Support");
}

function chromiumRoot(b: ChromiumBrowser): string | null {
  if (isMac) return join(appSupport(), b.macDir);
  if (isLinux && b.linuxDir) return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), b.linuxDir);
  return null;
}

function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Opens a copy of an SQLite file: browsers keep their cookie databases locked while running. */
async function readCopy<Row>(file: string, query: (db: import("node:sqlite").DatabaseSync) => Row[]): Promise<Row[]> {
  const dir = mkdtempSync(join(tmpdir(), "masterdev-"));
  try {
    const copy = join(dir, "cookies.sqlite");
    copyFileSync(file, copy);
    for (const suffix of ["-wal", "-shm", "-journal"]) {
      if (existsSync(file + suffix)) copyFileSync(file + suffix, copy + suffix);
    }
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(copy);
    try {
      return query(db);
    } finally {
      db.close();
    }
  } catch {
    return [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function chromiumCandidates(b: ChromiumBrowser): Promise<Candidate[]> {
  const root = chromiumRoot(b);
  if (!root || !existsSync(root)) return [];
  const profiles = listDirs(root).filter((name) => name === "Default" || name.startsWith("Profile "));
  const candidates: Candidate[] = [];
  for (const profile of profiles) {
    const file = [join(root, profile, "Network", "Cookies"), join(root, profile, "Cookies")].find((f) => existsSync(f));
    if (!file) continue;
    let dbVersion = 0;
    const rows = await readCopy<ChromiumRow>(file, (db) => {
      const meta = db.prepare("SELECT value FROM meta WHERE key = 'version'").get() as { value: string } | undefined;
      dbVersion = Number(meta?.value ?? 0);
      const sql = `SELECT value, encrypted_value, expires_utc / 1000 AS expires, last_access_utc / 1000 AS last_access
                   FROM cookies WHERE name = ? AND ${HOST_FILTER}`;
      return db.prepare(sql).all(COOKIE_NAME) as unknown as ChromiumRow[];
    });
    for (const row of rows) {
      const expiresMs = row.expires ? row.expires - CHROMIUM_EPOCH_OFFSET_MS : 0;
      if (expiresMs && expiresMs < Date.now()) continue;
      candidates.push({
        browser: b.id,
        profile,
        lastAccessMs: row.last_access - CHROMIUM_EPOCH_OFFSET_MS,
        value: row.value,
        encrypted: row.encrypted_value?.length ? Buffer.from(row.encrypted_value) : null,
        chromium: b,
        dbVersion,
      });
    }
  }
  return candidates;
}

function firefoxProfileDirs(): string[] {
  const roots = isMac
    ? [join(appSupport(), "Firefox", "Profiles")]
    : [join(homedir(), ".mozilla", "firefox"), join(homedir(), "snap", "firefox", "common", ".mozilla", "firefox")];
  return roots.flatMap((root) => listDirs(root).map((name) => join(root, name)));
}

async function firefoxCandidates(): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const dir of firefoxProfileDirs()) {
    const file = join(dir, "cookies.sqlite");
    if (!existsSync(file)) continue;
    const rows = await readCopy<FirefoxRow>(file, (db) => {
      const sql = `SELECT value, expiry, lastAccessed FROM moz_cookies WHERE name = ? AND ${FIREFOX_HOST_FILTER}`;
      return db.prepare(sql).all(COOKIE_NAME) as unknown as FirefoxRow[];
    });
    for (const row of rows) {
      // Older Firefox stores expiry in seconds, newer in milliseconds.
      const expiresMs = row.expiry > 1e11 ? row.expiry : row.expiry * 1000;
      if (expiresMs && expiresMs < Date.now()) continue;
      candidates.push({
        browser: "firefox",
        profile: dir.split(/[\\/]/).pop() ?? dir,
        lastAccessMs: Math.floor(row.lastAccessed / 1000),
        value: row.value,
        encrypted: null,
        chromium: null,
        dbVersion: 0,
      });
    }
  }
  return candidates;
}

export function deriveChromiumKey(password: string, iterations: number): Buffer {
  return pbkdf2Sync(password, "saltysalt", iterations, 16, "sha1");
}

/** Decrypts a `v10`/`v11` Chromium cookie value (macOS and Linux scheme). */
export function decryptChromiumValue(encrypted: Buffer, key: Buffer, dbVersion: number): string {
  const prefix = encrypted.subarray(0, 3).toString("latin1");
  if (prefix !== "v10" && prefix !== "v11") {
    throw new CliError("unsupported", `Unknown cookie encryption "${prefix}".`);
  }
  const decipher = createDecipheriv("aes-128-cbc", key, Buffer.alloc(16, " "));
  let plain = Buffer.concat([decipher.update(encrypted.subarray(3)), decipher.final()]);
  // Since cookie database version 24, the value is prefixed with SHA-256(host_key).
  if (dbVersion >= 24) plain = plain.subarray(32);
  return plain.toString("utf8");
}

async function chromiumPassword(b: ChromiumBrowser, version: string): Promise<{ password: string; iterations: number }> {
  if (isMac) {
    try {
      const { stdout } = await run("security", ["find-generic-password", "-w", "-s", b.macKeychainService]);
      return { password: stdout.trim(), iterations: 1003 };
    } catch {
      throw new CliError(
        "auth_required",
        `Could not read "${b.macKeychainService}" from the macOS Keychain (access denied or not found).`,
        "Allow access when macOS asks, or use `masterdev auth login --password` or `--cookie`.",
      );
    }
  }
  if (version === "v10") return { password: "peanuts", iterations: 1 };
  try {
    const { stdout } = await run("secret-tool", ["lookup", "application", b.linuxSecretApp]);
    return { password: stdout.trim(), iterations: 1 };
  } catch {
    throw new CliError("unsupported", `Could not read ${b.name}'s key from the Secret Service (is \`secret-tool\` installed?).`);
  }
}

const looksLikeCookie = (value: string) => /^[\x21-\x7e]+$/.test(value);

async function reveal(c: Candidate): Promise<string> {
  if (!c.encrypted || !c.chromium) return c.value;
  const version = c.encrypted.subarray(0, 3).toString("latin1");
  const { password, iterations } = await chromiumPassword(c.chromium, version);
  let value: string;
  try {
    value = decryptChromiumValue(c.encrypted, deriveChromiumKey(password, iterations), c.dbVersion);
  } catch (err) {
    if (err instanceof CliError) throw err;
    value = "";
  }
  if (!looksLikeCookie(value)) {
    throw new CliError("upstream", `Could not decrypt the Master.dev cookie from ${c.chromium.name}.`, "Use `masterdev auth login --cookie` instead.");
  }
  return value;
}

export interface BrowserImportOptions {
  /** A browser id from SUPPORTED_BROWSERS, or undefined/"auto" for all of them. */
  browser?: string;
  profile?: string;
}

/** The freshest Master.dev session found in the chosen browser(s). Only that one is decrypted. */
export async function importFromBrowser(opts: BrowserImportOptions = {}): Promise<ImportedCookie> {
  if (!isMac && !isLinux) {
    throw new CliError("unsupported", "Browser import works on macOS and Linux only.", "Use `masterdev auth login --cookie` or `--password`.");
  }
  const wanted = !opts.browser || opts.browser === "auto" ? SUPPORTED_BROWSERS : [opts.browser];
  const unknown = wanted.filter((id) => !SUPPORTED_BROWSERS.includes(id));
  if (unknown.length) {
    throw new CliError("usage", `Unknown browser "${unknown.join(", ")}". Supported: ${SUPPORTED_BROWSERS.join(", ")}, auto.`);
  }

  const candidates: Candidate[] = [];
  for (const b of CHROMIUM_BROWSERS.filter((b) => wanted.includes(b.id))) candidates.push(...(await chromiumCandidates(b)));
  if (wanted.includes("firefox")) candidates.push(...(await firefoxCandidates()));

  const matching = opts.profile ? candidates.filter((c) => c.profile === opts.profile) : candidates;
  const freshest = matching.sort((a, b) => b.lastAccessMs - a.lastAccessMs)[0];
  if (!freshest) {
    throw new CliError(
      "auth_required",
      `No Master.dev session found in ${wanted.length === 1 ? wanted[0] : "any supported browser"}${opts.profile ? ` (profile "${opts.profile}")` : ""}.`,
      "Sign in at https://master.dev in your browser first, or use `masterdev auth login --password` or `--cookie`.",
    );
  }
  return { cookie: await reveal(freshest), browser: freshest.browser, profile: freshest.profile };
}
