import { expect, test, describe } from "bun:test";
import db from "../db";
import { updateMemberSavings, validateSavingsMutation } from "./savingsService";
import { ServiceError } from "./errors";

describe("savingsService", () => {
  test("validateSavingsMutation rejects withdrawal beyond balance", () => {
    expect(() =>
      validateSavingsMutation(
        { simpananPokok: 100, simpananWajib: 0, simpananSukarela: 0, totalSavings: 100 },
        -500,
        "pokok"
      )
    ).toThrow(ServiceError);
  });

  test("updateMemberSavings records deposit transaction", async () => {
    const memberId = crypto.randomUUID();

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, `Savings Member ${memberId}`, "Anggota", "Aktif", "01 Jan 2026", 5000, 0, 0, 5000]
    );

    const result = await updateMemberSavings(
      db,
      memberId,
      { additionalSavings: 2000, savingsType: "sukarela" },
      "savings-service-test"
    );

    expect(result.newTotal).toBe(7000);

    const tx = await db
      .query("SELECT type, amount, balanceBefore, balanceAfter FROM transactions WHERE memberId = ?")
      .get(memberId) as { type: string; amount: number; balanceBefore: number; balanceAfter: number } | null;

    expect(tx?.type).toBe("setor_sukarela");
    expect(Number(tx?.amount)).toBe(2000);
    expect(Number(tx?.balanceBefore)).toBe(5000);
    expect(Number(tx?.balanceAfter)).toBe(7000);

    await db.run("DELETE FROM transactions WHERE memberId = ?", [memberId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("updateMemberSavings throws when member is missing", async () => {
    await expect(
      updateMemberSavings(
        db,
        crypto.randomUUID(),
        { additionalSavings: 1000, savingsType: "sukarela" },
        "savings-service-test"
      )
    ).rejects.toMatchObject({ message: "Not found", status: 404 });
  });
});