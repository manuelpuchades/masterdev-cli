# TypeScript on Node ≥ 22.13, compiled with `tsc`; not Bun

The CLI is installed with `npm i -g masterdev-cli`, so it must run where Node runs. Node ≥ 22.13 brings everything the CLI needs without native build steps: `fetch`, `node:sqlite` to read browsers' cookie databases (ADR 0006), `crypto` to decrypt them, and type stripping, so the sources run directly in development while `tsc` builds `dist/` for publishing.

## Considered Options

- **Bun:** built-in SQLite and single-file binaries, but users would need Bun installed, or we would ship per-platform binaries instead of an npm package.
- **Go (like `wallapop-cli`):** single binary, but a separate toolchain for a small personal project.
