## Deskripsi

Di `Dockerfile` line 18 (release stage), hanya directory `server/` yang di-copy ke image final. Namun, server meng-import dari `../shared/types` yang berarti directory `shared/` juga harus ada.

**Dampak:** Container akan **crash saat startup** dengan error `Cannot find module '../shared/types'`.

## File Terkait
- `Dockerfile` (line 18 — COPY di release stage)
- `server/index.ts` (import dari `../shared/types`)
- `shared/types.ts`

## Reproduksi
1. `docker build -t koperasi-app .`
2. `docker run koperasi-app`
3. Container crash: `Error: Cannot find module '../shared/types'`

## Solusi yang Direkomendasikan

```dockerfile
# Release stage — tambahkan COPY untuk shared/
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /app/server ./server
COPY --from=prerelease /app/shared ./shared
# ...
```

Tambahan perbaikan lainnya:
- Tambahkan `.dockerignore` untuk exclude `.git`, `node_modules`, dll.
- Tambahkan `USER bun` agar container tidak berjalan sebagai root
- Pin image version: `oven/bun:1.0` → `oven/bun:1.0.35` (atau versi spesifik)

## Severity
🔴 Critical — Application cannot start in Docker
