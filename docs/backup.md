# Database Backup & Restore Runbook

Dokumen ini berisi panduan teknis (runbook) untuk melakukan _backup_ (cadangan) dan _restore_ (pemulihan) basis data PostgreSQL Koperasi, khususnya pada lingkungan yang menggunakan `docker-compose.yml`.

## 1. Perintah Manual (Copy-Paste untuk Docker Compose)

Gunakan perintah di bawah ini dari direktori root proyek (tempat file `docker-compose.yml` berada).

### Melakukan Backup (Mengekspor Data)

Untuk mencadangkan seluruh data dan skema ke dalam sebuah file `.sql`:

```bash
docker-compose exec -t db pg_dump -U koperasi -d koperasi -c -F p > backup_koperasi_$(date +%Y%m%d_%H%M%S).sql
```
_Catatan:_ Opsi `-c` (clean) menyertakan perintah `DROP` sebelum pembuatan tabel, sehingga memudahkan proses _restore_ nanti tanpa konflik bentrok data lama. Opsi `-F p` menggunakan format _plain text_ SQL.

Jika ingin format kompresi biner (_custom format_) yang mendukung _parallel restore_:
```bash
docker-compose exec -t db pg_dump -U koperasi -d koperasi -F c -f /tmp/backup.dump
docker-compose exec -t db cat /tmp/backup.dump > backup_koperasi_$(date +%Y%m%d_%H%M%S).dump
```

### Melakukan Restore (Memulihkan Data)

**Peringatan:** Proses _restore_ akan **MENIMPA** data yang sudah ada. Pastikan tidak ada aktivitas aplikasi kritis yang sedang berjalan. Anda dapat mematikan aplikasi sementara dengan `docker-compose stop app`.

Jika menggunakan format `.sql` (plain text):
```bash
cat nama_file_backup.sql | docker-compose exec -T db psql -U koperasi -d koperasi
```

Jika menggunakan format `.dump` (custom format):
```bash
cat nama_file_backup.dump | docker-compose exec -T db pg_restore -U koperasi -d koperasi -c --if-exists
```

Setelah restore selesai, jalankan kembali aplikasi:
```bash
docker-compose start app
```

## 2. Automasi Backup Terjadwal (Cron Job)

Untuk lingkungan *Production*, backup harus berjalan secara otomatis. Berikut adalah contoh _script_ bash sederhana yang dapat dijalankan lewat Cron harian.

Buat file `/usr/local/bin/koperasi-backup.sh`:
```bash
#!/bin/bash
# Konfigurasi
BACKUP_DIR="/var/backups/koperasi"
CONTAINER_NAME="koperasi-app-db-1" # Sesuaikan dengan nama container DB
DB_USER="koperasi"
DB_NAME="koperasi"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Dump data
docker exec -t $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME -F c -f /tmp/koperasi_$DATE.dump
docker cp $CONTAINER_NAME:/tmp/koperasi_$DATE.dump $BACKUP_DIR/koperasi_$DATE.dump
docker exec -t $CONTAINER_NAME rm /tmp/koperasi_$DATE.dump

# Opsional: Kompresi atau Enkripsi tambahan
# gzip $BACKUP_DIR/koperasi_$DATE.dump

# Bersihkan backup lama (Retention: 30 hari)
find $BACKUP_DIR -name "koperasi_*.dump" -mtime +30 -exec rm {} \;

echo "Backup selesai: $BACKUP_DIR/koperasi_$DATE.dump"
```

Tambahkan ke cron (`crontab -e`) agar berjalan setiap jam 2 pagi:
```cron
0 2 * * * /usr/local/bin/koperasi-backup.sh >> /var/log/koperasi-backup.log 2>&1
```

## 3. Keamanan dan Lokasi File Backup

Data koperasi mengandung informasi finansial yang **Kritis** (Simpanan, Pinjaman, Identitas Anggota).
- **Lokasi Penyimpanan**: Jangan pernah menyimpan file backup hanya pada server yang sama. Gunakan S3 Bucket, Google Cloud Storage, atau rsync ke *off-site server* yang berbeda dari *host* database.
- **Secrets/Enkripsi**: Pastikan Anda mengenkripsi file backup (misalnya dengan GPG atau AWS KMS) sebelum di-*upload* ke layanan _cloud storage_ eksternal. Jangan sertakan sandi kredensial (`JWT_SECRET` atau master password) ke dalam repositori.

## 4. Kebijakan Retensi (Retention Policy)

Rekomendasi penyimpanan log/cadangan database:
- **Harian (Daily)**: Simpan selama **7-14 hari** terakhir. 
- **Mingguan (Weekly)**: Simpan satu _backup_ mingguan selama **1 bulan**.
- **Bulanan (Monthly)**: Simpan satu _backup_ per bulan untuk tujuan audit selama minimal **1 hingga 5 tahun** (bergantung pada regulasi RAT koperasi setempat).

## 5. Restore Drill Checklist (Latihan Pemulihan)

Backup yang baik adalah backup yang bisa di-restore. Sangat direkomendasikan untuk melakukan *restore drill* minimal satu kali setiap 3 bulan.
- [ ] 1. Siapkan mesin/server cadangan terisolasi (contoh: di lokal menggunakan docker).
- [ ] 2. Ambil *file backup* terbaru dari *cloud storage* / lokasi arsip.
- [ ] 3. Jalankan prosedur `pg_restore` dari runbook ini ke database *blank*.
- [ ] 4. Jalankan migrasi DB terbaru (`bun run db:migrate`) untuk memastikan skema tidak bermasalah.
- [ ] 5. Hidupkan aplikasi dan verifikasi data (Total Saldo Kas, Data Anggota Terbaru, Jadwal Pinjaman) menggunakan *query* sampling.
- [ ] 6. Buat berita acara sukses/gagal pada log infrastruktur.
