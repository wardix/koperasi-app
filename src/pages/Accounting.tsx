'use client';

import React, { useState } from 'react';
import {
  VStack,
  HStack,
  Layout,
  LayoutContent,
  LayoutHeader,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Table, proportional } from '@astryxdesign/core/Table';
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
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

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
  } = useApiQuery<PaginatedResponse<JournalEntryRow & { creator_name: string }>>(
    `/api/accounting/journals?page=${page}&limit=${limit}`
  );

  const [journalRows, setJournalRows] = useState<(JournalEntryRow & { creator_name: string })[]>([]);

  useEffect(() => {
    if (journalsRes?.data) {
      setJournalRows(journalsRes.data);
    }
  }, [journalsRes]);

  const { data: accountsRes } = useApiQuery<{ data: AccountRow[] }>('/api/accounting/accounts');
  const accounts = accountsRes?.data || [];

  const columns: TableColumn<JournalEntryRow & { creator_name: string }>[] = [
    {
      id: 'date',
      header: 'Tanggal',
      accessor: (r) => r.transaction_date,
      width: proportional(15),
    },
    {
      id: 'desc',
      header: 'Keterangan',
      accessor: (r) => r.description,
      width: proportional(40),
      cell: (v, r) => (
        <VStack gap={1}>
          <Text>{v as string}</Text>
          {r.reference_type && <Text type="supporting" color="secondary">Ref: {r.reference_type}</Text>}
        </VStack>
      )
    },
    {
      id: 'creator',
      header: 'Dicatat Oleh',
      accessor: (r) => r.creator_name,
      width: proportional(20),
    }
  ];

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
      />
    );
  };

  return (
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
  );
}
