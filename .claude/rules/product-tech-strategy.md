# Tech Strategy - Golden Paths

**SINGLE SOURCE OF TRUTH** for tech choices for the OCX VS Code extension. Boring-tech bias (see `quality-core.md` "Choose Boring Technology"): every choice below is the mainstream, officially-supported path so innovation tokens are saved for product value, not toolchain novelty.

## Compliance

1. **Follow This File**: Use tech listed below
2. **No Deviations**: No alternatives unless told (documented alternatives noted explicitly)
3. **Latest Stable**: Latest stable version unless pinned

## Language Golden Path

| Component | Choice | Why |
|-----------|--------|-----|
| Language | TypeScript 5.x, strict + 2026 baseline | Type safety for the VS Code API surface; see `quality-typescript.md` |
| Module style | ESM-style source | Modern import/export; bundler emits CJS for the host (see Bundler row) |
| Target Node | Node LTS (20 / 22) | Matches VS Code's bundled Electron/Node range; test matrix uses both |

## Build & Bundle

| Component | Choice | Why |
|-----------|--------|-----|
| Bundler | **esbuild** → `dist/extension.js` | Sub-second builds, single binary, zero-config watch. The official VS Code generator's modern default. See `tech-esbuild.md`, `subsystem-build.md` |
| Bundle format | `cjs`, `platform: node`, `--external:vscode` | Node extension host requires CommonJS; `vscode` is injected at runtime, never bundled |
| Type checking | `tsc --noEmit` (separate from bundling) | esbuild does NOT type-check; tsc is the type gate in CI and watch |

### Why esbuild over webpack

- **Speed**: esbuild bundles in tens of milliseconds vs. webpack's seconds — watch loop is near-instant.
- **Config size**: one small `esbuild.js` vs. webpack's plugin/loader sprawl.
- **Official support**: VS Code's `yo code` generator offers esbuild as the modern bundler; docs ship a canonical `esbuild.js` + problem-matcher plugin.
- **Trade-off accepted**: esbuild performs no type checking — covered by `tsc --noEmit`. Webpack also doesn't type-check without `ts-loader` in transpile mode, so this is not a regression.

## Lint & Format

| Component | Choice | Why |
|-----------|--------|-----|
| Linter | **ESLint flat config** (`eslint.config.mjs`) + `@typescript-eslint` | Generator default; type-aware rules and the VS Code plugin ecosystem |
| Formatter | **Prettier** | Generator default; deterministic formatting |
| Documented alternative | **Biome** (single binary, formatter+linter) | Per `quality-typescript.md` tooling table — viable swap if the ESLint plugin ecosystem is not needed |

## Test

| Component | Choice | Why |
|-----------|--------|-----|
| Test runner | **@vscode/test-cli** (config `.vscode-test.mjs`) | Official CLI; orchestrates download + launch |
| Test host | **@vscode/test-electron** | Downloads a real VS Code build, runs tests inside the extension host |
| Test framework | **Mocha** (suite/test) | Default shipped with the test CLI |
| Linux CI | **xvfb** (`xvfb-run -a`) | Electron needs a display server on headless Linux |

See `subsystem-tests.md`.

## Publish

| Component | Choice | Why |
|-----------|--------|-----|
| Marketplace | **vsce** (`@vscode/vsce`) | Official packaging + publish to the VS Code Marketplace |
| Open VSX | **ovsx** | Dual-publish to Open VSX for VSCodium / non-Marketplace clients |
| Gate | secrets `VSCE_PAT` / `OVSX_PAT` | Publish steps inert when secrets absent (see `subsystem-ci.md`) |

## CI/CD

| Component | Choice | Why |
|-----------|--------|-----|
| Platform | **GitHub Actions** | Repo-native; matrix ubuntu/macos/windows × Node 20/22 |
| Token policy | least-privilege `GITHUB_TOKEN`, SHA-pinned actions | See `subsystem-ci.md`, `meta-ai-config.md` |

See `subsystem-ci.md`.
