import type { Db } from '../db';
import { audit } from '../lib/audit';

export const LETTER_CATEGORIES = [
  { id: 'PINJAMAN_ANGGOTA', code: 'SPP-ANG', label: 'Surat Perjanjian Pinjaman Anggota' },
  { id: 'PINJAMAN_MODAL', code: 'SPH-MODAL', label: 'Surat Perjanjian Pinjaman Modal Masuk' },
  { id: 'SURAT_KELUAR', code: 'SKEL-UMUM', label: 'Surat Keluar Umum' },
  { id: 'SURAT_KEPUTUSAN', code: 'SK-PENG', label: 'Surat Keputusan Pengurus' },
  { id: 'PERJANJIAN_KERJASAMA', code: 'SPK-KERJA', label: 'Surat Perjanjian Kerjasama' },
] as const;

export type LetterCategoryId = typeof LETTER_CATEGORIES[number]['id'];

const ROMAN_MONTHS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function getRomanMonth(monthNumber: number): string {
  return ROMAN_MONTHS[monthNumber] || 'I';
}

export function formatLetterNumber(seq: number, categoryCode: string, date: Date | string): string {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const romanMonth = getRomanMonth(month);
  const paddedSeq = String(seq).padStart(3, '0');

  return `${paddedSeq}/${categoryCode}/${romanMonth}/${year}`;
}

export async function getNextLetterNumberPreview(
  db: Db,
  categoryId: string,
  letterDate: string
): Promise<{ nextSeq: number; letterNumber: string; categoryCode: string }> {
  const d = new Date(letterDate || new Date().toISOString());
  const year = d.getFullYear();
  const categoryConfig = LETTER_CATEGORIES.find((c) => c.id === categoryId) || LETTER_CATEGORIES[0];

  const seqRow = await db
    .query("SELECT last_seq FROM letter_sequences WHERE category = ? AND year = ?")
    .get<{ last_seq: number }>(categoryConfig.id, year);

  const nextSeq = (seqRow?.last_seq || 0) + 1;
  const letterNumber = formatLetterNumber(nextSeq, categoryConfig.code, d);

  return { nextSeq, letterNumber, categoryCode: categoryConfig.code };
}

export interface CreateLetterInput {
  category: string;
  letterDate: string;
  partyName: string;
  subject: string;
  description?: string | null;
  amount?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  manualLetterNumber?: string | null;
}

export async function createOfficialLetter(
  db: Db,
  input: CreateLetterInput,
  actor: { id: string; name: string }
) {
  return db.transaction(async () => {
    const d = new Date(input.letterDate || new Date().toISOString());
    const year = d.getFullYear();
    const categoryConfig = LETTER_CATEGORIES.find((c) => c.id === input.category) || LETTER_CATEGORIES[0];

    let letterNumber = input.manualLetterNumber?.trim();
    let seqNumber = 0;

    if (!letterNumber) {
      // Upsert atomic sequence in transaction
      await db.run(
        `INSERT INTO letter_sequences (category, year, last_seq)
         VALUES (?, ?, 1)
         ON CONFLICT (category, year)
         DO UPDATE SET last_seq = letter_sequences.last_seq + 1`,
        [categoryConfig.id, year]
      );

      const updatedSeq = await db
        .query("SELECT last_seq FROM letter_sequences WHERE category = ? AND year = ?")
        .get<{ last_seq: number }>(categoryConfig.id, year);

      seqNumber = updatedSeq?.last_seq || 1;
      letterNumber = formatLetterNumber(seqNumber, categoryConfig.code, d);
    } else {
      // Check duplicate
      const existing = await db
        .query("SELECT id FROM official_letters WHERE letter_number = ?")
        .get(letterNumber);
      if (existing) {
        throw new Error(`Nomor surat '${letterNumber}' sudah pernah terdaftar.`);
      }
    }

    const letterId = crypto.randomUUID();
    await db.run(
      `INSERT INTO official_letters (
        id, letter_number, seq_number, category, letter_date,
        party_name, subject, description, amount,
        attachment_url, attachment_name, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?)`,
      [
        letterId,
        letterNumber,
        seqNumber,
        categoryConfig.id,
        input.letterDate,
        input.partyName.trim(),
        input.subject.trim(),
        input.description?.trim() || null,
        input.amount ? Number(input.amount) : null,
        input.attachmentUrl || null,
        input.attachmentName || null,
        actor.name || actor.id,
      ]
    );

    await audit(db, {
      actor,
      action: 'create_letter',
      entity: 'official_letters',
      entityId: letterId,
      after: {
        letterNumber,
        category: categoryConfig.id,
        partyName: input.partyName,
        subject: input.subject,
        amount: input.amount,
      },
    });

    return {
      id: letterId,
      letterNumber,
      seqNumber,
      category: categoryConfig.id,
      letterDate: input.letterDate,
      partyName: input.partyName,
      subject: input.subject,
    };
  })();
}

export async function getLettersList(
  db: Db,
  params: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    year?: string;
  }
) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const queryArgs: unknown[] = [];

  if (params.category && params.category !== 'ALL') {
    conditions.push("category = ?");
    queryArgs.push(params.category);
  }

  if (params.year) {
    conditions.push("EXTRACT(YEAR FROM letter_date) = ?");
    queryArgs.push(Number(params.year));
  }

  if (params.search && params.search.trim()) {
    conditions.push("(letter_number ILIKE ? OR party_name ILIKE ? OR subject ILIKE ?)");
    const s = `%${params.search.trim()}%`;
    queryArgs.push(s, s, s);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalRes = await db
    .query(`SELECT COUNT(*) as count FROM official_letters ${whereClause}`)
    .get<{ count: number }>(...queryArgs);

  const rows = await db
    .query(`
      SELECT 
        id, letter_number as "letterNumber", seq_number as "seqNumber", category,
        letter_date as "letterDate", party_name as "partyName", subject, description,
        amount, attachment_url as "attachmentUrl", attachment_name as "attachmentName",
        status, created_by as "createdBy", created_at as "createdAt"
      FROM official_letters
      ${whereClause}
      ORDER BY letter_date DESC, created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...queryArgs, limit, offset);

  // Category counts for quick metrics
  const statsRows = await db
    .query(`
      SELECT category, COUNT(*) as count 
      FROM official_letters 
      GROUP BY category
    `)
    .all<{ category: string; count: number }>();

  const statsMap: Record<string, number> = {};
  let totalCount = 0;
  for (const row of statsRows) {
    statsMap[row.category] = Number(row.count);
    totalCount += Number(row.count);
  }

  return {
    data: rows,
    total: totalRes?.count ? Number(totalRes.count) : 0,
    page,
    limit,
    stats: {
      total: totalCount,
      byCategory: statsMap,
    },
  };
}
