import type { Db } from "../db";
import type { MemberRow } from "../db/entities";
import { isForeignKeyError, ServiceError } from "./errors";

export type CreateMemberInput = {
  name: string;
  role: string;
  status: string;
  joinDate: string;
  /** Optional 16-digit NIK; null/undefined = not set */
  nik?: string | null;
  /** Optional phone / mobile number */
  phone?: string | null;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  /** Optional portal email (enables Google SSO match and/or password login) */
  email?: string | null;
  /** Optional portal password (requires email); hashed before store */
  password?: string | null;
};

export type UpdateMemberInput = Pick<
  CreateMemberInput,
  "name" | "role" | "status" | "joinDate" | "nik" | "phone"
>;

function normalizeNik(nik: string | null | undefined): string | null {
  if (nik == null || nik === "") return null;
  const digits = String(nik).replace(/\D/g, "");
  return digits.length === 0 ? null : digits;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null || phone === "") return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  const msg = e?.message || (err instanceof Error ? err.message : String(err));
  return e?.code === "23505" || /unique|duplicate key/i.test(msg);
}

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
): Promise<{ id: string; hasPortalAccess: boolean }> {
  const totalSavings = input.simpananPokok + input.simpananWajib + input.simpananSukarela;
  const id = crypto.randomUUID();
  const nik = normalizeNik(input.nik);
  const phone = normalizePhone(input.phone);
  const email =
    input.email != null && String(input.email).trim() !== ""
      ? String(input.email).trim().toLowerCase()
      : null;
  const password =
    input.password != null && String(input.password).length > 0
      ? String(input.password)
      : null;

  if (nik && !/^\d{16}$/.test(nik)) {
    throw new ServiceError("NIK harus 16 digit angka", 400);
  }
  if (phone) {
    const digitCount = phone.replace(/\D/g, "").length;
    if (digitCount < 8 || digitCount > 15) {
      throw new ServiceError("Nomor telepon harus 8–15 digit", 400);
    }
  }
  if (password && !email) {
    throw new ServiceError("Email portal wajib diisi jika password diisi", 400);
  }
  if (password && password.length < 8) {
    throw new ServiceError("Password minimal 8 karakter", 400);
  }

  if (nik) {
    const clash = await database
      .query(
        `SELECT id FROM members WHERE nik = ? AND deletedAt IS NULL LIMIT 1`
      )
      .get<{ id: string }>(nik);
    if (clash) {
      throw new ServiceError("NIK sudah terdaftar pada anggota lain", 409);
    }
  }

  if (email) {
    const emailClash = await database
      .query(
        `SELECT id FROM members WHERE lower(email) = ? AND deletedAt IS NULL LIMIT 1`
      )
      .get<{ id: string }>(email);
    if (emailClash) {
      throw new ServiceError("Email sudah dipakai anggota lain", 409);
    }
  }

  const insert = database.prepare(`
    INSERT INTO members (id, name, role, status, joinDate, nik, phone, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let hasPortalAccess = false;

  try {
    await database.transaction(async () => {
      await insert.run(
        id,
        input.name,
        input.role,
        input.status,
        input.joinDate,
        nik,
        phone,
        input.simpananPokok,
        input.simpananWajib,
        input.simpananSukarela,
        totalSavings
      );
      await recordInitialSavingsTransactions(database, id, input, createdBy);

      if (email || password) {
        const portal = await setMemberPortalAccess(database, id, {
          email: email ?? undefined,
          password: password ?? undefined,
        });
        hasPortalAccess = portal.after.hasPassword || !!portal.after.email;
      }
    })();
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    if (isUniqueViolation(err)) {
      throw new ServiceError("NIK atau email sudah terdaftar pada anggota lain", 409);
    }
    throw err;
  }

  return { id, hasPortalAccess };
}

export async function updateMember(
  database: Db,
  id: string,
  input: UpdateMemberInput
): Promise<{ before: Pick<MemberRow, "name" | "role" | "nik" | "phone"> }> {
  const oldMember = await database
    .query("SELECT id, name, role, status, joinDate, nik, phone FROM members WHERE id = ?")
    .get<Pick<MemberRow, "id" | "name" | "role" | "status" | "joinDate" | "nik" | "phone">>(id);

  if (!oldMember) {
    throw new ServiceError("Member not found", 404);
  }

  const nik = normalizeNik(input.nik);
  const phone = normalizePhone(input.phone);
  if (nik && !/^\d{16}$/.test(nik)) {
    throw new ServiceError("NIK harus 16 digit angka", 400);
  }
  if (phone) {
    const digitCount = phone.replace(/\D/g, "").length;
    if (digitCount < 8 || digitCount > 15) {
      throw new ServiceError("Nomor telepon harus 8–15 digit", 400);
    }
  }

  if (nik) {
    const clash = await database
      .query(
        `SELECT id FROM members WHERE nik = ? AND id != ? AND deletedAt IS NULL LIMIT 1`
      )
      .get<{ id: string }>(nik, id);
    if (clash) {
      throw new ServiceError("NIK sudah terdaftar pada anggota lain", 409);
    }
  }

  try {
    await database.transaction(async () => {
      const update = database.prepare(`
        UPDATE members SET name = ?, role = ?, status = ?, joinDate = ?, nik = ?, phone = ?
        WHERE id = ?
      `);
      await update.run(input.name, input.role, input.status, input.joinDate, nik, phone, id);

      // loans.name is a denormalized snapshot used by loan/cashflow ledgers —
      // keep it aligned when the member is renamed.
      if (input.name !== oldMember.name) {
        await database.run(`UPDATE loans SET name = ? WHERE memberId = ?`, [input.name, id]);
      }
    })();
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ServiceError("NIK sudah terdaftar pada anggota lain", 409);
    }
    throw err;
  }

  return {
    before: {
      name: oldMember.name,
      role: oldMember.role,
      nik: oldMember.nik,
      phone: oldMember.phone,
    },
  };
}

export type PortalAccessInput = {
  email?: string;
  password?: string;
};

/**
 * Set or update portal login credentials for a member.
 * Password is hashed with Bun.password; empty password keeps the existing hash.
 */
export async function setMemberPortalAccess(
  database: Db,
  id: string,
  input: PortalAccessInput
): Promise<{ before: { email: string | null; hasPassword: boolean }; after: { email: string | null; hasPassword: boolean } }> {
  const member = await database
    .query("SELECT id, email, password FROM members WHERE id = ? AND deletedAt IS NULL")
    .get<{ id: string; email: string | null; password: string | null }>(id);

  if (!member) {
    throw new ServiceError("Member not found", 404);
  }

  const nextEmail =
    input.email !== undefined && input.email !== ""
      ? input.email.trim().toLowerCase()
      : input.email === ""
        ? null
        : member.email;

  if (nextEmail) {
    const clash = await database
      .query("SELECT id FROM members WHERE email = ? AND id != ? AND deletedAt IS NULL")
      .get<{ id: string }>(nextEmail, id);
    if (clash) {
      throw new ServiceError("Email sudah dipakai anggota lain", 409);
    }
  }

  let nextPassword = member.password;
  if (input.password && input.password.length > 0) {
    nextPassword = await Bun.password.hash(input.password);
  }

  if (!nextEmail && !nextPassword) {
    throw new ServiceError("Email portal wajib diisi untuk mengaktifkan akses", 400);
  }

  // If setting password for first time, email is required
  if (input.password && input.password.length > 0 && !nextEmail && !member.email) {
    throw new ServiceError("Email portal wajib diisi bersama password", 400);
  }

  await database.run(`UPDATE members SET email = ?, password = ? WHERE id = ?`, [
    nextEmail,
    nextPassword,
    id,
  ]);

  return {
    before: { email: member.email, hasPassword: !!(member.password && member.password.length > 0) },
    after: { email: nextEmail, hasPassword: !!(nextPassword && nextPassword.length > 0) },
  };
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