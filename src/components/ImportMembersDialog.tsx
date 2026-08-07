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
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Icon } from '@astryxdesign/core/Icon';

// CSV columns: nik, nama, email, phone, tanggal_bergabung,
//              simpanan_pokok, simpanan_wajib, simpanan_sukarela

type ParsedRow = {
  raw: Record<string, string>;
  nik: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  joinDate: string;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
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

function parseMemberImportFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string).replace(/^\uFEFF/, ''); // strip BOM
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) throw new Error('File kosong atau hanya berisi header');

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
        const rows: ParsedRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const vals = parseCsvLine(lines[i]);
          const raw: Record<string, string> = {};
          headers.forEach((h, idx) => { raw[h] = vals[idx] ?? ''; });

          const name = (raw['nama'] || raw['name'] || '').trim();
          const nik = (raw['nik'] || '').trim();
          const email = (raw['email'] || '').trim();
          const phone = (raw['phone'] || raw['telepon'] || raw['hp'] || '').trim();
          const address = (raw['alamat'] || raw['address'] || '').trim();
          const joinDate = (raw['tanggal_bergabung'] || raw['join_date'] || '').trim();
          const simpananPokok = parseFloat((raw['simpanan_pokok'] || '0').replace(/[^0-9.-]/g, '')) || 0;
          const simpananWajib = parseFloat((raw['simpanan_wajib'] || '0').replace(/[^0-9.-]/g, '')) || 0;
          const simpananSukarela = parseFloat((raw['simpanan_sukarela'] || '0').replace(/[^0-9.-]/g, '')) || 0;

          let isValid = true;
          let error: string | undefined;

          if (!name) {
            isValid = false;
            error = 'Nama wajib diisi';
          } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            isValid = false;
            error = 'Format email tidak valid';
          } else if (joinDate && !/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) {
            isValid = false;
            error = 'Format tanggal harus YYYY-MM-DD';
          }

          rows.push({ raw, nik, name, email, phone, address, joinDate, simpananPokok, simpananWajib, simpananSukarela, isValid, error });
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

export function ImportMembersDialogContent({ onClose, onSuccess }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ index: number; identifier: string; message: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter(r => r.isValid);
  const invalidRows = rows.filter(r => !r.isValid);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);
    setResultMsg(null);
    setImportErrors([]);
    setIsParsing(true);
    try {
      const parsed = await parseMemberImportFile(file);
      setRows(parsed);
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
      'nik,nama,email,phone,tanggal_bergabung,simpanan_pokok,simpanan_wajib,simpanan_sukarela',
      `3171012345670001,Budi Santoso,budi@email.com,08123456789,${today},1000000,500000,0`,
      `3171012345670002,Siti Rahma,siti@email.com,08987654321,${today},1000000,500000,250000`,
    ];
    const csvText = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Template_Import_Anggota.csv';
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
          nik: r.nik || null,
          name: r.name,
          email: r.email || null,
          phone: r.phone || null,
          address: r.address || null,
          joinDate: r.joinDate || null,
          simpananPokok: r.simpananPokok,
          simpananWajib: r.simpananWajib,
          simpananSukarela: r.simpananSukarela,
        })),
      };

      const res = await apiFetch('/api/v1/members/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gagal memproses import');

      const result = data.data;
      setResultMsg(`Berhasil mengimpor ${result.processedCount} anggota${result.failedCount > 0 ? `, ${result.failedCount} gagal` : '!'}`);
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
          title="Import Data Anggota (CSV)"
          subtitle="Import anggota baru secara massal menggunakan file CSV"
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            {/* Step 1: Download Template */}
            <VStack gap={2} style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
              <Heading level={4}>1. Unduh Template CSV</Heading>
              <Text type="supporting" color="secondary">
                Format kolom: <code>nik, nama, email, phone, tanggal_bergabung, simpanan_pokok, simpanan_wajib, simpanan_sukarela</code>
              </Text>
              <Button
                label="Unduh Template CSV"
                variant="secondary"
                icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                onClick={handleDownloadTemplate}
              />
            </VStack>

            {/* Step 2: Upload File */}
            <VStack gap={2}>
              <Heading level={4}>2. Pilih File CSV</Heading>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={isParsing || isSubmitting}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border-primary)', width: '100%' }}
              />
              {fileName && <Text type="supporting" color="secondary">File terpilih: <strong>{fileName}</strong></Text>}
            </VStack>

            {/* Messages */}
            {errorMsg && <Text type="supporting" color="critical" style={{ fontWeight: 600 }}>⚠️ {errorMsg}</Text>}
            {resultMsg && <Text type="supporting" color="success" style={{ fontWeight: 600 }}>✅ {resultMsg}</Text>}
            {importErrors.length > 0 && (
              <VStack gap={1} style={{ padding: '8px', backgroundColor: 'var(--color-critical-50, #fef2f2)', borderRadius: '6px' }}>
                <Text type="supporting" style={{ fontWeight: 600 }}>Baris yang gagal diimpor:</Text>
                {importErrors.map((e, i) => (
                  <Text key={i} type="supporting" color="critical">• {e.identifier}: {e.message}</Text>
                ))}
              </VStack>
            )}

            {/* Step 3: Preview */}
            {rows.length > 0 && (
              <VStack gap={3}>
                <HStack hAlign="space-between" vAlign="center">
                  <Heading level={4}>3. Pratinjau Data ({rows.length} baris)</Heading>
                  <HStack gap={2}>
                    <Text type="supporting" color="success">Siap: {validRows.length}</Text>
                    {invalidRows.length > 0 && <Text type="supporting" color="critical">Error: {invalidRows.length}</Text>}
                  </HStack>
                </HStack>
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--color-border-primary)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-background-subtle)', textAlign: 'left', position: 'sticky', top: 0 }}>
                        {['NIK', 'Nama', 'Email', 'No. HP', 'Status'].map(h => (
                          <th key={h} style={{ padding: '8px', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--color-border-primary)', backgroundColor: r.isValid ? 'transparent' : 'var(--color-critical-50, #fef2f2)' }}>
                          <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>{r.nik || '-'}</td>
                          <td style={{ padding: '8px' }}>{r.name}</td>
                          <td style={{ padding: '8px' }}>{r.email || '-'}</td>
                          <td style={{ padding: '8px' }}>{r.phone || '-'}</td>
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
              label={isSubmitting ? 'Memproses...' : `Import ${validRows.length} Anggota`}
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
