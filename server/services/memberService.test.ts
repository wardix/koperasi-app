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

  test("createMember stores optional NIK and rejects duplicates", async () => {
    const nik = "3201010101010001";
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();

    const { id: idA } = await createMember(
      db,
      {
        name: `NIK Member A ${a}`,
        role: "Anggota",
        status: "Aktif",
        joinDate: "2026-01-01",
        nik,
        simpananPokok: 0,
        simpananWajib: 0,
        simpananSukarela: 0,
      },
      "nik-test"
    );

    const row = await db
      .query("SELECT nik FROM members WHERE id = ?")
      .get<{ nik: string }>(idA);
    expect(row?.nik).toBe(nik);

    await expect(
      createMember(
        db,
        {
          name: `NIK Member B ${b}`,
          role: "Anggota",
          status: "Aktif",
          joinDate: "2026-01-01",
          nik,
          simpananPokok: 0,
          simpananWajib: 0,
          simpananSukarela: 0,
        },
        "nik-test"
      )
    ).rejects.toMatchObject({
      message: "NIK sudah terdaftar pada anggota lain",
      status: 409,
    });

    await db.run("DELETE FROM members WHERE id = ?", [idA]);
  });

  test("createMember stores optional phone number", async () => {
    const idHint = crypto.randomUUID();
    const { id } = await createMember(
      db,
      {
        name: `Phone Member ${idHint}`,
        role: "Anggota",
        status: "Aktif",
        joinDate: "2026-01-01",
        phone: "+62 812-3456-7890",
        simpananPokok: 0,
        simpananWajib: 0,
        simpananSukarela: 0,
      },
      "phone-test"
    );

    const row = await db
      .query("SELECT phone FROM members WHERE id = ?")
      .get<{ phone: string }>(id);
    expect(row?.phone).toBe("+6281234567890");

    await db.run("DELETE FROM members WHERE id = ?", [id]);
  });

  test("createMember can set portal email and password in one step", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const email = `portal.create.${suffix}@example.com`;
    const { id, hasPortalAccess } = await createMember(
      db,
      {
        name: `Portal Create ${suffix}`,
        role: "Anggota",
        status: "Aktif",
        joinDate: "2026-01-01",
        simpananPokok: 0,
        simpananWajib: 0,
        simpananSukarela: 0,
        email,
        password: "password123",
      },
      "portal-create-test"
    );

    expect(hasPortalAccess).toBe(true);
    const row = await db
      .query("SELECT email, password FROM members WHERE id = ?")
      .get<{ email: string; password: string }>(id);
    expect(row?.email).toBe(email);
    expect(row?.password).toBeTruthy();
    expect(row?.password).not.toBe("password123");
    expect(await Bun.password.verify("password123", row!.password)).toBe(true);

    await db.run("DELETE FROM members WHERE id = ?", [id]);
  });

  test("createMember rejects password without email", async () => {
    await expect(
      createMember(
        db,
        {
          name: "No Email Portal",
          role: "Anggota",
          status: "Aktif",
          joinDate: "2026-01-01",
          simpananPokok: 0,
          simpananWajib: 0,
          simpananSukarela: 0,
          password: "password123",
        },
        "portal-create-test"
      )
    ).rejects.toMatchObject({
      message: "Email portal wajib diisi jika password diisi",
      status: 400,
    });
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