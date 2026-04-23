# SuperPaste Architecture

## Design stance
SuperPaste is still split into two deliberate halves:
- a testable TypeScript combo/domain core
- a boring Windows-native coordinator for hotkeys, active-window detection, clipboard timing, and direct paste

The hardening rule for this pass was simple: keep the dangerous features, but make the failure modes boring and recoverable.

## Layer map

### 1. Domain core (`src/domain`)
Pure TypeScript. No React and no OS calls.

Owns:
- schemas for settings, profiles, slots, supers, packs, combo buffer, and documents
- profile inheritance and matching
- slot assembly roles:
  - `append`
  - `prepend`
  - `wrap`
- template expansion for:
  - `{{clipboard}}`
  - `{{profile}}`
  - `{{active_app}}`
  - `{{date}}`
- combo finalize / cancel / remove-last / replay
- recipe parsing and serialization
- pack materialization rules
- local hotkey conflict detection

Key files:
- `src/domain/models.ts`
- `src/domain/combo-engine.ts`
- `src/domain/profile-resolution.ts`
- `src/domain/import-export.ts`
- `src/domain/recipes.ts`
- `src/domain/hotkeys.ts`

### 2. Application core (`src/core`)
The orchestration layer that keeps UI and native input paths on the same behavior surface.

Key class:
- `SuperPasteEngine`

Owns:
- serialized action execution so rapid inputs do not overlap
- active-window refresh before paste/save decisions
- active profile resolution
- Bank A save routing to the resolved workspace profile
- Bank B save routing to the global workflow profile by default
- direct slot paste
- combo finalize through the paste engine
- blank-clipboard save rejection so empty clipboard reads do not erase slots

### 3. UI shell (`src/components`, `src/hooks`, `src/App.tsx`)
React surface for the product.

Owns:
- compact dock and combo HUD
- profile quick switcher
- slot/profile/settings editor
- recipe editor and "capture current combo" path
- import/export pack controls
- toast feedback and preview
- local test-harness launcher

`useSuperPasteApp` is the renderer controller. It:
- loads persisted documents
- syncs the native runtime summary
- subscribes to tray commands and native status
- bridges editor actions into `SuperPasteEngine`
- surfaces hotkey conflicts and panic-mode state into the UI

### 4. Local CLI (`src/cli`, `superpaste.cmd`)
Local-only command-line control surface for packs, profiles, and preview.

Current commands:
- `profiles list`
- `profiles activate <id>`
- `profiles clear-override`
- `profiles match --workspace <path> --title <title> --process <name>`
- `packs import <file>`
- `packs export [file]`
- `preview A2 B4 --super checkout-bughunt-super [--profile therxspot]`

Important boundary:
- CLI is intentionally an offline admin/preview tool
- CLI does not inject paste into other apps
- CLI does not mutate live combo session state across invocations

### 5. Platform contracts (`src/platform`)
Mockable interfaces for:
- `ActiveWindowProvider`
- `ClipboardGateway`
- `PasteEngine`
- `HotkeyRegistrar`
- `PersistencePort`

This keeps the domain and application core testable without Windows API access.

### 6. Native coordinator (`src-tauri`)
Rust layer that owns:
- tray lifecycle
- AppData persistence
- global slot hotkey registration
- active foreground window sampling
- clipboard transactions
- synthetic paste into the focused app
- tray-to-renderer command emission
- native status logging
- native-side config recovery

## Persistence model

### Documents on disk
- `AppData/Roaming/com.superpaste.desktop/settings.json`
- `AppData/Roaming/com.superpaste.desktop/profiles.json`
- `AppData/Roaming/com.superpaste.desktop/native.log`

Settings and profiles stay separate and versioned.

### Shared envelope helpers
`src/domain/documents.ts` owns the versioned document wrappers so UI, tests, CLI, and the native bridge all use the same envelope shape.

### Durability and recovery
- Tauri persistence keeps atomic replacement plus `.bak` rollover.
- CLI writes use temp-file replacement plus `.bak` rollover.
- Slot-save paths persist immediately rather than batching.
- Invalid JSON is quarantined to `*.invalid-<timestamp>` before recovery.
- CLI recovery rewrites repaired documents back to their primary paths after loading from `.bak` or seed defaults.
- Native save paths now clone documents, persist the clone, then swap runtime state only after disk writes succeed.

## Portable packs vs machine-local state

### Portable content packs
Format:
- `superpaste-content-pack`

Contains:
- profiles
- slots
- supers / recipes
- profile matching rules

Does not contain:
- hotkey bindings
- panic mode
- manual profile override

### Machine snapshot packs
Format:
- `superpaste-machine-snapshot`

Purpose:
- full backup or legacy compatibility

UI export defaults to portable content packs. Import keeps current machine-local settings when a portable pack is applied.

## Assembly pipeline

### Slot assembly roles
- `append`
  - add content after the current combo output
- `prepend`
  - insert content before the current combo output
- `wrap`
  - render the slot as a wrapper around the current combo output via `{{clipboard}}`

### Profile and recipe assembly
- a profile may define its default joiner
- a recipe may override joiner for its own internal steps
- recipes preserve:
  - steps
  - optional hotkey hint metadata
  - assembly joiner

### Stances
Latched Bank B stances stay session state, but they apply through the same assembly-role pipeline. A latched workflow can append, prepend, or wrap rather than only trail the combo as plain text.

## Runtime state separation

Portable / persisted content:
- settings documents
- profiles
- slots
- supers

Session-only runtime state:
- queued combo entries
- active stances
- last finalized packet

That state stays out of portable pack import/export on purpose.

## Reliability guardrails

- Hotkey registration degrades per binding instead of aborting the whole refresh when one shortcut is invalid or reserved.
- Renderer status surfaces hotkey conflicts instead of treating them as invisible internal warnings.
- The dock exposes a first-class `Pause hotkeys` safety switch, and the tray mirrors panic-mode state.
- The native runtime reports readiness from actual registered hotkeys plus panic-mode state instead of assuming success.

## Current flow summaries

### Direct slot paste
1. Native hotkey fires in Rust.
2. Rust samples the active foreground window.
3. Rust resolves the active profile.
4. Rust materializes the effective bank slot.
5. Rust writes the slot payload, synthesizes paste, and restores the original text clipboard if configured.

### Combo finalize
1. UI queues slots and supers into the combo buffer.
2. `SuperPasteEngine` resolves the active profile before finalize.
3. `finalizeCombo()` expands queued recipe steps, applies stance steps, renders variables, and calculates meter data.
4. The paste engine executes in:
   - `copy-only`
   - `paste-now`
   - `queue-only`

### Save-to-slot
1. Active window is resolved first.
2. Native capture sends the preferred copy chord for the detected host and falls back to the alternate chord if the clipboard does not change.
3. Bank A saves into the resolved workspace profile.
4. Bank B saves into the global workflow profile by default.
5. Existing slot metadata such as template mode and assembly role is preserved.
6. Blank clipboard reads become an explicit no-op instead of overwriting a slot.
7. Captured slots auto-queue by default through a renderer command, so the same hotkey path can build a combo stack.

### Manual smoke harness
1. The main shell can open a dedicated test-harness window.
2. The harness keeps a large focused textarea available for hotkey paste/save verification.
3. QA uses that window first, then repeats the same smoke flow in external hosts like Notepad, VS Code, and Windows Terminal.

## Verified status on 2026-04-13

Passed:
- `npm run test`
- `npm run build`
- `C:\Users\93rob\.cargo\bin\cargo.exe check --manifest-path src-tauri/Cargo.toml`
- `C:\Users\93rob\.cargo\bin\cargo.exe test --manifest-path src-tauri/Cargo.toml`
- `C:\Users\93rob\.cargo\bin\cargo.exe build --manifest-path src-tauri/Cargo.toml`
- `.\superpaste.cmd profiles list`
- `.\superpaste.cmd preview A3 --super checkout-bughunt-super --profile therxspot`

## Current caveats

- Direct slot paste/save hotkeys and combo finalize/cancel/replay hotkeys are native and route into the same renderer combo buffer.
- Manual Windows foreground-app smoke is still recommended for last-mile proof in VS Code, Windows Terminal, and Notepad.
- Clipboard restore currently preserves text clipboard contents only.
- Native workspace-path matching is still weaker than title/process matching.
- `useSuperPasteApp` remains the biggest renderer-side file and is still the likeliest extraction candidate if another large UI pass lands.
