mod auth;
mod commands;
mod database;
mod inventory;
mod queries;
mod stock_reset;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_config_dir()?;
            let filename = if cfg!(debug_assertions) {
                "stock_dev.db"
            } else {
                "stock.db"
            };
            let db = tauri::async_runtime::block_on(database::Database::open(&dir, filename))
                .map_err(std::io::Error::other)?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::auth_status,
            auth::create_account,
            auth::login,
            auth::logout,
            auth::delete_account,
            queries::read_data,
            queries::inventory_write,
            queries::master_write,
            queries::save_count_today,
            queries::delete_count,
            commands::backup_database,
            commands::import_database,
            commands::export_workbook,
            stock_reset::reset_stock
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests;
