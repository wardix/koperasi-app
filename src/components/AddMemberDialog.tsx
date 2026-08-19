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
import {Heading} from '@astryxdesign/core/Text';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {formatAmountInput, parseAmountInput} from '../utils/format';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatJoinDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'});
}

const memberFormSchema = z
  .object({
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
    email: z
      .string()
      .transform((v) => v.trim().toLowerCase())
      .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
        message: 'Format email tidak valid',
      }),
    password: z.string(),
    passwordConfirm: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password && data.password.length > 0 && data.password.length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Password minimal 8 karakter',
      });
    }
    if (data.password && data.password !== data.passwordConfirm) {
      ctx.addIssue({
        code: 'custom',
        path: ['passwordConfirm'],
        message: 'Konfirmasi password tidak cocok',
      });
    }
    if (data.password && data.password.length > 0 && !data.email) {
      ctx.addIssue({
        code: 'custom',
        path: ['email'],
        message: 'Email portal wajib diisi jika password diisi',
      });
    }
  });

type MemberForm = z.infer<typeof memberFormSchema>;

/** Payload sent to POST /api/members */
export type CreateMemberPayload = {
  name: string;
  role: string;
  status: string;
  joinDate: string;
  nik?: string | null;
  phone?: string | null;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  email?: string | null;
  password?: string | null;
};

export function AddMemberDialogContent({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (m: CreateMemberPayload) => void;
}) {
  const defaultSimpananPokokEnv = import.meta.env.VITE_DEFAULT_SIMPANAN_POKOK;
  const initialDepositStr = defaultSimpananPokokEnv !== undefined && defaultSimpananPokokEnv !== ''
    ? defaultSimpananPokokEnv
    : '0';

  const { control, handleSubmit, formState: { errors } } = useForm<MemberForm>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      name: '',
      nik: '',
      phone: '',
      role: 'Anggota',
      joinDate: todayISO(),
      deposit: formatAmountInput(initialDepositStr),
      email: '',
      password: '',
      passwordConfirm: '',
    },
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
      email: data.email || null,
      password: data.password || null,
    });
    onClose();
  };

  return (
    <Layout
      header={
        <DialogHeader
          title="Tambah Anggota Baru"
          subtitle="Data keanggotaan dan (opsional) akses portal"
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
                    {errors.name && (
                      <Text type="supporting" color="critical">
                        {errors.name.message}
                      </Text>
                    )}
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
                      <Text type="supporting" color="critical">
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
                      <Text type="supporting" color="critical">
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
                    <Text type="supporting">Jabatan</Text>
                    <select
                      value={field.value}
                      onChange={field.onChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md, 6px)',
                        border: '1px solid var(--color-border-primary)',
                        backgroundColor: 'var(--color-background-primary)',
                        color: 'var(--color-text-primary)',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="Anggota">Anggota</option>
                      <option value="Ketua">Ketua</option>
                      <option value="Sekretaris">Sekretaris</option>
                      <option value="Bendahara">Bendahara</option>
                    </select>
                    {errors.role && (
                      <Text type="supporting" color="critical">
                        {errors.role.message}
                      </Text>
                    )}
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
                    {errors.joinDate && (
                      <Text type="supporting" color="critical">
                        {errors.joinDate.message}
                      </Text>
                    )}
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
                    {errors.deposit && (
                      <Text type="supporting" color="critical">
                        {errors.deposit.message}
                      </Text>
                    )}
                  </VStack>
                )}
              />

              <VStack
                gap={3}
                style={{
                  padding: 'var(--spacing-3)',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--color-border-primary, #e5e7eb)',
                  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
                }}
              >
                <VStack gap={1}>
                  <Heading level={4}>Akses portal (opsional)</Heading>
                  <Text type="supporting" color="secondary">
                    Isi agar anggota bisa login di /portal. Email saja cukup untuk Google SSO;
                    isi password jika ingin login email/ID + sandi.
                  </Text>
                </VStack>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <VStack gap={1}>
                      <TextInput
                        label="Email Portal"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="anggota@email.com"
                        type="email"
                        description="Harus sama dengan email Google jika login dengan Google"
                      />
                      {errors.email && (
                        <Text type="supporting" color="critical">
                          {errors.email.message}
                        </Text>
                      )}
                    </VStack>
                  )}
                />
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <VStack gap={1}>
                      <TextInput
                        label="Password Portal"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Minimal 8 karakter (opsional)"
                        type="password"
                      />
                      {errors.password && (
                        <Text type="supporting" color="critical">
                          {errors.password.message}
                        </Text>
                      )}
                    </VStack>
                  )}
                />
                <Controller
                  name="passwordConfirm"
                  control={control}
                  render={({ field }) => (
                    <VStack gap={1}>
                      <TextInput
                        label="Konfirmasi Password"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Ulangi password jika diisi"
                        type="password"
                      />
                      {errors.passwordConfirm && (
                        <Text type="supporting" color="critical">
                          {errors.passwordConfirm.message}
                        </Text>
                      )}
                    </VStack>
                  )}
                />
              </VStack>
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
