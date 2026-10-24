# Master.dev's private web API at `api.master.dev/v2/kabuki`

There is no official API. The website reads `https://api.master.dev/v2/kabuki/` (`courses`, `courses/<slug>`, `session/<slug>`, `workshops/live/`); the CLI uses the same endpoints the site uses, with the learner's own session cookie. `api.frontendmasters.com/v1/kabuki`, from before the rename, still answers but is frozen: never use it. Everything validated about these endpoints is in [docs/master-dev-api.md](../master-dev-api.md).

## Consequences

- Master.dev can change these endpoints without notice. Wire shapes are declared in one place (`src/model.ts`), so a change breaks in one spot and surfaces as an `upstream` error instead of wrong data.
