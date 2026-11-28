use crate::database::Database;
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn reset_stock(db: State<'_, Database>, password: String) -> Result<bool, String> {
    let session = db
        .session
        .try_write()
        .map_err(|_| "Penyimpanan data sedang berlangsung. Coba lagi.")?;
    let user = session.user.ok_or("Silakan masuk kembali.")?;
    reset_stock_for_user(&db.pool, user, password).await
}

async fn reset_stock_for_user(
    pool: &SqlitePool,
    user_id: i64,
    password: String,
) -> Result<bool, String> {
    let password_hash = sqlx::query_scalar::<_, String>("SELECT password FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| error.to_string())?;

    let Some(password_hash) = password_hash else {
        return Err("Akun tidak ditemukan. Masuk kembali untuk mereset stok.".into());
    };

    let valid_password = tauri::async_runtime::spawn_blocking(move || {
        bcrypt::verify(password, &password_hash).unwrap_or(false)
    })
    .await
    .map_err(|error| error.to_string())?;
    if !valid_password {
        return Ok(false);
    }

    clear_stock(pool).await.map_err(|error| error.to_string())?;
    Ok(true)
}

async fn clear_stock(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let mut transaction = pool.begin_with("BEGIN IMMEDIATE").await?;
    for statement in [
        "UPDATE products SET stock = 0, ledger_base = 0",
        "DELETE FROM transactions",
        "DELETE FROM global_opname",
    ] {
        if let Err(error) = sqlx::query(statement).execute(&mut *transaction).await {
            transaction.rollback().await?;
            return Err(error);
        }
    }

    transaction.commit().await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    const PASSWORD: &str = "reset-test-password";
    const TEST_BCRYPT_COST: u32 = 4;

    async fn seed_database() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::raw_sql(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, password TEXT NOT NULL);
             CREATE TABLE brands (id INTEGER PRIMARY KEY, name TEXT, pcs_per_box INTEGER);
             CREATE TABLE products (
                 id INTEGER PRIMARY KEY AUTOINCREMENT, brand_id INTEGER REFERENCES brands(id),
                 stock INTEGER, min_stock INTEGER, is_active INTEGER, ledger_base INTEGER
             );
             CREATE TABLE transactions (
                 id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id)
             );
             CREATE TABLE global_opname (id INTEGER PRIMARY KEY AUTOINCREMENT);
             INSERT INTO brands VALUES (7, 'Test Brand', 12);
             INSERT INTO products VALUES (11, 7, 40, 5, 1, 0), (12, 7, 9, 3, 0, 0);
             INSERT INTO transactions VALUES (21, 11);
             INSERT INTO global_opname VALUES (31);",
        )
        .execute(&pool)
        .await
        .unwrap();
        let hash = bcrypt::hash(PASSWORD, TEST_BCRYPT_COST).unwrap();
        let other_hash = bcrypt::hash("other-test-password", TEST_BCRYPT_COST).unwrap();
        sqlx::query("INSERT INTO users VALUES (1, ?), (2, ?)")
            .bind(hash)
            .bind(other_hash)
            .execute(&pool)
            .await
            .unwrap();
        pool
    }

    async fn stock_and_history(pool: &SqlitePool) -> (Vec<i64>, i64, i64) {
        let stocks = sqlx::query_scalar("SELECT stock FROM products ORDER BY id")
            .fetch_all(pool)
            .await
            .unwrap();
        let history: (i64, i64) = sqlx::query_as(
            "SELECT (SELECT COUNT(*) FROM transactions), (SELECT COUNT(*) FROM global_opname)",
        )
        .fetch_one(pool)
        .await
        .unwrap();
        (stocks, history.0, history.1)
    }

    #[test]
    fn reset_requires_the_current_account_password_and_preserves_master_data() {
        tauri::async_runtime::block_on(async {
            let pool = seed_database().await;
            let baseline_master = sqlx::query_as::<_, (i64, i64, i64, i64)>(
                "SELECT id, brand_id, min_stock, is_active FROM products ORDER BY id",
            )
            .fetch_all(&pool)
            .await
            .unwrap();

            assert!(!reset_stock_for_user(&pool, 2, PASSWORD.into())
                .await
                .unwrap());
            assert!(reset_stock_for_user(&pool, 3, PASSWORD.into())
                .await
                .is_err());
            assert_eq!(stock_and_history(&pool).await, (vec![40, 9], 1, 1));

            assert!(reset_stock_for_user(&pool, 1, PASSWORD.into())
                .await
                .unwrap());
            assert!(reset_stock_for_user(&pool, 1, PASSWORD.into())
                .await
                .unwrap());
            assert_eq!(stock_and_history(&pool).await, (vec![0, 0], 0, 0));

            let master = sqlx::query_as::<_, (i64, i64, i64, i64)>(
                "SELECT id, brand_id, min_stock, is_active FROM products ORDER BY id",
            )
            .fetch_all(&pool)
            .await
            .unwrap();
            assert_eq!(master, baseline_master);
            let brand = sqlx::query_as::<_, (String, i64)>(
                "SELECT name, pcs_per_box FROM brands WHERE id = 7",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(brand, ("Test Brand".into(), 12));
            let users = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(users, 2);
            let sequences =
                sqlx::query_scalar::<_, i64>("SELECT seq FROM sqlite_sequence ORDER BY name")
                    .fetch_all(&pool)
                    .await
                    .unwrap();
            assert_eq!(sequences, vec![31, 12, 21]);
        });
    }

    #[test]
    fn reset_rolls_back_when_a_history_delete_fails() {
        tauri::async_runtime::block_on(async {
            let pool = seed_database().await;
            sqlx::query(
                "CREATE TRIGGER fail_reset BEFORE DELETE ON global_opname
                 BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
            )
            .execute(&pool)
            .await
            .unwrap();

            let error = reset_stock_for_user(&pool, 1, PASSWORD.into())
                .await
                .unwrap_err();
            assert!(error.contains("forced failure"));
            assert_eq!(stock_and_history(&pool).await, (vec![40, 9], 1, 1));
        });
    }
}
