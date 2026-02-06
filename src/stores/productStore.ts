import { create } from 'zustand';
import { ProductRepo } from '@/repositories';
import type { Product, CreateProductInput, UpdateProductInput } from '@/types/database';

interface ProductState {
    products: Product[];
    selectedProduct: Product | null;
    lowStockProducts: Product[];
    totalCount: number;
    totalStock: number;
    totalAssetValue: number;
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
    products: [],
    selectedProduct: null,
    lowStockProducts: [],
    totalCount: 0,
    totalStock: 0,
    totalAssetValue: 0,
    isLoading: false,
    error: null,
    searchKeyword: '',

    loadProducts: async () => {
        set({ isLoading: true, error: null });

        try {
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
                const products = await ProductRepo.getAllProducts(100);
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
            const lowStockProducts = await ProductRepo.getLowStockProducts();
            set({ lowStockProducts });
        } catch (error) {
            console.error('Failed to load low stock products:', error);
        }
    },

    loadStats: async () => {
        try {
            const totalCount = await ProductRepo.getProductCount();
            const totalStock = await ProductRepo.getTotalStock();
            const totalAssetValue = await ProductRepo.getTotalAssetValue();
            set({ totalCount, totalStock, totalAssetValue });
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    },

    createProduct: async (input: CreateProductInput) => {
        set({ isLoading: true, error: null });

        try {
            const product = await ProductRepo.createProduct(input);
            const { products } = get();
            set({
                products: [...products, product],
                isLoading: false
            });
            return product;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Gagal menambah produk',
                isLoading: false
            });
            return null;
        }
    },

    updateProduct: async (input: UpdateProductInput) => {
        set({ isLoading: true, error: null });

        try {
            const updatedProduct = await ProductRepo.updateProduct(input);
            if (updatedProduct) {
                const { products } = get();
                const updatedProducts = products.map(p =>
                    p.id === input.id ? updatedProduct : p
                );
                set({ products: updatedProducts, isLoading: false });
            }
            return updatedProduct;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Gagal mengupdate produk',
                isLoading: false
            });
            return null;
        }
    },

    deleteProduct: async (id: number) => {
        set({ isLoading: true, error: null });

        try {
            const success = await ProductRepo.deleteProduct(id);
            if (success) {
                const { products } = get();
                set({
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
    },

    setSelectedProduct: (product: Product | null) => {
        set({ selectedProduct: product });
    },

    clearError: () => {
        set({ error: null });
    }
}));
