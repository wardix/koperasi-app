# Sistem Informasi Koperasi Maju Bersama

Aplikasi web modern untuk manajemen koperasi yang dibangun dengan arsitektur Full-Stack menggunakan **React**, **Hono**, **Vite**, dan **SQLite**. Aplikasi ini mempermudah pencatatan simpanan, pengajuan pinjaman, kalkulasi Sisa Hasil Usaha (SHU), dan pengaturan anggota koperasi secara terpadu.

## Fitur Utama
- Dashboard Ringkasan (Total Anggota, Simpanan, Pinjaman, NPL)
- Manajemen Anggota Koperasi
- Manajemen Pengajuan Pinjaman (Disetujui/Ditolak/Lunas)
- Pencatatan Mutasi Simpanan
- Kalkulasi dan Pembagian SHU
- Pengaturan Aplikasi

## Prasyarat
- **Bun**: Aplikasi ini menggunakan Bun sebagai *runtime* dan *package manager*. Pastikan Anda telah menginstal Bun.
  - Untuk menginstal Bun: `curl -fsSL https://bun.sh/install | bash`
  - Verifikasi instalasi: `bun --version`

## Persiapan Environment
1. Salin `.env.example` menjadi `.env`.
   ```bash
   cp .env.example .env
   ```
2. Sesuaikan konfigurasi *environment variables* di dalam file `.env`:
   - `JWT_SECRET`: Secret key untuk penandatanganan token JWT.
   - Variabel lain (jika ada) sesuai kebutuhan.

## Instalasi Dependensi
Jalankan perintah berikut di direktori root proyek untuk menginstal semua dependensi:
```bash
bun install
```

## Menjalankan Development Server
Aplikasi ini menggunakan ekosistem terpadu dari Vite untuk frontend dan Bun untuk backend server.
Untuk menjalankan *development server*:
```bash
bun run dev
```
Setelah jalan, server akan tersedia di alamat lokal Anda (contoh: `http://localhost:5173`).

## Testing
Untuk menjalankan testing (*unit tests*, dll.):
```bash
bun run test
```

## Build untuk Production
Untuk membuat *production build*:
```bash
bun run build
```
Selanjutnya, Anda dapat menjalankan server dengan menggunakan *entry point* produksi atau docker image yang tersedia.
