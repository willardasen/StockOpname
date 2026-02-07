import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

let dbInstance: Database | null = null;

// SQL Schema for database initialization
const SCHEMA = `
-- Config
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Users (simplified - no roles)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products (No prices)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT,
    brand_type TEXT,
    type_number TEXT,
    color TEXT,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for Text Search Performance
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
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
    brand TEXT,
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
const DEFAULT_PASSWORD = 'admin123';

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
        let hashedPassword = DEFAULT_PASSWORD;

        // Only attempt to hash if we are in a Tauri environment
        const isTauri = typeof window !== 'undefined' && (
            !!(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ ||
            !!(window as unknown as { __TAURI__: unknown }).__TAURI__
        );

        if (isTauri) {
            try {
                // Hash password using Rust backend
                hashedPassword = await invoke<string>('hash_password', {
                    password: DEFAULT_PASSWORD
                });
            } catch (e) {
                console.error("Failed to hash password via Tauri invoke:", e);
                throw new Error(`Tauri invoke failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        } else {
            console.warn("Running outside Tauri. Using plaintext password (unsecure) for dev/testing.");
        }

        // Insert default admin user if not exists
        await db.execute(
            "INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)",
            ['admin', hashedPassword]
        );

        console.log('Default admin user created');
    }

    // AUTO-FIX: Check if admin password is still plaintext 'admin123' (caused by previous bug)
    const adminUser = await db.select<{ id: number, password: string }[]>(
        "SELECT id, password FROM users WHERE username = 'admin'"
    );

    if (adminUser.length > 0 && adminUser[0].password === DEFAULT_PASSWORD) {
        console.warn('Detected plaintext admin password. fixing...');

        const isTauri = typeof window !== 'undefined' && (
            !!(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ ||
            !!(window as unknown as { __TAURI__: unknown }).__TAURI__
        );

        if (isTauri) {
            try {
                const hashedPassword = await invoke<string>('hash_password', {
                    password: DEFAULT_PASSWORD
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

    // AUTO-MIGRATION: Add missing columns to existing tables

    // 1. Migrate brand_types (add brand_id)
    try {
        await db.execute("ALTER TABLE brand_types ADD COLUMN brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE");
    } catch (e: unknown) {
        const msg = String(e).toLowerCase();
        if (!msg.includes("duplicate column") && !msg.includes("exists")) {
            console.error("Migration brand_types failed:", e);
        }
    }

    // 2. Migrate type_numbers (add brand_id)
    try {
        await db.execute("ALTER TABLE type_numbers ADD COLUMN brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE");
    } catch (e: unknown) {
        const msg = String(e).toLowerCase();
        if (!msg.includes("duplicate column") && !msg.includes("exists")) {
            console.error("Migration type_numbers failed:", e);
        }
    }

    // 3. Migrate brands (add pcs_per_box)
    try {
        await db.execute("ALTER TABLE brands ADD COLUMN pcs_per_box INTEGER DEFAULT 10");
    } catch (e: unknown) {
        const msg = String(e).toLowerCase();
        if (!msg.includes("duplicate column") && !msg.includes("exists")) {
            console.error("Migration brands failed:", e);
        }
    }

    // 4. Migrate global_opname (add brand column)
    try {
        await db.execute("ALTER TABLE global_opname ADD COLUMN brand TEXT");
    } catch (e: unknown) {
        const msg = String(e).toLowerCase();
        if (!msg.includes("duplicate column") && !msg.includes("exists")) {
            console.error("Migration global_opname failed:", e);
        }
    }
};

export const closeDb = async (): Promise<void> => {
    if (dbInstance) {
        await dbInstance.close();
        dbInstance = null;
    }
};