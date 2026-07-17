'use client';

import {useState, useMemo, useEffect, useCallback} from 'react';
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
import {Card} from '@astryxdesign/core/Card';
import {Badge} from '@astryxdesign/core/Badge';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {PlusIcon, PencilSquareIcon, TrashIcon} from '@heroicons/react/24/outline';
import {useApiQuery} from '../hooks/useApiQuery';
import {useApiAction} from '../hooks/useApiAction';
import {useAuth} from '../hooks/useAuth';
import {api} from '../services/api';
import {formatAmountInput, formatRp, parseAmountInput} from '../utils/format';
import {Pagination} from '../components/Pagination';
import {DataStateView} from '../components/DataStateView';
import {useA11yDialog} from '../hooks/useA11yDialog';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Selector} from '@astryxdesign/core/Selector';
import type {ExpenseRow, PaginatedResponse} from '../shared/types';

const CATEGORY_OPTIONS = [
  {value: 'notaris', label: 'Jasa Notaris / Legal'},
  {value: 'atk', label: 'ATK & Administrasi'},
  {value: 'sewa', label: 'Sewa'},
  {value: 'utilitas', label: 'Utilitas (Listrik/Air/Internet)'},
  {value: 'gaji', label: 'Gaji / Honor'},
  {value: 'transport', label: 'Transport'},
  {value: 'pajak', label: 'Pajak / Retribusi'},
  {value: 'lainnya', label: 'Lainnya'},
];

const METHOD_OPTIONS = [
  {value: 'Transfer', label: 'Transfer'},
  {value: 'Cash', label: 'Tunai'},
  {value: 'Debit', label: 'Debit'},
];

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toIsoDateInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayIsoDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function categoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

function ExpenseFormDialog({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: ExpenseRow | null;
  onClose: () => void;
  onSubmit: (payload: {
    expenseDate: string;
    category: string;
    description: string;
    amount: number;
    paymentMethod: string;
  }) => void;
}) {
  const [expenseDate, setExpenseDate] = useState(
    initial ? toIsoDateInput(initial.expenseDate) : todayIsoDate()
  );
  const [category, setCategory] = useState(initial?.category || 'notaris');
  const [description, setDescription] = useState(initial?.description || '');
  const [amount, setAmount] = useState(
    initial ? formatAmountInput(String(Math.round(Number(initial.amount)))) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod || 'Transfer');

  const handleSave = () => {
    const n = parseAmountInput(amount);
    if (!expenseDate || !description.trim() || n <= 0) return;
    onSubmit({
      expenseDate,
      category,
      description: description.trim(),
      amount: n,
      paymentMethod,
    });
  };

  return (
    <VStack padding={4} gap={4} style={{ width: '100%', boxSizing: 'border-box' }}>
      <VStack gap={1}>
        <Heading level={3}>{initial ? 'Ubah Pengeluaran' : 'Catat Pengeluaran'}</Heading>
        <Text type="supporting" color="secondary">
          Contoh: jasa notaris, ATK, sewa, utilitas. Masuk ke Arus Kas sebagai arus keluar.
        </Text>
      </VStack>

      <VStack gap={3}>
        <DateInput
          label="Tanggal"
          value={expenseDate}
          onChange={(v) => setExpenseDate(v ?? todayIsoDate())}
          max={todayIsoDate()}
          isRequired
        />
        <Selector
          label="Kategori"
          value={category}
          onChange={(v) => setCategory(v)}
          options={CATEGORY_OPTIONS}
        />
        <TextInput
          label="Keterangan"
          value={description}
          onChange={setDescription}
          placeholder="Contoh: Biaya notaris akta pendirian / legalisasi"
        />
        <TextInput
          label="Nominal (Rp)"
          type="text"
          value={amount}
          onChange={(raw) => setAmount(formatAmountInput(raw))}
          placeholder="Contoh: 1.500.000"
          description="Pemisah ribuan otomatis"
        />
        <Selector
          label="Metode Pembayaran"
          value={paymentMethod}
          onChange={setPaymentMethod}
          options={METHOD_OPTIONS}
        />
      </VStack>

      <HStack
        gap={2}
        hAlign="end"
        style={{
          position: 'sticky',
          bottom: 0,
          paddingTop: 'var(--spacing-3)',
          backgroundColor: 'var(--color-background-primary, #fff)',
        }}
      >
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button label="Simpan" variant="primary" onClick={handleSave} />
      </HStack>
    </VStack>
  );
}

export default function ExpensesPage() {
  const dialog = useA11yDialog({ purpose: 'form', width: 520, maxHeight: '85vh' });
  const apiAction = useApiAction();
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error, refetch } = useApiQuery<PaginatedResponse<ExpenseRow>>(
    `/api/expenses?page=${page}&limit=${limit}`
  );
  const [rows, setRows] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    if (data?.data) setRows(data.data);
  }, [data]);

  const totalAmount = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [rows]
  );

  const openCreate = useCallback(() => {
    dialog.show(
      <ExpenseFormDialog
        onClose={() => dialog.hide()}
        onSubmit={(payload) => {
          apiAction.execute(
            () => api.post('/api/expenses', payload),
            {
              successMsg: 'Pengeluaran berhasil dicatat',
              errorMsg: 'Gagal menyimpan pengeluaran',
              onSuccess: () => refetch(),
              onFinally: () => dialog.hide(),
            }
          );
        }}
      />
    );
  }, [dialog, apiAction, refetch]);

  const openEdit = useCallback(
    (item: ExpenseRow) => {
      dialog.show(
        <ExpenseFormDialog
          initial={item}
          onClose={() => dialog.hide()}
          onSubmit={(payload) => {
            apiAction.execute(
              () => api.put(`/api/expenses/${item.id}`, payload),
              {
                successMsg: 'Pengeluaran diperbarui',
                errorMsg: 'Gagal mengubah pengeluaran',
                onSuccess: () => refetch(),
                onFinally: () => dialog.hide(),
              }
            );
          }}
        />
      );
    },
    [dialog, apiAction, refetch]
  );

  const handleDelete = useCallback(
    (item: ExpenseRow) => {
      if (!window.confirm(`Hapus pengeluaran "${item.description}" (${formatRp(item.amount)})?`)) {
        return;
      }
      apiAction.execute(
        () => api.delete(`/api/expenses/${item.id}`),
        {
          successMsg: 'Pengeluaran dihapus',
          errorMsg: 'Gagal menghapus pengeluaran',
          onSuccess: () => refetch(),
        }
      );
    },
    [apiAction, refetch]
  );

  const columns: TableColumn<ExpenseRow>[] = useMemo(() => {
    const cols: TableColumn<ExpenseRow>[] = [
      {
        key: 'expenseDate',
        header: 'Tanggal',
        width: proportional(1.2),
        renderCell: (item) => (
          <Text type="supporting" color="secondary">
            {new Date(item.expenseDate).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        ),
      },
      {
        key: 'category',
        header: 'Kategori',
        width: proportional(1.5),
        renderCell: (item) => <Badge variant="neutral" label={categoryLabel(String(item.category))} />,
      },
      {
        key: 'description',
        header: 'Keterangan',
        width: proportional(2.5),
        renderCell: (item) => <Text type="body">{item.description}</Text>,
      },
      {
        key: 'amount',
        header: 'Nominal',
        width: proportional(1.2),
        renderCell: (item) => (
          <Text type="body" weight="semibold" color="accent">
            − {formatRp(item.amount)}
          </Text>
        ),
      },
      {
        key: 'paymentMethod',
        header: 'Metode',
        width: pixel(100),
        renderCell: (item) => <Text type="body">{item.paymentMethod}</Text>,
      },
    ];

    if (hasPermission('update:expenses') || hasPermission('delete:expenses')) {
      cols.push({
        key: 'actions',
        header: 'Aksi',
        width: pixel(100),
        renderCell: (item) => (
          <HStack gap={1}>
            {hasPermission('update:expenses') && (
              <IconButton
                icon={<Icon icon={PencilSquareIcon} />}
                label="Ubah"
                variant="ghost"
                size="sm"
                onClick={() => openEdit(item)}
              />
            )}
            {hasPermission('delete:expenses') && (
              <IconButton
                icon={<Icon icon={TrashIcon} />}
                label="Hapus"
                variant="ghost"
                color="error"
                size="sm"
                onClick={() => handleDelete(item)}
              />
            )}
          </HStack>
        ),
      });
    }

    return cols;
  }, [hasPermission, openEdit, handleDelete]);

  return (
    <>
      {dialog.element}
      <Layout
        height="auto"
        header={
          <LayoutHeader hasDivider>
            <HStack gap={2} vAlign="center">
              <StackItem size="fill">
                <Heading level={1}>Pengeluaran Koperasi</Heading>
              </StackItem>
              {hasPermission('create:expenses') && (
                <Button
                  label="Catat Pengeluaran"
                  variant="primary"
                  icon={<Icon icon={PlusIcon} />}
                  onClick={openCreate}
                />
              )}
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={3}>
            <DataStateView
              isLoading={isLoading}
              error={error}
              onRetry={refetch}
              errorTitle="Gagal memuat pengeluaran"
            >
              <VStack gap={4}>
                <Card style={{ padding: 20 }}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary">
                      Total di halaman ini
                    </Text>
                    <Heading level={2}>{formatRp(totalAmount)}</Heading>
                    <Text type="supporting" color="secondary">
                      Pengeluaran operasional (notaris, ATK, sewa, dll.) tercatat di Arus Kas sebagai arus keluar.
                    </Text>
                  </VStack>
                </Card>

                <Table<ExpenseRow>
                  data={rows}
                  columns={columns}
                  idKey="id"
                  density="balanced"
                  dividers="rows"
                  hasHover
                />

                <Pagination
                  page={data?.page || page}
                  limit={data?.limit || limit}
                  total={data?.total || 0}
                  onPageChange={setPage}
                />
              </VStack>
            </DataStateView>
          </LayoutContent>
        }
      />
    </>
  );
}
