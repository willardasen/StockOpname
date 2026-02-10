import { useState, useEffect, useCallback } from 'react';
import { PackagePlus, PackageMinus } from 'lucide-react';
import { format } from 'date-fns';
import { useTransactionStore, useAuthStore } from '@/stores';
import { ProductRepo, TransactionRepo } from '@/repositories';
import type { Product, TransactionWithProduct } from '@/types/database';
import { exportToExcel } from '@/utils/excel';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ProductFilter } from '@/components/common';
import { StockTransactionForm } from '@/components/transactions/StockTransactionForm';
import { StockTransactionTable } from '@/components/transactions/StockTransactionTable';

interface StockTransactionPageProps {
    type: 'IN' | 'OUT';
}

export function StockTransactionPage({ type }: StockTransactionPageProps) {
    const { user } = useAuthStore();
    const { createTransaction, isLoading: isSaving } = useTransactionStore();

    // Form state
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [boxQty, setBoxQty] = useState<number>(0);
    const [pcsQty, setPcsQty] = useState<number>(0);
    const [note, setNote] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Table state
    const [recentTransactions, setRecentTransactions] = useState<TransactionWithProduct[]>([]);
    const [tableSearch, setTableSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [tableFilter, setTableFilter] = useState<ProductFilter>({ brand: '', brandType: '', typeNumber: '', color: '' });

    // Confirm Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, message: '', onConfirm: () => { } });

    const showConfirm = useCallback((message: string, onConfirm: () => void) => {
        setConfirmDialog({ isOpen: true, message, onConfirm });
    }, []);

    const closeConfirm = useCallback(() => {
        setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
    }, []);

    // Load recent transactions
    const loadTransactions = useCallback(async (start?: string, end?: string) => {
        try {
            let data;
            if (start && end) {
                data = await TransactionRepo.getTransactionsByDateRange(start, end, type);
            } else {
                data = await TransactionRepo.getTransactionHistory(undefined, undefined, type);
            }
            setRecentTransactions(data);
        } catch (error) {
            console.error("Failed to load transactions", error);
        }
    }, [type]);

    const handleFilter = useCallback(() => {
        if (startDate && endDate) {
            loadTransactions(startDate, endDate);
        }
    }, [startDate, endDate, loadTransactions]);

    const handleResetFilter = useCallback(() => {
        setStartDate('');
        setEndDate('');
        loadTransactions();
    }, [loadTransactions]);

    useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    // Search handler
    const handleSearch = useCallback(async () => {
        if (!searchKeyword.trim()) return;

        setIsSearching(true);
        try {
            const results = await ProductRepo.searchProducts(searchKeyword);
            setSearchResults(results);
            setShowResults(true);
        } finally {
            setIsSearching(false);
        }
    }, [searchKeyword]);

    // Select product
    const handleSelectProduct = useCallback((product: Product) => {
        setSelectedProduct(product);
        setSearchKeyword(product.name);
        setShowResults(false);
        setSearchResults([]);
    }, []);

    // Reset form
    const handleReset = useCallback(() => {
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setSearchKeyword('');
        setSearchResults([]);
        setSelectedProduct(null);
        setBoxQty(0);
        setPcsQty(0);
        setNote('');
        setShowResults(false);
    }, []);

    // Submit handler
    const handleSubmit = useCallback(async () => {
        if (!selectedProduct) {
            alert('Silakan pilih produk terlebih dahulu!');
            return;
        }

        const pcsPerBox = selectedProduct.pcs_per_box || 1;
        const totalQty = (boxQty * pcsPerBox) + pcsQty;

        if (totalQty <= 0) {
            alert(type === 'IN' ? 'Jumlah masuk harus lebih dari 0!' : 'Jumlah keluar harus lebih dari 0!');
            return;
        }
        if (type === 'OUT' && totalQty > selectedProduct.stock) {
            alert(`Stok tidak mencukupi! Stok saat ini: ${selectedProduct.stock}`);
            return;
        }
        const trimmedNote = note.trim();
        if (!trimmedNote) {
            alert('Penanggung Jawab/Catatan tidak boleh kosong!');
            return;
        }
        if (!user) {
            alert('User tidak ditemukan!');
            return;
        }

        const success = await createTransaction({
            product_id: selectedProduct.id,
            user_id: user.id,
            type: type,
            qty: totalQty,
            note: trimmedNote
        });

        if (success) {
            alert(type === 'IN' ? 'Stok masuk berhasil disimpan!' : 'Stok keluar berhasil disimpan!');
            handleReset();
            loadTransactions();
        } else {
            alert(type === 'IN' ? 'Gagal menyimpan stok masuk!' : 'Gagal menyimpan stok keluar!');
        }
    }, [selectedProduct, boxQty, pcsQty, note, user, createTransaction, type, handleReset, loadTransactions]);

    const handleDeleteTransaction = useCallback(async (id: number) => {
        showConfirm('Apakah Anda yakin ingin menghapus transaksi ini? Stok akan dikembalikan.', async () => {
            try {
                const success = await TransactionRepo.deleteTransaction(id);
                if (success) {
                    alert('Transaksi berhasil dihapus.');
                    loadTransactions();
                } else {
                    alert('Gagal menghapus transaksi.');
                }
            } catch (error) {
                console.error("Failed to delete transaction", error);
                alert('Terjadi kesalahan saat menghapus transaksi.');
            }
            closeConfirm();
        });
    }, [showConfirm, loadTransactions, closeConfirm]);

    // Calculate filtered data helper
    const getFilteredData = useCallback(() => {
        return recentTransactions.filter(t => {
            if (tableSearch && !t.product_name.toLowerCase().includes(tableSearch.toLowerCase()) && !(t.id.toString()).includes(tableSearch)) return false;
            if (tableFilter.brand && t.brand !== tableFilter.brand) return false;
            if (tableFilter.brandType && t.brand_type !== tableFilter.brandType) return false;
            if (tableFilter.typeNumber && t.type_number !== tableFilter.typeNumber) return false;
            if (tableFilter.color && t.color !== tableFilter.color) return false;
            return true;
        });
    }, [recentTransactions, tableSearch, tableFilter]);


    const handleExport = useCallback(() => {
        const dataToExport = getFilteredData().map(tx => ({
            'Tanggal': format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm'),
            'Nama Produk': tx.product_name,
            'Brand': tx.brand || '-',
            'Tipe': tx.brand_type || '-',
            'No Tipe': tx.type_number || '-',
            'Warna': tx.color || '-',
            'Jumlah': type === 'IN' ? `+${tx.qty}` : `-${Math.abs(tx.qty)}`,
            'Stok Setelah': tx.current_stock_snapshot,
            'User': tx.username || '-',
            'Catatan': tx.note || '-',
        }));

        exportToExcel(dataToExport, `stok_${type.toLowerCase()}_${format(new Date(), 'yyyyMMdd')}`);
    }, [getFilteredData, type]);

    const isStockIn = type === 'IN';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        {isStockIn ? (
                            <PackagePlus className="h-6 w-6 text-green-600" />
                        ) : (
                            <PackageMinus className="h-6 w-6 text-orange-600" />
                        )}
                        {isStockIn ? 'Stok Masuk' : 'Stok Keluar'}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {isStockIn ? 'Catat barang yang masuk ke gudang' : 'Catat barang yang keluar dari gudang'}
                    </p>
                </div>
            </div>

            <StockTransactionForm
                type={type}
                date={date}
                setDate={setDate}
                searchKeyword={searchKeyword}
                setSearchKeyword={setSearchKeyword}
                searchResults={searchResults}
                showResults={showResults}
                isSearching={isSearching}
                onSearch={handleSearch}
                onSelectProduct={handleSelectProduct}
                selectedProduct={selectedProduct}
                boxQty={boxQty}
                setBoxQty={setBoxQty}
                pcsQty={pcsQty}
                setPcsQty={setPcsQty}
                note={note}
                setNote={setNote}
                onSubmit={handleSubmit}
                onReset={handleReset}
                isSaving={isSaving}
            />

            <StockTransactionTable
                type={type}
                data={getFilteredData()}
                tableSearch={tableSearch}
                setTableSearch={setTableSearch}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                onFilter={handleFilter}
                onResetFilter={handleResetFilter}
                onProductFilterChange={setTableFilter}
                onExport={handleExport}
                onDelete={handleDeleteTransaction}
            />

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={closeConfirm}
            />
        </div>
    );
}
