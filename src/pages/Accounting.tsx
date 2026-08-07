'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  VStack,
  HStack,
  Layout,
  LayoutContent,
  LayoutHeader,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { useApiQuery } from '../hooks/useApiQuery';
import { useApiAction } from '../hooks/useApiAction';
import { api } from '../services/api';
import { formatRp } from '../utils/format';
import { Pagination } from '../components/Pagination';
import { DataStateView } from '../components/DataStateView';
import { useA11yDialog } from '../hooks/useA11yDialog';
import { TextInput } from '@astryxdesign/core/TextInput';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Selector } from '@astryxdesign/core/Selector';
import type { AccountRow, JournalEntryRow, PaginatedResponse } from '../shared/types';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TrashIcon, PlusIcon, EyeIcon } from '@heroicons/react/24/outline';

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
                   icon={TrashIcon}
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

function JournalLinesDialog({
  journalId,
  onClose,
}: {
  journalId: string;
  onClose: () => void;
}) {
  const { data: linesData, isLoading, error } = useApiQuery<any[]>(`/api/accounting/journals/${journalId}/lines`);
  const lines = Array.isArray(linesData) ? linesData : [];

  return (
    <VStack gap={4} style={{ padding: '24px', minWidth: '800px' }}>
      <Heading level={3}>Detail Baris Jurnal</Heading>
      <DataStateView isLoading={isLoading} error={error}>
        {lines.length === 0 ? (
          <Text type="supporting">Tidak ada detail baris</Text>
        ) : (
          <VStack gap={0} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {/* Header */}
            <HStack gap={4} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-muted)' }}>
              <div style={{ flex: 2 }}><Text weight="semibold" type="supporting">Akun</Text></div>
              <div style={{ flex: 1, textAlign: 'right' }}><Text weight="semibold" type="supporting">Debit</Text></div>
              <div style={{ flex: 1, textAlign: 'right' }}><Text weight="semibold" type="supporting">Kredit</Text></div>
            </HStack>
            {/* Body */}
            {lines.map((item: any, idx: number) => (
              <HStack key={item.id || idx} gap={4} align="center" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ flex: 2 }}>
                  <VStack gap={1}>
                    <Text>{item.account_code} - {item.account_name}</Text>
                    {item.description && <Text type="supporting">{item.description}</Text>}
                  </VStack>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <Text>{formatRp(Number(item.debit))}</Text>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <Text>{formatRp(Number(item.credit))}</Text>
                </div>
              </HStack>
            ))}
          </VStack>
        )}
      </DataStateView>
      <HStack hAlign="end" style={{ marginTop: 16 }}>
        <Button label="Tutup" onClick={onClose} />
      </HStack>
    </VStack>
  );
}

export default function Accounting() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  
  const dialog = useA11yDialog();
  const apiAction = useApiAction();

  const {
    data: journalsRes,
    isLoading,
    error,
    refetch,
  } = useApiQuery<PaginatedResponse<JournalEntryRow & { creator_name: string, total_amount: number }>>(
    `/api/accounting/journals?page=${page}&limit=${limit}`
  );

  const [journalRows, setJournalRows] = useState<(JournalEntryRow & { creator_name: string, total_amount: number })[]>([]);

  useEffect(() => {
    if (journalsRes?.data) {
      setJournalRows(journalsRes.data);
    }
  }, [journalsRes]);

  const { data: accountsData } = useApiQuery<AccountRow[]>('/api/accounting/accounts');
  const accounts = Array.isArray(accountsData) ? accountsData : [];

  const columns: TableColumn<JournalEntryRow & { creator_name: string, total_amount: number }>[] = useMemo(() => [
    {
      key: 'transaction_date',
      header: 'Tanggal',
      width: proportional(15),
      renderCell: (item) => (
        <Text type="supporting" color="secondary">
          {new Date(item.transaction_date).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </Text>
      ),
    },
    {
      key: 'description',
      header: 'Keterangan',
      width: proportional(40),
      renderCell: (item) => (
        <VStack gap={1}>
          <Text>{item.description}</Text>
          {item.reference_type && (
            <Text type="supporting" color="secondary">Ref: {item.reference_type}</Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'total_amount',
      header: 'Total Nilai',
      width: proportional(20),
      renderCell: (item) => (
        <Text style={{ fontWeight: 600 }}>{formatRp(Number(item.total_amount))}</Text>
      )
    },
    {
      key: 'creator_name',
      header: 'Dicatat Oleh',
      width: proportional(20),
      renderCell: (item) => <Text type="supporting">{item.creator_name || 'Sistem'}</Text>,
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: proportional(10),
      renderCell: (item) => (
        <Button 
          variant="secondary" 
          icon={<EyeIcon width={16} />} 
          onClick={() => {
            dialog.show(
              <JournalLinesDialog
                journalId={item.id}
                onClose={() => dialog.hide()}
              />,
              { width: 'min(90vw, 900px)' }
            );
          }}
          label="Detail"
        />
      ),
    },
  ], [dialog]);

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
      <Layout>
        <LayoutHeader
        title="Jurnal Umum & Akuntansi"
        subtitle="Catat dan pantau transaksi keuangan secara double-entry."
        actions={
          <Button label="Tambah Jurnal" icon={PlusIcon} onClick={handleAdd} />
        }
      />
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
            <Table<JournalEntryRow & { creator_name: string }>
              data={journalRows}
              columns={columns}
              idKey="id"
              density="balanced"
              dividers="rows"
              hasHover
            />
            {journalsRes && (journalsRes.total || 0) > limit && (
              <Pagination
                page={page}
                limit={limit}
                total={journalsRes.total || 0}
                onPageChange={setPage}
              />
            )}
          </VStack>
        </DataStateView>
      </LayoutContent>
      </Layout>
    </>
  );
}
