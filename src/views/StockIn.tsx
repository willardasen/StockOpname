import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { VirtualTable } from '@/components/common';
import { PackagePlus, Search, RotateCcw, Save, Trash2, Pencil, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useTransactionStore, useAuthStore } from '@/stores';
import { ProductRepo, TransactionRepo } from '@/repositories';
import type { Product, TransactionWithProduct } from '@/types/database';

// Helper: Format number with thousands separator (dots)
const formatNumber = (num: number | string | undefined): string => {
  if (num === undefined || num === null || num === '') return '';
  const cleanNum = num.toString().replace(/\D/g, '');
  return new Intl.NumberFormat('id-ID').format(Number(cleanNum));
};

// Helper: Parse string with dots back to number
const parseNumber = (val: string): number => {
  if (!val) return 0;
  const cleanVal = val.replace(/\D/g, '');
  return Number(cleanVal);
};

export function StockIn() {
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

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, message, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} });
  };

  // Load recent transactions
  const loadTransactions = useCallback(async (start?: string, end?: string) => {
    try {
      let data;
      if (start && end) {
         data = await TransactionRepo.getTransactionsByDateRange(start, end, 'IN');
      } else {
         // Fetch recent IN transactions
         data = await TransactionRepo.getTransactionHistory(undefined, undefined, 'IN');
      }
      setRecentTransactions(data);
    } catch (error) {
      console.error("Failed to load transactions", error);
    }
  }, []);

  const handleFilter = () => {
    if (startDate && endDate) {
        loadTransactions(startDate, endDate);
    }
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    loadTransactions();
  };

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Search handler - use ProductRepo directly
  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await ProductRepo.searchProducts(searchKeyword);
      setSearchResults(results);
      setShowResults(true);
    } finally {
      setIsSearching(false);
    }
  };

  // Select product from search results
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchKeyword(product.name);
    setShowResults(false);
    setSearchResults([]);
  };

  // Reset form
  const handleReset = () => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setSearchKeyword('');
    setSearchResults([]);
    setSelectedProduct(null);
    setBoxQty(0);
    setPcsQty(0);
    setNote('');
    setShowResults(false);
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!selectedProduct) {
      alert('Silakan pilih produk terlebih dahulu!');
      return;
    }

    const pcsPerBox = selectedProduct.pcs_per_box || 1;
    const totalQty = (boxQty * pcsPerBox) + pcsQty;

    if (totalQty <= 0) {
      alert('Jumlah masuk harus lebih dari 0!');
      return;
    }
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      alert('Penanggung Jawab tidak boleh kosong!');
      return;
    }
    if (!user) {
      alert('User tidak ditemukan!');
      return;
    }

    const success = await createTransaction({
      product_id: selectedProduct.id,
      user_id: user.id,
      type: 'IN',
      qty: totalQty,
      note: trimmedNote
    });

    if (success) {
      alert('Stok masuk berhasil disimpan!');
      handleReset();
      loadTransactions();
    } else {
      alert('Gagal menyimpan stok masuk!');
    }
  };

  const handleDeleteTransaction = async (id: number) => {
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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackagePlus className="h-6 w-6 text-green-600" />
            Stok Masuk
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Catat barang yang masuk ke gudang
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-green-600">Form Barang Masuk</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Date and Product Search Row */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Tanggal Masuk</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-fit"
              />
            </div>

            {/* Product Search */}
            <div className="space-y-2 flex-1 min-w-[300px]">
              <Label htmlFor="search">Kode / Nama Barang</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="Ketik nama atau kode barang..."
                  value={searchKeyword}
                  onChange={(e) => {
                    setSearchKeyword(e.target.value);
                    if (selectedProduct) setSelectedProduct(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="outline" onClick={handleSearch} disabled={isSearching}>
                  <Search className="h-4 w-4 mr-2" />
                  Cek Barang
                </Button>
              </div>
            </div>
          </div>

          {/* Search Results Dropdown - Full width, positioned below inputs */}
          {showResults && searchResults.length > 0 && (
            <div className="mt-2 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto z-10">
              {searchResults.map((product) => (
                <div
                  key={product.id}
                  className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSelectProduct(product)}
                >
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-gray-500">
                    {product.brand} {product.brand_type} {product.type_number} - {product.color} | Stok: {product.stock}
                  </div>
                </div>
              ))}
            </div>
          )}
          {showResults && searchResults.length === 0 && (
            <div className="mt-2 w-full bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500">
              Tidak ada produk ditemukan
            </div>
          )}

          {/* Product Details (shown after selection) */}
          {selectedProduct && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-200 rounded-lg border">
              <div className="space-y-2">
                <Label>Nama Barang</Label>
                <Input value={selectedProduct.name} readOnly className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label>Jenis Barang</Label>
                <Input 
                  value={`${selectedProduct.brand || ''} ${selectedProduct.brand_type || ''} ${selectedProduct.type_number || ''}`.trim()} 
                  readOnly 
                  className="bg-white" 
                />
              </div>
              <div className="space-y-2">
                <Label>Warna</Label>
                <Input value={selectedProduct.color || '-'} readOnly className="bg-white" />
              </div>

              <div className="space-y-2">
                <Label>Stok Saat Ini</Label>
                 <div className="bg-white px-3 py-2 rounded-md border font-medium">
                    <span className="text-green-600 font-bold">{formatNumber(selectedProduct.stock)} Pcs</span>
                    {(selectedProduct.pcs_per_box || 1) > 1 && (
                        <span className="text-gray-500 text-xs ml-2">
                            ({Math.floor(selectedProduct.stock / (selectedProduct.pcs_per_box || 1))} Box {selectedProduct.stock % (selectedProduct.pcs_per_box || 1)} Pcs)
                        </span>
                    )}
                 </div>
              </div>
            </div>
          )}

            {/* Quantity and Note */}
          {selectedProduct && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                 <Label>Jumlah Masuk</Label>
                 <div className="flex gap-2">
                     <div className="flex-1">
                        <Label htmlFor="boxQty" className="text-xs font-medium text-gray-500">Box</Label>
                         <div className="relative">
                            <Input
                                id="boxQty"
                                type="text"
                                inputMode="numeric"
                                placeholder="0"
                                value={formatNumber(boxQty)}
                                onChange={(e) => setBoxQty(parseNumber(e.target.value))}
                                className="placeholder:text-muted-foreground"
                            />
                             {(selectedProduct.pcs_per_box || 1) > 1 && (
                                <div className="absolute right-3 top-2.5 text-xs text-muted-foreground bg-white px-1">
                                    x{selectedProduct.pcs_per_box}
                                </div>
                            )}
                         </div>
                    </div>
                    <div className="flex-1">
                        <Label htmlFor="pcsQty" className="text-xs font-medium text-gray-500">Pcs</Label>
                        <Input
                            id="pcsQty"
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={formatNumber(pcsQty)}
                            onChange={(e) => setPcsQty(parseNumber(e.target.value))}
                            className="placeholder:text-muted-foreground"
                        />
                    </div>
                 </div>
                 {(selectedProduct.pcs_per_box || 1) > 1 && (
                     <p className="text-xs text-green-600 font-medium">
                         Total: {formatNumber((boxQty * (selectedProduct.pcs_per_box || 1)) + pcsQty)} Pcs
                     </p>
                 )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="note">Catatan / Penanggung Jawab</Label>
                <Input
                  id="note"
                  placeholder="Masukkan catatan atau nama penanggung jawab..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-4">
            <Button onClick={handleSubmit} disabled={isSaving || !selectedProduct} className="bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4 mr-2" />
              Simpan
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Cari kode atau nama barang..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="pl-9 bg-white text-black"
                />
            </div>
             <div className="flex items-center gap-2">
                 <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Dari:</span>
                    <Input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-auto h-9"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Sampai:</span>
                    <Input 
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-auto h-9"
                    />
                </div>
                <Button variant="secondary" size="sm" onClick={handleFilter} title="Filter Tanggal">
                    <Filter className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetFilter} title="Reset Filter">
                    <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                </Button>
             </div>
        </div>

        <VirtualTable
          data={recentTransactions.filter(t => 
            !tableSearch || 
            t.product_name.toLowerCase().includes(tableSearch.toLowerCase()) ||
            (t.id.toString()).includes(tableSearch)
          )}
          columns={[
            { key: 'created_at', header: 'Tanggal', width: 100, render: (_, row) => format(new Date((row as TransactionWithProduct).created_at), 'dd/MM/yyyy') },
            { key: 'product_name', header: 'Nama Barang', width: 250 },
            { key: 'brand', header: 'Brand', width: 120, render: (v) => String(v || '-') },
            { key: 'brand_type', header: 'Tipe', width: 80, render: (v) => String(v || '-') },
            { key: 'type_number', header: 'No Tipe', width: 80, render: (v) => String(v || '-') },
            { key: 'color', header: 'Warna', width: 80, render: (v) => String(v || '-') },
            { key: 'note', header: 'Penanggung Jawab', width: 150, render: (v, row) => String(v || (row as TransactionWithProduct).username || '-') },
            { key: 'qty', header: 'Box', width: 80, align: 'right' as const, render: (_, row) => {
              const t = row as TransactionWithProduct;
              return t.pcs_per_box && t.pcs_per_box > 1 
                ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(t.qty / t.pcs_per_box)
                : (t.pcs_per_box === 1 && t.qty > 0 ? t.qty : '-');
            }},
            { key: 'qty_pcs', header: 'Jumlah (Pcs)', width: 100, align: 'right' as const, render: (_, row) => (
              <span className="font-medium text-green-600">{formatNumber((row as TransactionWithProduct).qty)}</span>
            )},
            { key: 'actions', header: 'Aksi', width: 100, align: 'center' as const, render: (_, row) => (
              <div className="flex items-center justify-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDeleteTransaction((row as TransactionWithProduct).id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )},
          ]}
          emptyMessage="Belum ada data transaksi hari ini"
        />
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
