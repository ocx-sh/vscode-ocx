# Design Spec: [Feature / Component Name]

<!--
Design Specification for a VS Code extension feature.
Filename: artifacts/design_spec_[component].md
Owner: Architect (/architect)
Handoff to: Builder (/builder), QA Engineer (/qa-engineer)
Related Skills: architect, builder, qa-engineer

Design Principles:
- Lazy activation — contribute via activationEvents, do the minimum on activate()
- Dispose everything — register disposables in context.subscriptions
- Respect user settings, themes (incl. high-contrast), and the platform
- Webview UI (if any) must follow the VS Code webview CSP + theming guidance
-->

## Overview

**Status:** Draft | In Review | Approved
**Author:** [Name]
**Date:** [YYYY-MM-DD]
**Issue:** [#issue or N/A]
**Related PRD:** [Link to PRD]
**Min VS Code version:** [^1.XX.0]

## Goals

- [Goal 1: e.g., let users run [action] from the command palette]
- [Goal 2: e.g., surface [state] in the status bar]
- [Goal 3]

## Non-Goals

- [Out of scope 1]
- [Out of scope 2]

## User Flow

```
[Trigger: command / setting / file event]
        ↓
[Extension handler] → [Decision Point]
                          ↓          ↓
                    [Path A]      [Path B]
                          ↓          ↓
                    [Outcome]    [Outcome]
```

## Contribution Points (package.json `contributes`)

| Type | ID / Name | Title | When / Context |
|------|-----------|-------|----------------|
| command | `ocx.[doSomething]` | [Title] | [enablement / when clause] |
| configuration | `ocx.[setting]` | [description] | [scope: window/resource] |
| menus | [menu] | — | [when clause] |
| view / viewsContainers | [id] | [Title] | [where] |

## Activation

| Activation Event | Reason |
|------------------|--------|
| `onCommand:ocx.[doSomething]` | [why] |
| `onStartupFinished` / `workspaceContains:...` | [why — prefer narrow events] |

**Activation budget:** `activate()` does [minimal work]; defer [heavy work] to first command invocation.

## Component Specifications

### [Component 1]

**Purpose:** [What this module does]

**Public API:**

```ts
// Interfaces, function signatures, command handler shapes, message types
export function activate(context: vscode.ExtensionContext): void;
```

**States / behaviors:**

| State | Description | Observable effect |
|-------|-------------|-------------------|
| Idle | [Description] | [UI / no-op] |
| Running | [Description] | [progress notification / status bar] |
| Error | [Description] | [error message + recovery] |

**Disposables:** [commands, listeners, status bar items, file watchers — all pushed to `context.subscriptions`]

### [Component 2]

[Repeat structure above]

## Configuration & State

| Setting / Key | Type | Default | Scope | Notes |
|---------------|------|---------|-------|-------|
| `ocx.[setting]` | [type] | [default] | [window/resource] | [description] |
| globalState / workspaceState `[key]` | [type] | — | — | [what is persisted, why] |

## Webview UI (only if the feature renders a webview)

<!-- Delete this section if there is no webview. -->

### Layout

```
┌─────────────────────────────────────┐
│  Header                             │
├─────────────────────────────────────┤
│  Content                            │
└─────────────────────────────────────┘
```

### Theming & Accessibility

- [ ] Uses VS Code CSS theme variables (`--vscode-*`); no hardcoded colors
- [ ] Works in light, dark, and high-contrast themes
- [ ] Strict Content Security Policy; nonce on all scripts; `localResourceRoots` set
- [ ] Keyboard navigable; focus indicators visible
- [ ] Respects `prefers-reduced-motion`

### Message Protocol (extension ↔ webview)

| Direction | Type | Payload | Effect |
|-----------|------|---------|--------|
| webview → ext | `[type]` | `{ ... }` | [handler action] |
| ext → webview | `[type]` | `{ ... }` | [render update] |

## Error Handling & UX

| Failure | User-facing message | Recovery |
|---------|---------------------|----------|
| [Failure 1] | [`vscode.window.showErrorMessage(...)`] | [retry / link to setting / no-op] |

## Telemetry / Logging

- Output channel: [`OCX`] for diagnostics
- [Telemetry events, if any — respect `telemetry.telemetryLevel`]

## Testing Notes

- Integration tests via `@vscode/test-cli` / `@vscode/test-electron`
- Cover: activation, each command, settings reactions, error paths

## Open Questions

- [ ] [Question 1]
- [ ] [Question 2]

---

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Architect | | | Pending |
| Engineering | | | Pending |
