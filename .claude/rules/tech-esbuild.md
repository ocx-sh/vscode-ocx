---
paths:
  - "esbuild.js"
---

# Tech Specialist: esbuild

**Per-technology specialist rule** (trio pattern — see `meta-ai-config.md`). Deep, source-cited knowledge of esbuild as used to bundle this extension. Auto-loads on `esbuild.js`. Paired agent: `specialist-esbuild`. Project-level invariants and the `.vsix` packaging story live in `subsystem-build.md`; tech-choice rationale in `product-tech-strategy.md`.

## Bundling Model

esbuild is an extremely fast bundler/transpiler (Go-based). It takes one or more **entry points**, follows the import graph, and emits a single (or split) output. For a VS Code extension the graph is rooted at `src/extension.ts` and collapsed into `dist/extension.js`. esbuild **transpiles TS to JS by stripping types** — it does **no type checking** (that's `tsc --noEmit`'s job; see Limitations).

## Canonical Config (VS Code extension)

The options below are the official VS Code bundling guide's setup:

```js
const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",          // node extension host loads CommonJS
  platform: "node",       // Node built-ins, not browser
  target: "node20",       // align with the host's Node (LTS)
  outfile: "dist/extension.js",
  external: ["vscode"],   // injected at runtime — never bundle
  sourcemap: !production,  // debuggable in dev
  minify: production,      // smaller .vsix in prod
  sourcesContent: false,  // trim sourcemap size
  logLevel: "warning",
  plugins: [esbuildProblemMatcherPlugin],
});

if (watch) { await ctx.watch(); } else { await ctx.rebuild(); await ctx.dispose(); }
```

## Option Reference

| Option | Meaning | Extension value |
|--------|---------|-----------------|
| `entryPoints` | Roots of the import graph | `["src/extension.ts"]` |
| `bundle` | Inline imported modules into the output | `true` |
| `format` | Output module format (`iife` / `cjs` / `esm`) | **`cjs`** — the node host requires CommonJS |
| `platform` | `node` / `browser` / `neutral`; sets default conditions + builtins handling | `node` (use `browser` only for a web-extension target) |
| `target` | Lowest JS/runtime version to support | `node20` (match `engines`/CI) |
| `external` | Modules to leave as runtime `require`/`import` | **`["vscode"]`**; add any host-provided native module |
| `sourcemap` | `true` / `linked` / `inline` / `external` / `both` | dev only |
| `minify` | Shrink identifiers/whitespace/syntax | prod only |
| `sourcesContent` | Embed source text in the map | `false` to shrink |
| `loader` | Per-extension loader (`ts`, `json`, `text`, `dataurl`, …) | defaults suffice; override for assets |
| `define` / `inject` | Compile-time constant substitution / shims | optional |

## Tree-Shaking

- esbuild tree-shakes by default when `bundle: true` and the code is ESM-style (static `import`/`export`). Dead exports are dropped.
- Effectiveness depends on side-effect-free modules; mark packages `"sideEffects": false` where true. **Barrel `index.ts` files can defeat tree-shaking** (see `quality-typescript.md`).
- CJS dependencies tree-shake worse than ESM ones — prefer ESM deps when there's a choice.

## Watch + Plugins (Problem Matcher)

- `ctx.watch()` (incremental rebuild context API) is the modern watch; far faster than re-invoking esbuild.
- The **esbuild problem-matcher plugin** hooks `build.onStart` / `build.onEnd` to print `[watch] build started` / `[watch] build finished` and format errors with `file:line:col`, so VS Code's task problem matcher surfaces build errors inline:

```js
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"));
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log("[watch] build finished");
    });
  },
};
```

Wire dev via `.vscode/tasks.json` running esbuild `--watch` and `tsc --watch --noEmit` in parallel.

## Limitations

- **No type checking** — esbuild strips types blindly. Always run `tsc --noEmit` separately (CI gate + watch). This is the single most important esbuild caveat.
- **No declaration (`.d.ts`) emit** — use `tsc` if you need types published (not needed for an app-style extension).
- Limited support for some advanced TS features that need full type info (e.g. `const enum` inlining, legacy `experimentalDecorators` emit nuances) — covered by the strict-TS guidance in `quality-typescript.md` (avoid `enum`, use standard decorators).
- Not a task runner — orchestrate watch/type-check/lint via npm scripts + `.vscode/tasks.json`.

## Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| `vscode` missing from `external` | `external: ["vscode"]` |
| `format: "esm"` for the extension entry | Use `"cjs"` (host requirement) |
| Expecting esbuild to fail on type errors | Run `tsc --noEmit` separately |
| `minify` always on | Gate behind `--production` |
| Re-invoking esbuild per change instead of `ctx.watch()` | Use the incremental context watch |
| Dropping the problem-matcher plugin | Keep it — inline error reporting in the dev loop depends on it |

## Sources

- [Bundling Extensions (VS Code)](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) — canonical `esbuild.js`, options, problem-matcher plugin
- [esbuild documentation](https://esbuild.github.io/) — API, options, content types, tree-shaking
- [esbuild Bundling concept](https://esbuild.github.io/api/#bundle)
- [esbuild Watch / Context API](https://esbuild.github.io/api/#watch)
