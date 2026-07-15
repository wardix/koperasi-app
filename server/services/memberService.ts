import type { Db } from "../db";
import type { MemberRow } from "../db/entities";
import { isForeignKeyError, ServiceError } from "./errors";

export type CreateMemberInput = {
  name: string;
  role: string;
  status: string;
  joinDate: string;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
};

export type UpdateMemberInput = Pick<CreateMemberInput, "name" | "role" | "status" | "joinDate">;

async function recordInitialSavingsTransactions(
  database: Db,
  memberId: string,
  input: CreateMemberInput,
  createdBy: string
): Promise<void> {
  const { simpananPokok, simpananWajib, simpananSukarela } = input;
  const createdAt = new Date().toISOString();

  if (simpananPokok > 0) {
    await database.query(`
      INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), memberId, "setor_pokok", simpananPokok, 0, simpananPokok, createdAt, createdBy);
  }

  if (simpananWajib > 0) {
    await database.query(`
      INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      memberId,
      "setor_wajib",
      simpananWajib,
      simpananPokok,
      simpananPokok + simpananWajib,
      createdAt,
      createdBy
    );
  }

  if (simpananSukarela > 0) {
    const balanceBefore = simpananPokok + simpananWajib;
    await database.query(`
      INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      memberId,
      "setor_sukarela",
      simpananSukarela,
      balanceBefore,
      balanceBefore + simpananSukarela,
      createdAt,
      createdBy
    );
  }
}

export async function createMember(
  database: Db,
  input: CreateMemberInput,
  createdBy: string
): Promise<{ id: string }> {
  const totalSavings = input.simpananPokok + input.simpananWajib + input.simpananSukarela;
  const id = crypto.randomUUID();

  const insert = database.prepare(`
    INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await database.transaction(async () => {
    await insert.run(
      id,
      input.name,
      input.role,
      input.status,
      input.joinDate,
      input.simpananPokok,
      input.simpananWajib,
      input.simpananSukarela,
      totalSavings
    );
    await recordInitialSavingsTransactions(database, id, input, createdBy);
  })();

  return { id };
}

export async function updateMember(
  database: Db,
  id: string,
  input: UpdateMemberInput
): Promise<{ before: Pick<MemberRow, "name" | "role"> }> {
  const oldMember = await database
    .query("SELECT id, name, role, status, joinDate FROM members WHERE id = ?")
    .get<Pick<MemberRow, "id" | "name" | "role" | "status" | "joinDate">>(id);

  if (!oldMember) {
    throw new ServiceError("Member not found", 404);
  }

  const update = database.prepare(`
    UPDATE members SET name = ?, role = ?, status = ?, joinDate = ?
    WHERE id = ?
  `);
  await update.run(input.name, input.role, input.status, input.joinDate, id);

  return { before: { name: oldMember.name, role: oldMember.role } };
}

export async function deleteMember(database: Db, id: string): Promise<Pick<MemberRow, "name" | "role">> {
  const before = await database
    .query("SELECT name, role FROM members WHERE id = ? AND deletedAt IS NULL")
    .get<Pick<MemberRow, "name" | "role">>(id);

  if (!before) {
    throw new ServiceError("Member not found", 404);
  }

  // Block deletion if the member still has active loans
  const activeLoans = await database
    .query("SELECT COUNT(*) as count FROM loans WHERE memberId = ? AND status IN ('Menunggu', 'Disetujui') AND deletedAt IS NULL")
    .get<{ count: number }>(id);

  if ((activeLoans?.count ?? 0) > 0) {
    throw new ServiceError("Anggota masih memiliki pinjaman aktif, selesaikan pinjaman terlebih dahulu.", 409);
  }

  // Soft-delete: stamp deletedAt instead of issuing DELETE
  await database
    .query("UPDATE members SET deletedAt = ? WHERE id = ?")
    .run(new Date().toISOString(), id);

  return before;
}