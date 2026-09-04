import { expect, test, describe } from "bun:test";
import db from "../db";
import {
  createSavingsWithdrawalRequest,
  getMemberWithdrawals,
  getWithdrawalsList,
  approveSavingsWithdrawal,
  rejectSavingsWithdrawal,
} from "./savingsWithdrawalService";
import { ServiceError } from "./errors";

describe("savingsWithdrawalService", () => {
  test("submits, validates, approves and rejects voluntary savings withdrawals", async () => {
    const memberId = crypto.randomUUID();

    // 1. Setup test member with Sukarela balance = 500,000
    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, `Test Member Withdraw ${memberId}`, "Anggota", "Aktif", "01 Jan 2026", 500000, 200000, 500000, 1200000]
    );

    // 2. Reject withdrawal exceeding sukarela balance
    expect(
      createSavingsWithdrawalRequest(db, memberId, {
        amount: 600000,
        destinationBank: "Bank Mandiri",
        destinationAccount: "1234567890",
        destinationName: "Test Member",
      })
    ).rejects.toThrow(ServiceError);

    // 3. Successfully create request for 200,000
    const req1 = await createSavingsWithdrawalRequest(db, memberId, {
      amount: 200000,
      destinationBank: "Bank Mandiri",
      destinationAccount: "1234567890",
      destinationName: "Test Member",
      notes: "Kebutuhan mendesak",
    });

    expect(req1).toBeDefined();
    expect(Number(req1.amount)).toBe(200000);
    expect(req1.status).toBe("Menunggu");

    // 4. Disallow duplicate concurrent pending request
    expect(
      createSavingsWithdrawalRequest(db, memberId, {
        amount: 100000,
        destinationBank: "Bank Mandiri",
        destinationAccount: "1234567890",
        destinationName: "Test Member",
      })
    ).rejects.toThrow(ServiceError);

    // 5. Member history shows 1 pending request
    const memberHistory = await getMemberWithdrawals(db, memberId);
    expect(memberHistory.length).toBe(1);
    expect(memberHistory[0].status).toBe("Menunggu");

    // 6. Admin list shows the request
    const adminList = await getWithdrawalsList(db, { status: "Menunggu" });
    const found = adminList.data.find((r: any) => r.id === req1.id);
    expect(found).toBeDefined();

    // 7. Approve the request
    const approved = await approveSavingsWithdrawal(db, req1.id, "admin-tester");
    expect(approved.status).toBe("Disetujui");
    expect(approved.approvedBy).toBe("admin-tester");

    // 8. Verify member balance deducted
    const memberAfter = await db
      .query("SELECT simpananSukarela, totalSavings FROM members WHERE id = ?")
      .get<any>(memberId);
    expect(Number(memberAfter.simpananSukarela)).toBe(300000);
    expect(Number(memberAfter.totalSavings)).toBe(1000000);

    // 9. Verify ledger transaction recorded
    const tx = await db
      .query("SELECT type, amount, balanceBefore, balanceAfter FROM transactions WHERE memberId = ? ORDER BY createdAt DESC LIMIT 1")
      .get<any>(memberId);
    expect(tx.type).toBe("tarik_sukarela");
    expect(Number(tx.amount)).toBe(200000);
    expect(Number(tx.balanceBefore)).toBe(1200000);
    expect(Number(tx.balanceAfter)).toBe(1000000);

    // 10. Submit a second request and reject it
    const req2 = await createSavingsWithdrawalRequest(db, memberId, {
      amount: 150000,
      destinationBank: "Bank BCA",
      destinationAccount: "987654321",
      destinationName: "Test Member",
    });
    expect(req2.status).toBe("Menunggu");

    const rejected = await rejectSavingsWithdrawal(db, req2.id, "admin-tester", "Nomor rekening tidak sesuai data anggota");
    expect(rejected.status).toBe("Ditolak");
    expect(rejected.rejectionReason).toBe("Nomor rekening tidak sesuai data anggota");

    // Verify balance remains 300,000
    const memberFinal = await db
      .query("SELECT simpananSukarela, totalSavings FROM members WHERE id = ?")
      .get<any>(memberId);
    expect(Number(memberFinal.simpananSukarela)).toBe(300000);
    expect(Number(memberFinal.totalSavings)).toBe(1000000);

    // Cleanup
    await db.run("DELETE FROM savings_withdrawals WHERE member_id = ?", [memberId]);
    await db.run("DELETE FROM transactions WHERE memberId = ?", [memberId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });
});
