import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LayoutDashboard, 
  Package, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useProductStore, useTransactionStore } from '@/stores';

// Helper to format number with Indonesian locale (dots for thousands)
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('id-ID').format(num);
};

export function Dashboard() {
  const { 
    totalCount, 
    lowStockProducts, 
    loadStats, 
    loadLowStockProducts 
  } = useProductStore();
  
  const { 
    recentTransactions, 
    loadRecentTransactions 
  } = useTransactionStore();

  useEffect(() => {
    loadStats();
    loadLowStockProducts();
    loadRecentTransactions(5);
  }, [loadStats, loadLowStockProducts, loadRecentTransactions]);

  const stats = [
    {
      title: 'Total Produk',
      value: formatNumber(totalCount),
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    {
      title: 'Stok Menipis',
      value: formatNumber(lowStockProducts.length),
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30'
    }
  ];


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" />
          Dashboard
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Ringkasan data stok dan transaksi
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Transactions & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transaksi Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Belum ada transaksi</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-200">
                    <div className="flex items-center gap-3">
                      {tx.type === 'IN' ? (
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <ArrowDownRight className="h-4 w-4 text-green-600" />
                        </div>
                      ) : tx.type === 'OUT' ? (
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <ArrowUpRight className="h-4 w-4 text-red-600" />
                        </div>
                      ) : (
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Package className="h-4 w-4 text-blue-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{tx.product_name}</p>
                        <p className="text-xs text-gray-500">{tx.type} • {tx.qty} pcs</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-orange-600">Peringatan Stok Menipis</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Semua stok aman</p>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.slice(0, 5).map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.brand} {product.brand_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-600">{product.stock}</p>
                      <p className="text-xs text-gray-500">Min: {product.min_stock}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
