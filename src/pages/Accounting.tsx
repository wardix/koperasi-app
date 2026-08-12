'use client';

import React, { useState, useEffect } from 'react';
import {
  VStack,
  HStack,
  Layout,
  LayoutContent,
  LayoutHeader,
  StackItem,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useApiAction } from '../hooks/useApiAction';
import { useA11yDialog } from '../hooks/useA11yDialog';
import { TextInput } from '@astryxdesign/core/TextInput';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Selector } from '@astryxdesign/core/Selector';
import type { AccountRow, JournalEntryRow } from '../shared/types';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/api';
import { formatRp } from '../utils/format';
import { DataStateView } from '../components/DataStateView';
import { TrashIcon, PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

// We just borrow some UI styles from expenses or loans.

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function JournalDialog({ 
  onClose, 
  onAdd, 
  accounts 
}: { 
  onClose: () => void, 
  onAdd: (data: any) => void,
  accounts: AccountRow[] 
}) {
  const [date, setDate] = useState(todayIsoDate());
  const [description, setDescription] = useState('');
  
  const [lines, setLines] = useState([{ account_id: '', debit: '', credit: '' }, { account_id: '', debit: '', credit: '' }]);

  const accountOptions = accounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }));

  const totalDebit = lines.reduce((acc, line) => acc + (parseFloat(line.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, line) => acc + (parseFloat(line.credit) || 0), 0);
  const isBalance = totalDebit === totalCredit;
  const isZero = totalDebit === 0;

  const handleSave = () => {
    if (!description || lines.some(l => !l.account_id)) {
      alert("Harap lengkapi semua field yang wajib");
      return;
    }
    if (!isBalance) {
      alert("Total Debit harus sama dengan Kredit");
      return;
    }
    if (isZero) {
      alert("Nilai tidak boleh 0");
      return;
    }
    
    onAdd({
      transaction_date: date,
      description,
      lines: lines.map(l => ({
        account_id: l.account_id,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      })).filter(l => l.debit > 0 || l.credit > 0)
    });
  };

  return (
    <VStack gap={4} style={{ padding: '24px' }}>
      <Heading level={3}>Tambah Jurnal Manual</Heading>
      <Text type="supporting">Catat transaksi manual seperti bunga bank atau setoran modal.</Text>
      
      <DateInput
        label="Tanggal"
        value={date}
        onChange={setDate}
      />
      <TextInput
        label="Deskripsi/Keterangan"
        value={description}
        onChange={setDescription}
      />

      <div style={{ marginTop: 16 }}>
        <HStack hAlign="space-between" vAlign="center" style={{ marginBottom: 8 }}>
          <Text style={{ fontWeight: 600 }}>Baris Jurnal</Text>
          <Button variant="secondary" onClick={() => setLines([...lines, { account_id: '', debit: '', credit: '' }])} style={{ padding: '4px 8px' }}>
            <PlusIcon width={16} /> Tambah Baris
          </Button>
        </HStack>
        
        {lines.map((line, idx) => (
          <HStack gap={2} key={idx} style={{ marginBottom: 8 }} vAlign="center">
            <div style={{ flex: 2 }}>
              <Selector
                options={accountOptions}
                value={line.account_id}
                onChange={(v) => {
                  const newLines = [...lines];
                  newLines[idx].account_id = v;
                  setLines(newLines);
                }}
                label={idx === 0 ? "Akun" : undefined}
              />
            </div>
            <div style={{ flex: 1 }}>
              <TextInput
                type="number"
                value={line.debit}
                onChange={(v) => {
                  const newLines = [...lines];
                  newLines[idx].debit = v;
                  setLines(newLines);
                }}
                label={idx === 0 ? "Debit" : undefined}
              />
            </div>
            <div style={{ flex: 1 }}>
              <TextInput
                type="number"
                value={line.credit}
                onChange={(v) => {
                  const newLines = [...lines];
                  newLines[idx].credit = v;
                  setLines(newLines);
                }}
                label={idx === 0 ? "Kredit" : undefined}
              />
            </div>
            <div style={{ flex: 0.2, marginTop: idx === 0 ? 24 : 0 }}>
               {lines.length > 2 && (
                 <IconButton
                   icon={<TrashIcon width={20} />}
                   label="Hapus Baris"
                   variant="secondary"
                   onClick={() => {
                     const newLines = [...lines];
                     newLines.splice(idx, 1);
                     setLines(newLines);
                   }}
                 />
               )}
            </div>
          </HStack>
        ))}
        
        <HStack gap={4} hAlign="end" style={{ marginTop: 16, padding: '8px 32px', backgroundColor: isBalance ? 'var(--color-background-success-subtle, #e6f4ea)' : 'var(--color-background-danger-subtle, #fce8e6)', borderRadius: 8 }}>
          <Text>Total Debit: <b>{formatRp(totalDebit)}</b></Text>
          <Text>Total Kredit: <b>{formatRp(totalCredit)}</b></Text>
        </HStack>
        {!isBalance && <Text color="danger" type="supporting" style={{ textAlign: 'right', marginTop: 4 }}>Jurnal belum balance (selisih {formatRp(Math.abs(totalDebit - totalCredit))})</Text>}
      </div>

      <HStack gap={2} hAlign="end" style={{ marginTop: 16 }}>
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button label="Simpan Jurnal" variant="primary" onClick={handleSave} disabled={!isBalance || isZero} />
      </HStack>
    </VStack>
  )
}

export default function Accounting() {
  const { isSuperAdmin } = useAuth();
  const dialog = useA11yDialog();
  const apiAction = useApiAction();

  const {
    items: journalRows,
    isLoading,
    isFetchingMore,
    hasMore,
    error,
    sentinelRef,
    refetch,
  } = useInfiniteScroll<JournalEntryRow & { creator_name: string; total_amount: number }>(
    '/api/accounting/journals',
    { limit: 20 }
  );

  const { data: accountsData } = useApiQuery<AccountRow[]>('/api/accounting/accounts');
  const accounts = Array.isArray(accountsData) ? accountsData : [];
  const handleAdd = () => {
    dialog.show(
      <JournalDialog
        onClose={() => dialog.hide()}
        accounts={accounts}
        onAdd={(data) => {
          apiAction.execute(() => api.post('/api/accounting/journals', data), {
            successMsg: 'Jurnal berhasil ditambahkan',
            errorMsg: 'Gagal menambahkan jurnal',
            onSuccess: () => {
              refetch();
              dialog.hide();
            }
          });
        }}
      />,
      { width: 640 }
    );
  };

  return (
    <>
      {dialog.element}
      <Layout
        header={
          <LayoutHeader hasDivider>
            <HStack gap={2} vAlign="center">
              <StackItem size="fill">
                <VStack gap={1}>
                  <Heading level={2}>Jurnal Umum & Akuntansi</Heading>
                  <Text type="supporting">Catat dan pantau transaksi keuangan secara double-entry.</Text>
                </VStack>
              </StackItem>
              <Button label="Tambah Jurnal" icon={<PlusIcon width={20} />} onClick={handleAdd} />
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent>
            <DataStateView
              isLoading={isLoading}
              error={error}
              onRetry={refetch}
              hasData={journalRows.length > 0}
              emptyTitle="Belum ada catatan jurnal"
              emptyMessage="Transaksi jurnal akan muncul di sini"
            >
              <VStack gap={4}>
            <div style={{ backgroundColor: 'var(--color-background-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead style={{ backgroundColor: 'var(--color-background-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Tanggal</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Akun / Keterangan</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Debit</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Kredit</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'center', width: 120 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {journalRows.map((entry: any) => (
                    <React.Fragment key={entry.id}>
                      <tr style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-background-muted)' }}>
                        <td style={{ padding: '16px 16px 4px', verticalAlign: 'top', width: '15%' }}>
                           <Text type="supporting" color="secondary" style={{ fontWeight: 500 }}>
                             {new Date(entry.transaction_date).toLocaleDateString('id-ID', {
                               day: '2-digit', month: 'short', year: 'numeric',
                             })}
                           </Text>
                        </td>
                        <td colSpan={3} style={{ padding: '16px 16px 4px', verticalAlign: 'top' }}>
                           <VStack gap={0}>
                             <Text style={{ fontWeight: 600 }}>{entry.description}</Text>
                             {entry.reference_type && <Text type="supporting" color="secondary" style={{ fontSize: 12 }}>Ref: {entry.reference_type}</Text>}
                           </VStack>
                        </td>
                        <td style={{ padding: '16px 16px 4px', verticalAlign: 'top', textAlign: 'center' }}>
                          <HStack gap={1} hAlign="center">
                            {entry.reference_type !== 'reversal_of' && (
                              <button
                                title="Buat Jurnal Koreksi"
                                onClick={() => {
                                  if (!confirm(`Buat jurnal koreksi (reversal) untuk "${entry.description}"?\n\nIni akan membuat entri baru yang membalik semua Debit dan Kredit jurnal ini.`)) return;
                                  apiAction.execute(
                                    () => api.post(`/api/accounting/journals/${entry.id}/reverse`, {}),
                                    {
                                      successMsg: 'Jurnal koreksi berhasil dibuat',
                                      errorMsg: 'Gagal membuat koreksi',
                                      onSuccess: () => refetch(),
                                    }
                                  );
                                }}
                                style={{
                                  background: 'none', border: '1px solid var(--color-border)', borderRadius: 6,
                                  padding: '4px 8px', cursor: 'pointer', color: 'var(--color-text-orange)',
                                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500,
                                }}
                              >
                                <ArrowPathIcon width={14} />
                                Koreksi
                              </button>
                            )}
                            {isSuperAdmin && (
                              <button
                                title="Hapus Jurnal"
                                onClick={() => {
                                  if (!confirm(`HAPUS PERMANEN jurnal "${entry.description}"?\n\nData tidak dapat dipulihkan. Yakin?`)) return;
                                  apiAction.execute(
                                    () => api.delete(`/api/accounting/journals/${entry.id}`),
                                    {
                                      successMsg: 'Jurnal berhasil dihapus',
                                      errorMsg: 'Gagal menghapus jurnal',
                                      onSuccess: () => refetch(),
                                    }
                                  );
                                }}
                                style={{
                                  background: 'none', border: '1px solid var(--color-border-red)', borderRadius: 6,
                                  padding: '4px 8px', cursor: 'pointer', color: 'var(--color-text-red)',
                                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500,
                                }}
                              >
                                <TrashIcon width={14} />
                                Hapus
                              </button>
                            )}
                          </HStack>
                        </td>
                      </tr>
                      {entry.lines?.map((line: any) => (
                         <tr key={line.id} style={{ backgroundColor: 'var(--color-background-surface)' }}>
                           <td style={{ padding: '6px 16px' }}></td>
                           <td style={{ padding: '6px 16px', paddingLeft: line.debit > 0 ? 16 : 48 }}>
                             <Text style={{ fontFamily: 'monospace', fontSize: 13, marginRight: 8, color: 'var(--color-text-secondary)' }}>{line.account_code}</Text>
                             <Text style={{ fontWeight: line.debit > 0 ? 500 : 400 }}>{line.account_name}</Text>
                             {line.description && <Text type="supporting" color="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>{line.description}</Text>}
                           </td>
                           <td style={{ padding: '6px 16px', textAlign: 'right', verticalAlign: 'top' }}>
                             <Text>{line.debit > 0 ? formatRp(line.debit) : ''}</Text>
                           </td>
                           <td style={{ padding: '6px 16px', textAlign: 'right', verticalAlign: 'top' }}>
                             <Text>{line.credit > 0 ? formatRp(line.credit) : ''}</Text>
                           </td>
                         </tr>
                      ))}
                      <tr>
                        <td></td>
                        <td colSpan={4} style={{ padding: '4px 16px 16px 16px' }}>
                           <Text type="supporting" color="secondary" style={{ fontSize: 12 }}>Dicatat oleh: {entry.creator_name || 'Sistem'}</Text>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Sentinel element — when visible, triggers next page load */}
            {hasMore && (
              <div
                ref={sentinelRef as React.RefCallback<HTMLDivElement>}
                style={{ height: 1 }}
              />
            )}
            {isFetchingMore && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Text type="supporting" color="secondary">Memuat lebih banyak...</Text>
              </div>
            )}
            {!hasMore && journalRows.length > 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Text type="supporting" color="secondary">Semua jurnal sudah ditampilkan ({journalRows.length} entri)</Text>
              </div>
            )}
          </VStack>
        </DataStateView>
      </LayoutContent>
        }
      />
    </>
  );
}
