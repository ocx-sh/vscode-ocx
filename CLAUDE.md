# CLAUDE.md

Guide Claude Code (claude.ai/code) in this repo.

## What is this

The **OCX VS Code extension** (`ocx-sh.ocx`) surfaces
[OCX](https://github.com/ocx-sh/ocx) inside the editor. OCX is an
OCI-registry-backed binary package manager (Rust CLI `ocx`, configs
`ocx.toml` / `ocx.lock`). The extension composes the project environment via
the `ocx` CLI and injects it into the editor; richer `ocx.toml` authoring,
package browsing, and CLI task running are still planned.

## Current State

**Environment injection + project-lifecycle commands shipped.** Activates on a
workspace `ocx.toml`, shells out to `ocx env`, and injects the composed
`PATH`/vars into the extension host (always) and — opt-in — integrated terminals
(`ocx.env.applyToTerminals`, default off). Ships nine commands: environment
(reload, reset, restartExtensions, showOutput, init) plus project-lifecycle
subcommands that shell out to `ocx` (lock, pull, upgrade, clean). Also a status
bar item, file-watch reload, workspace-trust gating, `ocx.toml` schema
validation, and a configurable group selector (`ocx.groups`, forwarded to
`ocx env`/`ocx pull` as `--group`). Toolchain binaries run via built-in `shell`
tasks (no custom task type) once `ocx.env.applyToTerminals` is on. Planned next:
`ocx.toml`/`ocx.lock` IntelliSense, package/version browsing, status-bar active
versions.

## Rule Catalog

Before a plan, research task, or architectural decision, scan the catalog —
path-scoped rules only auto-load on a matching file edit, so they are not
enough during planning.

@.claude/rules.md

## Build & Development

Build runner is **npm** (not go-task/cargo). Run `npm run` to list scripts
before inventing ad-hoc commands. Common scripts:

| Command | Does |
|---|---|
| `npm install` | Install dependencies (run once after clone) |
| `npm run check-types` | `tsc --noEmit` — type-check only |
| `npm run lint` | ESLint (flat config) |
| `npm run build` | esbuild → `dist/extension.js` (`vscode` external, cjs) |
| `npm run watch` | Rebuild on change (use during F5 debug) |
| `npm run check` | **Full gate** = lint + check-types + build |
| `npm test` | `@vscode/test-cli` (Mocha; downloads + launches VS Code) |
| `npm run package` | `vsce package` → `.vsix` |

**Debug:** press **F5** in VS Code to launch the Extension Development Host.

**Verify before commit.** Run `npm run check` after any implementation change.
The `pre_commit_verification.py` hook blocks `git commit` unless verification
is fresh (5-min sentinel); after `npm run check` passes, stamp it:
`echo $(date +%s) > .claude/hooks/.state/commit-verified`.

## Architecture

A bundled TypeScript extension for the Node extension host.

- Entry point: `src/extension.ts` (exports `activate` / `deactivate`).
- Bundler: **esbuild** → `dist/extension.js` (`vscode` marked external, `cjs`
  format); `tsc --noEmit` type-checks separately.
- Tests: `src/test/**` run via `@vscode/test-cli` (config `.vscode-test.mjs`).
- Manifest: `package.json` — realistic `engines.vscode`, lazy
  `activationEvents`, `contributes`, `main` → bundled `dist`.
- CI: GitHub Actions matrix (ubuntu/macos/windows; Node 20/22), `xvfb` on Linux.

Subsystem rules auto-load on path match. Read the relevant one before working
in that area:

| Subsystem | Rule | Scope |
|---|---|---|
| Extension runtime | [subsystem-extension.md](./.claude/rules/subsystem-extension.md) | `src/**` |
| Build / bundling | [subsystem-build.md](./.claude/rules/subsystem-build.md) | `esbuild.*`, `tsconfig*.json`, `package.json` |
| Tests | [subsystem-tests.md](./.claude/rules/subsystem-tests.md) | `src/test/**`, `.vscode-test.mjs` |
| CI / publishing | [subsystem-ci.md](./.claude/rules/subsystem-ci.md) | `.github/workflows/**` |

## Core Principles

These eight principles distill every rule, skill, and standard. Deep dive:
[`quality-core.md`](./.claude/rules/quality-core.md) (SOLID/DRY/KISS/YAGNI).

### 1. Understand First
Read before write. Grep before create. Never modify unread code — grep all
callers before changing a function.

### 2. Prove It Works
Tests for the user-facing case first. Run before commit. Regression test per
bug fix. All gates pass — lint, types, build, tests (`npm run check` + `npm test`).

### 3. Keep It Safe
No secrets in code — env vars / secret managers. Never commit a Marketplace
(`VSCE_PAT`) or Open VSX (`OVSX_PAT`) token. Validate external input. Least
privilege. Flag vulnerabilities immediately.

### 4. Keep It Simple
Small functions, single responsibility. No premature abstraction — three
similar lines beat a bad helper. Delete dead code. Avoid `any`. Fix warnings.
Comments explain *why*, never *what*.

### 5. Don't Repeat Yourself
Check `.claude/skills/` before ad-hoc work. Follow existing patterns. Single
source of truth for logic. Extract on real duplication, not incidental.

### 6. Ship It
Work on a branch, never `main`. Commit iteratively. **Never push to remote** —
the human decides. Push triggers CI, which has real cost.

### 7. Leave a Trail
Planning artifacts → `./.claude/artifacts/`. ADRs for architectural decisions.
Name things so the next person understands.

### 8. Learn and Adapt
On user feedback or corrections, evaluate whether the insight should persist as
an AI-config update (rules/skills/agents) — not just memory.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
`refactor:`, `ci:`, `chore:`, `docs:`, `test:`, `perf:`, `build:`, `style:`.
The `conventional_commit_validator.py` hook enforces the format. Use `chore:`
for AI-config / tooling changes. No `Co-Authored-By` trailers.

## Skills & Personas

Persona + task skills live in `.claude/skills/`. Check before ad-hoc work:

- **`/architect`** — design before building; produce a plan/ADR.
- **`/builder`** — implement against a plan, following quality rules.
- **`/qa-engineer`** — write/extend tests; prove the user-facing case.
- **`/code-check`** — quality audit of the current diff.
- **`/commit`** — stage + write a conventional commit.
- **`/add-tech-specialist`** — scaffold a per-technology specialist (see below).

## Per-technology specialists

The **specialist trio** — a language/tech quality rule
(`.claude/rules/quality-<tech>.md`), an agent that reviews against it, and the
catalog entry that makes it discoverable — captures deep, reusable knowledge for
one technology (e.g. TypeScript, esbuild). Run **`/add-tech-specialist`** to
scaffold a new trio when adopting a technology that warrants dedicated guidance.

## Starting Work

1. Classify the work: feature / bugfix / refactor.
2. Check GitHub for related issues/PRs.
3. Scan [`.claude/rules.md`](./.claude/rules.md) for relevant rules.
4. Read the subsystem rule for the paths you'll touch.
5. Plan (`/architect`) → implement (`/builder`) → test (`/qa-engineer`) →
   audit (`/code-check`) → commit (`/commit`).
