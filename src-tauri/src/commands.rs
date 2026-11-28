use crate::database::{columns, err, migrate, options, Database, Result, Session, TABLES};
use sqlx::{Connection, Row, SqliteConnection};
use std::{
    io::Write,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tempfile::NamedTempFile;

async fn validate(c: &mut SqliteConnection) -> Result<()> {
    let integrity: Vec<String> = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_all(&mut *c)
        .await
        .map_err(err)?;
    if integrity != ["ok"] {
        return Err("Integritas database gagal.".into());
    }
    if sqlx::query("PRAGMA foreign_key_check")
        .fetch_optional(&mut *c)
        .await
        .map_err(err)?
        .is_some()
    {
        return Err("Relasi database tidak valid.".into());
    }
    Ok(())
}

// SQLite's INTEGER affinity also accepts fractional numbers and text. Check the
// stored values before any recovery file or write transaction is created.
async fn validate_inventory(c: &mut SqliteConnection) -> Result<()> {
    let max = crate::database::MAX_QTY;
    for (table, ranges, other) in [
        ("products", &[
            ("stock", 0, max, false), ("min_stock", 0, max, false),
            ("ledger_base", 0, max, true), ("is_active", 0, 1, false),
        ][..], "0"),
        ("brands", &[("pcs_per_box", 1, max, false)][..],
            "calculation_type IS NULL OR calculation_type NOT IN ('BOX','SIZE')"),
        ("transactions", &[
            ("qty", 0, max, false), ("current_stock_snapshot", 0, max, true),
            ("physical_count", 0, max, true), ("signed_delta", -max, max, true),
            ("pcs_per_box", 1, max, true), ("is_opening", 0, 1, false),
        ][..], "type IS NULL OR type NOT IN ('IN','OUT','ADJUSTMENT')
            OR (type IN ('IN','OUT') AND (qty=0 OR physical_count IS NOT NULL OR signed_delta IS NOT NULL))
            OR calculation_type NOT IN ('BOX','SIZE')
            OR (physical_count IS NOT NULL AND (signed_delta IS NULL OR current_stock_snapshot IS NOT physical_count OR qty != abs(signed_delta)))"),
        ("global_opname", &[
            ("system_stock", 0, max, false), ("physical_stock", 0, max, false),
            ("difference", -max, max, false), ("total_in", 0, max, false),
            ("total_out", 0, max, false),
        ][..], "difference != physical_stock - system_stock"),
    ] {
        let mut conditions = vec![other.to_string()];
        for &(column, min, max, nullable) in ranges {
            let invalid = format!("(typeof({column}) != 'integer' OR {column} NOT BETWEEN {min} AND {max})");
            conditions.push(if nullable {format!("({column} IS NOT NULL AND {invalid})")} else {invalid});
        }
        let sql = format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE {})", conditions.join(" OR "));
        let invalid: bool = sqlx::QueryBuilder::<sqlx::Sqlite>::new(sql).build_query_scalar().fetch_one(&mut *c).await.map_err(err)?;
        if invalid { return Err(format!("Nilai persediaan tidak valid pada tabel {table}. Periksa salinan cadangan.")); }
    }
    Ok(())
}
fn safe_destination(live: &Path, path: &Path) -> Result<()> {
    let parent = path
        .parent()
        .ok_or("Lokasi berkas tidak valid.")?
        .canonicalize()
        .map_err(err)?;
    if parent.starts_with(
        live.parent()
            .ok_or("Lokasi database tidak valid.")?
            .canonicalize()
            .map_err(err)?,
    ) {
        return Err("Pilih lokasi di luar direktori database aplikasi.".into());
    }
    if std::fs::symlink_metadata(path).is_ok_and(|m| m.file_type().is_symlink() || !m.is_file()) {
        return Err("Pilih berkas biasa.".into());
    }
    Ok(())
}
async fn snapshot(c: &mut SqliteConnection, path: &Path) -> Result<()> {
    sqlx::query("VACUUM main INTO ?")
        .bind(path.to_str().ok_or("Lokasi tidak valid.")?)
        .execute(c)
        .await
        .map_err(err)?;
    std::fs::File::options()
        .write(true)
        .open(path)
        .and_then(|f| f.sync_all())
        .map_err(err)?;
    let mut check = SqliteConnection::connect_with(&options(path).read_only(true))
        .await
        .map_err(err)?;
    validate(&mut check).await
}
pub async fn export_db(db: &Database, path: &Path) -> Result<()> {
    safe_destination(&db.path, path)?;
    let tmp = NamedTempFile::new_in(path.parent().ok_or("Direktori diperlukan.")?).map_err(err)?;
    let mut c = db.pool.acquire().await.map_err(err)?;
    snapshot(&mut c, tmp.path()).await?;
    tmp.persist(path).map_err(err)?;
    Ok(())
}
async fn inspect_source(c: &mut SqliteConnection) -> Result<()> {
    let rows =
        sqlx::query("SELECT name,type,sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*'")
            .fetch_all(&mut *c)
            .await
            .map_err(err)?;
    let mut tables = Vec::new();
    for row in rows {
        let name: String = row.get(0);
        let kind: &str = row.get(1);
        let sql: String = row.get(2);
        match kind {
            "table"
                if TABLES.contains(&name.as_str())
                    && !sql.to_uppercase().contains("VIRTUAL TABLE") =>
            {
                tables.push(name)
            }
            "index"
                if [
                    "idx_products_name",
                    "idx_products_brand",
                    "opname_brand_day",
                    "tx_product_order",
                    "tx_date",
                    "brands_lookup",
                ]
                .contains(&name.as_str()) => {}
            _ => return Err("Skema cadangan berisi objek yang tidak didukung.".into()),
        }
    }
    if !["users", "products", "transactions"]
        .iter()
        .all(|t| tables.iter().any(|s| s == t))
    {
        return Err("Berkas bukan database Stock Opname.".into());
    }
    validate(c).await
}
pub async fn restore(db: &Database, path: &Path) -> Result<PathBuf> {
    if path.canonicalize().map_err(err)? == db.path.canonicalize().map_err(err)? {
        return Err("Database aktif tidak dapat diimpor ke dirinya sendiri.".into());
    }
    let staged = NamedTempFile::new().map_err(err)?;
    let mut source = SqliteConnection::connect_with(&options(path).read_only(true))
        .await
        .map_err(err)?;
    inspect_source(&mut source).await?;
    snapshot(&mut source, staged.path()).await?;
    source.close().await.map_err(err)?;
    let mut stage = SqliteConnection::connect_with(&options(staged.path()))
        .await
        .map_err(err)?;
    inspect_source(&mut stage).await?;
    migrate(&mut stage).await?;
    let mut live = SqliteConnection::connect_with(&options(&db.path))
        .await
        .map_err(err)?;
    let mut fields = Vec::new();
    for table in TABLES {
        let mut expected = columns(&mut live, table).await?;
        let mut found = columns(&mut stage, table).await?;
        expected.sort();
        found.sort();
        if expected != found {
            return Err(format!("Kolom tabel {table} tidak kompatibel."));
        }
        if expected
            .iter()
            .any(|s| !s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_'))
        {
            return Err("Nama kolom tidak didukung.".into());
        }
        fields.push(expected.join(","));
    }
    validate(&mut stage).await?;
    validate_inventory(&mut stage).await?;
    stage.close().await.map_err(err)?;
    let recovery = tempfile::Builder::new()
        .prefix("sebelum-restore-")
        .suffix(".db")
        .tempfile_in(db.path.parent().ok_or("Lokasi tidak valid.")?)
        .map_err(err)?;
    snapshot(&mut live, recovery.path()).await?;
    let (_, saved) = recovery.keep().map_err(err)?;
    sqlx::query("ATTACH DATABASE ? AS incoming")
        .bind(staged.path().to_str().ok_or("Lokasi tidak valid.")?)
        .execute(&mut live)
        .await
        .map_err(err)?;
    let mut tx = live.begin_with("BEGIN IMMEDIATE").await.map_err(err)?;
    for table in TABLES.iter().rev() {
        sqlx::QueryBuilder::<sqlx::Sqlite>::new(format!("DELETE FROM main.{table}"))
            .build()
            .execute(&mut *tx)
            .await
            .map_err(err)?;
    }
    for (table, cols) in TABLES.iter().zip(fields) {
        let sql = format!("INSERT INTO main.{table}({cols}) SELECT {cols} FROM incoming.{table}");
        sqlx::QueryBuilder::<sqlx::Sqlite>::new(sql)
            .build()
            .execute(&mut *tx)
            .await
            .map_err(err)?;
    }
    crate::database::statements(&mut tx,"DELETE FROM main.sqlite_sequence; INSERT INTO main.sqlite_sequence(name,seq) SELECT name,seq FROM incoming.sqlite_sequence").await?;
    validate(&mut tx).await?;
    tx.commit().await.map_err(err)?;
    Ok(saved)
}
#[tauri::command]
pub async fn backup_database(app: AppHandle, db: State<'_, Database>) -> Result<bool> {
    let (_guard, _) = db.authenticated().await?;
    let path = app
        .dialog()
        .file()
        .add_filter("SQLite", &["db", "sqlite"])
        .set_file_name("stock_backup.db")
        .blocking_save_file();
    if let Some(path) = path {
        export_db(&db, &path.into_path().map_err(err)?).await?;
        return Ok(true);
    }
    Ok(false)
}
#[tauri::command]
pub async fn import_database(app: AppHandle, db: State<'_, Database>) -> Result<Option<PathBuf>> {
    let mut session = db
        .session
        .try_write()
        .map_err(|_| "Database sedang digunakan. Coba lagi.")?;
    session.user.ok_or("Silakan masuk kembali.")?;
    let Some(path) = app
        .dialog()
        .file()
        .add_filter("SQLite", &["db", "sqlite"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    Ok(Some(
        restore_session(&db, &mut session, &path.into_path().map_err(err)?).await?,
    ))
}
pub async fn restore_session(db: &Database, session: &mut Session, path: &Path) -> Result<PathBuf> {
    session.user.ok_or("Silakan masuk kembali.")?;
    let saved = restore(db, path).await?;
    *session = Session::default();
    Ok(saved)
}
#[tauri::command]
pub async fn export_workbook(
    app: AppHandle,
    db: State<'_, Database>,
    filename: String,
    bytes: Vec<u8>,
) -> Result<bool> {
    let (_guard, _) = db.authenticated().await?;
    if Path::new(&filename).file_name().and_then(|s| s.to_str()) != Some(&filename)
        || !filename.ends_with(".xlsx")
        || !bytes.starts_with(b"PK")
    {
        return Err("Berkas Excel tidak valid.".into());
    }
    let Some(path) = app
        .dialog()
        .file()
        .add_filter("Excel", &["xlsx"])
        .set_file_name(filename)
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = path.into_path().map_err(err)?;
    if !path
        .extension()
        .and_then(|s| s.to_str())
        .is_some_and(|s| s.eq_ignore_ascii_case("xlsx"))
    {
        return Err("Gunakan ekstensi .xlsx.".into());
    }
    safe_destination(&db.path, &path)?;
    let mut tmp = NamedTempFile::new_in(path.parent().ok_or("Lokasi diperlukan.")?).map_err(err)?;
    tmp.write_all(&bytes)
        .and_then(|_| tmp.as_file().sync_all())
        .map_err(err)?;
    tmp.persist(path).map_err(err)?;
    Ok(true)
}
