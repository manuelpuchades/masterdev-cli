import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "./errors.ts";
import type { CourseView, LessonStatus, LessonView } from "./model.ts";
import { DATA_DIR } from "./paths.ts";

// The Plan (ADR 0011): Lessons and Courses the learner or their agent decided to watch, kept
// on this machine. Nobody checks items off: an item is done when Master.dev shows it completed.

export interface PlanTarget {
  course: string;
  lesson: string | null;
}

export interface PlanItem extends PlanTarget {
  id: string;
  note: string | null;
  addedAt: string;
  /** Set by `plan done`, for something finished or dropped that Master.dev won't show as completed. */
  markedDoneAt: string | null;
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/i;

function usage(input: string): CliError {
  return new CliError(
    "usage",
    `"${input}" is not a Master.dev course or lesson.`,
    "Use a link like https://master.dev/courses/<course>/<lesson>/, `<course>/<lesson>` or `<course>`.",
  );
}

function slugsFromUrl(input: string): string[] {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw usage(input);
  }
  const [first, ...rest] = url.pathname.split("/").filter(Boolean);
  if (url.hostname.replace(/^www\./, "") !== "master.dev" || first !== "courses") throw usage(input);
  return rest;
}

/** A Lesson or Course from a master.dev link, `course/lesson`, or `course` plus an optional lesson. */
export function parseTarget(input: string, lesson?: string): PlanTarget {
  const slugs = /^https?:\/\//i.test(input) ? slugsFromUrl(input) : input.split("/").filter(Boolean);
  if (lesson !== undefined) slugs.push(lesson);
  const [course, lessonSlug, ...extra] = slugs;
  if (!course || extra.length > 0 || !slugs.every((s) => SLUG.test(s))) throw usage(input);
  return { course, lesson: lessonSlug ?? null };
}

export const planId = (t: PlanTarget) => (t.lesson ? `${t.course}/${t.lesson}` : t.course);

// ---- Storage ----

const file = () => join(DATA_DIR, "plan.json");

export function readPlan(): PlanItem[] {
  try {
    return (JSON.parse(readFileSync(file(), "utf8")) as { items: PlanItem[] }).items;
  } catch {
    return [];
  }
}

export function writePlan(items: PlanItem[]): void {
  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  const tmp = `${file()}.tmp`;
  writeFileSync(tmp, JSON.stringify({ items }, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, file());
}

/** Adds a target, or updates its note when it's already planned. */
export function addToPlan(items: PlanItem[], target: PlanTarget, note: string | undefined, now: Date): { items: PlanItem[]; item: PlanItem; added: boolean } {
  const id = planId(target);
  const existing = items.find((i) => i.id === id);
  if (existing) {
    const item = { ...existing, note: note ?? existing.note };
    return { items: items.map((i) => (i.id === id ? item : i)), item, added: false };
  }
  const item: PlanItem = { id, ...target, note: note ?? null, addedAt: now.toISOString(), markedDoneAt: null };
  return { items: [...items, item], item, added: true };
}

/** Fails with `not_found` naming every id that isn't in the Plan. */
export function requireIds(items: PlanItem[], ids: string[]): void {
  const missing = ids.filter((id) => !items.some((i) => i.id === id));
  if (missing.length) throw new CliError("not_found", `Not in the plan: ${missing.join(", ")}.`, "List it with `masterdev plan`.");
}

export function markDone(items: PlanItem[], ids: string[], now: Date): PlanItem[] {
  requireIds(items, ids);
  return items.map((i) => (ids.includes(i.id) && !i.markedDoneAt ? { ...i, markedDoneAt: now.toISOString() } : i));
}

// ---- View ----

export interface PlanItemView {
  id: string;
  kind: "lesson" | "course";
  /** From Master.dev; null when not signed in or the lesson no longer exists. */
  status: LessonStatus | null;
  /** Completed on Master.dev, or marked done with `plan done`. */
  done: boolean;
  note: string | null;
  addedAt: string;
  markedDoneAt: string | null;
  course: { slug: string; title: string; url: string; percentComplete: number | null; remainingSeconds: number | null };
  lesson: LessonView | null;
}

function courseStatus(view: CourseView): LessonStatus | null {
  const p = view.progress;
  if (!p) return null;
  if (p.completedLessons === p.totalLessons) return "completed";
  return p.percentComplete > 0 ? "in_progress" : "not_started";
}

export function planItemView(item: PlanItem, view: CourseView): PlanItemView {
  const lesson = item.lesson ? (view.sections.flatMap((s) => s.lessons).find((l) => l.slug === item.lesson) ?? null) : null;
  const status = item.lesson ? (view.progress && lesson ? lesson.status : null) : courseStatus(view);
  return {
    id: item.id,
    kind: item.lesson ? "lesson" : "course",
    status,
    done: status === "completed" || item.markedDoneAt !== null,
    note: item.note,
    addedAt: item.addedAt,
    markedDoneAt: item.markedDoneAt,
    course: {
      slug: view.slug,
      title: view.title,
      url: view.url,
      percentComplete: view.progress?.percentComplete ?? null,
      remainingSeconds: view.progress?.remainingSeconds ?? null,
    },
    lesson,
  };
}
