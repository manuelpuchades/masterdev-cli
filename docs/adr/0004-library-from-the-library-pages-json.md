# The Library comes from the library pages' JSON, not from walking every Course

There is no "my courses" endpoint in the API. The pages `master.dev/my-account/library/{started,completed,bookmarked}/` return their data as JSON when asked with `Accept: application/json` (the same request their own script makes), paginated with `_page` and `_limit`. Each item already has the Course's percent complete, last Lesson, completion and bookmark, so `progress` costs one request per category.

`session/<slug>` (Course progress) is then read only for the Courses a command needs in detail (`course`, `next`).

## Considered Options

- **Read `session/<slug>` for every Course in the Catalog:** 400+ requests to find a handful of Started Courses; impolite (ADR 0008) and slow.
- **Parse the server-rendered HTML** (`window._bs.paginatorData`): works too, but breaks on any markup change; kept only as a fallback idea.
