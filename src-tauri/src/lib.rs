mod engine;

use engine::{
    ActiveWindowSnapshot, NativeEngine, NativeRuntimeSnapshot, PastePlan, PasteResult,
    PersistenceSnapshot,
};
use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::{Shortcut, ShortcutState};

const TRAY_ID: &str = "superpaste-tray";

#[tauri::command]
fn load_persistence_snapshot(
    engine: State<'_, NativeEngine>,
) -> Result<PersistenceSnapshot, String> {
    engine.persistence_snapshot()
}

#[tauri::command]
fn save_persistence_snapshot(
    app: AppHandle,
    engine: State<'_, NativeEngine>,
    settings_json: String,
    profiles_json: String,
) -> Result<(), String> {
    engine.save_documents_from_json(&app, settings_json, profiles_json)?;
    refresh_tray_menu(&app, &engine).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn refresh_native_runtime(
    app: AppHandle,
    engine: State<'_, NativeEngine>,
) -> Result<NativeRuntimeSnapshot, String> {
    engine.refresh_runtime(&app)
}

#[tauri::command]
fn get_native_runtime_snapshot(
    engine: State<'_, NativeEngine>,
) -> Result<NativeRuntimeSnapshot, String> {
    engine.runtime_snapshot()
}

#[tauri::command]
fn get_active_window_snapshot(
    engine: State<'_, NativeEngine>,
) -> Result<ActiveWindowSnapshot, String> {
    engine.refresh_active_window()
}

#[tauri::command]
fn read_system_clipboard_text(engine: State<'_, NativeEngine>) -> Result<String, String> {
    engine.read_clipboard_text()
}

#[tauri::command]
fn write_system_clipboard_text(
    engine: State<'_, NativeEngine>,
    text: String,
) -> Result<(), String> {
    engine.write_clipboard_text(&text)
}

#[tauri::command]
fn execute_native_paste_plan(
    app: AppHandle,
    engine: State<'_, NativeEngine>,
    plan: PastePlan,
) -> Result<PasteResult, String> {
    engine.execute_paste_plan(&app, plan)
}

#[tauri::command]
fn open_test_harness_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("test-harness") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "test-harness",
        WebviewUrl::App("index.html?view=harness".into()),
    )
    .title("SuperPaste Test Harness")
    .inner_size(720.0, 560.0)
    .resizable(true)
    .build()
    .map_err(|error| format!("failed to open the test harness window: {error}"))?;

    Ok(())
}

pub fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppCommandPayload {
    action: String,
    profile_id: Option<String>,
    bank_id: Option<String>,
    slot_index: Option<usize>,
}

fn emit_app_command(app: &AppHandle, action: &str, profile_id: Option<String>) {
    emit_app_command_with_slot(app, action, profile_id, None, None);
}

fn emit_app_command_with_slot(
    app: &AppHandle,
    action: &str,
    profile_id: Option<String>,
    bank_id: Option<char>,
    slot_index: Option<usize>,
) {
    let _ = app.emit(
        "app-command",
        AppCommandPayload {
            action: action.to_string(),
            profile_id,
            bank_id: bank_id.map(|value| value.to_string()),
            slot_index,
        },
    );
}

fn build_tray_menu<R: tauri::Runtime>(
    app: &AppHandle<R>,
    engine: &NativeEngine,
) -> Result<Menu<R>, String> {
    let tray_state = engine.tray_menu_state()?;
    let open_dock = MenuItem::with_id(app, "open_dock", "Open dock", true, None::<&str>)
        .map_err(|error| error.to_string())?;
    let open_editor =
        MenuItem::with_id(app, "open_editor", "Quick open editor", true, None::<&str>)
            .map_err(|error| error.to_string())?;
    let toggle_hotkeys = MenuItem::with_id(
        app,
        "toggle_hotkeys",
        if tray_state.panic_mode_enabled {
            "Resume hotkeys"
        } else {
            "Pause hotkeys"
        },
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;
    let paste_combo = MenuItem::with_id(app, "paste_combo", "Paste combo", true, None::<&str>)
        .map_err(|error| error.to_string())?;
    let replay_combo =
        MenuItem::with_id(app, "replay_combo", "Replay last combo", true, None::<&str>)
            .map_err(|error| error.to_string())?;
    let clear_combo = MenuItem::with_id(app, "clear_combo", "Clear combo", true, None::<&str>)
        .map_err(|error| error.to_string())?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)
        .map_err(|error| error.to_string())?;

    let auto_item = MenuItem::with_id(
        app,
        "profile:auto",
        if tray_state.active_override_id.is_some() {
            "Auto resolve"
        } else {
            "Auto resolve (active)"
        },
        true,
        None::<&str>,
    )
    .map_err(|error| error.to_string())?;

    let mut profile_items = vec![auto_item];
    profile_items.extend(
        tray_state
            .profiles
            .iter()
            .map(|(profile_id, profile_name)| {
                let label = if tray_state.active_override_id.as_deref() == Some(profile_id.as_str())
                {
                    format!("{profile_name} (active)")
                } else {
                    profile_name.clone()
                };

                MenuItem::with_id(
                    app,
                    format!("profile:{profile_id}"),
                    label,
                    true,
                    None::<&str>,
                )
                .map_err(|error| error.to_string())
            })
            .collect::<Result<Vec<_>, _>>()?,
    );

    let profile_refs: Vec<&dyn IsMenuItem<R>> = profile_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect();
    let profile_submenu = Submenu::with_items(app, "Switch profile", true, &profile_refs)
        .map_err(|error| error.to_string())?;

    Menu::with_items(
        app,
        &[
            &open_dock,
            &open_editor,
            &toggle_hotkeys,
            &paste_combo,
            &replay_combo,
            &clear_combo,
            &profile_submenu,
            &quit_item,
        ],
    )
    .map_err(|error| error.to_string())
}

fn refresh_tray_menu<R: tauri::Runtime>(
    app: &AppHandle<R>,
    engine: &NativeEngine,
) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let menu = build_tray_menu(app, engine)?;
        tray.set_menu(Some(menu))
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn setup_tray(app: &mut tauri::App, engine: &NativeEngine) -> tauri::Result<()> {
    let menu = build_tray_menu(&app.handle(), engine)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;

    let icon_bytes = include_bytes!("../icons/32x32.png");
    let tray_icon = tauri::image::Image::new(icon_bytes, 32, 32);

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(tray_icon)
        .tooltip("SuperPaste - Two-bank combo engine")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_dock" => {
                show_main_window(app);
                emit_app_command(app, "show-dock", None);
            }
            "open_editor" => {
                show_main_window(app);
                emit_app_command(app, "show-editor", None);
            }
            "toggle_hotkeys" => emit_app_command(app, "toggle-hotkeys", None),
            "paste_combo" => emit_app_command(app, "paste-combo", None),
            "replay_combo" => emit_app_command(app, "replay-combo", None),
            "clear_combo" => emit_app_command(app, "clear-combo", None),
            "quit" => app.exit(0),
            id if id == "profile:auto" => emit_app_command(app, "switch-profile", None),
            id if id.starts_with("profile:") => emit_app_command(
                app,
                "switch-profile",
                Some(id.trim_start_matches("profile:").to_string()),
            ),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button,
                button_state,
                ..
            } = event
            {
                if button == MouseButton::Left && button_state == MouseButtonState::Up {
                    toggle_main_window(tray.app_handle());
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut: &Shortcut, event| {
                    if event.state() == ShortcutState::Released {
                        if let Some(engine) = app.try_state::<NativeEngine>() {
                            engine.handle_shortcut_event(app.clone(), shortcut);
                            let _ = refresh_tray_menu(&app, &engine);
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let engine = NativeEngine::initialize(app.handle())?;
            setup_tray(app, &engine)?;
            app.manage(engine);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_persistence_snapshot,
            save_persistence_snapshot,
            refresh_native_runtime,
            get_native_runtime_snapshot,
            get_active_window_snapshot,
            read_system_clipboard_text,
            write_system_clipboard_text,
            execute_native_paste_plan,
            open_test_harness_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running SuperPaste");
}
