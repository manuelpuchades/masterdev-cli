# A Course's percent complete is Master.dev's figure, not a share of Completed lessons

Status: accepted; supersedes the percent-complete rule of ADR 0009.

The library pages give each Course a `percentComplete`, while `course` and `next` computed ours from the duration of Completed lessons, so the same Course showed 18.6 % in `progress` and 11.2 % in `course`, and the website showed 19 %. An agent can't tell which to trust, and the learner compares with the website.

We compute it the way Master.dev does: the mean of every Lesson's Percent viewed, a Completed lesson counting as 100, whatever its length. Rounded, it matched the website on all five Courses we checked; unrounded it is within 0.1 (Master.dev rounds each Lesson in a way we couldn't pin down).

## Consequences

- `percentComplete` means the same in every command and matches the website.
- It doesn't measure time: a long unwatched Lesson weighs as much as a short one. What's left in time is `remainingSeconds`, and `completedLessons` / `totalLessons` is the count.
