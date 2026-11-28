import { totalQuantity } from '@/lib/quantity';
import { usePagedQuery } from '@/hooks/usePagedQuery';
import { useState, useCallback, useRef } from 'react';
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
    const { createTransaction, updateTransaction, isLoading: isSaving } = useTransactionStore();

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
    const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);

    // Table state

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

    const [range, setRange] = useState({ start: '', end: '' });
    const filter = { ...range, kind: type, keyword: tableSearch, brand: tableFilter.brand, brand_type: tableFilter.brandType, type_number: tableFilter.typeNumber, color: tableFilter.color };
    const page = usePagedQuery<TransactionWithProduct>('history', filter, 25);
    const loadTransactions = page.refresh;
    const handleFilter = () => setRange({ start: startDate, end: endDate });
    const handleResetFilter = () => { setStartDate(''); setEndDate(''); setRange({ start: '', end: '' }); };
    const pending = useRef(false);
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
        setBoxQty(0);
        setPcsQty(0);
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
        setEditingTransactionId(null);
    }, []);

    // Handle Edit button click from table
    const handleEditTransaction = useCallback(async (transaction: TransactionWithProduct) => {
        // Fetch full product details first
        try {
            const product = await ProductRepo.getProductById(transaction.product_id);
            if (product) {
                setEditingTransactionId(transaction.id);
                setSelectedProduct(product);
                setSearchKeyword(product.name);
                setDate(transaction.created_at.split(' ')[0] || format(new Date(), 'yyyy-MM-dd'));
                
                const pcsPerBox = product.pcs_per_box || 1;
                const isSizeProduct = product.calculation_type === 'SIZE';
                if (!isSizeProduct && pcsPerBox > 1) {
                    setBoxQty(Math.floor(transaction.qty / pcsPerBox));
                    setPcsQty(transaction.qty % pcsPerBox);
                } else {
                    setBoxQty(0);
                    setPcsQty(transaction.qty);
                }
                
                setNote(transaction.note || '');
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (error) {
            console.error("Failed to load product for edit", error);
            alert("Gagal memuat detail produk untuk diedit");
        }
    }, []);

    // Submit handler
    const handleSubmit = useCallback(async () => {
        if (!selectedProduct) {
            alert('Silakan pilih produk terlebih dahulu!');
            return;
        }

        const pcsPerBox = selectedProduct.pcs_per_box || 10;
        const totalQty = totalQuantity(selectedProduct.calculation_type ?? 'BOX', pcsPerBox, boxQty, pcsQty);

        if (!Number.isSafeInteger(totalQty) || totalQty <= 0) {
            alert(type === 'IN' ? 'Jumlah masuk harus lebih dari 0!' : 'Jumlah keluar harus lebih dari 0!');
            return;
        }
        if (!editingTransactionId && type === 'OUT' && totalQty > selectedProduct.stock) {
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

        if (pending.current) return;
        pending.current = true;
        try {
        if (editingTransactionId) {
            const success = await updateTransaction({
                id: editingTransactionId,
                qty: totalQty,
                note: trimmedNote,
                created_at: date // Assumes the backend will merge the original time
            });

            if (success) {
                alert('Transaksi berhasil diupdate!');
                handleReset();
                loadTransactions();
            } else {
                alert('Gagal mengupdate transaksi!');
            }
        } else {
            const success = await createTransaction({
                product_id: selectedProduct.id,
                user_id: user.id,
                type: type,
                qty: totalQty,
                note: trimmedNote,
                created_at: date 
            });

            if (success) {
                alert(type === 'IN' ? 'Stok masuk berhasil disimpan!' : 'Stok keluar berhasil disimpan!');
                handleReset();
                loadTransactions();
            } else {
                alert(type === 'IN' ? 'Gagal menyimpan stok masuk!' : 'Gagal menyimpan stok keluar!');
            }
        }
        } finally { pending.current = false; }
    }, [selectedProduct, boxQty, pcsQty, note, date, user, createTransaction, updateTransaction, type, handleReset, loadTransactions, editingTransactionId]);

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

    const handleExport = async () => {
        try {
        const dataToExport = (await TransactionRepo.list(filter)).map(tx => ({
            'Tanggal': format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm'),
            'Nama Produk': tx.product_name,
            'Brand': tx.brand || '-',
            'Tipe': tx.brand_type || '-',
            'No Tipe': tx.type_number || '-',
            'Warna': tx.color || '-',
            'Jumlah': type === 'IN' ? tx.qty : -tx.qty,
            'Satuan': tx.calculation_type === 'SIZE' ? 'Pasang' : 'Pcs',
            'Stok Setelah': tx.current_stock_snapshot,
            'User': tx.username || '-',
            'Catatan': tx.note || '-',
        }));

        exportToExcel(dataToExport, `stok_${type.toLowerCase()}_${format(new Date(), 'yyyyMMdd')}`);
        } catch (error) { alert(String(error)); }
    };

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
                isEditing={!!editingTransactionId}
            />

            <StockTransactionTable
                type={type}
                data={page.rows}
                totalItems={page.total}
                currentPage={page.page}
                setCurrentPage={page.setPage}
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
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
            />

            {page.error && <p role="alert">{page.error}</p>}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={closeConfirm}
            />
        </div>
    );
}
