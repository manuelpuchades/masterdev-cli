# Lessons

Mistakes already paid for, turned into rules. Read this at the start of every session. One `###` entry per lesson; merge duplicates instead of adding new ones.

Format:

```md
### Short title

- **Symptom:** what we saw.
- **Root cause:** why it happened.
- **Rule:** what to do from now on.
```

---

### Progress isn't fetched by the page, it is rendered into it

- **Symptom:** filtering DevTools › Network by `kabuki/session/` on a course page showed 0 requests, although the page showed every Lesson's progress bar.
- **Root cause:** master.dev renders progress on the server into the HTML (course page, dashboard, library). The `session/<slug>` endpoint exists and works, but only the player calls it.
- **Rule:** before concluding an endpoint doesn't exist, search all response bodies (DevTools › Network › search, `Cmd+Opt+F`) for a field name such as `percentViewed`, and look for inline data (`window._bs.*`) in the HTML.

### Server-rendered pages also answer JSON

- **Symptom:** the library pages' DOM had no `/courses/<slug>/` links to scrape, and the HTML fetched without a browser had no course list.
- **Root cause:** the list is drawn by a script from inline data, and that script refreshes it by requesting the same URL with `Accept: application/json`, which the server honours, pagination included (`_page`, `_limit`).
- **Rule:** before scraping a master.dev page, read its page script for `jsonFetch` and try the same URL with `Accept: application/json`.

### `session/<slug>` answers 200 to an invalid cookie

- **Symptom:** a made-up or expired `fem_auth_mod` got `200 OK` from `session/<slug>`, with every `features` flag `false` and empty progress, which looks like "no progress yet".
- **Root cause:** the endpoint also serves anonymous visitors; it doesn't reject unknown sessions.
- **Rule:** treat a session response without `user` as `auth_required`. To check a session, use a library page: it answers `401 {"code":401,"message":"not authorized"}`.

### The latest watched Lesson isn't where the learner is

- **Symptom:** the Lesson with the most recent `lastWatched` had 0.3 % viewed, and the library's `lastLessonSlug` pointed at a completed Lesson, while the learner was really half-way through the Lesson after it.
- **Root cause:** opening a Lesson for a few seconds updates its `lastWatched`; `lastWatched` keeps only the latest play, and `lastLessonSlug` isn't "what's next".
- **Rule:** decide the Next lesson from the Lessons' order and completion (ADR 0009), never from the latest `lastWatched` or `lastLessonSlug` alone.

### `api.frontendmasters.com` is frozen

- **Symptom:** old notes and examples online use `api.frontendmasters.com/v1/kabuki`, which still answers.
- **Root cause:** after the rename, the site moved to `api.master.dev/v2/kabuki`; the old API no longer reflects the site.
- **Rule:** only use `api.master.dev/v2/kabuki` (ADR 0003); if a field seems missing, check the v2 response before trusting an old example.
