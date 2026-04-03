import { create } from 'zustand';
import { ProductRepo, TransactionRepo } from '@/repositories';
import type { Product, CreateProductInput, UpdateProductInput } from '@/types/database';
import { useAuthStore } from './authStore';

interface ProductState {
    products: Product[];
    selectedProduct: Product | null;
    lowStockProducts: Product[];
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
    products: [],
    selectedProduct: null,
    lowStockProducts: [],
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

            // Auto-repair: create missing "Stok Awal" transactions for orphaned stock
            let user = useAuthStore.getState().user;
            if (!user) {
                const savedUser = localStorage.getItem('user');
                if (savedUser) user = JSON.parse(savedUser);
            }
            if (user) {
                const repaired = await ProductRepo.repairOrphanedStock(user.id);
                if (repaired > 0) {
                    console.log(`Auto-repaired ${repaired} products with missing stock transactions`);
                }
            }

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
            set({ totalCount, totalStock });
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    },

    createProduct: async (input: CreateProductInput) => {
        set({ isLoading: true, error: null });

        try {
            const initialStock = input.stock || 0;
            const transactionDate = input.transaction_date;
            
            const productInput = { ...input, stock: 0 };
            const product = await ProductRepo.createProduct(productInput);

            if (initialStock > 0) {
                let user = useAuthStore.getState().user;
                if (!user) {
                    // fallback parse from localstorage
                    const savedUser = localStorage.getItem('user');
                    if (savedUser) user = JSON.parse(savedUser);
                }

                if (user) {
                    try {
                        await TransactionRepo.createTransaction({
                            product_id: product.id,
                            user_id: user.id,
                            type: 'IN',
                            qty: initialStock,
                            note: input.note?.trim() || 'Stok Awal',
                            created_at: transactionDate
                        });
                        product.stock = initialStock;
                    } catch (txError) {
                        console.error("Failed to create initial stock transaction:", txError);
                        alert(`Gagal membuat transaksi stok awal. \nProductID: ${product?.id}, UserID: ${user?.id}\nError: ${txError instanceof Error ? txError.message : String(txError)}`);
                    }
                } else {
                    alert("Gagal membuat stok awal: User tidak ditemukan.");
                }
            }

            const { products } = get();
            set({
                products: [...products, product],
                isLoading: false
            });
            return product;
        } catch (error) {
            console.error("Failed to create product:", error);
            const errMsg = error instanceof Error ? error.message : 'Gagal menambah produk';
            alert(`Gagal: ${errMsg}`);
            set({
                error: errMsg,
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
