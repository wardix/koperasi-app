'use client';

import {useState, useMemo, useEffect} from 'react';
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
import {PowerSearch, usePowerSearchConfig} from '@astryxdesign/core/PowerSearch';
import type {PowerSearchFilter} from '@astryxdesign/core/PowerSearch';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {
  FunnelIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {useImperativeDialog} from '@astryxdesign/core/Dialog';
import {AddLoanDialogContent} from './AddLoanDialog.tsx';

export interface LoanRow extends Record<string, unknown> {
  id: string;
  name: string;
  amount: string;
  tenor: string;
  purpose: string;
  status: string;
}

const statusValues = [
  {value: 'Menunggu', label: 'Menunggu'},
  {value: 'Disetujui', label: 'Disetujui'},
  {value: 'Ditolak', label: 'Ditolak'},
];

const fieldDefs = [
  {key: 'name', type: 'string', label: 'Nama Peminjam'},
  {key: 'status', type: 'enum', label: 'Status', enumValues: statusValues},
] as const;

export default function LoansTemplate() {
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [filters, setFilters] = useState<PowerSearchFilter[]>([]);
  const {config, applyFilters} = usePowerSearchConfig(fieldDefs, 'Pinjaman');
  const dialog = useImperativeDialog({purpose: 'form', width: 480});

  const fetchLoans = () => {
    fetch('http://localhost:3000/api/loans')
      .then(res => res.json())
      .then(data => setLoans(data))
      .catch(err => console.error("Error fetching loans:", err));
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await fetch(`http://localhost:3000/api/loans/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      // Update local state directly for immediate feedback
      setLoans(loans.map(loan => loan.id === id ? { ...loan, status } : loan));
    } catch (err) {
      console.error("Error updating loan status:", err);
    }
  };

  const filtered = useMemo(() => {
    return applyFilters(filters, loans);
  }, [filters, applyFilters, loans]);

  const handleAddLoan = () => {
    dialog.show(
      <AddLoanDialogContent
        onClose={() => dialog.hide()}
        onAdd={async (newLoan) => {
          try {
            await fetch('http://localhost:3000/api/loans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newLoan)
            });
            setLoans([newLoan, ...loans]);
          } catch (err) {
            console.error("Error saving loan:", err);
          }
        }}
      />
    );
  };

  const columns: TableColumn<LoanRow>[] = [
    {
      key: 'name',
      header: 'Nama Peminjam',
      width: proportional(2),
      renderCell: (item: LoanRow) => (
        <HStack gap={3} vAlign="center">
          <Avatar name={item.name} size="small" />
          <VStack gap={0}>
            <Text type="body">{item.name}</Text>
            <Text type="supporting" color="secondary">
              {item.purpose}
            </Text>
          </VStack>
        </HStack>
      ),
    },
    {
      key: 'amount',
      header: 'Jumlah Pinjaman',
      width: proportional(1),
      renderCell: (item: LoanRow) => <Text type="body">{item.amount}</Text>,
    },
    {
      key: 'tenor',
      header: 'Tenor',
      width: pixel(100),
      renderCell: (item: LoanRow) => <Text type="body">{item.tenor}</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (item: LoanRow) => {
        let color = 'neutral';
        if (item.status === 'Disetujui') color = 'success';
        if (item.status === 'Ditolak') color = 'error';
        if (item.status === 'Menunggu') color = 'warning';
        return <Badge color={color as any}>{item.status}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: pixel(120),
      renderCell: (item: LoanRow) => {
        if (item.status !== 'Menunggu') return null;
        return (
          <HStack gap={2}>
            <IconButton icon={<Icon icon={CheckIcon} />} label="Setujui" variant="primary" size="sm" onClick={() => handleUpdateStatus(item.id, 'Disetujui')} />
            <IconButton icon={<Icon icon={XMarkIcon} />} label="Tolak" variant="secondary" size="sm" onClick={() => handleUpdateStatus(item.id, 'Ditolak')} />
          </HStack>
        );
      },
    },
  ];

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Persetujuan Pinjaman</Heading>
            </StackItem>
            <IconButton
              label="Filter"
              icon={<Icon icon={FunnelIcon} size="sm" />}
              variant="ghost"
            />
            <Button
              label="Tambah Pengajuan"
              icon={<Icon icon={PlusIcon} size="sm" />}
              onClick={handleAddLoan}
            />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          <VStack gap={4}>
            <PowerSearch
              config={config}
              filters={filters}
              onChange={newFilters => {
                setFilters([...newFilters]);
              }}
              placeholder="Cari pengajuan..."
              resultCount={filtered.length}
            />
            <Table<LoanRow>
              data={filtered}
              columns={columns}
              idKey="id"
              density="balanced"
              dividers="rows"
              hasHover
            />
          </VStack>
        </LayoutContent>
      }
    />
    {dialog.element}
    </>
  );
}
