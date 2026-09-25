import { expect, test, describe, afterAll, beforeAll } from "bun:test";
import db from "../db";
import { getEwaRequestsList } from "./ewaService";

describe("getEwaRequestsList search filter", () => {
  let testEmployeeId: number | string;
  let testRequestId: number | string;
  const uniqueSuffix = Date.now().toString().slice(-6);
  const testName = `Karyawan Search Test ${uniqueSuffix}`;
  const testNip = `NIP-${uniqueSuffix}`;

  beforeAll(async () => {
    // Insert test employee
    const empRes = await db.query(
      `INSERT INTO employees (
        employer_id, name, email, nik, nip, department, position, base_salary,
        status, bank_name, bank_account_number, bank_account_holder
      ) VALUES (
        1, ?, ?, '1234567890123456', ?, 'IT', 'Tester', 5000000,
        'active', 'Bank Mandiri', '1234567890', ?
      ) RETURNING id`
    ).get<{ id: number | string }>(
      testName,
      `emp_${uniqueSuffix}@example.com`,
      testNip,
      testName
    );

    testEmployeeId = empRes!.id;

    // Insert test withdrawal request
    const reqRes = await db.query(
      `INSERT INTO withdrawal_requests (
        employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
        fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder
      ) VALUES (
        1, ?, 1000000, 'pending_transfer', '2026-09', '2026-09-01', '2026-09-30',
        25000, 2.5, 'Bank Mandiri', '1234567890', ?
      ) RETURNING id`
    ).get<{ id: number | string }>(testEmployeeId, testName);

    testRequestId = reqRes!.id;
  });

  afterAll(async () => {
    if (testRequestId) {
      await db.run(`DELETE FROM withdrawal_requests WHERE id = ?`, [testRequestId]);
    }
    if (testEmployeeId) {
      await db.run(`DELETE FROM employees WHERE id = ?`, [testEmployeeId]);
    }
  });

  test("filters requests by matching employee name", async () => {
    const res = await getEwaRequestsList(db, { search: testName });
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.some((r) => r.employeeName === testName)).toBe(true);
    expect(res.total).toBeGreaterThan(0);
  });

  test("filters requests by matching employee NIP", async () => {
    const res = await getEwaRequestsList(db, { search: testNip });
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.some((r) => r.employeeNip === testNip)).toBe(true);
  });

  test("returns empty list when search term does not match anything", async () => {
    const res = await getEwaRequestsList(db, { search: `NON_EXISTENT_NAME_${uniqueSuffix}` });
    expect(res.data.length).toBe(0);
    expect(res.total).toBe(0);
  });
});
