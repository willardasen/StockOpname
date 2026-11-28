import { invoke } from '@tauri-apps/api/core';

/**
 * Export data to Excel file using Tauri's file system
 */
export async function exportToExcel<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    sheetName: string = 'Sheet1'
): Promise<void> {
    if (data.length === 0) {
        alert('Tidak ada data untuk di-export');
        return;
    }

    try {
        // Dynamically import xlsx to save RAM on initial load
        const XLSX = await import('xlsx');

        // Generate default filename with extension
        const defaultFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Auto-fit column widths based on content
        const columnWidths = Object.keys(data[0] || {}).map((key) => {
            const maxLength = data.reduce((widest, row) => Math.max(widest, String(row[key] ?? '').length), key.length);
            return { wch: Math.min(maxLength + 2, 50) };
        });
        worksheet['!cols'] = columnWidths;

        // Create workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Write to buffer
        const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array'
        });

        // Rust opens the native save dialog and writes the workbook atomically.
        const saved = await invoke<boolean>('export_workbook', { filename: defaultFilename, bytes: Array.from(new Uint8Array(excelBuffer)) });
        if (!saved) return;

        alert('Export berhasil disimpan!');
    } catch (error) {
        console.error('Export failed:', error);
        alert(`Export gagal: ${error}`);
    }
}
