---
paths:
  - ".github/**"
---

# Subsystem: CI / Workflows

GitHub Actions for the OCX VS Code extension: lint, type-check, test across OSes, package, and (on tag) dual-publish. Test mechanics: `subsystem-tests.md`. Build mechanics: `subsystem-build.md`.

## CI Workflow (`ci.yml`)

Trigger: push + pull_request. Matrix across OS and Node:

```yaml
strategy:
  fail-fast: false
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [20, 22]
```

Per-leg steps (conceptually):

1. `actions/checkout`
2. `actions/setup-node` with the matrix `node` + npm cache
3. `npm ci`
4. `npm run lint` (ESLint flat config) + `npm run check-types` (`tsc --noEmit`)
5. `npm run compile` (esbuild) — confirms the bundle builds
6. **Tests** — wrapped in xvfb **only on Linux**:

```yaml
- name: Test (Linux)
  if: runner.os == 'Linux'
  run: xvfb-run -a npm test
- name: Test (macOS/Windows)
  if: runner.os != 'Linux'
  run: npm test
```

xvfb is required because `@vscode/test-electron` launches a real (Electron) VS Code that needs a display server on headless Linux. See `subsystem-tests.md`.

### VSIX artifact

Build the package once and upload it for inspection / downstream use:

```yaml
- run: npx @vscode/vsce package --no-dependencies -o extension.vsix
- uses: actions/upload-artifact@<sha>   # v4
  with: { name: vsix, path: extension.vsix, retention-days: 7 }
```

`--no-dependencies` is safe because esbuild already bundled deps into `dist/` (`subsystem-build.md`).

## Release Workflow (`release.yml`)

Trigger: tag push matching `v*` (e.g. `v1.2.3`).

1. Build + test (reuse the CI steps or a composite action).
2. `vsce package` → `.vsix`.
3. **Dual publish, gated on secrets** — inert if the secret is absent:

```yaml
- name: Publish to VS Code Marketplace
  if: ${{ env.VSCE_PAT != '' }}
  env: { VSCE_PAT: ${{ secrets.VSCE_PAT }} }
  run: npx @vscode/vsce publish --pat "$VSCE_PAT"

- name: Publish to Open VSX
  if: ${{ env.OVSX_PAT != '' }}
  env: { OVSX_PAT: ${{ secrets.OVSX_PAT }} }
  run: npx ovsx publish extension.vsix --pat "$OVSX_PAT"
```

- **`VSCE_PAT`** → VS Code Marketplace via `vsce`.
- **`OVSX_PAT`** → Open VSX via `ovsx` (covers VSCodium / non-Marketplace clients).
- The `if:` guard means forks and secret-less environments run the workflow to the build/package stage and simply skip publish — never fail for a missing secret.

## Security & Hygiene

- **SHA-pin every third-party action**: `uses: owner/action@<full-sha>  # vX.Y.Z`. Floating tags are mutable.
- **Least-privilege `GITHUB_TOKEN`**: declare `permissions:` at the workflow level (`contents: read` default); elevate per-job only where needed (e.g. `contents: write` for a release that creates a GitHub Release).
- **Secrets via `env:` intermediary**, never interpolated directly into a `run:` script (blocks shell injection).
- **Concurrency** on every workflow:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

## Cost Notes

| Factor | Guidance |
|--------|----------|
| Runner OS | Linux cheapest, Windows ~2x, macOS ~10x. Keep the full OS matrix on CI (cross-platform extension), but don't add redundant jobs. |
| Matrix breadth | `os × node` is the floor; resist adding axes without a reason. |
| Artifact retention | `retention-days: 7` for the VSIX; shorter for inter-job passing. |
| node cache | Use `setup-node` built-in npm cache to skip re-download. |

## Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| `npm test` on Linux without xvfb | `xvfb-run -a npm test` (Linux leg only) |
| `@v4` tag without SHA | Pin to full commit SHA + version comment |
| Publish step fails when secret absent | Guard with `if: ${{ env.<PAT> != '' }}` |
| Default broad `GITHUB_TOKEN` permissions | Set minimal `permissions:` at workflow level |
| Secret interpolated into `run:` directly | Pass via `env:` |
| No concurrency control | Add the `concurrency:` block |
