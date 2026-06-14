---
paths:
  - src/**
---

# Extension Architecture Principles

Auto-load on every `src/**` edit. Stable architectural context — the "why" behind the extension's structure. For the concrete wiring (entry point, command registration, manifest), see `subsystem-extension.md`. For deep VS Code API knowledge, see `tech-vscode-api.md`.

## Glossary

| Term | Definition |
|------|-----------|
| **Activation event** | Declared (or auto-inferred) trigger that causes VS Code to load and run the extension's `activate()` — e.g. `onCommand`, `onLanguage`, `onStartupFinished`. Lazy by design. |
| **Contribution point** | Static declaration in `package.json` `contributes.*` (commands, menus, configuration, languages, views) that extends the editor. No code runs until activation. |
| **Extension host** | The separate Node.js process VS Code runs extensions in (isolated from the renderer/UI thread). Blocking it freezes all extensions, not the UI. |
| **Webview** | A sandboxed iframe an extension can render custom HTML/JS into (`vscode.window.createWebviewPanel`). Heavy; use only when native UI cannot express the need. |
| **Disposable** | Any object with a `dispose()` method that releases a resource (command registration, event listener, status bar item, watcher). The core lifecycle primitive. |

## Core Principles

| Principle | Rule | Why |
|-----------|------|-----|
| **Thin `activate()`** | `activate()` only wires things up (register commands, create services, push disposables). No heavy work, no blocking I/O, no network. | Activation is on a hot path; slow activation degrades editor startup and command latency. |
| **Dispose everything** | Every disposable (command, listener, status bar item, watcher, output channel) is pushed to `context.subscriptions`. | VS Code calls `dispose()` on each at deactivation — prevents leaks and duplicate registrations on reload. |
| **Lazy activation** | Declare the narrowest activation events; let commands/languages auto-activate (VS Code ≥1.74) rather than `*`. Prefer `onStartupFinished` over `*` if eager work is unavoidable. | Don't slow startup for users who never trigger the extension. |
| **Layer separation** | Split command handlers / services (domain + `ocx` CLI integration) / VS Code API adapters. Handlers are thin; services are testable in isolation; adapters wrap the `vscode` namespace. | Keeps `vscode`-coupled code at the edges so domain logic is unit-testable and the API surface is swappable (DIP, see `quality-core.md`). |
| **Never block the host** | No sync FS, no `execSync`, no busy loops on the extension-host event loop. Use `async`/`await`, `child_process` async APIs, and progress notifications for long work. | A blocked host freezes every extension's responsiveness. |
| **Error surfacing** | User-actionable errors → `window.showErrorMessage` (+ a retry/action where sensible); diagnostic detail → a dedicated **output channel**. Never swallow (see `quality-core.md`). | Users need a visible, recoverable signal; maintainers need logs. |

## Layering Sketch

```
package.json contributes.*        ← static declarations (commands, config, views)
        │ activation event
        ▼
src/extension.ts  activate()      ← thin: build services, register handlers, push disposables
        │
        ├─ command handlers       ← thin glue: parse args → call service → surface result
        ├─ services               ← domain logic + `ocx` CLI integration (no vscode imports ideally)
        └─ vscode adapters        ← wrap window/workspace/languages namespaces; the only vscode-coupled layer
```

Dependency direction: handlers → services → adapters → `vscode`. Domain/service code should depend on narrow adapter interfaces, not the `vscode` namespace directly, so it can be unit-tested without the host.

## ADR Index

Architecture Decision Records live in `.claude/artifacts/adr_*.md`. Read the relevant ADR before making a decision in the same domain. Add a row per ADR as decisions are recorded.

| ADR | Decision |
|-----|----------|
| [`adr_terminal_env_inheritance.md`](../artifacts/adr_terminal_env_inheritance.md) | Terminal env injection is **opt-in** (`ocx.env.applyToTerminals`, default `false`); no direnv detection — OCX will own a terminal hook. |

## Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Heavy work / network in `activate()` | Move into lazily-invoked command handlers or a background task after `onStartupFinished` |
| Disposable not pushed to `context.subscriptions` | Always push (or dispose manually with a stored reference) |
| `*` activation event | Use specific events; rely on command/language auto-activation |
| Sync I/O or `execSync` on the host | Use async APIs; wrap long work in `withProgress` |
| `vscode` imported deep in domain logic | Keep `vscode` at the adapter edge; inject narrow interfaces |
| Errors logged only to `console` | Surface to the user (`showErrorMessage`) and an output channel |
