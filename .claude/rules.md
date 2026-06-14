# OCX VS Code Extension — Rule Catalog

Entry point for `.claude/rules/`. Path-scoped rules fire only on a matching file edit — not enough during planning, research, or architecture before code exists. This catalog is the map you read in those phases.

## When to consult this catalog

- Plan/architecture phase — scan "By concern" before drafting
- Research phase — find the quality criteria for a topic
- Onboarding a new area — scan "By subsystem" / "By language"
- Writing ADRs, RFCs, research artifacts — find relevant rules
- Updating AI config — see the "AI config changes" row in "By concern"

When editing code, the relevant rule auto-loads via its `paths:` glob — no need to re-read it from here. The catalog is for the cases where path-scoping cannot fire.

## How to update this catalog

Any change to `.claude/rules/` must be reflected here in the **same commit** (see `meta-ai-config.md`):

- New rule → add a row in the relevant tables below
- Deleted rule → remove all references
- Changed `paths:` glob → update the "By auto-load path" table
- New skill → add an entry in "Skills by task topic"
- Global-rule set changed → update the "Globals" footer (the three-global invariant)

## By concern — "if you care about X, consult these"

| Concern | Rules & skills |
|---|---|
| Product vision / scope / who it's for | [product-context.md](./rules/product-context.md) — canonical identity doc (Update Protocol at bottom) |
| Tech choices / adopting a tool or library | [product-tech-strategy.md](./rules/product-tech-strategy.md), `quality-typescript.md`, skill `add-tech-specialist` |
| Designing a feature / architecture decision | [arch-principles.md](./rules/arch-principles.md), skill `architect` |
| Implementing / wiring extension behavior | [subsystem-extension.md](./rules/subsystem-extension.md), [tech-vscode-api.md](./rules/tech-vscode-api.md), skill `builder` |
| Deep VS Code API questions | [tech-vscode-api.md](./rules/tech-vscode-api.md), agent `specialist-vscode-api` |
| Bundling / build / packaging | [subsystem-build.md](./rules/subsystem-build.md), [tech-esbuild.md](./rules/tech-esbuild.md), agent `specialist-esbuild` |
| Writing tests | [subsystem-tests.md](./rules/subsystem-tests.md), skill `qa-engineer` |
| CI / workflows / release / publishing | [subsystem-ci.md](./rules/subsystem-ci.md), [workflow-git.md](./rules/workflow-git.md) |
| Commits, branches, landing on main | [workflow-git.md](./rules/workflow-git.md), skill `commit` |
| Code quality audit | [quality-core.md](./rules/quality-core.md), [quality-typescript.md](./rules/quality-typescript.md), skill `code-check` |
| AI config changes | [meta-ai-config.md](./rules/meta-ai-config.md) + this catalog |
| Adding a new technology specialist (rule+agent+skill) | [meta-ai-config.md](./rules/meta-ai-config.md), skill `add-tech-specialist` |

## By language

| Language | Quality rule | Related |
|---|---|---|
| TypeScript | [quality-typescript.md](./rules/quality-typescript.md) | [quality-core.md](./rules/quality-core.md), [arch-principles.md](./rules/arch-principles.md), [subsystem-build.md](./rules/subsystem-build.md) |
| All languages (universal) | [quality-core.md](./rules/quality-core.md) | — |

## By subsystem

| Subsystem | Rule | Path scope |
|---|---|---|
| Extension wiring (entry, commands, lifecycle) | [subsystem-extension.md](./rules/subsystem-extension.md) | `src/**` |
| Architecture principles | [arch-principles.md](./rules/arch-principles.md) | `src/**` |
| VS Code API (specialist) | [tech-vscode-api.md](./rules/tech-vscode-api.md) | `src/**` |
| Build & bundle | [subsystem-build.md](./rules/subsystem-build.md) | `esbuild.js`, `**/tsconfig*.json`, `.vscodeignore` |
| esbuild (specialist) | [tech-esbuild.md](./rules/tech-esbuild.md) | `esbuild.js` |
| Tests | [subsystem-tests.md](./rules/subsystem-tests.md) | `src/test/**`, `.vscode-test.*` |
| CI / workflows | [subsystem-ci.md](./rules/subsystem-ci.md) | `.github/**` |
| Git workflow | [workflow-git.md](./rules/workflow-git.md) | `.github/**`, `CHANGELOG.md` |
| AI config | [meta-ai-config.md](./rules/meta-ai-config.md) | `.claude/**` |

## By auto-load path — "what fires when you edit"

| Edit path | Rules that auto-load |
|---|---|
| `**/*.ts`, `**/*.tsx`, `**/*.mts`, `**/*.cts`, `**/tsconfig*.json` | [quality-typescript.md](./rules/quality-typescript.md) |
| `src/**` | + [arch-principles.md](./rules/arch-principles.md), [subsystem-extension.md](./rules/subsystem-extension.md), [tech-vscode-api.md](./rules/tech-vscode-api.md) (and `quality-typescript.md` on `.ts`) |
| `src/test/**` | + [subsystem-tests.md](./rules/subsystem-tests.md) |
| `.vscode-test.*` | [subsystem-tests.md](./rules/subsystem-tests.md) |
| `esbuild.js` | [subsystem-build.md](./rules/subsystem-build.md), [tech-esbuild.md](./rules/tech-esbuild.md) |
| `**/tsconfig*.json`, `.vscodeignore` | [subsystem-build.md](./rules/subsystem-build.md) (+ `quality-typescript.md` on `tsconfig*.json`) |
| `.github/**` | [subsystem-ci.md](./rules/subsystem-ci.md), [workflow-git.md](./rules/workflow-git.md) |
| `CHANGELOG.md` | [workflow-git.md](./rules/workflow-git.md) |
| `.claude/**` | [meta-ai-config.md](./rules/meta-ai-config.md) |

Globals (always loaded, no `paths:` frontmatter — exactly **three**):
[quality-core.md](./rules/quality-core.md), [product-tech-strategy.md](./rules/product-tech-strategy.md), [product-context.md](./rules/product-context.md).
(`CLAUDE.md` and this catalog also always reach Claude, but by direct load / `@`-import, not via the path-scope layer.)

## Declared Path-Scope Overlaps

Rules that intentionally share a `paths:` scope (expected coupling, not drift):

| Declared group | Shared scope |
|---|---|
| `arch-principles.md` + `subsystem-extension.md` + `tech-vscode-api.md` | `src/**` (architecture + wiring + API specialist co-fire on source edits) |
| `subsystem-build.md` + `tech-esbuild.md` | `esbuild.js` (build invariants + esbuild specialist) |
| `subsystem-ci.md` + `workflow-git.md` | `.github/**` (CI patterns + commit/branch hygiene) |
| `quality-typescript.md` + `subsystem-build.md` | `**/tsconfig*.json` (shareable language rule co-fires with the build rule) |

## Per-Technology Specialist Trio Convention

For each significant technology, a **trio** keeps deep knowledge discoverable in every mode (see `meta-ai-config.md`):

- **Rule** `tech-<name>.md` (path-scoped, source-cited) — auto-loads when editing relevant files
- **Agent** `specialist-<name>.md` — carries the expertise into delegated tasks
- **Skill** (optional) — when there's a repeatable workflow

| Technology | Rule | Agent |
|---|---|---|
| VS Code Extension API | [tech-vscode-api.md](./rules/tech-vscode-api.md) | `specialist-vscode-api` |
| esbuild | [tech-esbuild.md](./rules/tech-esbuild.md) | `specialist-esbuild` |

The **`/add-tech-specialist`** skill scaffolds a new trio (e.g. for Solr, when the extension grows to query a Solr index).

## Agents

| Agent | Role |
|---|---|
| `worker-explorer` | Lightweight read-only codebase exploration |
| `worker-builder` | Implementation / debugging |
| `worker-architect` | Architecture / design decisions |
| `worker-reviewer` | Adversarial code review |
| `specialist-vscode-api` | Deep VS Code Extension API expertise (trio with `tech-vscode-api.md`) |
| `specialist-esbuild` | Deep esbuild expertise (trio with `tech-esbuild.md`) |

## Skills by task topic

| Task topic | Skill |
|---|---|
| Architecture decision | `architect` |
| Implementation / debugging | `builder` |
| Test strategy | `qa-engineer` |
| Code quality audit | `code-check` |
| Commits | `commit` |
| Add a new technology specialist (rule + agent + skill) | `add-tech-specialist` |
