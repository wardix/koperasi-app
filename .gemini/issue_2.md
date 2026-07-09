## Deskripsi

Di `server/index.ts` line 56, `secretKey` di-export dan memiliki hardcoded fallback value `'koperasi-super-secret-key-2026'`.

**Masalah:**
1. **Secret key di-export** — module manapun yang meng-import file ini bisa membaca secret key
2. **Hardcoded fallback** — Jika env var `JWT_SECRET` tidak di-set (termasuk di production), server diam-diam menggunakan value yang bisa ditebak
3. Siapapun yang tahu value ini bisa membuat JWT palsu dan mengakses seluruh API sebagai user manapun

## File Terkait
- `server/index.ts` (line 56)
- `.env.example` (berisi real-looking secret `koperasi-super-secret-key-2026`)

## Solusi yang Direkomendasikan

```typescript
// 1. Jangan export secret key
// 2. Fail fast jika JWT_SECRET tidak di-set
const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

```env
# .env.example — gunakan placeholder yang jelas
JWT_SECRET=your-secret-here-change-this
```

## Severity
🔴 Critical — Authentication bypass risk
