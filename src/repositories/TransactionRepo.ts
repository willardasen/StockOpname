import { readData, writeInventory, type Filter } from './db';
import type { TransactionWithProduct, TransactionType, CreateTransactionInput, UpdateTransactionInput, StockAdjustmentInput } from '@/types/database';

export interface SalesRow {
  product_id: number; product_name: string; brand: string; brand_type: string; type_number: string; color: string;
  calculation_type: 'BOX' | 'SIZE'; total_qty_in: number; total_qty_out: number; transaction_count: number;
}
export const TransactionRepo = {
  list: (filter: Filter) => readData<TransactionWithProduct>('history', filter),
  getTransactionHistory: (product_id?: number, user_id?: number, kind?: TransactionType) =>
    readData<TransactionWithProduct>('history', { product_id, user_id, kind }),
  async getTransactionCount() { return (await readData<{count: number}>('tx_count'))[0].count; },
  getRecentTransactions: (limit = 10) => readData<TransactionWithProduct>('history', { limit }),
  getTransactionsByDateRange: (start: string, end: string, kind?: TransactionType) =>
    readData<TransactionWithProduct>('history', { start, end, kind }),
  createTransaction: (input: CreateTransactionInput) => writeInventory<boolean>('create_transaction', input),
  updateTransaction: (input: UpdateTransactionInput) => writeInventory<boolean>('update_transaction', input),
  deleteTransaction: (id: number) => writeInventory<boolean>('delete_transaction', { id }),
  adjustStock: (input: StockAdjustmentInput) => writeInventory<boolean>('adjust_stock', input),
  getMonthlySalesReport: (month: string) => readData<SalesRow>('sales', { month }),
};
