import { useEffect, useState } from 'react';
import { useTransactionStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VirtualTable } from '@/components/common';
import { History, Filter, Search, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel } from '@/utils/excel';
import type { TransactionType, TransactionWithProduct } from '@/types/database';

export function TransactionHistory() {
  const { transactions, loadTransactions, isLoading, getTransactionsByDateRange } = useTransactionStore();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | ''>('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Filter transactions by search keyword (client-side)
  const filteredTransactions = transactions.filter(tx => {
    if (!searchKeyword.trim()) return true;
    const keyword = searchKeyword.toLowerCase();
    return (
      tx.product_name?.toLowerCase().includes(keyword) ||
      tx.username?.toLowerCase().includes(keyword) ||
      tx.note?.toLowerCase().includes(keyword) ||
      tx.type?.toLowerCase().includes(keyword)
    );
  });

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleFilter = async () => {
    if (startDate && endDate) {
      await getTransactionsByDateRange(startDate, endDate);
    } else {
      await loadTransactions(undefined, undefined, filterType || undefined);
    }
  };

  const handleExport = () => {
    const dataToExport = transactions.map(tx => ({
      'Tanggal': format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm'),
      'Produk': tx.product_name,
      'Tipe': tx.type,
      'Jumlah': tx.qty,
      'Stok Setelah': tx.current_stock_snapshot,
      'User': tx.username,
      'Catatan': tx.note || '-',
    }));
    
    exportToExcel(dataToExport, `transaksi_${format(new Date(), 'yyyyMMdd')}`);
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
            {filteredTransactions.length} transaksi ditemukan
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
        </CardContent>
      </Card>

      {/* Transaction List */}
      <Card>
        <CardContent className="p-0">
          <VirtualTable
            data={filteredTransactions}
            columns={[
              { key: 'created_at', header: 'Tanggal', width: 140, render: (_, row) => format(new Date((row as TransactionWithProduct).created_at), 'dd/MM/yyyy HH:mm') },
              { key: 'product_name', header: 'Nama Produk', width: 200 },
              { key: 'type', header: 'Tipe', width: 100, render: (v, row) => (
                <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeClass((row as TransactionWithProduct).type)}`}>
                  {String(v)}
                </span>
              )},
              { key: 'qty', header: 'Jumlah', width: 100, render: (_, row) => {
                const tx = row as TransactionWithProduct;
                return (
                  <span className={`font-bold ${tx.qty >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.qty >= 0 ? '+' : ''}{tx.qty}
                  </span>
                );
              }},
              { key: 'current_stock_snapshot', header: 'Stok Setelah', width: 100 },
              { key: 'note', header: 'Catatan', width: 250, render: (v) => String(v || '-') },
            ]}
            emptyMessage="Tidak ada transaksi ditemukan"
          />
        </CardContent>
      </Card>
    </div>
  );
}
