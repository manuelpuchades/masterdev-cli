import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildCourseView, type CourseDetail, type CourseProgressResponse } from "../../src/model.ts";
import { addToPlan, markDone, parseTarget, planItemView, type PlanItem } from "../../src/plan.ts";

// Public response of GET courses/ai-agents-v2 (trimmed descriptions). 37 lessons.
const detail: CourseDetail = JSON.parse(readFileSync(new URL("../fixtures/course-ai-agents-v2.json", import.meta.url), "utf8"));
const NOW = new Date("2026-10-24T10:00:00Z");

function learner(completedLessons: number[]): CourseProgressResponse {
  const progress = Object.fromEntries(
    completedLessons.map((i) => [detail.lessonHashes[i]!, { lastPercent: 1, percentViewed: 1, userCompleted: true, lastWatched: NOW.getTime() }]),
  );
  return { completedDate: null, bookmarked: false, quizScore: 0, progress, notes: [] };
}

describe("parseTarget", () => {
  it("reads lesson and course links", () => {
    expect(parseTarget("https://master.dev/courses/ai-agents-v2/understanding-evals/")).toEqual({ course: "ai-agents-v2", lesson: "understanding-evals" });
    expect(parseTarget("https://www.master.dev/courses/ai-agents-v2/")).toEqual({ course: "ai-agents-v2", lesson: null });
  });

  it("reads course/lesson, a course slug, and a lesson given apart", () => {
    expect(parseTarget("ai-agents-v2/understanding-evals")).toEqual({ course: "ai-agents-v2", lesson: "understanding-evals" });
    expect(parseTarget("ai-agents-v2")).toEqual({ course: "ai-agents-v2", lesson: null });
    expect(parseTarget("ai-agents-v2", "understanding-evals")).toEqual({ course: "ai-agents-v2", lesson: "understanding-evals" });
  });

  it("rejects other sites, other pages and too many parts", () => {
    for (const bad of ["https://google.com/courses/x/", "https://master.dev/dashboard/", "a/b/c", "not a slug", ""]) {
      expect(() => parseTarget(bad), bad).toThrow(/not a Master.dev course or lesson/);
    }
  });
});

describe("addToPlan and markDone", () => {
  const evals = { course: "ai-agents-v2", lesson: "understanding-evals" };

  it("adds once and updates the note when planned again", () => {
    const first = addToPlan([], evals, "for evals", NOW);
    expect(first.added).toBe(true);
    expect(first.item.id).toBe("ai-agents-v2/understanding-evals");
    const again = addToPlan(first.items, evals, undefined, NOW);
    expect(again.added).toBe(false);
    expect(again.items).toHaveLength(1);
    expect(again.item.note).toBe("for evals");
    expect(addToPlan(first.items, evals, "new note", NOW).item.note).toBe("new note");
  });

  it("marks items done and refuses ids that aren't planned", () => {
    const { items } = addToPlan([], evals, undefined, NOW);
    expect(markDone(items, ["ai-agents-v2/understanding-evals"], NOW)[0]?.markedDoneAt).toBe(NOW.toISOString());
    expect(() => markDone(items, ["ai-agents-v2/nope"], NOW)).toThrow(/Not in the plan: ai-agents-v2\/nope/);
  });
});

describe("planItemView", () => {
  const item = (lesson: string | null): PlanItem => ({
    id: lesson ? `ai-agents-v2/${lesson}` : "ai-agents-v2",
    course: "ai-agents-v2",
    lesson,
    note: null,
    addedAt: NOW.toISOString(),
    markedDoneAt: null,
  });

  it("is done once Master.dev shows the lesson completed", () => {
    expect(planItemView(item("introduction"), buildCourseView(detail, learner([])))).toMatchObject({ status: "not_started", done: false });
    expect(planItemView(item("introduction"), buildCourseView(detail, learner([0])))).toMatchObject({ status: "completed", done: true });
  });

  it("is done when marked by hand, whatever Master.dev says", () => {
    const view = planItemView({ ...item("introduction"), markedDoneAt: NOW.toISOString() }, buildCourseView(detail, learner([])));
    expect(view).toMatchObject({ status: "not_started", done: true });
  });

  it("gives a course its status from its lessons", () => {
    const all = detail.lessonHashes.map((_, i) => i);
    expect(planItemView(item(null), buildCourseView(detail, learner([0]))).status).toBe("in_progress");
    expect(planItemView(item(null), buildCourseView(detail, learner(all))).status).toBe("completed");
  });

  it("has no status when not signed in or the lesson is gone", () => {
    expect(planItemView(item("introduction"), buildCourseView(detail, null)).status).toBeNull();
    expect(planItemView(item("removed-lesson"), buildCourseView(detail, learner([0])))).toMatchObject({ status: null, lesson: null, done: false });
  });
});

describe("plan storage", () => {
  it("round-trips through a private file in MASTERDEV_DATA_DIR", async () => {
    const dir = mkdtempSync(join(tmpdir(), "masterdev-plan-"));
    vi.stubEnv("MASTERDEV_DATA_DIR", dir);
    vi.resetModules();
    const plan = await import("../../src/plan.ts");
    expect(plan.readPlan()).toEqual([]);
    const { items } = plan.addToPlan([], { course: "ai-agents-v2", lesson: null }, undefined, NOW);
    plan.writePlan(items);
    expect(plan.readPlan()).toEqual(items);
    expect(statSync(join(dir, "plan.json")).mode & 0o777).toBe(0o600);
    vi.unstubAllEnvs();
  });
});
