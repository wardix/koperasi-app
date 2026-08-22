import { Hono } from 'hono';
import { existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const upload = new Hono();

const UPLOADS_DIR = join(process.cwd(), 'uploads', 'loans');
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

upload.post('/loan-attachment', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
      return c.json({ success: false, message: 'File lampiran tidak ditemukan' }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ success: false, message: 'Ukuran file maksimal adalah 10 MB' }, 400);
    }

    const rawExt = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(rawExt)) {
      return c.json({
        success: false,
        message: 'Format file tidak didukung. Hanya file PDF, JPG, PNG, dan WebP yang diizinkan.'
      }, 400);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeName}`;
    const targetPath = join(UPLOADS_DIR, uniqueName);

    const buffer = await file.arrayBuffer();
    await Bun.write(targetPath, buffer);

    const fileUrl = `/uploads/loans/${uniqueName}`;

    return c.json({
      success: true,
      data: {
        url: fileUrl,
        name: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (err) {
    console.error('Error handling upload:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengunggah file lampiran'
    }, 500);
  }
});

export default upload;
