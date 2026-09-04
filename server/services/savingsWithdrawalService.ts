import type { Db } from "../db";
import { ServiceError } from "./errors";
import { updateMemberSavings } from "./savingsService";

export interface CreateSavingsWithdrawalInput {
  amount: number;
  destinationBank: string;
  destinationAccount: string;
  destinationName: string;
  notes?: string | null;
}

export interface SavingsWithdrawalFilters {
  status?: string;
  memberId?: string;
  page?: number;
  limit?: number;
}

export async function createSavingsWithdrawalRequest(
  database: Db,
  memberId: string,
  input: CreateSavingsWithdrawalInput
) {
  const member = await database
    .query(
      "SELECT id, name, status, simpananSukarela FROM members WHERE id = ? AND deletedAt IS NULL"
    )
    .get<{ id: string; name: string; status: string; simpananSukarela: number }>(memberId);

  if (!member) {
    throw new ServiceError("Anggota tidak ditemukan", 404);
  }

  if (member.status !== "Aktif") {
    throw new ServiceError(
      "Hanya anggota dengan status Aktif yang dapat mengajukan penarikan simpanan sukarela",
      400
    );
  }

  const requestedAmount = Number(input.amount);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new ServiceError("Nominal penarikan harus lebih besar dari 0", 400);
  }

  const currentSukarela = Number(member.simpananSukarela || 0);
  if (requestedAmount > currentSukarela) {
    throw new ServiceError(
      `Nominal penarikan (Rp ${requestedAmount.toLocaleString("id-ID")}) melebihi saldo simpanan sukarela tersedia (Rp ${currentSukarela.toLocaleString("id-ID")})`,
      400
    );
  }

  // Prevent multiple pending requests for the same member
  const pending = await database
    .query("SELECT id FROM savings_withdrawals WHERE member_id = ? AND status = 'Menunggu'")
    .all<{ id: string }>(memberId);

  if (pending.length > 0) {
    throw new ServiceError(
      "Anda masih memiliki pengajuan penarikan simpanan sukarela yang berstatus Menunggu. Mohon tunggu hingga pengajuan tersebut diproses.",
      400
    );
  }

  const id = `sw_${crypto.randomUUID()}`;
  await database
    .query(
      `INSERT INTO savings_withdrawals (
        id, member_id, amount, destination_bank, destination_account, destination_name, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Menunggu', NOW(), NOW())`
    )
    .run(
      id,
      memberId,
      requestedAmount,
      input.destinationBank.trim(),
      input.destinationAccount.trim(),
      input.destinationName.trim(),
      input.notes?.trim() || null
    );

  const row = await database
    .query(
      `SELECT 
        sw.id,
        sw.member_id as "memberId",
        sw.amount::double precision as amount,
        sw.destination_bank as "destinationBank",
        sw.destination_account as "destinationAccount",
        sw.destination_name as "destinationName",
        sw.notes,
        sw.status,
        sw.payment_source_account_id as "paymentSourceAccountId",
        sw.transaction_id as "transactionId",
        sw.created_at as "createdAt",
        sw.updated_at as "updatedAt"
      FROM savings_withdrawals sw
      WHERE sw.id = ?`
    )
    .get<any>(id);

  return row ? { ...row, amount: Number(row.amount) } : null;
}

export async function getMemberWithdrawals(database: Db, memberId: string) {
  const rows = await database
    .query(
      `SELECT 
        sw.id,
        sw.member_id as "memberId",
        sw.amount::double precision as amount,
        sw.destination_bank as "destinationBank",
        sw.destination_account as "destinationAccount",
        sw.destination_name as "destinationName",
        sw.notes,
        sw.status,
        sw.payment_source_account_id as "paymentSourceAccountId",
        sw.transaction_id as "transactionId",
        sw.approved_by as "approvedBy",
        sw.approved_at as "approvedAt",
        sw.rejected_by as "rejectedBy",
        sw.rejected_at as "rejectedAt",
        sw.rejection_reason as "rejectionReason",
        sw.created_at as "createdAt",
        sw.updated_at as "updatedAt"
      FROM savings_withdrawals sw
      WHERE sw.member_id = ?
      ORDER BY sw.created_at DESC`
    )
    .all<any>(memberId);

  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function getWithdrawalsList(
  database: Db,
  options: SavingsWithdrawalFilters = {}
) {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.max(1, Math.min(100, Number(options.limit || 20)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const args: unknown[] = [];

  if (options.status) {
    conditions.push("sw.status = ?");
    args.push(options.status);
  }

  if (options.memberId) {
    conditions.push("sw.member_id = ?");
    args.push(options.memberId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM savings_withdrawals sw
    ${whereClause}
  `;
  const countRes = (await database.query(countQuery).get(...args)) as { total: string | number } | null;
  const total = Number(countRes?.total || 0);

  const dataQuery = `
    SELECT 
      sw.id,
      sw.member_id as "memberId",
      m.name as "memberName",
      m.nik as "memberNik",
      m.simpananSukarela::double precision as "currentSukarela",
      sw.amount::double precision as amount,
      sw.destination_bank as "destinationBank",
      sw.destination_account as "destinationAccount",
      sw.destination_name as "destinationName",
      sw.notes,
      sw.status,
      sw.payment_source_account_id as "paymentSourceAccountId",
      a.name as "paymentSourceName",
      sw.transaction_id as "transactionId",
      sw.approved_by as "approvedBy",
      sw.approved_at as "approvedAt",
      sw.rejected_by as "rejectedBy",
      sw.rejected_at as "rejectedAt",
      sw.rejection_reason as "rejectionReason",
      sw.created_at as "createdAt",
      sw.updated_at as "updatedAt"
    FROM savings_withdrawals sw
    LEFT JOIN members m ON sw.member_id = m.id
    LEFT JOIN accounts a ON sw.payment_source_account_id = a.id
    ${whereClause}
    ORDER BY 
      CASE WHEN sw.status = 'Menunggu' THEN 0 ELSE 1 END,
      sw.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = await database.query(dataQuery).all<any>(...args, limit, offset);

  return {
    data: rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      currentSukarela: r.currentSukarela != null ? Number(r.currentSukarela) : null,
    })),
    total,
    page,
    limit,
  };
}

export async function approveSavingsWithdrawal(
  database: Db,
  id: string,
  actor: string,
  paymentSourceAccountId?: string | null
) {
  const withdrawal = await database
    .query("SELECT * FROM savings_withdrawals WHERE id = ?")
    .get<{
      id: string;
      member_id: string;
      amount: number | string;
      status: string;
    }>(id);

  if (!withdrawal) {
    throw new ServiceError("Permohonan penarikan tidak ditemukan", 404);
  }

  if (withdrawal.status !== "Menunggu") {
    throw new ServiceError(
      `Permohonan penarikan tidak dapat disetujui karena sudah berstatus '${withdrawal.status}'`,
      400
    );
  }

  const withdrawalAmount = Number(withdrawal.amount);

  // Validate member balance before mutation
  const member = await database
    .query("SELECT id, name, simpananSukarela FROM members WHERE id = ?")
    .get<{ id: string; name: string; simpananSukarela: number }>(withdrawal.member_id);

  if (!member) {
    throw new ServiceError("Data anggota pemohon tidak ditemukan", 404);
  }

  if (Number(member.simpananSukarela || 0) < withdrawalAmount) {
    throw new ServiceError(
      `Saldo simpanan sukarela anggota (Rp ${Number(member.simpananSukarela || 0).toLocaleString("id-ID")}) tidak mencukupi untuk penarikan sebesar Rp ${withdrawalAmount.toLocaleString("id-ID")}`,
      400
    );
  }

  // Update member savings balance (deduct sukarela & total savings, insert transaction, and record auto-journal)
  const savingsResult = await updateMemberSavings(
    database,
    withdrawal.member_id,
    {
      additionalSavings: -withdrawalAmount,
      savingsType: "sukarela",
      paymentSourceAccountId: paymentSourceAccountId || null,
    },
    actor
  );

  // Mark withdrawal as Disetujui
  await database
    .query(
      `UPDATE savings_withdrawals
       SET status = 'Disetujui',
           approved_by = ?,
           approved_at = NOW(),
           payment_source_account_id = ?,
           transaction_id = ?,
           updated_at = NOW()
       WHERE id = ?`
    )
    .run(actor, paymentSourceAccountId || null, savingsResult.transactionId, id);

  const row = await database
    .query(
      `SELECT 
        sw.id,
        sw.member_id as "memberId",
        m.name as "memberName",
        sw.amount::double precision as amount,
        sw.destination_bank as "destinationBank",
        sw.destination_account as "destinationAccount",
        sw.destination_name as "destinationName",
        sw.notes,
        sw.status,
        sw.payment_source_account_id as "paymentSourceAccountId",
        sw.transaction_id as "transactionId",
        sw.approved_by as "approvedBy",
        sw.approved_at as "approvedAt",
        sw.created_at as "createdAt",
        sw.updated_at as "updatedAt"
      FROM savings_withdrawals sw
      LEFT JOIN members m ON sw.member_id = m.id
      WHERE sw.id = ?`
    )
    .get<any>(id);

  return row ? { ...row, amount: Number(row.amount) } : null;
}

export async function rejectSavingsWithdrawal(
  database: Db,
  id: string,
  actor: string,
  rejectionReason: string
) {
  const withdrawal = await database
    .query("SELECT * FROM savings_withdrawals WHERE id = ?")
    .get<{
      id: string;
      member_id: string;
      amount: number | string;
      status: string;
    }>(id);

  if (!withdrawal) {
    throw new ServiceError("Permohonan penarikan tidak ditemukan", 404);
  }

  if (withdrawal.status !== "Menunggu") {
    throw new ServiceError(
      `Permohonan penarikan tidak dapat ditolak karena sudah berstatus '${withdrawal.status}'`,
      400
    );
  }

  await database
    .query(
      `UPDATE savings_withdrawals
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
        sw.id,
        sw.member_id as "memberId",
        m.name as "memberName",
        sw.amount::double precision as amount,
        sw.destination_bank as "destinationBank",
        sw.destination_account as "destinationAccount",
        sw.destination_name as "destinationName",
        sw.notes,
        sw.status,
        sw.rejected_by as "rejectedBy",
        sw.rejected_at as "rejectedAt",
        sw.rejection_reason as "rejectionReason",
        sw.created_at as "createdAt",
        sw.updated_at as "updatedAt"
      FROM savings_withdrawals sw
      LEFT JOIN members m ON sw.member_id = m.id
      WHERE sw.id = ?`
    )
    .get<any>(id);

  return row ? { ...row, amount: Number(row.amount) } : null;
}
