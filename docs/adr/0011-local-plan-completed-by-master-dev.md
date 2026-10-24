# The Plan is a local file whose items are done when Master.dev shows them completed

Status: accepted.

An agent that recommends a Lesson forgets it by the next conversation, and Master.dev has no "watch later" we could use without writing to the account (ADR 0002). The Plan is `plan.json` in `$XDG_DATA_HOME/masterdev` (not the cache, which can be wiped, nor the config); `plan list` reads each item's status from Course progress, so an item is done as soon as the player records the Lesson as completed, with nobody checking it off.

## Considered options

- **Checking items off by hand only**: the learner would have to tell the CLI what Master.dev already knows. `plan done` stays for what Master.dev can't see: a Lesson skipped on purpose, or a Course dropped.
- **Storing status in the file**: it would go stale; it is always read live (cached two minutes like any account data).

## Consequences

- The Plan is per machine and survives `auth logout`; it holds no secrets or account data, only slugs, notes and dates.
- Items are identified by `course/lesson` or `course`, so an agent can pass back the link it recommended.
