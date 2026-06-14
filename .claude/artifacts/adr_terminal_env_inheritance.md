# ADR: Terminal Environment Inheritance Setting & direnv Conflict UX

## Metadata

**Status:** Accepted
**Date:** 2026-06-15
**Deciders:** Architect (worker-architect), Michael Herwig
**Issue:** N/A
**Related PRD:** N/A
**Tech Strategy Alignment:**
- [x] Decision follows Golden Path in `.claude/rules/product-tech-strategy.md` (thin editor surface; no `ocx` logic reimplemented)
- [x] Stays inside `product-context.md` scope (status/env surfacing over the CLI)
**Domain Tags:** commands | api | configuration
**Supersedes:** N/A
**Superseded By:** N/A

## Context

The extension injects the OCX project environment into two surfaces (`src/environment.ts`):

1. `process.env` of the extension host — reaches extensions and the LSPs/child processes they spawn.
2. `vscode.GlobalEnvironmentVariableCollection` — reaches **integrated terminals and tasks** (PATH `prepend`, constant `replace`, with `applyAtProcessCreation` + `applyAtShellIntegration`).

OCX also ships a `direnv export` integration: a project may carry an `.envrc` that loads the same OCX env when the user `cd`s into the directory in a terminal. If the extension injects into terminals **and** `.envrc` re-exports on shell start, the OCX env is loaded twice into the same terminal session.

The manifest ships a boolean `ocx.env.applyToTerminals`; the wiring reads it through `config.applyToTerminals` and branches in `EnvManager.apply`. This ADR keeps the boolean but makes it **opt-in (default `false`)** and **drops the direnv-conflict detection/notification** entirely. The terminal surface is the only one in scope here — `process.env` injection stays unconditional.

> **Revision note (decision reversed):** an earlier draft chose default `true` + a one-time `.envrc` conflict notification (Option 1). That is superseded by **Option 3 (opt-in, default `false`)** for two reasons surfaced in review: (a) the `EnvironmentVariableCollection` does **not** re-apply to already-open terminals on reload, so default-on delivers little benefit for the cost; and (b) OCX will, in future, ship its own terminal hook (the same mechanism as its `direnv export`), so the extension should not stand up a second, competing terminal-injection path or a heuristic `.envrc` detector (YAGNI / scope discipline). The double-load problem the notification solved largely disappears once terminal injection is off by default.

## Decision Drivers

- **Match user expectation**: developers expect their project toolchain on `PATH` in the integrated terminal without extra configuration.
- **direnv double-load avoidance**: do not silently fight a tool the user has deliberately configured.
- **No nagging**: VS Code-ecosystem hygiene — at most one dismissible, actionable notification, never repeated.
- **Boring tech / KISS** (`quality-core.md`): prefer the narrowest setting that solves the real problem; no speculative enum states (YAGNI).
- **Scope discipline** (`product-context.md`): thin surface; the extension does not parse `.envrc` semantics or reimplement direnv.

## Industry Context & Research

The `EnvManager` JSDoc already states the design "mirrors direnv-vscode's checksum cache." direnv-vscode is the closest prior art: it injects into both surfaces and exposes a single boolean (`direnv.restart.automatic`) plus a `path.executable`; it does **not** model a tri-state for the terminal surface. The VS Code `EnvironmentVariableCollection` API is itself idempotent at the collection level (re-applying the same mutators replaces the prior set rather than stacking), which is load-bearing for the harm assessment below.

**Research artifact:** [`.claude/artifacts/research_vscode_extension_sota.md`](./research_vscode_extension_sota.md)
**Trending approaches:** single boolean toggles for env-injection surfaces (direnv-vscode, asdf-vscode), reserving enums for genuine multi-mode behavior.
**Key insight:** the only real failure mode is **per-shell** double application (collection mutator + `.envrc` re-export in the same terminal), which the collection's own idempotency does **not** cover. An earlier draft answered this with a one-time discovery prompt; the accepted decision instead removes the failure mode at the source by defaulting terminal injection **off** (see Decision Outcome) — so no detector is needed.

## Double-Load Harm Assessment

Whether the toggle matters at all depends on how harmful a double-load is. Assessed by entry type:

| Entry kind | Mechanism | Double-load effect | Severity |
|-----------|-----------|--------------------|----------|
| `constant` (`replace`) | Collection `replace` + `.envrc` re-export both set the absolute value | Idempotent — same final value, last writer wins. | Cosmetic |
| `path` (`prepend`) | Collection prepends `dir` + delimiter; `.envrc` prepends `dir` again in-shell | **`PATH` accumulates a duplicate `dir` entry** (`dir:dir:…`). Not idempotent across the two independent mechanisms. | Real but low |

Concrete harm of the `path` case:

- **Correctness**: none in practice — the duplicated directory resolves the same binary; first hit wins, so tool resolution is unchanged.
- **Performance**: negligible — a few extra `PATH` segments; `execvp` scan cost is immaterial.
- **Cosmetic / trust**: `echo $PATH` shows visible duplicates, which *looks* broken and erodes confidence; this is the actual cost.

**Conclusion:** double-load is **low-harm, mostly cosmetic** — not a correctness or security bug. So the default is *not* forced by safety. The accepted decision defaults terminal injection **off** for a different reason (limited benefit, since the collection does not re-apply to open terminals on reload, plus a future OCX-owned terminal hook), which also removes the double-load by construction — without a detector or notification.

## Considered Options

### Option 1: Boolean `ocx.env.applyToTerminals`, default `true`, + one-time direnv conflict notification

**Description:** Keep the shipped boolean. Default ON so terminals get the project toolchain with zero config. When the extension detects an `.envrc` in the project root that references direnv/OCX **while** terminal injection is enabled, show a single dismissible notification offering to set `applyToTerminals = false` (workspace scope). Never re-prompt once dismissed or acted on (persist a flag in `workspaceState`).

| Pros | Cons |
|------|------|
| Zero-config for the common case (no direnv) — matches expectation | Requires a lightweight `.envrc` presence check (not semantic parse) |
| Already the shipped schema — no migration, no churn | One new notification path to maintain |
| Conflict is discoverable and one-click-resolvable | Detection is heuristic (file presence), can theoretically false-positive |
| KISS/YAGNI — two states are all the behavior that exists | |

### Option 2: Enum `ocx.env.terminalInjection: "auto" | "on" | "off"`, default `"auto"`

**Description:** `auto` auto-detects a configured direnv (`.envrc` present) and backs off terminal injection; `on`/`off` force it.

| Pros | Cons |
|------|------|
| Single setting expresses "be smart about it" | `auto` makes terminal behavior **implicit and invisible** — user can't tell from the setting whether terminals are injected |
| No notification needed if `auto` is trusted | Detection is a heuristic; a false-positive silently drops the toolchain from terminals with no signal (worse failure than a visible duplicate) |
| | Breaking change vs. shipped boolean (migration + doc churn) for a low-harm problem |
| | Three states to test/document for a binary behavior — violates YAGNI |
| | direnv presence ≠ direnv loads OCX env; `auto` would over-trigger |

### Option 3: Boolean default `false` (opt-in terminal injection)

**Description:** Ship terminal injection OFF; users opt in.

| Pros | Cons |
|------|------|
| Zero double-load risk out of the box | Penalizes the **majority** (no direnv) — terminals silently lack the toolchain, the single most-expected behavior |
| | Surprising: host/LSP get the env but terminals don't, with no explanation |
| | Optimizes for a low-harm, minority edge case at the expense of the primary flow |

## Decision Outcome

**Chosen Option:** **Option 3** — boolean `ocx.env.applyToTerminals`, **opt-in, default `false`**. No `.envrc`/direnv detection and no conflict notification.

**Rationale:**

1. **Low benefit for default-on.** The `EnvironmentVariableCollection` applies at terminal **process creation**; on reload it does not re-apply to already-open terminals (VS Code only surfaces a "Relaunch terminal" affordance). The convenience of auto-injecting terminals is therefore smaller than it first appears, while the cost (a competing mechanism, the double-load with direnv) is real.
2. **OCX will own the terminal hook.** OCX already ships a `direnv export`; a first-class terminal hook is on its roadmap. The extension should not stand up a second terminal-injection path that will overlap it. Keeping the toggle off by default leaves that surface to OCX and avoids the double-load by construction.
3. **No speculative detection.** With terminal injection off by default, the `.envrc` double-load is no longer the common case, so the heuristic `.envrc` detector + one-time notification (Option 1) is unjustified complexity (YAGNI, scope discipline). The plain boolean is honest: its value always tells the truth about terminal behavior.

Users who want the project toolchain in terminals today opt in with one setting; the host/extension `PATH` is injected regardless, so language servers keep working with the default off.

### Setting Schema (package.json)

```jsonc
"ocx.env.applyToTerminals": {
  "type": "boolean",
  "default": false,
  "markdownDescription": "Inject the OCX environment into integrated terminals and tasks. **Off by default** — the extension host/language-server `PATH` is injected regardless. Takes effect only in **newly opened** terminals (reopen existing terminals to apply)."
}
```

No `scope` override (defaults to `window`/`resource`-resolvable like any setting); the per-project rationale that motivated `resource` scope (direnv is per-folder) no longer applies now that detection is dropped.

### Consequences

**Positive:**
- No double-load with direnv (or a future OCX terminal hook) out of the box — terminals are untouched unless explicitly opted in.
- Minimal surface: one boolean, no notification path, no `.envrc` I/O, no `workspaceState` flag. `EnvManager.apply` already gates terminal mutators on the boolean and `restore()` clears them when off.
- Setting value always reflects real terminal behavior (no hidden `auto`).

**Negative:**
- Users who *do* want the toolchain in terminals must flip one setting (and reopen terminals). Documented in the `markdownDescription` and README.

**Risks:**
- **Stale terminals after toggling**: `EnvironmentVariableCollection` mutators apply at process creation; existing terminals keep the old env until reopened. Mitigation: the `markdownDescription` states "takes effect in newly opened terminals"; VS Code surfaces a built-in "Relaunch terminal" affordance. The extension does not force-kill user terminals (data-loss risk).

## Technical Details

### Architecture

```
reload (ok) ──► EnvManager.apply({ applyToTerminals })
                     │
                     ├─ process.env            (always)
                     └─ collection mutators    (iff applyToTerminals, default false)
```

No post-reload detection step; `restore()` (called at the start of every `apply`) `clear()`s the collection, so toggling off and reloading removes any previously-set mutators.

## Implementation Plan

1. [x] Set `ocx.env.applyToTerminals` `default` → `false` and update its `markdownDescription` in `package.json`.
2. [x] Match the in-code default in `readConfig` (`config.ts`): `c.get<boolean>('env.applyToTerminals', false)`.
3. [x] No change needed in `environment.ts`/`extension.ts` — the boolean gate and `restore()`/`clear()` already implement opt-in + clean toggle-off.
4. [x] Tests: default-off injects host env but **no** terminal mutators; `applyToTerminals=true` applies mutators (`src/test/extension.test.ts`). Unit toggle coverage already exists in `environment.test.ts`.

## Validation

- [ ] `npm run check` (lint + types + build) passes
- [ ] `npm test` passes (default-off + enabled terminal-injection tests)

## Links

- [`research_vscode_extension_sota.md`](./research_vscode_extension_sota.md)
- `src/environment.ts` (`EnvManager.apply`, `applyToTerminals` gate)
- `src/config.ts` (`readConfig` resource scope)
- [EnvironmentVariableCollection API](https://code.visualstudio.com/api/references/vscode-api#EnvironmentVariableCollection)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-06-15 | worker-architect | Initial draft (Option 1: default `true` + direnv-conflict notification) |
| 2026-06-15 | Michael Herwig | Reversed to Option 3 (opt-in, default `false`); dropped direnv detection/notification; ratified (Accepted). Rationale: collection doesn't re-apply to open terminals on reload; OCX will own a terminal hook. |
