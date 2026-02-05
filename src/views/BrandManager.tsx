import { useEffect, useState } from 'react';
import { useAuthStore, useBrandStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Trash2, Plus, Database, Palette } from 'lucide-react';

export function BrandManager() {
  const { isAdmin } = useAuthStore();
  const { 
    brands, 
    brandTypes, 
    typeNumbers,
    colors,
    isLoading,
    loadAll,
    addBrand, 
    deleteBrand,
    addBrandType,
    deleteBrandType,
    addTypeNumber,
    deleteTypeNumber,
    addColor,
    deleteColor
  } = useBrandStore();

  const [newBrand, setNewBrand] = useState('');
  const [newPcsPerBox, setNewPcsPerBox] = useState('10');
  
  // Linked Data Inputs
  const [newBrandType, setNewBrandType] = useState('');
  const [selectedBrandForType, setSelectedBrandForType] = useState('');

  const [newTypeNumber, setNewTypeNumber] = useState('');
  const [selectedBrandForNumber, setSelectedBrandForNumber] = useState('');

  const [newColor, setNewColor] = useState('');

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

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBrand.trim()) {
      const pcs = parseInt(newPcsPerBox) || 1;
      const result = await addBrand(newBrand.trim(), pcs);
      if (result.success) {
          setNewBrand('');
          setNewPcsPerBox('10');
      } else {
          alert(result.message || "Gagal menambah Brand");
      }
    }
  };

  const handleAddBrandType = async (e: React.FormEvent) => {
    e.preventDefault();
    const brandId = Number(selectedBrandForType);
    if (newBrandType.trim() && brandId) {
      const result = await addBrandType(newBrandType.trim(), brandId);
      if (result.success) {
          setNewBrandType('');
      } else {
          alert(result.message || "Gagal menambah Tipe Brand");
      }
    } else if (!brandId) {
        alert("Pilih Brand terlebih dahulu.");
    }
  };

  const handleAddTypeNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    const brandId = Number(selectedBrandForNumber);
    if (newTypeNumber.trim() && brandId) {
      const result = await addTypeNumber(newTypeNumber.trim(), brandId);
      if (result.success) {
          setNewTypeNumber('');
      } else {
           alert(result.message || "Gagal menambah No. Tipe");
      }
    } else if (!brandId) {
        alert("Pilih Brand terlebih dahulu.");
    }
  };

  const handleAddColor = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newColor.trim()) {
          const result = await addColor(newColor.trim());
          if (result.success) {
              setNewColor('');
          } else {
              alert(result.message || "Gagal menambah Warna");
          }
      }
  }

  if (!isAdmin()) {
    return <div className="p-4 text-center">Akses ditolak. Halaman ini khusus admin.</div>;
  }

  const selectClass = "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 max-w-xs";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-indigo-600" />
            Brand
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Kelola data Brand, Tipe, No. Tipe, dan Warna
          </p>
        </div>
      </div>

      <Tabs defaultValue="brands" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="brands">Brand</TabsTrigger>
          <TabsTrigger value="brandTypes">Tipe Brand</TabsTrigger>
          <TabsTrigger value="typeNumbers">No. Tipe</TabsTrigger>
          <TabsTrigger value="colors">Warna</TabsTrigger>
        </TabsList>

        {/* Brands Tab */}
        <TabsContent value="brands">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Brand</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddBrand} className="flex gap-4 items-end">
                <div className="grid w-full max-w-sm gap-1.5">
                    <Label htmlFor="brand-name">Nama Brand</Label>
                    <Input 
                        id="brand-name"
                        placeholder="Nama Brand Baru" 
                        value={newBrand}
                        onChange={(e) => setNewBrand(e.target.value)}
                    />
                </div>

                <div className="grid gap-1.5">
                    <Label htmlFor="pcs-input">Isi per Box</Label>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">1 Box =</span>
                        <Input 
                            id="pcs-input"
                            placeholder="10" 
                            type="number"
                            value={newPcsPerBox}
                            onChange={(e) => setNewPcsPerBox(e.target.value)}
                            className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">Pcs</span>
                    </div>
                </div>

                <Button type="submit" disabled={isLoading || !newBrand.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah
                </Button>
              </form>
              
              <div className="border rounded-md divide-y max-h-[500px] overflow-y-auto">
                {brands.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Belum ada data brand</div>
                ) : (
                  brands.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          1 Box = {item.pcs_per_box} Pcs
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => showConfirm('Yakin ingin menghapus brand ini?', () => {
                            deleteBrand(item.id);
                            closeConfirm();
                        })}
                      >
                         <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Brand Types Tab */}
        <TabsContent value="brandTypes">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Tipe Brand</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddBrandType} className="flex gap-2 items-end">
                <div className="space-y-2 w-full max-w-xs">
                    <select 
                        className={selectClass}
                        value={selectedBrandForType}
                        onChange={(e) => setSelectedBrandForType(e.target.value)}
                    >
                        <option value="">Pilih Brand Induk...</option>
                        {brands.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <Input 
                  placeholder="Nama Tipe Brand Baru" 
                  value={newBrandType}
                  onChange={(e) => setNewBrandType(e.target.value)}
                  className="max-w-sm"
                />
                <Button type="submit" disabled={isLoading || !newBrandType.trim() || !selectedBrandForType}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah
                </Button>
              </form>

              <div className="border rounded-md divide-y max-h-[500px] overflow-y-auto">
                {brandTypes.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">Belum ada data tipe brand</div>
                ) : (
                  brandTypes.map((item) => {
                    const parentBrand = brands.find(b => b.id === item.brand_id);
                    return (
                        <div key={item.id} className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div>
                            <span className="font-medium">{item.name}</span>
                            {parentBrand && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                    {parentBrand.name}
                                </span>
                            )}
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => showConfirm('Yakin ingin menghapus tipe brand ini?', () => {
                                deleteBrandType(item.id);
                                closeConfirm();
                            })}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Type Numbers Tab */}
        <TabsContent value="typeNumbers">
          <Card>
            <CardHeader>
              <CardTitle>Daftar No. Tipe</CardTitle>
            </CardHeader>
             <CardContent className="space-y-4">
              <form onSubmit={handleAddTypeNumber} className="flex gap-2 items-end">
                <div className="space-y-2 w-full max-w-xs">
                    <select 
                        className={selectClass}
                        value={selectedBrandForNumber}
                        onChange={(e) => setSelectedBrandForNumber(e.target.value)}
                    >
                        <option value="">Pilih Brand Induk...</option>
                        {brands.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <Input 
                  placeholder="No. Tipe Baru" 
                  value={newTypeNumber}
                  onChange={(e) => setNewTypeNumber(e.target.value)}
                  className="max-w-sm"
                />
                <Button type="submit" disabled={isLoading || !newTypeNumber.trim() || !selectedBrandForNumber}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah
                </Button>
              </form>

              <div className="border rounded-md divide-y max-h-[500px] overflow-y-auto">
                {typeNumbers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">Belum ada data no. tipe</div>
                ) : (
                  typeNumbers.map((item) => {
                    const parentBrand = brands.find(b => b.id === item.brand_id);
                    return (
                        <div key={item.id} className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div>
                            <span className="font-medium">{item.name}</span>
                            {parentBrand && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                    {parentBrand.name}
                                </span>
                            )}
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => showConfirm('Yakin ingin menghapus no. tipe ini?', () => {
                                deleteTypeNumber(item.id);
                                closeConfirm();
                            })}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Daftar Warna
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleAddColor} className="flex gap-2">
                        <Input 
                            placeholder="Warna Baru (contoh: Merah, Hitam Doff)" 
                            value={newColor}
                            onChange={(e) => setNewColor(e.target.value)}
                            className="max-w-sm"
                        />
                        <Button type="submit" disabled={isLoading || !newColor.trim()}>
                            <Plus className="h-4 w-4 mr-2" />
                            Tambah
                        </Button>
                    </form>

                    <div className="border rounded-md divide-y max-h-[500px] overflow-y-auto">
                        {colors && colors.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">Belum ada data warna</div>
                        ) : (
                            colors?.map((item) => (
                                <div key={item.id} className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <span>{item.name}</span>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => showConfirm('Yakin ingin menghapus warna ini?', () => {
                                            deleteColor(item.id);
                                            closeConfirm();
                                        })}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

      </Tabs>

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
