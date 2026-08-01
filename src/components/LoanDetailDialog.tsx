'use client';

import { useState, useCallback } from 'react';
import { DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, VStack, HStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { DateInput } from '@astryxdesign/core/DateInput';
import { useToast } from '@astryxdesign/core/Toast';
import { useApiQuery } from '../hooks/useApiQuery';
import { api, ApiError } from '../services/api';
import type { LoanRow } from '../shared/types';
import { useAuth } from '../hooks/useAuth';
import { LoanInfoSection } from './loan/LoanInfoSection';
import { LoanScheduleTable } from './loan/LoanScheduleTable';
import { LoanPaymentSection } from './loan/LoanPaymentSection';

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

export function LoanDetailDialogContent({
  loan,
  onClose,
  onUpdate,
}: {
  loan: LoanRow;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [disbursementDate, setDisbursementDate] = useState(() =>
    toIsoDateInput(loan.approvedAt || loan.createdAt || todayIsoDate())
  );
  const [isEditingDisbursement, setIsEditingDisbursement] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isApproved =
    loan.status === 'Disetujui' || loan.status === 'Lunas' || loan.status === 'Macet';
  const canEditDisbursement = hasPermission('approve:loans') && isApproved;
  const canEditSchedule = hasPermission('approve:loans') && isApproved;
  const canManagePayments = hasPermission('create:payments');

  const { data: payments, isLoading: isLoadingPayments, refetch: refetchPayments } =
    useApiQuery<Payment[]>(`/api/loans/${loan.id}/payments`);

  const { data: schedule, isLoading: scheduleLoading, refetch: refetchSchedule } =
    useApiQuery<ScheduleRow[]>(`/api/loans/${loan.id}/schedule`);

  const refreshAll = useCallback(() => {
    refetchPayments();
    refetchSchedule();
    onUpdate();
  }, [refetchPayments, refetchSchedule, onUpdate]);

  const handleSaveDisbursementDate = async () => {
    if (!disbursementDate) return;
    setIsSubmitting(true);
    try {
      await api.put(`/api/loans/${loan.id}/disbursement-date`, { disbursementDate });
      toast({ body: 'Tanggal pencairan diperbarui', type: 'info' });
      setIsEditingDisbursement(false);
      refreshAll();
    } catch (err) {
      toast({ body: errMessage(err, 'Gagal mengubah tanggal pencairan'), type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derived financial figures
  const tenorBulan = Number(loan.tenor) || 1;
  const pokok = Number(loan.amount);
  const biayaAdmin = Number(loan.interestAmount || 0);
  const totalHutang = Number(loan.totalAmount || pokok + biayaAdmin);
  const angsuranPerBulan = Math.ceil(totalHutang / tenorBulan);
  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const remainingDebt = totalHutang - totalPaid;
  const displayDisbursementDate = loan.approvedAt || loan.createdAt;

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
            {/* Summary cards */}
            <LoanInfoSection
              pokok={pokok}
              biayaAdmin={biayaAdmin}
              totalHutang={totalHutang}
              remainingDebt={remainingDebt}
            />

            {/* Disbursement date */}
            {isApproved && (
              <VStack
                gap={3}
                style={{
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-primary)',
                  backgroundColor: 'var(--color-background-secondary)',
                }}
              >
                <HStack hAlign="space-between" vAlign="center" style={{ width: '100%' }}>
                  <VStack gap={1}>
                    <Text type="body" weight="bold">Tanggal Pencairan</Text>
                    <Text type="supporting" color="secondary">
                      Dipakai di Arus Kas &amp; Transaksi Pinjaman (baris pencairan)
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

            {/* Schedule */}
            {isApproved && (
              <LoanScheduleTable
                loanId={loan.id}
                pokok={pokok}
                interestRate={loan.interestRate}
                schedule={schedule}
                scheduleLoading={scheduleLoading}
                canEditSchedule={canEditSchedule}
                isSubmitting={isSubmitting}
                onSaved={refreshAll}
              />
            )}

            {/* Payments */}
            <LoanPaymentSection
              loanId={loan.id}
              totalHutang={totalHutang}
              angsuranPerBulan={angsuranPerBulan}
              payments={payments}
              isLoadingPayments={isLoadingPayments}
              canManagePayments={canManagePayments}
              onSaved={refreshAll}
            />
          </VStack>
        </LayoutContent>
      }
    />
  );
}
