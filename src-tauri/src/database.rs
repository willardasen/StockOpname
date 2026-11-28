use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    Connection, Row, SqliteConnection, SqlitePool,
};
use std::{
    fs::File,
    path::{Path, PathBuf},
    time::Duration,
};
use tokio::sync::{RwLock, RwLockReadGuard};

pub type Result<T> = std::result::Result<T, String>;
pub fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
pub const TABLES: &[&str] = &[
    "users",
    "brands",
    "colors",
    "brand_types",
    "type_numbers",
    "products",
    "transactions",
    "global_opname",
];
pub const MAX_QTY: i64 = 9_007_199_254_740_991;

#[derive(Default)]
pub struct Session {
    pub user: Option<i64>,
    pub failures: u32,
    pub retry_at: Option<std::time::Instant>,
}

pub struct Database {
    pub pool: SqlitePool,
    pub path: PathBuf,
    pub session: RwLock<Session>,
    _instance: File,
}
impl Database {
    pub async fn open(dir: &Path, filename: &str) -> Result<Self> {
        std::fs::create_dir_all(dir).map_err(err)?;
        let path = dir.join(filename);
        let instance = File::options()
            .create(true)
            .truncate(false)
            .write(true)
            .open(path.with_extension("lock"))
            .map_err(err)?;
        instance
            .try_lock()
            .map_err(|_| "Profil stok sedang dibuka oleh proses lain.".to_string())?;
        let pool = SqlitePoolOptions::new()
            .max_connections(4)
            .connect_with(options(&path).create_if_missing(true))
            .await
            .map_err(err)?;
        let mut c = pool.acquire().await.map_err(err)?;
        sqlx::query("PRAGMA journal_mode=WAL")
            .execute(&mut *c)
            .await
            .map_err(err)?;
        migrate(&mut c).await?;
        drop(c);
        Ok(Self {
            pool,
            path,
            session: RwLock::default(),
            _instance: instance,
        })
    }
    pub async fn authenticated(&self) -> Result<(RwLockReadGuard<'_, Session>, i64)> {
        let guard = self.session.read().await;
        let id = guard.user.ok_or("Silakan masuk kembali.")?;
        Ok((guard, id))
    }
}

pub fn options(path: &Path) -> SqliteConnectOptions {
    SqliteConnectOptions::new()
        .filename(path)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5))
        .pragma("trusted_schema", "OFF")
}
pub async fn columns(c: &mut SqliteConnection, table: &str) -> Result<Vec<String>> {
    sqlx::query_scalar("SELECT name FROM pragma_table_xinfo(?) ORDER BY cid")
        .bind(table)
        .fetch_all(c)
        .await
        .map_err(err)
}
pub async fn migrate(c: &mut SqliteConnection) -> Result<()> {
    let mut tx = c.begin_with("BEGIN IMMEDIATE").await.map_err(err)?;
    let c = &mut *tx;
    let version: i64 = sqlx::query_scalar("PRAGMA user_version")
        .fetch_one(&mut *c)
        .await
        .map_err(err)?;
    if version > 1 {
        return Err("Versi database lebih baru daripada aplikasi.".into());
    }
    if version == 0 {
        statements(c, include_str!("schema.sql")).await?;
        for (table, name, decl) in [
            ("brands", "pcs_per_box", "INTEGER DEFAULT 10"),
            ("brands", "calculation_type", "TEXT DEFAULT 'BOX'"),
            ("products", "size", "TEXT"),
            ("products", "ledger_base", "INTEGER"),
            (
                "brand_types",
                "brand_id",
                "INTEGER REFERENCES brands(id) ON DELETE CASCADE",
            ),
            (
                "type_numbers",
                "brand_id",
                "INTEGER REFERENCES brands(id) ON DELETE CASCADE",
            ),
            ("global_opname", "brand", "TEXT"),
            ("transactions", "physical_count", "INTEGER"),
            ("transactions", "signed_delta", "INTEGER"),
            ("transactions", "calculation_type", "TEXT"),
            ("transactions", "pcs_per_box", "INTEGER"),
            ("transactions", "brand_at_entry", "TEXT"),
            ("transactions", "is_opening", "INTEGER NOT NULL DEFAULT 0"),
        ] {
            if !columns(c, table).await?.iter().any(|s| s == name) {
                sqlx::QueryBuilder::<sqlx::Sqlite>::new(format!(
                    "ALTER TABLE {table} ADD COLUMN {name} {decl}"
                ))
                .build()
                .execute(&mut *c)
                .await
                .map_err(err)?;
            }
        }
        let unique: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM pragma_index_list('global_opname') WHERE origin='u'",
        )
        .fetch_one(&mut *c)
        .await
        .map_err(err)?;
        if unique > 0 {
            let fields="id,date,brand,system_stock,physical_stock,difference,total_in,total_out,note,user_id,created_at";
            let cols = columns(c, "global_opname").await?;
            if cols.len() != fields.split(',').count()
                || cols.iter().any(|s| !fields.split(',').any(|f| f == s))
            {
                return Err("Struktur opname khusus memerlukan pemeriksaan manual.".into());
            }
            let custom:i64=sqlx::query_scalar("SELECT count(*) FROM sqlite_schema WHERE tbl_name='global_opname' AND type IN ('trigger','index') AND sql IS NOT NULL").fetch_one(&mut *c).await.map_err(err)?;
            if custom > 0 {
                return Err(
                    "Indeks atau trigger opname khusus memerlukan pemeriksaan manual.".into(),
                );
            }
            let seq: i64 = sqlx::query_scalar(
                "SELECT COALESCE(MAX(seq),0) FROM sqlite_sequence WHERE name='global_opname'",
            )
            .fetch_one(&mut *c)
            .await
            .map_err(err)?;
            sqlx::query("ALTER TABLE global_opname RENAME TO legacy_global_opname")
                .execute(&mut *c)
                .await
                .map_err(err)?;
            statements(c, include_str!("schema.sql")).await?;
            sqlx::QueryBuilder::<sqlx::Sqlite>::new(format!(
                "INSERT INTO global_opname ({fields}) SELECT {fields} FROM legacy_global_opname"
            ))
            .build()
            .execute(&mut *c)
            .await
            .map_err(err)?;
            sqlx::query("DROP TABLE legacy_global_opname")
                .execute(&mut *c)
                .await
                .map_err(err)?;
            sqlx::query("UPDATE sqlite_sequence SET seq=max(seq,?) WHERE name='global_opname'")
                .bind(seq)
                .execute(&mut *c)
                .await
                .map_err(err)?;
        }
        statements(
            c,
            "CREATE UNIQUE INDEX opname_brand_day ON global_opname(date,brand COLLATE NOCASE);
            CREATE INDEX tx_product_order ON transactions(product_id,created_at,id);
            CREATE INDEX tx_date ON transactions(created_at,id);
            CREATE INDEX brands_lookup ON brands(lower(trim(name)));
            PRAGMA user_version=1;",
        )
        .await?;
    }
    tx.commit().await.map_err(err)
}

pub fn json_row(row: sqlx::sqlite::SqliteRow) -> Result<serde_json::Value> {
    use sqlx::{Column, TypeInfo, ValueRef};
    let mut object = serde_json::Map::new();
    for (i, col) in row.columns().iter().enumerate() {
        let val = row.try_get_raw(i).map_err(err)?;
        let value = if val.is_null() {
            serde_json::Value::Null
        } else {
            match val.type_info().name() {
                "INTEGER" | "BOOLEAN" => {
                    serde_json::json!(row.try_get_unchecked::<i64, _>(i).map_err(err)?)
                }
                "REAL" => serde_json::json!(row.try_get_unchecked::<f64, _>(i).map_err(err)?),
                _ => serde_json::json!(row.try_get_unchecked::<String, _>(i).map_err(err)?),
            }
        };
        object.insert(col.name().to_string(), value);
    }
    Ok(object.into())
}

pub async fn statements(c: &mut SqliteConnection, sql: &'static str) -> Result<()> {
    for statement in sql.split(';').map(str::trim).filter(|s| !s.is_empty()) {
        sqlx::query(statement).execute(&mut *c).await.map_err(err)?;
    }
    Ok(())
}
