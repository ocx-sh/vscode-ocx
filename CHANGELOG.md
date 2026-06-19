# Changelog

All notable changes to the OCX VS Code extension are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-06-19

### Added

- **`ocx.project`** — configure the path to the project manifest (absolute or
  relative to a workspace folder; empty auto-discovers the workspace-root
  `ocx.toml`). Project discovery, file-watching, and the `--project` argument
  now derive from a single `ProjectLocator`, and activation broadens to a
  configured non-root project.

### Fixed

- Resolve `ocx.toml` at the workspace-folder root instead of an arbitrary
  nested match, so `ocx env` and the project subcommands run against the
  intended project (`--project` + cwd).

## [0.1.1] - 2026-06-15

### Added

- **Commands** — run `ocx` project-lifecycle subcommands from the Command
  Palette: Resolve Lockfile (`ocx lock`), Pull Tools (`ocx pull`), Upgrade Tools
  (`ocx upgrade`), and Clean Object Store (`ocx clean`). Output streams to the
  OCX channel; `pull` forwards `ocx.groups` as `--group`; all but `clean` reload
  the environment afterward.

## [0.1.0] - 2026-06-15

### Added

- **Environment injection** — on a workspace `ocx.toml`, compose the project
  environment via the `ocx` CLI (`ocx env`) and inject the resolved
  `PATH`/variables into the extension host's `process.env`, so language servers
  and other extensions find OCX-managed tools. Prompts to **Restart Extensions**
  when the environment changes (`ocx.restart.automatic` to do it automatically).
- **Opt-in terminal/task injection** via `ocx.env.applyToTerminals` (default
  off); the extension-host `PATH` is injected regardless.
- **`ocx.groups`** — select which tool groups (`default`, a named `[group.*]`,
  or `all`) compose the environment, forwarded to `ocx env` as `--group`. Empty
  (default) composes the default group only. Requires an `ocx` whose `ocx env`
  accepts `--group`; otherwise the setting degrades with an actionable error.
- **Commands**: Reload Environment, Reset Environment, Restart Extensions, Show
  Output, Initialize ocx.toml.
- **Status bar** indicator, **file-watch reload** (`ocx.watchForChanges`), and
  **workspace-trust gating** of environment injection.
- **`ocx.toml` schema validation** via the `tomlValidation` contribution.
- Settings: `ocx.path.executable`, `ocx.enable`, `ocx.extraEnv`.
- Project tooling: esbuild bundling, `@vscode/test-cli` integration tests,
  ESLint flat config + Prettier, and GitHub Actions CI/release.

[Unreleased]: https://github.com/ocx-sh/vscode-ocx/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/ocx-sh/vscode-ocx/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/ocx-sh/vscode-ocx/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ocx-sh/vscode-ocx/releases/tag/v0.1.0
