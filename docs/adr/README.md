# Architecture Decision Records

One file per significant decision: hard to reverse, surprising without context, or the result of a real trade-off. Numbered sequentially, never renumbered. A superseded ADR stays and gets `Status: superseded by ADR-NNNN`.

| #                                                      | Decision                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [0001](0001-json-first-output-for-agents.md)           | JSON-first output, with stable exit codes, for agents                                        |
| [0002](0002-read-only-against-master-dev.md)           | Read-only against Master.dev; any state of our own stays local                               |
| [0003](0003-master-dev-private-web-api.md)             | Master.dev's private web API at `api.master.dev/v2/kabuki`, never the frozen v1             |
| [0004](0004-library-from-the-library-pages-json.md)    | The Library comes from the library pages' JSON, not from walking every Course                |
| [0005](0005-typescript-on-node.md)                     | TypeScript on Node ≥ 22.13, compiled with `tsc`; not Bun                                     |
| [0006](0006-session-cookie-from-three-login-methods.md) | The session cookie, obtained by Browser import, Password login or a Pasted cookie            |
| [0007](0007-secrets-in-the-os-keychain.md)             | Secrets in the OS keychain, with a 0600 file fallback                                        |
| [0008](0008-polite-client-with-a-local-cache.md)       | A polite client: sequential, throttled requests and a local cache                            |
| [0009](0009-next-lesson-and-completed-lessons.md)      | Next lesson after the furthest Completed lesson; completed means marked or ≥ 95 % viewed     |
| [0010](0010-percent-complete-matches-master-dev.md)    | A Course's percent complete is Master.dev's figure, not a share of Completed lessons         |
| [0011](0011-local-plan-completed-by-master-dev.md)     | The Plan is a local file whose items are done when Master.dev shows them completed           |
