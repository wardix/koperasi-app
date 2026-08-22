import { Hono } from 'hono';
import db from '../db';
import { requirePermission } from '../middleware/rbac';
import { getActor } from '../lib/audit';
import { audit } from '../lib/audit';
import {
  LETTER_CATEGORIES,
  getNextLetterNumberPreview,
  createOfficialLetter,
  getLettersList,
} from '../services/letterService';
import { z } from 'zod';

const letters = new Hono();

// 1. Get Categories Configuration
letters.get('/categories', requirePermission('read:loans'), (c) => {
  return c.json({ success: true, data: LETTER_CATEGORIES });
});

// 2. Preview Next Number (before submission)
letters.get('/preview-next-number', requirePermission('read:loans'), async (c) => {
  const category = c.req.query('category') || LETTER_CATEGORIES[0].id;
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];

  try {
    const preview = await getNextLetterNumberPreview(db, category, date);
    return c.json({ success: true, data: preview });
  } catch (err) {
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mempratinjau nomor surat'
    }, 400);
  }
});

// 3. Get Letters List
letters.get('/', requirePermission('read:loans'), async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const category = c.req.query('category');
  const search = c.req.query('search');
  const year = c.req.query('year');

  try {
    const result = await getLettersList(db, { page, limit, category, search, year });
    return c.json({ success: true, data: result });
  } catch (err) {
    console.error('Error fetching letters list:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengambil daftar surat'
    }, 500);
  }
});

const createLetterSchema = z.object({
  category: z.string().min(1, 'Kategori surat wajib dipilih'),
  letterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  partyName: z.string().min(1, 'Nama pihak terkait wajib diisi'),
  subject: z.string().min(1, 'Perihal surat wajib diisi'),
  description: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
  manualLetterNumber: z.string().optional().nullable(),
});

// 4. Create / Register New Letter Number
letters.post('/', requirePermission('create:loans'), async (c) => {
  const body = await c.req.json();
  const parsed = createLetterSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = {
    id: getActor(c),
    name: getActor(c),
  };

  try {
    const created = await createOfficialLetter(db, parsed.data, actor);
    return c.json({
      success: true,
      message: `Nomor surat '${created.letterNumber}' berhasil diterbitkan.`,
      data: created,
    }, 201);
  } catch (err) {
    console.error('Error creating official letter:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal menerbitkan nomor surat'
    }, 400);
  }
});

// 5. Update Letter Details
letters.put('/:id', requirePermission('update:loans'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await db
    .query("SELECT * FROM official_letters WHERE id = ?")
    .get<any>(id);

  if (!existing) {
    return c.json({ success: false, message: 'Surat tidak ditemukan' }, 404);
  }

  const partyName = body.partyName ? String(body.partyName).trim() : existing.party_name;
  const subject = body.subject ? String(body.subject).trim() : existing.subject;
  const description = body.description !== undefined ? body.description : existing.description;
  const amount = body.amount !== undefined ? (body.amount ? Number(body.amount) : null) : existing.amount;
  const attachmentUrl = body.attachmentUrl !== undefined ? body.attachmentUrl : existing.attachment_url;
  const attachmentName = body.attachmentName !== undefined ? body.attachmentName : existing.attachment_name;
  const status = body.status ? String(body.status).trim() : existing.status;

  await db.run(
    `UPDATE official_letters SET
      party_name = ?, subject = ?, description = ?, amount = ?,
      attachment_url = ?, attachment_name = ?, status = ?, updated_at = NOW()
     WHERE id = ?`,
    [partyName, subject, description, amount, attachmentUrl, attachmentName, status, id]
  );

  await audit(db, {
    actor: getActor(c),
    action: 'update_letter',
    entity: 'official_letters',
    entityId: id,
    before: existing,
    after: { partyName, subject, description, amount, attachmentUrl, status },
  });

  return c.json({ success: true, message: 'Data surat berhasil diperbarui.' });
});

// 6. Delete / Cancel Letter
letters.delete('/:id', requirePermission('delete:loans'), async (c) => {
  const id = c.req.param('id');

  const existing = await db
    .query("SELECT * FROM official_letters WHERE id = ?")
    .get<any>(id);

  if (!existing) {
    return c.json({ success: false, message: 'Surat tidak ditemukan' }, 404);
  }

  await db.run("DELETE FROM official_letters WHERE id = ?", [id]);

  await audit(db, {
    actor: getActor(c),
    action: 'delete_letter',
    entity: 'official_letters',
    entityId: id,
    before: existing,
  });

  return c.json({ success: true, message: `Surat nomor '${existing.letter_number}' berhasil dihapus.` });
});

export default letters;
