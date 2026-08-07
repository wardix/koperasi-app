'use client';

import { useState } from 'react';
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

// CSV columns: loan_id, cicilan_ke, tanggal_jatuh_tempo, pokok, bunga

type ParsedRow = {
  loan_id: string;
  cicilan_ke: number;
  tanggal_jatuh_tempo: string;
  pokok: number;
  bunga: number;
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

function parseScheduleImportFile(file: File): Promise<ParsedRow[]> {
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

          const loan_id = (raw['loan_id'] || '').trim();
          const cicilan_ke = parseInt((raw['cicilan_ke'] || '0').replace(/[^0-9]/g, ''), 10) || 0;
          const tanggal_jatuh_tempo = (raw['tanggal_jatuh_tempo'] || '').trim();
          const pokok = parseFloat((raw['pokok'] || '0').replace(/[^0-9.-]/g, '')) || 0;
          const bunga = parseFloat((raw['bunga'] || '0').replace(/[^0-9.-]/g, '')) || 0;

          let isValid = true;
          let error: string | undefined;

          if (!loan_id) { isValid = false; error = 'ID Pinjaman wajib diisi'; }
          else if (cicilan_ke <= 0) { isValid = false; error = 'Cicilan ke- harus > 0'; }
          else if (!tanggal_jatuh_tempo || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal_jatuh_tempo)) {
            isValid = false; error = 'Format tanggal harus YYYY-MM-DD';
          }
          else if (pokok < 0) { isValid = false; error = 'Pokok tidak boleh negatif'; }
          else if (bunga < 0) { isValid = false; error = 'Bunga tidak boleh negatif'; }

          rows.push({ loan_id, cicilan_ke, tanggal_jatuh_tempo, pokok, bunga, isValid, error });
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

export function ImportSchedulesDialogContent({ onClose, onSuccess }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ identifier: string; message: string }>>([]);

  const validRows = rows.filter(r => r.isValid);
  const invalidRows = rows.filter(r => !r.isValid);
  const totalPokok = validRows.reduce((s, r) => s + r.pokok, 0);
  const uniqueLoans = new Set(validRows.map(r => r.loan_id)).size;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);
    setResultMsg(null);
    setImportErrors([]);
    setIsParsing(true);
    try {
      setRows(await parseScheduleImportFile(file));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membaca file CSV');
      setRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const a = document.createElement('a');
    a.href = '/api/v1/loans/schedules/template-csv';
    a.download = 'Template_Import_Jadwal.csv';
    a.click();
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
          loan_id: r.loan_id,
          cicilan_ke: r.cicilan_ke,
          tanggal_jatuh_tempo: r.tanggal_jatuh_tempo,
          pokok: r.pokok,
          bunga: r.bunga,
        })),
      };

      const res = await apiFetch('/api/v1/loans/schedules/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gagal memproses import');

      const result = data.data;
      setResultMsg(`Berhasil mengimpor ${result.processedCount} jadwal${result.failedCount > 0 ? `, ${result.failedCount} pinjaman gagal` : '!'}`);
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
          title="Import Jadwal Angsuran (CSV)"
          subtitle="Timpa jadwal angsuran lama dengan jadwal kustom"
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
                Kolom: <code>loan_id, cicilan_ke, tanggal_jatuh_tempo, pokok, bunga</code>
              </Text>
              <Text type="supporting" color="secondary">
                Total <strong>pokok</strong> dari setiap <code>loan_id</code> harus sama persis dengan total plafon pinjaman. Jadwal lama akan dihapus dan digantikan dengan yang baru, namun status pembayaran yang sudah lunas akan dihitung ulang secara otomatis.
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
                <Text type="supporting" style={{ fontWeight: 600 }}>Grup yang gagal:</Text>
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
                <Text type="supporting">
                  Mendeteksi <strong>{uniqueLoans} pinjaman</strong> dengan total pokok <strong>{formatRp(totalPokok)}</strong>
                </Text>
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--color-border-primary)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-background-subtle)', textAlign: 'left', position: 'sticky', top: 0 }}>
                        {['Loan ID', 'Ke-', 'Jatuh Tempo', 'Pokok', 'Bunga', 'Status'].map(h => (
                          <th key={h} style={{ padding: '8px', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--color-border-primary)', backgroundColor: r.isValid ? 'transparent' : 'var(--color-critical-50, #fef2f2)' }}>
                          <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>{r.loan_id.substring(0, 8)}...</td>
                          <td style={{ padding: '8px' }}>{r.cicilan_ke}</td>
                          <td style={{ padding: '8px' }}>{r.tanggal_jatuh_tempo}</td>
                          <td style={{ padding: '8px' }}>{formatRp(r.pokok)}</td>
                          <td style={{ padding: '8px' }}>{formatRp(r.bunga)}</td>
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
              label={isSubmitting ? 'Memproses...' : `Import ${validRows.length} Jadwal`}
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
