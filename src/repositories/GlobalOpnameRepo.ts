import { readData } from './db';
import { invoke } from '@tauri-apps/api/core';

export interface GlobalOpnameRecord {
    id: number;
    date: string;
    brand?: string;
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
    brand: string;
    physical_stock: number;
    system_stock: number;
    note?: string;
}

export const GlobalOpnameRepo = {
  saveRecord: (input: CreateGlobalOpnameInput) => invoke<boolean>('save_count_today', { input }),
  getRecords: (start?: string, end?: string) => readData<GlobalOpnameRecord>('opnames', { start, end }),
  async getRecordByDate(date: string, brand: string) {
    return (await this.getRecords(date, date)).find(row => row.brand === brand) ?? null;
  },
  deleteRecord: (id: number) => invoke<boolean>('delete_count', { id }),
};
