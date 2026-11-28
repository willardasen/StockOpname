import type { Product, CreateProductInput, UpdateProductInput } from '@/types/database';
import { readData, writeInventory, type Filter } from './db';

export const ProductRepo = {
  list: (filter: Filter) => readData<Product>('products', filter),
  getAllProducts: (limit?: number) => readData<Product>('products', { limit }),
  searchProducts: (keyword: string) => readData<Product>('products', { keyword, limit: 100 }),
  async getProductById(id: number) { return (await readData<Product>('product', { id }))[0] ?? null; },
  createProduct: (input: CreateProductInput) => writeInventory<Product>('create_product', input),
  updateProduct: (input: UpdateProductInput) => writeInventory<Product>('update_product', input),
  deleteProduct: (id: number) => writeInventory<boolean>('delete_product', { id }),
  getLowStockProducts: (limit?: number) => readData<Product>('low_stock', { limit }),
  async getStats() { return (await readData<{ count: number; total: number; low_count: number }>('product_stats'))[0]; },
  async getProductCount() { return (await readData<{ count: number }>('product_stats'))[0].count; },
  async getTotalStock() { return (await readData<{ total: number }>('product_stats'))[0].total; },
  async getStockByBrand(brand: string) {
    const [data] = await readData<{ totalStock: number; pcsPerBox: number; calculationType: 'BOX'|'SIZE' }>('brand_stock', { brand });
    if (!data) throw new Error('Merek tidak ditemukan.');
    return data;
  },
};
