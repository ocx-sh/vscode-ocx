# Plan — `ocx.groups` configuration

## Goal

Let the extension pass a configurable set of **tool groups** to `ocx env`, so a
workspace can compose a different environment (e.g. include a `[group.ci]` or
`[group.lint]` table) instead of only the implicit default group.

## CLI ground truth (verified against `~/dev/ocx`, v0.3.8)

- `ocx env` (`toolchain_env.rs`) composes via
  `compose_tool_set(config, lock, &[DEFAULT_GROUP], …)` — **hardcoded to the
  default group**; it does **not** yet accept a group flag (installed 0.3.7 and
  repo HEAD 0.3.8 both reject `--group` on `env`).
- The established CLI convention (`ocx run`, `ocx pull`): `-g`/`--group`,
  repeatable + comma-delimited, `Vec<String>`. Semantics:
  - `default` → the implicit `[tools]` table.
  - `all` → `default` + every `[group.*]`.
  - **Omitted ⇒ default group only** (NOT "everything"). `compose_tool_set`
    never auto-includes default; the selected groups are exactly what compose.
- Global flags (`--format`, `--project`) precede the subcommand; a group flag is
  a **subcommand** flag → goes **after** `env`.

## Design

- Add an opt-in `ocx.groups: string[]` setting, **default `[]`**.
- Empty ⇒ no `--group` argument ⇒ byte-for-byte the current invocation ⇒ **zero
  behavior change / zero regression** for existing users.
- Non-empty ⇒ append one `--group <name>` token per entry, after `env`, in
  order. Mirrors the CLI's own `-g` semantics 1:1 (`default`, `all`, named).
- Forward-looking: the feature is correct the moment `ocx env` learns `--group`
  (the extension repo is a thin surface over the CLI — it does not reimplement
  CLI logic, per `product-context.md`). Until then the setting is opt-in and the
  CLI's clap usage error surfaces through the existing error channel.

## Changes

| File | Change |
|---|---|
| `src/config.ts` | `OcxConfig.groups: readonly string[]`; read `groups`, trim + drop blank entries at the boundary. |
| `src/ocx.ts` | `RunEnvOptions.groups`; extract pure `buildEnvArgs()` (argv builder) and use it in `runEnv`. |
| `src/extension.ts` | Pass `groups: config.groups` into `runEnv`. |
| `package.json` | Contribute `ocx.groups` (array of string, default `[]`, markdownDescription documenting `default`/`all`/named + the CLI requirement). |
| `src/test/ocx.test.ts` | Unit-test `buildEnvArgs`: empty groups, single, multiple, ordering, global-flags-before-`env`, blank filtering. |
| `README.md`, `CHANGELOG.md`, `product-context.md`, `CLAUDE.md` | Document the new setting / current state. |

## Non-changes (scope discipline)

- **No** edit to the `ocx` CLI repo (different repo; out of scope).
- **No** schema change — `ocx.toml` already models `[group.<name>]`.
- **No** change to the env fingerprint/restart-cache: a group change alters the
  composed entries, which already flows through `envFingerprint` → `changed` →
  restart prompt.
- **Not** added to `restrictedConfigurations`: env injection is fully skipped in
  untrusted workspaces, so `ocx.groups` never takes effect there anyway.

## Verification

- `buildEnvArgs` unit tests (pure, no host).
- `npm run check` (lint + types + build) and `npm test` (integration host).
- Adversarial multi-lens review (correctness, CLI fidelity, TS quality, tests,
  scope/docs); fix findings; re-verify.

## Review outcome (4-dimension adversarial workflow, 18 agents)

5 confirmed findings; all resolved.

- **block ×2 (correctness + CLI-fidelity), same root:** `ocx env` (v0.3.8) has
  no `--group` flag (`toolchain_env.rs` hardcodes the default group) — verified
  empirically (`ocx env --group ci` → `error: unexpected argument '--group'
  found`, exit 64). The flag lives on `run`/`pull`, not `env`.
  - **Resolution:** keep the feature (explicitly requested, opt-in, default
    `[]` = zero regression, wire matches the CLI convention exactly), but make
    it **degrade gracefully**: detect the unknown-`--group` failure
    (`isUnsupportedGroupFlag`) and surface an actionable hint ("update `ocx` or
    clear `ocx.groups`") instead of the raw clap error. The matching CLI change
    (`ocx env --group`) is a separate-repo (`~/dev/ocx`) feature, out of scope
    for this extension task — **not** modified autonomously.
- **suggest:** runtime diagnostic for the rejected flag → added
  (`isUnsupportedGroupFlag` + `extension.ts` hint).
- **suggest:** `normalizeGroups` return type → `readonly string[]`.
- **suggest:** untested trim-but-keep path → existing argv test now feeds
  `['  ', '  ci  ', 'lint']` (proves blank-drop + trim) and a dedicated
  `isUnsupportedGroupFlag` unit suite added.

Gate after fixes: `npm run check` clean, prettier clean, `npm test` 43 passing.
