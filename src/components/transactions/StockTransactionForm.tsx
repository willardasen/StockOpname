import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, RotateCcw, Save } from 'lucide-react';
import { Product } from '@/types/database';

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

interface TransactionFormProps {
  type: 'IN' | 'OUT';
  date: string;
  setDate: (date: string) => void;
  searchKeyword: string;
  setSearchKeyword: (keyword: string) => void;
  searchResults: Product[];
  showResults: boolean;
  isSearching: boolean;
  onSearch: () => void;
  onSelectProduct: (product: Product) => void;
  selectedProduct: Product | null;
  boxQty: number;
  setBoxQty: (qty: number) => void;
  pcsQty: number;
  setPcsQty: (qty: number) => void;
  note: string;
  setNote: (note: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  isSaving: boolean;
  isEditing?: boolean;
}

export const StockTransactionForm = memo(({
  type,
  date,
  setDate,
  searchKeyword,
  setSearchKeyword,
  searchResults,
  showResults,
  isSearching,
  onSearch,
  onSelectProduct,
  selectedProduct,
  boxQty,
  setBoxQty,
  pcsQty,
  setPcsQty,
  note,
  setNote,
  onSubmit,
  onReset,
  isSaving,
  isEditing = false,
}: TransactionFormProps) => {
  const isStockIn = type === 'IN';
  const themeColor = isStockIn ? 'text-green-600' : 'text-orange-600';
  const buttonColor = isStockIn ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700';

  return (
    <Card>
      <CardHeader>
        <CardTitle className={`text-lg ${themeColor}`}>
          {isEditing 
            ? `Edit Transaksi ${isStockIn ? 'Masuk' : 'Keluar'}` 
            : `Form Barang ${isStockIn ? 'Masuk' : 'Keluar'}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Date and Product Search Row */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Tanggal {isStockIn ? 'Masuk' : 'Keluar'}</Label>
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
            <Label htmlFor="search">Kode / Nama Produk</Label>
            <div className="flex gap-2">
              <Input
                id="search"
                placeholder="Ketik nama atau kode barang..."
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                }}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                disabled={isEditing}
              />
              <Button variant="outline" onClick={onSearch} disabled={isSearching || isEditing}>
                <Search className="h-4 w-4 mr-2" />
                Cek Barang
              </Button>
            </div>
          </div>
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="mt-2 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto z-10">
            {searchResults.map((product) => (
              <div
                key={product.id}
                className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => onSelectProduct(product)}
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

        {/* Product Details */}
        {selectedProduct && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-200 rounded-lg border">
            <div className="space-y-2">
              <Label>Nama Produk</Label>
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
                <span className={`${isStockIn ? 'text-green-600' : 'text-orange-600'} font-bold`}>
                  {formatNumber(selectedProduct.stock)} Pcs
                </span>
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
              <Label>Jumlah {isStockIn ? 'Masuk' : 'Keluar'}</Label>
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
                <p className={`text-xs ${themeColor} font-medium`}>
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
          <Button onClick={onSubmit} disabled={isSaving || !selectedProduct} className={buttonColor}>
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? 'Update Transaksi' : 'Simpan'}
          </Button>
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Batal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

StockTransactionForm.displayName = 'StockTransactionForm';
