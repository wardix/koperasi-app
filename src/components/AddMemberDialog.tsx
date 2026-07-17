'use client';

import {DialogHeader} from '@astryxdesign/core/Dialog';
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Text} from '@astryxdesign/core/Text';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { MemberRow } from '../shared/types';
import {formatAmountInput, parseAmountInput} from '../utils/format';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatJoinDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'});
}

const memberSchema = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter'),
  role: z.string().min(1, 'Jabatan tidak boleh kosong'),
  joinDate: z.string().min(1, 'Tanggal bergabung harus diisi'),
  deposit: z.string().refine(val => parseAmountInput(val) >= 10000, 'Setoran minimal Rp 10.000'),
});
type MemberForm = z.infer<typeof memberSchema>;

export function AddMemberDialogContent({onClose, onAdd}: {onClose: () => void, onAdd: (m: Omit<MemberRow, 'id' | 'simpananWajib' | 'simpananSukarela' | 'totalSavings'>) => void}) {
  const { control, handleSubmit, formState: { errors } } = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: '',
      role: 'Anggota',
      joinDate: todayISO(),
      deposit: formatAmountInput('500000'),
    }
  });

  const onSubmit = (data: MemberForm) => {
    onAdd({
      name: data.name,
      role: data.role,
      status: 'Aktif',
      joinDate: formatJoinDate(data.joinDate),
      simpananPokok: parseAmountInput(data.deposit),
      simpananWajib: 0,
      simpananSukarela: 0,
    });
    onClose();
  };

  return (
    <Layout
      header={
        <DialogHeader
          title="Tambah Anggota Baru"
          subtitle="Masukkan data pendaftaran anggota koperasi"
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <form id="add-member-form" onSubmit={handleSubmit(onSubmit)}>
            <VStack gap={4}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <VStack gap={1}>
                    <TextInput
                      label="Nama Lengkap"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Contoh: Budi Santoso"
                    />
                    {errors.name && <Text type="supporting" color="error" style={{color: 'var(--color-text-critical, red)'}}>{errors.name.message}</Text>}
                  </VStack>
                )}
              />
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <VStack gap={1}>
                    <TextInput
                      label="Jabatan"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Contoh: Anggota, Pengurus"
                    />
                    {errors.role && <Text type="supporting" color="error" style={{color: 'var(--color-text-critical, red)'}}>{errors.role.message}</Text>}
                  </VStack>
                )}
              />
              <Controller
                name="joinDate"
                control={control}
                render={({ field }) => (
                  <VStack gap={1}>
                    <TextInput
                      label="Tanggal Bergabung"
                      value={field.value}
                      onChange={field.onChange}
                      type="date"
                    />
                    {errors.joinDate && <Text type="supporting" color="error" style={{color: 'var(--color-text-critical, red)'}}>{errors.joinDate.message}</Text>}
                  </VStack>
                )}
              />
              <Controller
                name="deposit"
                control={control}
                render={({ field }) => (
                  <VStack gap={1}>
                    <TextInput
                      label="Setoran Awal (Simpanan Pokok) (Rp)"
                      value={field.value}
                      onChange={(raw) => field.onChange(formatAmountInput(raw))}
                      type="text"
                      placeholder="Contoh: 500.000"
                      description="Pemisah ribuan ditambahkan otomatis"
                    />
                    {errors.deposit && <Text type="supporting" color="error" style={{color: 'var(--color-text-critical, red)'}}>{errors.deposit.message}</Text>}
                  </VStack>
                )}
              />
            </VStack>
          </form>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label="Batal" variant="secondary" onClick={onClose} />
            <Button label="Simpan Data" variant="primary" type="submit" form="add-member-form" />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}

