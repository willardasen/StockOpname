mod commands;

use commands::{backup_database, get_db_path, hash_password, import_database, verify_password};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            hash_password,
            verify_password,
            backup_database,
            import_database,
            get_db_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
