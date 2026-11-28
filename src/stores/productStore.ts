import { create } from 'zustand';
import { ProductRepo } from '@/repositories';
import { trackStockWrite } from '@/repositories/stockWrites';
import type { Product, CreateProductInput, UpdateProductInput } from '@/types/database';

interface ProductState {
    revision: number;
    products: Product[];
    selectedProduct: Product | null;
    lowStockProducts: Product[];
    lowStockCount: number;
    totalCount: number;
    totalStock: number;
    isLoading: boolean;
    error: string | null;
    searchKeyword: string;

    // Actions
    loadProducts: () => Promise<void>;
    searchProducts: (keyword: string) => Promise<void>;
    loadLowStockProducts: () => Promise<void>;
    loadStats: () => Promise<void>;
    createProduct: (input: CreateProductInput) => Promise<Product | null>;
    updateProduct: (input: UpdateProductInput) => Promise<Product | null>;
    deleteProduct: (id: number) => Promise<boolean>;
    setSelectedProduct: (product: Product | null) => void;
    clearError: () => void;
}

export const useProductStore = create<ProductState>((set, get) => ({
    revision: 0,
    products: [],
    selectedProduct: null,
    lowStockProducts: [],
    lowStockCount: 0,
    totalCount: 0,
    totalStock: 0,
    isLoading: false,
    error: null,
    searchKeyword: '',

    loadProducts: async () => {
        set({ isLoading: true, error: null });

        try {
            const { searchKeyword } = get();
            if (searchKeyword.trim() !== '') {
                const products = await ProductRepo.searchProducts(searchKeyword);
                set({ products, isLoading: false });
                return;
            }
            const products = await ProductRepo.getAllProducts();
            const totalCount = await ProductRepo.getProductCount();

            set({ products, totalCount, isLoading: false });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Gagal memuat produk',
                isLoading: false
            });
        }
    },

    searchProducts: async (keyword: string) => {
        set({ isLoading: true, error: null, searchKeyword: keyword });

        try {
            if (keyword.trim() === '') {
                const products = await ProductRepo.getAllProducts();
                set({ products, isLoading: false });
            } else {
                const products = await ProductRepo.searchProducts(keyword);
                set({ products, isLoading: false });
            }
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Gagal mencari produk',
                isLoading: false
            });
        }
    },

    loadLowStockProducts: async () => {
        try {
            const lowStockProducts = await ProductRepo.getLowStockProducts(5);
            set({ lowStockProducts });
        } catch (error) {
            console.error('Failed to load low stock products:', error);
        }
    },

    loadStats: async () => {
        try {
            const stats = await ProductRepo.getStats();
            set({ totalCount: stats.count, totalStock: stats.total, lowStockCount: stats.low_count });
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    },

    createProduct: trackStockWrite(async (input: CreateProductInput) => {
        set({ isLoading: true, error: null });

        try {
            const product = await ProductRepo.createProduct(input);

            const { products } = get();
            set({
                revision: get().revision + 1,
                products: [...products, product],
                isLoading: false
            });
            return product;
        } catch (error) {
            console.error("Failed to create product:", error);
            const errMsg = error instanceof Error ? error.message : String(error);
            alert(`Gagal: ${errMsg}`);
            set({
                error: errMsg,
                isLoading: false
            });
            return null;
        }
    }),

    updateProduct: trackStockWrite(async (input: UpdateProductInput) => {
        set({ isLoading: true, error: null });

        try {
            const updatedProduct = await ProductRepo.updateProduct(input);
            if (updatedProduct) {
                const { products } = get();
                const updatedProducts = products.map(p =>
                    p.id === input.id ? updatedProduct : p
                );
                set({ products: updatedProducts, isLoading: false, revision: get().revision + 1 });
            }
            return updatedProduct;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Gagal mengupdate produk',
                isLoading: false
            });
            return null;
        }
    }),

    deleteProduct: trackStockWrite(async (id: number) => {
        set({ isLoading: true, error: null });

        try {
            const success = await ProductRepo.deleteProduct(id);
            if (success) {
                const { products } = get();
                set({
                    revision: get().revision + 1,
                    products: products.filter(p => p.id !== id),
                    isLoading: false
                });
            }
            return success;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Gagal menghapus produk',
                isLoading: false
            });
            return false;
        }
    }),

    setSelectedProduct: (product: Product | null) => {
        set({ selectedProduct: product });
    },

    clearError: () => {
        set({ error: null });
    }
}));
