import { expect, test, describe } from "bun:test";
import db from "../db";
import { createExpense, deleteExpense, listExpenses, updateExpense } from "./expenseService";

describe("expenseService", () => {
  test("create, list, update, and soft-delete expense", async () => {
    const { id } = await createExpense(
      db,
      {
        expenseDate: "2026-07-01",
        category: "notaris",
        description: "Jasa notaris akta",
        amount: 1500000,
        paymentMethod: "Transfer",
      },
      "expense-test"
    );

    const listed = await listExpenses(db, 1, 50);
    expect(listed.rows.some((r) => r.id === id)).toBe(true);

    const updated = await updateExpense(db, id, {
      amount: 1750000,
      description: "Jasa notaris + legalisasi",
    });
    expect(Number(updated.after.amount)).toBe(1750000);

    await deleteExpense(db, id);
    const afterDelete = await listExpenses(db, 1, 50);
    expect(afterDelete.rows.some((r) => r.id === id)).toBe(false);

    await db.run("DELETE FROM expenses WHERE id = ?", [id]);
  });
});
