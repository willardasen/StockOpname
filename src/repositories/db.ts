import { invoke } from '@tauri-apps/api/core';
import { runStockReset } from './stockWrites';

export type Filter = {
  id?: number; product_id?: number; user_id?: number; kind?: string; keyword?: string;
  brand?: string; brand_type?: string; type_number?: string; color?: string;
  start?: string; end?: string; month?: string; limit?: number; offset?: number;
};

export const readData = <T>(kind: string, filter: Filter = {}) =>
  invoke<T[]>('read_data', { kind, filter });

export const writeInventory = <T>(action: string, input: object) =>
  invoke<T>('inventory_write', { action, input });

export const resetStock = (_userId: number, password: string) =>
  runStockReset(() => invoke<boolean>('reset_stock', { password }));
