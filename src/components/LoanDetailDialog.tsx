'use client';

import {useState, useMemo} from 'react';
import {DialogHeader} from '@astryxdesign/core/Dialog';
import {
  Layout,
  LayoutContent,
  VStack,
  HStack,
} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {PencilSquareIcon, TrashIcon} from '@heroicons/react/24/outline';
import {useApiQuery} from '../hooks/useApiQuery';
import {api} from '../services/api';
import {useToast} from '@astryxdesign/core/Toast';
import type {LoanRow} from '../shared/types';
import {formatAmountInput, formatRp, parseAmountInput} from '../utils/format';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Center} from '@astryxdesign/core/Center';
import {useAuth} from '../hooks/useAuth';

interface Payment {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  method: string;
}

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toIsoDateInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayIsoDate();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function LoanDetailDialogContent({
  loan,
  onClose,
  onUpdate
}: {
  loan: LoanRow;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [payAmount, setPayAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIsoDate());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState(todayIsoDate());
  const [disbursementDate, setDisbursementDate] = useState(() =>
    toIsoDateInput(loan.approvedAt || loan.createdAt || todayIsoDate())
  );
  const [isEditingDisbursement, setIsEditingDisbursement] = useState(false);
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManagePayments = hasPermission('create:payments');
  const canEditDisbursement =
    hasPermission('approve:loans') &&
    (loan.status === 'Disetujui' || loan.status === 'Lunas' || loan.status === 'Macet');

  const { data: payments, isLoading, refetch } = useApiQuery<Payment[]>(`/api/loans/${loan.id}/payments`);

  const tenorBulan = Number(loan.tenor) || 1;
  const pokok = Number(loan.amount);
  const bunga = Number(loan.interestAmount || 0);
  const totalHutang = Number(loan.totalAmount || (pokok + bunga));
  const angsuranPerBulan = Math.ceil(totalHutang / tenorBulan);
  
  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const remainingDebt = totalHutang - totalPaid;
  const displayDisbursementDate = loan.approvedAt || loan.createdAt;

  const refreshAll = () => {
    refetch();
    onUpdate();
  };

  const handleSaveDisbursementDate = async () => {
    if (!disbursementDate) return;
    setIsSubmitting(true);
    try {
      await api.put(`/api/loans/${loan.id}/disbursement-date`, {
        disbursementDate,
      });
      toast({ body: 'Tanggal pencairan diperbarui', type: 'info' });
      setIsEditingDisbursement(false);
      refreshAll();
    } catch {
      toast({ body: 'Gagal mengubah tanggal pencairan', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePay = async () => {
    const amount = parseAmountInput(payAmount);
    if (!amount || amount <= 0 || amount > remainingDebt || !paymentDate) return;
    
    setIsSubmitting(true);
    try {
      await api.post(`/api/loans/${loan.id}/payments`, {
        amount,
        method: 'Transfer',
        paymentDate,
      });
      
      toast({body: 'Pembayaran berhasil', type: 'info'});
      setPayAmount('');
      setPaymentDate(todayIsoDate());
      refreshAll();
    } catch (err) {
      toast({body: 'Gagal melakukan pembayaran', type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (payment: Payment) => {
    setEditing(payment);
    setEditAmount(formatAmountInput(String(Math.round(Number(payment.amount)))));
    setEditDate(toIsoDateInput(payment.paymentDate));
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditAmount('');
    setEditDate(todayIsoDate());
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const amount = parseAmountInput(editAmount);
    // When editing, max remaining is current remaining + this payment's amount
    const maxAllowed = remainingDebt + Number(editing.amount);
    if (!amount || amount <= 0 || amount > maxAllowed || !editDate) return;

    setIsSubmitting(true);
    try {
      await api.put(`/api/loans/${loan.id}/payments/${editing.id}`, {
        amount,
        paymentDate: editDate,
        method: editing.method || 'Transfer',
      });
      toast({body: 'Pembayaran berhasil diubah', type: 'info'});
      cancelEdit();
      refreshAll();
    } catch (err) {
      toast({body: 'Gagal mengubah pembayaran', type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (payment: Payment) => {
    if (!window.confirm(`Hapus angsuran ${formatRp(payment.amount)}? Jadwal dan sisa hutang akan dihitung ulang.`)) {
      return;
    }
    setIsSubmitting(true);
    try {
      await api.delete(`/api/loans/${loan.id}/payments/${payment.id}`);
      toast({body: 'Pembayaran dihapus', type: 'info'});
      if (editing?.id === payment.id) cancelEdit();
      refreshAll();
    } catch (err) {
      toast({body: 'Gagal menghapus pembayaran', type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: TableColumn<Payment>[] = useMemo(() => {
    const cols: TableColumn<Payment>[] = [
      {
        key: 'paymentDate',
        header: 'Tanggal',
        width: proportional(1),
        renderCell: (item: Payment) => (
          <Text type="body">
            {new Date(item.paymentDate).toLocaleDateString('id-ID', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </Text>
        ),
      },
      {
        key: 'method',
        header: 'Metode',
        width: pixel(100),
        renderCell: (item: Payment) => <Text type="body">{item.method}</Text>,
      },
      {
        key: 'amount',
        header: 'Nominal',
        width: proportional(1),
        renderCell: (item: Payment) => (
          <Text type="body" color="accent">
            + {formatRp(item.amount)}
          </Text>
        ),
      },
    ];

    if (canManagePayments) {
      cols.push({
        key: 'actions',
        header: 'Aksi',
        width: pixel(100),
        renderCell: (item: Payment) => (
          <HStack gap={1}>
            <IconButton
              icon={<Icon icon={PencilSquareIcon} />}
              label="Ubah"
              variant="ghost"
              size="sm"
              onClick={() => startEdit(item)}
              isDisabled={isSubmitting}
            />
            <IconButton
              icon={<Icon icon={TrashIcon} />}
              label="Hapus"
              variant="ghost"
              color="error"
              size="sm"
              onClick={() => handleDelete(item)}
              isDisabled={isSubmitting}
            />
          </HStack>
        ),
      });
    }

    return cols;
  }, [canManagePayments, isSubmitting, remainingDebt]);

  return (
    <Layout
      header={
        <DialogHeader
          title={`Detail Pinjaman: ${loan.name}`}
          subtitle={`Tenor: ${loan.tenor} Bulan`}
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={6}>
            <HStack gap={4}>
              <VStack gap={1} style={{ flex: 1, padding: 16, backgroundColor: 'var(--color-background-secondary, #f9fafb)', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Pokok</Text>
                <Heading level={3}>{formatRp(pokok)}</Heading>
              </VStack>
              <VStack gap={1} style={{ flex: 1, padding: 12, backgroundColor: 'var(--color-background-secondary, #f9fafb)', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Total Bunga</Text>
                <Heading level={3}>{formatRp(bunga)}</Heading>
              </VStack>
            </HStack>
            <HStack gap={4}>
              <VStack gap={1} style={{ flex: 1, padding: 16, backgroundColor: 'var(--color-background-secondary, #f9fafb)', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Total Hutang</Text>
                <Heading level={3}>{formatRp(totalHutang)}</Heading>
              </VStack>
              <VStack gap={1} style={{ flex: 1, padding: 16, backgroundColor: 'var(--color-background-secondary, #f9fafb)', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Sisa Hutang</Text>
                <Heading level={3}>
                  {formatRp(Math.max(0, remainingDebt))}
                </Heading>
              </VStack>
            </HStack>

            {(loan.status === 'Disetujui' || loan.status === 'Lunas' || loan.status === 'Macet') && (
              <VStack
                gap={3}
                style={{
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--color-border-primary, #e5e7eb)',
                  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                }}
              >
                <HStack hAlign="space-between" vAlign="center" style={{ width: '100%' }}>
                  <VStack gap={1}>
                    <Text type="body" weight="bold">Tanggal Pencairan</Text>
                    <Text type="supporting" color="secondary">
                      Dipakai di Arus Kas & Transaksi Pinjaman (baris pencairan)
                    </Text>
                  </VStack>
                  {canEditDisbursement && !isEditingDisbursement && (
                    <Button
                      label="Ubah Tanggal"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDisbursementDate(
                          toIsoDateInput(loan.approvedAt || loan.createdAt || todayIsoDate())
                        );
                        setIsEditingDisbursement(true);
                      }}
                    />
                  )}
                </HStack>

                {!isEditingDisbursement ? (
                  <Text type="body" weight="semibold">
                    {displayDisbursementDate
                      ? new Date(displayDisbursementDate).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'}
                  </Text>
                ) : (
                  <VStack gap={3}>
                    <DateInput
                      label="Tanggal Pencairan"
                      description="Bisa diisi mundur untuk data historis"
                      value={disbursementDate}
                      onChange={(val) => setDisbursementDate(val ?? todayIsoDate())}
                      max={todayIsoDate()}
                      isRequired
                    />
                    <HStack gap={2} hAlign="end">
                      <Button
                        label="Batal"
                        variant="secondary"
                        onClick={() => setIsEditingDisbursement(false)}
                        isDisabled={isSubmitting}
                      />
                      <Button
                        label="Simpan Tanggal"
                        variant="primary"
                        onClick={handleSaveDisbursementDate}
                        isDisabled={isSubmitting || !disbursementDate}
                      />
                    </HStack>
                  </VStack>
                )}
              </VStack>
            )}

            {remainingDebt > 0 && canManagePayments && (
              <VStack gap={4}>
                <Heading level={4}>Bayar Angsuran</Heading>
                <Text type="supporting" color="secondary">
                  Angsuran per bulan yang disarankan: {formatRp(angsuranPerBulan)}
                </Text>
                <VStack gap={3}>
                  <TextInput
                    label="Nominal Pembayaran (Rp)"
                    value={payAmount}
                    onChange={(raw) => setPayAmount(formatAmountInput(raw))}
                    type="text"
                    placeholder={`Saran: ${formatAmountInput(String(angsuranPerBulan))}`}
                    description="Pemisah ribuan ditambahkan otomatis"
                  />
                  <DateInput
                    label="Tanggal Pembayaran"
                    description="Bisa diisi mundur untuk angsuran historis"
                    value={paymentDate}
                    onChange={(val) => setPaymentDate(val ?? todayIsoDate())}
                    max={todayIsoDate()}
                    isRequired
                  />
                  <HStack hAlign="end">
                    <Button
                      label="Bayar"
                      onClick={handlePay}
                      disabled={!payAmount || parseAmountInput(payAmount) <= 0 || !paymentDate || isSubmitting}
                    />
                  </HStack>
                </VStack>
              </VStack>
            )}

            {editing && (
              <VStack
                gap={3}
                style={{
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--color-border-primary, #e5e7eb)',
                  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                }}
              >
                <Heading level={4}>Ubah Angsuran</Heading>
                <Text type="supporting" color="secondary">
                  Ubah nominal atau tanggal. Alokasi jadwal dan sisa hutang dihitung ulang otomatis.
                </Text>
                <TextInput
                  label="Nominal (Rp)"
                  value={editAmount}
                  onChange={(raw) => setEditAmount(formatAmountInput(raw))}
                  type="text"
                />
                <DateInput
                  label="Tanggal Pembayaran"
                  value={editDate}
                  onChange={(val) => setEditDate(val ?? todayIsoDate())}
                  max={todayIsoDate()}
                  isRequired
                />
                <HStack gap={2} hAlign="end">
                  <Button label="Batal" variant="secondary" onClick={cancelEdit} isDisabled={isSubmitting} />
                  <Button
                    label="Simpan Perubahan"
                    variant="primary"
                    onClick={handleSaveEdit}
                    isDisabled={
                      isSubmitting ||
                      !editAmount ||
                      parseAmountInput(editAmount) <= 0 ||
                      !editDate
                    }
                  />
                </HStack>
              </VStack>
            )}

            <VStack gap={4}>
              <Heading level={4}>Riwayat Pembayaran</Heading>
              {isLoading ? (
                <Center style={{height: 100}}><Spinner size="lg" /></Center>
              ) : payments && payments.length > 0 ? (
                <Table<Payment>
                  data={payments}
                  columns={columns}
                  idKey="id"
                  density="balanced"
                  dividers="rows"
                />
              ) : (
                <Text type="supporting" color="secondary">Belum ada riwayat pembayaran.</Text>
              )}
            </VStack>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
