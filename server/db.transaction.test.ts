import { expect, test, describe } from "bun:test";
import db from "./db";

describe("db.transaction atomicity", () => {
  test("rolls back all writes when callback throws", async () => {
    const id = crypto.randomUUID();

    let threw = false;
    try {
      await db.transaction(async () => {
        await db.run(
          `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, `Rollback Member ${id}`, "Anggota", "Aktif", "01 Jan 2026", 1000, 0, 0, 1000]
        );
        await db.run(
          `INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            id,
            "setor_pokok",
            1000,
            0,
            1000,
            new Date().toISOString(),
            "transaction-test",
          ]
        );
        throw new Error("force rollback");
      })();
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("force rollback");
    }

    expect(threw).toBe(true);

    const member = await db.query("SELECT id FROM members WHERE id = ?").get(id);
    expect(member).toBeNull();

    const txs = await db.query("SELECT id FROM transactions WHERE memberId = ?").all(id);
    expect(txs).toEqual([]);
  });

  test("commits all writes when callback succeeds", async () => {
    const id = crypto.randomUUID();
    const txId = crypto.randomUUID();

    await db.transaction(async () => {
      await db.run(
        `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, `Commit Member ${id}`, "Anggota", "Aktif", "01 Jan 2026", 500, 0, 0, 500]
      );
      await db.run(
        `INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, id, "setor_pokok", 500, 0, 500, new Date().toISOString(), "transaction-test"]
      );
    })();

    const member = await db.query("SELECT id, totalSavings FROM members WHERE id = ?").get(id) as {
      id: string;
      totalSavings: number;
    } | null;
    expect(member).not.toBeNull();
    expect(Number(member!.totalSavings)).toBe(500);

    const txs = await db.query("SELECT id FROM transactions WHERE memberId = ?").all(id) as { id: string }[];
    expect(txs.length).toBe(1);
    expect(txs[0].id).toBe(txId);

    await db.run("DELETE FROM transactions WHERE memberId = ?", [id]);
    await db.run("DELETE FROM members WHERE id = ?", [id]);
  });

  test("nested transaction reuses outer transaction", async () => {
    const id = crypto.randomUUID();

    let threw = false;
    try {
      await db.transaction(async () => {
        await db.run(
          `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, `Nested Member ${id}`, "Anggota", "Aktif", "01 Jan 2026", 100, 0, 0, 100]
        );
        await db.transaction(async () => {
          await db.run(
            `INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              id,
              "setor_pokok",
              100,
              0,
              100,
              new Date().toISOString(),
              "transaction-test",
            ]
          );
        })();
        throw new Error("outer rollback");
      })();
    } catch (err) {
      threw = true;
      expect((err as Error).message).toBe("outer rollback");
    }

    expect(threw).toBe(true);
    expect(await db.query("SELECT id FROM members WHERE id = ?").get(id)).toBeNull();
    expect(await db.query("SELECT id FROM transactions WHERE memberId = ?").all(id)).toEqual([]);
  });
});

