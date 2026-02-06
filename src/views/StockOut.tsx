import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PackageMinus, Search, RotateCcw, Save, Pencil, Trash2, Download, Filter } from 'lucide-react';
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

export function StockOut() {
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
        // Fetch filtered OUT transactions
        data = await TransactionRepo.getTransactionsByDateRange(start, end, 'OUT');
      } else {
        // Fetch recent OUT transactions
        data = await TransactionRepo.getTransactionHistory(undefined, undefined, 'OUT');
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
      alert('Jumlah keluar harus lebih dari 0!');
      return;
    }
    if (totalQty > selectedProduct.stock) {
      alert(`Stok tidak mencukupi! Stok saat ini: ${selectedProduct.stock}`);
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
      type: 'OUT',
      qty: totalQty,
      note: trimmedNote
    });

    if (success) {
      alert('Stok keluar berhasil disimpan!');
      handleReset();
      loadTransactions();
    } else {
      alert('Gagal menyimpan stok keluar!');
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
            <PackageMinus className="h-6 w-6 text-orange-600" />
            Stok Keluar
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Catat barang yang keluar dari gudang
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-orange-600">Form Barang Keluar</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Date and Product Search Row */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Tanggal Keluar</Label>
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
                 <Label>Jumlah Keluar</Label>
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
                     <p className="text-xs text-orange-600 font-medium">
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
            <Button onClick={handleSubmit} disabled={isSaving || !selectedProduct} className="bg-orange-600 hover:bg-orange-700">
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

        <div className="rounded-md border bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#435585] text-white">
              <tr>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Nama Barang</th>
                <th className="px-4 py-3 font-medium">Brand</th>
                <th className="px-4 py-3 font-medium">Tipe</th>
                <th className="px-4 py-3 font-medium">No Tipe</th>
                <th className="px-4 py-3 font-medium">Warna</th>
                <th className="px-4 py-3 font-medium">Penanggung Jawab</th>
                <th className="px-4 py-3 font-medium text-right">Box</th>
                <th className="px-4 py-3 font-medium text-right">Jumlah (Pcs)</th>
                <th className="px-4 py-3 font-medium text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentTransactions
                .filter(t => 
                    !tableSearch || 
                    t.product_name.toLowerCase().includes(tableSearch.toLowerCase()) ||
                    (t.id.toString()).includes(tableSearch)
                )
                .map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {format(new Date(t.created_at), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3 font-medium">{t.product_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.brand || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.brand_type || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.type_number || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.color || '-'}</td>
                  <td className="px-4 py-3 capitalize">
                    {t.note || t.username || '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {t.pcs_per_box && t.pcs_per_box > 1 
                        ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(t.qty / t.pcs_per_box)
                        : (t.pcs_per_box === 1 && t.qty > 0 ? t.qty : '-')
                    }
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-orange-600">
                    {formatNumber(t.qty)}
                  </td>
                   <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteTransaction(t.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </td>
                </tr>
              ))}
               {recentTransactions.length === 0 && (
                  <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                          Belum ada data transaksi hari ini
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
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
