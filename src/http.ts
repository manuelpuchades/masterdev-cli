import { CliError, LOGIN_HINT } from "./errors.ts";
import { USER_AGENT } from "./paths.ts";

// Requests to master.dev are sequential and spaced out: this is a personal tool, not a crawler.
const MIN_GAP_MS = 300;
const TIMEOUT_MS = 20_000;
let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

export async function getJson<T>(url: string, cookie?: string | null): Promise<T> {
  await throttle();
  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": USER_AGENT };
  if (cookie) headers.Cookie = `fem_auth_mod=${cookie}`;
  let res: Response;
  try {
    res = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new CliError("upstream", `Request to ${new URL(url).host} failed: ${(err as Error).message}`);
  }
  if (res.status === 401 || res.status === 403 || (res.status >= 300 && res.status < 400)) {
    throw new CliError("auth_required", "Not signed in to Master.dev, or the session expired.", LOGIN_HINT);
  }
  if (res.status === 404) throw new CliError("not_found", `Not found: ${new URL(url).pathname}`);
  if (!res.ok) throw new CliError("upstream", `Master.dev answered ${res.status} for ${new URL(url).pathname}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new CliError("upstream", `Master.dev returned a non-JSON response for ${new URL(url).pathname}`);
  }
}
