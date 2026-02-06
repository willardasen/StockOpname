import { useState, useMemo } from 'react';
import { useAuthStore, useTransactionStore } from '@/stores';
import type { Product } from '@/types/database';

export function useStockOpname() {
    const { user } = useAuthStore();
    const { adjustStock, isLoading: txLoading, error } = useTransactionStore();

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [physicalBox, setPhysicalBox] = useState<number>(0);
    const [physicalPcs, setPhysicalPcs] = useState<number>(0);
    const [note, setNote] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Get pcs_per_box from selected product (fallback to 10)
    const pcsPerBox = useMemo(() => {
        return selectedProduct?.pcs_per_box || 10;
    }, [selectedProduct]);

    // Calculate total physical count
    const physicalCount = useMemo(() => {
        return (physicalBox * pcsPerBox) + physicalPcs;
    }, [physicalBox, physicalPcs, pcsPerBox]);

    const selectProduct = (product: Product) => {
        setSelectedProduct(product);
        setPhysicalBox(0);
        setPhysicalPcs(0);
        setNote('');
        setSuccessMessage('');
    };

    const submitAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedProduct || !user) return;

        if (physicalCount < 0) {
            return;
        }

        const success = await adjustStock({
            product_id: selectedProduct.id,
            user_id: user.id,
            physical_count: physicalCount,
            note: note || undefined,
        });

        if (success) {
            const diff = physicalCount - selectedProduct.stock;
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
            setPhysicalBox(0);
            setPhysicalPcs(0);
            setNote('');
        }
    };

    const calculateDifference = () => {
        if (!selectedProduct) return null;
        if (physicalBox === 0 && physicalPcs === 0) return null;
        return physicalCount - selectedProduct.stock;
    };

    return {
        selectedProduct,
        physicalBox,
        setPhysicalBox,
        physicalPcs,
        setPhysicalPcs,
        physicalCount,
        pcsPerBox,
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
