import { invoke } from '@tauri-apps/api/core';
import { readData } from './db';
import type { Brand, BrandType, TypeNumber, Color } from '@/types/database';
type Table = 'brands' | 'brand_types' | 'type_numbers' | 'colors';
export const MasterRepo = {
  async list() {
    const [brands, brandTypes, typeNumbers, colors] = await Promise.all([
      readData<Brand>('brands'), readData<BrandType>('brand_types'), readData<TypeNumber>('type_numbers'), readData<Color>('colors'),
    ]);
    return { brands, brandTypes, typeNumbers, colors };
  },
  write: (table: Table, input: object) => invoke<boolean>('master_write', { table, input }),
};
