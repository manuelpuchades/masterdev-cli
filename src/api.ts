import { HOUR, MINUTE, cached } from "./cache.ts";
import { renewCookie, storedCookie } from "./auth/credentials.ts";
import { CliError, LOGIN_HINT } from "./errors.ts";
import { getJson } from "./http.ts";
import type { CatalogCourse, CourseDetail, CourseProgressResponse, LibraryCategory, LibraryCourse } from "./model.ts";
import { API, SITE } from "./paths.ts";

// Master.dev reads (ADR 0003, 0004). Public data is cached for a day; account data for two
// minutes, so a Lesson watched a moment ago shows up on the next call (ADR 0008).

const PUBLIC_TTL = 24 * HOUR;
const ACCOUNT_TTL = 2 * MINUTE;
const MAX_LIBRARY_PAGES = 20;

interface LibraryPage {
  data: { courses: LibraryCourse[] };
  meta: { childMeta: { courses: { paging: { currentPage: number; totalPages: number } } } };
}

// `user.status` is 1 for a signed-in learner; anonymous visitors get an empty `user` with status 0.
type RawProgress = CourseProgressResponse & { user?: { status?: number } | null };

export interface ApiOptions {
  fresh?: boolean;
  /** Use this cookie instead of the stored one, without renewing (to validate a new login). */
  cookie?: string;
}

export class MasterDevApi {
  private readonly fresh: boolean;
  private readonly fixedCookie: string | undefined;

  constructor(opts: ApiOptions = {}) {
    this.fresh = !!opts.fresh;
    this.fixedCookie = opts.cookie;
  }

  catalog(): Promise<CatalogCourse[]> {
    return cached("catalog", PUBLIC_TTL, () => getJson<CatalogCourse[]>(`${API}/courses?limit=9999`), { fresh: this.fresh });
  }

  courseDetail(slug: string): Promise<CourseDetail> {
    const url = `${API}/courses/${encodeURIComponent(slug)}`;
    return cached(`course-${slug}`, PUBLIC_TTL, () => getJson<CourseDetail>(url), { fresh: this.fresh });
  }

  courseProgress(slug: string): Promise<CourseProgressResponse> {
    return cached(`user-progress-${slug}`, ACCOUNT_TTL, () => this.signedIn((cookie) => fetchCourseProgress(slug, cookie)), { fresh: this.fresh });
  }

  library(category: LibraryCategory): Promise<LibraryCourse[]> {
    return cached(`user-library-${category}`, ACCOUNT_TTL, () => this.signedIn((cookie) => fetchLibrary(category, cookie)), { fresh: this.fresh });
  }

  /** Runs a signed-in read; when the session has expired, renews it once and retries. */
  private async signedIn<T>(read: (cookie: string) => Promise<T>): Promise<T> {
    if (this.fixedCookie) return read(this.fixedCookie);
    const stored = storedCookie();
    if (!stored) throw new CliError("auth_required", "Not signed in to Master.dev.", LOGIN_HINT);
    try {
      return await read(stored.cookie);
    } catch (err) {
      if (!(err instanceof CliError) || err.code !== "auth_required") throw err;
      const renewed = await renewCookie();
      if (!renewed) throw err;
      return read(renewed);
    }
  }
}

async function fetchCourseProgress(slug: string, cookie: string): Promise<CourseProgressResponse> {
  const raw = await getJson<RawProgress>(`${API}/session/${encodeURIComponent(slug)}`, cookie);
  // This endpoint answers 200 to anonymous visitors too, so the status is the only signal.
  if (!raw.user?.status) throw new CliError("auth_required", "The Master.dev session expired.", LOGIN_HINT);
  const { user: _personalData, ...progress } = raw;
  return { ...progress, progress: progress.progress ?? {} };
}

async function fetchLibrary(category: LibraryCategory, cookie: string): Promise<LibraryCourse[]> {
  const courses: LibraryCourse[] = [];
  for (let page = 1; page <= MAX_LIBRARY_PAGES; page++) {
    const url = `${SITE}/my-account/library/${category}/?_limit=50&_page=${page}`;
    const res = await getJson<LibraryPage>(url, cookie);
    courses.push(...res.data.courses);
    const paging = res.meta?.childMeta?.courses?.paging;
    if (!paging || paging.currentPage >= paging.totalPages || res.data.courses.length === 0) break;
  }
  return courses;
}
