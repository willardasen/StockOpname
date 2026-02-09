import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: number; // Used as min-width
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number; // Used as estimated height
  className?: string;
  emptyMessage?: string;
  highlightLowStock?: boolean;
}

export function VirtualTable<T extends { id: number; stock?: number; min_stock?: number }>({
  data,
  columns,
  rowHeight = 48,
  className,
  emptyMessage = 'Tidak ada data',
  highlightLowStock = false,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
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

  if (data.length === 0) {
    return (
      <div className={cn('border rounded-lg overflow-hidden', className)}>
        {/* Header */}
        <div 
          className="flex bg-[#435585] text-white font-medium text-sm border-b sticky top-0 z-10"
          style={{ minWidth: 0 }}
        >
          {columns.map((col) => (
            <div
              key={String(col.key)}
              className={cn(
                'px-4 py-3 flex-1',
                col.align === 'right' && 'text-right',
                col.align === 'center' && 'text-center'
              )}
              style={{ minWidth: col.width || 100 }}
            >
              {col.header}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center h-48 text-gray-500 bg-white">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const minTotalWidth = columns.reduce((sum, col) => sum + (col.width || 100), 0);

  return (
    <div className={cn('border rounded-lg overflow-hidden flex flex-col', className)}>
      {/* Header */}
      <div 
        className="flex bg-[#435585] text-white font-medium text-sm border-b sticky top-0 z-10"
        style={{ minWidth: minTotalWidth }}
      >
        {columns.map((col) => (
          <div
            key={String(col.key)}
            className={cn(
              'px-4 py-3 flex-1',
              col.align === 'right' && 'text-right',
              col.align === 'center' && 'text-center'
            )}
            style={{ minWidth: col.width || 100 }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: 'calc(100vh - 300px)', maxHeight: '600px' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
            minWidth: minTotalWidth,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index];
            const isLowStock = highlightLowStock && 
              row.stock !== undefined && 
              row.min_stock !== undefined && 
              row.stock <= row.min_stock;

            return (
              <div
                key={row.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={cn(
                  'flex absolute w-full border-b text-sm max-sm:text-xs hover:bg-gray-50 transition-colors',
                  isLowStock && 'bg-orange-100 dark:bg-orange-900/20'
                )}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columns.map((col) => {
                  const value = getValue(row, col.key);
                  return (
                    <div
                      key={String(col.key)}
                      className={cn(
                        'px-4 py-3 flex-1 flex items-start',
                        col.align === 'right' && 'justify-end',
                        col.align === 'center' && 'justify-center',
                        !col.render && 'whitespace-normal break-words'
                      )}
                      style={{ minWidth: col.width || 100 }}
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
