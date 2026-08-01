# Common Patterns

Berikut adalah dokumentasi pattern standar (best practices) yang diterapkan pada pengembangan fitur frontend Koperasi.

## 1. Form Patterns

Hindari penulisan form secara manual dengan HTML murni. Selalu manfaatkan reusable form components (`FormField`, `FormLabel`, dsb.) untuk memastikan konsistensi desain UI, responsivitas, dan feedback (seperti pesan error).

### Contoh Penggunaan Standar:
```tsx
import { FormField } from '../components/common';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useForm, Controller } from 'react-hook-form'; // Jika menggunakan React Hook Form

function MyForm() {
  const { control, handleSubmit, formState: { errors } } = useForm();
  
  return (
    <form onSubmit={handleSubmit(console.log)}>
      <Controller
        name="email"
        control={control}
        rules={{ required: 'Email wajib diisi' }}
        render={({ field }) => (
          <FormField
            label="Alamat Email"
            required
            error={errors.email?.message}
          >
            <TextInput {...field} type="email" />
          </FormField>
        )}
      />
    </form>
  );
}
```

## 2. Chart Patterns

Chart Koperasi menggunakan pustaka **Recharts**. Agar chart mendukung integrasi tema (Light/Dark Mode) yang mulus, selalu import helper dan properti tema yang telah disediakan.

```tsx
import { chartColors, getThemedGridProps, getThemedAxisProps, getThemedTooltipProps } from '../design/chartTheme';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

function MyChart({ data }) {
  return (
    <BarChart data={data}>
      {/* Menggunakan grid dan axis yang sudah disesuaikan warnanya */}
      <CartesianGrid {...getThemedGridProps()} />
      <XAxis {...getThemedAxisProps()} />
      <YAxis {...getThemedAxisProps()} />
      
      {/* Integrasikan styling tooltip */}
      <Tooltip {...getThemedTooltipProps()} />
      
      {/* Gunakan token warna semantik untuk series bar */}
      <Bar dataKey="pendapatan" fill={chartColors.success} />
    </BarChart>
  );
}
```

## 3. Performance Patterns

Dalam rangka menjaga aplikasi tetap cepat dan responsif (khususnya untuk tabel atau dialog data besar):

### A. Memoization
Selalu memoize kalkulasi yang kompleks (contoh: summary portofolio) serta definisi kolom tabel agar tabel tidak di-render ulang setiap cycle komponen bereaksi.

```tsx
import { useMemo } from 'react';
import { Table, proportional } from '@astryxdesign/core/Table';

function DataView({ data }) {
  // Memoize column definition
  const columns = useMemo(() => [
    { key: 'name', header: 'Nama', width: proportional(1) },
    { key: 'amount', header: 'Nominal', width: proportional(1) },
  ], []);

  // Memoize perhitungan berat
  const totalAmount = useMemo(() => data.reduce((acc, curr) => acc + curr.amount, 0), [data]);

  return <Table data={data} columns={columns} idKey="id" />;
}
```

### B. Lazy Loading Heavy Dialogs
Bila memungkinkan, import komponen dialog yang besar (contoh: dialog persetujuan pinjaman, manajemen aset besar) secara _lazy_.
Hal ini memperkecil bundle utama saat halaman diload pertama kali.

```tsx
import { lazy, Suspense } from 'react';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Center } from '@astryxdesign/core/Center';

// Export secara lazy
const HeavyDialogContent = lazy(() => import('../components/HeavyDialog').then(m => ({ default: m.HeavyDialogContent })));

function MyPage({ dialog }) {
  const showDialog = () => {
    dialog.show(
      <Suspense fallback={<Center style={{ padding: 40 }}><Spinner /></Center>}>
        <HeavyDialogContent />
      </Suspense>
    );
  };
  
  return <button onClick={showDialog}>Buka Dialog</button>;
}
```
