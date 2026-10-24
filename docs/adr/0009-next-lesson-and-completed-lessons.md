# Next lesson after the furthest Completed lesson; completed means marked or ≥ 95 % viewed

Master.dev gives each Lesson a Resume point (`lastPercent`), a Percent viewed (`percentViewed`), a completion flag and only the latest `lastWatched`. Neither "most recently watched" nor the library's `lastLessonSlug` says what to watch next: opening a later Lesson for a few seconds makes it the most recent, and `lastLessonSlug` pointed to a completed Lesson while the learner was half-way through the following one.

- A Lesson is completed when it is marked completed or its Percent viewed is at least 95 %.
- The Next lesson is the first unfinished Lesson after the furthest Completed lesson, falling back to the first unfinished one; lessons skipped on purpose earlier don't keep coming back.
- A Course's percent complete is the duration of its Completed lessons over its total duration.
- A Time budget takes consecutive unfinished Lessons from the Next lesson while their remaining time fits, and always at least one.
