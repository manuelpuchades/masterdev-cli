# Read-only against Master.dev; any state of our own stays local

The CLI only sends `GET` requests to Master.dev, apart from posting the sign-in form for a Password login (ADR 0006), which changes nothing in the account. It never calls `events/batch` (the player's telemetry), `video/*/source` (stream URLs) or any endpoint that writes progress, notes, bookmarks or quiz answers, although the session's `features` show the account may write them. Anything the CLI needs to remember (cache, config, the Plan, Snapshots) lives on the learner's machine.

Master.dev's Terms of Service grant a personal licence, forbid downloading content without a download link, and forbid reverse engineering the Service or interfering with its performance. They don't distinguish reading from writing, so this is our choice, not their rule: reading your own progress for yourself is the least intrusive use of a private API, while writing could corrupt the learner's own data and draws more attention.

Writes aren't needed for the main flow either: when an agent recommends a Lesson and the learner watches it on master.dev, the player records it, and the next `masterdev` call reads it.

## Considered Options

- **Mark Lessons completed or add bookmarks from the CLI:** convenient for agents, but each write endpoint is undocumented, a mistake damages real progress, and nothing in the planned features needs it.
