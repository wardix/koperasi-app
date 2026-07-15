import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRp } from './format';

interface ExportColumn<T> {
  header: string;
  key: keyof T | string;
  render?: (item: T) => string | number;
}

export function exportToExcel<T>(data: T[], columns: ExportColumn<T>[], filename: string) {
  const rowData = data.map((item) => {
    const row: Record<string, any> = {};
    columns.forEach((col) => {
      row[col.header] = col.render ? col.render(item) : item[col.key as keyof T];
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rowData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToPDF<T>(data: T[], columns: ExportColumn<T>[], filename: string, title: string) {
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Periode: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);

  const head = [columns.map(c => c.header)];
  const body = data.map(item => 
    columns.map(col => col.render ? col.render(item) : String(item[col.key as keyof T] ?? ''))
  );

  autoTable(doc, {
    startY: 28,
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: [1, 113, 227] }, // primary color #0171E3
  });

  doc.save(`${filename}.pdf`);
}
