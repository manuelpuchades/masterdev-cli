import type { CatalogReport, CourseReport, LibraryItem, NextReport, PlanReport, ProgressReport } from "./commands.ts";
import type { PlanItemView } from "./plan.ts";
import type { LessonStatus, LessonView } from "./model.ts";

// `--pretty` views for humans. Agents read the JSON.

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (seconds > 0 && minutes === 0) return "<1m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const STATUS_MARK: Record<LessonStatus, string> = { completed: "✓", in_progress: "▶", not_started: "·" };

function lessonLine(l: LessonView): string {
  const extra = l.status === "in_progress" ? ` (${l.percentViewed}% viewed${l.resumeAt ? `, resume at ${l.resumeAt}` : ""})` : "";
  return `  ${STATUS_MARK[l.status]} ${l.title} — ${formatDuration(l.durationSeconds)}${extra}`;
}

function libraryLine(c: LibraryItem): string {
  const pct = `${c.percentComplete.toFixed(0)}%`.padStart(4);
  const when = c.lastWatchedAgo ? ` · ${c.lastWatchedAgo}` : "";
  return `  ${pct}  ${c.title} (${c.instructor})${when}\n        ${c.continueUrl}`;
}

export function renderProgress(report: ProgressReport): string {
  const titles = { started: "Started", completed: "Completed", bookmarked: "Bookmarked" } as const;
  return (Object.keys(titles) as (keyof typeof titles)[])
    .filter((k) => report[k])
    .map((k) => {
      const items = report[k]!;
      return `${titles[k]} (${items.length})\n${items.length ? items.map(libraryLine).join("\n") : "  —"}`;
    })
    .join("\n\n");
}

export function renderCourse(c: CourseReport): string {
  const lines = [`${c.title} — ${c.instructors.join(", ")}`, c.url];
  if (c.progress) {
    const p = c.progress;
    lines.push(`${p.percentComplete}% · ${p.completedLessons}/${p.totalLessons} lessons · ${formatDuration(p.remainingSeconds)} left of ${formatDuration(c.durationSeconds)}`);
  } else {
    lines.push(`${c.lessonCount} lessons · ${formatDuration(c.durationSeconds)}${c.signedIn ? "" : " · not signed in"}`);
  }
  for (const s of c.sections) {
    lines.push("", `${s.title} (${s.completedLessons}/${s.lessonCount}, ${formatDuration(s.durationSeconds)})`);
    lines.push(...s.lessons.map(lessonLine));
  }
  if (c.next) lines.push("", `Next: ${c.next.title}`, `  ${c.next.url}`);
  return lines.join("\n");
}

export function renderNext(r: NextReport): string {
  if (r.picks.length === 0) return "Nothing to watch next: no started course with unfinished lessons.";
  return r.picks
    .map((p) => {
      const pct = p.course.percentComplete === null ? "" : ` (${p.course.percentComplete}%)`;
      const lessons = p.lessons.map((l) => `${lessonLine(l)}\n      ${l.url}`);
      return [`${p.course.title}${pct}`, ...lessons, `  Total: ${formatDuration(p.totalSeconds)}`].join("\n");
    })
    .join("\n\n");
}

export function renderCatalog(r: CatalogReport): string {
  const header = `${r.total} course${r.total === 1 ? "" : "s"}${r.query ? ` matching "${r.query}"` : ""}${r.courses.length < r.total ? `, showing ${r.courses.length}` : ""}`;
  const rows = r.courses.map((c) => {
    const mark = c.status === "completed" ? "✓" : c.status === "started" ? `▶ ${c.percentComplete}%` : "";
    return `  ${c.date ?? "          "}  ${c.title} — ${formatDuration(c.durationSeconds)} ${mark}\n              ${c.url}`;
  });
  return [header, ...rows].join("\n");
}

function planLine(i: PlanItemView): string {
  const mark = i.done ? "✓" : i.status ? STATUS_MARK[i.status] : "?";
  const what = i.lesson ? `${i.lesson.title} — ${i.course.title}` : i.kind === "lesson" ? `${i.id} (no longer in the course)` : i.course.title;
  const left = i.done ? "" : i.lesson ? ` · ${formatDuration(i.lesson.remainingSeconds)} left` : i.course.remainingSeconds !== null ? ` · ${formatDuration(i.course.remainingSeconds)} left` : "";
  const lines = [`  ${mark} ${what}${left}`, `      ${i.lesson?.url ?? i.course.url}`];
  if (i.note) lines.push(`      ${i.note}`);
  return lines.join("\n");
}

export function renderPlan(r: PlanReport): string {
  if (r.items.length === 0) return "The plan is empty. Add something with `masterdev plan add <link>`.";
  const header = `Plan: ${r.pending} pending, ${r.done} done${r.signedIn ? "" : " · not signed in, statuses unknown"}`;
  return [header, ...r.items.map(planLine)].join("\n");
}
