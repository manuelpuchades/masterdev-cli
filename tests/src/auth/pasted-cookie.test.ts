import { describe, expect, it } from "vitest";
import { parsePastedCookie } from "../../../src/auth/pasted-cookie.ts";

const VALUE = "d0e7aaaa-bbbb-cccc-dddd-eeeeffff0000";

describe("parsePastedCookie", () => {
  it("accepts the bare value", () => {
    expect(parsePastedCookie(`  ${VALUE}\n`)).toBe(VALUE);
  });

  it("accepts a Cookie header or name=value pairs", () => {
    expect(parsePastedCookie(`Cookie: _ga=GA1.1; fem_auth_mod=${VALUE}; _fbp=fb.1`)).toBe(VALUE);
    expect(parsePastedCookie(`fem_auth_mod=${VALUE}`)).toBe(VALUE);
  });

  it("accepts a Netscape cookies.txt", () => {
    const txt = `# Netscape HTTP Cookie File\n.master.dev\tTRUE\t/\tTRUE\t1893456000\tfem_auth_mod\t${VALUE}\n`;
    expect(parsePastedCookie(txt)).toBe(VALUE);
  });

  it("accepts a Cookie-Editor JSON export", () => {
    const json = JSON.stringify([{ name: "_ga", value: "x", domain: ".master.dev" }, { name: "fem_auth_mod", value: VALUE, domain: ".master.dev" }]);
    expect(parsePastedCookie(json)).toBe(VALUE);
  });

  it("rejects input without the cookie", () => {
    expect(() => parsePastedCookie("_ga=GA1.1; other=1")).toThrow(/No fem_auth_mod/);
  });
});
