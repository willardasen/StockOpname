import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VirtualTable, ProductFilterBar, ProductFilter } from '@/components/common';
import { Search, Filter, RotateCcw, Upload, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { TransactionWithProduct } from '@/types/database';

// Helper: Format number with thousands separator (dots)
const formatNumber = (num: number | string | undefined): string => {
    if (num === undefined || num === null || num === '') return '';
    const cleanNum = num.toString().replace(/\D/g, '');
    return new Intl.NumberFormat('id-ID').format(Number(cleanNum));
};

interface TransactionHistoryTableProps {
    type: 'IN' | 'OUT';
    data: TransactionWithProduct[];
    tableSearch: string;
    setTableSearch: (val: string) => void;
    startDate: string;
    setStartDate: (val: string) => void;
    endDate: string;
    setEndDate: (val: string) => void;
    onFilter: () => void;
    onResetFilter: () => void;
    onProductFilterChange: (filter: ProductFilter) => void;
    onExport: () => void;
    onDelete: (id: number) => void;
}

export const StockTransactionTable = memo(({
    type,
    data,
    tableSearch,
    setTableSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    onFilter,
    onResetFilter,
    onProductFilterChange,
    onExport,
    onDelete,
}: TransactionHistoryTableProps) => {
    const isStockIn = type === 'IN';
    const qtyColor = isStockIn ? 'text-green-600' : 'text-orange-600';

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari kode atau Nama Produk..."
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        className="pl-9 bg-white text-black"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Dari:</span>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-auto h-9"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Sampai:</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-auto h-9"
                        />
                    </div>
                    <Button variant="secondary" size="sm" onClick={onFilter} title="Filter Tanggal">
                        <Filter className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={onResetFilter} title="Reset Filter">
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={onExport}>
                        <Upload className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>
            <ProductFilterBar onFilterChange={onProductFilterChange} />

            <VirtualTable
                data={data}
                columns={[
                    { key: 'created_at', header: 'Tanggal', width: 100, render: (_, row) => format(new Date((row as TransactionWithProduct).created_at), 'dd/MM/yyyy') },
                    { key: 'product_name', header: 'Nama Produk', width: 200 },
                    { key: 'brand', header: 'Brand', width: 120, render: (v) => String(v || '-') },
                    { key: 'brand_type', header: 'Tipe', width: 80, render: (v) => String(v || '-') },
                    { key: 'type_number', header: 'No Tipe', width: 80, render: (v) => String(v || '-') },
                    { key: 'color', header: 'Warna', width: 80, render: (v) => String(v || '-') },
                    { key: 'note', header: 'Penanggung Jawab/ Catatan', width: 200, render: (v, row) => String(v || (row as TransactionWithProduct).username || '-') },
                    {
                        key: 'qty', header: 'Box', width: 80, align: 'right' as const, render: (_, row) => {
                            const t = row as TransactionWithProduct;
                            return t.pcs_per_box && t.pcs_per_box > 1
                                ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(t.qty / t.pcs_per_box)
                                : (t.pcs_per_box === 1 && t.qty > 0 ? t.qty : '-');
                        }
                    },
                    {
                        key: 'qty_pcs', header: 'Jumlah (Pcs)', width: 100, align: 'right' as const, render: (_, row) => (
                            <span className={`font-medium ${qtyColor}`}>{formatNumber((row as TransactionWithProduct).qty)}</span>
                        )
                    },
                    {
                        key: 'actions', header: 'Aksi', width: 100, align: 'center' as const, render: (_, row) => (
                            <div className="flex items-center justify-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => onDelete((row as TransactionWithProduct).id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )
                    },
                ]}
                emptyMessage="Belum ada data transaksi hari ini"
            />
        </div>
    );
});

StockTransactionTable.displayName = 'StockTransactionTable';
