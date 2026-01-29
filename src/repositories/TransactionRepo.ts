import { getDb } from "./db";
import type {
    TransactionWithProduct,
    TransactionType,
    CreateTransactionInput,
    StockAdjustmentInput,
} from "../types/database";

export const TransactionRepo = {
    /**
     * Get transaction history with optional filters
     */
    async getTransactionHistory(
        productId?: number,
        userId?: number,
        type?: TransactionType
    ): Promise<TransactionWithProduct[]> {
        const db = await getDb();

        let query = `
            SELECT t.*, p.name as product_name, u.username 
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE 1=1
        `;
        const params: (string | number)[] = [];

        if (productId) {
            query += " AND t.product_id = ?";
            params.push(productId);
        }

        if (userId) {
            query += " AND t.user_id = ?";
            params.push(userId);
        }

        if (type) {
            query += " AND t.type = ?";
            params.push(type);
        }

        query += " ORDER BY t.created_at DESC LIMIT 100";

        return db.select<TransactionWithProduct[]>(query, params);
    },

    /**
     * Get total transaction count
     */
    async getTransactionCount(): Promise<number> {
        const db = await getDb();
        const result = await db.select<{ count: number }[]>(
            "SELECT COUNT(*) as count FROM transactions"
        );
        return result[0].count;
    },

    /**
     * Get recent transactions
     */
    async getRecentTransactions(limit: number = 10): Promise<TransactionWithProduct[]> {
        const db = await getDb();
        return db.select<TransactionWithProduct[]>(
            `SELECT t.*, p.name as product_name, u.username 
             FROM transactions t
             LEFT JOIN products p ON t.product_id = p.id
             LEFT JOIN users u ON t.user_id = u.id
             ORDER BY t.created_at DESC 
             LIMIT ?`,
            [limit]
        );
    },

    /**
     * Create a new transaction
     * Also updates product stock automatically
     */
    async createTransaction(input: CreateTransactionInput): Promise<boolean> {
        const db = await getDb();

        // 1. Get current stock
        const products = await db.select<{ stock: number }[]>(
            "SELECT stock FROM products WHERE id = ?",
            [input.product_id]
        );

        if (products.length === 0) return false;
        const currentStock = products[0].stock;

        // 2. Calculate new stock
        let newStock = currentStock;
        if (input.type === 'IN') {
            newStock += input.qty;
        } else if (input.type === 'OUT') {
            newStock -= input.qty;
        }

        // 3. Update stock
        await db.execute(
            "UPDATE products SET stock = ? WHERE id = ?",
            [newStock, input.product_id]
        );

        // 4. Create transaction record
        await db.execute(
            `INSERT INTO transactions (product_id, user_id, type, qty, current_stock_snapshot, note)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                input.product_id,
                input.user_id,
                input.type,
                input.qty,
                newStock, // Snapshot of stock AFTER transaction
                input.note || null
            ]
        );

        return true;
    },

    /**
     * Adjust stock (Stock Opname)
     * Automatically calculates difference and creates transaction
     */
    async adjustStock(input: StockAdjustmentInput): Promise<boolean> {
        const db = await getDb();

        // 1. Get current stock
        const products = await db.select<{ stock: number }[]>(
            "SELECT stock FROM products WHERE id = ?",
            [input.product_id]
        );

        if (products.length === 0) return false;
        const currentStock = products[0].stock;

        // 2. Calculate difference
        const diff = input.physical_count - currentStock;

        if (diff === 0) {
            // No change needed, but maybe log a check? 
            // For now, let's create a transaction with 0 qty just to record the check
            await db.execute(
                `INSERT INTO transactions (product_id, user_id, type, qty, current_stock_snapshot, note)
                 VALUES (?, ?, 'ADJUSTMENT', 0, ?, ?)`,
                [
                    input.product_id,
                    input.user_id,
                    input.physical_count,
                    input.note || "Stock Opname: Match"
                ]
            );
            return true;
        }

        // 3. Update stock
        await db.execute(
            "UPDATE products SET stock = ? WHERE id = ?",
            [input.physical_count, input.product_id]
        );

        // 4. Create transaction record
        await db.execute(
            `INSERT INTO transactions (product_id, user_id, type, qty, current_stock_snapshot, note)
             VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?)`,
            [
                input.product_id,
                input.user_id,
                Math.abs(diff),
                input.physical_count,
                input.note ? `Stock Opname: ${input.note}` : `Stock Opname: ${diff > 0 ? 'Excess' : 'Loss'} (${diff})`
            ]
        );

        return true;
    },

    /**
     * Get transactions by date range
     */
    async getTransactionsByDateRange(startDate: string, endDate: string): Promise<TransactionWithProduct[]> {
        const db = await getDb();
        return db.select<TransactionWithProduct[]>(
            `SELECT t.*, p.name as product_name, u.username 
             FROM transactions t
             LEFT JOIN products p ON t.product_id = p.id
             LEFT JOIN users u ON t.user_id = u.id
             WHERE DATE(t.created_at) BETWEEN ? AND ?
             ORDER BY t.created_at DESC`,
            [startDate, endDate]
        );
    }
};
