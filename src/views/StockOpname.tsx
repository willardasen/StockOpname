import { useAuthStore, useProductStore } from '@/stores';
import { useStockOpname } from '@/hooks';
import { SearchInput } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, Search, Save, Check, AlertTriangle } from 'lucide-react';

export function StockOpname() {
  const { isAdmin } = useAuthStore();
  const { products, searchProducts } = useProductStore();
  
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
    </div>
  );
}
