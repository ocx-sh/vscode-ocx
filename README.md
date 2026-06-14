<p align="center">
  <img src="assets/logo-128.png" alt="OCX logo" width="128" height="128">
</p>

<h1 align="center">OCX for VS Code</h1>

VS Code support for [OCX](https://github.com/ocx-sh/ocx) — the OCI-registry-backed binary package manager.

> **Status:** loads the OCX environment into the editor. `ocx.toml`/`ocx.lock`
> authoring beyond schema validation, package browsing, and status-bar active
> versions are still planned — see `.claude/rules/product-context.md`.

## What it does

Open a folder that contains an `ocx.toml` and the extension composes the project
environment with the `ocx` CLI and injects it into VS Code:

- **Terminals & tasks** — new integrated terminals get the OCX `PATH` (the tools
  declared in `ocx.toml`). Toggle with `ocx.env.applyToTerminals`.
- **Extensions & language servers** — the `PATH` is also injected into the
  extension host's `process.env`, so language servers and other extensions can
  find OCX-managed tools (node, go-task, …). Because already-running extensions
  cache their environment, the extension prompts to **Restart Extensions** when
  the environment changes (configurable: `ocx.restart.automatic`).
- **Live reload** — edits to `ocx.toml`/`ocx.lock` trigger a reload
  (`ocx.watchForChanges`).
- **Status bar** — shows the loaded state; click to reload.

Environment injection mutates `PATH`, so it runs only in a **trusted** workspace.

### Commands

| Command | Does |
| --- | --- |
| `OCX: Reload Environment` | Recompute and re-apply the environment |
| `OCX: Reset Environment` | Restore the baseline environment |
| `OCX: Restart Extensions` | Restart the extension host (reload window on remote) |
| `OCX: Show Output` | Open the OCX output channel |
| `OCX: Initialize ocx.toml` | Run `ocx init` in the workspace folder |

### `ocx.toml` validation

This extension contributes a JSON Schema for `ocx.toml` via the
`contributes.tomlValidation` point consumed by
[Even Better TOML](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
(`tamasfe.even-better-toml`). Install that extension to get completion, hover,
and diagnostics for `ocx.toml`. It is listed in the workspace's recommended
extensions.

### Requirements

The `ocx` CLI must be installed and resolvable. Set `ocx.path.executable` if it
is not on `PATH`.

## Develop

Requires Node.js 20+.

```sh
npm install
npm run check      # lint + type-check + build
npm test           # integration tests (downloads VS Code)
```

Press <kbd>F5</kbd> in VS Code to launch the Extension Development Host, then run
**OCX: Hello World** from the Command Palette.

### Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run build` | Bundle `src/extension.ts` → `dist/extension.js` via esbuild |
| `npm run watch` | Rebuild on change |
| `npm run check-types` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm test` | `@vscode/test-cli` integration tests |
| `npm run package` | Build a `.vsix` with `vsce` |

## Tech

TypeScript · esbuild · `@vscode/test-cli` · ESLint flat config + Prettier.
See [`CLAUDE.md`](./CLAUDE.md) and [`.claude/`](./.claude/) for the project's
AI-assistant configuration and engineering rules.

## License

[Apache-2.0](./LICENSE)
