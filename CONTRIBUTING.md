# Contributing to OCX for VS Code

Thanks for helping improve the OCX VS Code extension. This guide covers the
development setup, the build/test workflow, and the conventions PRs are expected
to follow.

## Prerequisites

- **Node.js 20+** (CI tests on Node 20 and 22).
- The **`ocx` CLI** installed and on `PATH` (or point `ocx.path.executable` at
  it). Some integration tests stub the binary, but manual testing needs a real
  `ocx`.

## Setup

```sh
npm install
```

## Develop

Press <kbd>F5</kbd> in VS Code to launch the **Extension Development Host** with
the extension loaded, then run **OCX: Reload Environment** from the Command
Palette. Run `npm run watch` alongside so the bundle rebuilds on save.

| Script | Purpose |
| --- | --- |
| `npm run build` | Bundle `src/extension.ts` → `dist/extension.js` via esbuild |
| `npm run watch` | Rebuild on change (use during F5 debugging) |
| `npm run check-types` | `tsc --noEmit` (esbuild does not type-check) |
| `npm run lint` | ESLint (flat config) |
| `npm run check` | Full gate: lint + type-check + build |
| `npm test` | `@vscode/test-cli` integration tests (downloads VS Code) |
| `npm run package` | Build a `.vsix` with `vsce` |

## Verify before you commit

Run the full gate and the tests:

```sh
npm run check
npm test
```

On **headless Linux**, the tests need a display server:

```sh
xvfb-run -a npm test
```

macOS and Windows runners do not need `xvfb`.

## Project layout

- `src/extension.ts` — entry point (`activate`/`deactivate`); thin wiring only.
- `src/*.ts` — services and adapters (`ocx` CLI integration, environment
  composition, config, status bar). Keep `vscode`-free logic in its own modules
  so it stays unit-testable.
- `src/test/**` — tests run inside a real VS Code via `@vscode/test-electron`
  (`.vscode-test.mjs`); pure logic is unit-tested standalone.
- `dist/` — the shipped esbuild bundle (CJS, `vscode` external). `out/` holds
  compiled tests and is excluded from the `.vsix`.
- `.claude/` + `CLAUDE.md` — the project's engineering rules and AI-assistant
  configuration. Read the relevant rule before working in an area.

## Architecture principles

- **Thin `activate()`** — register commands/listeners and push disposables; no
  heavy or blocking work.
- **Never block the host** — async APIs only; no `execSync` or sync I/O on the
  extension-host event loop.
- **Shell out, don't reimplement** — wrap the real `ocx` binary via `execFile`
  (no shell); never duplicate package-manager logic in TypeScript.
- **Dispose everything** — push every disposable to `context.subscriptions`.

## Commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `refactor:`, `ci:`, `chore:`, `docs:`, `test:`, `perf:`,
`build:`, `style:`. Use `chore:` for tooling/AI-config changes. Don't add
`Co-Authored-By` trailers. The changelog is generated from commit history, so
write the subject for the reader.

## Pull requests

1. Branch off `main` (`feat/…`, `fix/…`, …).
2. Keep changes focused; add tests for the user-facing behavior and a regression
   test for each bug fix.
3. Ensure `npm run check` and `npm test` pass locally.
4. Open a PR against `main`. CI runs a matrix of ubuntu/macOS/Windows × Node
   20/22.

## Roadmap

Planned capabilities, roughly by value (see
[`.claude/rules/product-context.md`](.claude/rules/product-context.md) for the
canonical scope):

1. **`ocx.toml` / `ocx.lock` authoring** — schema-driven IntelliSense
   (completion, hover, diagnostics), plus config-mutating commands (`ocx add` /
   `ocx remove`) once the authoring UX exists.
2. **Package & version browsing** — a tree view of known packages and available
   versions from the registry/index.
3. **Status bar active versions** — show the active project's selected tool
   versions in the status bar.

Out of scope: a Docker/OCI registry UI, reimplementing `ocx` logic in
TypeScript, bundling the `ocx` binary, and telemetry beyond VS Code's defaults.
