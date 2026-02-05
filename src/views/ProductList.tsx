import { useEffect, useState } from 'react';
import { useAuthStore, useProductStore } from '@/stores';
import { useProductForm } from '@/hooks';
import { VirtualTable, SearchInput, ProductFormModal } from '@/components/common';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Plus, Package, Pencil, Trash2 } from 'lucide-react';
import type { Product } from '@/types/database';

export function ProductList() {
  const { isAdmin } = useAuthStore();
  const { 
    products, 
    isLoading,
    searchProducts, 
    loadProducts
  } = useProductStore();

  const {
    showModal,
    setShowModal,
    isEditing,
    formData,
    setFormData,
    handleAddNew,
    handleEdit,
    handleSubmit,
    handleDeleteProduct
  } = useProductForm();

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
    loadProducts();
  }, [loadProducts]);

  const columns = [
    { key: 'name' as const, header: 'Nama Produk', width: 200 },
    { key: 'brand' as const, header: 'Brand', width: 120 },
    { key: 'brand_type' as const, header: 'Tipe', width: 100 },
    { key: 'type_number' as const, header: 'No. Tipe', width: 100 },
    { key: 'color' as const, header: 'Warna', width: 80 },
    { 
      key: 'buy_price' as const, 
      header: 'Harga Beli', 
      width: 120,
      adminOnly: true,
      render: (value: unknown) => formatCurrency(value as number)
    },
    { 
      key: 'sell_price' as const, 
      header: 'Harga Jual', 
      width: 120,
      adminOnly: true,
      render: (value: unknown) => formatCurrency(value as number)
    },
    { 
      key: 'stock' as const, 
      header: 'Stok', 
      width: 80,
      render: (value: unknown, row: Product) => (
        <span className={row.stock <= row.min_stock ? 'text-red-600 font-bold' : ''}>
          {value as number}
        </span>
      )
    },
    { key: 'min_stock' as const, header: 'Min Stok', width: 80 },
    // Action column (admin only)
    {
      key: 'actions' as const,
      header: 'Aksi',
      width: 120,
      adminOnly: true,
      render: (_value: unknown, row: Product) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              showConfirm(`Yakin ingin menghapus produk "${row.name}"?`, async () => {
                await handleDeleteProduct(row.id);
                closeConfirm();
              });
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleSearch = (keyword: string) => {
    searchProducts(keyword);
  };


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            Daftar Produk
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {products.length} produk ditemukan
          </p>
        </div>
        {isAdmin() && (
          <Button onClick={handleAddNew} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Tambah Produk
          </Button>
        )}
      </div>

      {/* Search */}
      <SearchInput 
        onSearch={handleSearch} 
        placeholder="Cari nama, brand, atau tipe produk..."
        className="max-w-md"
      />

      {/* Table */}
      <VirtualTable
        data={products}
        columns={columns}
        isAdmin={isAdmin()}
        highlightLowStock={true}
        emptyMessage="Tidak ada produk ditemukan"
      />

      {/* Modal */}
      <ProductFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isEditing={isEditing}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        onDelete={() => showConfirm('Yakin ingin menghapus produk ini?', async () => {
          await handleDeleteProduct();
          closeConfirm();
        })}
        isLoading={isLoading}
      />

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

