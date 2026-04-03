import { memo, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VirtualTable, ProductFilterBar, ProductFilter } from '@/components/common';
import { Search, Filter, RotateCcw, Upload, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { format } from 'date-fns';
import { TransactionWithProduct } from '@/types/database';

// Helper: Format number with thousands separator (dots)
const formatNumber = (num: number | string | undefined): string => {
    if (num === undefined || num === null || num === '') return '';
    const cleanNum = num.toString().replace(/\D/g, '');
    return new Intl.NumberFormat('id-ID').format(Number(cleanNum));
};

const ITEMS_PER_PAGE = 25;

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
    onEdit: (transaction: TransactionWithProduct) => void;
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
    onEdit,
    onDelete,
}: TransactionHistoryTableProps) => {
    const isStockIn = type === 'IN';
    const qtyColor = isStockIn ? 'text-green-600' : 'text-orange-600';

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);

    // Calculate paginated data
    const totalItems = data.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    // Reset to page 1 when data changes (e.g., filter applied)
    const dataKey = useMemo(() => data.map(d => d.id).join(','), [data]);
    useMemo(() => {
        setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataKey]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [data, currentPage]);

    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

    // Generate visible page numbers
    const getPageNumbers = () => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

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
                data={paginatedData}
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
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => onEdit(row as TransactionWithProduct)}
                                >
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
                emptyMessage="Belum ada data transaksi"
            />

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                        Menampilkan <span className="font-medium">{startItem}</span> - <span className="font-medium">{endItem}</span> dari <span className="font-medium">{formatNumber(totalItems)}</span> transaksi
                    </p>
                    <div className="flex items-center gap-1">
                        {/* First page */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            title="Halaman Pertama"
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        {/* Previous page */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            title="Halaman Sebelumnya"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        {/* Page numbers */}
                        {getPageNumbers().map((page, idx) =>
                            page === '...' ? (
                                <span key={`dots-${idx}`} className="px-2 text-muted-foreground text-sm">…</span>
                            ) : (
                                <Button
                                    key={page}
                                    variant={currentPage === page ? 'default' : 'outline'}
                                    size="icon"
                                    className={`h-8 w-8 text-sm ${currentPage === page ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                                    onClick={() => setCurrentPage(page as number)}
                                >
                                    {page}
                                </Button>
                            )
                        )}

                        {/* Next page */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            title="Halaman Selanjutnya"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        {/* Last page */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            title="Halaman Terakhir"
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
});

StockTransactionTable.displayName = 'StockTransactionTable';
