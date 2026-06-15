<p align="center">
  <img src="assets/logo-128.png" alt="OCX logo" width="128" height="128">
</p>

<h1 align="center">OCX for VS Code</h1>

VS Code support for [OCX](https://github.com/ocx-sh/ocx) — the OCI-registry-backed binary package manager.

Open a folder that contains an `ocx.toml` and the extension composes the
project's toolchain with the `ocx` CLI and injects it into the editor, so
language servers, extensions, terminals, and tasks find the tools your project
declares.

## What it does

- **Extensions & language servers** — the composed `PATH` is injected into the
  extension host, so language servers and other extensions find OCX-managed
  tools (node, go-task, …). Because running extensions cache their environment,
  OCX prompts to **Restart Extensions** when it changes
  (`ocx.restart.automatic` to skip the prompt).
- **Terminals & tasks** *(opt-in)* — enable `ocx.env.applyToTerminals` and
  **newly opened** terminals and tasks get the OCX `PATH`.
- **Run `ocx` from the palette** — resolve the lockfile, pull, upgrade, and
  clean without leaving the editor (see [Commands](#commands)).
- **Live reload** — edits to `ocx.toml`/`ocx.lock` reload the environment
  (`ocx.watchForChanges`).
- **Tool groups** *(opt-in)* — set `ocx.groups` to compose specific groups from
  `ocx.toml` (`default`, a named `[group.*]`, or `all`) instead of only the
  default group.
- **Status bar** — shows the loaded state; click to reload.

Environment injection mutates `PATH`, so it runs only in a **trusted** workspace.

## Commands

Run from the Command Palette (or bind to a key — see [Tasks & keybindings](#using-ocx-with-tasks)).

| Command | Does |
| --- | --- |
| `OCX: Reload Environment` | Recompute and re-apply the environment |
| `OCX: Reset Environment` | Restore the baseline environment |
| `OCX: Restart Extensions` | Restart the extension host (reload window on remote) |
| `OCX: Show Output` | Open the OCX output channel |
| `OCX: Initialize ocx.toml` | Run `ocx init` in the workspace folder |
| `OCX: Resolve Lockfile` | Run `ocx lock` — resolve tool tags to digests in `ocx.lock` |
| `OCX: Pull Tools` | Run `ocx pull` — pre-warm the object store (forwards `ocx.groups` as `--group`) |
| `OCX: Upgrade Tools` | Run `ocx upgrade` — re-resolve every locked tag to its newest digest |
| `OCX: Clean Object Store` | Run `ocx clean` — remove unreferenced objects from the local store |

The four `ocx` lifecycle commands run against the workspace `ocx.toml`, stream
output to the OCX channel, and (except `clean`) reload the environment afterward.

## Using OCX with tasks

The commands above run from the Command Palette, not from `tasks.json`. There is
**no custom OCX task type** — built-in `shell`/`process` tasks already work, so
you run the OCX-managed tools (or `ocx` itself) directly.

### Run a toolchain binary

Enable `ocx.env.applyToTerminals` so tasks inherit the OCX `PATH`, then add the
task. The setting takes effect in **newly created** task/terminal processes
(reopen terminals or reload the window).

`.vscode/settings.json`:

```jsonc
{ "ocx.env.applyToTerminals": true }
```

`.vscode/tasks.json`:

```jsonc
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "type": "process",     // direct exec — no shell quoting
      "command": "go-task",  // any tool from ocx.toml, resolved on the injected PATH
      "args": ["build"]
    }
  ]
}
```

### Run `ocx` and chain tasks

`ocx` itself runs as an ordinary task. `dependsOn` lets you chain a lockfile
resolve into a build — something the palette commands cannot do:

```jsonc
{
  "version": "2.0.0",
  "tasks": [
    { "label": "ocx: lock",    "type": "process", "command": "ocx", "args": ["lock"] },
    { "label": "ocx: pull ci", "type": "process", "command": "ocx", "args": ["pull", "--group", "ci"] },
    {
      "label": "lock + build",
      "dependsOrder": "sequence",
      "dependsOn": ["ocx: lock", "build"],
      "group": { "kind": "build", "isDefault": true }  // Ctrl+Shift+B
    }
  ]
}
```

### Bind a command to a key

Palette commands can't go in `tasks.json`, but they are bindable —
`keybindings.json`:

```jsonc
[
  { "key": "ctrl+alt+l", "command": "ocx.lock" },
  { "key": "ctrl+alt+u", "command": "ocx.pull" }
]
```

> **Note:** toolchain binaries (cmake, node, go-task, …) need
> `ocx.env.applyToTerminals`. `ocx` itself only needs to be installed (or
> `ocx.path.executable` set). Use `"type": "shell"` instead of `"process"` when
> a task needs pipes or `&&`.

## Settings

| Setting | Default | Does |
| --- | --- | --- |
| `ocx.path.executable` | `ocx` | Path to (or name of) the `ocx` executable |
| `ocx.enable` | `true` | Load the OCX environment into the editor |
| `ocx.watchForChanges` | `true` | Reload when `ocx.toml`/`ocx.lock` change |
| `ocx.restart.automatic` | `false` | Restart the extension host automatically instead of prompting |
| `ocx.env.applyToTerminals` | `false` | Inject the OCX `PATH` into terminals and tasks |
| `ocx.groups` | `[]` | Tool groups to compose (passed to `ocx env`/`ocx pull` as `--group`) |
| `ocx.extraEnv` | `{}` | Extra environment variables for the `ocx` child process |

## `ocx.toml` validation

This extension contributes a JSON Schema for `ocx.toml` via the
`contributes.tomlValidation` point consumed by
[Even Better TOML](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
(`tamasfe.even-better-toml`). Install it for completion, hover, and diagnostics
on `ocx.toml`. It is listed in the workspace's recommended extensions.

## Requirements

The `ocx` CLI must be installed and resolvable. Set `ocx.path.executable` if it
is not on `PATH`.

## Contributing

Bug reports, feature requests, and PRs welcome. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, build/test
workflow, commit conventions, and the roadmap.

## License

[Apache-2.0](LICENSE)
