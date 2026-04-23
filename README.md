# SuperPaste

SuperPaste is a Windows-first local desktop app for assembling coding-agent prompts like a fighting-game combo system instead of a clipboard history pile.

It is built for a very specific workflow:
- Bank A stores repo, file, repro, log, and context moves.
- Bank B stores workflows, constraints, wrappers, and reusable operating modes.
- You fire moves directly into your focused app, queue them into a combo, or latch workflow stances so they stay active until you turn them off.

There is no cloud, no auth, no telemetry, and no networking in the product path.

## Core mental model

Bank A is context:
- repo map
- failing command
- touched files
- logs and traces
- acceptance checks

Bank B is workflow:
- patch only
- summarize before edit
- write tests first
- repo sweep / bug hunt
- do not widen auth or security gates
- output changed files only
- explain root cause first

That split is the whole point. You do not want twenty random clips. You want a loadout architecture.

## Hotkey model

Default hotkeys (numpad-primary, top-row digits also work):
- `Ctrl+Numpad1..0` paste Bank A slots
- `Ctrl+Alt+Numpad1..0` paste Bank B slots
- `Ctrl+Shift+Numpad1..0` capture the focused selection into Bank A slots
- `Ctrl+Alt+Shift+Numpad1..0` capture the focused selection into Bank B slots
- The top-row digit keys mirror the same slots, so both numpad and top-row digits work.
- Save hotkeys synthesize the appropriate copy gesture (`Ctrl+C` for editors, `Ctrl+Shift+C` for terminals) against the focused selection, fall back to the alternate copy chord if the clipboard does not change, then store the captured text in the target slot.
- Captured slots auto-queue by default, so you can load several clips and discharge the assembled stack without opening the dock.
- Paste hotkeys automatically use `Ctrl+Shift+V` in terminal-like windows (Windows Terminal, PowerShell, Opencode, WezTerm, etc.) and `Ctrl+V` everywhere else.

Combo/runtime hotkeys:
- `Ctrl+NumpadEnter` paste the queued combo
- `Ctrl+NumpadDecimal` clear the queue
- `Ctrl+NumpadAdd` replay the last combo
- `Ctrl+NumpadSubtract` toggle the dock window

Safety:
- `Ctrl+Pause` panic toggle — suspends all slot hotkeys.
- The same state is exposed through the tray menu.
- The status bar and native bridge report degraded or conflicting bindings instead of failing silently.
- Persisted legacy hotkey defaults (Alt-based or Ctrl+digit) are automatically migrated to the new numpad defaults on next launch. Custom bindings are never overwritten.

## What the app does

### Direct moves

Any slot can be fired immediately from:
- a global hotkey
- a click in the dock

Saving the current clipboard into a slot is equally direct:
- hit the save hotkey for that bank and slot
- or edit the slot in the loadout editor

### Combo mode

The Combo HUD lets you:
- queue slots from either bank
- queue saved supers
- remove the last queued move
- clear the queue
- copy the assembled output without pasting
- paste the assembled output into the focused app
- replay the last finalized combo
- drive paste, clear, replay, and dock visibility from native hotkeys or the tray menu

The meter shows:
- character count
- rough token estimate

### Stances

Certain Bank B workflow slots are good always-on rules:
- `Patch only`
- `Do not widen auth/security gates`

Those can be latched as stances. Once latched, they are automatically included in future combo output until you unlatch them.

### Supers

Supers are saved recipes made from slots and other supers.

Examples that ship now:
- `repo-bughunt-super`
- `checkout-bughunt-super`

Supers can carry their own joiner metadata and can be fired from the dock with one click.

### Template variables and wrappers

Slots and recipes can use template variables:
- `{{clipboard}}`
- `{{profile}}`
- `{{active_app}}`
- `{{date}}`

This makes wrapper-style workflow moves possible, for example:

```text
Before editing, summarize this context:

{{clipboard}}

Then proceed with the smallest safe patch.
```

### Profile switching

Profiles resolve from:
- workspace path
- process name
- window title

Bank A is meant to be repo-specific. Bank B inherits from the global workflow bank by default.

You can still manually override the active profile from:
- the quick profile switcher
- the tray menu
- the CLI

## UI surfaces

### Dock

The compact dock is the main surface:
- active profile and match reason
- both 10-slot banks
- queue, latch, edit, paste, and super actions
- combo HUD with queue, stances, and meter
- assembled output preview
- quick access to the smoke harness

### Editor

The editor is for fast maintenance, not ceremony:
- profile metadata and inheritance
- matching rules
- slot label, content, template mode, assembly role, and hotkey metadata
- supers and recipe step editing
- runtime hotkey and clipboard settings
- JSON pack import and export

### Tray

The tray menu supports:
- open dock
- open editor
- switch profile
- pause or resume hotkeys
- quit

## Quick start for coding agents

A practical first session:

1. Launch SuperPaste.
2. Keep Bank A focused on repo-specific context for the project in front of you.
3. Keep Bank B focused on stable workflow moves you want across repos.
4. Save your current repo notes into Bank A with `Ctrl+Shift+Numpad1` (or the matching top-row key).
5. Fire a workflow move from Bank B with `Ctrl+Alt+Numpad1`.
6. Latch a stance like `Patch only` if you want it to stay active for a while.
7. Queue a super, then hit the combo paste hotkey to assemble and paste the whole packet into your coding agent.
8. Export your loadout as a pack once it feels right.

### Easy Windows launcher

If you just want to open the app, double-click `launch-superpaste.cmd` from the repo root.

That launcher will:

- open the built desktop app if `src-tauri/target/release/superpaste.exe` already exists
- otherwise install dependencies if needed, repair Cargo on `PATH` from the default rustup install, build a local release app, and launch it

Why it works this way:

- `tauri dev` is still available for explicit developer runs
- the default launcher now prefers the release path because some Windows environments block Rust debug build-script execution during `tauri dev`
- use `launch-superpaste.cmd --dev` only when you explicitly want the live dev session

The existing `superpaste.cmd` file is the CLI wrapper, not the GUI launcher.

## Shipped defaults

The seeded global workflow bank includes:
- Patch only
- Summarize before edit
- Write tests first
- Do not widen auth/security gates
- Output changed files only
- Repo sweep / bug hunt scaffold
- Explain root cause first

The seeded example workspace profile includes Bank A context slots for:
- repo map
- edited files context
- repro and bug trail
- logs and traces

## Profile packs

Portable pack files live under `packs/`:
- `packs/example-profile-pack.superpaste.json`
- `packs/workflow-only.superpaste.json`
- `packs/repo-starter-template.superpaste.json`

Portable packs intentionally contain:
- profiles
- slots
- supers
- matching rules

Portable packs intentionally do not overwrite machine-local runtime settings:
- global hotkey bindings
- panic mode
- manual profile override

## CLI usage

The local CLI is the sleeper feature. It keeps SuperPaste local and scriptable, which makes it easy to compose with external skills and tooling later.

Examples:

```powershell
.\superpaste.cmd profiles list
.\superpaste.cmd profiles activate therxspot
.\superpaste.cmd profiles clear-override
.\superpaste.cmd profiles match --workspace C:\Users\93rob\Documents\GitHub\TheRxSpot.com --process code.exe
.\superpaste.cmd packs import .\packs\workflow-only.superpaste.json
.\superpaste.cmd packs export .\out\my-pack.superpaste.json
.\superpaste.cmd preview A3 --super checkout-bughunt-super --profile therxspot
```

The next natural CLI expansion is queue-oriented commands such as:
- `superpaste activate <profile>`
- `superpaste import-pack <file>`
- `superpaste queue A2 B4 B8`

## Build and release

Local development:

```powershell
npm install
npm run test
npm run packs:release
npm run build
npm run tauri dev
```

CLI examples:

```powershell
npm run cli -- profiles list
.\superpaste.cmd profiles list
```

Release build:

```powershell
npm run test
npm run packs:release
npm run build
C:\Users\93rob\.cargo\bin\cargo.exe test --release --manifest-path src-tauri/Cargo.toml
$env:PATH = "C:\Users\93rob\.cargo\bin;$env:PATH"
npm run tauri build
```

On this Windows machine, plain debug-mode `cargo test` can be blocked by Application Control policy (`os error 4551`), so the verified native test path is `cargo test --release`.

Verified release artifacts for `v0.1.0`:
- `src-tauri/target/release/superpaste.exe`
- `src-tauri/target/release/bundle/msi/SuperPaste_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/SuperPaste_0.1.0_x64-setup.exe`

## Manual smoke harness

Use `Smoke harness` from the dock to open a local textarea window for end-to-end checks:
- direct slot paste
- direct slot save
- clipboard restore
- combo paste
- stance behavior
- profile switching

The exact smoke steps live in `docs/QA_CHECKLIST.md`.

## Known caveats

- Clipboard restore is currently text-first rather than fully rich-content aware.
- Terminal copy capture depends on the terminal supporting `Ctrl+Shift+C` for selection copy. Most modern terminals (Windows Terminal, WezTerm, Alacritty) support this by default.
- Legacy console apps (`cmd.exe`, `conhost.exe`) may not support `Ctrl+Shift+C` — use a modern terminal instead.
- Conflict diagnostics exist, but there is not yet a dedicated in-app log viewer for native events.

## Documentation

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/QA_CHECKLIST.md`
- `docs/BUG_HUNT.md`
- `docs/RELEASE_NOTES_v0.1.md`
