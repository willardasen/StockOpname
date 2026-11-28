use crate::{
    auth, commands,
    database::{options, Database, Result},
    inventory::{write, Input},
    queries::{self, Count},
};
use sqlx::Connection;
use std::path::Path;

async fn fixture(dir: &Path) -> Database {
    let db = Database::open(dir, "stock.db").await.unwrap();
    let hash = bcrypt::hash("fixture only", 4).unwrap();
    sqlx::query("INSERT INTO users(username,password) VALUES('test',?)")
        .bind(hash)
        .execute(&db.pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO brands(name) VALUES('A'),('B')")
        .execute(&db.pool)
        .await
        .unwrap();
    db
}
async fn product(db: &Database, name: &str, brand: &str, qty: i64) -> i64 {
    let mut c = db.pool.acquire().await.unwrap();
    write(
        &mut c,
        1,
        "create_product",
        &Input {
            name: Some(name.into()),
            brand: Some(brand.into()),
            min_stock: Some(0),
            stock: Some(qty),
            transaction_date: Some("2026-01-01 12:00:00".into()),
            ..Default::default()
        },
    )
    .await
    .unwrap()
}
async fn move_stock(db: &Database, p: i64, kind: &str, qty: i64, day: &str) -> Result<i64> {
    let mut c = db.pool.acquire().await.unwrap();
    write(
        &mut c,
        1,
        "create_transaction",
        &Input {
            product_id: Some(p),
            kind: Some(kind.into()),
            qty: Some(qty),
            created_at: Some(day.into()),
            ..Default::default()
        },
    )
    .await
}
async fn adjust(db: &Database, p: i64, n: i64, day: &str) -> i64 {
    let mut c = db.pool.acquire().await.unwrap();
    write(
        &mut c,
        1,
        "adjust_stock",
        &Input {
            product_id: Some(p),
            physical_count: Some(n),
            created_at: Some(day.into()),
            ..Default::default()
        },
    )
    .await
    .unwrap();
    sqlx::query_scalar("SELECT MAX(id) FROM transactions")
        .fetch_one(&mut *c)
        .await
        .unwrap()
}
async fn state(db: &Database, p: i64) -> (i64, i64) {
    sqlx::query_as("SELECT stock,(SELECT count(*) FROM transactions WHERE product_id=p.id) FROM products p WHERE id=?").bind(p).fetch_one(&db.pool).await.unwrap()
}
async fn correct(db: &Database, id: i64, qty: Option<i64>) -> Result<i64> {
    let mut c = db.pool.acquire().await.unwrap();
    write(
        &mut c,
        1,
        if qty.is_some() {
            "update_transaction"
        } else {
            "delete_transaction"
        },
        &Input {
            id: Some(id),
            qty,
            ..Default::default()
        },
    )
    .await
}
#[test]
fn concurrent_out_and_atomic_failure() {
    tauri::async_runtime::block_on(async {
        let temp = tempfile::tempdir().unwrap();
        let db = fixture(temp.path()).await;
        let p = product(&db, "sample", "A", 10).await;
        let a = move_stock(&db, p, "OUT", 7, "2026-01-02");
        let b = move_stock(&db, p, "OUT", 7, "2026-01-02");
        let (a, b) = tokio::join!(a, b);
        assert_ne!(a.is_ok(), b.is_ok());
        assert_eq!(state(&db, p).await, (3, 2));
        for invalid in [-1, 0, i64::MAX] {
            assert!(move_stock(&db, p, "IN", invalid, "2026-01-03")
                .await
                .is_err());
        }
        assert!(serde_json::from_str::<Input>(r#"{"qty":1.5}"#).is_err());
        sqlx::query("CREATE TRIGGER fail_history BEFORE INSERT ON transactions BEGIN SELECT RAISE(ABORT,'fixture failure'); END").execute(&db.pool).await.unwrap();
        assert!(move_stock(&db, p, "IN", 2, "2026-01-03").await.is_err());
        assert_eq!(state(&db, p).await, (3, 2));
        let mut c = db.pool.acquire().await.unwrap();
        assert!(write(
            &mut c,
            1,
            "create_product",
            &Input {
                name: Some("partial".into()),
                stock: Some(3),
                ..Default::default()
            }
        )
        .await
        .is_err());
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT count(*) FROM products")
                .fetch_one(&mut *c)
                .await
                .unwrap(),
            1
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT min_stock FROM products")
                .fetch_one(&mut *c)
                .await
                .unwrap(),
            0
        );
    })
}
#[test]
fn count_anchors_historical_corrections_and_signed_reversals() {
    tauri::async_runtime::block_on(async {
        let tmp = tempfile::tempdir().unwrap();
        let db = fixture(tmp.path()).await;
        let p = product(&db, "sample", "A", 10).await;
        let count = adjust(&db, p, 8, "2026-01-03").await;
        correct(&db, 1, Some(12)).await.unwrap();
        assert_eq!(state(&db, p).await, (8, 2));
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT signed_delta FROM transactions WHERE id=?")
                .bind(count)
                .fetch_one(&db.pool)
                .await
                .unwrap(),
            -4
        );
        move_stock(&db, p, "IN", 3, "2026-01-02").await.unwrap();
        assert_eq!(state(&db, p).await, (8, 3));
        correct(&db, count, None).await.unwrap();
        assert_eq!(state(&db, p).await, (15, 2));
        let plus = adjust(&db, p, 23, "2026-01-04").await;
        correct(&db, plus, None).await.unwrap();
        assert_eq!(state(&db, p).await, (15, 2));
        correct(&db, 1, None).await.unwrap();
        assert_eq!(state(&db, p).await, (3, 1));
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT current_stock_snapshot FROM transactions")
                .fetch_one(&db.pool)
                .await
                .unwrap(),
            3
        );
    })
}
#[test]
fn brand_day_and_midnight() {
    tauri::async_runtime::block_on(async {
        let tmp = tempfile::tempdir().unwrap();
        let db = fixture(tmp.path()).await;
        let p = product(&db, "one", "A", 0).await;
        let other = product(&db, "two", "B", 0).await;
        move_stock(&db, p, "IN", 4, "2026-01-01 23:59:59")
            .await
            .unwrap();
        move_stock(&db, p, "IN", 3, "2026-01-02 00:00:00")
            .await
            .unwrap();
        move_stock(&db, other, "IN", 5, "2026-01-02 01:30:00")
            .await
            .unwrap();
        for (brand, system, n) in [("A", 7, 7), ("B", 5, 4), ("A", 7, 6)] {
            queries::save_count(
                &db.pool,
                1,
                Count {
                    brand: brand.into(),
                    system_stock: system,
                    physical_stock: n,
                    note: None,
                },
                "2026-01-02",
            )
            .await
            .unwrap();
        }
        let rows: Vec<(i64, String, i64, i64)> =
            sqlx::query_as("SELECT id,brand,total_in,difference FROM global_opname ORDER BY id")
                .fetch_all(&db.pool)
                .await
                .unwrap();
        assert_eq!(rows, vec![(1, "A".into(), 3, -1), (2, "B".into(), 5, -1)]);
        assert_eq!(state(&db, p).await, (7, 2));
    })
}
#[test]
fn wal_restore_failure_session_and_restart() {
    tauri::async_runtime::block_on(async {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("profile");
        let db = fixture(&dir).await;
        assert!(db.authenticated().await.is_err());
        assert!(
            auth::authenticate(&db, "test".into(), "invalid".into(), None)
                .await
                .is_err()
        );
        auth::authenticate(&db, "test".into(), "fixture only".into(), None)
            .await
            .unwrap();
        let p = product(&db, "fixture", "A", 5).await;
        let (_work, _actor) = db.authenticated().await.unwrap();
        assert!(db.session.try_write().is_err());
        drop(_work);
        assert!(Database::open(&dir, "stock.db").await.is_err());
        let backup = tmp.path().join("saved.db");
        assert!(db.path.with_extension("db-wal").metadata().unwrap().len() > 32);
        commands::export_db(&db, &backup).await.unwrap();
        move_stock(&db, p, "IN", 4, "2026-01-02").await.unwrap();
        assert!(commands::export_db(&db, &db.path).await.is_err());
        let invalid = tmp.path().join("wrong.db");
        std::fs::write(&invalid, b"ordinary text").unwrap();
        let mut session = db.session.write().await;
        assert!(commands::restore_session(&db, &mut session, &invalid)
            .await
            .is_err());
        assert_eq!(session.user, Some(1));
        sqlx::query("CREATE TRIGGER fail_restore BEFORE INSERT ON products BEGIN SELECT RAISE(ABORT,'fixture failure'); END").execute(&db.pool).await.unwrap();
        assert!(commands::restore_session(&db, &mut session, &backup)
            .await
            .is_err());
        assert_eq!(state(&db, p).await, (9, 2));
        assert_eq!(session.user, Some(1));
        sqlx::query("DROP TRIGGER fail_restore")
            .execute(&db.pool)
            .await
            .unwrap();
        let recovery = commands::restore_session(&db, &mut session, &backup)
            .await
            .unwrap();
        assert!(session.user.is_none());
        drop(session);
        assert_eq!(state(&db, p).await, (5, 1));
        let mut old = sqlx::SqliteConnection::connect_with(&options(&recovery).read_only(true))
            .await
            .unwrap();
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT stock FROM products")
                .fetch_one(&mut old)
                .await
                .unwrap(),
            9
        );
        db.pool.close().await;
        drop(db);
        let again = Database::open(&dir, "stock.db").await.unwrap();
        assert_eq!(state(&again, p).await, (5, 1));
        assert!(again.authenticated().await.is_err());
    })
}
#[test]
fn backdated_count_persists_the_observed_snapshot() {
    tauri::async_runtime::block_on(async {
        let tmp = tempfile::tempdir().unwrap();
        let db = fixture(tmp.path()).await;
        let p = product(&db, "backdated", "A", 3).await;
        move_stock(&db, p, "IN", 4, "2026-01-03").await.unwrap();
        let count = adjust(&db, p, 2, "2026-01-02").await;
        assert_eq!(state(&db, p).await, (6, 3));
        db.pool.close().await;
        drop(db);
        let db = Database::open(tmp.path(), "stock.db").await.unwrap();
        let row: (i64,i64,i64,i64) = sqlx::query_as(
            "SELECT physical_count,current_stock_snapshot,signed_delta,qty FROM transactions WHERE id=?"
        ).bind(count).fetch_one(&db.pool).await.unwrap();
        assert_eq!(row, (2, 2, -1, 1));
        let latest: i64 = sqlx::query_scalar("SELECT current_stock_snapshot FROM transactions ORDER BY created_at DESC,id DESC LIMIT 1")
            .fetch_one(&db.pool).await.unwrap();
        assert_eq!(latest, 6);
        assert_eq!(state(&db, p).await, (6, 3));
    })
}
#[test]
fn invalid_inventory_backup_preserves_live_data_and_session() {
    tauri::async_runtime::block_on(async {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("profile");
        let db = fixture(&dir).await;
        let p = product(&db, "valid", "A", 4).await;
        auth::authenticate(&db, "test".into(), "fixture only".into(), None)
            .await
            .unwrap();
        for (i, change) in [
            "UPDATE products SET stock=-1",
            "UPDATE products SET min_stock=1.5",
            "UPDATE products SET stock=NULL",
            "UPDATE products SET ledger_base=9007199254740992",
            "UPDATE brands SET calculation_type='OTHER'",
            "UPDATE brands SET pcs_per_box=0",
            "UPDATE transactions SET qty=0",
            "UPDATE transactions SET physical_count=2",
            "UPDATE transactions SET current_stock_snapshot='invalid'",
            "INSERT INTO global_opname(date,system_stock,physical_stock,difference) VALUES('2026-01-02',3,1,2)",
        ].iter().enumerate() {
            let backup = tmp.path().join(format!("invalid-{i}.db"));
            commands::export_db(&db,&backup).await.unwrap();
            let mut copy = sqlx::SqliteConnection::connect_with(&options(&backup)).await.unwrap();
            sqlx::QueryBuilder::<sqlx::Sqlite>::new(*change).build().execute(&mut copy).await.unwrap();
            assert_eq!(sqlx::query_scalar::<_,String>("PRAGMA integrity_check").fetch_one(&mut copy).await.unwrap(),"ok");
            copy.close().await.unwrap();
            let mut session = db.session.write().await;
            let error = commands::restore_session(&db,&mut session,&backup).await.unwrap_err();
            assert!(error.contains("Nilai persediaan"), "{error}");
            assert_eq!(session.user,Some(1));
            assert_eq!(state(&db,p).await,(4,1));
        }
        assert!(!std::fs::read_dir(&dir).unwrap().any(|entry| entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with("sebelum-restore-")));
        move_stock(&db, p, "IN", 1, "2026-01-03").await.unwrap();
        assert_eq!(state(&db, p).await, (5, 2));
    })
}
#[test]
fn legacy_migration_preserves_ids_and_unknown_history() {
    tauri::async_runtime::block_on(async {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("stock.db");
        let mut c = sqlx::SqliteConnection::connect_with(&options(&path).create_if_missing(true))
            .await
            .unwrap();
        let old =
            include_str!("schema.sql").replace("date TEXT NOT NULL,", "date TEXT NOT NULL UNIQUE,");
        for s in old.split(';').map(str::trim).filter(|s| !s.is_empty()) {
            sqlx::QueryBuilder::<sqlx::Sqlite>::new(s)
                .build()
                .execute(&mut c)
                .await
                .unwrap();
        }
        sqlx::query("ALTER TABLE products DROP COLUMN size")
            .execute(&mut c)
            .await
            .unwrap();
        sqlx::query("INSERT INTO global_opname(id,date,system_stock,physical_stock,difference) VALUES(31,'2025-01-01',5,5,0)").execute(&mut c).await.unwrap();
        sqlx::query("INSERT INTO products(id,name,stock) VALUES(9,'old',7)")
            .execute(&mut c)
            .await
            .unwrap();
        crate::database::migrate(&mut c).await.unwrap();
        crate::database::migrate(&mut c).await.unwrap();
        assert_eq!(
            sqlx::query_as::<_, (i64, Option<String>)>("SELECT id,brand FROM global_opname")
                .fetch_one(&mut c)
                .await
                .unwrap(),
            (31, None)
        );
        assert_eq!(
            sqlx::query_as::<_, (i64, i64)>(
                "SELECT stock,(SELECT count(*) FROM transactions) FROM products"
            )
            .fetch_one(&mut c)
            .await
            .unwrap(),
            (7, 0)
        );
    })
}
