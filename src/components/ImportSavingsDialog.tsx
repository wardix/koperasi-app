'use client';

import { useState, useCallback, useMemo } from 'react';
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
import {
  parseSavingsImportFile,
  ParsedSavingsImportRow,
} from '../utils/importSavingsUtils';
import { formatRp } from '../utils/format';
import { exportToExcel } from '../utils/exportUtils';
import { useApiAction } from '../hooks/useApiAction';
import { api } from '../services/api';
import { apiFetch } from '../config';

interface ImportSavingsDialogContentProps {
  onClose: () => void;
  onSuccess: () => void;
  membersWithoutPokok?: Array<{ name: string; nik?: string | null }>;
}

export function ImportSavingsDialogContent({
  onClose,
  onSuccess,
  membersWithoutPokok = [],
}: ImportSavingsDialogContentProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedSavingsImportRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const apiAction = useApiAction();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFileName(selectedFile.name);
    setErrorMsg(null);
    setResultMsg(null);
    setIsParsing(true);

    try {
      const parsedRows = await parseSavingsImportFile(selectedFile);
      setRows(parsedRows);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membaca file Excel/CSV');
      setRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);
  const totalAmount = validRows.reduce((sum, r) => sum + r.amount, 0);

  const handleImport = useCallback(async () => {
    if (validRows.length === 0) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setResultMsg(null);

    try {
      const payload = {
        items: validRows.map((r) => ({
          nik: r.nik,
          savingsType: r.savingsType,
          amount: r.amount,
          transactionDate: r.transactionDate,
        })),
      };

      const res = await apiFetch('/api/v1/savings/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memproses import simpanan');
      }

      setResultMsg(`Berhasil mengimpor ${data.data?.processedCount ?? validRows.length} data simpanan!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan server saat memproses import');
    } finally {
      setIsSubmitting(false);
    }
  }, [validRows, onSuccess, onClose]);

  return (
    <Layout
      header={
        <DialogHeader
          title="Import Mutasi Simpanan (CSV NIK)"
          subtitle="Input pembayaran simpanan secara massal menggunakan file CSV berbasis NIK"
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            {/* Download Template Section */}
            <VStack
              gap={2}
              style={{
                padding: 'var(--spacing-3, 12px)',
                borderRadius: '8px',
                backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                border: '1px solid var(--color-border-primary, #e5e7eb)',
              }}
            >
              <Heading level={4}>1. Unduh Template Excel</Heading>
              <Text type="supporting" color="secondary">
                Format kolom: <code>nik, nama, jenis_simpanan, nominal, tanggal</code>.
                Unduh template berisi seluruh anggota koperasi untuk simpanan wajib (Rp 50.000).
              </Text>
              <HStack gap={2}>
                <Button
                  type="button"
                  label="Template Excel Simpanan Wajib"
                  variant="secondary"
                  onClick={() => {
                    apiAction.execute(
                      () => api.get<any>('/api/members?all=true'),
                      {
                        successMsg: 'Template berhasil diunduh',
                        errorMsg: 'Gagal mengambil data anggota',
                        onSuccess: (res) => {
                          const allMembers = res.data || [];
                          const columns = [
                            { header: 'nik', key: 'nik' },
                            { header: 'nama', key: 'name' },
                            { header: 'jenis_simpanan', key: 'jenis', render: () => 'wajib' },
                            { header: 'nominal', key: 'nominal', render: () => 50000 },
                            { header: 'tanggal', key: 'tanggal', render: () => new Date().toISOString().split('T')[0] }
                          ];
                          exportToExcel(allMembers, columns, `Template_Import_Simpanan_${new Date().toISOString().split('T')[0]}`);
                        }
                      }
                    );
                  }}
                />
              </HStack>
            </VStack>

            {/* File Upload Section */}
            <VStack gap={2}>
              <Heading level={4}>2. Pilih File Excel / CSV</Heading>
              <input
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                disabled={isParsing || isSubmitting}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-primary, #ccc)',
                  width: '100%',
                }}
              />
              {fileName && (
                <Text type="supporting" color="secondary">
                  File terpilih: <strong>{fileName}</strong>
                </Text>
              )}
            </VStack>

            {/* Messages */}
            {errorMsg && (
              <Text type="supporting" style={{ color: 'var(--color-text-critical, #dc2626)', fontWeight: 600 }}>
                ⚠️ {errorMsg}
              </Text>
            )}
            {resultMsg && (
              <Text type="supporting" style={{ color: 'var(--color-text-success, #16a34a)', fontWeight: 600 }}>
                ✅ {resultMsg}
              </Text>
            )}

            {/* Preview Section */}
            {rows.length > 0 && (
              <VStack gap={3}>
                <HStack hAlign="space-between" vAlign="center">
                  <Heading level={4}>3. Pratinjau Data ({rows.length} baris)</Heading>
                  <HStack gap={2}>
                    <Text type="supporting" style={{ color: 'var(--color-text-success, green)' }}>
                      Valid: {validRows.length}
                    </Text>
                    {invalidRows.length > 0 && (
                      <Text type="supporting" style={{ color: 'var(--color-text-critical, red)' }}>
                        Error: {invalidRows.length}
                      </Text>
                    )}
                  </HStack>
                </HStack>

                <Text type="supporting">
                  Total Nominal Setoran Valid: <strong>{formatRp(totalAmount)}</strong>
                </Text>

                <div
                  style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border-primary, #e5e7eb)',
                    borderRadius: '6px',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>NIK</th>
                        <th style={{ padding: '8px' }}>Nama</th>
                        <th style={{ padding: '8px' }}>Jenis</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Nominal</th>
                        <th style={{ padding: '8px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr
                          key={i}
                          style={{
                            borderTop: '1px solid #e5e7eb',
                            backgroundColor: r.isValid ? 'transparent' : '#fef2f2',
                          }}
                        >
                          <td style={{ padding: '8px', fontFamily: 'monospace' }}>{r.nik}</td>
                          <td style={{ padding: '8px' }}>{r.memberName || '-'}</td>
                          <td style={{ padding: '8px', textTransform: 'capitalize' }}>{r.savingsType}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{formatRp(r.amount)}</td>
                          <td style={{ padding: '8px' }}>
                            {r.isValid ? (
                              <span style={{ color: '#16a34a', fontWeight: 600 }}>Siap Import</span>
                            ) : (
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>{r.error}</span>
                            )}
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
              label={isSubmitting ? 'Memproses...' : `Import ${validRows.length} Data`}
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
