# Design Tokens

Aplikasi Koperasi menggunakan sistem **Design Tokens** (terinspirasi oleh Tailwind, diimplementasikan dengan CSS Variables & Astryx) sebagai *Single Source of Truth* untuk pewarnaan dan styling.

## File Referensi
- **`src/design/tokens.ts`**: Definisi konstan untuk warna semantik.
- **`src/design/theme.ts`**: Objek `koperasiTheme` yang diekstensi dari `neutralTheme` Astryx dengan modifikasi spesifik Koperasi (mis. mengubah skema warna success/warning/critical/accent).
- **`src/design/chartTheme.ts`**: Helper khusus untuk memetakan token ke styling library **Recharts**.

## Semantic Colors

Penggunaan warna hardcoded secara langsung (contoh: `#10B981`, `#EF4444`) **SANGAT DILARANG**. Gunakan referensi CSS variables yang disediakan oleh sistem Astryx dan custom theme kita.

### UI Colors
| Fungsi | CSS Variable (Light/Dark mode) |
|--------|---------------------------------|
| Background Primary | `var(--color-background-primary)` |
| Background Secondary | `var(--color-background-secondary)` |
| Text Primary | `var(--color-text-primary)` |
| Text Secondary | `var(--color-text-secondary)` |
| Border | `var(--color-border)` atau `var(--color-border-primary)` |

### Status Colors
Gunakan warna-warna ini untuk menyoroti status:
- **Success (Hijau):** `var(--color-success-500)`
- **Warning (Kuning/Oranye):** `var(--color-warning-500)`
- **Critical/Error (Merah):** `var(--color-critical-500)`
- **Info/Primary (Biru):** `var(--color-primary-500)`

## Integrasi Chart (Recharts)

Chart membutuhkan warna spesifik yang dapat merespons light/dark mode dengan baik. Gunakan helper dari `chartTheme.ts`:

```tsx
import { 
  chartColors, 
  getThemedGridProps, 
  getThemedAxisProps, 
  getThemedTooltipProps 
} from '../design/chartTheme';

<BarChart data={data}>
  <CartesianGrid {...getThemedGridProps()} />
  <XAxis {...getThemedAxisProps()} />
  <YAxis {...getThemedAxisProps()} />
  <Tooltip {...getThemedTooltipProps()} />
  <Bar dataKey="value" fill={chartColors.success} />
</BarChart>
```
