---
paths:
  - "src/test/**"
  - ".vscode-test.*"
---

# Subsystem: Tests

Integration tests run **inside a real VS Code instance** via `@vscode/test-cli` + `@vscode/test-electron`. Test-stack rationale: `product-tech-strategy.md`.

## Why Tests Run in VS Code

Extension code calls the `vscode` namespace, which only exists inside the extension host. So tests are not plain unit tests — `@vscode/test-electron` **downloads a real VS Code build**, launches it, loads the extension, and runs the test suite in the host. This catches activation, command-registration, and contribution wiring that mocks would miss. (Pure domain/service logic with no `vscode` dependency can still be unit-tested standalone — keep that logic in `vscode`-free modules per `arch-principles.md`.)

## The Pipeline

```
src/test/**/*.ts  ──tsc──▶  out/test/**/*.js
                              │
        .vscode-test.mjs ─────┤ (config: which compiled files, VS Code version, mocha opts)
                              ▼
   @vscode/test-cli → @vscode/test-electron → downloaded VS Code runs the Mocha suite
```

Tests are compiled with `tsc` to `out/` (NOT bundled by esbuild — bundling is for the shipped extension only; `out/` is excluded from the `.vsix` via `.vscodeignore`).

## `.vscode-test.mjs`

The `@vscode/test-cli` config (ESM). Declares the compiled test glob, VS Code version, and Mocha options:

```js
import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/test/**/*.test.js",
  version: "stable",            // or "insiders" / a pinned version
  mocha: { ui: "tdd", timeout: 20000 },
});
```

Run with `vscode-test` (the CLI binary), typically wired as the `test` npm script after a `pretest` that runs `tsc` + lint.

## Mocha Suite Structure

```ts
import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  test("activates and registers helloWorld command", async () => {
    const ext = vscode.extensions.getExtension("ocx-sh.ocx");
    await ext?.activate();
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes("ocx.helloWorld"));
  });
});
```

- Files end in `.test.ts`, compile to `.test.js` under `out/test/`.
- Use `suite()` / `test()` (Mocha TDD UI) to match the generator default; assertions via node:assert.
- Tests run in the host, so `vscode` is fully available — exercise real commands, not mocks.

## Linux CI: xvfb

VS Code is an Electron app and needs a display server. On headless Linux runners, wrap the test command in xvfb:

```yaml
- run: xvfb-run -a npm test     # Linux only
```

macOS and Windows runners have a usable display; no xvfb needed there. See `subsystem-ci.md`.

## Conventions

- Test sources live under `src/test/`; keep helpers/fixtures alongside.
- One behavior per `test()`; descriptive suite names (DAMP over DRY in tests — see `quality-core.md`).
- Don't assert on wall-clock timing; use Mocha timeouts generously (host startup is slow).
- Keep `vscode`-free logic unit-testable separately so the slow host suite stays small.

## Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Bundling tests with esbuild | Compile tests with `tsc` to `out/`; esbuild is for `dist/` only |
| Running `npm test` on Linux CI without xvfb | Wrap in `xvfb-run -a` |
| Mocking the entire `vscode` namespace | Run in the real host via test-electron; mock only at service boundaries |
| Shipping `out/` in the `.vsix` | Exclude via `.vscodeignore` |
