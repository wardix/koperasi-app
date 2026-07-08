'use client';

import {useState, useEffect} from 'react';
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
  const tenorBulan = parseInt(loan.tenor) || 1; // Assuming format "X Bulan"
  const pokok = loan.amount;
  const bunga = loan.interestAmount || 0;
  const totalHutang = loan.totalAmount || (pokok + bunga);
  const angsuranPerBulan = Math.ceil(totalHutang / tenorBulan);
  
  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const remainingDebt = totalHutang - totalPaid;

  const handlePay = async () => {
    const amount = parseInt(payAmount, 10);
    if (!amount || amount <= 0 || amount > remainingDebt) return;
    
    setIsSubmitting(true);
    try {
      await api.post(`/api/loans/${loan.id}/payments`, {
        amount,
        method: 'Transfer'
      });
      
      toast.show({body: 'Pembayaran berhasil', type: 'info'});
        setPayAmount('');
        refetch();
        onUpdate();
        
        // auto-close if fully paid? We could, or just let user see remaining is 0
        if (remainingDebt - amount <= 0) {
           await api.put(`/api/loans/${loan.id}/status`, { status: 'Lunas' });
           onUpdate();
        }
    } catch (err) {
      toast.show({body: 'Gagal melakukan pembayaran', type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: TableColumn<Payment>[] = [
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
          + Rp {item.amount.toLocaleString('id-ID')}
        </Text>
      ),
    },
  ];

  return (
    <Layout
      header={
        <DialogHeader
          title={`Detail Pinjaman: ${loan.name}`}
          subtitle={`Tenor: ${loan.tenor}`}
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={6}>
            <HStack gap={4}>
              <VStack gap={1} style={{ flex: 1, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Pokok</Text>
                <Heading level={3}>Rp {pokok.toLocaleString('id-ID')}</Heading>
              </VStack>
              <VStack gap={1} style={{ flex: 1, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Bunga</Text>
                <Heading level={3}>Rp {bunga.toLocaleString('id-ID')}</Heading>
              </VStack>
            </HStack>
            <HStack gap={4}>
              <VStack gap={1} style={{ flex: 1, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Total Hutang</Text>
                <Heading level={3}>Rp {totalHutang.toLocaleString('id-ID')}</Heading>
              </VStack>
              <VStack gap={1} style={{ flex: 1, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
                <Text type="supporting" color="secondary">Sisa Hutang</Text>
                <Heading level={3} color={remainingDebt > 0 ? 'error' : 'success'}>
                  Rp {Math.max(0, remainingDebt).toLocaleString('id-ID')}
                </Heading>
              </VStack>
            </HStack>

            {remainingDebt > 0 && (
              <VStack gap={4}>
                <Heading level={4}>Bayar Angsuran</Heading>
                <Text type="supporting" color="secondary">
                  Angsuran per bulan yang disarankan: Rp {angsuranPerBulan.toLocaleString('id-ID')}
                </Text>
                <HStack gap={3} vAlign="end">
                  <div style={{ flex: 1 }}>
                    <TextInput
                      label="Nominal Pembayaran (Rp)"
                      value={payAmount}
                      onChange={setPayAmount}
                      type="number"
                      placeholder={`Saran: ${angsuranPerBulan}`}
                    />
                  </div>
                  <Button 
                    label="Bayar" 
                    onClick={handlePay} 
                    disabled={!payAmount || isSubmitting} 
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
