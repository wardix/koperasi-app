## Deskripsi

File `.gitignore` saat ini **tidak meng-ignore file `.env`**. Jika developer membuat file `.env` berisi secrets (JWT_SECRET, database credentials, dll.), file tersebut bisa ter-commit ke repository.

**Dampak:**
- Secret keys bisa bocor ke repository (terutama jika repo public atau shared)
- JWT secret yang bocor memungkinkan pembuatan token palsu
- Melanggar security best practices

## File Terkait
- `.gitignore`
- `.env.example` (template yang sudah ada)

## Solusi yang Direkomendasikan

Tambahkan ke `.gitignore`:
```gitignore
# Environment variables
.env
.env.local
.env.production
.env.*.local

# Database
*.sqlite-journal
*.sqlite-wal
data/
```

Juga jalankan pengecekan apakah `.env` sudah pernah ter-commit:
```bash
git log --all --full-history -- .env
```

Jika sudah pernah ter-commit, perlu:
1. Rotate semua secrets yang ada di file tersebut
2. Gunakan `git filter-branch` atau `BFG Repo Cleaner` untuk menghapus dari history

## Severity
🔴 Critical — Secret exposure risk
