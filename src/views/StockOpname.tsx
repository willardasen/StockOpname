import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore, useProductStore } from '@/stores';
import { useStockOpname } from '@/hooks';
import { SearchInput } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, Search, Save, Check, AlertTriangle, Calculator, RotateCcw, Filter } from 'lucide-react';
import { GlobalOpnameRepo, TransactionRepo, type GlobalOpnameRecord } from '@/repositories';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function StockOpname() {
  const { isAdmin, user } = useAuthStore();
  const { products, searchProducts, totalStock, loadStats } = useProductStore();
  
  // Global opname state
  const [globalPhysicalBox, setGlobalPhysicalBox] = useState(0);
  const [globalPhysicalPcs, setGlobalPhysicalPcs] = useState(0);
  const [opnameHistory, setOpnameHistory] = useState<GlobalOpnameRecord[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  
  // Calculate total physical and difference
  const globalPhysicalTotal = useMemo(() => 
    ((globalPhysicalBox || 0) * 10) + (globalPhysicalPcs || 0), 
    [globalPhysicalBox, globalPhysicalPcs]
  );
  const globalDifference = useMemo(() => 
    globalPhysicalTotal - totalStock, 
    [globalPhysicalTotal, totalStock]
  );
  
  useEffect(() => {
    loadStats();
    loadHistory();
  }, [loadStats]);
  
  
  // Load verification history
  const loadHistory = useCallback(async (start?: string, end?: string) => {
    try {
      if (start && end) {
        const records = await GlobalOpnameRepo.getRecords(start, end);
        setOpnameHistory(records);
      } else {
        const records = await GlobalOpnameRepo.getRecords();
        setOpnameHistory(records);
      }
    } catch (error) {
      console.error('Failed to load opname history:', error);
    }
  }, []);

  const handleFilter = () => {
    if (startDate && endDate) {
        loadHistory(startDate, endDate);
    }
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    loadHistory();
  };
  
  // Save today's verification
  const handleSaveGlobalOpname = async () => {
    setSavingGlobal(true);
    setSaveSuccess('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const { total_in, total_out } = await TransactionRepo.getDailyTotals(today);
      
      await GlobalOpnameRepo.saveRecord({
        date: today,
        system_stock: totalStock,
        physical_stock: globalPhysicalTotal,
        difference: globalDifference,
        total_in,
        total_out,
        user_id: user?.id
      });
      
      setSaveSuccess('Verifikasi berhasil disimpan!');
      loadHistory();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to save global opname:', error);
    } finally {
      setSavingGlobal(false);
    }
  };
  
  const {
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
    difference
  } = useStockOpname();

  const handleSearch = (keyword: string) => {
    if (keyword.trim()) {
      searchProducts(keyword);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-blue-600" />
          Stock Opname
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Lakukan pengecekan dan penyesuaian stok fisik
        </p>
      </div>

      {/* Info Alert for Staff */}
      {!isAdmin() && (
        <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Mode Blind Count:</strong> Stok sistem disembunyikan. 
              Silakan hitung stok fisik tanpa melihat angka sistem.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {successMessage && (
        <Card className="border-green-300 bg-green-50 dark:bg-green-900/10">
          <CardContent className="flex items-center gap-3 py-4">
            <Check className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-800">
              {successMessage}
            </p>
          </CardContent>
        </Card>
      )}
      {/* Tabs for Grand Total vs Per Product */}
      <Tabs defaultValue="grand-total" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="grand-total">Grand Total</TabsTrigger>
          <TabsTrigger value="per-product">Per Produk</TabsTrigger>
        </TabsList>
        
        <TabsContent value="grand-total" className="space-y-6 mt-4">
          {/* Grand Total Crosscheck */}
          <Card className="bg-slate-50 border-slate-200 dark:border-slate-800">
        <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-indigo-600" />
                Verifikasi Grand Total
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            {/* System Stock Display */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                    <Label className="text-muted-foreground">Total Stok Sistem</Label>
                    <div className="text-2xl font-bold font-mono">
                        {new Intl.NumberFormat('id-ID').format(Math.floor(totalStock / 10))} Box
                    </div>
                    <p className="text-sm text-muted-foreground">
                        + {totalStock % 10} Pcs (Total: {new Intl.NumberFormat('id-ID').format(totalStock)} Pcs)
                    </p>
                </div>
                
                {/* Physical Input - Box */}
                <div className="space-y-2">
                    <Label htmlFor="physicalBox">Input Fisik (Box)</Label>
                    <Input 
                        id="physicalBox"
                        type="number"
                        min="0"
                        placeholder="0"
                        className="font-mono"
                        value={globalPhysicalBox}
                        onChange={(e) => setGlobalPhysicalBox(parseInt(e.target.value))}
                    />
                </div>
                
                {/* Physical Input - Pcs */}
                <div className="space-y-2">
                    <Label htmlFor="physicalPcs">Input Fisik (Pcs)</Label>
                    <Input 
                        id="physicalPcs"
                        type="number"
                        min="0"
                        placeholder="0"
                        className="font-mono"
                        value={globalPhysicalPcs}
                        onChange={(e) => setGlobalPhysicalPcs(parseInt(e.target.value))}
                    />
                </div>
                
                {/* Difference Display */}
                <div className="space-y-1 p-4 rounded-lg bg-white border dark:bg-black/20">
                    <Label className="text-muted-foreground">Selisih</Label>
                    <div className={`text-2xl font-bold font-mono ${
                        globalDifference === 0 ? 'text-green-600' : 
                        globalDifference > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                        {globalDifference > 0 ? '+' : ''}{new Intl.NumberFormat('id-ID').format(globalDifference)}
                    </div>
                    <p className={`text-xs ${
                        globalDifference === 0 ? 'text-green-600' : 
                        globalDifference > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                        {globalDifference === 0 ? 'Cocok' : globalDifference > 0 ? 'Lebih' : 'Kurang'}
                    </p>
                </div>
            </div>
            
            {/* Save Button */}
            <div className="flex justify-end gap-2">
                <Button 
                    onClick={handleSaveGlobalOpname}
                    disabled={savingGlobal}
                    className="gap-2"
                >
                    <Save className="h-4 w-4" />
                    Simpan Verifikasi Hari Ini
                </Button>
            </div>
            
            {saveSuccess && (
                <p className="text-green-600 text-sm text-right">{saveSuccess}</p>
            )}
        </CardContent>
      </Card>
      
      {/* History Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Riwayat Verifikasi
            </CardTitle>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Dari:</span>
                    <Input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-auto"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Sampai:</span>
                    <Input 
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-auto"
                    />
                </div>
                <Button variant="secondary" size="sm" onClick={handleFilter} title="Filter Tanggal">
                    <Filter className="h-4 w-4" />
                    Terapkan Filter
                </Button>
                
                
                 <Button variant="outline" size="sm" onClick={handleResetFilter} title="Tampilkan Semua">
                    <RotateCcw className="h-4 w-4" />
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border bg-white overflow-hidden shadow-sm ">
                <table className="w-full text-sm">
                    <thead className="bg-[#435585] text-white">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                            <th className="px-4 py-3 text-right font-medium">Stok Sistem</th>
                            <th className="px-4 py-3 text-right font-medium">Stok Fisik</th>
                            <th className="px-4 py-3 text-right font-medium">Selisih</th>
                            <th className="px-4 py-3 text-right font-medium">Total IN</th>
                            <th className="px-4 py-3 text-right font-medium">Total OUT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {opnameHistory.map((record) => (
                            <tr key={record.id} className="hover:bg-muted/30">
                                <td className="px-4 py-3">{record.date}</td>
                                <td className="px-4 py-3 text-right font-mono">{new Intl.NumberFormat('id-ID').format(record.system_stock)}</td>
                                <td className="px-4 py-3 text-right font-mono">{new Intl.NumberFormat('id-ID').format(record.physical_stock)}</td>
                                <td className={`px-4 py-3 text-right font-mono font-medium ${
                                    record.difference === 0 ? 'text-green-600' :
                                    record.difference > 0 ? 'text-blue-600' : 'text-red-600'
                                }`}>
                                    {record.difference > 0 ? '+' : ''}{new Intl.NumberFormat('id-ID').format(record.difference)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-green-600">+{new Intl.NumberFormat('id-ID').format(record.total_in)}</td>
                                <td className="px-4 py-3 text-right font-mono text-red-600">-{new Intl.NumberFormat('id-ID').format(record.total_out)}</td>
                            </tr>
                        ))}
                        {opnameHistory.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                    Belum ada data verifikasi
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </CardContent>
      </Card>
        </TabsContent>
        
        <TabsContent value="per-product" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Cari Produk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchInput 
              onSearch={handleSearch}
              placeholder="Ketik nama produk untuk mencari..."
            />
            
            {/* Search Results */}
            <div className="space-y-2 max-h-96 overflow-auto">
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => selectProduct(product)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedProduct?.id === product.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        {[product.brand, product.brand_type, product.color]
                          .filter(Boolean)
                          .join(' - ') || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Stok Sistem</p>
                      {/* Blind Count: Hide stock from staff */}
                      <p className="font-bold text-lg">
                        {isAdmin() ? product.stock : '???'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {products.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  Ketik untuk mencari produk
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Adjustment Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Input Stok Fisik
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedProduct ? (
              <form onSubmit={submitAdjustment} className="space-y-4">
                {/* Selected Product Info */}
                <div className="p-4 bg-gray-200 rounded-lg">
                  <p className="font-medium text-lg">{selectedProduct.name}</p>
                  <p className="text-sm text-gray-500">
                    {[selectedProduct.brand, selectedProduct.brand_type, selectedProduct.color]
                      .filter(Boolean)
                      .join(' - ') || '-'}
                  </p>
                  <div className="mt-3 flex gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Stok Sistem</p>
                      <p className="font-bold text-xl">
                        {isAdmin() ? selectedProduct.stock : '???'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Min Stok</p>
                      <p className="font-bold text-xl">{selectedProduct.min_stock}</p>
                    </div>
                  </div>
                </div>

                {/* Physical Count Input */}
                <div className="space-y-2">
                  <Label htmlFor="physicalCount">Jumlah Stok Fisik *</Label>
                  <Input
                    id="physicalCount"
                    type="number"
                    min="0"
                    value={physicalCount}
                    onChange={(e) => setPhysicalCount(e.target.value)}
                    placeholder="Masukkan jumlah stok fisik"
                    required
                    className="text-lg"
                  />
                </div>

                {/* Difference Display - Only show after input */}
                {difference !== null && (
                  <div className={`p-4 rounded-lg ${
                    difference === 0 
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20' 
                      : difference > 0
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20'
                        : 'bg-red-50 border-red-200 dark:bg-red-900/20'
                  } border`}>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Selisih</p>
                    <p className={`font-bold text-2xl ${
                      difference === 0 
                        ? 'text-green-600' 
                        : difference > 0
                          ? 'text-blue-600'
                          : 'text-red-600'
                    }`}>
                      {difference >= 0 ? '+' : ''}{difference}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {difference === 0 
                        ? 'Stok sudah sesuai!'
                        : difference > 0
                          ? `Lebih ${difference} unit`
                          : `Kurang ${Math.abs(difference)} unit`}
                    </p>
                  </div>
                )}

                {/* Note */}
                <div className="space-y-2">
                  <Label htmlFor="note">Catatan (Opsional)</Label>
                  <Input
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Tambahkan catatan jika perlu"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}

                {/* Submit */}
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={txLoading || physicalCount === ''}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Penyesuaian
                </Button>
              </form>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Pilih produk dari daftar di sebelah kiri untuk memulai stock opname</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
