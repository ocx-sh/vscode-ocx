# Changelog

All notable changes to the OCX VS Code extension are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `ocx.groups` setting: select which tool groups (`default`, `all`, or named
  `[group.*]` tables) compose the injected environment. Passed to `ocx env` as
  `--group`. Empty (default) keeps the current behavior — the default group
  only. Requires an `ocx` version whose `ocx env` accepts `--group`.
- Initial project bootstrap: Hello-World extension with esbuild bundling,
  `@vscode/test-cli` integration tests, ESLint flat config + Prettier, GitHub
  Actions CI, and a curated `.claude/` AI-assistant configuration.
- `OCX: Hello World` command.

[Unreleased]: https://github.com/ocx-sh/vscode-ocx/commits/main
