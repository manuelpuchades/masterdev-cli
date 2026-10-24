# Improvements

Backlog of next features and open questions. Remove an entry when it is done (the commit records it) or rejected (write an ADR if the reason is worth keeping).

## Next features

### Plan

`masterdev plan add|list|done`: Lessons or Courses the learner or their agent decided to watch, kept locally (ADR 0002). An item becomes done when its Course progress shows it completed, so the agent can "remember" what it recommended across conversations.

### Snapshots, Streaks and stats

Master.dev keeps only each Lesson's latest `lastWatched`, so watch history can't be rebuilt. `masterdev sync` (run daily by cron or launchd) stores Snapshots of Course progress; diffs between them give minutes watched per day, Streaks and weekly stats, exact from the first sync on. Until then `stats` and `streak` can only approximate from `lastWatched`.

### Quiz review and notes

`quiz <slug>`: the questions answered wrong (`quizAnswers[].isCorrect`) and the Lessons to review. `notes <slug>`: export the learner's notes from Course progress.

### Workshops

`workshops`: live and upcoming workshops from `workshops/live/` (public).

## Open questions

- **Password login:** a wrong email and password get `200` with the form again (no captcha after one attempt). Still to check with a real account: that a plain `POST /login/` with an empty `nonce` signs in, and whether a captcha appears after several failures.
- **Session lifetime:** how long `fem_auth_mod` lasts, with and without "remember me", and whether a Password login from the CLI ends the browser's session.
- **Library page size:** whether `_limit` accepts values above 10 (only 10 was observed).
- **Learning paths:** not investigated; probably server-rendered pages that could be read like the library.
- **Safari and Windows Browser import:** Safari needs Full Disk Access; Chromium on Windows uses DPAPI and app-bound encryption.
