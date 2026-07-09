## Deskripsi

Di `server/index.ts` line 57, `tokenBlacklist` adalah sebuah `Set` yang digunakan untuk menyimpan token yang sudah di-revoke (logout). Set ini **tumbuh tanpa batas** karena tidak ada mekanisme TTL (time-to-live) atau cleanup.

**Dampak:**
- Seiring waktu, memori server akan terus bertambah
- Pada deployment jangka panjang, ini akan menyebabkan **out-of-memory crash**
- Blacklist hilang saat server restart (token yang sudah logout jadi valid lagi)

## File Terkait
- `server/index.ts` (line 57 — `tokenBlacklist` Set declaration)

## Solusi yang Direkomendasikan

### Opsi 1: Map dengan TTL (sederhana)
```typescript
const tokenBlacklist = new Map<string, number>(); // token -> expiry timestamp

// Saat logout
tokenBlacklist.set(token, decodedPayload.exp * 1000);

// Periodic cleanup (setiap 1 jam)
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of tokenBlacklist) {
    if (expiry < now) tokenBlacklist.delete(token);
  }
}, 60 * 60 * 1000);
```

### Opsi 2: Simpan di database (persistent)
```sql
CREATE TABLE token_blacklist (
  token TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
```

## Severity
🔴 Critical — Memory leak leading to server crash
