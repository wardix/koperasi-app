import type { Db } from "../db";
import { ServiceError } from "./errors";
import { updateMemberSavings } from "./savingsService";

function toDateOnlyString(val: any): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, "0");
    const day = String(val.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const str = String(val);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(str);
  if (match) {
    return match[1];
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return str.slice(0, 10);
}

export interface CreateSavingsDepositInput {
  savingsType: "pokok" | "wajib" | "sukarela";
  amount: number;
  transferDate: string;
  senderBank?: string | null;
  senderAccount?: string | null;
  senderName?: string | null;
  proofUrl?: string | null;
  proofName?: string | null;
  notes?: string | null;
}

export interface SavingsDepositFilters {
  status?: string;
  savingsType?: string;
  memberId?: string;
  page?: number;
  limit?: number;
}

export async function createSavingsDepositRequest(
  database: Db,
  memberId: string,
  input: CreateSavingsDepositInput
) {
  const member = await database
    .query(
      "SELECT id, name, status, simpananPokok FROM members WHERE id = ? AND deletedAt IS NULL"
    )
    .get<{ id: string; name: string; status: string; simpananPokok: number }>(memberId);

  if (!member) {
    throw new ServiceError("Anggota tidak ditemukan", 404);
  }

  if (member.status !== "Aktif") {
    throw new ServiceError(
      "Hanya anggota dengan status Aktif yang dapat mengajukan konfirmasi setoran simpanan",
      400
    );
  }

  const depositAmount = Number(input.amount);
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    throw new ServiceError("Nominal setoran harus lebih besar dari 0", 400);
  }

  // If setoran pokok, check that it does not exceed mandatory ceiling (Rp 500.000)
  if (input.savingsType === "pokok") {
    const currentPokok = Number(member.simpananPokok || 0);
    const targetPokok = 500000;
    if (currentPokok >= targetPokok) {
      throw new ServiceError(
        "Simpanan pokok Anda sudah lunas (Rp 500.000). Silakan pilih Simpanan Wajib atau Sukarela.",
        400
      );
    }
    if (currentPokok + depositAmount > targetPokok) {
      const remaining = targetPokok - currentPokok;
      throw new ServiceError(
        `Nominal setoran pokok melebihi sisa kekurangan (Sisa kekurangan pokok: Rp ${remaining.toLocaleString("id-ID")})`,
        400
      );
    }
  }

  const id = `sd_${crypto.randomUUID()}`;
  await database
    .query(
      `INSERT INTO savings_deposits (
        id, member_id, savings_type, amount, transfer_date,
        sender_bank, sender_account, sender_name,
        proof_url, proof_name, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu', NOW(), NOW())`
    )
    .run(
      id,
      memberId,
      input.savingsType,
      depositAmount,
      input.transferDate.slice(0, 10),
      input.senderBank?.trim() || null,
      input.senderAccount?.trim() || null,
      input.senderName?.trim() || null,
      input.proofUrl?.trim() || null,
      input.proofName?.trim() || null,
      input.notes?.trim() || null
    );

  const row = await database
    .query(
      `SELECT 
        sd.id,
        sd.member_id as "memberId",
        sd.savings_type as "savingsType",
        sd.amount::double precision as amount,
        sd.transfer_date::text as "transferDate",
        sd.sender_bank as "senderBank",
        sd.sender_account as "senderAccount",
        sd.sender_name as "senderName",
        sd.proof_url as "proofUrl",
        sd.proof_name as "proofName",
        sd.notes,
        sd.status,
        sd.payment_target_account_id as "paymentTargetAccountId",
        sd.transaction_id as "transactionId",
        sd.created_at as "createdAt",
        sd.updated_at as "updatedAt"
      FROM savings_deposits sd
      WHERE sd.id = ?`
    )
    .get<any>(id);

  return row ? { ...row, amount: Number(row.amount) } : null;
}

export async function getMemberDeposits(database: Db, memberId: string) {
  const rows = await database
    .query(
      `SELECT 
        sd.id,
        sd.member_id as "memberId",
        sd.savings_type as "savingsType",
        sd.amount::double precision as amount,
        sd.transfer_date::text as "transferDate",
        sd.sender_bank as "senderBank",
        sd.sender_account as "senderAccount",
        sd.sender_name as "senderName",
        sd.proof_url as "proofUrl",
        sd.proof_name as "proofName",
        sd.notes,
        sd.status,
        sd.payment_target_account_id as "paymentTargetAccountId",
        sd.transaction_id as "transactionId",
        sd.verified_by as "verifiedBy",
        sd.verified_at as "verifiedAt",
        sd.rejected_by as "rejectedBy",
        sd.rejected_at as "rejectedAt",
        sd.rejection_reason as "rejectionReason",
        sd.created_at as "createdAt",
        sd.updated_at as "updatedAt"
      FROM savings_deposits sd
      WHERE sd.member_id = ?
      ORDER BY sd.created_at DESC`
    )
    .all<any>(memberId);

  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function getDepositsList(
  database: Db,
  options: SavingsDepositFilters = {}
) {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.max(1, Math.min(100, Number(options.limit || 20)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const args: unknown[] = [];

  if (options.status) {
    conditions.push("sd.status = ?");
    args.push(options.status);
  }

  if (options.savingsType) {
    conditions.push("sd.savings_type = ?");
    args.push(options.savingsType);
  }

  if (options.memberId) {
    conditions.push("sd.member_id = ?");
    args.push(options.memberId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM savings_deposits sd
    ${whereClause}
  `;
  const countRes = (await database.query(countQuery).get(...args)) as { total: string | number } | null;
  const total = Number(countRes?.total || 0);

  const dataQuery = `
    SELECT 
      sd.id,
      sd.member_id as "memberId",
      m.name as "memberName",
      m.nik as "memberNik",
      sd.savings_type as "savingsType",
      sd.amount::double precision as amount,
      sd.transfer_date::text as "transferDate",
      sd.sender_bank as "senderBank",
      sd.sender_account as "senderAccount",
      sd.sender_name as "senderName",
      sd.proof_url as "proofUrl",
      sd.proof_name as "proofName",
      sd.notes,
      sd.status,
      sd.payment_target_account_id as "paymentTargetAccountId",
      a.name as "paymentTargetName",
      sd.transaction_id as "transactionId",
      sd.verified_by as "verifiedBy",
      sd.verified_at as "verifiedAt",
      sd.rejected_by as "rejectedBy",
      sd.rejected_at as "rejectedAt",
      sd.rejection_reason as "rejectionReason",
      sd.created_at as "createdAt",
      sd.updated_at as "updatedAt"
    FROM savings_deposits sd
    LEFT JOIN members m ON sd.member_id = m.id
    LEFT JOIN accounts a ON sd.payment_target_account_id = a.id
    ${whereClause}
    ORDER BY 
      CASE WHEN sd.status = 'Menunggu' THEN 0 ELSE 1 END,
      sd.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = await database.query(dataQuery).all<any>(...args, limit, offset);

  return {
    data: rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    })),
    total,
    page,
    limit,
  };
}

export async function approveSavingsDeposit(
  database: Db,
  id: string,
  actor: string,
  paymentTargetAccountId?: string | null
) {
  const deposit = await database
    .query(
      `SELECT id, member_id, savings_type, amount, transfer_date::text as transfer_date, status 
       FROM savings_deposits WHERE id = ?`
    )
    .get<{
      id: string;
      member_id: string;
      savings_type: string;
      amount: number | string;
      transfer_date: string;
      status: string;
    }>(id);

  if (!deposit) {
    throw new ServiceError("Data konfirmasi setoran tidak ditemukan", 404);
  }

  if (deposit.status !== "Menunggu") {
    throw new ServiceError(
      `Konfirmasi setoran tidak dapat disetujui karena sudah berstatus '${deposit.status}'`,
      400
    );
  }

  const depositAmount = Number(deposit.amount);

  // Update member savings balance (credit member savings, record ledger mutation and auto-journal)
  const savingsResult = await updateMemberSavings(
    database,
    deposit.member_id,
    {
      additionalSavings: depositAmount,
      savingsType: deposit.savings_type as any,
      transactionDate: toDateOnlyString(deposit.transfer_date),
      paymentSourceAccountId: paymentTargetAccountId || null,
    },
    actor
  );

  // Mark deposit as Diverifikasi
  await database
    .query(
      `UPDATE savings_deposits
       SET status = 'Diverifikasi',
           verified_by = ?,
           verified_at = NOW(),
           payment_target_account_id = ?,
           transaction_id = ?,
           updated_at = NOW()
       WHERE id = ?`
    )
    .run(actor, paymentTargetAccountId || null, savingsResult.transactionId, id);

  const row = await database
    .query(
      `SELECT 
        sd.id,
        sd.member_id as "memberId",
        m.name as "memberName",
        sd.savings_type as "savingsType",
        sd.amount::double precision as amount,
        sd.transfer_date::text as "transferDate",
        sd.sender_bank as "senderBank",
        sd.sender_account as "senderAccount",
        sd.sender_name as "senderName",
        sd.proof_url as "proofUrl",
        sd.proof_name as "proofName",
        sd.notes,
        sd.status,
        sd.payment_target_account_id as "paymentTargetAccountId",
        sd.transaction_id as "transactionId",
        sd.verified_by as "verifiedBy",
        sd.verified_at as "verifiedAt",
        sd.created_at as "createdAt",
        sd.updated_at as "updatedAt"
      FROM savings_deposits sd
      LEFT JOIN members m ON sd.member_id = m.id
      WHERE sd.id = ?`
    )
    .get<any>(id);

  return row ? { ...row, amount: Number(row.amount) } : null;
}

export async function rejectSavingsDeposit(
  database: Db,
  id: string,
  actor: string,
  rejectionReason: string
) {
  const deposit = await database
    .query("SELECT * FROM savings_deposits WHERE id = ?")
    .get<{
      id: string;
      member_id: string;
      amount: number | string;
      status: string;
    }>(id);

  if (!deposit) {
    throw new ServiceError("Data konfirmasi setoran tidak ditemukan", 404);
  }

  if (deposit.status !== "Menunggu") {
    throw new ServiceError(
      `Konfirmasi setoran tidak dapat ditolak karena sudah berstatus '${deposit.status}'`,
      400
    );
  }

  await database
    .query(
      `UPDATE savings_deposits
       SET status = 'Ditolak',
           rejected_by = ?,
           rejected_at = NOW(),
           rejection_reason = ?,
           updated_at = NOW()
       WHERE id = ?`
    )
    .run(actor, rejectionReason.trim(), id);

  const row = await database
    .query(
      `SELECT 
        sd.id,
        sd.member_id as "memberId",
        m.name as "memberName",
        sd.savings_type as "savingsType",
        sd.amount::double precision as amount,
        sd.transfer_date::text as "transferDate",
        sd.sender_bank as "senderBank",
        sd.sender_account as "senderAccount",
        sd.sender_name as "senderName",
        sd.proof_url as "proofUrl",
        sd.proof_name as "proofName",
        sd.notes,
        sd.status,
        sd.rejected_by as "rejectedBy",
        sd.rejected_at as "rejectedAt",
        sd.rejection_reason as "rejectionReason",
        sd.created_at as "createdAt",
        sd.updated_at as "updatedAt"
      FROM savings_deposits sd
      LEFT JOIN members m ON sd.member_id = m.id
      WHERE sd.id = ?`
    )
    .get<any>(id);

  return row ? { ...row, amount: Number(row.amount) } : null;
}
