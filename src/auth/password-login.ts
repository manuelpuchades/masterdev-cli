import { CliError } from "../errors.ts";
import { SITE, USER_AGENT } from "../paths.ts";

// Password login (ADR 0006): post the site's own sign-in form, as a browser would.

const LOGIN_URL = `${SITE}/login/`;
const COOKIE_NAME = "fem_auth_mod";

type Jar = Map<string, string>;

function absorbCookies(jar: Jar, res: Response): void {
  for (const header of res.headers.getSetCookie()) {
    const pair = header.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

const cookieHeader = (jar: Jar) => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

function hiddenField(html: string, name: string): string {
  return html.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`))?.[1] ?? "";
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new CliError("upstream", `Could not reach master.dev: ${(err as Error).message}`);
  }
}

export async function passwordLogin(email: string, password: string): Promise<string> {
  const jar: Jar = new Map();
  const page = await send(LOGIN_URL, { headers: { "User-Agent": USER_AGENT } });
  absorbCookies(jar, page);
  const html = await page.text();

  const form = new URLSearchParams({
    username: email,
    password,
    remember: "on",
    nonce: hiddenField(html, "nonce"),
    redirect: hiddenField(html, "redirect"),
  });
  const res = await send(LOGIN_URL, {
    method: "POST",
    body: form,
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: SITE,
      Referer: LOGIN_URL,
      Cookie: cookieHeader(jar),
    },
  });
  absorbCookies(jar, res);

  const cookie = jar.get(COOKIE_NAME);
  if (cookie && cookie !== "deleted") return cookie;

  const body = res.status === 200 ? await res.text() : "";
  const captcha = /recaptcha|g-recaptcha|turnstile/i.test(body);
  throw new CliError(
    "auth_required",
    captcha
      ? "Master.dev asked for a captcha, which the CLI can't solve."
      : `Master.dev did not accept the email and password (HTTP ${res.status}).`,
    "Check them, or sign in in your browser and use `masterdev auth login --from <browser>`.",
  );
}
