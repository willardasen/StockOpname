use crate::database::{err, Database, Result, Session};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};
use tauri::State;

#[derive(Serialize)]
pub struct User {
    id: i64,
    username: String,
    created_at: String,
}
async fn user(pool: &sqlx::SqlitePool, id: i64) -> Result<User> {
    let (id, username, created_at) =
        sqlx::query_as("SELECT id,username,created_at FROM users WHERE id=?")
            .bind(id)
            .fetch_one(pool)
            .await
            .map_err(err)?;
    Ok(User {
        id,
        username,
        created_at,
    })
}
#[derive(Serialize)]
pub struct Status {
    setup: bool,
    user: Option<User>,
}
#[tauri::command]
pub async fn auth_status(db: State<'_, Database>) -> Result<Status> {
    let session = db.session.read().await;
    let setup = sqlx::query_scalar("SELECT NOT EXISTS(SELECT 1 FROM users)")
        .fetch_one(&db.pool)
        .await
        .map_err(err)?;
    let account = match session.user {
        Some(id) => Some(user(&db.pool, id).await?),
        None => None,
    };
    Ok(Status {
        setup,
        user: account,
    })
}
fn legacy_default(s: &str) -> bool {
    format!("{:x}", Sha256::digest(s.as_bytes()))
        == "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
}
async fn hash(password: String) -> Result<String> {
    if password.chars().count() < 8 || password.len() > 72 || legacy_default(&password) {
        return Err("Gunakan kata sandi baru minimal 8 karakter, maksimal 72 byte.".into());
    }
    tauri::async_runtime::spawn_blocking(move || bcrypt::hash(password, bcrypt::DEFAULT_COST))
        .await
        .map_err(err)?
        .map_err(err)
}
#[tauri::command]
pub async fn create_account(
    db: State<'_, Database>,
    username: String,
    password: String,
    first: bool,
) -> Result<User> {
    let mut session = db.session.write().await;
    if !first && session.user.is_none() {
        return Err("Silakan masuk.".into());
    }
    let name = username.trim();
    if name.is_empty() {
        return Err("Nama pengguna diperlukan.".into());
    }
    let secret = hash(password).await?;
    let mut tx = db.pool.begin_with("BEGIN IMMEDIATE").await.map_err(err)?;
    if first
        && sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users)")
            .fetch_one(&mut *tx)
            .await
            .map_err(err)?
    {
        return Err("Akun sudah tersedia.".into());
    }
    let id = sqlx::query("INSERT INTO users(username,password) VALUES(?,?)")
        .bind(name)
        .bind(secret)
        .execute(&mut *tx)
        .await
        .map_err(err)?
        .last_insert_rowid();
    tx.commit().await.map_err(err)?;
    if first {
        session.user = Some(id)
    }
    user(&db.pool, id).await
}
#[tauri::command]
pub async fn login(
    db: State<'_, Database>,
    username: String,
    password: String,
    new_password: Option<String>,
) -> Result<User> {
    authenticate(&db, username, password, new_password).await
}
pub async fn authenticate(
    db: &Database,
    username: String,
    password: String,
    new_password: Option<String>,
) -> Result<User> {
    let mut session = db.session.write().await;
    if session.retry_at.is_some_and(|t| Instant::now() < t) {
        return Err("Tunggu sebentar sebelum mencoba lagi.".into());
    }
    let data: Option<(i64, String)> =
        sqlx::query_as("SELECT id,password FROM users WHERE username=?")
            .bind(username.trim())
            .fetch_optional(&db.pool)
            .await
            .map_err(err)?;
    let legacy = legacy_default(&password);
    let id = if let Some((id, stored)) = data {
        let valid = tauri::async_runtime::spawn_blocking(move || {
            bcrypt::verify(&password, &stored).unwrap_or(false)
                || (legacy && legacy_default(&stored))
        })
        .await
        .map_err(err)?;
        valid.then_some(id)
    } else {
        None
    };
    let Some(id) = id else {
        session.failures = session.failures.saturating_add(1);
        if session.failures >= 5 {
            session.retry_at = Some(Instant::now() + Duration::from_secs(15));
        }
        return Err("Username atau password salah.".into());
    };
    if legacy {
        let replacement = hash(new_password.ok_or("PASSWORD_CHANGE_REQUIRED")?).await?;
        sqlx::query("UPDATE users SET password=? WHERE id=?")
            .bind(replacement)
            .bind(id)
            .execute(&db.pool)
            .await
            .map_err(err)?;
    }
    *session = Session {
        user: Some(id),
        ..Default::default()
    };
    user(&db.pool, id).await
}
#[tauri::command]
pub async fn logout(db: State<'_, Database>) -> Result<()> {
    db.session.write().await.user = None;
    Ok(())
}
#[tauri::command]
pub async fn delete_account(db: State<'_, Database>, id: i64) -> Result<bool> {
    let (_guard, actor) = db.authenticated().await?;
    if actor == id {
        return Err("Akun aktif tidak dapat dihapus.".into());
    }
    Ok(sqlx::query("DELETE FROM users WHERE id=?")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(err)?
        .rows_affected()
        == 1)
}
