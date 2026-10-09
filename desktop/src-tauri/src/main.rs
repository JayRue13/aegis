// AEGIS desktop: a native window that opens the user's hosted AEGIS.
// The bundled page (../dist/index.html) asks for the server address once and
// remembers it. Remote pages get no access to native APIs (no capabilities are
// granted to remote origins), so the desktop app is as sandboxed as a browser tab.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Manager;

fn setup_url() -> tauri::Url {
    let base = if cfg!(windows) { "http://tauri.localhost" } else { "tauri://localhost" };
    format!("{base}/index.html?setup").parse().expect("valid setup url")
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let change = MenuItemBuilder::with_id("change-server", "Change server…").build(app)?;
            let reload = MenuItemBuilder::with_id("reload", "Reload")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            let aegis = SubmenuBuilder::new(app, "AEGIS")
                .item(&reload)
                .item(&change)
                .separator()
                .quit()
                .build()?;
            let edit = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            app.set_menu(MenuBuilder::new(app).items(&[&aegis, &edit]).build()?)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let Some(window) = app.get_webview_window("main") else { return };
            match event.id().as_ref() {
                "change-server" => {
                    let _ = window.navigate(setup_url());
                }
                "reload" => {
                    let _ = window.eval("location.reload()");
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running AEGIS");
}
