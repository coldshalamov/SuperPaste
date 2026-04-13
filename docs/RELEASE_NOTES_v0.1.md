# SuperPaste v0.1 Release Notes

## Release summary

SuperPaste v0.1 ships the core local workflow:
- dual-bank loadouts
- direct slot save and paste hotkeys
- combo queueing and finalization
- latched workflow stances
- saved supers
- profile auto-resolution and manual override
- portable content packs
- local CLI
- tray, dock, editor, and smoke harness

## Shipped features

### Core engine

- Global hotkeys for Bank A and Bank B slot paste
- Global hotkeys for saving clipboard contents into Bank A and Bank B
- Clipboard preservation and restore during paste sequences
- Active-window sampling for profile resolution
- Direct slot paste into the currently focused app
- Combo queue with copy-only, paste, remove-last, clear, and replay

### Combo system

- Stances for latched Bank B workflow slots
- Supers for saved recipes composed from slots and nested supers
- Template variables:
  - `{{clipboard}}`
  - `{{profile}}`
  - `{{active_app}}`
  - `{{date}}`
- Joiner and markdown-oriented assembly rules
- Character count and rough token estimate in the Combo HUD

### UI

- Compact dock with both banks visible
- Editor for profiles, slots, runtime hotkeys, recipes, and packs
- Tray integration for dock, editor, profile switching, panic toggle, and quit
- Toast/status feedback
- Local smoke harness window for manual OS-level testing

### Data and tooling

- AppData persistence for settings and profiles
- Backup-aware config recovery path
- Portable content pack import and export
- Example packs and starter template packs
- Local CLI for profile and pack operations plus combo previewing

## Seeded defaults

The default global workflow bank includes:
- Patch only
- Summarize before edit
- Write tests first
- Do not widen auth/security gates
- Output changed files only
- Repo sweep / bug hunt scaffold
- Explain root cause first

Shipped packs:
- `packs/example-profile-pack.superpaste.json`
- `packs/workflow-only.superpaste.json`
- `packs/repo-starter-template.superpaste.json`

## Known caveats

- Clipboard restore is currently text-first, not full rich-clipboard fidelity.
- The app is built and instrumented for direct paste and save into focused Windows apps, but still deserves manual smoke in Notepad, VS Code, and Windows Terminal before broader rollout.
- Native combo-management hotkeys remain conservative relative to the direct slot hotkeys.
- There is no dedicated in-app native log viewer yet.

## Next sensible improvements

- Finish a richer clipboard restore path
- Add dedicated native combo hotkeys for finalize, clear, remove-last, and replay
- Add an in-app diagnostics panel for hotkey registration and native bridge logs
- Add final always-on-top and compact-mode polish

## Release build steps

```powershell
npm run test
npm run packs:release
npm run build
C:\Users\93rob\.cargo\bin\cargo.exe test --manifest-path src-tauri/Cargo.toml
$env:PATH = "C:\Users\93rob\.cargo\bin;$env:PATH"
npm run tauri build
```

Verified release artifacts:
- `src-tauri/target/release/superpaste.exe`
- `src-tauri/target/release/bundle/msi/SuperPaste_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/SuperPaste_0.1.0_x64-setup.exe`
