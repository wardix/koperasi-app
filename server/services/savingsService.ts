import type { Db } from "../db";
import type { MemberSavingsCols } from "../db/entities";
import { ServiceError } from "./errors";

export type SavingsType = "pokok" | "wajib" | "sukarela";

export type UpdateSavingsInput = {
  additionalSavings: number;
  savingsType: SavingsType;
  /** Optional backdated date as YYYY-MM-DD. Defaults to now when omitted. */
  transactionDate?: string;
};

/**
 * Resolve ISO timestamp for a savings transaction.
 * Uses local noon for calendar dates so toLocaleDateString stays on the same day.
 */
export function resolveTransactionCreatedAt(transactionDate?: string): string {
  if (!transactionDate) {
    return new Date().toISOString();
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(transactionDate);
  if (!match) {
    throw new ServiceError("Format tanggal tidak valid", 400);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    Number.isNaN(localNoon.getTime()) ||
    localNoon.getFullYear() !== year ||
    localNoon.getMonth() !== month - 1 ||
    localNoon.getDate() !== day
  ) {
    throw new ServiceError("Tanggal transaksi tidak valid", 400);
  }

  const today = new Date();
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  if (localNoon.getTime() > endOfToday.getTime()) {
    throw new ServiceError("Tanggal transaksi tidak boleh di masa depan", 400);
  }

  return localNoon.toISOString();
}

export type UpdateSavingsResult = {
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
    .query("SELECT simpananPokok, simpananWajib, simpananSukarela, totalSavings FROM members WHERE id = ?")
    .get<MemberSavingsCols>(memberId);

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

  await database.transaction(async () => {
    await database
      .query("UPDATE members SET simpananPokok = ?, simpananWajib = ?, simpananSukarela = ?, totalSavings = ? WHERE id = ?")
      .run(newPokok, newWajib, newSukarela, newTotal, memberId);

    await database.query(`
      INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      memberId,
      additionalSavingsNum >= 0 ? `setor_${input.savingsType}` : `tarik_${input.savingsType}`,
      Math.abs(additionalSavingsNum),
      Number(member.totalSavings ?? 0),
      newTotal,
      createdAt,
      createdBy
    );
  })();

  return {
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