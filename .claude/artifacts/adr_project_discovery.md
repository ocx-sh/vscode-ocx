# ADR: Project File Discovery as a Single-Source-of-Truth Locator

## Metadata

**Status:** Accepted
**Date:** 2026-06-19
**Deciders:** Architect (/architect), Michael Herwig
**Issue:** N/A
**Related PRD:** N/A
**Tech Strategy Alignment:**
- [x] Follows Golden Path in `product-tech-strategy.md` (thin editor surface; no `ocx` logic reimplemented)
- [x] Stays inside `product-context.md` scope (env/status surfacing over the CLI)
**Domain Tags:** activation | api | configuration | commands
**Supersedes:** N/A
**Superseded By:** N/A
**Related:** commit `e561052` (root-anchored discovery fix — this ADR generalizes it; Phase 2 partially reverses its activation narrowing)

## Context

`e561052` fixed the *symptom* (nested `ocx.toml` wrongly chosen) by anchoring
discovery to the workspace-folder root. It did not fix the *structure*. The
discovery rule is **encoded in three independent places** that must agree by hand:

| Site | File | Encodes |
|---|---|---|
| Activation event | `package.json:31` `workspaceContains:ocx.toml` | "a project exists at a folder root" |
| Discovery | `src/extension.ts:228` `findProjectToml()` | "the project file is `<root>/ocx.toml`" |
| Watcher | `src/extension.ts:181` `RelativePattern(folder, '{ocx.toml,ocx.lock}')` | "watch `<root>/ocx.toml`+`ocx.lock`" |

On top of that, the literals `ocx.toml` / `ocx.lock` are **hard-coded in ~8
sites** (`extension.ts` watcher/discovery/init/error, `environment.ts` description,
`status.ts` tooltip, `package.json` activation + `jsonValidation.fileMatch`,
plus doc comments). There is **no single routine** that answers "what is the
project, and where are its files?", and **no `ocx.project` setting** today.

**The edge case the review raised is real.** If a user could point the extension
at a non-root project file (e.g. `packages/app/ocx.toml`) via a setting, with the
current structure:

1. **The extension would not activate** — `workspaceContains:ocx.toml` is a
   root-only existence check (confirmed against VS Code source `workspaceContains.ts`:
   a glob-free pattern routes to `_activateIfFileName`, joining the literal to each
   folder root). A nested configured path never triggers it.
2. **The watcher would not watch it** — it is pinned to folder roots at activation,
   independent of any configured path.
3. **Discovery would not find it** — `findProjectToml()` only stats `<root>/ocx.toml`.

So three sites would silently disagree with the configured intent. This is a
separation-of-concerns defect, not just missing config.

## Decision Drivers

- **Single source of truth** — the discovery rule (filenames + location precedence)
  defined once; activation, watcher, and `--project` all derive from it.
- **Correctness under a configured/selected project path** — activation, watching,
  and resolution must stay consistent when the project is not at a folder root.
- **Activation latency** (`arch-principles.md`) — no eager `*`; keep activation a
  cheap manifest trigger.
- **Scope discipline / YAGNI** (`product-context.md`, `quality-core.md`) — a public
  setting is near-irreversible API; do not ship speculative configuration.
- **Reversibility** — internal refactor is free to reverse; the activation glob and
  any new setting are the sticky parts.
- **VS Code constraint** — the static manifest cannot read runtime config, so
  activation can only ever *over-approximate* a dynamic project location.

## Industry Context & Research

**Research artifact:** [`research_vscode_extension_sota.md`](./research_vscode_extension_sota.md)
**Trending approaches:** Config-driven tool extensions (ESLint, Prettier, direnv-vscode,
rust-analyzer) centralize "where is the project root / config file" in **one resolver**
and expose an optional override setting (`eslint.workingDirectories`,
`rust-analyzer.linkedProjects`, `prettier.configPath`). They activate broadly
(`onLanguage` / `workspaceContains:**/<file>`) and let the resolver decide precisely —
activation breadth is intentionally a superset of selection.
**Key insight:** activation should answer "*might* there be work here?" (cheap, static,
over-approximate); a runtime locator answers "*what exactly* is the project?" (precise,
config-aware). Collapsing the two — as the codebase does now — is what breaks under a
configured path.

## Considered Options

### Option 1: Status quo (leave as-is)

**Description:** Keep the three encodings and scattered literals; revisit only if a
config setting is ever requested.

| Pros | Cons |
|------|------|
| Zero effort | Triple-encoded rule keeps drifting (the `e561052` fix had to touch all three by hand) |
| Matches current root-only scope | Any future project-path/picker work is a cross-cutting rewrite, not a localized add |
| | The reviewer's edge case stays a latent trap |

### Option 2: Constants module only

**Description:** Extract `PROJECT_FILE`/`LOCK_FILE` constants; replace the literals.
Leave activation/discovery/watcher wiring where it is.

| Pros | Cons |
|------|------|
| Kills the stringly-typed literals (low risk) | Does **not** fix the triple-encoded *rule* |
| Tiny diff | Watcher still can't follow a configured path; activation still root-only |
| | Half-measure — re-touches the same files again when config lands |

### Option 3: `ProjectLocator` as single source of truth (recommended)

**Description:** A small `src/project.ts` owning the filename constants, a `ProjectRef`
value object, and a `ProjectLocator` (Disposable) that: resolves the active project by a
single precedence rule, **derives its own watcher** from that rule's search space, and
emits `onDidChange` when the resolved project appears/disappears/moves. `extension.ts`
loses all filename/glob/watcher knowledge and just subscribes → reload. Delivered in two
phases; Phase 2 is gated on a product decision.

| Pros | Cons |
|------|------|
| One definition feeds discovery, watcher, and `--project` | New module + a small class (more structure) |
| Watcher follows the configured/selected path by construction | Phase 2 broadens activation (re-adds nested-only activation as a no-op) |
| Makes the roadmap picker (`findAllProjectTomls`) a localized add | A `ocx.project` setting is near-irreversible API → must gate |
| `extension.ts` shrinks to orchestration; testable resolver in isolation | |

### Option 4: Delegate discovery to the `ocx` CLI

**Description:** Drop `--project`; run `ocx env` from a cwd and let `ocx` walk up to find
`ocx.toml`.

| Pros | Cons |
|------|------|
| No discovery logic in the extension | Multi-root workspace has no single cwd |
| Always matches CLI semantics | The **watcher still needs a concrete path** — CLI delegation doesn't remove the core problem |
| | Loses control over which project is active when several exist |

## Decision Outcome

**Chosen Option:** **Option 3** — both phases approved (decision 2026-06-19). Phase 1
lands first as a behavior-preserving refactor; Phase 2 (the `ocx.project` setting +
broadened activation) follows in the same effort. They may ship as one or two commits.

- **Phase 1 (behavior-preserving refactor, ship now):** introduce `src/project.ts`
  (constants + `ProjectRef` + `ProjectLocator`). Reproduce today's behavior exactly —
  root-only discovery, per-folder root watcher, narrow activation unchanged. Pure
  consolidation; no public-surface change. Fixes the SoC defect and the scattered
  literals, and makes both the config setting and the roadmap picker localized adds.
- **Phase 2 (gated on product decision):** add an optional `ocx.project` setting
  (resource-scoped string; path to the project file, relative-to-folder or absolute) and
  **broaden activation to `workspaceContains:**/ocx.toml`** so a configured non-root
  project still activates the extension. The locator's precedence becomes
  `ocx.project` (if set) → workspace-folder-root discovery.

**Rationale:** Option 3 is the only one that makes the three sites *derive from one
rule*, which is exactly the reviewer's concern. Phasing keeps Phase 1 a safe,
fully-reversible internal change while deferring the sticky bits (a public setting; a
broader activation glob) until the product actually wants a configurable location —
honoring YAGNI without leaving the latent trap in place. Option 4 is rejected because the
watcher needs a concrete path regardless, and multi-root has no single cwd.

### Quantified Impact

| Metric | Before | After | Notes |
|--------|--------|-------|-------|
| Activation time | baseline | +≤1ms | One extra `fs.stat`/folder at resolve; no eager scan |
| Discovery rule definition sites | 3 | 1 | Activation is a derived superset, not a 2nd definition |
| Hard-coded `ocx.toml`/`ocx.lock` literals (non-comment) | ~8 | 1 (the consts) + manifest | Manifest stays declarative |
| Bundle size | baseline | ~negligible | One small module, no new deps |
| New public settings | 0 | 0 (Phase 1) / +1 `ocx.project` (Phase 2) | Phase 2 gated |

### Consequences

**Positive:**
- The reviewer's edge case is structurally answered: watcher + activation + resolution
  all follow the configured/selected project.
- `extension.ts` shrinks to orchestration (trust, reload serialization, command glue);
  discovery is unit-testable without the host (pure-ish, `vscode.workspace.fs` at the edge).
- The roadmap "detect-all + picker" becomes `ProjectLocator.resolveAll()` + a quick-pick,
  not a rewrite.

**Negative:**
- More files / a small class where there was inline code.
- Phase 2 reverses `e561052`'s activation narrowing (nested-only workspaces activate
  again — a no-op when no project resolves).

**Risks:**
- *Watcher search-space vs. file-watching* (create/delete chicken-egg): watch the
  *directory where the file could appear* (folder root, or the configured file's dir),
  not just the currently-resolved file — otherwise creating a project file where none
  existed is missed. Mitigation: the locator watches the search space and re-resolves on
  every event.
- *Over-engineering if config/picker never ship*: mitigated — Phase 1 is net-positive on
  SoC alone and Phase 2 is gated.
- *Setting is near-permanent API*: mitigated by gating Phase 2 and keeping it a single
  minimal string (no enum/object).

## Technical Details

### Architecture

```
package.json activationEvents         ← static over-approximation
  Phase 1: workspaceContains:ocx.toml            (root-only, unchanged)
  Phase 2: workspaceContains:**/ocx.toml         (any depth — superset of selection)
        │ activation
        ▼
src/extension.ts activate()           ← orchestration only
        │  subscribes
        ▼
src/project.ts  ProjectLocator        ← SINGLE SOURCE OF TRUTH
        │  owns: PROJECT_FILE/LOCK_FILE consts
        │  owns: precedence rule (ocx.project → folder-root discovery)
        │  owns: FileSystemWatcher over the search space
        │  emits: onDidChange(ProjectRef | undefined)
        ├─► resolve() → ProjectRef           → runEnv/runSubcommand (--project = ref.tomlPath, cwd = ref.dir)
        └─► watch events / folder change / ocx.project change → re-resolve → onDidChange → reload()
```

### API Contract

```ts
// src/project.ts
export const PROJECT_FILE = 'ocx.toml';
export const LOCK_FILE = 'ocx.lock';

/** The resolved active project and its files (absolute paths). */
export interface ProjectRef {
  readonly folder: vscode.WorkspaceFolder; // owning folder (RelativePattern + config scope)
  readonly dir: string;                    // directory holding the project file (subcommand cwd)
  readonly tomlPath: string;               // ocx --project
  readonly lockPath: string;
}

/** Locates the active project and signals when it changes. One per workspace session. */
export interface ProjectLocator extends vscode.Disposable {
  /** Resolve by precedence: `ocx.project` (Phase 2) → first folder root with PROJECT_FILE. */
  resolve(): Promise<ProjectRef | undefined>;
  readonly current: ProjectRef | undefined;
  readonly onDidChange: vscode.Event<ProjectRef | undefined>;
}

// Roadmap (not in this ADR): resolveAll(): Promise<ProjectRef[]> for the picker.
```

### Data Model

```ts
// src/config.ts — Phase 2 only
export interface OcxConfig {
  // …existing…
  /** Optional project-file path (relative to its folder, or absolute). Empty ⇒ auto-discover. */
  readonly project: string; // '' = unset
}
```

`extension.ts` after refactor: build `ProjectLocator`, push to `subscriptions`,
`locator.onDidChange(() => reload())`; `reloadOnce`/`runProjectCommand` call
`locator.resolve()` / read `locator.current` instead of `findProjectToml()`. The inline
watcher, folder-change handler, and `findProjectToml` move into the locator.
`jsonValidation.fileMatch: "ocx.toml"` already matches by basename at any depth — **no
change needed** there.

## Implementation Plan

**Phase 1 — refactor (no behavior change):**
1. [ ] Create `src/project.ts`: `PROJECT_FILE`/`LOCK_FILE`, `ProjectRef`, `ProjectLocator`
       (root-only precedence; per-folder root watcher; folder-change re-resolve; `onDidChange`).
2. [ ] `extension.ts`: replace `findProjectToml` + inline watcher/folder-change wiring with
       the locator; subscribe `onDidChange → reload`. Use consts in init/error/status/desc.
3. [ ] Keep activation `workspaceContains:ocx.toml` and all current behavior identical.
4. [ ] Tests: move/extend discovery coverage; the existing nested-decoy regression
       (`src/test/fixtures/workspace/nested/ocx.toml`) must still resolve the root.

**Phase 2 — configurable location (gated on product yes):**
5. [ ] Add `ocx.project` to `contributes.configuration` + `OcxConfig`/`readConfig`.
6. [ ] Locator precedence: `ocx.project` → folder-root discovery; watch the configured
       file's directory; re-resolve on `ocx.project` change.
7. [ ] Broaden activation to `workspaceContains:**/ocx.toml`; note out-of-workspace
       absolute paths still need command-triggered activation.
8. [ ] Tests: configured-path resolution, watcher follows the path, missing-file → no-project.

## Validation

- [ ] `npm run check` (lint + types + build) passes
- [ ] `npm test` passes; nested-decoy regression still resolves the root; (Phase 2)
      configured-path + watcher-follows-path covered
- [ ] Activation latency unchanged (no eager scan); bundle size delta negligible

## Links

- [`adr_terminal_env_inheritance.md`](./adr_terminal_env_inheritance.md)
- commit `e561052` — root-anchored discovery fix (generalized here)
- [VS Code Activation Events](https://code.visualstudio.com/api/references/activation-events)
- VS Code source `src/vs/workbench/services/extensions/common/workspaceContains.ts` (glob-free → root-only)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-06-19 | Architect (/architect) | Initial draft |
| 2026-06-19 | Michael Herwig | Accepted Option 3, **both phases** (config setting + broadened activation included) |
