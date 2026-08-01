'use client';

import {useState, useMemo, useEffect, useCallback} from 'react';
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
import {api, ApiError} from '../services/api';
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

interface ScheduleRow {
  id: string;
  installmentNo: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  paidAmount: number;
  status: string;
}

/** Editable draft row (amounts as formatted strings for inputs). */
type ScheduleDraft = {
  installmentNo: number;
  dueDate: string;
  principalAmount: string;
  interestAmount: string;
  paidAmount: number;
  status: string;
};

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

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function scheduleToDraft(rows: ScheduleRow[]): ScheduleDraft[] {
  return rows.map((r) => ({
    installmentNo: r.installmentNo,
    dueDate: toIsoDateInput(r.dueDate),
    principalAmount: formatAmountInput(String(Math.round(Number(r.principalAmount)))),
    interestAmount: formatAmountInput(String(Math.round(Number(r.interestAmount)))),
    paidAmount: Number(r.paidAmount || 0),
    status: r.status,
  }));
}

export function LoanDetailDialogContent({
  loan,
  onClose,
  onUpdate,
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
  const [rateInput, setRateInput] = useState(
    loan.interestRate != null ? String(loan.interestRate) : '18'
  );
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft[]>([]);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  const toast = useToast();
  const {hasPermission} = useAuth();
  const canManagePayments = hasPermission('create:payments');
  const isApproved =
    loan.status === 'Disetujui' || loan.status === 'Lunas' || loan.status === 'Macet';
  const canEditDisbursement = hasPermission('approve:loans') && isApproved;
  const canEditSchedule = hasPermission('approve:loans') && isApproved;

  const {data: payments, isLoading, refetch} = useApiQuery<Payment[]>(
    `/api/loans/${loan.id}/payments`
  );
  const {
    data: schedule,
    isLoading: scheduleLoading,
    refetch: refetchSchedule,
  } = useApiQuery<ScheduleRow[]>(`/api/loans/${loan.id}/schedule`);

  useEffect(() => {
    if (schedule && !isEditingSchedule) {
      setScheduleDraft(scheduleToDraft(schedule));
    }
  }, [schedule, isEditingSchedule]);

  useEffect(() => {
    if (loan.interestRate != null) {
      setRateInput(String(loan.interestRate));
    }
  }, [loan.interestRate]);

  const tenorBulan = Number(loan.tenor) || 1;
  const pokok = Number(loan.amount);
  const biayaAdmin = Number(loan.interestAmount || 0);
  const totalHutang = Number(loan.totalAmount || pokok + biayaAdmin);
  const angsuranPerBulan = Math.ceil(totalHutang / tenorBulan);

  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const remainingDebt = totalHutang - totalPaid;
  const displayDisbursementDate = loan.approvedAt || loan.createdAt;

  const draftPrincipalSum = useMemo(
    () => scheduleDraft.reduce((s, r) => s + parseAmountInput(r.principalAmount), 0),
    [scheduleDraft]
  );
  const draftAdminSum = useMemo(
    () => scheduleDraft.reduce((s, r) => s + parseAmountInput(r.interestAmount), 0),
    [scheduleDraft]
  );
  const principalMismatch = scheduleDraft.length > 0 && draftPrincipalSum !== pokok;

  const refreshAll = useCallback(() => {
    refetch();
    refetchSchedule();
    onUpdate();
  }, [refetch, refetchSchedule, onUpdate]);

  const handleSaveDisbursementDate = async () => {
    if (!disbursementDate) return;
    setIsSubmitting(true);
    try {
      await api.put(`/api/loans/${loan.id}/disbursement-date`, {
        disbursementDate,
      });
      toast({body: 'Tanggal pencairan diperbarui', type: 'info'});
      setIsEditingDisbursement(false);
      refreshAll();
    } catch (err) {
      toast({body: errMessage(err, 'Gagal mengubah tanggal pencairan'), type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerateSchedule = async () => {
    const rate = Number(String(rateInput).replace(',', '.'));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast({body: 'Biaya admin harus 0–100 (% per tahun)', type: 'error'});
      return;
    }
    if (
      !window.confirm(
        `Generate ulang jadwal angsuran dengan biaya admin ${rate}% p.a.?\n` +
          'Pembayaran yang sudah ada akan dialokasikan ulang ke jadwal baru.'
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/api/loans/${loan.id}/schedule/regenerate`, {interestRate: rate});
      toast({body: 'Jadwal angsuran di-generate ulang', type: 'info'});
      setIsEditingSchedule(false);
      refreshAll();
    } catch (err) {
      toast({body: errMessage(err, 'Gagal generate jadwal'), type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleDraft.length) {
      toast({body: 'Jadwal kosong', type: 'error'});
      return;
    }
    if (principalMismatch) {
      toast({
        body: `Jumlah pokok jadwal (${formatRp(draftPrincipalSum)}) harus sama dengan plafon (${formatRp(pokok)})`,
        type: 'error',
      });
      return;
    }
    if (
      !window.confirm(
        'Simpan perubahan jadwal angsuran? Pembayaran yang sudah ada akan dialokasikan ulang.'
      )
    ) {
      return;
    }

    const rows = scheduleDraft.map((r) => ({
      installmentNo: r.installmentNo,
      dueDate: r.dueDate,
      principalAmount: parseAmountInput(r.principalAmount),
      interestAmount: parseAmountInput(r.interestAmount),
    }));

    setIsSubmitting(true);
    try {
      await api.put(`/api/loans/${loan.id}/schedule`, {rows});
      toast({body: 'Jadwal angsuran disimpan', type: 'info'});
      setIsEditingSchedule(false);
      refreshAll();
    } catch (err) {
      toast({body: errMessage(err, 'Gagal menyimpan jadwal'), type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateDraftRow = (index: number, patch: Partial<ScheduleDraft>) => {
    setScheduleDraft((prev) => prev.map((row, i) => (i === index ? {...row, ...patch} : row)));
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
      toast({body: errMessage(err, 'Gagal melakukan pembayaran'), type: 'error'});
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
      toast({body: errMessage(err, 'Gagal mengubah pembayaran'), type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (payment: Payment) => {
    if (
      !window.confirm(
        `Hapus angsuran ${formatRp(payment.amount)}? Jadwal dan sisa hutang akan dihitung ulang.`
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      await api.delete(`/api/loans/${loan.id}/payments/${payment.id}`);
      toast({body: 'Pembayaran dihapus', type: 'info'});
      if (editing?.id === payment.id) cancelEdit();
      refreshAll();
    } catch (err) {
      toast({body: errMessage(err, 'Gagal menghapus pembayaran'), type: 'error'});
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
              <VStack
                gap={1}
                style={{
                  flex: 1,
                  padding: 16,
                  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                  borderRadius: 8,
                }}
              >
                <Text type="supporting" color="secondary">
                  Pokok
                </Text>
                <Heading level={3}>{formatRp(pokok)}</Heading>
              </VStack>
              <VStack
                gap={1}
                style={{
                  flex: 1,
                  padding: 12,
                  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                  borderRadius: 8,
                }}
              >
                <Text type="supporting" color="secondary">
                  Total Biaya Admin
                </Text>
                <Heading level={3}>{formatRp(biayaAdmin)}</Heading>
              </VStack>
            </HStack>
            <HStack gap={4}>
              <VStack
                gap={1}
                style={{
                  flex: 1,
                  padding: 16,
                  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                  borderRadius: 8,
                }}
              >
                <Text type="supporting" color="secondary">
                  Total Hutang
                </Text>
                <Heading level={3}>{formatRp(totalHutang)}</Heading>
              </VStack>
              <VStack
                gap={1}
                style={{
                  flex: 1,
                  padding: 16,
                  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                  borderRadius: 8,
                }}
              >
                <Text type="supporting" color="secondary">
                  Sisa Hutang
                </Text>
                <Heading level={3}>{formatRp(Math.max(0, remainingDebt))}</Heading>
              </VStack>
            </HStack>

            {isApproved && (
              <VStack
                gap={3}
                style={{
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--color-border-primary, #e5e7eb)',
                  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                }}
              >
                <HStack hAlign="space-between" vAlign="center" style={{width: '100%'}}>
                  <VStack gap={1}>
                    <Text type="body" weight="bold">
                      Tanggal Pencairan
                    </Text>
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

            {isApproved && (
              <VStack
                gap={4}
                style={{
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--color-border-primary, #e5e7eb)',
                }}
              >
                <HStack hAlign="space-between" vAlign="center" wrap="wrap" gap={2}>
                  <VStack gap={1}>
                    <Heading level={4}>Jadwal Angsuran</Heading>
                    <Text type="supporting" color="secondary">
                      Rate saat ini:{' '}
                      {loan.interestRate != null ? `${loan.interestRate}% p.a.` : '—'} ·{' '}
                      {schedule?.length ?? 0} cicilan
                    </Text>
                  </VStack>
                  {canEditSchedule && !isEditingSchedule && (
                    <Button
                      label="Edit Jadwal"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (schedule) setScheduleDraft(scheduleToDraft(schedule));
                        setIsEditingSchedule(true);
                      }}
                      isDisabled={scheduleLoading || !schedule?.length}
                    />
                  )}
                </HStack>

                {canEditSchedule && (
                  <VStack
                    gap={3}
                    style={{
                      padding: 'var(--spacing-3)',
                      borderRadius: 'var(--radius-md, 8px)',
                      backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                    }}
                  >
                    <Text type="body" weight="semibold">
                      Generate ulang dengan rate baru
                    </Text>
                    <Text type="supporting" color="secondary">
                      Mengganti seluruh jadwal pakai rumus anuitas. Pembayaran tetap ada dan
                      dialokasikan ulang.
                    </Text>
                    <HStack gap={3} wrap="wrap" vAlign="end">
                      <div style={{minWidth: 160, flex: 1}}>
                        <TextInput
                          label="Biaya Admin (% p.a.)"
                          value={rateInput}
                          onChange={(raw) => setRateInput(raw.replace(/[^\d.,]/g, ''))}
                          type="text"
                          placeholder="18"
                        />
                      </div>
                      <Button
                        label="Generate Ulang"
                        variant="primary"
                        onClick={handleRegenerateSchedule}
                        isDisabled={isSubmitting}
                      />
                    </HStack>
                  </VStack>
                )}

                {scheduleLoading ? (
                  <Center style={{height: 80}}>
                    <Spinner size="md" />
                  </Center>
                ) : !scheduleDraft.length ? (
                  <Text type="supporting" color="secondary">
                    Belum ada jadwal angsuran.
                  </Text>
                ) : isEditingSchedule ? (
                  <VStack gap={3}>
                    <Text
                      type="supporting"
                      color={principalMismatch ? 'critical' : 'secondary'}
                    >
                      Jumlah pokok semua baris harus = plafon ({formatRp(pokok)}). Saat ini:{' '}
                      {formatRp(draftPrincipalSum)} · Total biaya admin: {formatRp(draftAdminSum)}
                    </Text>
                    <div style={{overflowX: 'auto', width: '100%'}}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: 'var(--font-size-sm, 13px)',
                        }}
                      >
                        <thead>
                          <tr>
                            <th style={{textAlign: 'left', padding: '6px 4px'}}>#</th>
                            <th style={{textAlign: 'left', padding: '6px 4px'}}>Jatuh Tempo</th>
                            <th style={{textAlign: 'left', padding: '6px 4px'}}>Pokok</th>
                            <th style={{textAlign: 'left', padding: '6px 4px'}}>Biaya Admin</th>
                            <th style={{textAlign: 'left', padding: '6px 4px'}}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scheduleDraft.map((row, index) => (
                            <tr key={row.installmentNo}>
                              <td style={{padding: '6px 4px'}}>{row.installmentNo}</td>
                              <td style={{padding: '6px 4px', minWidth: 140}}>
                                <input
                                  type="date"
                                  value={row.dueDate}
                                  onChange={(e) =>
                                    updateDraftRow(index, {dueDate: e.target.value})
                                  }
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--color-border-primary, #ccc)',
                                  }}
                                />
                              </td>
                              <td style={{padding: '6px 4px', minWidth: 120}}>
                                <input
                                  type="text"
                                  value={row.principalAmount}
                                  onChange={(e) =>
                                    updateDraftRow(index, {
                                      principalAmount: formatAmountInput(e.target.value),
                                    })
                                  }
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--color-border-primary, #ccc)',
                                  }}
                                />
                              </td>
                              <td style={{padding: '6px 4px', minWidth: 120}}>
                                <input
                                  type="text"
                                  value={row.interestAmount}
                                  onChange={(e) =>
                                    updateDraftRow(index, {
                                      interestAmount: formatAmountInput(e.target.value),
                                    })
                                  }
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--color-border-primary, #ccc)',
                                  }}
                                />
                              </td>
                              <td style={{padding: '6px 4px'}}>
                                <Text type="supporting">
                                  {row.status === 'Paid'
                                    ? 'Lunas'
                                    : row.status === 'Late'
                                      ? 'Terlambat'
                                      : 'Belum'}
                                </Text>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <HStack gap={2} hAlign="end">
                      <Button
                        label="Batal"
                        variant="secondary"
                        onClick={() => {
                          if (schedule) setScheduleDraft(scheduleToDraft(schedule));
                          setIsEditingSchedule(false);
                        }}
                        isDisabled={isSubmitting}
                      />
                      <Button
                        label="Simpan Jadwal"
                        variant="primary"
                        onClick={handleSaveSchedule}
                        isDisabled={isSubmitting || principalMismatch}
                      />
                    </HStack>
                  </VStack>
                ) : (
                  <div style={{overflowX: 'auto', width: '100%'}}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 'var(--font-size-sm, 13px)',
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={{textAlign: 'left', padding: '8px 4px'}}>#</th>
                          <th style={{textAlign: 'left', padding: '8px 4px'}}>Jatuh Tempo</th>
                          <th style={{textAlign: 'right', padding: '8px 4px'}}>Pokok</th>
                          <th style={{textAlign: 'right', padding: '8px 4px'}}>Biaya Admin</th>
                          <th style={{textAlign: 'right', padding: '8px 4px'}}>Tagihan</th>
                          <th style={{textAlign: 'left', padding: '8px 4px'}}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleDraft.map((row) => {
                          const p = parseAmountInput(row.principalAmount);
                          const i = parseAmountInput(row.interestAmount);
                          return (
                            <tr
                              key={row.installmentNo}
                              style={{
                                borderTop: '1px solid var(--color-border-primary, #eee)',
                              }}
                            >
                              <td style={{padding: '8px 4px'}}>{row.installmentNo}</td>
                              <td style={{padding: '8px 4px'}}>
                                {new Date(row.dueDate + 'T00:00:00').toLocaleDateString(
                                  'id-ID',
                                  {day: '2-digit', month: 'short', year: 'numeric'}
                                )}
                              </td>
                              <td style={{padding: '8px 4px', textAlign: 'right'}}>
                                {formatRp(p)}
                              </td>
                              <td style={{padding: '8px 4px', textAlign: 'right'}}>
                                {formatRp(i)}
                              </td>
                              <td style={{padding: '8px 4px', textAlign: 'right'}}>
                                {formatRp(p + i)}
                              </td>
                              <td style={{padding: '8px 4px'}}>
                                {row.status === 'Paid'
                                  ? 'Lunas'
                                  : row.status === 'Late'
                                    ? 'Terlambat'
                                    : 'Belum'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--color-border-primary, #e5e7eb)',
                  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                }}
              >
                <Heading level={4}>Ubah Angsuran</Heading>
                <Text type="supporting" color="secondary">
                  Ubah nominal atau tanggal. Alokasi jadwal dan sisa hutang dihitung ulang
                  otomatis.
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
                <Center style={{height: 100}}>
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
        </LayoutContent>
      }
    />
  );
}
