import { expect, test, describe } from "bun:test";
import db from "../db";
import {
  createSavingsDepositRequest,
  getMemberDeposits,
  getDepositsList,
  approveSavingsDeposit,
  rejectSavingsDeposit,
} from "./savingsDepositService";
import { ServiceError } from "./errors";

describe("savingsDepositService", () => {
  test("creates, lists, approves, and rejects deposit confirmations", async () => {
    const memberId = crypto.randomUUID();

    // 1. Setup member with Pokok=500000, Wajib=100000, Sukarela=0
    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, `Deposit Member ${memberId}`, "Anggota", "Aktif", "01 Jan 2026", 500000, 100000, 0, 600000]
    );

    const todayDateStr = new Date().toISOString().slice(0, 10);

    // 2. Simpanan pokok is already paid (500k), so submitting pokok deposit must throw
    expect(
      createSavingsDepositRequest(db, memberId, {
        savingsType: "pokok",
        amount: 100000,
        transferDate: todayDateStr,
      })
    ).rejects.toThrow(ServiceError);

    // 3. Submit Simpanan Wajib deposit of Rp 50.000 without proof (optional proof)
    const req1 = await createSavingsDepositRequest(db, memberId, {
      savingsType: "wajib",
      amount: 50000,
      transferDate: todayDateStr,
      senderBank: "Bank Mandiri",
      senderAccount: "987654321",
      senderName: "Budi Member",
    });

    expect(req1).toBeDefined();
    expect(req1.amount).toBe(50000);
    expect(req1.status).toBe("Menunggu");
    expect(req1.proofUrl).toBeNull();

    // 4. Submit Simpanan Sukarela deposit of Rp 250.000 with proof
    const req2 = await createSavingsDepositRequest(db, memberId, {
      savingsType: "sukarela",
      amount: 250000,
      transferDate: todayDateStr,
      senderBank: "BCA",
      senderAccount: "1122334455",
      senderName: "Budi Member",
      proofUrl: "/uploads/savings/receipt_123.jpg",
      proofName: "receipt_123.jpg",
      notes: "Setoran sukarela bulanan",
    });

    expect(req2.amount).toBe(250000);
    expect(req2.proofUrl).toBe("/uploads/savings/receipt_123.jpg");

    // 5. Member deposits list has 2 records
    const memberHistory = await getMemberDeposits(db, memberId);
    expect(memberHistory.length).toBe(2);

    // 6. Admin list has both
    const adminList = await getDepositsList(db, { memberId });
    expect(adminList.total).toBe(2);

    // 7. Approve req1 (Simpanan Wajib)
    const approved = await approveSavingsDeposit(db, req1.id, "admin-treasurer");
    expect(approved.status).toBe("Diverifikasi");
    expect(approved.verifiedBy).toBe("admin-treasurer");

    // Verify member balance after approval (Wajib: 100k + 50k = 150k, total: 650k)
    const memberAfter = await db
      .query("SELECT simpananWajib, simpananSukarela, totalSavings FROM members WHERE id = ?")
      .get<any>(memberId);
    expect(Number(memberAfter.simpananWajib)).toBe(150000);
    expect(Number(memberAfter.totalSavings)).toBe(650000);

    // 8. Reject req2 (Simpanan Sukarela)
    const rejected = await rejectSavingsDeposit(db, req2.id, "admin-treasurer", "Mutasi belum ditemukan pada rekening koran Bank Mandiri");
    expect(rejected.status).toBe("Ditolak");
    expect(rejected.rejectionReason).toBe("Mutasi belum ditemukan pada rekening koran Bank Mandiri");

    // Verify balance remains 650k
    const memberFinal = await db
      .query("SELECT simpananWajib, simpananSukarela, totalSavings FROM members WHERE id = ?")
      .get<any>(memberId);
    expect(Number(memberFinal.simpananWajib)).toBe(150000);
    expect(Number(memberFinal.simpananSukarela)).toBe(0);
    expect(Number(memberFinal.totalSavings)).toBe(650000);

    // Cleanup
    await db.run("DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE reference_id IN (SELECT id FROM transactions WHERE memberId = ?))", [memberId]);
    await db.run("DELETE FROM journal_entries WHERE reference_id IN (SELECT id FROM transactions WHERE memberId = ?)", [memberId]);
    await db.run("DELETE FROM savings_deposits WHERE member_id = ?", [memberId]);
    await db.run("DELETE FROM transactions WHERE memberId = ?", [memberId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });
});
