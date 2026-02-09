import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { VirtualTable } from '@/components/common';
import { TrendingUp, Calendar, Trophy, Package, Medal } from 'lucide-react';
import { TransactionRepo } from '@/repositories';
import { format } from 'date-fns';

// Helper: Format number with thousands separator
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('id-ID').format(num);
};

interface SalesData {
  product_id: number;
  product_name: string;
  brand: string;
  brand_type: string;
  type_number: string;
  color: string;
  total_qty_out: number;
  total_qty_in: number;
  transaction_count: number;
}

export function SalesReport() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load sales data for the selected month
  const loadSalesData = async (yearMonth: string) => {
    setIsLoading(true);
    try {
      const data = await TransactionRepo.getMonthlySalesReport(yearMonth);
      setSalesData(data);
    } catch (error) {
      console.error('Failed to load sales data:', error);
      setSalesData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSalesData(selectedMonth);
  }, [selectedMonth]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (salesData.length === 0) return { totalSold: 0, totalTransactions: 0, topProduct: null };
    
    const totalSold = salesData.reduce((sum, item) => sum + item.total_qty_out, 0);
    const totalTransactions = salesData.reduce((sum, item) => sum + item.transaction_count, 0);
    const topProduct = salesData[0]; // Already sorted by total_qty_out DESC
    
    return { totalSold, totalTransactions, topProduct };
  }, [salesData]);

  // Get month display name
  const monthDisplayName = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, 'MMMM yyyy');
  }, [selectedMonth]);

 

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-purple-600" />
          Laporan Penjualan
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Analisis produk terlaris berdasarkan stok keluar per bulan
        </p>
      </div>

      {/* Month Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Pilih Periode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-auto"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Total Terjual</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(summaryStats.totalSold)} Pcs</p>
                <p className="text-purple-200 text-xs mt-1">{monthDisplayName}</p>
              </div>
              <Package className="h-12 w-12 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Jumlah Transaksi</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(summaryStats.totalTransactions)}</p>
                <p className="text-blue-200 text-xs mt-1">{salesData.length} produk berbeda</p>
              </div>
              <TrendingUp className="h-12 w-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Produk Terlaris</p>
                <p className="text-lg font-bold mt-1 truncate max-w-[180px]" title={summaryStats.topProduct?.product_name || '-'}>
                  {summaryStats.topProduct?.product_name || '-'}
                </p>
                <p className="text-amber-200 text-xs mt-1">
                  {summaryStats.topProduct ? `${formatNumber(summaryStats.topProduct.total_qty_out)} Pcs` : '-'}
                </p>
              </div>
              <Trophy className="h-12 w-12 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Medal className="h-5 w-5 text-amber-500" />
            Ranking Penjualan - {monthDisplayName}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              Memuat data...
            </div>
          ) : (
            <VirtualTable
              data={salesData.map((item, index) => ({ ...item, id: item.product_id, rank: index + 1 }))}
              columns={[
                { key: 'rank', header: 'Rank', width: 70, align: 'center' as const, render: (_, row) => {
                  const index = (row as SalesData & { rank: number }).rank - 1;
                  return index < 3 ? (
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${
                      index === 0 ? 'bg-amber-500' :
                      index === 1 ? 'bg-gray-400' :
                      'bg-amber-700'
                    }`}>
                      {index + 1}
                    </span>
                  ) : (
                    <span className="text-gray-500">{index + 1}</span>
                  );
                }},
                { key: 'product_name', header: 'Nama Produk', width: 250 },
                { key: 'brand', header: 'Brand', width: 120, render: (v) => String(v || '-') },
                { key: 'brand_type', header: 'Tipe', width: 80, render: (v) => String(v || '-') },
                { key: 'type_number', header: 'No Tipe', width: 80, render: (v) => String(v || '-') },
                { key: 'color', header: 'Warna', width: 80, render: (v) => String(v || '-') },
                { key: 'total_qty_in', header: 'Stok Masuk', width: 100, align: 'right' as const, render: (v) => (
                  <span className="font-bold text-green-600">
                    {Number(v) > 0 ? `+${formatNumber(Number(v))}` : '-'}
                  </span>
                )},
                { key: 'total_qty_out', header: 'Stok Keluar', width: 100, align: 'right' as const, render: (v) => (
                  <span className="font-bold text-purple-600">{formatNumber(Number(v))} Pcs</span>
                )},
                { key: 'transaction_count', header: 'Transaksi', width: 90, align: 'right' as const, render: (v) => (
                  <span className="text-muted-foreground">{formatNumber(Number(v))}x</span>
                )},
              ]}
              emptyMessage="Tidak ada data penjualan untuk periode ini"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
