import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';
import type { Product } from '../../types/database';

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: number;
  render?: (value: unknown, row: T) => React.ReactNode;
  adminOnly?: boolean; // Hide from staff
}

interface VirtualTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  isAdmin?: boolean;
  rowHeight?: number;
  className?: string;
  emptyMessage?: string;
  highlightLowStock?: boolean;
}

export function VirtualTable<T extends { id: number; stock?: number; min_stock?: number }>({
  data,
  columns,
  onRowClick,
  isAdmin = false,
  rowHeight = 48,
  className,
  emptyMessage = 'Tidak ada data',
  highlightLowStock = false,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Filter columns based on admin status
  const visibleColumns = columns.filter(col => !col.adminOnly || isAdmin);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const getValue = useCallback((row: T, key: keyof T | string): unknown => {
    if (typeof key === 'string' && key.includes('.')) {
      const keys = key.split('.');
      let value: unknown = row;
      for (const k of keys) {
        value = (value as Record<string, unknown>)?.[k];
      }
      return value;
    }
    return row[key as keyof T];
  }, []);

  const isLowStock = useCallback((row: T): boolean => {
    if (!highlightLowStock) return false;
    const product = row as unknown as Product;
    return product.stock !== undefined && 
           product.min_stock !== undefined && 
           product.stock <= product.min_stock;
  }, [highlightLowStock]);

  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64 text-gray-500", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="flex bg-gray-100 dark:bg-gray-800 border-b font-semibold">
        {visibleColumns.map((col) => (
          <div
            key={String(col.key)}
            className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300"
            style={{ width: col.width || 150, flexShrink: 0 }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: `calc(100vh - 300px)`, maxHeight: '600px' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index];
            const lowStock = isLowStock(row);

            return (
              <div
                key={row.id}
                className={cn(
                  "absolute top-0 left-0 w-full flex border-b hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors",
                  lowStock && "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => onRowClick?.(row)}
              >
                {visibleColumns.map((col) => {
                  const value = getValue(row, col.key);
                  return (
                    <div
                      key={String(col.key)}
                      className={cn(
                        "px-4 py-3 text-sm flex items-center",
                        lowStock && "text-red-700 dark:text-red-400"
                      )}
                      style={{ width: col.width || 150, flexShrink: 0 }}
                    >
                      {col.render ? col.render(value, row) : String(value ?? '-')}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
