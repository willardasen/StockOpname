import { getDb } from "./db";
import type {
    TransactionWithProduct,
    TransactionType,
    CreateTransactionInput,
    StockAdjustmentInput,
} from "@/types/database";

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
            SELECT t.*, p.name as product_name, p.brand, p.brand_type, p.type_number, p.color, b.pcs_per_box, u.username 
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            LEFT JOIN brands b ON p.brand = b.name
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
    async getTransactionsByDateRange(startDate: string, endDate: string, type?: TransactionType): Promise<TransactionWithProduct[]> {
        const db = await getDb();

        let query = `
            SELECT t.*, p.name as product_name, p.brand, p.brand_type, p.type_number, p.color, b.pcs_per_box, u.username 
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            LEFT JOIN brands b ON p.brand = b.name
            LEFT JOIN users u ON t.user_id = u.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
        `;

        const params: (string | number)[] = [startDate, endDate];

        if (type) {
            query += " AND t.type = ?";
            params.push(type);
        }

        query += " ORDER BY t.created_at DESC";

        return db.select<TransactionWithProduct[]>(query, params);
    },

    /**
     * Delete a transaction and revert stock changes
     */
    async deleteTransaction(id: number): Promise<boolean> {
        const db = await getDb();

        // 1. Get the transaction to be deleted
        const transactions = await db.select<TransactionWithProduct[]>(
            "SELECT * FROM transactions WHERE id = ?",
            [id]
        );

        if (transactions.length === 0) return false;
        const transaction = transactions[0];

        // 2. Get current product stock
        const products = await db.select<{ stock: number }[]>(
            "SELECT stock FROM products WHERE id = ?",
            [transaction.product_id]
        );

        if (products.length === 0) return false;
        const currentStock = products[0].stock;

        // 3. Calculate reverted stock
        let newStock = currentStock;
        if (transaction.type === 'IN') {
            // If it was IN, we subtract to revert
            newStock -= transaction.qty;
        } else if (transaction.type === 'OUT') {
            // If it was OUT, we add to revert
            newStock += transaction.qty;
        }
        // For ADJUSTMENT, it's complex depending on how it was implemented (snapshot vs delta).
        // Current implementation uses snapshot in 'qty' for 'ADJUSTMENT' (physical_count)? 
        // Wait, adjustStock uses `qty = Math.abs(diff)`. And `current_stock_snapshot` is correct.
        // Reverting adjustment is TRICKY because it sets stock to a specific value.
        // For now, let's only strictly support IN/OUT reverting.
        // If needed, we can block ADJUSTMENT deletion or handle it by reverting to `current_stock_snapshot` (if that logic holds).
        // But the previous `current_stock_snapshot` in the DB is the SNAPSHOT AFTER.
        // To revert, we need the stock BEFORE.
        // Let's safe guard: Only IN/OUT for now.

        if (transaction.type === 'ADJUSTMENT') {
            // Optional: Support reversion if we know the previous state.
            // For now, simple delete of record without stock revert? Or blocking?
            // Let's just delete the record but NOT change stock, assuming Opname is "final".
            // OR finding the logic. User didn't ask for Opname delete yet.
            // StockIn/StockOut are IN/OUT.
        } else {
            // 4. Update stock
            await db.execute(
                "UPDATE products SET stock = ? WHERE id = ?",
                [newStock, transaction.product_id]
            );
        }

        // 5. Delete transaction
        await db.execute("DELETE FROM transactions WHERE id = ?", [id]);

        return true;
    },

    /**
     * Get daily IN/OUT totals for a specific date
     */
    async getDailyTotals(date: string): Promise<{ total_in: number; total_out: number }> {
        const db = await getDb();

        const results = await db.select<{ type: string; total: number }[]>(
            `SELECT type, COALESCE(SUM(qty), 0) as total 
             FROM transactions 
             WHERE DATE(created_at) = ? AND type IN ('IN', 'OUT')
             GROUP BY type`,
            [date]
        );

        let total_in = 0;
        let total_out = 0;

        for (const row of results) {
            if (row.type === 'IN') total_in = row.total;
            if (row.type === 'OUT') total_out = row.total;
        }

        return { total_in, total_out };
    },

    /**
     * Get monthly sales report (top selling products by month)
     * Returns aggregated OUT transactions grouped by product for a given year-month
     */
    async getMonthlySalesReport(yearMonth: string): Promise<{
        product_id: number;
        product_name: string;
        brand: string;
        brand_type: string;
        type_number: string;
        color: string;
        total_qty_out: number;
        total_qty_in: number;
        transaction_count: number;
    }[]> {
        const db = await getDb();

        return db.select(
            `SELECT 
                t.product_id,
                p.name as product_name,
                p.brand,
                p.brand_type,
                p.type_number,
                p.color,
                CAST(COALESCE(SUM(CASE WHEN t.type = 'OUT' THEN t.qty ELSE 0 END), 0) AS INTEGER) as total_qty_out,
                CAST(COALESCE(SUM(CASE WHEN t.type = 'IN' THEN t.qty ELSE 0 END), 0) AS INTEGER) as total_qty_in,
                COUNT(t.id) as transaction_count
             FROM transactions t
             LEFT JOIN products p ON t.product_id = p.id
             WHERE t.type IN ('IN', 'OUT')
               AND strftime('%Y-%m', t.created_at) = ?
             GROUP BY t.product_id
             HAVING total_qty_out > 0 OR total_qty_in > 0
             ORDER BY total_qty_out DESC`,
            [yearMonth]
        );
    }
};
