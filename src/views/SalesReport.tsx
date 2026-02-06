import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp, Calendar, Trophy, Package, Medal } from 'lucide-react';
import { TransactionRepo } from '@/repositories';
import { format, startOfMonth, subMonths } from 'date-fns';

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

  // Quick month selection
  const quickMonths = useMemo(() => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const date = subMonths(startOfMonth(new Date()), i);
      months.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMM yyyy')
      });
    }
    return months;
  }, []);

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
          <div className="rounded-md border-t overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#435585] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium w-16 text-center">Rank</th>
                  <th className="px-4 py-3 font-medium">Nama Produk</th>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium">Tipe</th>
                  <th className="px-4 py-3 font-medium">No Tipe</th>
                  <th className="px-4 py-3 font-medium">Warna</th>
                  <th className="px-4 py-3 font-medium text-right">Stok Masuk</th>
                  <th className="px-4 py-3 font-medium text-right">Stok Keluar</th>
                  <th className="px-4 py-3 font-medium text-right">Transaksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Memuat data...
                    </td>
                  </tr>
                ) : salesData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Tidak ada data penjualan untuk periode ini
                    </td>
                  </tr>
                ) : (
                  salesData.map((item, index) => (
                    <tr key={item.product_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-center">
                        {index < 3 ? (
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${
                            index === 0 ? 'bg-amber-500' :
                            index === 1 ? 'bg-gray-400' :
                            'bg-amber-700'
                          }`}>
                            {index + 1}
                          </span>
                        ) : (
                          <span className="text-gray-500">{index + 1}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{item.product_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.brand || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.brand_type || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.type_number || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.color || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        {item.total_qty_in > 0 ? `+${formatNumber(item.total_qty_in)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-purple-600">
                        {formatNumber(item.total_qty_out)} Pcs
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatNumber(item.transaction_count)}x
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
