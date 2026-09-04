import type { Db } from "../db";
import type { MemberSavingsCols } from "../db/entities";
import { resolveCalendarDateIso } from "../lib/dates";
import { ServiceError } from "./errors";
import { recordAutoJournal } from "./accountingService";

export type SavingsType = "pokok" | "wajib" | "sukarela";

export type UpdateSavingsInput = {
  additionalSavings: number;
  savingsType: SavingsType;
  /** Optional backdated date as YYYY-MM-DD. Defaults to now when omitted. */
  transactionDate?: string;
  paymentSourceAccountId?: string | null;
};

/** @deprecated use resolveCalendarDateIso from ../lib/dates */
export function resolveTransactionCreatedAt(transactionDate?: string): string {
  return resolveCalendarDateIso(transactionDate);
}

export type UpdateSavingsResult = {
  transactionId: string;
  newTotal: number;
  before: MemberSavingsCols;
  after: {
    simpananPokok: number;
    simpananWajib: number;
    simpananSukarela: number;
    additionalSavings: number;
    savingsType: SavingsType;
  };
};

export function validateSavingsMutation(
  member: MemberSavingsCols,
  additionalSavings: number,
  savingsType: SavingsType
): { newPokok: number; newWajib: number; newSukarela: number; newTotal: number } {
  const additionalSavingsNum = Number(additionalSavings);
  let newPokok = Number(member.simpananPokok ?? 0);
  let newWajib = Number(member.simpananWajib ?? 0);
  let newSukarela = Number(member.simpananSukarela ?? 0);

  if (savingsType === "pokok") newPokok += additionalSavingsNum;
  else if (savingsType === "wajib") newWajib += additionalSavingsNum;
  else newSukarela += additionalSavingsNum;

  if (additionalSavingsNum < 0) {
    if (newSukarela < 0) {
      throw new ServiceError("Penarikan melebihi saldo sukarela tersedia");
    }

    const newTotal = newPokok + newWajib + newSukarela;
    if (newTotal < 0) {
      throw new ServiceError("Penarikan melebihi total simpanan tersedia");
    }
  }

  if (newPokok < 0 || newWajib < 0 || newSukarela < 0) {
    throw new ServiceError("Saldo tidak mencukupi");
  }

  return {
    newPokok,
    newWajib,
    newSukarela,
    newTotal: newPokok + newWajib + newSukarela,
  };
}

export async function updateMemberSavings(
  database: Db,
  memberId: string,
  input: UpdateSavingsInput,
  createdBy: string
): Promise<UpdateSavingsResult> {
  const member = await database
    .query("SELECT simpananPokok, simpananWajib, simpananSukarela, totalSavings, name FROM members WHERE id = ?")
    .get<MemberSavingsCols & { name: string }>(memberId);

  if (!member) {
    throw new ServiceError("Not found", 404);
  }

  const additionalSavingsNum = Number(input.additionalSavings);
  const { newPokok, newWajib, newSukarela, newTotal } = validateSavingsMutation(
    member,
    additionalSavingsNum,
    input.savingsType
  );
  const createdAt = resolveTransactionCreatedAt(input.transactionDate);

  const transactionId = crypto.randomUUID();

  await database.transaction(async () => {
    await database
      .query("UPDATE members SET simpananPokok = ?, simpananWajib = ?, simpananSukarela = ?, totalSavings = ? WHERE id = ?")
      .run(newPokok, newWajib, newSukarela, newTotal, memberId);

    await database.query(`
      INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        transactionId,
        memberId,
        additionalSavingsNum >= 0 ? `setor_${input.savingsType}` : `tarik_${input.savingsType}`,
        Math.abs(additionalSavingsNum),
        Number(member.totalSavings ?? 0),
        newTotal,
        createdAt,
        createdBy
      );

    // Otomatisasi Jurnal
    let simpananAccountCode = '21101';
    if (input.savingsType === 'pokok') simpananAccountCode = '31101';
    else if (input.savingsType === 'wajib') simpananAccountCode = '31102';
    
    let kasCode = '11102'; // Default Kas Bank
    if (input.paymentSourceAccountId) {
      const acc = (await database
        .query("SELECT code FROM accounts WHERE id::text = ? OR code = ?")
        .get(input.paymentSourceAccountId, input.paymentSourceAccountId)) as { code?: string } | null;
      if (acc?.code) {
        kasCode = acc.code;
      }
    }

    const absAmount = Math.abs(additionalSavingsNum);
    const isSetor = additionalSavingsNum >= 0;

    try {
      await recordAutoJournal({
        transaction_date: createdAt,
        description: `${isSetor ? 'Setoran' : 'Penarikan'} Simpanan ${input.savingsType} — ${member.name}`,
        reference_type: `savings_${isSetor ? 'setor' : 'tarik'}`,
        reference_id: transactionId,
        lines: [
          { account_code: kasCode, debit: isSetor ? absAmount : 0, credit: isSetor ? 0 : absAmount },
          { account_code: simpananAccountCode, debit: isSetor ? 0 : absAmount, credit: isSetor ? absAmount : 0 },
        ]
      });
    } catch (err) {
      console.error("Gagal auto-journal simpanan:", err);
    }
  })();

  return {
    transactionId,
    newTotal,
    before: member,
    after: {
      simpananPokok: newPokok,
      simpananWajib: newWajib,
      simpananSukarela: newSukarela,
      additionalSavings: additionalSavingsNum,
      savingsType: input.savingsType,
    },
  };
}

export type BatchSavingsImportItem = {
  memberId?: string;
  nik?: string;
  savingsType: SavingsType;
  amount: number;
  transactionDate?: string;
};

export type BatchSavingsImportResult = {
  processedCount: number;
  failedCount: number;
  errors: Array<{ index: number; identifier: string; message: string }>;
};

export async function batchImportSavings(
  database: Db,
  items: BatchSavingsImportItem[],
  createdBy: string
): Promise<BatchSavingsImportResult> {
  let processedCount = 0;
  const errors: Array<{ index: number; identifier: string; message: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const identifier = item.memberId || item.nik || `Baris #${i + 1}`;

    if (!item.amount || item.amount <= 0) {
      errors.push({ index: i, identifier, message: "Nominal setoran harus lebih besar dari 0" });
      continue;
    }

    let member: { id: string } | null = null;
    if (item.memberId) {
      member = await database
        .query("SELECT id FROM members WHERE id = ? AND deletedAt IS NULL")
        .get<{ id: string }>(item.memberId);
    } else if (item.nik) {
      const cleanNik = String(item.nik).replace(/\D/g, "");
      member = await database
        .query("SELECT id FROM members WHERE nik = ? AND deletedAt IS NULL")
        .get<{ id: string }>(cleanNik);
    }

    if (!member) {
      errors.push({ index: i, identifier, message: "Anggota tidak ditemukan" });
      continue;
    }

    try {
      await updateMemberSavings(
        database,
        member.id,
        {
          additionalSavings: item.amount,
          savingsType: item.savingsType || "pokok",
          transactionDate: item.transactionDate,
        },
        createdBy
      );
      processedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memproses simpanan";
      errors.push({ index: i, identifier, message: msg });
    }
  }

  return {
    processedCount,
    failedCount: errors.length,
    errors,
  };
}