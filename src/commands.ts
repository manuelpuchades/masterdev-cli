import type { MasterDevApi } from "./api.ts";
import { CliError } from "./errors.ts";
import {
  buildCourseView,
  courseUrl,
  lessonUrl,
  lessonsForBudget,
  searchCatalog,
  toCatalogEntry,
  type CatalogEntry,
  type CourseView,
  type LessonView,
  type LibraryCategory,
  type LibraryCourse,
} from "./model.ts";

// What each command prints. Field names here are the CLI's public contract (ADR 0001).

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface LibraryItem {
  slug: string;
  title: string;
  instructor: string;
  url: string;
  continueUrl: string;
  percentComplete: number;
  isCompleted: boolean;
  isBookmarked: boolean;
  lastWatchedAgo: string | null;
  quizScore: number;
}

export type ProgressReport = Partial<Record<LibraryCategory, LibraryItem[]>>;

function toLibraryItem(c: LibraryCourse): LibraryItem {
  return {
    slug: c.slug,
    title: c.title,
    instructor: c.teacherName,
    url: courseUrl(c.slug),
    continueUrl: c.lastLessonSlug ? lessonUrl(c.slug, c.lastLessonSlug) : courseUrl(c.slug),
    percentComplete: round1(c.percentComplete),
    isCompleted: c.isCompleted,
    isBookmarked: c.isBookmarked,
    lastWatchedAgo: c.timeSinceLastWatchedString ? `${c.timeSinceLastWatchedString} ago` : null,
    quizScore: c.quizScore,
  };
}

export async function progressReport(api: MasterDevApi, categories: LibraryCategory[]): Promise<ProgressReport> {
  const report: ProgressReport = {};
  for (const category of categories) {
    report[category] = (await api.library(category)).map(toLibraryItem);
  }
  return report;
}

export type CourseReport = CourseView & { signedIn: boolean };

export async function courseReport(api: MasterDevApi, slug: string, withLessons: boolean): Promise<CourseReport> {
  const detail = await api.courseDetail(slug);
  let signedIn = true;
  let progress = null;
  try {
    progress = await api.courseProgress(slug);
  } catch (err) {
    if (!(err instanceof CliError) || err.code !== "auth_required") throw err;
    signedIn = false;
  }
  const view = buildCourseView(detail, progress);
  if (!withLessons) view.sections = view.sections.map((s) => ({ ...s, lessons: [] }));
  return { signedIn, ...view };
}

export interface NextPick {
  course: { slug: string; title: string; url: string; percentComplete: number | null; remainingSeconds: number | null };
  lessons: LessonView[];
  totalSeconds: number;
}

export interface NextReport {
  budgetSeconds: number | null;
  picks: NextPick[];
}

export interface NextOptions {
  course?: string;
  minutes?: number;
  all?: boolean;
}

export async function nextReport(api: MasterDevApi, opts: NextOptions): Promise<NextReport> {
  const budgetSeconds = opts.minutes === undefined ? null : Math.round(opts.minutes * 60);
  const slugs = opts.course ? [opts.course] : (await api.library("started")).map((c) => c.slug);
  const picks: NextPick[] = [];

  for (const slug of slugs) {
    const view = buildCourseView(await api.courseDetail(slug), await api.courseProgress(slug));
    const lessons = lessonsForBudget(view, budgetSeconds ?? undefined);
    if (lessons.length === 0 && !opts.course) continue;
    picks.push({
      course: {
        slug: view.slug,
        title: view.title,
        url: view.url,
        percentComplete: view.progress?.percentComplete ?? null,
        remainingSeconds: view.progress?.remainingSeconds ?? null,
      },
      lessons,
      totalSeconds: lessons.reduce((acc, l) => acc + l.remainingSeconds, 0),
    });
    if (!opts.all) break;
  }
  return { budgetSeconds, picks };
}

export type CatalogItem = CatalogEntry & { status: "started" | "completed" | null; percentComplete: number | null };

export interface CatalogReport {
  query: string;
  total: number;
  signedIn: boolean;
  courses: CatalogItem[];
}

export async function catalogReport(api: MasterDevApi, query: string, limit: number): Promise<CatalogReport> {
  const matches = searchCatalog((await api.catalog()).map(toCatalogEntry), query);

  const mine = new Map<string, { status: "started" | "completed"; percentComplete: number }>();
  let signedIn = true;
  try {
    for (const category of ["started", "completed"] as const) {
      for (const c of await api.library(category)) mine.set(c.slug, { status: category, percentComplete: round1(c.percentComplete) });
    }
  } catch (err) {
    if (!(err instanceof CliError) || err.code !== "auth_required") throw err;
    signedIn = false;
  }

  const courses = matches.slice(0, limit).map((entry) => {
    const own = mine.get(entry.slug);
    return { ...entry, status: own?.status ?? null, percentComplete: own?.percentComplete ?? null };
  });
  return { query, total: matches.length, signedIn, courses };
}
