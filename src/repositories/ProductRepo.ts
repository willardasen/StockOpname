import { getDb } from "./db";
import type { Product, CreateProductInput, UpdateProductInput } from "@/types/database";


const PRODUCT_LIMIT = 5000;

export const ProductRepo = {
    /**
     * Get all active products with optional limit
     */
    async getAllProducts(limit: number = PRODUCT_LIMIT): Promise<Product[]> {
        const db = await getDb();

        const query = `
            SELECT p.*, b.pcs_per_box 
            FROM products p 
            LEFT JOIN brands b ON p.brand = b.name 
            WHERE p.is_active = 1 
            ORDER BY p.name ASC
            LIMIT ?
        `;

        return db.select<Product[]>(query, [limit]);
    },

    /**
     * Search products by name, brand, or type_number
     * Limited to 50 results for performance
     */
    async searchProducts(keyword: string): Promise<Product[]> {
        const db = await getDb();
        const searchTerm = `%${keyword}%`;

        return db.select<Product[]>(
            `SELECT p.*, b.pcs_per_box 
             FROM products p 
             LEFT JOIN brands b ON p.brand = b.name
             WHERE p.is_active = 1 
             AND (p.name LIKE ? OR p.brand LIKE ? OR p.type_number LIKE ? OR p.color LIKE ?)
             ORDER BY p.name ASC
             LIMIT ?`,
            [searchTerm, searchTerm, searchTerm, searchTerm, PRODUCT_LIMIT]
        );
    },

    /**
     * Get single product by ID
     */
    async getProductById(id: number): Promise<Product | null> {
        const db = await getDb();

        const products = await db.select<Product[]>(
            `SELECT p.*, b.pcs_per_box 
             FROM products p 
             LEFT JOIN brands b ON p.brand = b.name
             WHERE p.id = ?`,
            [id]
        );

        return products.length > 0 ? products[0] : null;
    },

    /**
     * Create new product
     */
    async createProduct(input: CreateProductInput): Promise<Product> {
        const db = await getDb();

        const result = await db.execute(
            `INSERT INTO products (name, brand, brand_type, type_number, color, stock, min_stock)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                input.name,
                input.brand || null,
                input.brand_type || null,
                input.type_number || null,
                input.color || null,
                input.stock || 0,
                input.min_stock || 5
            ]
        );

        const products = await db.select<Product[]>(
            "SELECT * FROM products WHERE id = ?",
            [result.lastInsertId]
        );

        return products[0];
    },

    /**
     * Update product
     */
    async updateProduct(input: UpdateProductInput): Promise<Product | null> {
        const db = await getDb();

        // Build dynamic update query
        const updates: string[] = [];
        const values: (string | number | null)[] = [];

        if (input.name !== undefined) {
            updates.push("name = ?");
            values.push(input.name);
        }
        if (input.brand !== undefined) {
            updates.push("brand = ?");
            values.push(input.brand || null);
        }
        if (input.brand_type !== undefined) {
            updates.push("brand_type = ?");
            values.push(input.brand_type || null);
        }
        if (input.type_number !== undefined) {
            updates.push("type_number = ?");
            values.push(input.type_number || null);
        }
        if (input.color !== undefined) {
            updates.push("color = ?");
            values.push(input.color || null);
        }
        if (input.stock !== undefined) {
            updates.push("stock = ?");
            values.push(input.stock);
        }
        if (input.min_stock !== undefined) {
            updates.push("min_stock = ?");
            values.push(input.min_stock);
        }

        if (updates.length > 0) {
            values.push(input.id);
            await db.execute(
                `UPDATE products SET ${updates.join(", ")} WHERE id = ?`,
                values
            );
        }

        // Update the initial "Stok Awal" transaction if date or note is provided
        if (input.transaction_date !== undefined || input.note !== undefined) {
            // Find the Stok Awal transaction (usually the first IN transaction)
            const stokAwalTx = await db.select<{ id: number; created_at: string; note: string }[]>(
                "SELECT id, created_at, note FROM transactions WHERE product_id = ? AND type = 'IN' ORDER BY id ASC LIMIT 1",
                [input.id]
            );

            if (stokAwalTx.length > 0) {
                const txId = stokAwalTx[0].id;
                const txUpdates: string[] = [];
                const txValues: (string | number)[] = [];

                if (input.transaction_date !== undefined) {
                    txUpdates.push("created_at = ?");
                    const timeStr = stokAwalTx[0].created_at.split(' ')[1] || '00:00:00';
                    const datetimeStr = input.transaction_date.includes(':') ? input.transaction_date : `${input.transaction_date} ${timeStr}`;
                    // Update product's created_at to match
                    await db.execute("UPDATE products SET created_at = ? WHERE id = ?", [datetimeStr, input.id]);
                    txValues.push(datetimeStr);
                }
                
                if (input.note !== undefined) {
                    txUpdates.push("note = ?");
                    txValues.push(input.note);
                }

                if (txUpdates.length > 0) {
                    txValues.push(txId);
                    await db.execute(
                        `UPDATE transactions SET ${txUpdates.join(", ")} WHERE id = ?`,
                        txValues
                    );
                }
            }
        }

        return this.getProductById(input.id);
    },

    /**
     * Soft delete product
     * Sets is_active = 0 instead of actual deletion
     */
    async deleteProduct(id: number): Promise<boolean> {
        const db = await getDb();

        const result = await db.execute(
            "UPDATE products SET is_active = 0 WHERE id = ?",
            [id]
        );

        return result.rowsAffected > 0;
    },

    /**
     * Get products with low stock (stock <= min_stock)
     */
    async getLowStockProducts(): Promise<Product[]> {
        const db = await getDb();

        return db.select<Product[]>(
            `SELECT p.*, b.pcs_per_box 
             FROM products p 
             LEFT JOIN brands b ON p.brand = b.name
             WHERE p.is_active = 1 AND p.stock <= p.min_stock 
             ORDER BY (p.min_stock - p.stock) DESC`
        );
    },

    /**
     * Get total product count
     */
    async getProductCount(): Promise<number> {
        const db = await getDb();

        const result = await db.select<{ count: number }[]>(
            "SELECT COUNT(*) as count FROM products WHERE is_active = 1"
        );

        return result[0].count;
    },

    /**
     * Get total stock quantity (Sum of all stocks)
     */
    async getTotalStock(): Promise<number> {
        const db = await getDb();
        const result = await db.select<{ total: number }[]>(
            "SELECT COALESCE(SUM(stock), 0) as total FROM products WHERE is_active = 1"
        );
        return result[0].total;
    },

    /**
     * Update stock directly (used by TransactionRepo)
     */
    async updateStock(id: number, newStock: number): Promise<boolean> {
        const db = await getDb();

        const result = await db.execute(
            "UPDATE products SET stock = ? WHERE id = ?",
            [newStock, id]
        );

        return result.rowsAffected > 0;
    },

    /**
     * Get total stock and pcs_per_box for a specific brand
     */
    async getStockByBrand(brandName: string): Promise<{ totalStock: number; pcsPerBox: number }> {
        const db = await getDb();

        // Get pcs_per_box from brands table
        const brandResult = await db.select<{ pcs_per_box: number }[]>(
            "SELECT pcs_per_box FROM brands WHERE name = ?",
            [brandName]
        );
        const pcsPerBox = brandResult.length > 0 ? (brandResult[0].pcs_per_box || 10) : 10;

        // Get total stock for products of this brand
        const stockResult = await db.select<{ total: number }[]>(
            "SELECT COALESCE(SUM(stock), 0) as total FROM products WHERE is_active = 1 AND brand = ?",
            [brandName]
        );
        const totalStock = stockResult[0].total;

        return { totalStock, pcsPerBox };
    },

    /**
     * Repair orphaned stock: create missing "Stok Awal" IN transactions
     * for products that have stock > 0 but no corresponding IN transaction.
     * Returns the number of products repaired.
     */
    async repairOrphanedStock(userId: number): Promise<number> {
        const db = await getDb();

        const orphanedProducts = await db.select<{ id: number; name: string; stock: number; created_at: string }[]>(
            `SELECT p.id, p.name, p.stock, p.created_at
             FROM products p
             WHERE p.is_active = 1
               AND p.stock > 0
               AND NOT EXISTS (
                   SELECT 1 FROM transactions t
                   WHERE t.product_id = p.id AND t.type = 'IN'
               )`
        );

        if (orphanedProducts.length === 0) return 0;

        for (const product of orphanedProducts) {
            await db.execute(
                `INSERT INTO transactions (product_id, user_id, type, qty, current_stock_snapshot, note, created_at)
                 VALUES (?, ?, 'IN', ?, ?, 'Stok Awal', ?)`,
                [product.id, userId, product.stock, product.stock, product.created_at]
            );
            console.log(`Repaired orphaned stock: "${product.name}" — ${product.stock} pcs`);
        }

        return orphanedProducts.length;
    }
};
