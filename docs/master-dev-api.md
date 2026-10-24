# Master.dev private API

What we know about the endpoints the CLI uses, validated with a real account on 2026-10-24. There is no official API (ADR 0003). Never paste real cookies or personal data here.

## Auth

- Session cookie `fem_auth_mod` (36 characters, UUID-like), set on `master.dev`, not HttpOnly. The website sends it to the API with `credentials: "include"`; the CLI sends `Cookie: fem_auth_mod=<value>`.
- The cookie set by a browser sign-in on 2026-10-24 expires 14 days later.
- **Suspected: one session per account.** After signing in on a second browser, the first browser's cookie stopped working (library `401`, empty `user`). Not confirmed yet; if true, a Password login from the CLI would sign the learner out of their browser.
- Sign-in page `https://master.dev/login/`: a plain HTML form, `POST /login/` with `username`, `password`, `remember` (checkbox), and hidden `nonce` (empty on a fresh page) and `redirect`. Also "Sign in with GitHub / Google" through Master.dev's own OAuth apps. Untested from the CLI; see docs/IMPROVEMENTS.md.

## Public endpoints (no cookie)

### `GET https://api.master.dev/v2/kabuki/courses?limit=9999`

Array of every Course (435 on 2026-10-24): `hash, slug, title, summary, thumbnail, durationSeconds, lessonCount, lessonGroupCount, isTrial, isFree, hasTranscript, quizQuestionCount, popularity, …`. No date or instructor; the thumbnail path carries the publication date (`/assets/courses/2026-01-20-ai-agents-v2/thumb@2x.jpg`).

### `GET https://api.master.dev/v2/kabuki/courses/<slug>`

`slug, title, description, datePublished, instructors[{slug,name,…}], resources[{label,url}], lessonSlugs[], lessonHashes[], lessonData{}, lessonElements[]`.

- `lessonElements` mixes Sections and Lessons in order: `{ "title": "Tool Calling", "duration": "20m 11s" }` starts a Section, a number is a Lesson's `index`.
- `lessonData[hash] = { slug, title, description, index, hash, timestamp: "00:33:18 - 00:48:17", isTrial, … }`. A Lesson's duration is `end - start + 1` seconds.
- A Lesson's page is `https://master.dev/courses/<courseSlug>/<lessonSlug>/`.

### `GET https://api.master.dev/v2/kabuki/workshops/live/`

Live workshops; shape not documented yet.

## Authenticated

### `GET https://api.master.dev/v2/kabuki/session/<slug>`: Course progress

```jsonc
{
  "id": "vsid_…",
  "completedDate": null,
  "bookmarked": false,
  "quizScore": 0.10067, "quizStarted": true, "quizCompleted": false,
  "quizAnswers": [{ "questionHash": "…_q1", "answerHash": "a4", "isCorrect": true, "correctAnswer": "a4" }],
  "notes": [],
  "progress": {
    "<lessonHash>": {
      "lastPercent": 0.01197,       // Resume point, 0–1
      "percentViewed": 0.86289,     // Percent viewed, 0–1
      "userCompleted": false,
      "lastWatched": 1785076481803, // epoch ms, latest play only
      "quizScore": 0,
      "remaining": "00:00:00"       // not meaningful
    }
  },
  "features": { "lessonsAll": true, "progressWrite": true, … },
  "user": { "displayName", "email", "intercomDigest", "status" } // personal data: drop it
}
```

- Only Lessons the learner has played appear in `progress`.
- **Without a valid cookie it still answers 200**, with every `features` flag `false`, `notes: null` and an empty `user` with `status: 0`. Signed in, `user.status` is 1: treat 0 or a missing `user` as signed out.

### `GET https://master.dev/my-account/library/<category>/` with `Accept: application/json`: Library

`category` is `started`, `completed` or `bookmarked`. Without the header the page is HTML with the same data inline (`window._bs.paginatorData`). Without a valid cookie: `401 {"code":401,"message":"not authorized"}`.

```json
{
  "data": {
    "category": "started",
    "courses": [{
      "slug": "ai-agents-v2", "hash": "eUtsWVhiLT", "title": "AI Agents Fundamentals, v2",
      "teacherName": "Scott Moss", "teacherSlug": "scott-moss",
      "isCompleted": false, "isBookmarked": false, "isTrial": false, "isBootcamp": false, "bookmarkIndex": 0,
      "lastLessonSlug": "create-an-agent-tool-call", "timeSinceLastWatchedString": "2 months",
      "percentComplete": 18.62, "quizScore": 0.10067, "hasReview": true, "thumbnail": "…"
    }]
  },
  "meta": { "childMeta": { "courses": { "paging": {
    "limit": 10, "currentPage": 1, "currentStart": 1, "currentEnd": 3, "totalPages": 1, "totalCount": 3, "count": 3,
    "links": { "current": "/my-account/library/started/" }
  } } } }
}
```

- Pagination: `?_page=N&_limit=N`; links look like `/my-account/library/started/?_limit=10&_page=10`. A page past the end returns an empty `courses`.
- The `started` list is ordered by most recent activity.
- `lastLessonSlug` is not the Next lesson (LESSONS).
- `percentComplete` (0–100) is the mean over all the Course's Lessons of `percentViewed`, a `userCompleted` Lesson counting as 1, unweighted by duration. Checked on five Courses: 18.62 vs 18.56, 8.375 vs 8.35, 17.27 vs 17.24, and 100 for both completed ones (whose raw `percentViewed` means are 48.8 and 67.8). The small gap suggests each Lesson is rounded up somehow; rounded to whole numbers, as the website shows it, they all match. ADR 0010.

## Server-rendered pages

The course page, `/dashboard/` ("Continue Watching": one Course and Lesson) and the library pages render progress on the server; they make no progress XHR. Page scripts: `cdn.master.dev/assets/fm-md/js/*.js`; site config in `window._bs.env` (`fmApi`, `eventsApi`, …).

## Never call

`events/batch` (player telemetry), `video/*/source` (stream URLs), and anything that writes (ADR 0002).
