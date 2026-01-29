import * as XLSX from 'xlsx';

/**
 * Export data to Excel file
 */
export async function exportToExcel<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    sheetName: string = 'Sheet1'
): Promise<void> {
    if (data.length === 0) {
        console.warn('No data to export');
        return;
    }

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate filename with extension
    const fullFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

    // Write and download
    XLSX.writeFile(workbook, fullFilename);
}
