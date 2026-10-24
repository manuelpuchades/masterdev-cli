---
name: end-session
description: Close a work session — check whether this session's changes need a new ADR, a LESSONS.md entry, or updates to CLAUDE.md, GLOSSARY.md, docs/master-dev-api.md, SKILL.md or README.md, and write them. Use when the user says "end session", "wrap up", "cierra la sesión", or runs /end-session.
---

# End session

Review what changed in this session (`git status`, `git diff`, and the conversation) and keep the project's memory up to date. Write everything in English.

1. **Decisions → ADR.** For each decision taken in this session that is hard to reverse, surprising without context, or the result of a real trade-off, and has no ADR yet: write `docs/adr/NNNN-slug.md` (next free number; never renumber) and add its row to `docs/adr/README.md`. Skip minor choices.
2. **Mistakes → LESSONS.** For each mistake that cost real time, add or merge an entry in `docs/memory/LESSONS.md` (Symptom / Root cause / Rule).
3. **Glossary → GLOSSARY.md.** Add or sharpen domain terms that were settled. Glossary only — no implementation details.
4. **API knowledge → docs/master-dev-api.md.** Record any endpoint, field or behaviour of Master.dev validated in this session. Never paste real cookies or personal data.
5. **Conventions → CLAUDE.md.** Update commands, layout, invariants or conventions that changed. Keep it about how to work, not a history of what was done.
6. **Users → README.md and SKILL.md.** Update if commands, flags, output fields or setup changed. `SKILL.md` is what users' agents read: keep it in step with the CLI.
7. **Backlog → docs/IMPROVEMENTS.md.** Remove what was done, add what was found and left open.
8. **Report** to the user: a short list of files touched and why, plus anything left open. Do not commit or push unless asked.
