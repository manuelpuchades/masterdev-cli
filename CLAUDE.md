# CLAUDE.md

`masterdev` is a personal, JSON-first CLI for Master.dev (formerly Frontend Masters): it reads your course progress so you, Claude Code or Codex can see where you are and what to watch next. Domain vocabulary lives in [GLOSSARY.md](GLOSSARY.md); significant decisions in [docs/adr/](docs/adr/README.md); what we know about Master.dev's private API in [docs/master-dev-api.md](docs/master-dev-api.md).

## Start and end of every session

- **Start:** read [docs/memory/LESSONS.md](docs/memory/LESSONS.md) before changing anything.
- **End:** run `/end-session` to record decisions, lessons and doc updates.

## Invariants — do not violate

1. **English only** in code, comments, docs, ADRs and commit messages.
2. **Read-only against Master.dev** (ADR 0002). Only `GET` requests, except posting the sign-in form for Password login (ADR 0006). Never call `events/batch`, `video/*/source` or any endpoint that writes progress, notes, bookmarks or quiz answers. Local state (cache, config, the future Plan) is fine.
3. **Only `api.master.dev/v2/kabuki` and `master.dev` pages** (ADR 0003). Never the frozen `api.frontendmasters.com/v1`.
4. **Secrets never leave the keychain except as the request cookie** (ADR 0007): never print, log, cache or write to a test fixture the `fem_auth_mod` cookie, the password, or the `user` block (`email`, `intercomDigest`) of a session response.
5. **stdout is a contract** (ADR 0001): JSON by default, one document per command; errors go to stderr as JSON with a stable exit code. Renaming or removing an output field is a breaking change; adding one is not.
6. **Be a polite client** (ADR 0008): requests go through `src/http.ts` (sequential, throttled, timed out) and cacheable reads through `src/cache.ts`. No parallel fan-out.

## Stack and layout

TypeScript on Node ≥ 22.13 (ADR 0005), ESM, run directly with Node's type stripping in development and compiled by `tsc` to `dist/` for npm.

| Path                     | What                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `src/index.ts`           | Bin entry (`masterdev`)                                                                                  |
| `src/cli.ts`             | Commands (commander), output and error handling                                                         |
| `src/plan.ts`            | The Plan: parsing targets, the local file, and each item's status from Course progress (ADR 0011)       |
| `src/model.ts`           | Pure domain logic: wire shapes, Course progress, Next lesson, Time budget, Catalog search (ADR 0009)    |
| `src/api.ts`             | Master.dev reads: Catalog, course detail, Course progress, Library (ADR 0003, 0004)                     |
| `src/auth/`              | Login methods (browser import, password, pasted cookie) and automatic renewal (ADR 0006)               |
| `src/http.ts`            | The only place that talks to Master.dev: throttling, timeouts, status → error mapping                  |
| `src/cache.ts`           | On-disk cache with TTLs; `user-*` keys hold account data and are wiped on logout                       |
| `src/secrets.ts`         | OS keychain via `@napi-rs/keyring`, 0600 file fallback (ADR 0007)                                       |
| `src/config.ts`          | Non-secret config (`~/.config/masterdev/config.json`)                                                   |
| `tests/`                 | Vitest tests mirroring `src/` (`src/a.ts` → `tests/src/a.test.ts`); public fixtures in `tests/fixtures` |
| `SKILL.md`               | The skill users install so their agents know how to use the CLI (shipped in the npm package)           |
| `docs/master-dev-api.md` | Validated notes on Master.dev's private API                                                             |
| `docs/adr/`              | Architecture Decision Records                                                                           |
| `docs/memory/LESSONS.md` | Mistakes already paid for, as rules                                                                     |
| `docs/IMPROVEMENTS.md`   | Backlog: next features and open questions                                                               |

Paths at runtime: config in `$XDG_CONFIG_HOME/masterdev` (`MASTERDEV_CONFIG_DIR`), cache in `$XDG_CACHE_HOME/masterdev` (`MASTERDEV_CACHE_DIR`), the Plan in `$XDG_DATA_HOME/masterdev` (`MASTERDEV_DATA_DIR`). `MASTERDEV_COOKIE` overrides the stored cookie.

## Commands

```bash
npm install
npm run dev -- progress --pretty   # run from source (Node type stripping)
npm run typecheck && npm test      # before every commit
npm run build                      # dist/ for npm
```

## Conventions

- TypeScript `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (no enums, no parameter properties: Node must be able to strip the types). Relative imports end in `.ts`.
- kebab-case filenames, camelCase functions, PascalCase types.
- **Readable at first read; no accidental complexity.** Small named functions and explicit steps over dense chains of `??`, `?.` and casts.
- Domain logic stays pure in `src/model.ts` and is tested with real public fixtures (`courses/<slug>` responses). Fixtures of account data are hand-written or sanitized (invariant 4).
- Every command must work for an agent without a TTY: interactive prompts only when `process.stdin.isTTY`, and every prompt has a flag.
- When you learn something new about Master.dev's API, update `docs/master-dev-api.md` in the same commit.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).

## Recording decisions (ADRs)

Write an ADR in `docs/adr/NNNN-slug.md` **in the same commit** as the change whenever a decision is:

1. **hard to reverse**, or
2. **surprising without context** (a reader would ask "why on earth…?"), or
3. **the result of a real trade-off** between genuine alternatives.

Keep it short: a title, 1–3 sentences of context/decision/why, and "Considered Options" / "Consequences" only when they add value. Add a row to [docs/adr/README.md](docs/adr/README.md). Never renumber; supersede instead.

## Recording lessons

When a mistake costs real time (a wrong assumption about the API, a misleading response, a broken release), add an entry to `docs/memory/LESSONS.md` with **Symptom / Root cause / Rule**. Merge with an existing entry instead of duplicating.
