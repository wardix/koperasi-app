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

  test("deleteMember throws foreign key error as ServiceError", async () => {
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
      message: "Anggota memiliki pinjaman, hapus pinjaman terlebih dahulu.",
      status: 400,
    });

    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });
});