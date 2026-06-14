---
paths:
  - src/**
---

# Tech Specialist: VS Code Extension API

**Per-technology specialist rule** (the exemplar of the trio pattern — see `meta-ai-config.md`). Deep, current, source-cited knowledge of the VS Code Extension API. Auto-loads on `src/**`. Paired agent: `specialist-vscode-api`. For extension-specific wiring see `subsystem-extension.md`; for architecture rationale see `arch-principles.md`.

The API surface is large and versioned — when in doubt, **consult the official docs (`code.visualstudio.com/api`) or Context7** for the exact current signature rather than relying on memory. Pin to the `engines.vscode` version in `package.json`.

## Activation Lifecycle

- `activate(context: ExtensionContext)` is the single entry, invoked once on the first matching activation event. `deactivate()` is optional cleanup.
- **Activation is lazy.** The extension is not loaded until an activation event fires — keep `activate()` thin (no blocking work).
- **VS Code ≥1.74**: commands, languages, views, custom editors, and authentication providers contributed in `package.json` **auto-activate** the extension when used. You no longer write `onCommand:` etc. in `activationEvents` for those.
- Activation event types: `onLanguage`, `onCommand`, `onDebug`, `workspaceContains:<glob>`, `onFileSystem`, `onView`, `onUri`, `onWebviewPanel`, `onCustomEditor`, `onAuthenticationRequest`, `onStartupFinished`, `onTaskType`, `onNotebook`, `onTerminal`, `onWalkthrough`, `onChatParticipant`, `onLanguageModelTool`, and `*`.
- **`*` slows startup — avoid it.** If eager work is unavoidable, use **`onStartupFinished`**: it behaves like `*` but fires *after* startup completes, so it doesn't delay the editor.

## Commands

- `vscode.commands.registerCommand(id, handler)` → `Disposable`. Push it to `context.subscriptions`.
- The `id` must match `contributes.commands[].command` in `package.json` or invocation fails with "command not found". Prefix IDs with the extension name.
- `vscode.commands.executeCommand(id, ...args)` invokes any command (built-in or contributed), e.g. reusing `vscode.open`.
- `registerTextEditorCommand` is the variant that receives the active editor + edit builder.

## Contribution Points (`package.json` `contributes.*`)

Static declarations — no code runs until activation. Most relevant for this extension:

| Point | Purpose |
|-------|---------|
| `commands` | Command title/category/icon; shows in Command Palette |
| `menus` | Place commands in menus (context, editor title, view) with `when` clauses |
| `keybindings` | Bind key chords to commands |
| `configuration` | Extension settings (read via `workspace.getConfiguration`) |
| `languages` | Register/associate a language id with file patterns (e.g. for `ocx.toml`) |
| `jsonValidation` | Map a JSON schema to file patterns for validation + IntelliSense |
| `grammars` / `snippets` | TextMate grammar / snippets for a language |
| `views` / `viewsContainers` | Custom tree views and the containers that hold them (e.g. a package browser) |
| `customEditors` | Custom editor for a file type |
| `taskDefinitions` | Custom task types (e.g. running `ocx`) |
| `walkthroughs` | Getting-started guided walkthroughs |

## Key Namespaces

| Namespace | Use for | Notable members |
|-----------|---------|-----------------|
| `commands` | Register/run commands | `registerCommand`, `executeCommand`, `getCommands` |
| `window` | UI surfaces | `showInformationMessage` / `showErrorMessage` / `showWarningMessage`, `createOutputChannel`, `createStatusBarItem`, `withProgress`, `createTreeView`, `createWebviewPanel`, `createTerminal`, `showQuickPick`, `showInputBox` |
| `workspace` | Files, config, fs | `getConfiguration`, `workspaceFolders`, `fs` (use `vscode.workspace.fs`, not node fs, for virtual-fs compat), `findFiles`, `createFileSystemWatcher`, `onDidChangeConfiguration` |
| `languages` | Language features | `registerCompletionItemProvider`, `registerHoverProvider`, `createDiagnosticCollection`, `registerDocumentFormattingEditProvider` |
| `extensions` | Inspect/activate extensions | `getExtension`, `.activate()` (used in tests) |
| `env` | Environment | `openExternal`, `clipboard`, `appHost` |

## Disposables

- **Everything that allocates a resource returns a `Disposable`** (command, listener, status bar item, output channel, watcher, provider).
- Push to `context.subscriptions`; VS Code disposes them at deactivation (reverse order). This is the leak-prevention contract.
- `Disposable.from(...disposables)` aggregates several into one.
- Failing to dispose causes leaks and **duplicate registrations on dev reload**.

## Webviews

- `window.createWebviewPanel(viewType, title, column, options)` renders sandboxed HTML/JS.
- Heavy and security-sensitive — prefer native UI (tree views, quick picks, status bar) first. Use a webview only when native UI can't express the need.
- Security essentials: set a strict `Content-Security-Policy`, use `webview.asWebviewUri` for local resources, generate a nonce for inline scripts, and validate every `postMessage` payload (untrusted boundary — see `quality-core.md`).
- Restore across reloads via `WebviewPanelSerializer` (`onWebviewPanel` activation).

## TreeView

- Implement `TreeDataProvider<T>` (`getChildren`, `getTreeItem`); register with `window.createTreeView(viewId, { treeDataProvider })` or `registerTreeDataProvider`.
- Fire `onDidChangeTreeData` to refresh. Back the view with a service; keep `vscode`-coupling thin.
- Pairs with `contributes.views` / `viewsContainers`. Natural fit for the planned package/version browser.

## Configuration

- Read: `workspace.getConfiguration("ocx").get<T>("key")`. Declare every key under `contributes.configuration` with type/default/description.
- React to changes via `workspace.onDidChangeConfiguration` (filter with `event.affectsConfiguration("ocx.key")`).
- Never store secrets in settings — use `context.secrets`.

## When to Reach for Docs / Context7

- Any exact signature, enum, or option you're not 100% sure of — the API evolves per release.
- New proposed APIs (`enabledApiProposals`) — verify availability for the targeted `engines.vscode`.
- Webview CSP / messaging patterns, language-feature provider contracts, and the proposed-API surface change often; confirm against the current docs.

## Sources

- [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [Activation Events](https://code.visualstudio.com/api/references/activation-events) (1.74 auto-activation; `onStartupFinished` vs `*`)
- [Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- [VS Code API reference](https://code.visualstudio.com/api/references/vscode-api)
- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
