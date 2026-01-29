import { useState } from 'react';
import { useAuthStore, useTransactionStore } from '@/stores';
import type { Product } from '@/types/database';

export function useStockOpname() {
    const { user } = useAuthStore();
    const { adjustStock, isLoading: txLoading, error } = useTransactionStore();

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [physicalCount, setPhysicalCount] = useState<string>('');
    const [note, setNote] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const selectProduct = (product: Product) => {
        setSelectedProduct(product);
        setPhysicalCount('');
        setNote('');
        setSuccessMessage('');
    };

    const submitAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedProduct || !user) return;

        const physical = parseInt(physicalCount, 10);
        if (isNaN(physical) || physical < 0) {
            return;
        }

        const success = await adjustStock({
            product_id: selectedProduct.id,
            user_id: user.id,
            physical_count: physical,
            note: note || undefined,
        });

        if (success) {
            const diff = physical - selectedProduct.stock;
            let message = 'Stok berhasil disesuaikan!';
            if (diff > 0) {
                message = `Stok berhasil disesuaikan! Lebih ${diff}`;
            } else if (diff < 0) {
                message = `Stok berhasil disesuaikan! Kurang ${Math.abs(diff)}`;
            } else {
                message = `Stok berhasil disesuaikan! Selisih: 0`;
            }
            setSuccessMessage(message);
            setSelectedProduct(null);
            setPhysicalCount('');
            setNote('');
        }
    };

    const calculateDifference = () => {
        if (!selectedProduct || physicalCount === '') return null;
        const physical = parseInt(physicalCount, 10);
        if (isNaN(physical)) return null;
        return physical - selectedProduct.stock;
    };

    return {
        selectedProduct,
        physicalCount,
        setPhysicalCount,
        note,
        setNote,
        successMessage,
        txLoading,
        error,
        selectProduct,
        submitAdjustment,
        difference: calculateDifference()
    };
}
