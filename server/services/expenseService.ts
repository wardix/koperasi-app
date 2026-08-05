import type { Db } from "../db";
import { resolveCalendarDateIso } from "../lib/dates";
import type { ExpenseCategory } from "../schemas";
import { ServiceError } from "./errors";
import { recordAutoJournal } from "./accountingService";

export type ExpenseInput = {
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: string;
};

export type ExpenseRow = {
  id: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export async function listExpenses(
  database: Db,
  page: number,
  limit: number
): Promise<{ rows: ExpenseRow[]; total: number }> {
  const offset = (page - 1) * limit;
  const rows = await database
    .query(
      `SELECT * FROM expenses
       WHERE deletedAt IS NULL
       ORDER BY expenseDate DESC, createdAt DESC
       LIMIT ? OFFSET ?`
    )
    .all<ExpenseRow>(limit, offset);

  const totalRes = await database
    .query(`SELECT COUNT(*) as count FROM expenses WHERE deletedAt IS NULL`)
    .get<{ count: number }>();

  return { rows, total: Number(totalRes?.count || 0) };
}

export async function createExpense(
  database: Db,
  input: ExpenseInput,
  createdBy: string
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const expenseDate = resolveCalendarDateIso(input.expenseDate);
  const now = new Date().toISOString();

  await database.run(
    `INSERT INTO expenses
      (id, expenseDate, category, description, amount, paymentMethod, createdBy, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      id,
      expenseDate,
      input.category,
      input.description,
      input.amount,
      input.paymentMethod,
      createdBy,
      now,
      now,
    ]
  );

  let expenseAccount = '5990'; // Beban Lain-lain
  if (input.category === 'gaji') expenseAccount = '5110';
  else if (input.category === 'utilitas') expenseAccount = '5120';
  else if (input.category === 'pajak' || input.category === 'notaris') expenseAccount = '5220';

  const cashAccount = input.paymentMethod === 'Cash' ? '1110' : '1120';

  try {
    await recordAutoJournal({
      transaction_date: expenseDate,
      description: `Pengeluaran: ${input.category} - ${input.description}`,
      reference_type: 'expense',
      reference_id: id,
      lines: [
        { account_code: expenseAccount, debit: input.amount },
        { account_code: cashAccount, credit: input.amount }
      ]
    });
  } catch (e) {
    console.error("Auto Journal failed for expense", e);
  }

  return { id };
}

export async function updateExpense(
  database: Db,
  id: string,
  input: Partial<ExpenseInput>
): Promise<{ before: ExpenseRow; after: ExpenseRow }> {
  const existing = await database
    .query(`SELECT * FROM expenses WHERE id = ? AND deletedAt IS NULL`)
    .get<ExpenseRow>(id);

  if (!existing) {
    throw new ServiceError("Pengeluaran tidak ditemukan", 404);
  }

  const expenseDate = input.expenseDate
    ? resolveCalendarDateIso(input.expenseDate)
    : existing.expenseDate;
  const category = input.category ?? existing.category;
  const description = input.description ?? existing.description;
  const amount = input.amount != null ? Number(input.amount) : Number(existing.amount);
  const paymentMethod = input.paymentMethod ?? existing.paymentMethod;
  const now = new Date().toISOString();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ServiceError("Nominal harus lebih dari 0", 400);
  }

  await database.run(
    `UPDATE expenses
     SET expenseDate = ?, category = ?, description = ?, amount = ?, paymentMethod = ?, updatedAt = ?
     WHERE id = ? AND deletedAt IS NULL`,
    [expenseDate, category, description, amount, paymentMethod, now, id]
  );

  const after = await database
    .query(`SELECT * FROM expenses WHERE id = ?`)
    .get<ExpenseRow>(id);

  if (!after) {
    throw new ServiceError("Pengeluaran tidak ditemukan", 404);
  }

  return { before: existing, after };
}

export async function deleteExpense(database: Db, id: string): Promise<{ before: ExpenseRow }> {
  const existing = await database
    .query(`SELECT * FROM expenses WHERE id = ? AND deletedAt IS NULL`)
    .get<ExpenseRow>(id);

  if (!existing) {
    throw new ServiceError("Pengeluaran tidak ditemukan", 404);
  }

  await database.run(`UPDATE expenses SET deletedAt = ?, updatedAt = ? WHERE id = ?`, [
    new Date().toISOString(),
    new Date().toISOString(),
    id,
  ]);

  return { before: existing };
}

export async function sumActiveExpenses(database: Db): Promise<number> {
  const row = await database
    .query(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE deletedAt IS NULL`)
    .get<{ total: number }>();
  return Number(row?.total || 0);
}
