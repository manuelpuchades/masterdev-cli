import { createCipheriv, createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptChromiumValue, deriveChromiumKey } from "../../../src/auth/browser-import.ts";

function encrypt(plain: Buffer, key: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-cbc", key, Buffer.alloc(16, " "));
  return Buffer.concat([Buffer.from("v10"), cipher.update(plain), cipher.final()]);
}

describe("decryptChromiumValue", () => {
  const key = deriveChromiumKey("not-a-real-keychain-password", 1003);
  const value = "00000000-1111-2222-3333-444444444444";

  it("decrypts a v10 value from an older cookie database", () => {
    expect(decryptChromiumValue(encrypt(Buffer.from(value), key), key, 23)).toBe(value);
  });

  it("drops the host hash that version 24 databases prepend", () => {
    const hostHash = createHash("sha256").update(".master.dev").digest();
    expect(decryptChromiumValue(encrypt(Buffer.concat([hostHash, Buffer.from(value)]), key), key, 24)).toBe(value);
  });

  it("refuses an unknown encryption scheme", () => {
    expect(() => decryptChromiumValue(Buffer.from("v20xxxxxxxxxxxxxxxx"), key, 24)).toThrow(/Unknown cookie encryption/);
  });
});
