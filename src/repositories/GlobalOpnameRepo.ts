import { getDb } from "./db";

export interface GlobalOpnameRecord {
    id: number;
    date: string;
    system_stock: number;
    physical_stock: number;
    difference: number;
    total_in: number;
    total_out: number;
    note?: string;
    user_id?: number;
    created_at: string;
}

export interface CreateGlobalOpnameInput {
    date: string;
    system_stock: number;
    physical_stock: number;
    difference: number;
    total_in: number;
    total_out: number;
    note?: string;
    user_id?: number;
}

export const GlobalOpnameRepo = {
    /**
     * Save or update today's global opname record
     */
    async saveRecord(input: CreateGlobalOpnameInput): Promise<boolean> {
        const db = await getDb();

        // Use INSERT OR REPLACE to update if date exists
        await db.execute(
            `INSERT OR REPLACE INTO global_opname 
             (date, system_stock, physical_stock, difference, total_in, total_out, note, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                input.date,
                input.system_stock,
                input.physical_stock,
                input.difference,
                input.total_in,
                input.total_out,
                input.note || null,
                input.user_id || null
            ]
        );

        return true;
    },

    /**
     * Get all records, optionally filtered by date range
     */
    async getRecords(startDate?: string, endDate?: string): Promise<GlobalOpnameRecord[]> {
        const db = await getDb();

        if (startDate && endDate) {
            return db.select<GlobalOpnameRecord[]>(
                `SELECT * FROM global_opname 
                 WHERE date BETWEEN ? AND ? 
                 ORDER BY date DESC`,
                [startDate, endDate]
            );
        }

        return db.select<GlobalOpnameRecord[]>(
            `SELECT * FROM global_opname ORDER BY date DESC LIMIT 50`
        );
    },

    /**
     * Get a specific day's record
     */
    async getRecordByDate(date: string): Promise<GlobalOpnameRecord | null> {
        const db = await getDb();
        const records = await db.select<GlobalOpnameRecord[]>(
            `SELECT * FROM global_opname WHERE date = ?`,
            [date]
        );
        return records.length > 0 ? records[0] : null;
    },

    /**
     * Delete a record
     */
    async deleteRecord(id: number): Promise<boolean> {
        const db = await getDb();
        const result = await db.execute(
            `DELETE FROM global_opname WHERE id = ?`,
            [id]
        );
        return result.rowsAffected > 0;
    }
};
