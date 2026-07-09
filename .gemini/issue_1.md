## Deskripsi

Database file path di-hardcode sebagai `"koperasi.sqlite"` di `server/db.ts` line 4. Docker volume mount di `docker-compose.yml` meng-mount ke `/app/data`, tetapi file database dibuat di `/app/koperasi.sqlite` (relative ke CWD `/app`).

**Dampak:** Data akan **hilang saat container restart** karena file tidak berada di volume yang di-mount.

## File Terkait
- `server/db.ts` (line 4)
- `docker-compose.yml` (volume mount config)

## Reproduksi
1. Jalankan `docker-compose up`
2. Tambahkan data anggota/pinjaman
3. Jalankan `docker-compose down && docker-compose up`
4. Semua data hilang

## Solusi yang Direkomendasikan

```diff
// server/db.ts
- const db = new Database("koperasi.sqlite");
+ const dbPath = process.env.DATABASE_PATH || "koperasi.sqlite";
+ const db = new Database(dbPath);
```

```yaml
# docker-compose.yml
services:
  app:
    environment:
      - DATABASE_PATH=/app/data/koperasi.sqlite
```

## Severity
🔴 Critical — Data loss risk in production
