import { expect, test, describe } from "bun:test";
import db from "../db";
import { createMember, deleteMember, updateMember } from "./memberService";
import { ServiceError } from "./errors";

describe("memberService", () => {
  test("createMember inserts member and initial savings transactions", async () => {
    const id = crypto.randomUUID();
    const name = `Service Member ${id}`;

    const { id: memberId } = await createMember(
      db,
      {
        name,
        role: "Anggota",
        status: "Aktif",
        joinDate: "01 Jan 2026",
        simpananPokok: 100000,
        simpananWajib: 5000,
        simpananSukarela: 0,
      },
      "member-service-test"
    );

    const member = await db.query("SELECT * FROM members WHERE id = ?").get(memberId) as {
      totalSavings: number;
    } | null;
    expect(member).not.toBeNull();
    expect(Number(member!.totalSavings)).toBe(105000);

    const txs = await db.query("SELECT type FROM transactions WHERE memberId = ? ORDER BY type").all(memberId) as {
      type: string;
    }[];
    expect(txs.map((t) => t.type)).toEqual(["setor_pokok", "setor_wajib"]);

    await db.run("DELETE FROM transactions WHERE memberId = ?", [memberId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("updateMember throws when member is missing", async () => {
    await expect(
      updateMember(db, crypto.randomUUID(), {
        name: "Missing",
        role: "Anggota",
        status: "Aktif",
        joinDate: "01 Jan 2026",
      })
    ).rejects.toBeInstanceOf(ServiceError);
  });

  test("updateMember renames denormalized loans.name for that member", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const oldName = `Old Name ${memberId.slice(0, 8)}`;
    const newName = `New Name ${memberId.slice(0, 8)}`;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, oldName, "Anggota", "Aktif", "01 Jan 2026", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanId, memberId, oldName, 5_000_000, 12, "Test", "Disetujui", new Date().toISOString()]
    );

    await updateMember(db, memberId, {
      name: newName,
      role: "Anggota",
      status: "Aktif",
      joinDate: "01 Jan 2026",
    });

    const member = await db
      .query("SELECT name FROM members WHERE id = ?")
      .get<{ name: string }>(memberId);
    const loan = await db
      .query("SELECT name FROM loans WHERE id = ?")
      .get<{ name: string }>(loanId);

    expect(member?.name).toBe(newName);
    expect(loan?.name).toBe(newName);

    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("deleteMember throws ServiceError if member has active loans", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, `FK Member ${memberId}`, "Anggota", "Aktif", "01 Jan 2026", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanId, memberId, `FK Member ${memberId}`, 5000, 6, "Test", "Menunggu", new Date().toISOString()]
    );

    await expect(deleteMember(db, memberId)).rejects.toMatchObject({
      message: "Anggota masih memiliki pinjaman aktif, selesaikan pinjaman terlebih dahulu.",
      status: 409,
    });

    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });
});