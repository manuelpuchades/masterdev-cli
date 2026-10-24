# JSON-first output, with stable exit codes, for agents

The CLI's main users are coding agents (Claude Code, Codex) that run it as a normal command, as `wallapop-cli` and `vodafone-cli` do. Every command prints one JSON document to stdout by default; `--pretty` renders the same data for humans. Errors go to stderr as `{"error":{"code","message","hint"}}` with a stable exit code: 1 `internal`, 2 `usage`, 3 `auth_required`, 4 `not_found`, 5 `upstream`, 6 `unsupported`. An agent can tell "ask the user to log in" (3) from "Master.dev is down" (5) without parsing text.

## Consequences

- Output fields are a public contract: adding one is fine, renaming or removing one is a breaking change.
- Interactive prompts only appear on a TTY, and each has a flag, so an agent never hangs on a question.
