---
paths:
  - "esbuild.js"
  - "**/tsconfig*.json"
  - ".vscodeignore"
---

# Subsystem: Build & Bundle

Bundling invariants for the extension. Deep esbuild reference: `tech-esbuild.md`. Tech-choice rationale (esbuild over webpack): `product-tech-strategy.md`.

## The Pipeline

```
src/extension.ts  ──esbuild──▶  dist/extension.js   (the shipped artifact)
src/**/*.ts       ──tsc --noEmit──▶  type errors    (gate only; emits nothing)
```

Two independent steps: **esbuild bundles**, **tsc type-checks**. esbuild does NOT type-check — it strips types and emits JS. Skipping the tsc step means type errors ship silently.

## esbuild Invariants

| Option | Value | Why |
|--------|-------|-----|
| `entryPoints` | `["src/extension.ts"]` | Single entry; the activation module |
| `bundle` | `true` | Inline all `node_modules` deps into one file |
| `outfile` | `dist/extension.js` | Matches `main` in `package.json` |
| `external` | `["vscode"]` | **Critical**: `vscode` is injected by the host at runtime; bundling it breaks the extension |
| `format` | `"cjs"` | **The node extension host requires CommonJS**, even though source is ESM-style (see below) |
| `platform` | `"node"` | Node built-ins available; not a browser target |
| `sourcemap` | dev only | Debuggable stack traces in development |
| `minify` | prod only (`--production`) | Smaller `.vsix`; off in dev for readable output |
| `sourcesContent` | `false` | Trim sourcemap size |
| `logLevel` | `"warning"` | Quiet successful builds |

### Why `format: cjs` when source is ESM-style

VS Code loads the node extension host's entry module via CommonJS `require`. So regardless of `"type": "module"` and ESM `import`/`export` in source, the **bundle output must be CJS**. esbuild transparently down-levels ESM source to a CJS bundle — you write modern `import`, the host gets `module.exports`. Do not try to ship a native ESM bundle as the extension entry; it will fail to load. (`tsconfig` may use `module: ESNext` + `moduleResolution: Bundler` for source ergonomics — see `quality-typescript.md`; the runtime format is decided by esbuild, not tsc.)

## tsc Role

- `tsc --noEmit` is type-checking only (`noEmit: true` in `tsconfig.json`, or the flag).
- Run it in watch alongside esbuild, and as a CI gate (see `subsystem-ci.md`).
- Apply the 2026 strict baseline from `quality-typescript.md` (`strict`, `noUncheckedIndexedAccess`, etc.).

## Watch Mode & Problem Matcher

- Dev runs esbuild with `--watch` (rebuild on save) and `tsc --watch --noEmit` in parallel terminals via `.vscode/tasks.json`.
- The build script registers an **esbuild problem-matcher plugin** (emits `[watch] build started/finished` and formatted errors) so VS Code's task problem matcher surfaces build errors inline. Keep that plugin — removing it loses inline error reporting in the dev loop.

## `.vscodeignore`

`.vscodeignore` controls what `vsce package` includes in the `.vsix`. Ship **only the runtime artifact**:

- **Include**: `dist/extension.js` (+ sourcemap if desired), `package.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, icons.
- **Exclude**: `src/**`, `out/**` (test compile output), `node_modules/**`, `**/*.ts`, `tsconfig*.json`, `esbuild.js`, `.vscode-test.*`, `.github/**`, test fixtures.

Because esbuild bundles deps into `dist/`, `node_modules` must NOT ship — excluding it is what keeps the `.vsix` small. Verify with `vsce ls` before publishing.

## Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| `vscode` not in `external` | Add `external: ["vscode"]` |
| Native ESM bundle as entry | Emit `format: "cjs"` |
| Relying on esbuild to catch type errors | Run `tsc --noEmit` separately |
| Shipping `src/`, `node_modules`, or `out/` in the `.vsix` | Tighten `.vscodeignore`; confirm with `vsce ls` |
| Minified bundle in dev | Gate `minify` behind `--production` |
