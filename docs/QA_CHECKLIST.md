# SuperPaste QA Checklist

## Automated verification
- [x] `npm run test` passes.
- [x] `npm run test -- src/launcher/__tests__/launch-superpaste.test.ts` passes.
- [x] `npm run packs:release` passes.
- [x] `npm run build` passes.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- [x] `cargo test --release --manifest-path src-tauri/Cargo.toml` passes.
- [x] `npm run tauri build` passes after ensuring `C:\Users\93rob\.cargo\bin` is on `PATH`.
- [x] Release artifacts exist:
  - `src-tauri/target/release/superpaste.exe`
  - `src-tauri/target/release/bundle/msi/SuperPaste_0.1.0_x64_en-US.msi`
  - `src-tauri/target/release/bundle/nsis/SuperPaste_0.1.0_x64-setup.exe`
- [x] `.\superpaste.cmd profiles list` passes.
- [x] `.\superpaste.cmd preview A3 --super checkout-bughunt-super --profile therxspot` passes.

## Domain and combo-model checks
- [x] Seeded settings parse cleanly.
- [x] Seeded profiles parse cleanly.
- [x] Profile inheritance resolves Bank B workflow slots from the global profile.
- [x] Profile inheritance resolves assembly config from parent profiles when children do not override it.
- [x] Manual profile override wins over match rules.
- [x] Global profile fallback works when no workspace rule matches.
- [x] Queueing preserves explicit slot and recipe order.
- [x] Remove-last only trims queued entries.
- [x] Cancel clears queued entries while keeping latched stances.
- [x] Replay last returns the previous finalized packet.
- [x] Empty combos do not finalize.
- [x] Latched Bank B stances are included in future combos until toggled off.
- [x] Latched wrap stances envelop the assembled combo output instead of appending at the end.
- [x] Recipes serialize and parse round-trip with `A2 > B4 > super:foo` style steps.
- [x] Recipes can include slots from either bank and nested supers.
- [x] Template variables resolve deterministically from supplied context:
  - `{{clipboard}}`
  - `{{profile}}`
  - `{{active_app}}`
  - `{{date}}`
- [x] Slot assembly roles behave as expected:
  - `append`
  - `prepend`
  - `wrap`
- [x] Profile-level and recipe-level joiners produce stable markdown-oriented output.
- [x] Meter output includes char count and approximate token estimate.

## Import/export and pack checks
- [x] Portable content-pack round-trip preserves profiles, slots, supers, and match rules.
- [x] Portable content-pack import preserves machine-local settings such as hotkeys, panic mode, and manual override.
- [x] Machine snapshot parse compatibility still works.
- [x] Import/export text parsing rejects invalid shapes with useful validation errors.
- [x] Example packs exist under `packs/`.

## CLI checks
- [x] `profiles list` prints the known seeded profiles.
- [x] `profiles activate <id>` updates manual override state.
- [x] `profiles clear-override` removes the manual override.
- [x] `profiles match --workspace ... --process ... --title ...` resolves the same profile logic used by the app.
- [x] `packs import <file>` applies portable content without replacing local runtime settings.
- [x] `packs export [file]` writes a valid portable content pack.
- [x] `preview ...` prints assembled output plus char and token meter data.
- [x] CLI remains local-only and does not inject paste into other apps.

## Mock-driven reliability checks
- [x] Paste engine restores the clipboard after a successful paste.
- [x] Paste engine restores the clipboard after a failed paste.
- [x] Paste engine serializes concurrent paste requests.
- [x] `SuperPasteEngine` refreshes active-window context before direct slot paste.
- [x] `SuperPasteEngine` routes Bank A clipboard saves to the resolved workspace profile.
- [x] `SuperPasteEngine` routes Bank B clipboard saves to the global workflow profile by default.
- [x] Saving clipboard content into an existing slot preserves slot metadata such as template mode and assembly role.

## UI and renderer checks
- [x] App launches into the compact dock/editor layout.
- [x] Bank A and Bank B are visually distinct.
- [x] Active profile and match reason are visible.
- [x] Dock exposes click-to-paste, queue, edit, replay, cancel, and remove-last controls.
- [x] Combo HUD shows queued entries, active stances, supers, and meter data.
- [x] Toast feedback exists for recent actions.
- [x] Manual profile switcher is available in the header.
- [x] Slot editor saves label, description, content, template mode, assembly role, enabled state, and hotkey metadata.
- [x] Profile editor saves inheritance, matching rules, and profile-level joiner config.
- [x] Recipe editor saves name, description, step chain, hotkey hint, and joiner config.
- [x] Recipe editor can capture the current combo queue into a recipe draft.
- [x] Export downloads a portable `.superpaste.json` content pack.
- [x] Import from file and import from JSON text both load correctly.
- [x] Renderer tests cover dock rendering, editor save behavior, profile switching UI state, and recipe editing flows.
- [x] Dock and editor remain keyboard-usable without requiring a command palette.

## Native runtime checks
- [x] Native coordinator writes startup status to `AppData/Roaming/com.superpaste.desktop/native.log`.
- [x] Native startup log reports hotkey registration summary.
- [x] Current session startup log confirmed all canonical and numpad alias bindings registered without failures.
- [x] Settings and profiles are persisted under AppData with `.bak` rollover.
- [x] Invalid CLI-side settings/profile documents self-heal from `.bak` or seed defaults on load.
- [x] Rust command bridge exposes:
  - persistence snapshot/save
  - active window snapshot
  - clipboard read/write
  - paste-plan execution
- [x] Local test-harness window can be opened from the header for manual OS-level smoke.
- [x] Release executable launches successfully from `src-tauri/target/release/superpaste.exe`.
- [x] `launch-superpaste.cmd` launches successfully with a stripped `PATH` by repairing Cargo from `%USERPROFILE%\.cargo\bin`.

## Manual Windows smoke
1. Launch SuperPaste and click `Smoke harness`.
2. Focus the harness textarea and copy a known multiline payload into the system clipboard.
3. Press `Ctrl+1` through `Ctrl+0` and confirm Bank A slot output lands in the textarea without leaving the slot text on your clipboard afterward. Repeat with the matching numpad digits.
4. Press `Ctrl+Alt+1` through `Ctrl+Alt+0` and confirm Bank B output lands in the textarea with the same clipboard-restore behavior. Repeat with the matching numpad digits.
5. In VS Code or Notepad, highlight a unique string, press `Ctrl+Shift+5`, then reopen the SuperPaste editor and confirm `A5` for the resolved workspace profile now contains that string and the combo stack contains A5 when auto-queue captures is enabled.
6. Highlight a different unique string, press `Ctrl+Alt+Shift+6`, then confirm `B6` in the global workflow profile now contains that string and the combo stack contains B6 when auto-queue captures is enabled.
7. Toggle `Pause hotkeys`, return to the harness textarea, and confirm slot hotkeys no longer fire. Toggle it back on and verify hotkeys resume.
8. Queue a context slot and a workflow slot in the dock, then use `Paste combo`, `Copy combo`, `Remove last`, and `Clear queue` to confirm the queue stays consistent.
9. Latch a Bank B stance, fire a direct slot paste, and confirm the stance remains active for later combo finalization until you unlatch it.
10. Edit a workflow slot into `template` mode with `{{clipboard}}`, queue a context slot plus that workflow, and confirm the assembled output wraps the current combo text correctly.
11. Trigger rapid repeated slot hotkeys in the harness window and confirm pasted text remains ordered, no duplicate partial pastes appear, and the clipboard returns to the original copied text.
12. Use the tray to open the dock, open the editor, switch to auto mode, switch to a specific profile, and pause/resume hotkeys. Confirm each action updates the visible app state.
13. Export a portable pack, import it back, restart the app, and confirm portable content returns while local hotkey preferences and manual override state remain intact.
14. Repeat steps 3 through 7 in Windows Terminal and VS Code after the harness window passes, because foreground focus timing can differ by host app.
15. Close the app, open a fresh `cmd.exe` window, run `set PATH=C:\Program Files\nodejs;C:\Windows\System32;C:\Windows`, then run `launch-superpaste.cmd`. Confirm the launcher still opens the app without asking you to repair Cargo manually.

## Known caveats from this session
- [x] Hotkey registration health is verified through native startup logs.
- [x] Renderer, CLI, domain, and application-core automation are green.
- [ ] Full foreground-app keystroke proof was not cleanly automatable from this shell session, so human Windows smoke remains the last mile for paste/save behavior.
- [ ] Clipboard restore currently preserves text clipboard contents only, not arbitrary rich clipboard formats.
- [x] Native combo hotkeys for paste, clear, and replay route into the renderer combo buffer.
- [ ] Experimental chord mode is not implemented in this pass.
- [ ] Plain debug-mode `cargo test` can be blocked on this Windows machine by Application Control policy (`os error 4551`), so native verification uses the release-profile test path.
