import * as XLSX from 'xlsx';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

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
        // Generate default filename with extension
        const defaultFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

        // Show save dialog
        const filePath = await save({
            filters: [{
                name: 'Excel Files',
                extensions: ['xlsx']
            }],
            defaultPath: defaultFilename
        });

        // User cancelled
        if (!filePath) {
            return;
        }

        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Auto-fit column widths based on content
        const columnWidths = Object.keys(data[0] || {}).map((key) => {
            const maxLength = Math.max(
                key.length,
                ...data.map(row => String(row[key] || '').length)
            );
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

        // Write file using Tauri's fs plugin
        await writeFile(filePath, new Uint8Array(excelBuffer));

        alert('Export berhasil disimpan!');
    } catch (error) {
        console.error('Export failed:', error);
        alert(`Export gagal: ${error}`);
    }
}
