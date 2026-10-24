# masterdev

A JSON-first CLI for your [Master.dev](https://master.dev) (formerly Frontend Masters) progress: which courses you've started, which lesson comes next, and what fits in the time you have. It's built for you and for coding agents such as Claude Code and Codex, which run it like any other command and recommend what to watch.

> **Status: alpha.** The commands work from source; sign-in still needs testing on more machines. Not published to npm yet.

> **Unofficial.** Not affiliated with Master.dev. It reads *your own* data, with *your own* session, from the private API the website uses. It never writes to your account, never downloads videos, and keeps requests few and slow ([ADR 0002](docs/adr/0002-read-only-against-master-dev.md), [ADR 0008](docs/adr/0008-polite-client-with-a-local-cache.md)).

## Install

Requires Node ≥ 22.13.

```bash
git clone https://github.com/manuelpuchades/masterdev-cli.git
cd masterdev-cli && npm install && npm run build && npm link
```

## Commands

```bash
masterdev auth login                 # sign in (see below)
masterdev auth status [--check]
masterdev auth logout

masterdev progress                   # started, completed and bookmarked courses
masterdev course <slug>              # lesson by lesson: done, in progress, pending, time left
masterdev next [--minutes 45]        # what to watch now, with links, fitted to your time
masterdev catalog [query]            # search every course (newest first), marking the ones you've done

masterdev plan add <link>            # plan a lesson or course, e.g. one your agent recommended
masterdev plan                       # the plan, pending first; items are done once you watch them
masterdev plan done|remove <item>    # mark done by hand, or take out (`remove --done` clears done ones)
```

Every command prints JSON to stdout; add `--pretty` for a human view and `--fresh` to skip the cache. Errors are JSON on stderr with stable exit codes, so agents can react to them ([ADR 0001](docs/adr/0001-json-first-output-for-agents.md)):

| Exit | Code            | Meaning                                    |
| ---- | --------------- | ------------------------------------------ |
| 0    |                 | OK                                         |
| 1    | `internal`      | Bug                                        |
| 2    | `usage`         | Wrong command or flags                     |
| 3    | `auth_required` | Not signed in, or the session expired      |
| 4    | `not_found`     | No such course or lesson                   |
| 5    | `upstream`      | Master.dev unreachable or answered oddly   |
| 6    | `unsupported`   | Not available on this platform or browser  |

## Signing in

Master.dev has no public API or tokens, so the CLI uses the same session cookie as the website, stored in your OS keychain ([ADR 0006](docs/adr/0006-session-cookie-from-three-login-methods.md), [ADR 0007](docs/adr/0007-secrets-in-the-os-keychain.md)):

- **Import from your browser** (default): takes the session from Chrome, Arc, Brave, Edge, Chromium, Vivaldi or Firefox where you're already signed in. Works whether you sign in with Google, GitHub or a password. On macOS you'll be asked once to allow access to the browser's key.
- **Email and password**: the CLI signs in for you and can sign in again when the session expires.
- **Paste a cookie**: as a fallback.

## For agents

[`SKILL.md`](SKILL.md) teaches agents the flow: recommend a lesson with its link, keep it in your local Plan, and next time see that you've watched it. Nothing is written to your account for that: the Master.dev player records what you watch, and the Plan lives on your machine ([ADR 0011](docs/adr/0011-local-plan-completed-by-master-dev.md)).

Install it for Claude Code:

```bash
mkdir -p ~/.claude/skills/masterdev && cp SKILL.md ~/.claude/skills/masterdev/SKILL.md
```

For Codex or other agents, point their instructions file (`AGENTS.md`) at it.

## Development

Requires Node ≥ 22.13.

```bash
npm install
npm run dev -- progress --pretty   # run from source
npm run typecheck && npm test
```

How the project is organised and the rules for contributing (including for AI agents) are in [CLAUDE.md](CLAUDE.md); domain vocabulary in [GLOSSARY.md](GLOSSARY.md); decisions in [docs/adr/](docs/adr/README.md); what we know about Master.dev's API in [docs/master-dev-api.md](docs/master-dev-api.md).

## License

[MIT](LICENSE)
