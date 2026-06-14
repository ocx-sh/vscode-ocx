# Research: State-of-the-Art VS Code Extension Project (2025/2026)

<!--
Technology Landscape Research
Filename: .claude/artifacts/research_vscode_extension_sota.md
Owner: Researcher
Handoff to: Architect (/architect), builder
Purpose: Persist the SOTA layout for a TypeScript VS Code extension so build,
test, lint, CI, and publishing decisions trace back to a cited baseline.
Artifacts decay — re-verify before trusting findings.
-->

## Metadata

**Date:** 2026-06-14
**Domain:** ide-tooling / typescript / ci-cd / packaging
**Triggered by:** Bootstrapping the OCX VS Code extension (Hello-World stage)
**Expires:** ~2026-12 (re-verify VS Code API min version, bundler default, publish channels)

## Direct Answer

A modern (2025/2026) VS Code extension is a **TypeScript** project scaffolded
with the **Yeoman generator** (`yo code`), **bundled with esbuild** (the
VS Code-recommended default), **tested with `@vscode/test-cli` +
`@vscode/test-electron`** (Mocha), **linted with ESLint flat config +
Prettier**, and **published to both the VS Code Marketplace (vsce) and Open VSX
(ovsx)** via a GitHub Actions matrix (ubuntu/macos/windows) that runs headless
tests under `xvfb` on Linux.

## Technology Landscape

### Established (proven, widely accepted)

| Tool/Pattern | Status | Notes |
|---|---|---|
| Yeoman `generator-code` (`yo code`) | Standard scaffold | Generates TS project, manifest, debug + test config |
| **esbuild** bundler | VS Code-recommended default | Far faster than webpack; mark `vscode` external; `cjs` format for the Node extension host; `tsc --noEmit` separately for type checking; sourcemap in dev / minify in prod; bundling also enables web extensions |
| `@vscode/test-cli` + `@vscode/test-electron` | Standard test stack | Mocha-based; config in `.vscode-test.mjs`; downloads and launches a real VS Code instance |
| **ESLint flat config** (`eslint.config.mjs`) | 2025 standard | With `typescript-eslint`; pairs with Prettier via `eslint-config-prettier` |
| `vsce` (VS Code Marketplace) | Standard publish path | `vsce package` → `.vsix`; `vsce publish` |
| GitHub Actions CI matrix | Standard | ubuntu/macos/windows; Node 20/22 |

### Trending (gaining momentum)

| Tool/Pattern | Adoption signal | Key benefit | Relevance |
|---|---|---|---|
| **Open VSX via `ovsx`** | Now a primary channel | Reaches VSCodium/Cursor/Theia/Gitpod users | Dual-publish (Marketplace + Open VSX) is the default expectation |
| **Biome** | Emerging single-binary linter/formatter | One fast Rust binary replacing ESLint+Prettier | Viable alternative to the ESLint+Prettier pair |
| Release automation: `semantic-release(-vsce)`, Changesets, release-please | Common in mature extensions | Versioning + changelog + publish in one pipeline | Pick one when release cadence grows |

### Declining (losing mindshare)

| Tool/Pattern | Signal | Avoid because |
|---|---|---|
| webpack as default bundler | Superseded by esbuild for extensions | Slower; esbuild is the recommended default |
| `.eslintrc` (legacy ESLint config) | Flat config is the 2025 standard | New projects should start on flat config |
| `activationEvents: ["*"]` | Discouraged | Eager activation hurts startup; prefer lazy events |

## Design Patterns Worth Considering

- **esbuild + separate type-check** — bundle with esbuild for speed, run
  `tsc --noEmit` for types; `npm run check` = lint + check-types + build.
- **Lazy activation** — avoid `"*"`; declared commands auto-activate since VS
  Code 1.74, so most extensions need few or no explicit `activationEvents`.
- **Realistic `engines.vscode` floor** — set a real minimum (e.g. `^1.96.0`),
  not the latest, to widen the install base.
- **Ship `dist/` only** — `.vscodeignore` excludes sources/tests/node_modules so
  the `.vsix` stays small; `main` points at the bundled `dist/extension.js`.
- **Dual-marketplace publish** — `vsce` for Marketplace, `ovsx` for Open VSX,
  driven from the same release workflow.
- **Headless Linux CI** — run integration tests under `xvfb-run` (or
  `GabrielBB/xvfb-action`); macOS/Windows runners need no display server.

## Key Findings

1. **esbuild is the VS Code-recommended bundler** — fast, marks `vscode`
   external, emits `cjs` for the Node extension host; bundling enables web
   extensions. (code.visualstudio.com/api bundling-extension; vscode-extension-samples esbuild-sample)
2. **`@vscode/test-cli` + `@vscode/test-electron` is the standard test stack** —
   Mocha, configured in `.vscode-test.mjs`, downloads and launches VS Code.
   (testing-extension)
3. **ESLint flat config (`eslint.config.mjs`) with typescript-eslint + Prettier**
   is the 2025 lint/format baseline; **Biome** is the emerging single-binary
   alternative.
4. **Manifest hygiene** — realistic `engines.vscode` (`^1.96.0`), lazy
   `activationEvents` (declared commands auto-activate since 1.74), `contributes`,
   `main` → bundled `dist`. (extension-manifest, activation-events)
5. **Dual publishing** — Marketplace via `vsce`, Open VSX via `ovsx`; Open VSX
   is now a primary channel. (publishing-extension; dev.to dual-marketplace guide)
6. **CI** — GitHub Actions matrix (ubuntu/macos/windows) with `xvfb-run` for
   headless Linux tests. (continuous-integration; snyk.io VS Code CI/CD)
7. **Hygiene** — `.vscodeignore` (ship `dist` only), `CHANGELOG`, dependabot or
   renovate, source maps; release automation via semantic-release-vsce,
   Changesets, or release-please.

## Recommendation

Adopt the recommended path verbatim: **TypeScript + esbuild + `@vscode/test-cli`
+ ESLint flat config + Prettier**, with a GitHub Actions matrix using `xvfb` on
Linux and **dual publishing to Marketplace (vsce) and Open VSX (ovsx)**. Keep
`tsc --noEmit` as a separate type-check step and ship only `dist/` via
`.vscodeignore`. Revisit Biome and a release-automation tool once cadence grows.

## Sources

| Source | Type | Relevance |
|---|---|---|
| https://code.visualstudio.com/api/get-started/your-first-extension | Docs | Scaffold via `yo code`, project layout, F5 debug |
| https://code.visualstudio.com/api/working-with-extensions/bundling-extension | Docs | esbuild bundling, `vscode` external, cjs, web extensions |
| https://code.visualstudio.com/api/working-with-extensions/testing-extension | Docs | `@vscode/test-cli` + `@vscode/test-electron`, Mocha |
| https://code.visualstudio.com/api/references/extension-manifest | Docs | `engines.vscode`, `contributes`, `main` |
| https://code.visualstudio.com/api/references/activation-events | Docs | Lazy activation; auto-activation since 1.74 |
| https://code.visualstudio.com/api/working-with-extensions/publishing-extension | Docs | vsce package/publish, `.vscodeignore` |
| https://code.visualstudio.com/api/working-with-extensions/continuous-integration | Docs | GitHub Actions matrix, xvfb on Linux |
| https://github.com/microsoft/vscode-extension-samples (esbuild-sample) | Repo | Reference esbuild build script |
| https://snyk.io (VS Code extension CI/CD) | Blog | CI/CD pipeline patterns |
| https://dev.to (dual-marketplace publishing guide) | Blog | Marketplace + Open VSX publishing |
| https://www.npmjs.com/package/semantic-release-vsce | Package | Release automation for extensions |
