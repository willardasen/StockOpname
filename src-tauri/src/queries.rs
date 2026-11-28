use crate::database::{err, json_row, Database, Result};
use crate::inventory::quantity;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{QueryBuilder, Sqlite};
use tauri::State;

#[derive(Deserialize, Default)]
#[serde(default)]
pub struct Filter {
    id: Option<i64>,
    product_id: Option<i64>,
    user_id: Option<i64>,
    kind: Option<String>,
    brand: Option<String>,
    brand_type: Option<String>,
    type_number: Option<String>,
    color: Option<String>,
    keyword: Option<String>,
    start: Option<String>,
    end: Option<String>,
    month: Option<String>,
    limit: Option<i64>,
    offset: i64,
}
const PRODUCT:&str="SELECT p.*, COALESCE(b.pcs_per_box,10) AS pcs_per_box,COALESCE(b.calculation_type,'BOX') AS calculation_type
    FROM products p LEFT JOIN brands b ON b.id=(SELECT id FROM brands WHERE lower(trim(name))=lower(trim(p.brand)) ORDER BY id LIMIT 1)";
const HISTORY:&str="SELECT t.id,t.product_id,t.user_id,t.type,t.qty,t.current_stock_snapshot,t.note,t.created_at,t.signed_delta,
    p.name AS product_name,COALESCE(t.brand_at_entry,p.brand) AS brand,p.brand_type,p.type_number,p.color,p.size,u.username,
    COALESCE(t.pcs_per_box,b.pcs_per_box,10) AS pcs_per_box,COALESCE(t.calculation_type,b.calculation_type,'BOX') AS calculation_type
    FROM transactions t JOIN products p ON p.id=t.product_id JOIN users u ON u.id=t.user_id
    LEFT JOIN brands b ON b.id=(SELECT id FROM brands WHERE lower(trim(name))=lower(trim(p.brand)) ORDER BY id LIMIT 1)";
fn filters(q: &mut QueryBuilder<Sqlite>, f: &Filter, history: bool) {
    for (col, v) in [
        (
            if history {
                "COALESCE(t.brand_at_entry,p.brand)"
            } else {
                "p.brand"
            },
            &f.brand,
        ),
        ("p.brand_type", &f.brand_type),
        ("p.type_number", &f.type_number),
        ("p.color", &f.color),
    ] {
        if let Some(s) = v.as_deref().filter(|s| !s.is_empty()) {
            q.push(" AND ").push(col).push("=").push_bind(s);
        }
    }
    if let Some(s) = f.keyword.as_deref().filter(|s| !s.trim().is_empty()) {
        q.push(" AND (");
        let cols: &[&str] = if history {
            &["p.name", "t.id", "t.note", "u.username"]
        } else {
            &["p.name", "p.brand", "p.type_number", "p.color", "p.size"]
        };
        for (i, col) in cols.iter().enumerate() {
            if i > 0 {
                q.push(" OR ");
            }
            q.push(*col)
                .push(" LIKE ")
                .push_bind(format!("%{}%", s.trim()));
        }
        q.push(")");
    }
}
fn dates(q: &mut QueryBuilder<Sqlite>, col: &str, f: &Filter) {
    if let Some(s) = f.start.as_deref().filter(|s| !s.is_empty()) {
        q.push(" AND ").push(col).push(">=").push_bind(s);
    }
    if let Some(s) = f.end.as_deref().filter(|s| !s.is_empty()) {
        q.push(" AND ")
            .push(col)
            .push("<date(")
            .push_bind(s)
            .push(",'+1 day')");
    }
}
pub async fn read(pool: &sqlx::SqlitePool, kind: &str, f: &Filter) -> Result<Vec<Value>> {
    let count = matches!(kind, "products_count" | "history_count");
    let kind = kind
        .strip_suffix("_count")
        .filter(|_| count)
        .unwrap_or(kind);
    let mut q = QueryBuilder::<Sqlite>::new(if count {
        "SELECT count(*) AS count FROM ("
    } else {
        ""
    });
    match kind {
        "products" | "product" | "low_stock" => {
            q.push(PRODUCT).push(" WHERE 1=1");
            if kind == "product" {
                q.push(" AND p.id=").push_bind(f.id);
            } else {
                q.push(" AND p.is_active=1");
            }
            if kind == "low_stock" {
                q.push(" AND p.stock<=p.min_stock");
            }
            filters(&mut q, f, false);
            q.push(" ORDER BY p.name,p.id");
        }
        "history" => {
            q.push(HISTORY).push(" WHERE 1=1");
            if let Some(id) = f.product_id {
                q.push(" AND t.product_id=").push_bind(id);
            }
            if let Some(id) = f.user_id {
                q.push(" AND t.user_id=").push_bind(id);
            }
            if let Some(t) = f.kind.as_deref().filter(|s| !s.is_empty()) {
                q.push(" AND t.type=").push_bind(t);
            }
            filters(&mut q, f, true);
            dates(&mut q, "t.created_at", f);
            q.push(" ORDER BY t.created_at DESC,t.id DESC");
        }
        "product_stats" => {
            q.push("SELECT count(*) AS count,coalesce(sum(stock),0) AS total,count(*) FILTER (WHERE stock<=min_stock) AS low_count FROM products WHERE is_active=1");
        }
        "tx_count" => {
            q.push("SELECT count(*) AS count FROM transactions");
        }
        "brand_stock" => {
            q.push("SELECT COALESCE((SELECT SUM(stock) FROM products WHERE is_active=1 AND lower(trim(brand))=lower(trim(b.name))),0) AS totalStock,b.pcs_per_box AS pcsPerBox,b.calculation_type AS calculationType FROM brands b WHERE b.name=").push_bind(&f.brand);
        }
        "opnames" => {
            q.push("SELECT * FROM global_opname WHERE 1=1");
            dates(&mut q, "date", f);
            q.push(" ORDER BY date DESC,id DESC");
        }
        "sales" => {
            let month = format!("{}-01", f.month.as_deref().unwrap_or(""));
            chrono::NaiveDate::parse_from_str(&month, "%Y-%m-%d").map_err(err)?;
            q.push("SELECT t.product_id,p.name AS product_name,COALESCE(t.brand_at_entry,p.brand) AS brand,p.brand_type,p.type_number,p.color,
                COALESCE(t.calculation_type,b.calculation_type,'BOX') AS calculation_type,SUM(CASE WHEN t.type='OUT' THEN t.qty ELSE 0 END) AS total_qty_out,
                SUM(CASE WHEN t.type='IN' THEN t.qty ELSE 0 END) AS total_qty_in,count(*) AS transaction_count
                FROM transactions t JOIN products p ON p.id=t.product_id LEFT JOIN brands b ON b.id=(SELECT id FROM brands WHERE lower(trim(name))=lower(trim(p.brand)) ORDER BY id LIMIT 1)
                WHERE t.type IN ('IN','OUT') AND t.created_at>=").push_bind(month.clone()).push(" AND t.created_at<date(").push_bind(month).push(",'+1 month') GROUP BY t.product_id,COALESCE(t.brand_at_entry,p.brand),COALESCE(t.calculation_type,b.calculation_type,'BOX') ORDER BY total_qty_out DESC,t.product_id");
        }
        "brands" | "brand_types" | "type_numbers" | "colors" => {
            q.push("SELECT * FROM ")
                .push(kind)
                .push(" ORDER BY name,id");
        }
        "users" => {
            q.push("SELECT id,username,created_at FROM users ORDER BY id");
        }
        _ => return Err("Kueri tidak dikenal.".into()),
    }
    if count {
        q.push(")");
    } else if let Some(limit) = f.limit {
        q.push(" LIMIT ")
            .push_bind(limit.clamp(1, 1000))
            .push(" OFFSET ")
            .push_bind(f.offset.max(0));
    }
    q.build()
        .fetch_all(pool)
        .await
        .map_err(err)?
        .into_iter()
        .map(json_row)
        .collect()
}
#[tauri::command]
pub async fn read_data(
    db: State<'_, Database>,
    kind: String,
    filter: Filter,
) -> Result<Vec<Value>> {
    let (_guard, _) = db.authenticated().await?;
    read(&db.pool, &kind, &filter).await
}
#[derive(Deserialize)]
pub struct MasterInput {
    id: Option<i64>,
    name: Option<String>,
    brand_id: Option<i64>,
    pcs_per_box: Option<i64>,
    calculation_type: Option<String>,
}
#[tauri::command]
pub async fn master_write(
    db: State<'_, Database>,
    table: String,
    input: MasterInput,
) -> Result<bool> {
    let (_guard, _) = db.authenticated().await?;
    if !matches!(
        table.as_str(),
        "brands" | "brand_types" | "type_numbers" | "colors"
    ) {
        return Err("Data master tidak dikenal.".into());
    }
    let mut tx = db.pool.begin_with("BEGIN IMMEDIATE").await.map_err(err)?;
    if let Some(id) = input.id {
        if table == "brands" {
            let used:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM products p JOIN brands b ON lower(trim(p.brand))=lower(trim(b.name)) WHERE b.id=?)").bind(id).fetch_one(&mut *tx).await.map_err(err)?;
            if used {
                return Err("Merek masih digunakan oleh produk.".into());
            }
        }
        sqlx::QueryBuilder::<sqlx::Sqlite>::new(format!("DELETE FROM {table} WHERE id=?"))
            .build()
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(err)?;
    } else {
        let name = input.name.as_deref().unwrap_or("").trim();
        if name.is_empty() {
            return Err("Nama diperlukan.".into());
        }
        let mut dup = QueryBuilder::new("SELECT EXISTS(SELECT 1 FROM ");
        dup.push(&table)
            .push(" WHERE lower(trim(name))=lower(")
            .push_bind(name)
            .push(")");
        if matches!(table.as_str(), "type_numbers" | "brand_types") {
            dup.push(" AND brand_id=")
                .push_bind(input.brand_id.ok_or("Merek diperlukan.")?);
        }
        dup.push(")");
        if dup
            .build_query_scalar::<bool>()
            .fetch_one(&mut *tx)
            .await
            .map_err(err)?
        {
            return Err("Nama sudah terdaftar.".into());
        }
        match table.as_str() {
            "brands" => {
                let unit = input.calculation_type.as_deref().unwrap_or("BOX");
                let ratio = quantity(input.pcs_per_box.unwrap_or(10))?;
                if ratio == 0 || !matches!(unit, "SIZE" | "BOX") {
                    return Err("Konversi merek tidak valid.".into());
                }
                sqlx::query("INSERT INTO brands(name,pcs_per_box,calculation_type) VALUES(?,?,?)")
                    .bind(name)
                    .bind(if unit == "SIZE" { 1 } else { ratio })
                    .bind(unit)
                    .execute(&mut *tx)
                    .await
                    .map_err(err)?;
            }
            "colors" => {
                sqlx::query("INSERT INTO colors(name) VALUES(?)")
                    .bind(name)
                    .execute(&mut *tx)
                    .await
                    .map_err(err)?;
            }
            _ => {
                sqlx::QueryBuilder::<sqlx::Sqlite>::new(format!(
                    "INSERT INTO {table}(name,brand_id) VALUES(?,?)"
                ))
                .build()
                .bind(name)
                .bind(input.brand_id)
                .execute(&mut *tx)
                .await
                .map_err(err)?;
            }
        }
    }
    tx.commit().await.map_err(err)?;
    Ok(true)
}
#[derive(Deserialize)]
pub struct Count {
    pub brand: String,
    pub physical_stock: i64,
    pub system_stock: i64,
    pub note: Option<String>,
}
pub async fn save_count(
    pool: &sqlx::SqlitePool,
    user: i64,
    count: Count,
    day: &str,
) -> Result<bool> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(err)?;
    let brand: String = sqlx::query_scalar("SELECT name FROM brands WHERE name=?")
        .bind(&count.brand)
        .fetch_one(&mut *tx)
        .await
        .map_err(err)?;
    let stock:i64=sqlx::query_scalar("SELECT COALESCE(sum(stock),0) FROM products WHERE is_active=1 AND lower(trim(brand))=lower(trim(?))").bind(&brand).fetch_one(&mut *tx).await.map_err(err)?;
    if stock != count.system_stock {
        return Err("Stok berubah selama penghitungan. Muat ulang stok merek.".into());
    }
    let physical = quantity(count.physical_stock)?;
    sqlx::query("INSERT INTO global_opname(date,brand,system_stock,physical_stock,difference,note,user_id,total_in,total_out)
        SELECT ?,?,?,?,?,?,?,coalesce(sum(CASE WHEN t.type='IN' THEN t.qty ELSE 0 END),0),coalesce(sum(CASE WHEN t.type='OUT' THEN t.qty ELSE 0 END),0)
        FROM transactions t JOIN products p ON p.id=t.product_id WHERE lower(trim(coalesce(t.brand_at_entry,p.brand)))=lower(trim(?))
        AND t.created_at>=? AND t.created_at<date(?,'+1 day')
        ON CONFLICT(date,brand COLLATE NOCASE) DO UPDATE SET system_stock=excluded.system_stock,physical_stock=excluded.physical_stock,
        difference=excluded.difference,note=excluded.note,user_id=excluded.user_id,total_in=excluded.total_in,total_out=excluded.total_out")
        .bind(day).bind(&brand).bind(stock).bind(physical).bind(physical-stock).bind(count.note).bind(user).bind(&brand).bind(day).bind(day).execute(&mut *tx).await.map_err(err)?;
    tx.commit().await.map_err(err)?;
    Ok(true)
}
#[tauri::command]
pub async fn save_count_today(db: State<'_, Database>, input: Count) -> Result<bool> {
    let (_guard, user) = db.authenticated().await?;
    save_count(
        &db.pool,
        user,
        input,
        &chrono::Local::now().format("%Y-%m-%d").to_string(),
    )
    .await
}
#[tauri::command]
pub async fn delete_count(db: State<'_, Database>, id: i64) -> Result<bool> {
    let (_guard, _) = db.authenticated().await?;
    Ok(sqlx::query("DELETE FROM global_opname WHERE id=?")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(err)?
        .rows_affected()
        == 1)
}
#[tauri::command]
pub async fn inventory_write(
    db: State<'_, Database>,
    action: String,
    input: crate::inventory::Input,
) -> Result<Value> {
    let (_guard, user) = db.authenticated().await?;
    let mut c = db.pool.acquire().await.map_err(err)?;
    let id = crate::inventory::write(&mut c, user, &action, &input).await?;
    drop(c);
    if matches!(action.as_str(), "create_product" | "update_product") {
        return read(
            &db.pool,
            "product",
            &Filter {
                id: Some(id),
                ..Default::default()
            },
        )
        .await?
        .pop()
        .ok_or("Produk tidak ditemukan.".into());
    }
    Ok(json!(true))
}
