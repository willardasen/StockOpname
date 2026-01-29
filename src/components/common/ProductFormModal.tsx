import { useEffect, useMemo } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Edit, Trash2, X, Plus } from 'lucide-react';
import type { CreateProductInput } from '../../types/database';
import { useBrandStore } from '../../stores';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  formData: CreateProductInput;
  setFormData: (data: CreateProductInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
  isLoading: boolean;
}

// Helper: Format number with thousands separator (dots)
const formatNumber = (num: number | string | undefined): string => {
  if (num === undefined || num === null || num === '') return '';
  // Convert to string, remove non-digits first to be safe, then format
  const cleanNum = num.toString().replace(/\D/g, ''); 
  return new Intl.NumberFormat('id-ID').format(Number(cleanNum));
};

// Helper: Parse string with dots back to number
const parseNumber = (val: string): number => {
  if (!val) return 0;
  // Remove all non-digits
  const cleanVal = val.replace(/\D/g, '');
  return Number(cleanVal);
};

export function ProductFormModal({
  isOpen,
  onClose,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  onDelete,
  isLoading
}: ProductFormModalProps) {
  const { 
    brands, 
    brandTypes, 
    typeNumbers, 
    colors,
    loadAll 
  } = useBrandStore();

  useEffect(() => {
    if (isOpen) {
      loadAll();
    }
  }, [isOpen, loadAll]);

  // Derived state for filtering
  const selectedBrandObj = brands.find(b => b.name === formData.brand);
  const selectedBrandId = selectedBrandObj?.id;

  const filteredBrandTypes = useMemo(() => {
    if (!selectedBrandId) return [];
    return brandTypes.filter(bt => bt.brand_id === selectedBrandId);
  }, [brandTypes, selectedBrandId]);

  const filteredTypeNumbers = useMemo(() => {
    if (!selectedBrandId) return [];
    return typeNumbers.filter(tn => tn.brand_id === selectedBrandId);
  }, [typeNumbers, selectedBrandId]);


  // Auto-generate name when Brand, Type, Number, or Color changes
  useEffect(() => {
    // Only auto-generate if NOT editing an existing product OR if force re-gen is clear (user implied strict logic)
    // We update name whenever parts change.
    
    // Construct name parts
    const brand = brands.find(b => b.name === formData.brand)?.name || formData.brand || '';
    const type = brandTypes.find(t => t.name === formData.brand_type)?.name || formData.brand_type || '';
    const number = typeNumbers.find(n => n.name === formData.type_number)?.name || formData.type_number || '';
    const color = colors.find(c => c.name === formData.color)?.name || formData.color || '';

    // If at least one part is present, form the name
    if (brand || type || number || color) {
      const newName = [brand, type, number, color].filter(Boolean).join(' ');
      
      // Update if different to avoid infinite loops
      if (newName !== formData.name) {
        setFormData({ ...formData, name: newName });
      }
    }
  }, [formData.brand, formData.brand_type, formData.type_number, formData.color, formData.name, brands, brandTypes, typeNumbers, colors, setFormData, formData]);

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newBrand = e.target.value;
      // Reset dependent fields when brand changes
      setFormData({ 
          ...formData, 
          brand: newBrand,
          brand_type: '', // Reset
          type_number: '' // Reset
      });
  };
  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      // Manual Validation
      if (!formData.brand) { alert("Silakan pilih Brand!"); return; }
      // brand_type and type_number are now optional
      // if (!formData.brand_type) { alert("Silakan pilih Tipe Brand!"); return; }
      // if (!formData.type_number) { alert("Silakan pilih No. Tipe!"); return; }
      if (!formData.color) { alert("Silakan pilih Warna!"); return; }

      // Validate numeric fields (allow 0 but check for null/undefined strings if logic demands, currently allow 0)
      if (formData.buy_price === undefined || formData.buy_price === null) { alert("Harga Beli harus diisi!"); return; }
      if (formData.sell_price === undefined || formData.sell_price === null) { alert("Harga Jual harus diisi!"); return; }
      if (formData.stock === undefined || formData.stock === null) { alert("Stok harus diisi!"); return; }

      onSubmit(e);
  };

  if (!isOpen) return null;

  const selectClass = "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEditing ? 'Edit Produk' : 'Tambah Produk Baru'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4 cursor-pointer hover:bg-red-500 hover:text-white rounded-full" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Nama Produk (Auto-Generated)</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  readOnly 
                  className="bg-gray-100 text-gray-700"
                />
              </div>
              
              {/* Brand Select */}
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="brand">Brand</Label>
                <select
                  id="brand"
                  className={selectClass}
                  value={formData.brand || ''}
                  onChange={handleBrandChange}
                >
                  <option value="">Pilih Brand</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>

               {/* Brand Type Select */}
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="brand_type">Tipe Brand</Label>
                <select
                  id="brand_type"
                  className={selectClass}
                  value={formData.brand_type || ''}
                  onChange={(e) => setFormData({ ...formData, brand_type: e.target.value })}
                  disabled={!formData.brand} // Disable if no brand selected
                >
                  <option value="">Pilih Tipe (Opsional)</option>
                  {filteredBrandTypes.length > 0 ? (
                      filteredBrandTypes.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))
                  ) : (
                      <option value="" disabled>Tidak ada tipe untuk brand ini</option>
                  )}
                </select>
              </div>

               {/* Type Number Select */}
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="type_number">No. Tipe</Label>
                 <select
                  id="type_number"
                  className={selectClass}
                  value={formData.type_number || ''}
                  onChange={(e) => setFormData({ ...formData, type_number: e.target.value })}
                   disabled={!formData.brand} // Disable if no brand selected
                >
                  <option value="">Pilih No. Tipe (Opsional)</option>
                  {filteredTypeNumbers.length > 0 ? (
                      filteredTypeNumbers.map(n => (
                        <option key={n.id} value={n.name}>{n.name}</option>
                      ))
                  ) : (
                      <option value="" disabled>Tidak ada no. tipe untuk brand ini</option>
                  )}
                </select>
              </div>

                {/* Color Select */}
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="color">Warna</Label>
                <select
                  id="color"
                  className={selectClass}
                  value={formData.color || ''}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                >
                  <option value="">Pilih Warna</option>
                   {colors?.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="buy_price">Harga Beli</Label>
                <Input
                  id="buy_price"
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(formData.buy_price)}
                  onChange={(e) => setFormData({ ...formData, buy_price: parseNumber(e.target.value) })}
                  placeholder="0"
                  className="placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label htmlFor="sell_price">Harga Jual</Label>
                <Input
                  id="sell_price"
                  type="text"
                   inputMode="numeric"
                  value={formatNumber(formData.sell_price)}
                  onChange={(e) => setFormData({ ...formData, sell_price: parseNumber(e.target.value) })}
                   placeholder="0"
                   className="placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label htmlFor="stock">Stok</Label>
                <Input
                  id="stock"
                  type="text"
                   inputMode="numeric"
                  value={formatNumber(formData.stock)}
                  onChange={(e) => setFormData({ ...formData, stock: parseNumber(e.target.value) })}
                   placeholder="0"
                   className="placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label htmlFor="min_stock">Min Stok</Label>
                <Input
                  id="min_stock"
                  type="text"
                   inputMode="numeric"
                  value={formatNumber(formData.min_stock)}
                  onChange={(e) => setFormData({ ...formData, min_stock: parseNumber(e.target.value) })}
                   placeholder="0"
                   className="placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              {isEditing && (
                <Button type="button" variant="destructive" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" disabled={isLoading} variant="outline">
                {isEditing ? (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Update
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Simpan
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
