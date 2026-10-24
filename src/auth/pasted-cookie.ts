import { CliError } from "../errors.ts";

const COOKIE_NAME = "fem_auth_mod";

function fromJson(text: string): string | null {
  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : Array.isArray(data?.cookies) ? data.cookies : [];
    const hit = list.find((c: { name?: string }) => c?.name === COOKIE_NAME);
    return typeof hit?.value === "string" ? hit.value : null;
  } catch {
    return null;
  }
}

function fromNetscape(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const fields = line.split("\t");
    if (fields.length >= 7 && fields[5] === COOKIE_NAME && fields[0]?.endsWith("master.dev")) return fields[6]!.trim();
  }
  return null;
}

function fromHeader(text: string): string | null {
  const header = text.replace(/^cookie:\s*/i, "");
  for (const part of header.split(";")) {
    const [name, ...rest] = part.split("=");
    if (name?.trim() === COOKIE_NAME) return rest.join("=").trim();
  }
  return null;
}

/**
 * The session cookie from whatever the learner pasted: the bare value, a `Cookie:` header,
 * `name=value; …` pairs, a Netscape cookies.txt, or a Cookie-Editor / DevTools JSON export.
 */
export function parsePastedCookie(input: string): string {
  const text = input.trim();
  const value = fromJson(text) ?? fromNetscape(text) ?? fromHeader(text) ?? (/^[\x21-\x7e]+$/.test(text) && !text.includes("=") ? text : null);
  if (!value) throw new CliError("usage", `No ${COOKIE_NAME} cookie found in the input.`);
  return value;
}
