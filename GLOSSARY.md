# masterdev

A personal CLI that reads a learner's progress on Master.dev (formerly Frontend Masters) so they and their coding agents can see where they are and decide what to watch next.

## Courses

**Course**:
A video workshop on Master.dev, identified by its slug (e.g. `ai-agents-v2`), taught by one or more **Instructors** and split into **Sections** of **Lessons**.
_Avoid_: Workshop (Master.dev uses it for live events), class

**Section**:
A titled group of consecutive **Lessons** inside a **Course** (e.g. "Tool Calling").
_Avoid_: Chapter, module, lesson group

**Lesson**:
One video of a **Course**, identified by its slug within the Course, with a fixed duration.
_Avoid_: Class, video, segment

**Instructor**:
A person who teaches a **Course**.
_Avoid_: Teacher (Master.dev's word in some places), author

**Catalog**:
Every **Course** Master.dev publishes, whether or not the learner has touched it.
_Avoid_: Courses list, library

## Progress

**Library**:
The **Courses** the learner has a relationship with, in three categories: **Started**, **Completed** and **Bookmarked**. A Course can be both Bookmarked and Started or Completed.
_Avoid_: My courses, history

**Course progress**:
What the learner has done in one **Course**: each **Lesson**'s progress, whether the Course is completed, and their quiz score. Master.dev's API calls it a "session"; we never do.
_Avoid_: Session, watch state

**Completed lesson**:
A **Lesson** the learner (or the player) marked as completed, or that they watched almost entirely.
_Avoid_: Seen, done, watched

**Percent viewed**:
How much of a **Lesson** the learner has actually watched, regardless of where the video was left.
_Avoid_: Progress (ambiguous), percent complete

**Percent complete**:
How far the learner is through a **Course**, as Master.dev shows it: the mean **Percent viewed** of its **Lessons**, a **Completed lesson** counting as 100. It doesn't measure time left.
_Avoid_: Progress (ambiguous)

**Resume point**:
Where the video of a **Lesson** was left the last time it was played; it can be before parts already watched.
_Avoid_: Last position, bookmark

**Next lesson**:
The **Lesson** the learner should watch next in a **Course**: the first one not completed after the furthest **Completed lesson**, so lessons skipped on purpose don't keep coming back.
_Avoid_: Continue watching, current lesson

**Time budget**:
The minutes the learner has for a sitting; the CLI fills it with consecutive unfinished **Lessons** starting at the **Next lesson**.
_Avoid_: Session length, slot

## Local memory

**Plan**:
Lessons or Courses the learner (or their agent) decided to watch, kept on the learner's machine; an item is done when Master.dev shows it as completed.
_Avoid_: Queue, watchlist, to-do

**Snapshot**:
A copy of the learner's **Course progress** taken at a point in time and kept locally, so changes between snapshots reveal what was watched when.
_Avoid_: Backup, history

**Streak**:
Consecutive days on which the learner watched at least part of a **Lesson**.
_Avoid_: Run, chain

## Access

**Login method**:
How the CLI obtained the learner's Master.dev session: **Browser import**, **Password login** or **Pasted cookie**. It decides how the session is renewed when it expires.

**Browser import**:
Taking the learner's existing Master.dev session from a browser where they are already signed in, whatever they signed in with (Google, GitHub or password).
_Avoid_: Cookie sync, scraping

**Password login**:
Signing in to Master.dev from the CLI with the learner's email and password.
_Avoid_: Native login, credentials login

**Pasted cookie**:
A session the learner copied by hand from their browser; it can't be renewed by the CLI.
