import {useMemo} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Button} from '@astryxdesign/core/Button';
import {Typeahead} from '@astryxdesign/core/Typeahead';
import type {SearchableItem, SearchSource} from '@astryxdesign/core/Typeahead';
import {useApiQuery} from '../hooks/useApiQuery';
import type {PaginatedResponse, MemberRow, LoanRow, SettingsData} from '../shared/types';
import {formatAmountInput, formatRp, parseAmountInput} from '../utils/format';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface Props {
  onClose: () => void;
  onAdd: (loan: Omit<LoanRow, 'id'> & { loanDate?: string }) => void;
}

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function simulateAnnuity(amount: number, tenorMonths: number, annualRatePercent: number) {
  const tenor = Math.max(1, tenorMonths || 1);
  if (amount <= 0) return null;

  if (annualRatePercent <= 0) {
    return {
      interestAmount: 0,
      totalRepayment: amount,
      monthlyInstallment: Math.ceil(amount / tenor),
      bungaRate: annualRatePercent,
    };
  }

  const i = annualRatePercent / 1200;
  const power = Math.pow(1 + i, tenor);
  const monthlyInstallment = Math.ceil((amount * (i * power)) / (power - 1));
  const totalRepayment = monthlyInstallment * tenor;
  const interestAmount = totalRepayment - amount;

  return {
    interestAmount,
    totalRepayment,
    monthlyInstallment,
    bungaRate: annualRatePercent,
  };
}

const loanSchema = z.object({
  // Member ids are string UUIDs / text keys (not numbers)
  selectedMember: z
    .object({
      id: z.union([z.string(), z.number()]).transform(String),
      label: z.string().min(1),
    })
    .nullable()
    .refine((v): v is { id: string; label: string } => v != null && Boolean(v.id), {
      message: 'Pilih anggota terlebih dahulu',
    }),
  amount: z.string().refine((val) => parseAmountInput(val) > 0, 'Jumlah pinjaman tidak valid'),
  tenor: z
    .string()
    .refine((val) => (parseInt(val.replace(/\D/g, ''), 10) || 0) > 0, 'Tenor tidak valid'),
  purpose: z.string().min(3, 'Tujuan pinjaman minimal 3 karakter'),
  loanDate: z.string().min(1, 'Tanggal pinjaman harus diisi'),
});
type LoanForm = z.infer<typeof loanSchema>;

export function AddLoanDialogContent({onClose, onAdd}: Props) {
  const { control, handleSubmit, watch, formState: { errors } } = useForm<LoanForm>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      selectedMember: null,
      amount: '',
      tenor: '12',
      purpose: '',
      loanDate: todayIsoDate(),
    },
  });

  const { data: membersRes } = useApiQuery<PaginatedResponse<MemberRow>>('/api/members?page=1&limit=1000');
  const { data: settings } = useApiQuery<SettingsData>('/api/settings');
  
  const members = membersRes?.data || [];
  const bungaRate = parseFloat(settings?.bungaPinjaman || '0') || 0;

  const memberItems: SearchableItem[] = useMemo(() => {
    return members.map(m => ({ id: m.id, label: m.name }));
  }, [members]);

  const memberSearchSource: SearchSource<SearchableItem> = {
    search: (query: string) =>
      memberItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      ),
    bootstrap: () => memberItems,
  };

  const amountStr = watch('amount');
  const tenorStr = watch('tenor');

  const parsedAmount = parseAmountInput(amountStr || '');
  const parsedTenor = parseInt(tenorStr || '12', 10) || 12;
  const simulation = useMemo(
    () => simulateAnnuity(parsedAmount, parsedTenor, bungaRate),
    [parsedAmount, parsedTenor, bungaRate]
  );

  const onSubmit = (data: LoanForm) => {
    const member = data.selectedMember;
    if (!member) return;
    onAdd({
      memberId: String(member.id),
      name: member.label,
      amount: parseAmountInput(data.amount),
      tenor: parseInt(data.tenor.replace(/\D/g, ''), 10),
      purpose: data.purpose,
      status: 'Menunggu',
      loanDate: data.loanDate,
    });
    onClose();
  };

  const selectedMemberError =
    errors.selectedMember?.message ||
    (errors.selectedMember as { id?: { message?: string } } | undefined)?.id?.message;

  return (
    <form id="add-loan-form" onSubmit={handleSubmit(onSubmit)}>
      <VStack padding={4} gap={4} style={{ width: '100%', boxSizing: 'border-box' }}>
        <VStack gap={1}>
          <Heading level={3}>Tambah Pengajuan Pinjaman</Heading>
          <Text type="supporting" color="secondary">
            Masukkan detail pengajuan pinjaman. Tanggal bisa diisi mundur untuk data historis.
          </Text>
        </VStack>
        
        <VStack gap={3}>
          <Controller
            name="selectedMember"
            control={control}
            render={({ field }) => (
              <VStack gap={1}>
                <Typeahead
                  label="Pilih Anggota"
                  placeholder="Cari anggota..."
                  searchSource={memberSearchSource}
                  value={field.value as SearchableItem | null}
                  onChange={field.onChange}
                  hasEntriesOnFocus
                />
                {selectedMemberError ? (
                  <Text type="supporting" color="error" style={{ color: 'var(--color-text-critical, red)' }}>
                    {selectedMemberError}
                  </Text>
                ) : null}
              </VStack>
            )}
          />
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <VStack gap={1}>
                <TextInput
                  label="Jumlah Pinjaman (Rp)"
                  type="text"
                  value={field.value}
                  onChange={(raw) => field.onChange(formatAmountInput(raw))}
                  placeholder="Contoh: 5.000.000"
                  description="Pemisah ribuan ditambahkan otomatis"
                />
                {errors.amount && <Text type="supporting" color="error" style={{color: 'var(--color-text-critical, red)'}}>{errors.amount.message}</Text>}
              </VStack>
            )}
          />
          <Controller
            name="tenor"
            control={control}
            render={({ field }) => (
              <VStack gap={1}>
                <TextInput
                  label="Tenor (Bulan)"
                  type="text"
                  value={field.value}
                  onChange={(raw) => field.onChange(raw.replace(/\D/g, ''))}
                  placeholder="12"
                />
                {errors.tenor && <Text type="supporting" color="error" style={{color: 'var(--color-text-critical, red)'}}>{errors.tenor.message}</Text>}
              </VStack>
            )}
          />
          <Controller
            name="purpose"
            control={control}
            render={({ field }) => (
              <VStack gap={1}>
                <TextInput
                  label="Tujuan Pinjaman"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Contoh: Modal Usaha"
                />
                {errors.purpose && <Text type="supporting" color="error" style={{color: 'var(--color-text-critical, red)'}}>{errors.purpose.message}</Text>}
              </VStack>
            )}
          />
          <Controller
            name="loanDate"
            control={control}
            render={({ field }) => (
              <VStack gap={1}>
                <DateInput
                  label="Tanggal Pinjaman"
                  description="Tanggal pengajuan/pencairan. Bisa diisi mundur untuk data lama."
                  value={field.value}
                  onChange={(val) => field.onChange(val ?? todayIsoDate())}
                  max={todayIsoDate()}
                  isRequired
                />
                {errors.loanDate && <Text type="supporting" color="error" style={{color: 'var(--color-text-critical, red)'}}>{errors.loanDate.message}</Text>}
              </VStack>
            )}
          />
        </VStack>

        <VStack
          gap={2}
          style={{
            padding: 'var(--spacing-4)',
            backgroundColor: 'var(--color-background-secondary, var(--color-background-body))',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-border-primary, var(--color-border, #e5e7eb))',
            width: '100%',
          }}
        >
          <Text type="body" weight="bold">
            Simulasi Anuitas
            {simulation ? ` (Bunga ${simulation.bungaRate}% p.a.)` : ''}
          </Text>
          {!simulation ? (
            <Text type="supporting" color="secondary">
              Isi jumlah pinjaman di atas untuk melihat estimasi bunga dan angsuran.
            </Text>
          ) : (
            <>
              {bungaRate <= 0 && (
                <Text type="supporting" color="secondary">
                  Bunga pinjaman di Pengaturan saat ini 0%. Ubah di Pengaturan → Bunga Pinjaman jika perlu.
                </Text>
              )}
              <HStack hAlign="space-between" style={{ width: '100%' }}>
                <Text type="supporting" color="secondary">Pokok Pinjaman</Text>
                <Text type="body" weight="semibold">{formatRp(parsedAmount)}</Text>
              </HStack>
              <HStack hAlign="space-between" style={{ width: '100%' }}>
                <Text type="supporting" color="secondary">Total Bunga ({parsedTenor} bln)</Text>
                <Text type="body" weight="semibold">{formatRp(simulation.interestAmount)}</Text>
              </HStack>
              <HStack
                hAlign="space-between"
                style={{
                  width: '100%',
                  borderTop: '1px dashed var(--color-border-primary, #e5e7eb)',
                  paddingTop: 'var(--spacing-2)',
                  marginTop: 'var(--spacing-1)',
                }}
              >
                <Text type="body" weight="bold">Total Pengembalian</Text>
                <Text type="body" weight="bold" color="accent">{formatRp(simulation.totalRepayment)}</Text>
              </HStack>
              <HStack hAlign="space-between" style={{ width: '100%' }}>
                <Text type="body" weight="bold">Angsuran per Bulan</Text>
                <Text type="body" weight="bold" color="accent">
                  {formatRp(simulation.monthlyInstallment)} / bln
                </Text>
              </HStack>
            </>
          )}
        </VStack>

        <HStack
          gap={2}
          hAlign="end"
          style={{
            position: 'sticky',
            bottom: 0,
            paddingTop: 'var(--spacing-3)',
            paddingBottom: 'var(--spacing-1)',
            backgroundColor: 'var(--color-background-primary, var(--color-background-body, #fff))',
            borderTop: '1px solid var(--color-border-primary, rgba(0,0,0,0.08))',
            zIndex: 1,
          }}
        >
          <Button label="Batal" variant="secondary" onClick={onClose} />
          <Button label="Simpan" variant="primary" type="submit" />
        </HStack>
      </VStack>
    </form>
  );
}
