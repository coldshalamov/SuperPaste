use arboard::Clipboard;
use chrono::{SecondsFormat, Utc};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs::{self, OpenOptions},
    io::Write,
    mem::size_of,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, RwLock},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use windows::{
    core::PWSTR,
    Win32::{
        Foundation::{CloseHandle, HWND},
        System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
            PROCESS_QUERY_LIMITED_INFORMATION,
        },
        System::DataExchange::GetClipboardSequenceNumber,
        UI::{
            Input::KeyboardAndMouse::{
                GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
                KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_CONTROL, VK_MENU, VK_SHIFT,
            },
            WindowsAndMessaging::{
                GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
                GetWindowThreadProcessId,
            },
        },
    },
};

pub const APP_SCHEMA_VERSION: u32 = 1;
const SETTINGS_FILE: &str = "settings.json";
const PROFILES_FILE: &str = "profiles.json";
const NATIVE_LOG_FILE: &str = "native.log";
const SLOT_DIGITS_STANDARD: [&str; 10] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const SLOT_DIGITS_ZERO_FIRST: [&str; 10] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersistenceSnapshot {
    pub app_data_dir: String,
    pub settings_json: Option<String>,
    pub profiles_json: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ActiveWindowSnapshot {
    pub title: String,
    pub process_name: String,
    pub process_path: String,
    pub workspace_path: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRuntimeSnapshot {
    pub app_data_dir: String,
    pub hotkey_summary: String,
    pub last_status_message: String,
    pub active_window: ActiveWindowSnapshot,
    pub native_paste_ready: bool,
    pub panic_mode_enabled: bool,
}

#[derive(Clone)]
pub struct TrayMenuState {
    pub profiles: Vec<(String, String)>,
    pub active_override_id: Option<String>,
    pub panic_mode_enabled: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStatusPayload {
    pub message: String,
    pub active_window: ActiveWindowSnapshot,
    pub panic_mode_enabled: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PastePlan {
    pub text: String,
    pub execution_mode: String,
    pub restore_clipboard: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasteResult {
    pub ok: bool,
    pub message: String,
    pub copied_text: Option<String>,
}

#[derive(Clone)]
pub struct NativeEngine {
    inner: Arc<NativeEngineInner>,
}

struct LoadDocumentsResult {
    documents: RuntimeDocuments,
    notices: Vec<String>,
}

struct NativeEngineInner {
    app_data_dir: PathBuf,
    documents: RwLock<RuntimeDocuments>,
    execution_lock: Mutex<()>,
    status: RwLock<String>,
    active_window: RwLock<ActiveWindowSnapshot>,
    hotkeys: RwLock<HashMap<String, HotkeyAction>>,
    hotkey_summary: RwLock<String>,
}

#[derive(Clone)]
struct RuntimeDocuments {
    settings_document: SettingsDocument,
    profiles_document: ProfilesDocument,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsDocument {
    version: u32,
    saved_at_iso: String,
    settings: AppSettings,
    #[serde(default, flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfilesDocument {
    version: u32,
    saved_at_iso: String,
    profiles: Vec<Profile>,
    #[serde(default, flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    schema_version: u32,
    theme: String,
    launch_mode: String,
    combo_joiner: String,
    restore_clipboard_after_paste: bool,
    panic_mode_enabled: bool,
    hotkeys: HotkeyMapping,
    ui: serde_json::Value,
    experimental: serde_json::Value,
    active_profile_id_override: Option<String>,
    #[serde(default, flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HotkeyMapping {
    bank_a_paste: Vec<String>,
    bank_b_paste: Vec<String>,
    bank_a_save_clipboard: Vec<String>,
    bank_b_save_clipboard: Vec<String>,
    finalize_combo: String,
    cancel_combo: String,
    replay_last_combo: String,
    toggle_window: String,
    panic_toggle: String,
    #[serde(default, flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Profile {
    id: String,
    name: String,
    kind: String,
    description: String,
    priority: i32,
    extends_profile_id: Option<String>,
    #[serde(default)]
    match_rules: Vec<ProfileMatchRule>,
    bank_a: SlotBank,
    bank_b: SlotBank,
    #[serde(default)]
    supers: Vec<SuperRecipe>,
    #[serde(default, flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileMatchRule {
    id: String,
    kind: String,
    value: String,
    case_sensitive: bool,
    weight_boost: i32,
    #[serde(default, flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SlotBank {
    bank_id: String,
    name: String,
    slots: Vec<SlotDefinition>,
    #[serde(default, flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SlotDefinition {
    id: String,
    bank_id: String,
    slot_index: usize,
    kind: String,
    label: String,
    description: String,
    content: String,
    enabled: bool,
    inheritance_mode: String,
    #[serde(default = "default_template_mode")]
    template_mode: String,
    #[serde(default = "default_assembly_mode")]
    assembly_mode: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default, flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SuperRecipe {
    id: String,
    name: String,
    description: String,
    #[serde(default)]
    steps: Vec<RecipeStep>,
    #[serde(default)]
    sequence: Vec<SlotReference>,
    #[serde(default = "default_true")]
    apply_stances: bool,
    #[serde(default)]
    hotkey_hint: Option<String>,
    #[serde(default)]
    assembly: Option<AssemblyConfig>,
    #[serde(default, flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct SlotReference {
    bank_id: String,
    slot_index: usize,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
enum RecipeStep {
    Slot { slot_ref: SlotReference },
    Super { super_id: String },
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssemblyConfig {
    style: String,
    joiner: String,
    #[serde(default, flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Clone)]
struct ResolvedProfile {
    profile: Profile,
    effective_bank_a: SlotBank,
    effective_bank_b: SlotBank,
    score: i32,
}

#[derive(Clone, Debug)]
enum HotkeyAction {
    PasteSlot { bank_id: char, slot_index: usize },
    SaveClipboardToSlot { bank_id: char, slot_index: usize },
    ToggleWindow,
    PanicToggle,
}

fn default_template_mode() -> String {
    "plain".to_string()
}

fn default_assembly_mode() -> String {
    "append".to_string()
}

fn default_true() -> bool {
    true
}

fn is_reserved_binding(binding: &str) -> bool {
    let normalized = binding.to_ascii_uppercase().replace(' ', "");
    normalized == "ALT+F4" || normalized == "CTRL+ALT+DELETE"
}

fn build_slot_hotkeys(prefix: &str, digits: &[&str; 10]) -> Vec<String> {
    digits
        .iter()
        .map(|digit| format!("{prefix}{digit}"))
        .collect()
}

fn default_hotkeys() -> HotkeyMapping {
    HotkeyMapping {
        bank_a_paste: build_slot_hotkeys("Ctrl+", &SLOT_DIGITS_STANDARD),
        bank_b_paste: build_slot_hotkeys("Ctrl+Alt+", &SLOT_DIGITS_STANDARD),
        bank_a_save_clipboard: build_slot_hotkeys("Ctrl+Shift+", &SLOT_DIGITS_STANDARD),
        bank_b_save_clipboard: build_slot_hotkeys("Ctrl+Alt+Shift+", &SLOT_DIGITS_STANDARD),
        finalize_combo: "Alt+Enter".to_string(),
        cancel_combo: "Alt+Backspace".to_string(),
        replay_last_combo: "Alt+/".to_string(),
        toggle_window: "Alt+`".to_string(),
        panic_toggle: "Alt+Pause".to_string(),
        extra: HashMap::new(),
    }
}

fn matches_binding_pattern(bindings: &[String], prefix: &str, digits: &[&str; 10]) -> bool {
    let expected = build_slot_hotkeys(prefix, digits);
    bindings == expected.as_slice()
}

fn normalize_binding_array(
    bindings: &[String],
    patterns: &[(&str, &[&str; 10])],
    canonical: &[String],
) -> (Vec<String>, bool) {
    if patterns
        .iter()
        .any(|(prefix, digits)| matches_binding_pattern(bindings, prefix, digits))
    {
        return (canonical.to_vec(), true);
    }

    (bindings.to_vec(), false)
}

fn migrate_hotkeys_if_needed(hotkeys: &HotkeyMapping) -> (HotkeyMapping, bool) {
    let defaults = default_hotkeys();
    let (bank_a_paste, a_paste_migrated) = normalize_binding_array(
        &hotkeys.bank_a_paste,
        &[
            ("Alt+", &SLOT_DIGITS_STANDARD),
            ("Ctrl+Numpad", &SLOT_DIGITS_STANDARD),
            ("Ctrl+Numpad", &SLOT_DIGITS_ZERO_FIRST),
        ],
        &defaults.bank_a_paste,
    );
    let (bank_b_paste, b_paste_migrated) = normalize_binding_array(
        &hotkeys.bank_b_paste,
        &[
            ("Ctrl+Alt+Numpad", &SLOT_DIGITS_STANDARD),
            ("Ctrl+Alt+Numpad", &SLOT_DIGITS_ZERO_FIRST),
        ],
        &defaults.bank_b_paste,
    );
    let (bank_a_save_clipboard, a_save_migrated) = normalize_binding_array(
        &hotkeys.bank_a_save_clipboard,
        &[
            ("Alt+Shift+", &SLOT_DIGITS_STANDARD),
            ("Ctrl+Shift+Numpad", &SLOT_DIGITS_STANDARD),
            ("Ctrl+Shift+Numpad", &SLOT_DIGITS_ZERO_FIRST),
        ],
        &defaults.bank_a_save_clipboard,
    );
    let (bank_b_save_clipboard, b_save_migrated) = normalize_binding_array(
        &hotkeys.bank_b_save_clipboard,
        &[
            ("Ctrl+Alt+Shift+Numpad", &SLOT_DIGITS_STANDARD),
            ("Ctrl+Alt+Shift+Numpad", &SLOT_DIGITS_ZERO_FIRST),
        ],
        &defaults.bank_b_save_clipboard,
    );

    let migrated = a_paste_migrated || b_paste_migrated || a_save_migrated || b_save_migrated;

    (
        HotkeyMapping {
            bank_a_paste,
            bank_b_paste,
            bank_a_save_clipboard,
            bank_b_save_clipboard,
            finalize_combo: hotkeys.finalize_combo.clone(),
            cancel_combo: hotkeys.cancel_combo.clone(),
            replay_last_combo: hotkeys.replay_last_combo.clone(),
            toggle_window: hotkeys.toggle_window.clone(),
            panic_toggle: hotkeys.panic_toggle.clone(),
            extra: hotkeys.extra.clone(),
        },
        migrated,
    )
}

impl NativeEngine {
    pub fn initialize(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
        fs::create_dir_all(&app_data_dir)
            .map_err(|error| format!("failed to create app data directory: {error}"))?;

        let loaded = load_or_seed_documents(&app_data_dir)?;
        let status_message = if loaded.notices.is_empty() {
            "Native runtime ready.".to_string()
        } else {
            loaded.notices.join(" ")
        };
        let engine = Self {
            inner: Arc::new(NativeEngineInner {
                app_data_dir,
                documents: RwLock::new(loaded.documents),
                execution_lock: Mutex::new(()),
                status: RwLock::new(status_message.clone()),
                active_window: RwLock::new(ActiveWindowSnapshot::default()),
                hotkeys: RwLock::new(HashMap::new()),
                hotkey_summary: RwLock::new("Registering hotkeys...".to_string()),
            }),
        };

        engine.refresh_hotkeys(app)?;
        engine.refresh_active_window()?;
        let _ = append_native_log(&engine.inner.app_data_dir, &status_message);
        let _ = append_native_log(
            &engine.inner.app_data_dir,
            "Native engine initialized and hotkeys refreshed.",
        );
        Ok(engine)
    }

    pub fn persistence_snapshot(&self) -> Result<PersistenceSnapshot, String> {
        let documents = self
            .inner
            .documents
            .read()
            .map_err(|_| "documents lock poisoned".to_string())?;
        Ok(PersistenceSnapshot {
            app_data_dir: self.inner.app_data_dir.display().to_string(),
            settings_json: Some(
                serde_json::to_string_pretty(&documents.settings_document)
                    .map_err(|error| format!("failed to serialize settings: {error}"))?,
            ),
            profiles_json: Some(
                serde_json::to_string_pretty(&documents.profiles_document)
                    .map_err(|error| format!("failed to serialize profiles: {error}"))?,
            ),
        })
    }

    pub fn save_documents_from_json(
        &self,
        app: &AppHandle,
        settings_json: String,
        profiles_json: String,
    ) -> Result<(), String> {
        let mut settings_document: SettingsDocument =
            serde_json::from_str(&settings_json).map_err(|error| format!("invalid settings json: {error}"))?;
        let profiles_document: ProfilesDocument =
            serde_json::from_str(&profiles_json).map_err(|error| format!("invalid profiles json: {error}"))?;
        let (migrated_hotkeys, migrated) = migrate_hotkeys_if_needed(&settings_document.settings.hotkeys);
        if migrated {
            settings_document.settings.hotkeys = migrated_hotkeys;
            settings_document.saved_at_iso = now_iso();
        }

        persist_documents(
            &self.inner.app_data_dir,
            &settings_document,
            &profiles_document,
        )?;

        {
            let mut documents = self
                .inner
                .documents
                .write()
                .map_err(|_| "documents lock poisoned".to_string())?;
            *documents = RuntimeDocuments {
                settings_document,
                profiles_document,
            };
        }

        self.refresh_hotkeys(app)?;
        self.emit_status(
            app,
            if migrated {
                "Native runtime refreshed from latest saved settings. Migrated hotkeys to Ctrl digit defaults and kept numpad aliases active."
            } else {
                "Native runtime refreshed from latest saved settings."
            },
        )?;
        Ok(())
    }

    pub fn runtime_snapshot(&self) -> Result<NativeRuntimeSnapshot, String> {
        let active_window = self
            .inner
            .active_window
            .read()
            .map_err(|_| "active window lock poisoned".to_string())?
            .clone();
        let hotkey_summary = self
            .inner
            .hotkey_summary
            .read()
            .map_err(|_| "hotkey summary lock poisoned".to_string())?
            .clone();
        let last_status_message = self
            .inner
            .status
            .read()
            .map_err(|_| "status lock poisoned".to_string())?
            .clone();
        let panic_mode_enabled = self
            .inner
            .documents
            .read()
            .map_err(|_| "documents lock poisoned".to_string())?
            .settings_document
            .settings
            .panic_mode_enabled;

        let native_paste_ready = !panic_mode_enabled
            && !self
                .inner
                .hotkeys
                .read()
                .map_err(|_| "hotkeys lock poisoned".to_string())?
                .is_empty();

        Ok(NativeRuntimeSnapshot {
            app_data_dir: self.inner.app_data_dir.display().to_string(),
            hotkey_summary,
            last_status_message,
            active_window,
            native_paste_ready,
            panic_mode_enabled,
        })
    }

    pub fn refresh_runtime(&self, app: &AppHandle) -> Result<NativeRuntimeSnapshot, String> {
        let reloaded = load_or_seed_documents(&self.inner.app_data_dir)?;
        {
            let mut documents = self
                .inner
                .documents
                .write()
                .map_err(|_| "documents lock poisoned".to_string())?;
            *documents = reloaded.documents;
        }
        if !reloaded.notices.is_empty() {
            *self
                .inner
                .status
                .write()
                .map_err(|_| "status lock poisoned".to_string())? = reloaded.notices.join(" ");
        }
        self.refresh_hotkeys(app)?;
        self.refresh_active_window()?;
        self.runtime_snapshot()
    }

    pub fn refresh_active_window(&self) -> Result<ActiveWindowSnapshot, String> {
        let snapshot = sample_active_window()?;
        let mut active_window = self
            .inner
            .active_window
            .write()
            .map_err(|_| "active window lock poisoned".to_string())?;
        *active_window = snapshot.clone();
        Ok(snapshot)
    }

    pub fn read_clipboard_text(&self) -> Result<String, String> {
        read_clipboard_text()
    }

    pub fn write_clipboard_text(&self, text: &str) -> Result<(), String> {
        write_clipboard_text(text)
    }

    pub fn execute_paste_plan(&self, app: &AppHandle, plan: PastePlan) -> Result<PasteResult, String> {
        let _lock = self
            .inner
            .execution_lock
            .lock()
            .map_err(|_| "execution lock poisoned".to_string())?;

        let result = match plan.execution_mode.as_str() {
            "queue-only" => PasteResult {
                ok: true,
                message: "Combo assembled and queued only.".to_string(),
                copied_text: None,
            },
            "copy-only" => {
                write_clipboard_text(&plan.text)?;
                PasteResult {
                    ok: true,
                    message: "Combo copied to clipboard.".to_string(),
                    copied_text: Some(plan.text),
                }
            }
            _ => paste_text_transaction(&plan.text, plan.restore_clipboard),
        };

        self.emit_status(app, &result.message)?;
        Ok(result)
    }

    pub fn handle_shortcut_event(&self, app: AppHandle, shortcut: &Shortcut) {
        let binding = shortcut.to_string();
        let action = self
            .inner
            .hotkeys
            .read()
            .ok()
            .and_then(|hotkeys| hotkeys.get(&binding).cloned());

        if let Some(action) = action {
            let engine = self.clone();
            tauri::async_runtime::spawn(async move {
                let _ = engine.dispatch_hotkey_action(&app, action);
            });
        }
    }

    pub fn emit_status(&self, app: &AppHandle, message: &str) -> Result<(), String> {
        *self
            .inner
            .status
            .write()
            .map_err(|_| "status lock poisoned".to_string())? = message.to_string();
        let _ = append_native_log(&self.inner.app_data_dir, message);
        let active_window = self
            .inner
            .active_window
            .read()
            .map_err(|_| "active window lock poisoned".to_string())?
            .clone();
        let panic_mode_enabled = self
            .inner
            .documents
            .read()
            .map_err(|_| "documents lock poisoned".to_string())?
            .settings_document
            .settings
            .panic_mode_enabled;

        app.emit(
            "native-status",
            NativeStatusPayload {
                message: message.to_string(),
                active_window,
                panic_mode_enabled,
            },
        )
        .map_err(|error| format!("failed to emit native status: {error}"))
    }

    pub fn tray_menu_state(&self) -> Result<TrayMenuState, String> {
        let documents = self
            .inner
            .documents
            .read()
            .map_err(|_| "documents lock poisoned".to_string())?;

        Ok(TrayMenuState {
            profiles: documents
                .profiles_document
                .profiles
                .iter()
                .map(|profile| (profile.id.clone(), profile.name.clone()))
                .collect(),
            active_override_id: documents.settings_document.settings.active_profile_id_override.clone(),
            panic_mode_enabled: documents.settings_document.settings.panic_mode_enabled,
        })
    }
}

impl NativeEngine {
    fn dispatch_hotkey_action(&self, app: &AppHandle, action: HotkeyAction) -> Result<(), String> {
        if !matches!(action, HotkeyAction::PanicToggle | HotkeyAction::ToggleWindow) {
            let panic_mode_enabled = self
                .inner
                .documents
                .read()
                .map_err(|_| "documents lock poisoned".to_string())?
                .settings_document
                .settings
                .panic_mode_enabled;

            if panic_mode_enabled {
                self.emit_status(app, "Panic mode is active. Hotkey ignored.")?;
                return Ok(());
            }
        }

        match action {
            HotkeyAction::PasteSlot { bank_id, slot_index } => {
                let result = self.execute_slot_paste(app, bank_id, slot_index)?;
                self.emit_status(app, &result.message)?;
            }
            HotkeyAction::SaveClipboardToSlot { bank_id, slot_index } => {
                let message = self.save_clipboard_to_slot(bank_id, slot_index)?;
                self.emit_status(app, &message)?;
            }
            HotkeyAction::ToggleWindow => {
                super::toggle_main_window(app);
            }
            HotkeyAction::PanicToggle => {
                let message = self.toggle_panic_mode()?;
                self.emit_status(app, &message)?;
            }
        }

        Ok(())
    }

    fn execute_slot_paste(&self, _app: &AppHandle, bank_id: char, slot_index: usize) -> Result<PasteResult, String> {
        let _lock = self
            .inner
            .execution_lock
            .lock()
            .map_err(|_| "execution lock poisoned".to_string())?;
        let active_window = self.refresh_active_window()?;
        let resolved = self.resolve_profile(&active_window)?;
        let slot = if bank_id == 'A' {
            resolved
                .effective_bank_a
                .slots
                .iter()
                .find(|slot| slot.slot_index == slot_index)
                .cloned()
        } else {
            resolved
                .effective_bank_b
                .slots
                .iter()
                .find(|slot| slot.slot_index == slot_index)
                .cloned()
        };

        let Some(slot) = slot else {
            return Ok(PasteResult {
                ok: false,
                message: format!("Slot {bank_id}{} is missing.", slot_index + 1),
                copied_text: None,
            });
        };

        if !slot.enabled || slot.content.trim().is_empty() {
            return Ok(PasteResult {
                ok: false,
                message: format!("Slot {bank_id}{} is empty.", slot_index + 1),
                copied_text: None,
            });
        }

        let clipboard_text = read_clipboard_text().unwrap_or_default();
        let text = if slot.template_mode == "template" {
            render_template(
                &slot.content,
                &clipboard_text,
                &resolved.profile.name,
                &active_window.process_name,
            )
        } else {
            slot.content.clone()
        };

        Ok(paste_text_transaction(
            &text,
            self.inner
                .documents
                .read()
                .map_err(|_| "documents lock poisoned".to_string())?
                .settings_document
                .settings
                .restore_clipboard_after_paste,
        ))
    }

    fn save_clipboard_to_slot(&self, bank_id: char, slot_index: usize) -> Result<String, String> {
        let _lock = self
            .inner
            .execution_lock
            .lock()
            .map_err(|_| "execution lock poisoned".to_string())?;
        let active_window = self.refresh_active_window()?;
        let clipboard_text = capture_selection_via_ctrl_c()?;
        let resolved = self.resolve_profile(&active_window)?;

        let documents = self
            .inner
            .documents
            .read()
            .map_err(|_| "documents lock poisoned".to_string())?;
        let target_profile_id = if bank_id == 'B' {
            documents
                .profiles_document
                .profiles
                .iter()
                .find(|profile| profile.kind == "global")
                .map(|profile| profile.id.clone())
                .unwrap_or_else(|| resolved.profile.id.clone())
        } else {
            resolved.profile.id.clone()
        };

        let target_profile_name = documents
            .profiles_document
            .profiles
            .iter()
            .find(|profile| profile.id == target_profile_id)
            .map(|profile| profile.name.clone())
            .unwrap_or_else(|| resolved.profile.name.clone());

        let mut next_documents = apply_slot_save_to_documents(
            &documents,
            &target_profile_id,
            bank_id,
            slot_index,
            &clipboard_text,
        );
        drop(documents);

        next_documents.profiles_document.saved_at_iso = now_iso();
        persist_documents(
            &self.inner.app_data_dir,
            &next_documents.settings_document,
            &next_documents.profiles_document,
        )?;

        let mut documents = self
            .inner
            .documents
            .write()
            .map_err(|_| "documents lock poisoned".to_string())?;
        *documents = next_documents;

        Ok(format!(
            "Copied the focused selection and saved it into {target_profile_name} {bank_id}{}.",
            slot_index + 1
        ))
    }

    fn toggle_panic_mode(&self) -> Result<String, String> {
        let documents = self
            .inner
            .documents
            .read()
            .map_err(|_| "documents lock poisoned".to_string())?;
        let mut next_documents = toggled_panic_documents(&documents);
        drop(documents);
        next_documents.settings_document.saved_at_iso = now_iso();
        persist_documents(
            &self.inner.app_data_dir,
            &next_documents.settings_document,
            &next_documents.profiles_document,
        )?;

        let panic_mode_enabled = next_documents.settings_document.settings.panic_mode_enabled;
        let mut documents = self
            .inner
            .documents
            .write()
            .map_err(|_| "documents lock poisoned".to_string())?;
        *documents = next_documents;

        if panic_mode_enabled {
            Ok("Panic mode enabled. Direct slot hotkeys are suspended.".to_string())
        } else {
            Ok("Panic mode disabled. Direct slot hotkeys are live again.".to_string())
        }
    }

    fn refresh_hotkeys(&self, app: &AppHandle) -> Result<(), String> {
        app.global_shortcut()
            .unregister_all()
            .map_err(|error| format!("failed to unregister hotkeys: {error}"))?;

        let settings = self
            .inner
            .documents
            .read()
            .map_err(|_| "documents lock poisoned".to_string())?
            .settings_document
            .settings
            .clone();
        let mut bindings = Vec::new();

        for (slot_index, binding) in settings.hotkeys.bank_a_paste.iter().enumerate() {
            bindings.push((binding.clone(), HotkeyAction::PasteSlot { bank_id: 'A', slot_index }));
            if let Some(numpad) = to_numpad_binding(binding) {
                bindings.push((numpad, HotkeyAction::PasteSlot { bank_id: 'A', slot_index }));
            }
        }
        for (slot_index, binding) in settings.hotkeys.bank_b_paste.iter().enumerate() {
            bindings.push((binding.clone(), HotkeyAction::PasteSlot { bank_id: 'B', slot_index }));
            if let Some(numpad) = to_numpad_binding(binding) {
                bindings.push((numpad, HotkeyAction::PasteSlot { bank_id: 'B', slot_index }));
            }
        }
        for (slot_index, binding) in settings.hotkeys.bank_a_save_clipboard.iter().enumerate() {
            bindings.push((
                binding.clone(),
                HotkeyAction::SaveClipboardToSlot {
                    bank_id: 'A',
                    slot_index,
                },
            ));
            if let Some(numpad) = to_numpad_binding(binding) {
                bindings.push((
                    numpad,
                    HotkeyAction::SaveClipboardToSlot {
                        bank_id: 'A',
                        slot_index,
                    },
                ));
            }
        }
        for (slot_index, binding) in settings.hotkeys.bank_b_save_clipboard.iter().enumerate() {
            bindings.push((
                binding.clone(),
                HotkeyAction::SaveClipboardToSlot {
                    bank_id: 'B',
                    slot_index,
                },
            ));
            if let Some(numpad) = to_numpad_binding(binding) {
                bindings.push((
                    numpad,
                    HotkeyAction::SaveClipboardToSlot {
                        bank_id: 'B',
                        slot_index,
                    },
                ));
            }
        }
        bindings.push((settings.hotkeys.toggle_window.clone(), HotkeyAction::ToggleWindow));
        bindings.push((settings.hotkeys.panic_toggle.clone(), HotkeyAction::PanicToggle));

        let mut seen = HashSet::new();
        let mut registered = 0usize;
        let mut failed = 0usize;
        let mut failed_bindings = Vec::new();
        let mut hotkey_actions = HashMap::new();

        for (binding, action) in bindings {
            if !seen.insert(binding.clone()) {
                failed += 1;
                failed_bindings.push(format!("{binding} (duplicate)"));
                continue;
            }

            if is_reserved_binding(&binding) {
                failed += 1;
                failed_bindings.push(format!("{binding} (reserved)"));
                continue;
            }

            let shortcut = match binding.parse::<Shortcut>() {
                Ok(shortcut) => shortcut,
                Err(error) => {
                    failed += 1;
                    failed_bindings.push(format!("{binding} (invalid: {error})"));
                    continue;
                }
            };

            match app.global_shortcut().register(shortcut) {
                Ok(_) => {
                    registered += 1;
                    hotkey_actions.insert(shortcut.to_string(), action);
                }
                Err(_) => {
                    failed += 1;
                    failed_bindings.push(binding);
                }
            }
        }

        *self
            .inner
            .hotkeys
            .write()
            .map_err(|_| "hotkeys lock poisoned".to_string())? = hotkey_actions;
        *self
            .inner
            .hotkey_summary
            .write()
            .map_err(|_| "hotkey summary lock poisoned".to_string())? =
            format!("Hotkeys live: {registered} registered, {failed} unavailable.");
        let log_message = if failed_bindings.is_empty() {
            format!("Hotkeys refreshed: {registered} registered, {failed} unavailable.")
        } else {
            format!(
                "Hotkeys refreshed: {registered} registered, {failed} unavailable. Failed bindings: {}",
                failed_bindings.join(", ")
            )
        };
        let _ = append_native_log(&self.inner.app_data_dir, &log_message);

        Ok(())
    }

    fn resolve_profile(&self, active_window: &ActiveWindowSnapshot) -> Result<ResolvedProfile, String> {
        let documents = self
            .inner
            .documents
            .read()
            .map_err(|_| "documents lock poisoned".to_string())?;
        resolve_profile(
            &documents.profiles_document.profiles,
            &documents.settings_document.settings,
            active_window,
        )
    }
}

fn load_or_seed_documents(app_data_dir: &Path) -> Result<LoadDocumentsResult, String> {
    let defaults = default_documents();
    let mut notices = Vec::new();
    let mut settings_document = load_document_with_backup::<SettingsDocument>(
        app_data_dir,
        SETTINGS_FILE,
        "settings.json",
        &mut notices,
    )?
    .unwrap_or_else(|| defaults.settings_document.clone());
    let profiles_document = load_document_with_backup::<ProfilesDocument>(
        app_data_dir,
        PROFILES_FILE,
        "profiles.json",
        &mut notices,
    )?
    .unwrap_or_else(|| defaults.profiles_document.clone());
    let (migrated_hotkeys, migrated) = migrate_hotkeys_if_needed(&settings_document.settings.hotkeys);
    if migrated {
        settings_document.settings.hotkeys = migrated_hotkeys;
        settings_document.saved_at_iso = now_iso();
        notices.push(
            "Migrated saved hotkeys to Ctrl digit defaults and enabled matching numpad aliases."
                .to_string(),
        );
    }

    if !app_data_dir.join(SETTINGS_FILE).exists()
        || !app_data_dir.join(PROFILES_FILE).exists()
        || !notices.is_empty()
    {
        persist_documents(app_data_dir, &settings_document, &profiles_document)?;
    }

    Ok(LoadDocumentsResult {
        documents: RuntimeDocuments {
            settings_document,
            profiles_document,
        },
        notices,
    })
}

fn load_document_with_backup<T>(
    app_data_dir: &Path,
    file_name: &str,
    label: &str,
    notices: &mut Vec<String>,
) -> Result<Option<T>, String>
where
    T: DeserializeOwned,
{
    let primary = app_data_dir.join(file_name);
    let backup = backup_path(&primary);

    if let Some(document) = try_read_document::<T>(&primary, label, false, notices)? {
        return Ok(Some(document));
    }

    if let Some(document) = try_read_document::<T>(&backup, label, true, notices)? {
        notices.push(format!("Recovered {label} from the last backup copy."));
        return Ok(Some(document));
    }

    if primary.exists() || backup.exists() {
        notices.push(format!("Rebuilt {label} from defaults after recovery failed."));
    }

    Ok(None)
}

fn try_read_document<T>(
    path: &Path,
    label: &str,
    is_backup: bool,
    notices: &mut Vec<String>,
) -> Result<Option<T>, String>
where
    T: DeserializeOwned,
{
    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;

    match serde_json::from_str::<T>(&text) {
        Ok(document) => Ok(Some(document)),
        Err(error) => {
            let quarantine = invalid_copy_path(path);
            fs::copy(path, &quarantine).map_err(|copy_error| {
                format!(
                    "failed to quarantine invalid {} at {}: {}",
                    label,
                    quarantine.display(),
                    copy_error
                )
            })?;
            notices.push(format!(
                "Ignored invalid {}{} and saved a recovery copy at {}.",
                label,
                if is_backup { " backup" } else { "" },
                quarantine.display()
            ));
            let _ = append_native_log(
                path.parent().unwrap_or_else(|| Path::new(".")),
                &format!("Invalid {} at {}: {}", label, path.display(), error),
            );
            Ok(None)
        }
    }
}

fn persist_documents(
    app_data_dir: &Path,
    settings_document: &SettingsDocument,
    profiles_document: &ProfilesDocument,
) -> Result<(), String> {
    let settings_json = serde_json::to_string_pretty(settings_document)
        .map_err(|error| format!("failed to serialize settings: {error}"))?;
    let profiles_json = serde_json::to_string_pretty(profiles_document)
        .map_err(|error| format!("failed to serialize profiles: {error}"))?;

    atomic_write(app_data_dir, SETTINGS_FILE, &settings_json)?;
    atomic_write(app_data_dir, PROFILES_FILE, &profiles_json)?;
    Ok(())
}

fn atomic_write(app_data_dir: &Path, file_name: &str, contents: &str) -> Result<(), String> {
    let path = app_data_dir.join(file_name);
    let tmp_path = app_data_dir.join(format!("{file_name}.tmp"));
    if path.exists() {
        fs::copy(&path, backup_path(&path))
            .map_err(|error| format!("failed to create backup for {}: {error}", path.display()))?;
    }

    fs::write(&tmp_path, contents)
        .map_err(|error| format!("failed to write temp file {}: {error}", tmp_path.display()))?;
    fs::rename(&tmp_path, &path)
        .map_err(|error| format!("failed to replace {}: {error}", path.display()))?;
    Ok(())
}

fn backup_path(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.bak", path.display()))
}

fn invalid_copy_path(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.invalid-{}", path.display(), Utc::now().timestamp_millis()))
}

fn apply_slot_save_to_documents(
    documents: &RuntimeDocuments,
    target_profile_id: &str,
    bank_id: char,
    slot_index: usize,
    clipboard_text: &str,
) -> RuntimeDocuments {
    let mut next_documents = documents.clone();

    for profile in &mut next_documents.profiles_document.profiles {
        if profile.id != target_profile_id {
            continue;
        }

        let bank = if bank_id == 'A' {
            &mut profile.bank_a
        } else {
            &mut profile.bank_b
        };

        if let Some(slot) = bank.slots.iter_mut().find(|slot| slot.slot_index == slot_index) {
            slot.content = clipboard_text.to_string();
            slot.enabled = true;
            slot.inheritance_mode = "override".to_string();
        }
    }

    next_documents
}

fn toggled_panic_documents(documents: &RuntimeDocuments) -> RuntimeDocuments {
    let mut next_documents = documents.clone();
    next_documents.settings_document.settings.panic_mode_enabled =
        !next_documents.settings_document.settings.panic_mode_enabled;
    next_documents
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn append_native_log(app_data_dir: &Path, message: &str) -> Result<(), String> {
    let path = app_data_dir.join(NATIVE_LOG_FILE);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("failed to open native log {}: {error}", path.display()))?;
    writeln!(file, "{} {}", now_iso(), message)
        .map_err(|error| format!("failed to append native log {}: {error}", path.display()))
}

fn default_documents() -> RuntimeDocuments {
    let settings_document = SettingsDocument {
        version: APP_SCHEMA_VERSION,
        saved_at_iso: now_iso(),
        settings: AppSettings {
            schema_version: APP_SCHEMA_VERSION,
            theme: "dark".to_string(),
            launch_mode: "dock".to_string(),
            combo_joiner: "\n\n".to_string(),
            restore_clipboard_after_paste: true,
            panic_mode_enabled: false,
            hotkeys: default_hotkeys(),
            ui: serde_json::json!({"compactDock": true, "showComboHud": true, "showTokenMeter": true}),
            experimental: serde_json::json!({"chordMode": false}),
            active_profile_id_override: None,
            extra: HashMap::new(),
        },
        extra: HashMap::new(),
    };

    let profiles_document = ProfilesDocument {
        version: APP_SCHEMA_VERSION,
        saved_at_iso: now_iso(),
        profiles: vec![
            Profile {
                id: "global-workflow".to_string(),
                name: "Global workflow loadout".to_string(),
                kind: "global".to_string(),
                description: "Portable Bank B workflow moves shared across repos.".to_string(),
                priority: 0,
                extends_profile_id: None,
                match_rules: vec![],
                bank_a: create_empty_bank("A", "Global context bank", "override"),
                bank_b: fill_bank_entries("B", "Workflow bank", "override", vec![
                    (0, "Patch only", "Tight fix scope and small diffs.", "Patch only what is required for the reported blocker. Keep the blast radius small and avoid broad refactors."),
                    (1, "Summarize before edit", "Restate intent before cutting code.", "Summarize the issue and intended fix before editing any files, then proceed with the smallest auditable patch."),
                    (2, "Write tests first", "Bias toward red-green-refactor.", "Add or update focused tests first where practical, use them to lock the behavior, then implement the fix."),
                    (3, "Do not widen auth/security gates", "Preserve security boundaries while fixing behavior.", "Do not widen authentication, authorization, or security gates as part of this change unless explicitly requested."),
                    (4, "Output changed files only", "Keep final response terse and audit-friendly.", "In the final response, list the changed files and the highest-signal behavior changes only. Avoid a blow-by-blow changelog."),
                    (5, "Repo sweep / bug hunt scaffold", "Search broadly, then converge to a small patch.", "Do a repo sweep for adjacent call paths, likely breakpoints, and related tests before landing the minimal fix. Confirm the real source of failure before editing."),
                ]),
                supers: vec![SuperRecipe {
                    id: "repo-bughunt-super".to_string(),
                    name: "Repo bughunt super".to_string(),
                    description: "Queue context + repo sweep + auth guardrails in one move.".to_string(),
                        sequence: vec![SlotReference { bank_id: "A".to_string(), slot_index: 2 }, SlotReference { bank_id: "B".to_string(), slot_index: 5 }, SlotReference { bank_id: "B".to_string(), slot_index: 3 }],
                    steps: vec![],
                    apply_stances: true,
                    hotkey_hint: None,
                    assembly: None,
                    extra: HashMap::new(),
                }],
                extra: HashMap::new(),
            },
            Profile {
                id: "therxspot".to_string(),
                name: "TheRxSpot.com".to_string(),
                kind: "workspace".to_string(),
                description: "Example repo-aware profile with repo-specific Bank A context.".to_string(),
                priority: 40,
                extends_profile_id: Some("global-workflow".to_string()),
                match_rules: vec![
                    ProfileMatchRule { id: "workspace-contains-therxspot".to_string(), kind: "workspacePathContains".to_string(), value: "TheRxSpot.com".to_string(), case_sensitive: false, weight_boost: 40, extra: HashMap::new() },
                    ProfileMatchRule { id: "title-contains-therxspot".to_string(), kind: "windowTitleContains".to_string(), value: "TheRxSpot.com".to_string(), case_sensitive: false, weight_boost: 10, extra: HashMap::new() },
                ],
                bank_a: fill_bank_entries("A", "Repo context bank", "override", vec![
                    (0, "Repo map", "Key directories, conventions, and shared docs.", "Capture the relevant repo or module map, nearest AGENTS.md rules, and any docs or runbooks that constrain this edit."),
                    (1, "Edited files context", "What changed recently and why it matters.", "Summarize the current file focus, changed call paths, and any touched tests or config that constrain this patch."),
                    (2, "Repro + bug trail", "What fails, where, and what to verify.", "State the failing behavior, expected behavior, exact repro, and the likely stack or subsystem involved before changing code."),
                    (3, "Logs / traces", "Paste the most useful logs or traces.", "Include the most relevant logs, stack traces, or screenshots and call out which lines are signal versus noise."),
                ]),
                bank_b: create_empty_bank("B", "Workflow bank overrides", "inherit"),
                supers: vec![SuperRecipe {
                    id: "checkout-bughunt-super".to_string(),
                    name: "Checkout bughunt super".to_string(),
                    description: "Repo context opener plus sweep and guardrails.".to_string(),
                    sequence: vec![SlotReference { bank_id: "A".to_string(), slot_index: 2 }, SlotReference { bank_id: "B".to_string(), slot_index: 5 }, SlotReference { bank_id: "B".to_string(), slot_index: 3 }],
                    steps: vec![],
                    apply_stances: true,
                    hotkey_hint: None,
                    assembly: None,
                    extra: HashMap::new(),
                }],
                extra: HashMap::new(),
            },
        ],
        extra: HashMap::new(),
    };

    RuntimeDocuments { settings_document, profiles_document }
}

fn create_empty_bank(bank_id: &str, name: &str, inheritance_mode: &str) -> SlotBank {
    SlotBank {
        bank_id: bank_id.to_string(),
        name: name.to_string(),
        slots: (0..10).map(|slot_index| SlotDefinition {
            id: format!("{bank_id}{slot_index}"),
            bank_id: bank_id.to_string(),
            slot_index,
            kind: if bank_id == "A" { "context".to_string() } else { "workflow".to_string() },
            label: String::new(),
            description: String::new(),
            content: String::new(),
            enabled: false,
            inheritance_mode: inheritance_mode.to_string(),
            template_mode: "plain".to_string(),
            assembly_mode: "append".to_string(),
            tags: vec![],
            extra: HashMap::new(),
        }).collect(),
        extra: HashMap::new(),
    }
}

fn fill_bank_entries(bank_id: &str, name: &str, inheritance_mode: &str, entries: Vec<(usize, &str, &str, &str)>) -> SlotBank {
    let mut bank = create_empty_bank(bank_id, name, inheritance_mode);
    for (slot_index, label, description, content) in entries {
        if let Some(slot) = bank.slots.iter_mut().find(|slot| slot.slot_index == slot_index) {
            slot.label = label.to_string();
            slot.description = description.to_string();
            slot.content = content.to_string();
            slot.enabled = true;
        }
    }
    bank
}

fn resolve_profile(
    profiles: &[Profile],
    settings: &AppSettings,
    active_window: &ActiveWindowSnapshot,
) -> Result<ResolvedProfile, String> {
    let profile_map: HashMap<String, Profile> =
        profiles.iter().cloned().map(|profile| (profile.id.clone(), profile)).collect();
    let global_profile = profiles
        .iter()
        .find(|profile| profile.kind == "global")
        .cloned()
        .or_else(|| profiles.first().cloned())
        .ok_or_else(|| "no profiles available".to_string())?;

    if let Some(override_id) = &settings.active_profile_id_override {
        if let Some(profile) = profile_map.get(override_id) {
            let materialized = materialize_profile(profile, &profile_map)?;
            return Ok(ResolvedProfile {
                profile: materialized.clone(),
                effective_bank_a: materialized.bank_a.clone(),
                effective_bank_b: materialized.bank_b.clone(),
                score: 999,
            });
        }
    }

    let mut winner: Option<ResolvedProfile> = None;
    for profile in profiles.iter().filter(|profile| profile.kind == "workspace") {
        let (score, _) = score_profile(profile, active_window);
        if score <= 0 {
            continue;
        }
        let materialized = materialize_profile(profile, &profile_map)?;
        let candidate = ResolvedProfile {
            profile: materialized.clone(),
            effective_bank_a: materialized.bank_a.clone(),
            effective_bank_b: materialized.bank_b.clone(),
            score,
        };
        let replace = winner
            .as_ref()
            .map(|current| {
                score > current.score || (score == current.score && candidate.profile.name < current.profile.name)
            })
            .unwrap_or(true);
        if replace {
            winner = Some(candidate);
        }
    }

    if let Some(winner) = winner {
        return Ok(winner);
    }

    let materialized_global = materialize_profile(&global_profile, &profile_map)?;
    Ok(ResolvedProfile {
        profile: materialized_global.clone(),
        effective_bank_a: materialized_global.bank_a.clone(),
        effective_bank_b: materialized_global.bank_b.clone(),
        score: 0,
    })
}

fn materialize_profile(profile: &Profile, profile_map: &HashMap<String, Profile>) -> Result<Profile, String> {
    if let Some(parent_id) = &profile.extends_profile_id {
        if let Some(parent) = profile_map.get(parent_id) {
            let effective_parent = materialize_profile(parent, profile_map)?;
            return Ok(Profile {
                bank_a: merge_banks(&effective_parent.bank_a, &profile.bank_a),
                bank_b: merge_banks(&effective_parent.bank_b, &profile.bank_b),
                supers: {
                    let mut supers = effective_parent.supers.clone();
                    supers.extend(profile.supers.clone());
                    supers
                },
                ..profile.clone()
            });
        }
    }

    Ok(profile.clone())
}

fn merge_banks(parent: &SlotBank, child: &SlotBank) -> SlotBank {
    SlotBank {
        bank_id: child.bank_id.clone(),
        name: if child.name.is_empty() { parent.name.clone() } else { child.name.clone() },
        slots: parent
            .slots
            .iter()
            .map(|parent_slot| {
                child.slots
                    .iter()
                    .find(|slot| slot.slot_index == parent_slot.slot_index)
                    .cloned()
                    .filter(|slot| slot.inheritance_mode != "inherit")
                    .unwrap_or_else(|| parent_slot.clone())
            })
            .collect(),
        extra: if child.extra.is_empty() {
            parent.extra.clone()
        } else {
            child.extra.clone()
        },
    }
}

fn score_profile(profile: &Profile, active_window: &ActiveWindowSnapshot) -> (i32, String) {
    let mut best_score = 0;
    let mut best_reason = "Fallback to global profile".to_string();

    for rule in &profile.match_rules {
        let score = match rule.kind.as_str() {
            "workspacePathEquals" if matches_rule(&active_window.workspace_path, &rule.value, rule.case_sensitive, true) => 100,
            "workspacePathContains" if matches_rule(&active_window.workspace_path, &rule.value, rule.case_sensitive, false) => 80,
            "processPathContains" if matches_rule(&active_window.process_path, &rule.value, rule.case_sensitive, false) => 60,
            "processName" if matches_rule(&active_window.process_name, &rule.value, rule.case_sensitive, true) => 50,
            "windowTitleContains" if matches_rule(&active_window.title, &rule.value, rule.case_sensitive, false) => 30,
            _ => 0,
        };

        let score = score + rule.weight_boost + profile.priority;
        if score > best_score {
            best_score = score;
            best_reason = format!("{} matched {} ({})", profile.name, rule.kind, rule.value);
        }
    }

    (best_score, best_reason)
}

fn matches_rule(source: &str, rule_value: &str, case_sensitive: bool, exact: bool) -> bool {
    let source = normalize(source, case_sensitive);
    let rule_value = normalize(rule_value, case_sensitive);
    if exact { source == rule_value } else { source.contains(&rule_value) }
}

fn normalize(value: &str, case_sensitive: bool) -> String {
    if case_sensitive { value.to_string() } else { value.to_lowercase() }
}

fn render_template(content: &str, clipboard: &str, profile: &str, active_app: &str) -> String {
    content
        .replace("{{clipboard}}", clipboard)
        .replace("{{ profile }}", profile)
        .replace("{{profile}}", profile)
        .replace("{{ active_app }}", active_app)
        .replace("{{active_app}}", active_app)
        .replace("{{ date }}", &now_iso()[..10])
        .replace("{{date}}", &now_iso()[..10])
}

fn paste_text_transaction(text: &str, restore_clipboard: bool) -> PasteResult {
    let original_clipboard = if restore_clipboard {
        match read_clipboard_text() {
            Ok(text) => Some(text),
            Err(error) => {
                return PasteResult {
                    ok: false,
                    message: format!("Paste blocked because only text clipboard restoration is supported right now: {error}"),
                    copied_text: None,
                };
            }
        }
    } else {
        None
    };

    if let Err(error) = write_clipboard_text(text) {
        return PasteResult {
            ok: false,
            message: format!("Failed to write combo text to the clipboard: {error}"),
            copied_text: None,
        };
    }

    let paste_result = (|| -> Result<(), String> {
        wait_for_hotkey_modifiers_to_release();
        send_ctrl_v()?;
        thread::sleep(Duration::from_millis(100));
        Ok(())
    })();

    if let Some(original_clipboard) = original_clipboard {
        if let Err(error) = write_clipboard_text(&original_clipboard) {
            return PasteResult {
                ok: false,
                message: format!("Pasted, but failed to restore the original clipboard: {error}"),
                copied_text: None,
            };
        }
    }

    match paste_result {
        Ok(_) => PasteResult {
            ok: true,
            message: if restore_clipboard {
                "Pasted combo into the focused app and restored the text clipboard.".to_string()
            } else {
                "Pasted combo into the focused app.".to_string()
            },
            copied_text: None,
        },
        Err(error) => PasteResult {
            ok: false,
            message: error,
            copied_text: None,
        },
    }
}

fn read_clipboard_text() -> Result<String, String> {
    let mut clipboard = Clipboard::new().map_err(|error| format!("failed to open clipboard: {error}"))?;
    clipboard.get_text().map_err(|error| format!("failed to read text clipboard contents: {error}"))
}

fn write_clipboard_text(text: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|error| format!("failed to open clipboard: {error}"))?;
    clipboard.set_text(text.to_string()).map_err(|error| format!("failed to write text clipboard contents: {error}"))
}

fn wait_for_hotkey_modifiers_to_release() {
    for _ in 0..20 {
        let alt_down = unsafe { GetAsyncKeyState(VK_MENU.0 as i32) } < 0;
        let ctrl_down = unsafe { GetAsyncKeyState(VK_CONTROL.0 as i32) } < 0;
        let shift_down = unsafe { GetAsyncKeyState(VK_SHIFT.0 as i32) } < 0;
        if !alt_down && !ctrl_down && !shift_down {
            return;
        }
        thread::sleep(Duration::from_millis(15));
    }
}

fn send_ctrl_v() -> Result<(), String> {
    let inputs = [
        keyboard_input(VK_CONTROL.0 as u16, false),
        keyboard_input(b'V' as u16, false),
        keyboard_input(b'V' as u16, true),
        keyboard_input(VK_CONTROL.0 as u16, true),
    ];

    let sent = unsafe { SendInput(&inputs, size_of::<INPUT>() as i32) };
    if sent != inputs.len() as u32 {
        return Err("Failed to synthesize Ctrl+V into the focused app.".to_string());
    }

    Ok(())
}

fn send_ctrl_c() -> Result<(), String> {
    let inputs = [
        keyboard_input(VK_CONTROL.0 as u16, false),
        keyboard_input(b'C' as u16, false),
        keyboard_input(b'C' as u16, true),
        keyboard_input(VK_CONTROL.0 as u16, true),
    ];

    let sent = unsafe { SendInput(&inputs, size_of::<INPUT>() as i32) };
    if sent != inputs.len() as u32 {
        return Err("Failed to synthesize Ctrl+C from the focused selection.".to_string());
    }

    Ok(())
}

fn capture_selection_via_ctrl_c() -> Result<String, String> {
    wait_for_hotkey_modifiers_to_release();
    let sequence_before = unsafe { GetClipboardSequenceNumber() };
    send_ctrl_c()?;

    for _ in 0..20 {
        thread::sleep(Duration::from_millis(25));
        let sequence_after = unsafe { GetClipboardSequenceNumber() };
        if sequence_after != sequence_before {
            break;
        }
    }

    let clipboard_text = read_clipboard_text()?;
    if clipboard_text.trim().is_empty() {
        return Err("Ctrl+Shift slot save ran, but the focused app did not place any text on the clipboard. Highlight text first and make sure the target app supports Ctrl+C.".to_string());
    }

    Ok(clipboard_text)
}

fn keyboard_input(virtual_key: u16, key_up: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(virtual_key),
                wScan: 0,
                dwFlags: if key_up { KEYEVENTF_KEYUP } else { Default::default() },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

fn to_numpad_binding(binding: &str) -> Option<String> {
    let numpad_map: &[(&str, &str)] = &[
        ("0", "Numpad0"), ("1", "Numpad1"), ("2", "Numpad2"), ("3", "Numpad3"),
        ("4", "Numpad4"), ("5", "Numpad5"), ("6", "Numpad6"), ("7", "Numpad7"),
        ("8", "Numpad8"), ("9", "Numpad9"),
    ];
    let suffix = binding.split('+').last()?;
    let replacement = numpad_map.iter().find(|(digit, _)| *digit == suffix)?;
    let prefix = &binding[..binding.len() - suffix.len()];
    Some(format!("{prefix}{}", replacement.1))
}

fn sample_active_window() -> Result<ActiveWindowSnapshot, String> {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return Ok(ActiveWindowSnapshot::default());
    }

    let title = read_window_title(hwnd)?;
    let (process_name, process_path) = read_process_details(hwnd)?;

    Ok(ActiveWindowSnapshot { title, process_name, process_path, workspace_path: String::new() })
}

fn read_window_title(hwnd: HWND) -> Result<String, String> {
    let length = unsafe { GetWindowTextLengthW(hwnd) };
    let mut buffer = vec![0u16; length as usize + 1];
    let read = unsafe { GetWindowTextW(hwnd, &mut buffer) } as usize;
    Ok(String::from_utf16_lossy(&buffer[..read]))
}

fn read_process_details(hwnd: HWND) -> Result<(String, String), String> {
    let mut process_id = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut process_id)); }
    if process_id == 0 {
        return Ok((String::new(), String::new()));
    }

    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) }
        .map_err(|error| format!("failed to open foreground process: {error}"))?;
    let mut buffer = vec![0u16; 512];
    let mut size = buffer.len() as u32;
    unsafe {
        QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT(0),
            PWSTR(buffer.as_mut_ptr()),
            &mut size,
        )
            .map_err(|error| format!("failed to read process path: {error}"))?;
        CloseHandle(handle).ok();
    }
    let process_path = String::from_utf16_lossy(&buffer[..size as usize]);
    let process_name = Path::new(&process_path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok((process_name, process_path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_path(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "superpaste-{}-{}",
            label,
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock drift")
                .as_millis()
        ))
    }

    #[test]
    fn slot_save_prepares_new_documents_without_mutating_original() {
        let documents = default_documents();

        let next = apply_slot_save_to_documents(
            &documents,
            "therxspot",
            'A',
            4,
            "captured clipboard",
        );

        assert_eq!(
            documents.profiles_document.profiles[1].bank_a.slots[4].content,
            ""
        );
        assert_eq!(
            next.profiles_document.profiles[1].bank_a.slots[4].content,
            "captured clipboard"
        );
    }

    #[test]
    fn toggling_panic_mode_returns_a_new_document_snapshot() {
        let documents = default_documents();
        let next = toggled_panic_documents(&documents);

        assert!(!documents.settings_document.settings.panic_mode_enabled);
        assert!(next.settings_document.settings.panic_mode_enabled);
    }

    #[test]
    fn profiles_document_round_trips_recipe_steps_and_slot_assembly_mode() {
        let mut documents = default_documents();
        documents.profiles_document.profiles[0].bank_b.slots[0].assembly_mode = "wrap".to_string();
        documents.profiles_document.profiles[0].supers[0].steps = vec![RecipeStep::Slot {
            slot_ref: SlotReference {
                bank_id: "B".to_string(),
                slot_index: 0,
            },
        }];

        let json = serde_json::to_string(&documents.profiles_document).expect("serialize profiles");
        let parsed: ProfilesDocument = serde_json::from_str(&json).expect("parse profiles");

        assert_eq!(
            parsed.profiles[0].bank_b.slots[0].assembly_mode,
            "wrap"
        );
        assert_eq!(parsed.profiles[0].supers[0].steps.len(), 1);
    }

    #[test]
    fn migrate_hotkeys_repairs_legacy_slot_arrays() {
        let defaults = default_hotkeys();
        let legacy = HotkeyMapping {
            bank_a_paste: build_slot_hotkeys("Alt+", &SLOT_DIGITS_STANDARD),
            bank_b_paste: build_slot_hotkeys("Ctrl+Alt+Numpad", &SLOT_DIGITS_ZERO_FIRST),
            bank_a_save_clipboard: build_slot_hotkeys("Alt+Shift+", &SLOT_DIGITS_STANDARD),
            bank_b_save_clipboard: build_slot_hotkeys("Ctrl+Alt+Shift+Numpad", &SLOT_DIGITS_ZERO_FIRST),
            finalize_combo: "Alt+Enter".to_string(),
            cancel_combo: "Alt+Backspace".to_string(),
            replay_last_combo: "Alt+/".to_string(),
            toggle_window: "Alt+`".to_string(),
            panic_toggle: "Alt+Pause".to_string(),
            extra: HashMap::new(),
        };

        let (migrated, changed) = migrate_hotkeys_if_needed(&legacy);

        assert!(changed);
        assert_eq!(migrated.bank_a_paste, defaults.bank_a_paste);
        assert_eq!(migrated.bank_b_paste, defaults.bank_b_paste);
        assert_eq!(migrated.bank_a_save_clipboard, defaults.bank_a_save_clipboard);
        assert_eq!(migrated.bank_b_save_clipboard, defaults.bank_b_save_clipboard);
    }

    #[test]
    fn load_or_seed_documents_recovers_from_valid_backup() {
        let app_data_dir = temp_path("backup-recovery");
        fs::create_dir_all(&app_data_dir).expect("create temp app data dir");

        let defaults = default_documents();
        let backup_json =
            serde_json::to_string_pretty(&defaults.profiles_document).expect("serialize backup");

        fs::write(app_data_dir.join(PROFILES_FILE), "{broken").expect("write broken primary");
        fs::write(backup_path(&app_data_dir.join(PROFILES_FILE)), backup_json).expect("write backup");

        let loaded = load_or_seed_documents(&app_data_dir).expect("recover documents");

        assert!(
            loaded
                .documents
                .profiles_document
                .profiles
                .iter()
                .any(|profile| profile.id == "therxspot")
        );
        assert!(!loaded.notices.is_empty());

        let _ = fs::remove_dir_all(app_data_dir);
    }

    #[test]
    fn load_or_seed_documents_migrates_legacy_hotkeys_before_registration() {
        let app_data_dir = temp_path("hotkey-migration");
        fs::create_dir_all(&app_data_dir).expect("create temp app data dir");

        let mut documents = default_documents();
        documents.settings_document.settings.hotkeys.bank_a_paste =
            build_slot_hotkeys("Alt+", &SLOT_DIGITS_STANDARD);
        documents.settings_document.settings.hotkeys.bank_a_save_clipboard =
            build_slot_hotkeys("Alt+Shift+", &SLOT_DIGITS_STANDARD);

        fs::write(
            app_data_dir.join(SETTINGS_FILE),
            serde_json::to_string_pretty(&documents.settings_document).expect("serialize settings"),
        )
        .expect("write settings");
        fs::write(
            app_data_dir.join(PROFILES_FILE),
            serde_json::to_string_pretty(&documents.profiles_document).expect("serialize profiles"),
        )
        .expect("write profiles");

        let loaded = load_or_seed_documents(&app_data_dir).expect("load migrated documents");

        assert_eq!(
            loaded.documents.settings_document.settings.hotkeys.bank_a_paste,
            default_hotkeys().bank_a_paste
        );
        assert_eq!(
            loaded.documents.settings_document.settings.hotkeys.bank_a_save_clipboard,
            default_hotkeys().bank_a_save_clipboard
        );
        assert!(
            loaded
                .notices
                .iter()
                .any(|notice| notice.contains("Migrated saved hotkeys"))
        );

        let _ = fs::remove_dir_all(app_data_dir);
    }
}
