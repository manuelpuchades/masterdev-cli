import { input, password as passwordPrompt, select } from "@inquirer/prompts";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { MasterDevApi } from "./api.ts";
import { importFromBrowser, SUPPORTED_BROWSERS } from "./auth/browser-import.ts";
import { forgetLogin, saveLogin, storedCookie } from "./auth/credentials.ts";
import { parsePastedCookie } from "./auth/pasted-cookie.ts";
import { passwordLogin } from "./auth/password-login.ts";
import { clearUserCache } from "./cache.ts";
import { catalogReport, courseReport, nextReport, progressReport } from "./commands.ts";
import { readConfig, type AuthMethod } from "./config.ts";
import { CliError, EXIT_CODES } from "./errors.ts";
import type { LibraryCategory } from "./model.ts";
import { VERSION } from "./paths.ts";
import { renderCatalog, renderCourse, renderNext, renderProgress } from "./render.ts";

interface GlobalOptions {
  pretty?: boolean;
  fresh?: boolean;
}

const CATEGORIES: LibraryCategory[] = ["started", "completed", "bookmarked"];

function print<T>(data: T, opts: GlobalOptions, render?: (data: T) => string): void {
  const text = opts.pretty && render ? render(data) : JSON.stringify(data, null, 2);
  process.stdout.write(text + "\n");
}

function printError(err: CliError, pretty: boolean): void {
  if (pretty) {
    process.stderr.write(`Error: ${err.message}\n${err.hint ? `${err.hint}\n` : ""}`);
  } else {
    const error = { code: err.code, message: err.message, ...(err.hint ? { hint: err.hint } : {}) };
    process.stderr.write(JSON.stringify({ error }) + "\n");
  }
  process.exitCode = EXIT_CODES[err.code];
}

function positiveNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new InvalidArgumentError("must be a positive number");
  return n;
}

// Prompts go to stderr so stdout stays pure JSON, and only when a person is at the terminal.
const canPrompt = () => !!process.stdin.isTTY && !!process.stderr.isTTY;
const promptContext = { output: process.stderr };

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

interface LoginOptions {
  from?: string;
  profile?: string;
  password?: boolean;
  email?: string;
  savePassword: boolean;
  cookie?: string;
  cookieStdin?: boolean;
}

async function chooseMethod(opts: LoginOptions): Promise<AuthMethod> {
  if (opts.password || opts.email) return "password";
  if (opts.cookie || opts.cookieStdin) return "cookie";
  if (opts.from || opts.profile || !canPrompt()) return "browser";
  return select(
    {
      message: "How do you want to sign in?",
      choices: [
        { name: "Import from my browser (Google, GitHub or password accounts)", value: "browser" as const },
        { name: "Email and password", value: "password" as const },
        { name: "Paste a cookie", value: "cookie" as const },
      ],
    },
    promptContext,
  );
}

async function askOrFail(envVar: string, message: string, secret: boolean): Promise<string> {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  if (!canPrompt()) throw new CliError("usage", `${message} is required: set ${envVar} or run in a terminal.`);
  return secret ? passwordPrompt({ message, mask: true }, promptContext) : input({ message }, promptContext);
}

async function authLogin(opts: LoginOptions, global: GlobalOptions): Promise<void> {
  const method = await chooseMethod(opts);
  let cookie: string;
  let browser: string | undefined;
  let profile: string | undefined;
  let email: string | undefined;
  let password: string | undefined;

  if (method === "browser") {
    ({ cookie, browser, profile } = await importFromBrowser({ browser: opts.from, profile: opts.profile }));
  } else if (method === "password") {
    email = opts.email ?? (await askOrFail("MASTERDEV_EMAIL", "Email", false));
    password = await askOrFail("MASTERDEV_PASSWORD", "Password", true);
    cookie = await passwordLogin(email, password);
  } else {
    const pasted = opts.cookie ?? (opts.cookieStdin ? await readStdin() : await askOrFail("MASTERDEV_COOKIE", "Cookie (value, Cookie header or export)", true));
    cookie = parsePastedCookie(pasted);
  }

  let started: number;
  try {
    started = (await new MasterDevApi({ cookie, fresh: true }).library("started")).length;
  } catch (err) {
    if (err instanceof CliError && err.code === "auth_required") {
      throw new CliError("auth_required", "Master.dev did not accept that session (expired or signed out).", "Sign in again at https://master.dev and retry.");
    }
    throw err;
  }

  clearUserCache();
  saveLogin(cookie, { method, browser, profile, email }, method === "password" && opts.savePassword ? password : undefined);
  print({ signedIn: true, method, browser, profile, email, startedCourses: started }, global, (r) => {
    const from = r.browser ? ` from ${r.browser} (${r.profile})` : r.email ? ` as ${r.email}` : "";
    return `Signed in${from}. ${r.startedCourses} started course${r.startedCourses === 1 ? "" : "s"}.`;
  });
}

async function authStatus(check: boolean, global: GlobalOptions): Promise<void> {
  const auth = readConfig().auth;
  const stored = storedCookie();
  let valid: boolean | undefined;
  if (check && stored) {
    try {
      await new MasterDevApi({ fresh: true }).library("started");
      valid = true;
    } catch (err) {
      if (!(err instanceof CliError) || err.code !== "auth_required") throw err;
      valid = false;
    }
  }
  const status = {
    signedIn: !!stored,
    source: stored?.source ?? null,
    method: auth?.method ?? null,
    browser: auth?.browser ?? null,
    profile: auth?.profile ?? null,
    email: auth?.email ?? null,
    savedAt: auth?.savedAt ?? null,
    ...(valid === undefined ? {} : { valid }),
  };
  print(status, global, (s) => {
    if (!s.signedIn) return "Not signed in. Run `masterdev auth login`.";
    const via = s.source === "env" ? "MASTERDEV_COOKIE" : `${s.method}${s.browser ? ` (${s.browser})` : ""}`;
    const validity = s.valid === undefined ? "" : s.valid ? " · session valid" : " · session expired";
    return `Signed in via ${via}${s.savedAt ? ` since ${s.savedAt}` : ""}${validity}`;
  });
}

export async function main(argv: string[]): Promise<void> {
  const program = new Command()
    .name("masterdev")
    .description("Your Master.dev (Frontend Masters) progress, as JSON for agents or --pretty for humans.")
    .version(VERSION)
    .option("--pretty", "human-readable output instead of JSON")
    .option("--fresh", "skip the local cache")
    .exitOverride()
    .configureOutput({ outputError: () => {} });

  const globals = (cmd: Command) => cmd.optsWithGlobals<GlobalOptions>();
  const api = (cmd: Command) => new MasterDevApi({ fresh: globals(cmd).fresh });

  const auth = program.command("auth").description("sign in, check or sign out");
  auth
    .command("login")
    .description("sign in: import from a browser (default), email and password, or a pasted cookie")
    .option("--from <browser>", `browser to import from: ${SUPPORTED_BROWSERS.join(", ")} or auto`)
    .option("--profile <name>", 'browser profile, e.g. "Default" or "Profile 1"')
    .option("--password", "sign in with email and password (MASTERDEV_EMAIL, MASTERDEV_PASSWORD)")
    .option("--email <email>", "email for --password")
    .option("--no-save-password", "don't keep the password to renew the session")
    .option("--cookie <value>", "the fem_auth_mod value, a Cookie header or a cookie export")
    .option("--cookie-stdin", "read the cookie from stdin")
    .action((opts: LoginOptions, cmd: Command) => authLogin(opts, globals(cmd)));
  auth
    .command("status")
    .description("show how you are signed in")
    .option("--check", "verify the session with Master.dev")
    .action((opts: { check?: boolean }, cmd: Command) => authStatus(!!opts.check, globals(cmd)));
  auth
    .command("logout")
    .description("forget the session, the password and cached account data")
    .action((_opts: object, cmd: Command) => {
      forgetLogin();
      print({ signedIn: false }, globals(cmd), () => "Signed out.");
    });

  program
    .command("progress")
    .description("your started, completed and bookmarked courses")
    .option("--category <category>", `only one of: ${CATEGORIES.join(", ")}`)
    .action(async (opts: { category?: string }, cmd: Command) => {
      if (opts.category && !CATEGORIES.includes(opts.category as LibraryCategory)) {
        throw new CliError("usage", `Unknown category "${opts.category}". Use one of: ${CATEGORIES.join(", ")}.`);
      }
      const categories = opts.category ? [opts.category as LibraryCategory] : CATEGORIES;
      print(await progressReport(api(cmd), categories), globals(cmd), renderProgress);
    });

  program
    .command("course")
    .description("a course lesson by lesson, with your progress and the next lesson")
    .argument("<slug>", "course slug, e.g. ai-agents-v2")
    .option("--no-lessons", "only sections and totals")
    .action(async (slug: string, opts: { lessons: boolean }, cmd: Command) => {
      print(await courseReport(api(cmd), slug, opts.lessons), globals(cmd), renderCourse);
    });

  program
    .command("next")
    .description("what to watch now: the next lesson of your latest course, or as many as fit in --minutes")
    .option("--course <slug>", "pick from this course instead of your latest started one")
    .option("--minutes <n>", "time budget: consecutive lessons that fit", positiveNumber)
    .option("--all", "one pick per started course")
    .action(async (opts: { course?: string; minutes?: number; all?: boolean }, cmd: Command) => {
      print(await nextReport(api(cmd), opts), globals(cmd), renderNext);
    });

  program
    .command("catalog")
    .alias("search")
    .description("search every course on Master.dev (newest first), marking the ones you started or completed")
    .argument("[query...]", "words to match in title, slug or summary")
    .option("--limit <n>", "maximum courses to list", positiveNumber, 20)
    .action(async (query: string[], opts: { limit: number }, cmd: Command) => {
      print(await catalogReport(api(cmd), query.join(" "), opts.limit), globals(cmd), renderCatalog);
    });

  const pretty = argv.includes("--pretty");
  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      if (err.exitCode === 0) return;
      printError(new CliError("usage", err.message.replace(/^error: /, ""), "Run `masterdev --help`."), pretty);
    } else if (err instanceof CliError) {
      printError(err, pretty);
    } else if (err instanceof Error && err.name === "ExitPromptError") {
      printError(new CliError("usage", "Cancelled."), pretty);
    } else {
      printError(new CliError("internal", err instanceof Error ? err.message : String(err)), pretty);
    }
  }
}
