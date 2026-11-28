import { usePagedQuery } from '@/hooks/usePagedQuery';
import { PageControls } from '@/components/common/PageControls';
import { useState } from 'react';
import { TransactionRepo } from '@/repositories';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VirtualTable, ProductFilterBar } from '@/components/common';
import type { ProductFilter } from '@/components/common';
import { History, Filter, Search, Upload } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { exportToExcel } from '@/utils/excel';
import type { TransactionType, TransactionWithProduct } from '@/types/database';

export function TransactionHistory() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | ''>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>({ brand: '', brandType: '', typeNumber: '', color: '' });

  const [range, setRange] = useState({ start: '', end: '', kind: '' });
  const handleFilter = () => setRange({ start: startDate, end: endDate, kind: filterType });
  const filter = { ...range, keyword: searchKeyword, brand: productFilter.brand, brand_type: productFilter.brandType, type_number: productFilter.typeNumber, color: productFilter.color };
  const page = usePagedQuery<TransactionWithProduct>('history', filter);
  const filteredTransactions = page.rows;
  const isLoading = page.loading;
  const handleExport = async () => {
    try {
      const dataToExport = (await TransactionRepo.list(filter)).map(tx => ({
        'Tanggal': format(parseISO(tx.created_at), 'dd/MM/yyyy HH:mm'),
        'Produk': tx.product_name,
        'Tipe': tx.type,
        'Jumlah': tx.signed_delta ?? tx.qty,
        'Satuan': tx.calculation_type === 'SIZE' ? 'Pasang' : 'Pcs',
        'Stok Setelah': tx.current_stock_snapshot,
        'User': tx.username,
        'Catatan': tx.note || '-',
      }));

      await exportToExcel(dataToExport, `transaksi_${format(new Date(), 'yyyyMMdd')}`);
    } catch (error) { alert(String(error)); }
  };

  const getTypeBadgeClass = (type: TransactionType) => {
    switch (type) {
      case 'IN':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'OUT':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'ADJUSTMENT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 text-purple-600" />
            Riwayat Transaksi
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {page.total} transaksi ditemukan
          </p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search Bar */}
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>Cari</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari produk, user, catatan..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Akhir</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipe Transaksi</Label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as TransactionType | '')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Semua</option>
                <option value="IN">Masuk (IN)</option>
                <option value="OUT">Keluar (OUT)</option>
                <option value="ADJUSTMENT">Penyesuaian</option>
              </select>
            </div>
            <Button onClick={handleFilter} disabled={isLoading}>
              <Filter className="mr-2 h-4 w-4" />
              Terapkan Filter
            </Button>
          </div>
          <ProductFilterBar onFilterChange={setProductFilter} className="mt-3" />
        </CardContent>
      </Card>

      <PageControls {...page} />
      {/* Transaction List */}
      <Card>
        <CardContent className="p-0">
          <VirtualTable
            data={filteredTransactions}
            columns={[
              { key: 'created_at', header: 'Tanggal', width: 140, render: (_, row) => format(parseISO((row as TransactionWithProduct).created_at), 'dd/MM/yyyy HH:mm') },
              { key: 'product_name', header: 'Nama Produk', width: 200 },
              { key: 'type', header: 'Tipe', width: 100, render: (v, row) => (
                <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeClass((row as TransactionWithProduct).type)}`}>
                  {String(v)}
                </span>
              )},
              { key: 'qty', header: 'Jumlah', width: 100, render: (_, row) => {
                const tx = row as TransactionWithProduct;
                const amount = tx.signed_delta ?? tx.qty;
                const decrease = tx.type === 'OUT' || amount < 0;
                return (
                  <span className={decrease ? 'text-red-600' : 'text-foreground'}>
                    {amount} {tx.calculation_type === 'SIZE' ? 'Pasang' : 'Pcs'}
                  </span>
                );
              }},
              { key: 'current_stock_snapshot', header: 'Stok Setelah', width: 100 },
              { key: 'note', header: 'Penanggung Jawab / Catatan', width: 250, render: (v) => String(v || '-') },
            ]}
            emptyMessage="Tidak ada transaksi ditemukan"
          />
        </CardContent>
      </Card>
    </div>
  );
}
