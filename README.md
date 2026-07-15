# Sistem Informasi Koperasi Maju Bersama

Aplikasi web full-stack untuk manajemen koperasi: pencatatan simpanan, pengajuan pinjaman, kalkulasi Sisa Hasil Usaha (SHU), cashflow, NPL, laporan, dan pengaturan anggota.

**Stack resmi:** React + Vite (frontend), Hono + Bun (API), **PostgreSQL** (database).

> Runtime dan deploy memakai **PostgreSQL** via `DATABASE_URL`. SQLite **bukan** database yang didukung.

## Fitur utama

- Dashboard ringkasan (anggota, simpanan, pinjaman, NPL)
- Manajemen anggota
- Pengajuan & status pinjaman (Menunggu / Disetujui / Ditolak / Lunas / Macet)
- Mutasi simpanan (pokok / wajib / sukarela)
- Kalkulasi & alokasi SHU
- Cashflow, NPL, laporan, peran admin, pengaturan

## Prasyarat

- **Bun** (runtime & package manager)
  ```bash
  curl -fsSL https://bun.sh/install | bash
  bun --version
  ```
- **PostgreSQL 16+** (lokal, atau lewat Docker Compose di repo ini)

## Database (PostgreSQL)

Koneksi dikonfigurasi hanya lewat:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
```

Contoh default dev (selaras `docker-compose.yml` / `.env.example`):

```bash
DATABASE_URL=postgres://koperasi:koperasi_pass@localhost:5432/koperasi
```

### Menjalankan Postgres dengan Docker

```bash
docker compose up -d db
# Postgres: localhost:5432, user/db: koperasi, password: koperasi_pass
```

Aplikasi lengkap (API + DB):

```bash
# Set JWT_SECRET di environment atau file .env
docker compose up --build
```

Skema diinisialisasi lewat **migrasi formal** (forward-only, fail-fast):

- Runner: `server/migrations/` (`001_baseline`, data migrations `0003` / `0004`, …)
- Tracking: tabel `schema_migrations`
- Dijalankan otomatis saat boot (`import` `server/db.ts`) atau:
  ```bash
  bun run db:migrate
  ```
- Seed terpisah di `server/seed.ts` (admin/settings default; demo members hanya jika `NODE_ENV=test` atau `SEED_DEMO=true`)

Jangan menelan error migrasi — proses harus gagal jika `up()` throw.

### Konvensi penamaan kolom

| Lapisan | Konvensi | Catatan |
|--------|----------|---------|
| SQL di kode / `CREATE TABLE` | **camelCase** (mis. `memberId`, `totalSavings`) | Historis; Postgres menyimpan identifier unquoted sebagai **lowercase** (`memberid`, `totalsavings`). |
| Baris hasil query di app | **camelCase** | `mapRow` (`server/db/mapRow.ts`) memetakan key lowercase Postgres → camelCase app via `COLUMN_KEY_MAP`. |
| Typing | Generics + Zod row schemas | `db.query(...).get<T>()` / `.allAs(schema)` — lihat `server/db/entities.ts`. |
| Query baru | Tetap camelCase di SQL string yang ada, **atau** quote identifier (`"memberId"`) jika menambah kolom case-sensitive. | Jangan campur snake_case di tabel lama tanpa migrasi + update mapper. |
| Parameter SQL | `?` di helper `db` | Dikonversi ke `$1`, `$2`, … untuk Postgres. |

Untuk fitur baru, utamakan pola yang sama dengan tabel existing agar mapper dan route tetap konsisten. Refactor penuh ke `snake_case` + typed ORM adalah perbaikan terpisah (lihat issue arsitektur DB).

## Persiapan environment

1. Salin contoh env:
   ```bash
   cp .env.example .env
   ```
2. Isi minimal:
   - **`JWT_SECRET`** — wajib; generate secret kuat (lihat komentar di `.env.example`)
   - **`DATABASE_URL`** — connection string PostgreSQL
   - **`CORS_ORIGIN`** — origin frontend (mis. `http://localhost:5173`)
   - Opsional: `PORT`, `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`, `RATE_LIMIT_ENABLED`, `VITE_API_URL`

## Instalasi

```bash
bun install
```

## Development

Frontend (Vite, biasanya `http://localhost:5173`):

```bash
bun run dev
```

API server (Bun + Hono, default `http://localhost:3000`):

```bash
bun run start
```

Pastikan Postgres sudah jalan dan `DATABASE_URL` mengarah ke instance yang benar.

Dokumentasi API (dev): [http://localhost:3000/doc](http://localhost:3000/doc) (Swagger UI; spec di `/openapi.yaml`). CI menjalankan `bun run openapi:check` agar spec tetap selaras dengan route manifest.

## Testing

```bash
# Unit / integration (server + src); butuh Postgres yang reachable via DATABASE_URL
bun run test

# End-to-end Playwright
bun run test:e2e
```

Di CI, unit test memakai service Postgres 16; e2e memakai database terpisah (lihat `.github/workflows/`).

## Build & production

```bash
bun run build    # frontend → dist/
bun run start    # API entry: server/index.ts
```

Atau image Docker (`Dockerfile` + `docker-compose.yml`). Jangan pakai fallback `JWT_SECRET` default di production.

## Referensi konfigurasi

| File | Isi |
|------|-----|
| `.env.example` | Semua env vars (Postgres, JWT, CORS, Google SSO) |
| `docker-compose.yml` | Service `app` + `db` (postgres:16-alpine) |
| `docs/backup.md` | Runbook backup/restore database |
| `server/db.ts` | Koneksi Bun SQL, transaksi, skema, migrasi |
| `openapi.yaml` | Spek API (manual; diverifikasi CI via `bun run openapi:check`) |
| `server/openapi/routeManifest.ts` | Daftar route wajib tercakup di spec |
