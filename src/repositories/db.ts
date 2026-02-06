import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

let dbInstance: Database | null = null;

// SQL Schema for database initialization
const SCHEMA = `
-- Config
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'staff')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products (No Barcode)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT,
    brand_type TEXT, 
    type_number TEXT,
    color TEXT,
    buy_price INTEGER DEFAULT 0,
    sell_price INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for Text Search Performance
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- 3. Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    type TEXT CHECK(type IN ('IN', 'OUT', 'ADJUSTMENT')) NOT NULL,
    qty INTEGER NOT NULL,
    current_stock_snapshot INTEGER,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 4. Master Data: Brands
CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    pcs_per_box INTEGER DEFAULT 10
);

-- 5. Master Data: Brand Types
CREATE TABLE IF NOT EXISTS brand_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand_id INTEGER,
    FOREIGN KEY(brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- 6. Master Data: Type Numbers
CREATE TABLE IF NOT EXISTS type_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand_id INTEGER,
    FOREIGN KEY(brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- 7. Master Data: Colors
CREATE TABLE IF NOT EXISTS colors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

-- 8. Global Opname Records (Daily Verification)
CREATE TABLE IF NOT EXISTS global_opname (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    system_stock INTEGER NOT NULL,
    physical_stock INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    total_in INTEGER DEFAULT 0,
    total_out INTEGER DEFAULT 0,
    note TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
`;

// Default admin user seed (password will be hashed)
const DEFAULT_ADMIN_PASSWORD = 'admin123';

export const getDb = async (): Promise<Database> => {
  if (dbInstance) return dbInstance;

  // Load database from app data directory
  dbInstance = await Database.load("sqlite:stock.db");
  return dbInstance;
};

export const initializeDatabase = async (): Promise<void> => {
  const db = await getDb();

  // Execute schema (CREATE TABLE IF NOT EXISTS is safe to run multiple times)
  const statements = SCHEMA.split(';').filter(s => s.trim());
  for (const statement of statements) {
    if (statement.trim()) {
      await db.execute(statement);
    }
  }

  // Check if admin user exists
  const users = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM users WHERE username = 'admin'"
  );

  if (users[0].count === 0) {
    let hashedPassword = DEFAULT_ADMIN_PASSWORD;

    // Only attempt to hash if we are in a Tauri environment
    // Use a loose check for Tauri environment
    const isTauri = typeof window !== 'undefined' && (
      !!(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ ||
      !!(window as unknown as { __TAURI__: unknown }).__TAURI__
    );

    if (isTauri) {
      try {
        // Hash password using Rust backend
        hashedPassword = await invoke<string>('hash_password', {
          password: DEFAULT_ADMIN_PASSWORD
        });
      } catch (e) {
        console.error("Failed to hash password via Tauri invoke:", e);
        // Fallback or rethrow? If hashing fails, authentication won't work matching the hash.
        // But catching it prevents the white screen of death crash at least.
        throw new Error(`Tauri invoke failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      console.warn("Running outside Tauri. Using plaintext password (unsecure) for dev/testing.");
      // Note: verify_password in AuthRepo also uses invoke, so login will fail in browser anyway.
    }

    // Insert default admin user if not exists (handling race condition)
    await db.execute(
      "INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)",
      ['admin', hashedPassword, 'admin']
    );

    console.log('Default admin user check/creation completed');
  }

  // Check if standard 'user' exists (requested by user)
  const standardUsers = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM users WHERE username = 'user'"
  );

  if (standardUsers[0].count === 0) {
    const DEFAULT_USER_PASSWORD = 'password123';
    let hashedPassword = DEFAULT_USER_PASSWORD;

    const isTauri = typeof window !== 'undefined' && (
      !!(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ ||
      !!(window as unknown as { __TAURI__: unknown }).__TAURI__
    );

    if (isTauri) {
      try {
        hashedPassword = await invoke<string>('hash_password', {
          password: DEFAULT_USER_PASSWORD
        });
      } catch (e) {
        console.error("Failed to hash user password:", e);
      }
    }

    await db.execute(
      "INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)",
      ['user', hashedPassword, 'staff']
    );
    console.log("Default 'user' account created with role 'staff'");
  }

  // AUTO-FIX: Check if admin password is still plaintext 'admin123' (caused by previous bug)
  const adminUser = await db.select<{ id: number, password: string }[]>(
    "SELECT id, password FROM users WHERE username = 'admin'"
  );

  if (adminUser.length > 0 && adminUser[0].password === DEFAULT_ADMIN_PASSWORD) {
    console.warn('Detected plaintext admin password. fixing...');

    // Only attempt to hash if we are in a Tauri environment
    const isTauri = typeof window !== 'undefined' && (
      !!(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ ||
      !!(window as unknown as { __TAURI__: unknown }).__TAURI__
    );

    if (isTauri) {
      try {
        const hashedPassword = await invoke<string>('hash_password', {
          password: DEFAULT_ADMIN_PASSWORD
        });

        await db.execute(
          "UPDATE users SET password = ? WHERE id = ?",
          [hashedPassword, adminUser[0].id]
        );
        console.log('Admin password successfully migrated to hash.');
      } catch (e) {
        console.error('Failed to migrate admin password:', e);
      }
    }
  }

  // AUTO-MIGRATION: Check and add brand_id column to brand_types and type_numbers if missing
  // We use a try-catch block for ALTER TABLE as a robust way to add only if missing.

  // 1. Migrate brand_types
  try {
    console.log("Migrating: Attempting to add brand_id to brand_types...");
    await db.execute("ALTER TABLE brand_types ADD COLUMN brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE");
    console.log("Migration: brand_types updated successfully.");
  } catch (e: unknown) {
    // Ignore error if column already exists (Error code for duplicate column or message)
    const msg = String(e).toLowerCase();
    if (msg.includes("duplicate column") || msg.includes("exists")) {
      console.log("Migration: brand_id already exists in brand_types. Skipping.");
    } else {
      console.error("Migration brand_types failed:", e);
    }
  }

  // 2. Migrate type_numbers
  try {
    console.log("Migrating: Attempting to add brand_id to type_numbers...");
    await db.execute("ALTER TABLE type_numbers ADD COLUMN brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE");
    console.log("Migration: type_numbers updated successfully.");
  } catch (e: unknown) {
    const msg = String(e).toLowerCase();
    if (msg.includes("duplicate column") || msg.includes("exists")) {
      console.log("Migration: brand_id already exists in type_numbers. Skipping.");
    } else {
      console.error("Migration type_numbers failed:", e);
    }
  }


  // 3. Migrate brands (Add pcs_per_box)
  try {
    console.log("Migrating: Attempting to add pcs_per_box to brands...");
    await db.execute("ALTER TABLE brands ADD COLUMN pcs_per_box INTEGER DEFAULT 24");
    console.log("Migration: pcs_per_box updated successfully.");
  } catch (e: unknown) {
    const msg = String(e).toLowerCase();
    if (msg.includes("duplicate column") || msg.includes("exists")) {
      console.log("Migration: pcs_per_box already exists in brands. Skipping.");
    } else {
      console.error("Migration brands failed:", e);
    }
  }
};

export const closeDb = async (): Promise<void> => {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
};