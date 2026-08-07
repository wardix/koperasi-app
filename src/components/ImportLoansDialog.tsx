'use client';

import { useState, useRef } from 'react';
import { DialogHeader } from '@astryxdesign/core/Dialog';
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Text, Heading } from '@astryxdesign/core/Text';
import { apiFetch } from '../config';
import { formatRp } from '../utils/format';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Icon } from '@astryxdesign/core/Icon';

// CSV columns: nik, nama_pinjaman, jumlah, tenor, tujuan, tanggal_pinjaman, bunga

type ParsedRow = {
  nik: string;
  nama_pinjaman: string;
  jumlah: number;
  tenor: number;
  tujuan: string;
  tanggal_pinjaman: string;
  bunga: string;
  isValid: boolean;
  error?: string;
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseLoanImportFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string).replace(/^\uFEFF/, '');
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) throw new Error('File kosong atau hanya berisi header');

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
        const rows: ParsedRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const vals = parseCsvLine(lines[i]);
          const raw: Record<string, string> = {};
          headers.forEach((h, idx) => { raw[h] = vals[idx] ?? ''; });

          const nik = (raw['nik'] || '').trim();
          const nama_pinjaman = (raw['nama_pinjaman'] || '').trim();
          const jumlah = parseFloat((raw['jumlah'] || '0').replace(/[^0-9.-]/g, '')) || 0;
          const tenor = parseInt((raw['tenor'] || '0').replace(/[^0-9]/g, ''), 10) || 0;
          const tujuan = (raw['tujuan'] || '').trim();
          const tanggal_pinjaman = (raw['tanggal_pinjaman'] || '').trim();
          const bunga = (raw['bunga'] || '').trim();

          let isValid = true;
          let error: string | undefined;

          if (!nik) { isValid = false; error = 'NIK wajib diisi'; }
          else if (!nama_pinjaman) { isValid = false; error = 'Nama pinjaman wajib diisi'; }
          else if (jumlah <= 0) { isValid = false; error = 'Jumlah harus lebih dari 0'; }
          else if (tenor <= 0) { isValid = false; error = 'Tenor harus lebih dari 0'; }
          else if (!tujuan) { isValid = false; error = 'Tujuan wajib diisi'; }
          else if (tanggal_pinjaman && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal_pinjaman)) {
            isValid = false; error = 'Format tanggal harus YYYY-MM-DD';
          } else if (bunga && isNaN(parseFloat(bunga))) {
            isValid = false; error = 'Format bunga tidak valid';
          }

          rows.push({ nik, nama_pinjaman, jumlah, tenor, tujuan, tanggal_pinjaman, bunga, isValid, error });
        }

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file, 'utf-8');
  });
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportLoansDialogContent({ onClose, onSuccess }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ index: number; identifier: string; message: string }>>([]);

  const validRows = rows.filter(r => r.isValid);
  const invalidRows = rows.filter(r => !r.isValid);
  const totalAmount = validRows.reduce((s, r) => s + r.jumlah, 0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);
    setResultMsg(null);
    setImportErrors([]);
    setIsParsing(true);
    try {
      setRows(await parseLoanImportFile(file));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membaca file CSV');
      setRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadTemplate = (e: React.MouseEvent) => {
    const btn = e.currentTarget as HTMLElement;
    const today = new Date().toISOString().split('T')[0];
    const lines = [
      'nik,jumlah,tenor,bunga,tanggal_pencairan,metode,keterangan',
      `3171012345670001,5000000,12,1.5,${today},Transfer,Pinjaman modal usaha`,
      `3171012345670002,10000000,24,1.5,${today},Transfer,Biaya pendidikan`,
    ];
    const csvText = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Template_Import_Pinjaman.csv';
    link.style.display = 'none';
    link.addEventListener('click', (ev) => ev.stopPropagation());
    btn.appendChild(link);
    link.click();
    setTimeout(() => {
      if (btn.contains(link)) btn.removeChild(link);
      URL.revokeObjectURL(url);
    }, 500);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setResultMsg(null);
    setImportErrors([]);

    try {
      const payload = {
        items: validRows.map(r => ({
          nik: r.nik,
          nama_pinjaman: r.nama_pinjaman,
          jumlah: r.jumlah,
          tenor: r.tenor,
          tujuan: r.tujuan,
          tanggal_pinjaman: r.tanggal_pinjaman || null,
          bunga: r.bunga ? parseFloat(r.bunga) : null,
        })),
      };

      const res = await apiFetch('/api/v1/loans/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gagal memproses import');

      const result = data.data;
      setResultMsg(`Berhasil mengimpor ${result.processedCount} pinjaman${result.failedCount > 0 ? `, ${result.failedCount} gagal` : '!'}`);
      if (result.errors?.length > 0) setImportErrors(result.errors);

      if (result.processedCount > 0) {
        setTimeout(() => { onSuccess(); onClose(); }, result.failedCount > 0 ? 3000 : 1500);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout
      header={
        <DialogHeader
          title="Import Data Pinjaman (CSV)"
          subtitle="Import pinjaman baru secara massal — jadwal cicilan dibuat otomatis"
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            {/* Step 1 */}
            <VStack gap={2} style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
              <Heading level={4}>1. Unduh Template CSV</Heading>
              <Text type="supporting" color="secondary">
                Kolom: <code>nik, nama_pinjaman, jumlah, tenor, tujuan, tanggal_pinjaman, bunga</code>
              </Text>
              <Text type="supporting" color="secondary">
                Kolom <code>tanggal_pinjaman</code> (YYYY-MM-DD) dan <code>bunga</code> (%) bersifat opsional — jika kosong pakai bunga dari pengaturan koperasi.
              </Text>
              <Button
                label="Unduh Template CSV"
                variant="secondary"
                icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                onClick={handleDownloadTemplate}
              />
            </VStack>

            {/* Step 2 */}
            <VStack gap={2}>
              <Heading level={4}>2. Pilih File CSV</Heading>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={isParsing || isSubmitting}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border-primary)', width: '100%' }}
              />
              {fileName && <Text type="supporting" color="secondary">File: <strong>{fileName}</strong></Text>}
            </VStack>

            {/* Messages */}
            {errorMsg && <Text type="supporting" color="critical" style={{ fontWeight: 600 }}>⚠️ {errorMsg}</Text>}
            {resultMsg && <Text type="supporting" color="success" style={{ fontWeight: 600 }}>✅ {resultMsg}</Text>}
            {importErrors.length > 0 && (
              <VStack gap={1} style={{ padding: '8px', backgroundColor: 'var(--color-critical-50, #fef2f2)', borderRadius: '6px' }}>
                <Text type="supporting" style={{ fontWeight: 600 }}>Baris yang gagal:</Text>
                {importErrors.map((e, i) => (
                  <Text key={i} type="supporting" color="critical">• {e.identifier}: {e.message}</Text>
                ))}
              </VStack>
            )}

            {/* Step 3: Preview */}
            {rows.length > 0 && (
              <VStack gap={3}>
                <HStack hAlign="space-between" vAlign="center">
                  <Heading level={4}>3. Pratinjau ({rows.length} baris)</Heading>
                  <HStack gap={2}>
                    <Text type="supporting" color="success">Siap: {validRows.length}</Text>
                    {invalidRows.length > 0 && <Text type="supporting" color="critical">Error: {invalidRows.length}</Text>}
                  </HStack>
                </HStack>
                <Text type="supporting">Total Plafon Valid: <strong>{formatRp(totalAmount)}</strong></Text>
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--color-border-primary)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-background-subtle)', textAlign: 'left', position: 'sticky', top: 0 }}>
                        {['NIK', 'Nama Pinjaman', 'Jumlah', 'Tenor', 'Status'].map(h => (
                          <th key={h} style={{ padding: '8px', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--color-border-primary)', backgroundColor: r.isValid ? 'transparent' : 'var(--color-critical-50, #fef2f2)' }}>
                          <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>{r.nik}</td>
                          <td style={{ padding: '8px' }}>{r.nama_pinjaman}</td>
                          <td style={{ padding: '8px' }}>{formatRp(r.jumlah)}</td>
                          <td style={{ padding: '8px' }}>{r.tenor} bln</td>
                          <td style={{ padding: '8px' }}>
                            {r.isValid
                              ? <span style={{ color: 'var(--color-text-success)', fontWeight: 600 }}>✓ Siap</span>
                              : <span style={{ color: 'var(--color-text-critical)', fontWeight: 600 }}>✗ {r.error}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </VStack>
            )}
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label="Batal" variant="secondary" onClick={onClose} disabled={isSubmitting} />
            <Button
              label={isSubmitting ? 'Memproses...' : `Import ${validRows.length} Pinjaman`}
              variant="primary"
              onClick={handleImport}
              disabled={validRows.length === 0 || isSubmitting || isParsing}
            />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}
