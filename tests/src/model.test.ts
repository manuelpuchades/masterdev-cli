import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCourseView,
  catalogDate,
  formatClock,
  lessonDuration,
  lessonsForBudget,
  searchCatalog,
  type CatalogEntry,
  type CourseDetail,
  type CourseProgressResponse,
  type LessonProgress,
} from "../../src/model.ts";

// Public response of GET courses/ai-agents-v2 (trimmed descriptions). 37 lessons.
const detail: CourseDetail = JSON.parse(readFileSync(new URL("../fixtures/course-ai-agents-v2.json", import.meta.url), "utf8"));
const hashAt = (index: number) => detail.lessonHashes[index]!;

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 3, 1);

function lesson(p: Partial<LessonProgress>): LessonProgress {
  return { lastPercent: 0, percentViewed: 0, userCompleted: false, lastWatched: T0, ...p };
}

function learner(progress: Record<number, Partial<LessonProgress>>): CourseProgressResponse {
  const byHash = Object.fromEntries(Object.entries(progress).map(([i, p]) => [hashAt(Number(i)), lesson(p)]));
  return { completedDate: null, bookmarked: false, quizScore: 0, progress: byHash, notes: [] };
}

// The real situation that shaped ADR 0009: lessons 0–5 done, lesson 6 mostly watched but
// replayed from the start, and two later lessons opened for a few seconds afterwards.
const halfwayThroughEvals = learner({
  0: { userCompleted: true, percentViewed: 0.99, lastPercent: 1 },
  1: { userCompleted: true, percentViewed: 0.99, lastPercent: 1 },
  2: { userCompleted: true, percentViewed: 0.99, lastPercent: 1 },
  3: { userCompleted: true, percentViewed: 0.99, lastPercent: 0.98 },
  4: { userCompleted: true, percentViewed: 0.99, lastPercent: 1 },
  5: { userCompleted: true, percentViewed: 0.98, lastPercent: 0.88 },
  6: { percentViewed: 0.86289, lastPercent: 0.01197, lastWatched: T0 + 100 * DAY },
  9: { percentViewed: 0.0028, lastPercent: 0.13, lastWatched: T0 + 100 * DAY + 20_000 },
  11: { percentViewed: 0.0027, lastPercent: 0.22, lastWatched: T0 + 100 * DAY + 10_000 },
});

describe("lessonDuration", () => {
  it("counts the end second", () => {
    expect(lessonDuration("00:33:18 - 00:48:17")).toBe(900);
    expect(lessonDuration("00:00:00 - 00:03:51")).toBe(232);
  });

  it("is 0 for a malformed timestamp", () => {
    expect(lessonDuration("soon")).toBe(0);
  });
});

describe("formatClock", () => {
  it("drops the hours when there are none", () => {
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("buildCourseView", () => {
  it("groups lessons into sections in course order", () => {
    const view = buildCourseView(detail, null);
    expect(view.lessonCount).toBe(37);
    expect(view.sections[0]!.title).toBe("Introduction");
    expect(view.sections[0]!.lessons.map((l) => l.slug)).toEqual(["introduction", "cli-agent-demo"]);
    expect(view.sections.flatMap((s) => s.lessons).map((l) => l.index)).toEqual([...Array(37).keys()]);
  });

  it("without progress, has no progress and starts at the first lesson", () => {
    const view = buildCourseView(detail, null);
    expect(view.progress).toBeNull();
    expect(view.next?.slug).toBe("introduction");
  });

  it("marks lessons completed, in progress or not started", () => {
    const lessons = buildCourseView(detail, halfwayThroughEvals).sections.flatMap((s) => s.lessons);
    expect(lessons[5]!.status).toBe("completed");
    expect(lessons[6]!.status).toBe("in_progress");
    expect(lessons[6]!.percentViewed).toBe(86.3);
    expect(lessons[7]!.status).toBe("not_started");
  });

  it("counts a lesson watched almost entirely as completed even if not marked", () => {
    const view = buildCourseView(detail, learner({ 0: { percentViewed: 0.97 } }));
    expect(view.sections[0]!.lessons[0]!.status).toBe("completed");
  });

  it("picks the lesson after the furthest completed one, not the latest opened", () => {
    const view = buildCourseView(detail, halfwayThroughEvals);
    expect(view.next?.slug).toBe("understanding-evals");
    expect(view.next?.resumeAt).not.toBeNull();
  });

  it("doesn't send the learner back to a lesson skipped earlier", () => {
    const view = buildCourseView(detail, learner({ 0: { userCompleted: true }, 2: { userCompleted: true }, 3: { userCompleted: true } }));
    expect(view.next?.index).toBe(4);
  });

  it("has no next lesson when every lesson is completed", () => {
    const all = Object.fromEntries(detail.lessonHashes.map((_, i) => [i, { userCompleted: true }]));
    const view = buildCourseView(detail, learner(all));
    expect(view.next).toBeNull();
    expect(view.progress?.percentComplete).toBe(100);
    expect(view.progress?.remainingSeconds).toBe(0);
  });

  it("computes progress by the duration of completed lessons", () => {
    const view = buildCourseView(detail, halfwayThroughEvals);
    const lessons = view.sections.flatMap((s) => s.lessons);
    const done = lessons.slice(0, 6).reduce((acc, l) => acc + l.durationSeconds, 0);
    expect(view.progress?.completedLessons).toBe(6);
    expect(view.progress?.percentComplete).toBe(Math.round((done / view.durationSeconds) * 1000) / 10);
    expect(view.progress?.lastWatched).toBe(new Date(T0 + 100 * DAY + 20_000).toISOString());
  });
});

describe("lessonsForBudget", () => {
  const view = buildCourseView(detail, halfwayThroughEvals);

  it("without a budget, returns only the next lesson", () => {
    expect(lessonsForBudget(view).map((l) => l.slug)).toEqual(["understanding-evals"]);
  });

  it("takes consecutive unfinished lessons while they fit", () => {
    const picked = lessonsForBudget(view, 30 * 60);
    const total = picked.reduce((acc, l) => acc + l.remainingSeconds, 0);
    expect(picked.length).toBeGreaterThan(1);
    expect(total).toBeLessThanOrEqual(30 * 60);
    expect(picked.map((l) => l.index)).toEqual(picked.map((_, i) => 6 + i));
  });

  it("always returns at least one lesson, even if it doesn't fit", () => {
    expect(lessonsForBudget(view, 60)).toHaveLength(1);
  });
});

describe("catalog", () => {
  const entry = (slug: string, title: string, date: string | null, summary = ""): CatalogEntry => ({
    slug, title, url: "", date, durationSeconds: 0, lessonCount: 0, isFree: false, summary,
  });
  const entries = [
    entry("old-agents", "Agents, the old way", "2020-01-01"),
    entry("ai-agents-v2", "AI Agents Fundamentals, v2", "2026-01-20"),
    entry("react", "Complete Intro to React", "2025-05-01", "build agents? no, components"),
  ];

  it("reads the publication date from the thumbnail path", () => {
    expect(catalogDate("https://cdn.master.dev/assets/courses/2026-01-20-ai-agents-v2/thumb@2x.jpg")).toBe("2026-01-20");
    expect(catalogDate("https://cdn.master.dev/thumb.jpg")).toBeNull();
  });

  it("requires every word and ranks title matches first, then newest", () => {
    expect(searchCatalog(entries, "agents").map((e) => e.slug)).toEqual(["ai-agents-v2", "old-agents", "react"]);
    expect(searchCatalog(entries, "ai agents").map((e) => e.slug)).toEqual(["ai-agents-v2"]);
  });

  it("lists everything newest first without a query", () => {
    expect(searchCatalog(entries, " ").map((e) => e.slug)).toEqual(["ai-agents-v2", "react", "old-agents"]);
  });
});
