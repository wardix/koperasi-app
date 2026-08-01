'use client';

import { useState, useMemo, useCallback } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { DateInput } from '@astryxdesign/core/DateInput';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Center } from '@astryxdesign/core/Center';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useToast } from '@astryxdesign/core/Toast';
import { api, ApiError } from '../../services/api';
import { formatAmountInput, formatRp, parseAmountInput } from '../../utils/format';

interface Payment {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  method: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

function toIsoDateInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayIsoDate();
  return d.toISOString().split('T')[0];
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface LoanPaymentSectionProps {
  loanId: string;
  totalHutang: number;
  angsuranPerBulan: number;
  payments: Payment[] | undefined;
  isLoadingPayments: boolean;
  canManagePayments: boolean;
  onSaved: () => void;
}

/**
 * Payment form + payment history table.
 */
export function LoanPaymentSection({
  loanId,
  totalHutang,
  angsuranPerBulan,
  payments,
  isLoadingPayments,
  canManagePayments,
  onSaved,
}: LoanPaymentSectionProps) {
  const toast = useToast();
  const [payAmount, setPayAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIsoDate());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState(todayIsoDate());

  const totalPaid = useMemo(
    () => payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0,
    [payments]
  );
  const remainingDebt = totalHutang - totalPaid;

  const startEdit = useCallback((payment: Payment) => {
    setEditing(payment);
    setEditAmount(formatAmountInput(String(Math.round(Number(payment.amount)))));
    setEditDate(toIsoDateInput(payment.paymentDate));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setEditAmount('');
    setEditDate(todayIsoDate());
  }, []);

  const handlePay = async () => {
    const amount = parseAmountInput(payAmount);
    if (!amount || amount <= 0 || amount > remainingDebt || !paymentDate) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/loans/${loanId}/payments`, {
        amount,
        method: 'Transfer',
        paymentDate,
      });
      toast({ body: 'Pembayaran berhasil', type: 'info' });
      setPayAmount('');
      setPaymentDate(todayIsoDate());
      onSaved();
    } catch (err) {
      toast({ body: errMessage(err, 'Gagal melakukan pembayaran'), type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const amount = parseAmountInput(editAmount);
    const maxAllowed = remainingDebt + Number(editing.amount);
    if (!amount || amount <= 0 || amount > maxAllowed || !editDate) return;
    setIsSubmitting(true);
    try {
      await api.put(`/api/loans/${loanId}/payments/${editing.id}`, {
        amount,
        paymentDate: editDate,
        method: editing.method || 'Transfer',
      });
      toast({ body: 'Pembayaran berhasil diubah', type: 'info' });
      cancelEdit();
      onSaved();
    } catch (err) {
      toast({ body: errMessage(err, 'Gagal mengubah pembayaran'), type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (payment: Payment) => {
    if (
      !window.confirm(
        `Hapus angsuran ${formatRp(payment.amount)}? Jadwal dan sisa hutang akan dihitung ulang.`
      )
    )
      return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/loans/${loanId}/payments/${payment.id}`);
      toast({ body: 'Pembayaran dihapus', type: 'info' });
      if (editing?.id === payment.id) cancelEdit();
      onSaved();
    } catch (err) {
      toast({ body: errMessage(err, 'Gagal menghapus pembayaran'), type: 'error' });
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
              day: '2-digit',
              month: 'short',
              year: 'numeric',
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
    <VStack gap={4}>
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
                disabled={
                  !payAmount ||
                  parseAmountInput(payAmount) <= 0 ||
                  !paymentDate ||
                  isSubmitting
                }
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
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-primary)',
            backgroundColor: 'var(--color-background-secondary)',
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
            <Button
              label="Batal"
              variant="secondary"
              onClick={cancelEdit}
              isDisabled={isSubmitting}
            />
            <Button
              label="Simpan Perubahan"
              variant="primary"
              onClick={handleSaveEdit}
              isDisabled={
                isSubmitting || !editAmount || parseAmountInput(editAmount) <= 0 || !editDate
              }
            />
          </HStack>
        </VStack>
      )}

      <VStack gap={4}>
        <Heading level={4}>Riwayat Pembayaran</Heading>
        {isLoadingPayments ? (
          <Center style={{ height: 100 }}>
            <Spinner size="lg" />
          </Center>
        ) : payments && payments.length > 0 ? (
          <Table<Payment>
            data={payments}
            columns={columns}
            idKey="id"
            density="balanced"
            dividers="rows"
          />
        ) : (
          <Text type="supporting" color="secondary">
            Belum ada riwayat pembayaran.
          </Text>
        )}
      </VStack>
    </VStack>
  );
}
