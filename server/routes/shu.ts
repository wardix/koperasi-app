import { Hono } from 'hono'
import { calculateSHU, getShuConfig } from '../services/shuService'
import { requirePermission } from '../middleware'
import db from '../db'

const shu = new Hono()

// ---------------------------------------------------------------------------
// GET /api/v1/shu — Get SHU data for a year (closed or dynamic)
// ---------------------------------------------------------------------------
shu.get('/', requirePermission('read:shu'), async (c) => {
  const year = c.req.query('year') || new Date().getFullYear().toString();
  const data = await calculateSHU(year);
  return c.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// GET /api/v1/shu/config — Get current SHU distribution configuration
// ---------------------------------------------------------------------------
shu.get('/config', requirePermission('read:settings'), async (c) => {
  const config = await getShuConfig();
  return c.json({ success: true, data: config });
});

// ---------------------------------------------------------------------------
// POST /api/v1/shu/close — Close (lock) a fiscal year
// Only admin role can close a period.
// ---------------------------------------------------------------------------
shu.post('/close', requirePermission('approve:loans'), async (c) => {
  const { year, biayaOperasional } = await c.req.json();
  if (!year) return c.json({ success: false, message: 'Tahun wajib diisi' }, 400);

  // Check whether the year is already closed
  const check = await db.query("SELECT 1 FROM shu_closes WHERE year = ?").get(year);
  if (check) {
    return c.json({ success: false, message: `Tahun ${year} sudah ditutup` }, 409);
  }

  // Persist manual operating cost override if provided
  if (biayaOperasional !== undefined) {
    await db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [`biaya_operasional_${year}`, biayaOperasional.toString()]
    );
  }

  // Calculate SHU for the year
  const result = await calculateSHU(year);
  const userEmail = (c.get('jwtPayload') as { email?: string })?.email || 'admin';

  // Persist everything inside a transaction
  await db.transaction(async () => {
    // 1. Insert closing log into shu_closes
    await db.run(`
      INSERT INTO shu_closes (year, pendapatan, biayaOperasional, shuNetto, distribusi, closedBy)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      year,
      result.pendapatan,
      result.biayaOperasional,
      result.shuNetto,
      JSON.stringify(result.distribusi),
      userEmail
    ]);

    // 2. Insert member allocations into shu_member_allocations
    for (const a of result.alokasiAnggota) {
      await db.run(`
        INSERT INTO shu_member_allocations (year, memberId, savingsShare, loansShare, totalSHU)
        VALUES (?, ?, ?, ?, ?)
      `, [year, a.id, a.savingsShare, a.loansShare, a.shu]);
    }
  });

  return c.json({ success: true, message: `Tahun Buku ${year} berhasil ditutup` });
});

// ---------------------------------------------------------------------------
// POST /api/v1/shu/reopen — Reopen (unlock) a previously closed fiscal year
// Only superadmin can reopen. Uses 'delete:members' as the audit-sensitive
// permission gate since no dedicated shu:reopen permission exists yet.
// ---------------------------------------------------------------------------
shu.post('/reopen', requirePermission('delete:members'), async (c) => {
  const { year } = await c.req.json();
  if (!year) return c.json({ success: false, message: 'Tahun wajib diisi' }, 400);

  // Verify the year was actually closed before allowing reopen
  const check = await db.query("SELECT 1 FROM shu_closes WHERE year = ?").get(year);
  if (!check) {
    return c.json({ success: false, message: `Tahun ${year} belum ditutup` }, 400);
  }

  // Delete allocations and closing log inside a transaction
  await db.transaction(async () => {
    await db.run("DELETE FROM shu_member_allocations WHERE year = ?", [year]);
    await db.run("DELETE FROM shu_closes WHERE year = ?", [year]);
  });

  return c.json({ success: true, message: `Tahun Buku ${year} berhasil dibuka kembali` });
});

export default shu;
