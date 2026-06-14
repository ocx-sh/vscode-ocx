# Product Context — OCX VS Code Extension

> A VS Code extension that brings OCX (the OCI-registry-backed binary package manager) into the editor.

This rule = canonical product identity for the **extension**. Read when reasoning about project direction, scope, trade-offs, ADR motivation, research framing, doc narratives. For the OCX product itself, see the OCX repo's `product-context.md` — this file covers only the editor integration.

## What OCX Is (one paragraph)

OCX is an OCI-registry-backed binary package manager — a Rust CLI named `ocx` that turns any Docker/OCI registry into a cross-platform binary distribution platform. Projects declare tools in `ocx.toml`; resolved versions are pinned in `ocx.lock`. This extension targets developers who already use (or are adopting) OCX and want first-class editor support for those config files and CLI workflows.

## Who It's For

- **Primary**: Developers using OCX day-to-day — editing `ocx.toml`, running `ocx` commands, switching tool versions inside a project.
- **Secondary**: Platform/infra engineers maintaining OCX-managed toolchains across repos.
- **Non-target**: People who do not use OCX; the extension is not a general-purpose OCI/Docker UI.

## Current State

**Environment injection shipped.** The extension activates on a workspace `ocx.toml`, composes the project environment with the `ocx` CLI (`ocx env`), and injects it into the extension host's `process.env` (always) and — opt-in — integrated terminals/tasks (`ocx.env.applyToTerminals`, **default off**; OCX will own a terminal hook). It also ships five commands (reload, reset, restartExtensions, showOutput, init), a status-bar indicator, file-watch reload, workspace-trust gating, and `ocx.toml` schema validation. The capabilities under **Product Vision** below remain **roadmap, not present**.

## Product Vision — What It Will Do

Planned capabilities (future work, sequenced roughly by value):

1. **`ocx.toml` / `ocx.lock` authoring** — schema validation + IntelliSense (completion, hover, diagnostics) for the config files. Likely via a JSON-schema contribution and/or a language feature provider.
2. **Run `ocx` CLI commands** — commands/tasks that invoke the `ocx` binary (install, select, upgrade, clean) from the Command Palette, surfacing output in an output channel / terminal.
3. **Package & version browsing** — a view (TreeView) to browse known packages and available versions from the registry/index.
4. **Status bar active versions** — show the currently selected tool versions for the active project in the status bar.

## Non-Goals

- **Not** a Docker/OCI registry manager or image-build UI.
- **Not** a reimplementation of `ocx` logic in TypeScript — the extension shells out to / wraps the real `ocx` binary; it does not duplicate package-manager behavior.
- **Not** a replacement for the `ocx` CLI for power users; it augments the editor experience.
- **Not** bundling the `ocx` binary — the extension expects `ocx` to be installed/resolvable (discovery + guidance is in scope; vendoring is not).
- **No** telemetry beyond what VS Code provides by default unless explicitly designed and disclosed.

## Scope Discipline

When evaluating a feature request, ask: does it make editing `ocx.toml`/`ocx.lock`, running `ocx`, or seeing OCX state in the editor better? If not, it likely belongs in the `ocx` CLI itself, not here. Keep the extension a **thin, well-behaved editor surface** over the existing CLI (see `arch-principles.md`).

## Update Protocol

This file = single source of truth for the extension's identity and scope. Update in the same change when any of these shift:

1. A roadmap capability ships (move it out of "What It Will Do" into a "Current State" note).
2. Target-user list changes.
3. A non-goal is reconsidered (record the decision; prefer an ADR for one-way doors).
4. Scope boundary moves (e.g., deciding to vendor the binary after all).
