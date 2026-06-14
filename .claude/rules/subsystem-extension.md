---
paths:
  - src/**
---

# Subsystem: Extension Wiring

How this extension is actually wired together. Architecture rationale lives in `arch-principles.md`; deep API reference in `tech-vscode-api.md`.

## Entry Point

`src/extension.ts` exports two functions VS Code calls:

```ts
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "ocx.helloWorld",
    () => { vscode.window.showInformationMessage("Hello from OCX"); },
  );
  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // Usually empty: everything pushed to context.subscriptions is auto-disposed.
}
```

- `activate(context)` runs once, on the first matching activation event. Keep it thin (see `arch-principles.md`).
- `deactivate()` is for resources NOT managed by `context.subscriptions` (rare); prefer pushing disposables so this stays empty.
- The `main` (CJS bundle) field in `package.json` points VS Code at `./dist/extension.js`. See `subsystem-build.md`.

## Command Registration

1. **Declare** the command in `package.json` so it shows in the Command Palette:

```jsonc
"contributes": {
  "commands": [
    { "command": "ocx.helloWorld", "title": "OCX: Hello World" }
  ]
}
```

2. **Register** the handler in `activate()` with `vscode.commands.registerCommand(id, handler)`.
3. **Push** the returned disposable to `context.subscriptions`.

The command ID in `contributes.commands` MUST match the ID passed to `registerCommand` — a mismatch yields a "command not found" error at invocation. Convention: prefix every ID with the extension name (`ocx.<verb>`).

## Activation Events

- VS Code ≥1.74 **auto-activates** when a contributed command (or language, view, custom editor) is invoked — no explicit `onCommand:` entry needed in `activationEvents`.
- Keep `activationEvents` minimal; add explicit events only for triggers that aren't auto-inferred (e.g. `workspaceContains:ocx.toml`, `onLanguage:toml`, `onStartupFinished`).
- **Never** use `*`. If eager work is genuinely required, use `onStartupFinished` (does not slow startup).

## Lifecycle / `context.subscriptions`

`context.subscriptions` is an array of `Disposable`. On deactivation (or reload) VS Code calls `dispose()` on each, in reverse order. Push **everything** disposable here:

| Resource | Disposable from |
|----------|-----------------|
| Command | `commands.registerCommand` |
| Event listener | `workspace.onDid*`, `window.onDid*` |
| Status bar item | `window.createStatusBarItem` |
| Output channel | `window.createOutputChannel` |
| File watcher | `workspace.createFileSystemWatcher` |
| Language providers | `languages.register*Provider` |

Failing to dispose leaks resources and, on extension reload during development, causes duplicate registrations.

## ExtensionContext essentials

| Member | Use for |
|--------|---------|
| `subscriptions` | Lifecycle (above) |
| `globalState` / `workspaceState` | Small persisted key/value state (mementos) |
| `secrets` | Secret storage (tokens) — never put secrets in settings/state |
| `extensionUri` / `extensionPath` | Resolve bundled asset paths |

## Where Features Land

| Feature type | Location |
|--------------|----------|
| New command | Handler in `src/` (e.g. `src/commands/`), declared in `package.json contributes.commands`, registered + pushed in `activate()` |
| `ocx` CLI invocation | A service module under `src/` (e.g. `src/services/`); shell out async, never `execSync` |
| Config IntelliSense / validation | Language feature provider or JSON-schema contribution; register in `activate()`, push disposable |
| Status bar / views | Create in `activate()`, push disposable; back with a service |
| Tests for the above | `src/test/**` — see `subsystem-tests.md` |
