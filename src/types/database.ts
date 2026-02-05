// Database model types for Stock Opname application

export type UserRole = 'admin' | 'staff';
export type TransactionType = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface User {
    id: number;
    username: string;
    role: UserRole;
    created_at: string;
}

// User with password hash - only for internal use, never expose to UI
export interface UserWithPassword extends User {
    password: string;
}

export interface Product {
    id: number;
    name: string;
    brand: string | null;
    pcs_per_box?: number;
    brand_type: string | null;
    type_number: string | null;
    color: string | null;
    buy_price: number;
    sell_price: number;
    stock: number;
    min_stock: number;
    is_active: number; // 1 = active, 0 = soft deleted
    created_at: string;
}

// Product view for Staff - excludes sensitive price data
export interface ProductStaffView {
    id: number;
    name: string;
    brand: string | null;
    brand_type: string | null;
    type_number: string | null;
    color: string | null;
    stock: number;
    min_stock: number;
    is_active: number;
    created_at: string;
}

export interface Transaction {
    id: number;
    product_id: number;
    user_id: number;
    type: TransactionType;
    qty: number;
    current_stock_snapshot: number | null;
    note: string | null;
    created_at: string;
}

// Transaction with joined product name for display
export interface TransactionWithProduct extends Transaction {
    product_name: string;
    username: string;
    brand?: string | null;
    brand_type?: string | null;
    type_number?: string | null;
    color?: string | null;
    pcs_per_box?: number;
}

// Form types for creating/updating
export interface CreateProductInput {
    name: string;
    brand?: string;
    brand_type?: string;
    type_number?: string;
    color?: string;
    buy_price?: number;
    sell_price?: number;
    stock?: number;
    min_stock?: number;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
    id: number;
}

export interface CreateTransactionInput {
    product_id: number;
    user_id: number;
    type: TransactionType;
    qty: number;
    note?: string;
}

export interface StockAdjustmentInput {
    product_id: number;
    user_id: number;
    physical_count: number;
    note?: string;
}

export interface Brand {
    id: number;
    name: string;
    pcs_per_box: number;
}

export interface BrandType {
    id: number;
    name: string;
    brand_id?: number | null; // Optional to support legacy data if any, but should be required for new
}

export interface TypeNumber {
    id: number;
    name: string;
    brand_id?: number | null;
}

export interface Color {
    id: number;
    name: string;
}
