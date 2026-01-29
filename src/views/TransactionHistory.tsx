import { useEffect, useState } from 'react';
import { useTransactionStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { History, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel } from '@/utils/excel';
import type { TransactionType } from '@/types/database';

export function TransactionHistory() {
  const { transactions, loadTransactions, isLoading, getTransactionsByDateRange } = useTransactionStore();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | ''>('');

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
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
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
            {transactions.length} transaksi ditemukan
          </p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tanggal</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Produk</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tipe</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Jumlah</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Stok Setelah</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{tx.product_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeClass(tx.type)}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm font-bold ${
                      tx.qty >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.qty >= 0 ? '+' : ''}{tx.qty}
                    </td>
                    <td className="px-4 py-3 text-sm">{tx.current_stock_snapshot}</td>
                    <td className="px-4 py-3 text-sm">{tx.username}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {tx.note || '-'}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      Tidak ada transaksi ditemukan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
