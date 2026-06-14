# OCX for VS Code

VS Code support for [OCX](https://github.com/ocx-sh/ocx) — the OCI-registry-backed binary package manager.

> **Status:** early bootstrap. Ships a single `OCX: Hello World` command. Feature
> work (e.g. `ocx.toml` / `ocx.lock` authoring, CLI integration, package
> browsing) is planned — see the project's `.claude/rules/product-context.md`.

## Features

- **OCX: Hello World** — shows a notification. Placeholder while the extension is bootstrapped.

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
