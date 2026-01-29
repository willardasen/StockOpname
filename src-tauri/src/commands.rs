use bcrypt::{hash, verify, DEFAULT_COST};
use std::fs;
use tauri::{AppHandle, Manager, Runtime};

#[tauri::command]
pub fn hash_password(password: String) -> Result<String, String> {
    hash(password, DEFAULT_COST).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn verify_password(password: String, hash: String) -> bool {
    verify(password, &hash).unwrap_or(false)
}

#[tauri::command]
pub fn get_db_path<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("stock_opname.db");
    Ok(db_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn backup_database<R: Runtime>(app: AppHandle<R>, dest_path: String) -> Result<(), String> {
    let db_path = get_db_path(app)?;
    fs::copy(db_path, dest_path).map_err(|e| e.to_string())?;
    Ok(())
}
