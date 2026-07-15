import type { Db } from "../db";
import type { MemberSavingsCols } from "../db/entities";
import { ServiceError } from "./errors";

export type SavingsType = "pokok" | "wajib" | "sukarela";

export type UpdateSavingsInput = {
  additionalSavings: number;
  savingsType: SavingsType;
};

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
      new Date().toISOString(),
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