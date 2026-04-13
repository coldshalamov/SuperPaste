# SuperPaste Product Spec

## Product goal

SuperPaste is a local desktop app that makes prompt assembly for coding agents feel like a fighting-game combo system.

The product is intentionally narrow:
- local only
- Windows-first
- no cloud
- no auth
- no telemetry
- no AI integration inside the app

## Core model

Two banks of ten slots:
- Bank A = repo, file, repro, log, and context bundles
- Bank B = workflows, constraints, wrappers, and reusable operator moves

This is a loadout architecture, not a bucket of clips.

## Primary interaction model

Direct slot moves:
- `Ctrl+1..0` paste Bank A
- `Ctrl+Alt+1..0` paste Bank B
- `Ctrl+Shift+1..0` copy the focused selection into Bank A
- `Ctrl+Alt+Shift+1..0` copy the focused selection into Bank B
- Matching numpad digits mirror the same Bank A and Bank B slots for paste and save.

Combo controls:
- queue slots from either bank
- queue supers
- remove last
- clear queue
- copy-only finalize
- paste finalize
- replay last finalized combo

## Profile model

Global profile:
- owns the shared workflow bank
- owns reusable Bank B defaults
- owns reusable supers

Workspace profile:
- owns repo-specific Bank A
- inherits Bank B from the global profile by default
- can override Bank B slots only when needed

Resolution:
- workspace path
- process name
- window title
- optional manual override

## Shipped feature set

### Direct moves

- Direct paste from any enabled slot
- Direct save of current clipboard into a slot
- Click-to-paste and click-to-edit from the dock

### Stances

Bank B workflow slots can be latched on.

While latched, they are automatically included in future combo output until toggled off.

Example stance use cases:
- Patch only
- Do not widen auth/security gates

### Supers

Saved recipes can contain:
- slot references
- nested supers

Recipes can define:
- name
- description
- joiner metadata
- optional hotkey hint

### Template variables

Supported variables:
- `{{clipboard}}`
- `{{profile}}`
- `{{active_app}}`
- `{{date}}`

These enable wrapper-style workflow slots and reusable recipe output.

### Output assembly

Assembly is controlled by:
- profile joiner
- recipe joiner
- slot assembly role

Current slot assembly roles:
- append
- prepend
- wrap

The default output style is clean markdown-oriented prompt assembly.

### Meter

The dock exposes:
- current assembled character count
- rough token estimate

### Packs

Portable `.superpaste.json` content packs support:
- import
- export
- example starter packs

Portable packs include:
- profiles
- slots
- supers
- matching rules

Portable packs intentionally exclude machine-local runtime state such as:
- hotkey bindings
- panic mode
- manual profile override

### Local CLI

The local CLI supports:
- listing profiles
- activating a profile override
- clearing override
- evaluating profile matching
- importing a pack
- exporting a pack
- previewing assembled combo output

## Seeded defaults

Global workflow bank ships with:
- Patch only
- Summarize before edit
- Write tests first
- Do not widen auth/security gates
- Output changed files only
- Repo sweep / bug hunt scaffold
- Explain root cause first

Example workspace profile ships with Bank A slots for:
- repo map
- edited files context
- repro and bug trail
- logs and traces

## UI surfaces

Dock:
- active profile
- both banks
- queue and stance actions
- supers strip
- combo HUD
- assembled output preview

Editor:
- profile metadata
- slot content and metadata
- recipe editing
- matching rules
- runtime settings
- pack import and export

Tray:
- show dock
- show editor
- switch profile
- pause or resume hotkeys
- quit

## Safety model

The app favors boring, stable behavior over cleverness.

Safety controls:
- panic switch to pause all hotkeys
- conflict detection and warning summaries
- clipboard preservation and restore during paste sequences
- invalid config recovery with backup fallback
- local smoke harness window for manual verification

## Non-goals for v0.1

- network sync
- cloud accounts
- palettes or menu-first workflows
- heavy animation
- server mode
- experimental chord mode in the default path

## Current caveats

- Clipboard restore is text-first rather than rich clipboard aware.
- Direct paste and save behavior is implemented, but still benefits from manual Windows smoke in real target apps before broader rollout.
- Native combo-management hotkeys are intentionally conservative compared with the direct slot hotkeys.
