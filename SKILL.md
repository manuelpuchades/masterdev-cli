---
name: masterdev
description: Master.dev (formerly Frontend Masters) courses through the `masterdev` CLI. Use when the user asks what to watch or study next, how far they are in a course, how much time a course or lesson takes, or for a course recommendation on Master.dev.
---

# masterdev

`masterdev` reads the user's own Master.dev progress and prints JSON. It is read-only: the Master.dev player records what the user watches, so the next `masterdev` call already knows.

## Steps

1. **Ground every answer in fresh data.** Run the command that answers the question (below) before recommending anything. When the user says they just watched something, or the conversation picks up after a break, add `--fresh`.
2. **Recommend with links.** Every lesson or course you suggest carries its `url` from the output, its duration, and, for a lesson in progress, its `resumeAt`.
3. **Close the loop next time.** When the user comes back, run `masterdev next --fresh` (or `course <slug> --fresh`) and read each lesson's `status` to see whether what you recommended is now `completed` before suggesting more.

Done when the user has a concrete next lesson or course, with its link, backed by output from this session.

## Which command

| Question                                     | Command                                         |
| -------------------------------------------- | ----------------------------------------------- |
| What should I watch now?                     | `masterdev next`                                |
| I have 45 minutes                            | `masterdev next --minutes 45`                   |
| One pick per course I'm taking               | `masterdev next --all`                          |
| What have I started / finished / bookmarked? | `masterdev progress`                            |
| How far am I in a course, what's left?       | `masterdev course <slug>`                       |
| Find a course about X                        | `masterdev catalog <words>` (newest first)      |

`masterdev <command> --help` lists every flag.

## Reading the output

- Lesson `status`: `completed`, `in_progress` or `not_started`. `percentViewed` is how much was actually watched; `resumeAt` is where the video was left.
- `next` → `picks[]`, each with `course`, the `lessons` to watch in order, and `totalSeconds`. With `--minutes`, the lessons fit the budget; a single lesson longer than the budget still comes back alone.
- `course` → `progress` (`percentComplete`, `completedLessons`, `remainingSeconds`), `sections[].lessons[]` and `next`. `signedIn: false` means progress is unknown, not zero.
- `catalog` → `courses[]` with `status` (`started`, `completed` or `null`) and `percentComplete`, so you can recommend courses the user hasn't taken.
- Durations are in seconds.

## Errors

Errors are JSON on stderr: `{"error":{"code","message","hint"}}`.

| Exit | Code            | What to do                                                                                                             |
| ---- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 3    | `auth_required` | Ask the user to run `masterdev auth login` in their own terminal; it may show a keychain prompt or ask for a password. |
| 4    | `not_found`     | The slug is wrong: find the right one with `masterdev catalog <words>`.                                                |
| 5    | `upstream`      | Master.dev is unreachable or changed; tell the user and retry later.                                                   |
| 2    | `usage`         | Fix the command using `--help`.                                                                                        |
