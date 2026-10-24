import { SITE } from "./paths.ts";

// ---- Wire shapes (only the fields we use) ----

export interface CatalogCourse {
  hash: string;
  slug: string;
  title: string;
  summary: string;
  thumbnail: string;
  durationSeconds: number;
  lessonCount: number;
  isTrial: boolean;
  isFree: boolean;
}

export interface LessonData {
  slug: string;
  title: string;
  description?: string;
  index: number;
  hash: string;
  timestamp: string;
}

export interface CourseDetail {
  slug: string;
  title: string;
  description: string;
  datePublished?: string;
  instructors?: { slug: string; name: string }[];
  resources?: { label: string; url: string }[];
  lessonElements: (number | { title: string; duration: string })[];
  lessonHashes: string[];
  lessonData: Record<string, LessonData>;
}

export interface LessonProgress {
  lastPercent: number;
  percentViewed: number;
  userCompleted: boolean;
  lastWatched: number;
}

export interface CourseProgressResponse {
  completedDate: string | number | null;
  bookmarked: boolean;
  quizScore: number;
  progress: Record<string, LessonProgress>;
  notes: unknown[];
}

export interface LibraryCourse {
  slug: string;
  hash: string;
  title: string;
  teacherName: string;
  teacherSlug: string;
  isCompleted: boolean;
  isBookmarked: boolean;
  isTrial: boolean;
  lastLessonSlug: string;
  timeSinceLastWatchedString: string;
  percentComplete: number;
  quizScore: number;
}

export type LibraryCategory = "started" | "completed" | "bookmarked";

// ---- Views (what the CLI prints) ----

export type LessonStatus = "completed" | "in_progress" | "not_started";

export interface LessonView {
  index: number;
  slug: string;
  title: string;
  section: string;
  url: string;
  durationSeconds: number;
  status: LessonStatus;
  percentViewed: number;
  remainingSeconds: number;
  resumeAt: string | null;
  lastWatched: string | null;
}

export interface SectionView {
  title: string;
  durationSeconds: number;
  lessonCount: number;
  completedLessons: number;
  lessons: LessonView[];
}

export interface CourseProgressSummary {
  percentComplete: number;
  completedLessons: number;
  totalLessons: number;
  remainingSeconds: number;
  completedDate: string | number | null;
  lastWatched: string | null;
}

export interface CourseView {
  slug: string;
  title: string;
  url: string;
  instructors: string[];
  datePublished: string | null;
  durationSeconds: number;
  lessonCount: number;
  resources: { label: string; url: string }[];
  progress: CourseProgressSummary | null;
  next: LessonView | null;
  sections: SectionView[];
}

export const courseUrl = (slug: string) => `${SITE}/courses/${slug}/`;
export const lessonUrl = (courseSlug: string, lessonSlug: string) => `${SITE}/courses/${courseSlug}/${lessonSlug}/`;

// A lesson counts as done when the user (or the player) marked it, or almost all of it was watched.
const COMPLETED_VIEWED = 0.95;

function clockToSeconds(clock: string): number {
  return clock.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
}

/** "00:33:18 - 00:48:17" → 900 (the end second is inclusive). */
export function lessonDuration(timestamp: string): number {
  const [start, end] = timestamp.split("-").map((s) => clockToSeconds(s.trim()));
  if (start === undefined || end === undefined || Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, end - start + 1);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const isoOrNull = (ms: number | undefined) => (ms ? new Date(ms).toISOString() : null);

function lessonView(courseSlug: string, lesson: LessonData, section: string, p: LessonProgress | undefined): LessonView {
  const durationSeconds = lessonDuration(lesson.timestamp);
  const completed = !!p && (p.userCompleted || p.percentViewed >= COMPLETED_VIEWED);
  const started = !!p && (p.percentViewed > 0 || p.lastPercent > 0);
  const status: LessonStatus = completed ? "completed" : started ? "in_progress" : "not_started";
  const position = status === "in_progress" && p ? Math.min(1, Math.max(0, p.lastPercent)) : 0;
  return {
    index: lesson.index,
    slug: lesson.slug,
    title: lesson.title,
    section,
    url: lessonUrl(courseSlug, lesson.slug),
    durationSeconds,
    status,
    percentViewed: round1((p?.percentViewed ?? 0) * 100),
    remainingSeconds: completed ? 0 : Math.round(durationSeconds * (1 - position)),
    resumeAt: position > 0 ? formatClock(durationSeconds * position) : null,
    lastWatched: isoOrNull(p?.lastWatched),
  };
}

/**
 * The lesson to watch next: the first unfinished lesson after the furthest completed one,
 * so lessons skipped on purpose earlier in the course don't keep coming back.
 * Falls back to the first unfinished lesson overall.
 */
export function pickNext(lessons: LessonView[]): LessonView | null {
  let furthest = -1;
  lessons.forEach((l, i) => {
    if (l.status === "completed") furthest = i;
  });
  return lessons.slice(furthest + 1).find((l) => l.status !== "completed") ?? lessons.find((l) => l.status !== "completed") ?? null;
}

/**
 * Master.dev's own figure (ADR 0010): the mean of every Lesson's Percent viewed, with a Completed
 * lesson counting as 100, whatever its length. It matches the website once rounded.
 */
function percentComplete(lessons: LessonView[]): number {
  if (lessons.length === 0) return 0;
  const total = lessons.reduce((acc, l) => acc + (l.status === "completed" ? 100 : l.percentViewed), 0);
  return round1(total / lessons.length);
}

export function buildCourseView(detail: CourseDetail, learner: CourseProgressResponse | null): CourseView {
  const byIndex = new Map(Object.values(detail.lessonData).map((l) => [l.index, l]));
  const progress = learner?.progress ?? {};
  const sections: SectionView[] = [];
  let current: SectionView | undefined;

  for (const el of detail.lessonElements) {
    if (typeof el === "object") {
      current = { title: el.title, durationSeconds: 0, lessonCount: 0, completedLessons: 0, lessons: [] };
      sections.push(current);
      continue;
    }
    const lesson = byIndex.get(el);
    if (!lesson) continue;
    if (!current) {
      current = { title: "", durationSeconds: 0, lessonCount: 0, completedLessons: 0, lessons: [] };
      sections.push(current);
    }
    const view = lessonView(detail.slug, lesson, current.title, progress[lesson.hash]);
    current.lessons.push(view);
    current.lessonCount++;
    current.durationSeconds += view.durationSeconds;
    if (view.status === "completed") current.completedLessons++;
  }

  const lessons = sections.flatMap((s) => s.lessons);
  const durationSeconds = lessons.reduce((acc, l) => acc + l.durationSeconds, 0);
  const lastWatchedMs = Math.max(0, ...Object.values(progress).map((p) => p.lastWatched || 0));

  let courseProgress: CourseProgressSummary | null = null;
  if (learner) {
    courseProgress = {
      percentComplete: percentComplete(lessons),
      completedLessons: lessons.filter((l) => l.status === "completed").length,
      totalLessons: lessons.length,
      remainingSeconds: lessons.reduce((acc, l) => acc + l.remainingSeconds, 0),
      completedDate: learner.completedDate ?? null,
      lastWatched: isoOrNull(lastWatchedMs),
    };
  }

  return {
    slug: detail.slug,
    title: detail.title,
    url: courseUrl(detail.slug),
    instructors: (detail.instructors ?? []).map((i) => i.name),
    datePublished: detail.datePublished ?? null,
    durationSeconds,
    lessonCount: lessons.length,
    resources: detail.resources ?? [],
    progress: courseProgress,
    next: learner ? pickNext(lessons) : (lessons[0] ?? null),
    sections,
  };
}

/** Unfinished lessons from `next` onwards that fit in the budget (always at least one). */
export function lessonsForBudget(view: CourseView, budgetSeconds?: number): LessonView[] {
  const lessons = view.sections.flatMap((s) => s.lessons);
  const start = view.next ? lessons.findIndex((l) => l.slug === view.next!.slug) : -1;
  if (start < 0) return [];
  const pending = lessons.slice(start).filter((l) => l.status !== "completed");
  if (budgetSeconds === undefined) return pending.slice(0, 1);
  const picked: LessonView[] = [];
  let total = 0;
  for (const lesson of pending) {
    if (picked.length > 0 && total + lesson.remainingSeconds > budgetSeconds) break;
    picked.push(lesson);
    total += lesson.remainingSeconds;
  }
  return picked;
}

// ---- Catalog ----

/** Publication date encoded in the thumbnail path, e.g. /assets/courses/2026-01-20-ai-agents-v2/. */
export function catalogDate(thumbnail: string): string | null {
  return thumbnail.match(/\/courses\/(\d{4}-\d{2}-\d{2})-/)?.[1] ?? null;
}

export interface CatalogEntry {
  slug: string;
  title: string;
  url: string;
  date: string | null;
  durationSeconds: number;
  lessonCount: number;
  isFree: boolean;
  summary: string;
}

export function toCatalogEntry(c: CatalogCourse): CatalogEntry {
  return {
    slug: c.slug,
    title: c.title,
    url: courseUrl(c.slug),
    date: catalogDate(c.thumbnail),
    durationSeconds: c.durationSeconds,
    lessonCount: c.lessonCount,
    isFree: c.isFree,
    summary: c.summary,
  };
}

const byDateDesc = (a: CatalogEntry, b: CatalogEntry) => (b.date ?? "").localeCompare(a.date ?? "");

/** Every query word must appear in the title, slug or summary; title hits rank first, then newest. */
export function searchCatalog(entries: CatalogEntry[], query: string): CatalogEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries].sort(byDateDesc);
  const scored: { entry: CatalogEntry; score: number }[] = [];
  for (const entry of entries) {
    const title = entry.title.toLowerCase();
    const slug = entry.slug.toLowerCase();
    const summary = entry.summary.toLowerCase();
    let score = 0;
    let all = true;
    for (const w of words) {
      const hit = (title.includes(w) ? 3 : 0) + (slug.includes(w) ? 2 : 0) + (summary.includes(w) ? 1 : 0);
      if (!hit) {
        all = false;
        break;
      }
      score += hit;
    }
    if (all) scored.push({ entry, score });
  }
  return scored.sort((a, b) => b.score - a.score || byDateDesc(a.entry, b.entry)).map((s) => s.entry);
}
