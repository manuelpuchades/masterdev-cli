import { clearUserCache } from "../cache.ts";
import { readConfig, writeConfig, type AuthConfig } from "../config.ts";
import { deleteSecret, getSecret, setSecret } from "../secrets.ts";
import { importFromBrowser } from "./browser-import.ts";
import { passwordLogin } from "./password-login.ts";

export type CookieSource = "env" | "keychain";

export interface StoredCookie {
  cookie: string;
  source: CookieSource;
}

export function storedCookie(): StoredCookie | null {
  const fromEnv = process.env.MASTERDEV_COOKIE?.trim();
  if (fromEnv) return { cookie: fromEnv, source: "env" };
  const fromKeychain = getSecret("cookie");
  return fromKeychain ? { cookie: fromKeychain, source: "keychain" } : null;
}

export function saveLogin(cookie: string, auth: Omit<AuthConfig, "savedAt">, password?: string): void {
  setSecret("cookie", cookie);
  if (password) setSecret("password", password);
  else deleteSecret("password");
  const config = readConfig();
  config.auth = { ...auth, savedAt: new Date().toISOString() };
  writeConfig(config);
}

export function forgetLogin(): void {
  deleteSecret("cookie");
  deleteSecret("password");
  const config = readConfig();
  delete config.auth;
  writeConfig(config);
  clearUserCache();
}

/**
 * A new session from the same Login method, without asking anything (ADR 0006).
 * Returns null when the method can't renew (Pasted cookie, MASTERDEV_COOKIE) or renewal fails.
 */
export async function renewCookie(): Promise<string | null> {
  if (process.env.MASTERDEV_COOKIE) return null;
  const auth = readConfig().auth;
  if (!auth) return null;
  try {
    let cookie: string | null = null;
    if (auth.method === "browser") {
      cookie = (await importFromBrowser({ browser: auth.browser, profile: auth.profile })).cookie;
    } else if (auth.method === "password") {
      const password = getSecret("password");
      if (auth.email && password) cookie = await passwordLogin(auth.email, password);
    }
    if (!cookie) return null;
    setSecret("cookie", cookie);
    clearUserCache();
    return cookie;
  } catch {
    return null;
  }
}
