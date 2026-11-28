use crate::database::{err, Result, MAX_QTY};
use chrono::{Local, NaiveDate, NaiveDateTime};
use serde::Deserialize;
use sqlx::{Connection, Row, SqliteConnection};

#[derive(Deserialize, Default)]
pub struct Input {
    pub id: Option<i64>,
    pub product_id: Option<i64>,
    pub name: Option<String>,
    pub brand: Option<String>,
    pub brand_type: Option<String>,
    pub type_number: Option<String>,
    pub color: Option<String>,
    pub size: Option<String>,
    pub stock: Option<i64>,
    pub min_stock: Option<i64>,
    pub qty: Option<i64>,
    pub physical_count: Option<i64>,
    pub expected_stock: Option<i64>,
    pub note: Option<String>,
    pub created_at: Option<String>,
    pub transaction_date: Option<String>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
}
pub fn quantity(n: i64) -> Result<i64> {
    if (0..=MAX_QTY).contains(&n) {
        Ok(n)
    } else {
        Err("Jumlah stok tidak valid atau stok tidak mencukupi.".into())
    }
}
fn date(input: Option<&str>, old: Option<&str>) -> Result<String> {
    let now = Local::now().naive_local();
    let stamp = match input {
        None => old
            .map(str::to_owned)
            .unwrap_or_else(|| now.format("%Y-%m-%d %H:%M:%S").to_string()),
        Some(day) if day.len() == 10 => {
            NaiveDate::parse_from_str(day, "%Y-%m-%d").map_err(err)?;
            format!(
                "{} {}",
                day,
                old.and_then(|s| s.get(11..19))
                    .map(str::to_owned)
                    .unwrap_or_else(|| now.format("%H:%M:%S").to_string())
            )
        }
        Some(s) => s.to_owned(),
    };
    NaiveDateTime::parse_from_str(&stamp, "%Y-%m-%d %H:%M:%S").map_err(err)?;
    Ok(stamp)
}
const RECONCILE: &str =
    "Riwayat lama tidak konsisten. Rekonsiliasi produk diperlukan sebelum mengoreksi riwayat.";
async fn base(c: &mut SqliteConnection, p: i64) -> Result<i64> {
    let (stored, stock): (Option<i64>, i64) =
        sqlx::query_as("SELECT ledger_base,stock FROM products WHERE id=?")
            .bind(p)
            .fetch_one(&mut *c)
            .await
            .map_err(err)?;
    if let Some(b) = stored {
        return Ok(b);
    }
    let rows=sqlx::query("SELECT type,qty,current_stock_snapshot FROM transactions WHERE product_id=? ORDER BY created_at,id").bind(p).fetch_all(&mut *c).await.map_err(err)?;
    let opening = match rows.first() {
        None => stock,
        Some(r) => {
            let snapshot = r
                .try_get::<Option<i64>, _>(2)
                .map_err(err)?
                .ok_or(RECONCILE)?;
            let qty: i64 = r.try_get(1).map_err(err)?;
            match r.get::<&str, _>(0) {
                "IN" => snapshot.checked_sub(qty),
                "OUT" => snapshot.checked_add(qty),
                _ => None,
            }
            .ok_or(RECONCILE)?
        }
    };
    let mut balance = quantity(opening)?;
    for row in rows {
        let qty: i64 = row.try_get(1).map_err(err)?;
        let snap = row
            .try_get::<Option<i64>, _>(2)
            .map_err(err)?
            .ok_or(RECONCILE)?;
        balance = match row.get::<&str, _>(0) {
            "IN" => quantity(balance.checked_add(qty).ok_or(RECONCILE)?)?,
            "OUT" => quantity(balance.checked_sub(qty).ok_or(RECONCILE)?)?,
            _ => quantity(snap)?,
        };
        if balance != snap {
            return Err(RECONCILE.into());
        }
    }
    if balance != stock {
        return Err(RECONCILE.into());
    }
    sqlx::query("UPDATE products SET ledger_base=? WHERE id=?")
        .bind(opening)
        .bind(p)
        .execute(c)
        .await
        .map_err(err)?;
    Ok(opening)
}
async fn replay(c: &mut SqliteConnection, p: i64, mut balance: i64) -> Result<()> {
    let rows=sqlx::query("SELECT id,type,qty,physical_count,current_stock_snapshot FROM transactions WHERE product_id=? ORDER BY created_at,id").bind(p).fetch_all(&mut *c).await.map_err(err)?;
    for r in rows {
        let id: i64 = r.get(0);
        let qty: i64 = r.try_get(2).map_err(err)?;
        let kind: &str = r.get(1);
        let next = match kind {
            "IN" => quantity(balance.checked_add(qty).ok_or(RECONCILE)?)?,
            "OUT" => quantity(balance.checked_sub(qty).ok_or(RECONCILE)?)?,
            _ => quantity(r.get::<Option<i64>, _>(3).or(r.get(4)).ok_or(RECONCILE)?)?,
        };
        if kind == "ADJUSTMENT" {
            let delta = next - balance;
            sqlx::query("UPDATE transactions SET qty=?,current_stock_snapshot=?,signed_delta=CASE WHEN physical_count IS NOT NULL THEN ? ELSE signed_delta END WHERE id=?")
                .bind(delta.abs()).bind(next).bind(delta).bind(id).execute(&mut *c).await.map_err(err)?;
        } else if r.get::<Option<i64>, _>(4) != Some(next) {
            sqlx::query("UPDATE transactions SET current_stock_snapshot=? WHERE id=?")
                .bind(next)
                .bind(id)
                .execute(&mut *c)
                .await
                .map_err(err)?;
        }
        balance = next;
    }
    set_stock(c, p, balance).await
}
async fn set_stock(c: &mut SqliteConnection, p: i64, n: i64) -> Result<()> {
    sqlx::query("UPDATE products SET stock=? WHERE id=?")
        .bind(n)
        .bind(p)
        .execute(c)
        .await
        .map_err(err)?;
    Ok(())
}
async fn movement(
    c: &mut SqliteConnection,
    p: i64,
    user: i64,
    input: &Input,
    opening: bool,
    kind: &str,
) -> Result<()> {
    let (stock,brand,unit,ratio):(i64,Option<String>,String,i64)=sqlx::query_as("SELECT p.stock,p.brand,COALESCE(b.calculation_type,'BOX'),COALESCE(b.pcs_per_box,10)
        FROM products p LEFT JOIN brands b ON lower(trim(b.name))=lower(trim(p.brand)) WHERE p.id=? AND p.is_active=1").bind(p).fetch_one(&mut *c).await.map_err(err)?;
    quantity(stock)?;
    if input.expected_stock.is_some_and(|s| s != stock) {
        return Err(
            "Stok berubah selama penghitungan. Muat ulang dan periksa jumlah fisik.".into(),
        );
    }
    let stamp = date(
        input
            .created_at
            .as_deref()
            .or(input.transaction_date.as_deref()),
        None,
    )?;
    let latest: Option<String> =
        sqlx::query_scalar("SELECT MAX(created_at) FROM transactions WHERE product_id=?")
            .bind(p)
            .fetch_one(&mut *c)
            .await
            .map_err(err)?;
    let retro = latest.as_ref().is_some_and(|t| t > &stamp);
    let starting = if retro || latest.is_none() {
        Some(base(c, p).await?)
    } else {
        None
    };
    let (qty, physical, delta) = if kind == "ADJUSTMENT" {
        let n = quantity(input.physical_count.ok_or("Jumlah fisik diperlukan.")?)?;
        ((n - stock).abs(), Some(n), Some(n - stock))
    } else {
        if !matches!(kind, "IN" | "OUT") {
            return Err("Jenis transaksi tidak valid.".into());
        }
        let n =
            quantity(if opening { input.stock } else { input.qty }.ok_or("Jumlah diperlukan.")?)?;
        if n == 0 {
            return Err("Jumlah harus positif.".into());
        }
        (n, None, None)
    };
    let new_stock = if retro {
        stock
    } else {
        quantity(match kind {
            "IN" => stock + qty,
            "OUT" => stock - qty,
            _ => physical.ok_or(RECONCILE)?,
        })?
    };
    sqlx::query("INSERT INTO transactions(product_id,user_id,type,qty,current_stock_snapshot,note,created_at,physical_count,signed_delta,brand_at_entry,calculation_type,pcs_per_box,is_opening)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(p).bind(user).bind(kind).bind(qty).bind(new_stock).bind(input.note.as_deref().or(if opening{Some("Stok Awal")}else{None})).bind(stamp).bind(physical).bind(delta).bind(brand).bind(unit).bind(ratio).bind(opening).execute(&mut *c).await.map_err(err)?;
    if retro {
        replay(c, p, starting.ok_or(RECONCILE)?).await
    } else {
        set_stock(c, p, new_stock).await
    }
}
async fn correct(c: &mut SqliteConnection, input: &Input, delete: bool) -> Result<i64> {
    let id = input.id.ok_or("ID transaksi diperlukan.")?;
    let (p, kind, stamp, physical): (i64, String, String, Option<i64>) = sqlx::query_as(
        "SELECT product_id,type,created_at,physical_count FROM transactions WHERE id=?",
    )
    .bind(id)
    .fetch_one(&mut *c)
    .await
    .map_err(err)?;
    if kind == "ADJUSTMENT" && !delete {
        return Err("Adjustment tidak dapat diedit.".into());
    }
    if delete && kind == "ADJUSTMENT" && physical.is_none() {
        sqlx::query("DELETE FROM transactions WHERE id=?")
            .bind(id)
            .execute(&mut *c)
            .await
            .map_err(err)?;
        sqlx::query("UPDATE products SET ledger_base=NULL WHERE id=?")
            .bind(p)
            .execute(c)
            .await
            .map_err(err)?;
        return Ok(p);
    }
    let starting = base(c, p).await?;
    if delete {
        sqlx::query("DELETE FROM transactions WHERE id=?")
            .bind(id)
            .execute(&mut *c)
            .await
            .map_err(err)?;
    } else {
        if let Some(q) = input.qty {
            if quantity(q)? == 0 {
                return Err("Jumlah harus positif.".into());
            }
        }
        sqlx::query("UPDATE transactions SET qty=COALESCE(?,qty),note=COALESCE(?,note),created_at=? WHERE id=?").bind(input.qty).bind(&input.note).bind(date(input.created_at.as_deref(),Some(&stamp))?).bind(id).execute(&mut *c).await.map_err(err)?;
    }
    replay(c, p, starting).await?;
    Ok(p)
}
async fn product(c: &mut SqliteConnection, user: i64, input: &Input, create: bool) -> Result<i64> {
    let id = input.id.unwrap_or(-1);
    if let Some(name) = &input.name {
        if name.trim().is_empty() {
            return Err("Nama produk diperlukan.".into());
        }
        let duplicate:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM products WHERE is_active=1 AND lower(trim(name))=lower(trim(?)) AND id<>?)").bind(name).bind(if create{-1}else{id}).fetch_one(&mut *c).await.map_err(err)?;
        if duplicate {
            return Err("Varian produk sudah terdaftar.".into());
        }
    }
    if let Some(n) = input.min_stock {
        quantity(n)?;
    }
    if create {
        quantity(input.stock.unwrap_or(0))?;
        let id=sqlx::query("INSERT INTO products(name,brand,brand_type,type_number,color,size,stock,min_stock,created_at,ledger_base) VALUES(?,?,?,?,?,?,0,?,?,0)")
            .bind(input.name.as_deref().ok_or("Nama produk diperlukan.")?.trim()).bind(&input.brand).bind(&input.brand_type).bind(&input.type_number).bind(&input.color).bind(&input.size).bind(input.min_stock.unwrap_or(5)).bind(date(input.transaction_date.as_deref(),None)?).execute(&mut *c).await.map_err(err)?.last_insert_rowid();
        if input.stock.unwrap_or(0) > 0 {
            movement(c, id, user, input, true, "IN").await?
        }
        return Ok(id);
    }
    if input.stock.is_some() {
        return Err("Ubah stok melalui transaksi.".into());
    }
    let result=sqlx::query("UPDATE products SET name=COALESCE(?,name),brand=COALESCE(?,brand),brand_type=COALESCE(?,brand_type),type_number=COALESCE(?,type_number),color=COALESCE(?,color),size=COALESCE(?,size),min_stock=COALESCE(?,min_stock) WHERE id=? AND is_active=1")
        .bind(&input.name).bind(&input.brand).bind(&input.brand_type).bind(&input.type_number).bind(&input.color).bind(&input.size).bind(input.min_stock).bind(id).execute(&mut *c).await.map_err(err)?;
    if result.rows_affected() != 1 {
        return Err("Produk tidak ditemukan.".into());
    }
    if input.transaction_date.is_some() || input.note.is_some() {
        let opening: Option<(i64, String)> = sqlx::query_as(
            "SELECT id,created_at FROM transactions WHERE product_id=? AND is_opening=1",
        )
        .bind(id)
        .fetch_optional(&mut *c)
        .await
        .map_err(err)?;
        if let Some((tx, old)) = opening {
            let stamp = date(input.transaction_date.as_deref(), Some(&old))?;
            if old != stamp || input.note.is_some() {
                correct(
                    c,
                    &Input {
                        id: Some(tx),
                        created_at: Some(stamp.clone()),
                        note: input.note.clone(),
                        ..Default::default()
                    },
                    false,
                )
                .await?;
            }
            sqlx::query("UPDATE products SET created_at=? WHERE id=?")
                .bind(stamp)
                .bind(id)
                .execute(&mut *c)
                .await
                .map_err(err)?;
        }
    }
    Ok(id)
}

pub async fn write(
    c: &mut SqliteConnection,
    user: i64,
    action: &str,
    input: &Input,
) -> Result<i64> {
    let mut tx = c.begin_with("BEGIN IMMEDIATE").await.map_err(err)?;
    let p = match action {
        "create_product" | "update_product" => {
            product(&mut tx, user, input, action == "create_product").await?
        }
        "delete_product" => {
            let id = input.id.ok_or("ID produk diperlukan.")?;
            sqlx::query("UPDATE products SET is_active=0 WHERE id=? AND is_active=1")
                .bind(id)
                .execute(&mut *tx)
                .await
                .map_err(err)?;
            id
        }
        "create_transaction" | "adjust_stock" => {
            let p = input.product_id.ok_or("ID produk diperlukan.")?;
            let kind = if action == "adjust_stock" {
                "ADJUSTMENT"
            } else {
                input
                    .kind
                    .as_deref()
                    .filter(|s| matches!(*s, "IN" | "OUT"))
                    .ok_or("Jenis transaksi tidak valid.")?
            };
            movement(&mut tx, p, user, input, false, kind).await?;
            p
        }
        "update_transaction" | "delete_transaction" => {
            correct(&mut tx, input, action == "delete_transaction").await?
        }
        _ => return Err("Operasi tidak dikenal.".into()),
    };
    tx.commit().await.map_err(err)?;
    Ok(p)
}
