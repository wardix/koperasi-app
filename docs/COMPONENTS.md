# Component Library

Aplikasi ini menggunakan perpaduan **Astryx Design System** (dari `@astryxdesign/*`) dan komponen kustom (reusable abstractions) yang dirancang khusus untuk domain Koperasi.

## 1. Astryx Core Components
Selalu prioritaskan penggunaan komponen Astryx sebelum membuat komponen baru.
- **Layout & Structure:** `Layout`, `VStack`, `HStack`, `Grid`, `Card`
- **Typography:** `Text`, `Heading`
- **Forms:** `TextInput`, `Selector`, `CheckboxInput`
- **Data Display:** `Table`, `Badge`, `Avatar`, `Spinner`
- **Interactions:** `Button`, `IconButton`
- **Advanced:** `PowerSearch` (untuk filter & search kompleks), `Typeahead`

## 2. Common Reusable Components (`src/components/common/`)

Komponen umum yang sering digunakan di seluruh aplikasi, menggabungkan Astryx dan logika spesifik Koperasi.

### FormField
Wrapper komprehensif untuk input form. Menggabungkan `FormLabel`, Astryx `TextInput`/`Selector`, dan `FormFieldError`.

```tsx
import { FormField } from '../components/common';

<FormField
  label="Nama Lengkap"
  required
  error={errors.name?.message}
  description="Gunakan nama sesuai KTP"
>
  <TextInput {...field} />
</FormField>
```

### FormLabel
Label form standar dengan dukungan indikator "required".

```tsx
import { FormLabel } from '../components/common';

<FormLabel htmlFor="email" required>Alamat Email</FormLabel>
```

### FormFieldError
Pesan error standar dengan warna `critical` Astryx.

```tsx
import { FormFieldError } from '../components/common';

<FormFieldError message="Bidang ini wajib diisi" />
```

### StatusBadge
Badge type-safe yang memetakan status Koperasi ke varian warna Astryx.

```tsx
import { StatusBadge } from '../components/common';

// Otomatis memilih varian warna (contoh: Aktif -> success)
<StatusBadge status="Aktif" />
<StatusBadge status="Macet" />
```

## 3. Domain-Specific Sub-components

Komponen kompleks (seperti `LoanDetailDialog`, `Members`, `Settings`) telah dipecah menjadi sub-komponen terisolasi untuk maintainability:
- **Loan:** `LoanInfoSection`, `LoanScheduleTable`, `LoanPaymentSection`
- **Members:** `MemberActions`, `MembersList`
- **Settings:** `ProfileSettings`, `ParameterSettings`, `TwoFactorSettings`

Sub-komponen ini dirancang secara **controlled** — semua state dan API fetching di-handle oleh *parent orchestrator*, sedangkan sub-komponen hanya menerima *props* dan melemparkan event lewat *callbacks*.
