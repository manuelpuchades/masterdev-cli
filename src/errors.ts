export type ErrorCode = "internal" | "usage" | "auth_required" | "not_found" | "upstream" | "unsupported";

export const EXIT_CODES: Record<ErrorCode, number> = {
  internal: 1,
  usage: 2,
  auth_required: 3,
  not_found: 4,
  upstream: 5,
  unsupported: 6,
};

export class CliError extends Error {
  readonly code: ErrorCode;
  readonly hint: string | undefined;

  constructor(code: ErrorCode, message: string, hint?: string) {
    super(message);
    this.code = code;
    this.hint = hint;
  }
}

export const LOGIN_HINT = "Run `masterdev auth login`.";
