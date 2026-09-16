import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import db from '../db';
import type { UserFeedbackRow } from '../db/entities';
import { secretKey } from '../middleware';
import { createFeedbackSchema, updateFeedbackStatusSchema } from '../schemas';

const feedbacks = new Hono();

const FEEDBACKS_DIR = join(process.cwd(), 'uploads', 'feedbacks');
if (!existsSync(FEEDBACKS_DIR)) {
  mkdirSync(FEEDBACKS_DIR, { recursive: true });
}

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5 MB

/** Helper to extract user identity from Bearer token if present */
async function extractUserFromToken(authHeader?: string) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, secretKey, 'HS256') as Record<string, unknown>;
    return {
      userId: (payload.sub || payload.id || payload.memberId || '') as string,
      userName: (payload.name || '') as string,
      userEmail: (payload.email || '') as string,
      userRole: (payload.role || 'member') as string,
    };
  } catch {
    return null;
  }
}

/** Helper middleware to require admin role for protected feedback routes */
async function requireAdminAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  const user = await extractUserFromToken(authHeader);
  if (!user || (user.userRole !== 'admin' && user.userRole !== 'superadmin')) {
    return c.json({ success: false, message: 'Forbidden: admin access required' }, 403);
  }
  c.set('user', user);
  await next();
}

/**
 * POST /api/v1/feedbacks
 * Submit new feedback / bug report / feature request with optional screenshot.
 * Open to authenticated members/admins, and gracefully accepts unauthenticated input.
 */
feedbacks.post('/', async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = createFeedbackSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({
        success: false,
        message: 'Validasi form feedback gagal',
        errors: parsed.error.issues,
      }, 400);
    }

    const authHeader = c.req.header('Authorization');
    const tokenUser = await extractUserFromToken(authHeader);

    const {
      type,
      title,
      description,
      screenshot,
      pageUrl,
      userAgent,
      screenResolution,
      userName,
      userEmail,
    } = parsed.data;

    let screenshotUrl: string | null = null;

    if (screenshot) {
      const match = screenshot.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
      if (match) {
        let ext = match[1];
        if (ext === 'jpeg') ext = 'jpg';
        const base64Content = match[2];
        const buffer = Buffer.from(base64Content, 'base64');

        if (buffer.length > MAX_SCREENSHOT_SIZE) {
          return c.json({
            success: false,
            message: 'Ukuran screenshot melebihi batas 5 MB',
          }, 400);
        }

        const fileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
        const filePath = join(FEEDBACKS_DIR, fileName);
        await Bun.write(filePath, buffer);
        screenshotUrl = `/uploads/feedbacks/${fileName}`;
      }
    }

    const id = `fb_${crypto.randomUUID()}`;
    const effectiveUserId = tokenUser?.userId || null;
    const effectiveUserName = tokenUser?.userName || userName || 'Pengguna';
    const effectiveUserEmail = tokenUser?.userEmail || userEmail || null;
    const effectiveUserRole = tokenUser?.userRole || (tokenUser ? 'member' : 'guest');

    await db.prepare(`
      INSERT INTO user_feedbacks (
        id, type, title, description, screenshot_url, page_url, user_agent,
        screen_resolution, user_id, user_name, user_email, user_role, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NOW(), NOW())
    `).run(
      id,
      type,
      title || null,
      description,
      screenshotUrl,
      pageUrl || null,
      userAgent || null,
      screenResolution || null,
      effectiveUserId,
      effectiveUserName,
      effectiveUserEmail,
      effectiveUserRole
    );

    return c.json({
      success: true,
      data: {
        id,
        type,
        title: title || null,
        description,
        screenshotUrl,
        pageUrl: pageUrl || null,
        status: 'open',
        userName: effectiveUserName,
        userRole: effectiveUserRole,
        createdAt: new Date().toISOString(),
      },
    }, 201);
  } catch (err) {
    console.error('Error submitting feedback:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengirim masukan',
    }, 500);
  }
});

/**
 * GET /api/v1/feedbacks
 * List feedback reports with filters (type, status, search) and pagination.
 * Requires admin access.
 */
feedbacks.get('/', requireAdminAuth, async (c) => {
  try {
    const type = c.req.query('type');
    const status = c.req.query('status');
    const search = c.req.query('search');
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0);

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (type && ['bug', 'feature', 'general'].includes(type)) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (status && ['open', 'in_review', 'resolved', 'closed'].includes(status)) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      conditions.push('(title ILIKE ? OR description ILIKE ? OR user_name ILIKE ? OR user_email ILIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const whereClause = conditions.join(' AND ');

    const countRow = await db.query(
      `SELECT COUNT(*) as count FROM user_feedbacks WHERE ${whereClause}`
    ).get<{ count: number }>(...params);
    const total = countRow?.count ? Number(countRow.count) : 0;

    const rows = await db.query(
      `SELECT * FROM user_feedbacks WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all<UserFeedbackRow>(...params, limit, offset);

    return c.json({
      success: true,
      data: {
        feedbacks: rows,
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error('Error listing feedbacks:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal memuat daftar masukan',
    }, 500);
  }
});

/**
 * GET /api/v1/feedbacks/stats
 * Aggregate counts of feedback items by type and status.
 * Requires admin access.
 */
feedbacks.get('/stats', requireAdminAuth, async (c) => {
  try {
    const statusRows = await db.query(`
      SELECT status, COUNT(*) as count FROM user_feedbacks GROUP BY status
    `).all<{ status: string; count: number }>();

    const typeRows = await db.query(`
      SELECT type, COUNT(*) as count FROM user_feedbacks GROUP BY type
    `).all<{ type: string; count: number }>();

    const statusCounts = {
      open: 0,
      in_review: 0,
      resolved: 0,
      closed: 0,
    };
    for (const r of statusRows) {
      if (r.status in statusCounts) {
        statusCounts[r.status as keyof typeof statusCounts] = Number(r.count);
      }
    }

    const typeCounts = {
      bug: 0,
      feature: 0,
      general: 0,
    };
    for (const r of typeRows) {
      if (r.type in typeCounts) {
        typeCounts[r.type as keyof typeof typeCounts] = Number(r.count);
      }
    }

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return c.json({
      success: true,
      data: {
        total,
        statusCounts,
        typeCounts,
      },
    });
  } catch (err) {
    console.error('Error getting feedback stats:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal memuat statistik masukan',
    }, 500);
  }
});

/**
 * PUT /api/v1/feedbacks/:id/status
 * Update status and admin notes for a feedback entry.
 * Requires admin access.
 */
feedbacks.put('/:id/status', requireAdminAuth, async (c) => {
  try {
    const id = c.req.param('id');
    const raw = await c.req.json();
    const parsed = updateFeedbackStatusSchema.safeParse(raw);

    if (!parsed.success) {
      return c.json({
        success: false,
        message: 'Validasi status gagal',
        errors: parsed.error.issues,
      }, 400);
    }

    const existing = await db.query('SELECT id FROM user_feedbacks WHERE id = ?').get<{ id: string }>(id);
    if (!existing) {
      return c.json({ success: false, message: 'Laporan masukan tidak ditemukan' }, 404);
    }

    const { status, adminNotes } = parsed.data;

    await db.prepare(`
      UPDATE user_feedbacks
      SET status = ?, admin_notes = ?, updated_at = NOW()
      WHERE id = ?
    `).run(status, adminNotes ?? null, id);

    return c.json({
      success: true,
      message: 'Status masukan berhasil diperbarui',
    });
  } catch (err) {
    console.error('Error updating feedback status:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal memperbarui status masukan',
    }, 500);
  }
});

/**
 * DELETE /api/v1/feedbacks/:id
 * Delete a feedback entry and cleanup stored screenshot file if any.
 * Requires admin access.
 */
feedbacks.delete('/:id', requireAdminAuth, async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.query(
      'SELECT id, screenshot_url FROM user_feedbacks WHERE id = ?'
    ).get<{ id: string; screenshot_url: string | null }>(id);

    if (!existing) {
      return c.json({ success: false, message: 'Laporan masukan tidak ditemukan' }, 404);
    }

    if (existing.screenshot_url && existing.screenshot_url.startsWith('/uploads/feedbacks/')) {
      const fileName = existing.screenshot_url.replace('/uploads/feedbacks/', '');
      const filePath = join(FEEDBACKS_DIR, fileName);
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch (e) {
          console.warn('Failed to delete screenshot file:', e);
        }
      }
    }

    await db.prepare('DELETE FROM user_feedbacks WHERE id = ?').run(id);

    return c.json({
      success: true,
      message: 'Masukan berhasil dihapus',
    });
  } catch (err) {
    console.error('Error deleting feedback:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal menghapus masukan',
    }, 500);
  }
});

export default feedbacks;
