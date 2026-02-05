import { create } from 'zustand';
import { TransactionRepo } from '@/repositories';
import type {
    TransactionWithProduct,
    CreateTransactionInput,
    StockAdjustmentInput,
    TransactionType
} from '@/types/database';

interface TransactionState {
    transactions: TransactionWithProduct[];
    recentTransactions: TransactionWithProduct[];
    totalCount: number;
    isLoading: boolean;
    error: string | null;

    // Actions
    loadTransactions: (productId?: number, userId?: number, type?: TransactionType) => Promise<void>;
    loadRecentTransactions: (limit?: number) => Promise<void>;
    createTransaction: (input: CreateTransactionInput) => Promise<boolean>;
    adjustStock: (input: StockAdjustmentInput) => Promise<boolean>;
    getTransactionsByDateRange: (startDate: string, endDate: string) => Promise<TransactionWithProduct[]>;
    clearError: () => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
    transactions: [],
    recentTransactions: [],
    totalCount: 0,
    isLoading: false,
    error: null,

    loadTransactions: async (productId?: number, userId?: number, type?: TransactionType) => {
        set({ isLoading: true, error: null });

        try {
            const transactions = await TransactionRepo.getTransactionHistory(productId, userId, type);
            const totalCount = await TransactionRepo.getTransactionCount();
            set({ transactions, totalCount, isLoading: false });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Gagal memuat transaksi',
                isLoading: false
            });
        }
    },

    loadRecentTransactions: async (limit: number = 10) => {
        try {
            const recentTransactions = await TransactionRepo.getRecentTransactions(limit);
            set({ recentTransactions });
        } catch (error) {
            console.error('Failed to load recent transactions:', error);
        }
    },

    createTransaction: async (input: CreateTransactionInput) => {
        set({ isLoading: true, error: null });

        try {
            await TransactionRepo.createTransaction(input);
            // Reload transactions
            const { loadTransactions } = get();
            await loadTransactions();
            set({ isLoading: false });
            return true;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Gagal membuat transaksi',
                isLoading: false
            });
            return false;
        }
    },

    adjustStock: async (input: StockAdjustmentInput) => {
        set({ isLoading: true, error: null });

        try {
            await TransactionRepo.adjustStock(input);
            set({ isLoading: false });
            return true;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Gagal menyesuaikan stok',
                isLoading: false
            });
            return false;
        }
    },

    getTransactionsByDateRange: async (startDate: string, endDate: string) => {
        set({ isLoading: true, error: null });

        try {
            const transactions = await TransactionRepo.getTransactionsByDateRange(startDate, endDate);
            set({ transactions, isLoading: false });
            return transactions;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Gagal memuat transaksi',
                isLoading: false
            });
            return [];
        }
    },

    clearError: () => {
        set({ error: null });
    }
}));
