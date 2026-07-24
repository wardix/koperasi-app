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
  nik: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || /^\d{16}$/.test(v), {
      message: 'NIK harus 16 digit angka (atau kosongkan)',
    }),
  phone: z
    .string()
    .transform((v) => {
      const t = v.trim();
      if (!t) return '';
      const hasPlus = t.startsWith('+');
      const digits = t.replace(/\D/g, '');
      return hasPlus ? `+${digits}` : digits;
    })
    .refine((v) => {
      if (!v) return true;
      const digits = v.replace(/\D/g, '');
      return digits.length >= 8 && digits.length <= 15;
    }, { message: 'Nomor telepon 8–15 digit (atau kosongkan)' }),
  role: z.string().min(1, 'Jabatan tidak boleh kosong'),
  joinDate: z.string().min(1, 'Tanggal bergabung harus diisi'),
  deposit: z
    .string()
    .refine((val) => {
      const n = parseAmountInput(val);
      return Number.isFinite(n) && n >= 0;
    }, 'Setoran awal tidak boleh negatif'),
});
type MemberForm = z.infer<typeof memberSchema>;

export function AddMemberDialogContent({onClose, onAdd}: {onClose: () => void, onAdd: (m: Omit<MemberRow, 'id' | 'simpananWajib' | 'simpananSukarela' | 'totalSavings'>) => void}) {
  const { control, handleSubmit, formState: { errors } } = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: '',
      nik: '',
      phone: '',
      role: 'Anggota',
      joinDate: todayISO(),
      deposit: formatAmountInput('500000'),
    }
  });

  const onSubmit = (data: MemberForm) => {
    onAdd({
      name: data.name,
      nik: data.nik || null,
      phone: data.phone || null,
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
                name="nik"
                control={control}
                render={({ field }) => (
                  <VStack gap={1}>
                    <TextInput
                      label="NIK"
                      value={field.value}
                      onChange={(raw) => field.onChange(raw.replace(/\D/g, '').slice(0, 16))}
                      placeholder="16 digit NIK (opsional)"
                      description="Nomor Induk Kependudukan — unik per anggota"
                      type="text"
                    />
                    {errors.nik && (
                      <Text
                        type="supporting"
                        color="error"
                        style={{ color: 'var(--color-text-critical, red)' }}
                      >
                        {errors.nik.message}
                      </Text>
                    )}
                  </VStack>
                )}
              />
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <VStack gap={1}>
                    <TextInput
                      label="Nomor Telepon"
                      value={field.value}
                      onChange={(raw) => {
                        // keep + and digits only while typing
                        let s = raw.replace(/[^\d+]/g, '');
                        if (s.includes('+')) {
                          s = '+' + s.replace(/\+/g, '').replace(/\D/g, '');
                        } else {
                          s = s.replace(/\D/g, '');
                        }
                        field.onChange(s.slice(0, 16));
                      }}
                      placeholder="Contoh: 081234567890"
                      description="Opsional — 8–15 digit, boleh diawali +"
                      type="text"
                    />
                    {errors.phone && (
                      <Text
                        type="supporting"
                        color="error"
                        style={{ color: 'var(--color-text-critical, red)' }}
                      >
                        {errors.phone.message}
                      </Text>
                    )}
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

