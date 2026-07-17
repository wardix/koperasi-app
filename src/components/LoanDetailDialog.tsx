'use client';

import {useState, useEffect, useMemo} from 'react';
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
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Badge} from '@astryxdesign/core/Badge';
import {useApiQuery} from '../hooks/useApiQuery';
import {api} from '../services/api';
import {useToast} from '@astryxdesign/core/Toast';
import type {LoanRow} from '../shared/types';
import {formatAmountInput, formatRp, parseAmountInput} from '../utils/format';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Center} from '@astryxdesign/core/Center';

interface Payment {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  method: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const { data: payments, isLoading, refetch } = useApiQuery<Payment[]>(`/api/loans/${loan.id}/payments`);

  // Calculations
  const tenorBulan = loan.tenor;
  const pokok = loan.amount;
  const bunga = loan.interestAmount || 0;
  const totalHutang = loan.totalAmount || (pokok + bunga);
  const angsuranPerBulan = Math.ceil(totalHutang / tenorBulan);
  
  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const remainingDebt = totalHutang - totalPaid;

  const handlePay = async () => {
    const amount = parseAmountInput(payAmount);
    if (!amount || amount <= 0 || amount > remainingDebt) return;
    
    setIsSubmitting(true);
    try {
      await api.post(`/api/loans/${loan.id}/payments`, {
        amount,
        method: 'Transfer'
      });
      
      toast({body: 'Pembayaran berhasil', type: 'info'});
        setPayAmount('');
        refetch();
        onUpdate();
        
        // auto-close if fully paid? We could, or just let user see remaining is 0
        if (remainingDebt - amount <= 0) {
           await api.put(`/api/loans/${loan.id}/status`, { status: 'Lunas' });
           onUpdate();
        }
    } catch (err) {
      toast({body: 'Gagal melakukan pembayaran', type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: TableColumn<Payment>[] = useMemo(() => [
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
        <Text type="body" color="success">
          + {formatRp(item.amount)}
        </Text>
      ),
    },
  ], []);

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
              <VStack gap={1} style={{ flex: 1, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Pokok</Text>
                <Heading level={3}>{formatRp(pokok)}</Heading>
              </VStack>
              <VStack gap={1} style={{ flex: 1, padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <Text type="supporting" color="secondary">Total Bunga</Text>
                <Heading level={3}>{formatRp(bunga)}</Heading>
              </VStack>
            </HStack>
            <HStack gap={4}>
              <VStack gap={1} style={{ flex: 1, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Total Hutang</Text>
                <Heading level={3}>{formatRp(totalHutang)}</Heading>
              </VStack>
              <VStack gap={1} style={{ flex: 1, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Sisa Hutang</Text>
                <Heading level={3} color={remainingDebt > 0 ? 'error' : 'success'}>
                  {formatRp(Math.max(0, remainingDebt))}
                </Heading>
              </VStack>
            </HStack>

            {remainingDebt > 0 && (
              <VStack gap={4}>
                <Heading level={4}>Bayar Angsuran</Heading>
                <Text type="supporting" color="secondary">
                  Angsuran per bulan yang disarankan: {formatRp(angsuranPerBulan)}
                </Text>
                <HStack gap={3} vAlign="end">
                  <div style={{ flex: 1 }}>
                    <TextInput
                      label="Nominal Pembayaran (Rp)"
                      value={payAmount}
                      onChange={(raw) => setPayAmount(formatAmountInput(raw))}
                      type="text"
                      placeholder={`Saran: ${formatAmountInput(String(angsuranPerBulan))}`}
                      description="Pemisah ribuan ditambahkan otomatis"
                    />
                  </div>
                  <Button 
                    label="Bayar" 
                    onClick={handlePay} 
                    disabled={!payAmount || parseAmountInput(payAmount) <= 0 || isSubmitting} 
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
