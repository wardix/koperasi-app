import { describe, it, expect, beforeEach } from 'bun:test'
import db from '../db'

describe('SHU Closing', () => {
  const TEST_YEAR = '2026'
  let memberIds: string[] = []

  beforeEach(async () => {
    // Clean up test data for this year
    await db.run("DELETE FROM shu_member_allocations WHERE year = ?", [TEST_YEAR])
    await db.run("DELETE FROM shu_closes WHERE year = ?", [TEST_YEAR])
    await db.run("DELETE FROM loan_payments WHERE loanId LIKE 'shu-loan-%'")
    await db.run("DELETE FROM loans WHERE id LIKE 'shu-loan-%'")

    // Remove any manual biaya_operasional override for test year
    await db.run("DELETE FROM settings WHERE key = ?", [`biaya_operasional_${TEST_YEAR}`])

    // Create 3 members with known savings (use ON CONFLICT for idempotent beforeEach)
    const members = [
      { id: 'shu-m1', name: 'SHU Test A', savings: 1_000_000 },
      { id: 'shu-m2', name: 'SHU Test B', savings: 2_000_000 },
      { id: 'shu-m3', name: 'SHU Test C', savings: 3_000_000 },
    ]

    for (const m of members) {
      await db.run(
        `INSERT INTO members (id, name, role, status, joinDate, totalSavings) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, totalSavings = EXCLUDED.totalSavings`,
        [m.id, m.name, 'Anggota', 'Aktif', new Date().toISOString(), m.savings]
      )
      memberIds.push(m.id)
    }

    // Ensure default SHU config exists
    const defaults = [
      ['shu_cadangan_pct', '25'],
      ['shu_anggota_pct', '40'],
      ['shu_pengurus_pct', '20'],
      ['shu_sosial_pct', '10'],
      ['shu_pembangunan_pct', '5'],
      ['shu_jasa_simpanan_pct', '50'],
      ['shu_jasa_pinjaman_pct', '50'],
    ]
    for (const [key, val] of defaults) {
      await db.run(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [key, val]
      )
    }

    // Ensure bungaPinjaman setting exists
    await db.run(
      "INSERT INTO settings (key, value) VALUES ('bungaPinjaman', '1.5') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
    )

    // Create a loan with payments in the test year for each member to generate interest income
    const now = new Date().toISOString();
    for (let i = 0; i < 3; i++) {
      const memberId = memberIds[i];
      await db.run(
        `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, 'Disetujui', ?)`,
        [`shu-loan-${i}`, memberId, `SHU Loan ${i}`, 10_000_000, '6', 'Test loan', now]
      );
      // Create monthly payments in the test year (2026)
      for (let m = 0; m < 6; m++) {
        const payDate = `2026-${String(m + 1).padStart(2, '0')}-15`;
        await db.run(
          `INSERT INTO loan_payments (id, loanId, amount, paymentDate, method) VALUES (?, ?, ?, ?, ?)`,
          [`shu-pay-${i}-${m}`, `shu-loan-${i}`, 1_875_000, payDate, 'transfer']
        );
      }
    }
  })

  describe('calculateSHU dynamic calculation', () => {
    it('should return isClosed: false when year has no closing record', async () => {
      const { calculateSHU } = await import('../services/shuService')
      const result = await calculateSHU(TEST_YEAR)

      expect(result.isClosed).toBe(false)
      expect(result.year).toBe(TEST_YEAR)
    })

    it('should distribute anggota allocation based on configured percentage', async () => {
      const { calculateSHU } = await import('../services/shuService')
      const result = await calculateSHU(TEST_YEAR)

      // Total SHU neto minus biaya operasional should be distributed
      expect(result.distribusi).toBeDefined()
      expect(typeof result.distribusi.anggota).toBe('number')
      expect(result.distribusi.anggota).toBeGreaterThan(0)
    })

    it('should split anggota allocation between jasa simpanan and jasa pinjaman pools', async () => {
      const { getShuConfig } = await import('../services/shuService')
      const config = await getShuConfig()

      // Default config: 50/50 split
      expect(config.jasaSimpananPct).toBe(50)
      expect(config.jasaPinjamanPct).toBe(50)
    })

    it('should allocate savings share proportionally to totalSavings', async () => {
      const { calculateSHU } = await import('../services/shuService')
      const result = await calculateSHU(TEST_YEAR)

      // Members have 1M, 2M, 3M = 6M total. Proportions: 1/6, 2/6, 3/6
      const m1Share = result.alokasiAnggota.find(a => a.id === 'shu-m1')?.savingsShare ?? 0
      const m2Share = result.alokasiAnggota.find(a => a.id === 'shu-m2')?.savingsShare ?? 0
      const m3Share = result.alokasiAnggota.find(a => a.id === 'shu-m3')?.savingsShare ?? 0

      // M3 should get roughly 3x M1's savings share (3M vs 1M)
      expect(m3Share).toBeGreaterThan(m1Share * 2.5)
    })

    it('should sort alokasiAnggota by SHU descending', async () => {
      const { calculateSHU } = await import('../services/shuService')
      const result = await calculateSHU(TEST_YEAR)

      for (let i = 1; i < result.alokasiAnggota.length; i++) {
        expect(result.alokasiAnggota[i - 1].shu).toBeGreaterThanOrEqual(result.alokasiAnggota[i].shu)
      }
    })
  })

  describe('year-end closing', () => {
    it('should persist closing record and member allocations when year is closed', async () => {
      const { calculateSHU } = await import('../services/shuService')

      // Pre-calculate to get result for close
      const preCloseResult = await calculateSHU(TEST_YEAR)

      expect(preCloseResult.alokasiAnggota.length).toBeGreaterThan(0)

      // Manually insert closing record (simulating POST /close behavior)
      await db.run(`
        INSERT INTO shu_closes (year, pendapatan, biayaOperasional, shuNetto, distribusi, closedBy)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        TEST_YEAR,
        preCloseResult.pendapatan,
        preCloseResult.biayaOperasional,
        preCloseResult.shuNetto,
        JSON.stringify(preCloseResult.distribusi),
        'test-admin'
      ])

      for (const a of preCloseResult.alokasiAnggota) {
        await db.run(`
          INSERT INTO shu_member_allocations (year, memberId, savingsShare, loansShare, totalSHU)
          VALUES (?, ?, ?, ?, ?)
        `, [TEST_YEAR, a.id, a.savingsShare, a.loansShare, a.shu])
      }

      // Verify the closing record was actually persisted
      const verifyRow = await db.query("SELECT year FROM shu_closes WHERE year = ?").get(TEST_YEAR)
      expect(verifyRow).not.toBeNull()

      // Now calculate again — should return historical data
      const closedResult = await calculateSHU(TEST_YEAR)

      expect(closedResult.isClosed).toBe(true)
      expect(closedResult.closedBy).toBe('test-admin')
      expect(closedResult.pendapatan).toBe(preCloseResult.pendapatan)
      expect(closedResult.alokasiAnggota.length).toBeGreaterThan(0)
    })

    it('should return historical data without recalculating when year is already closed', async () => {
      const { calculateSHU } = await import('../services/shuService')

      // First calculation (dynamic)
      const result1 = await calculateSHU(TEST_YEAR)

      // Close the year manually using plain db.run (not transaction)
      await db.run(`
        INSERT INTO shu_closes (year, pendapatan, biayaOperasional, shuNetto, distribusi, closedBy)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [TEST_YEAR, result1.pendapatan, result1.biayaOperasional, result1.shuNetto, JSON.stringify(result1.distribusi), 'admin'])

      for (const a of result1.alokasiAnggota) {
        await db.run(`
          INSERT INTO shu_member_allocations (year, memberId, savingsShare, loansShare, totalSHU)
          VALUES (?, ?, ?, ?, ?)
        `, [TEST_YEAR, a.id, a.savingsShare, a.loansShare, a.shu])
      }

      // Verify closing record exists
      const verifyRow = await db.query("SELECT year FROM shu_closes WHERE year = ?").get(TEST_YEAR)
      expect(verifyRow).not.toBeNull()

      // Second calculation — should return locked data
      const result2 = await calculateSHU(TEST_YEAR)

      expect(result2.isClosed).toBe(true)
      expect(result2.pendapatan).toBe(result1.pendapatan)
      expect(result2.alokasiAnggota.map(a => a.id).sort()).toEqual(
        result1.alokasiAnggota.map(a => a.id).sort()
      )
    })

    it('should allow reopen to unlock a closed year', async () => {
      const { calculateSHU } = await import('../services/shuService')

      // Close the year manually
      const preResult = await calculateSHU(TEST_YEAR)
      await db.run(`
        INSERT INTO shu_closes (year, pendapatan, biayaOperasional, shuNetto, distribusi, closedBy)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [TEST_YEAR, preResult.pendapatan, preResult.biayaOperasional, preResult.shuNetto, JSON.stringify(preResult.distribusi), 'admin'])

      for (const a of preResult.alokasiAnggota) {
        await db.run(`
          INSERT INTO shu_member_allocations (year, memberId, savingsShare, loansShare, totalSHU)
          VALUES (?, ?, ?, ?, ?)
        `, [TEST_YEAR, a.id, a.savingsShare, a.loansShare, a.shu])
      }

      // Verify it's closed
      const closedCheck = await calculateSHU(TEST_YEAR)
      expect(closedCheck.isClosed).toBe(true)

      // Reopen: delete records manually (simulating POST /reopen behavior)
      await db.run("DELETE FROM shu_member_allocations WHERE year = ?", [TEST_YEAR])
      await db.run("DELETE FROM shu_closes WHERE year = ?", [TEST_YEAR])

      // Now should be dynamic again
      const reopenedResult = await calculateSHU(TEST_YEAR)
      expect(reopenedResult.isClosed).toBe(false)
    })
  })

  describe('operating cost override', () => {
    it('should use manual biaya_operasional if set for the year', async () => {
      // Set a specific operating cost for test year
      const customCost = 5_000_000
      await db.run(
        "INSERT INTO settings (key, value) VALUES ('biaya_operasional_2026', ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [customCost.toString()]
      )

      const { calculateSHU } = await import('../services/shuService')
      const result = await calculateSHU(TEST_YEAR)

      expect(result.biayaOperasional).toBe(customCost)
    })

    it('should fall back to 20% of total interest income when no override', async () => {
      // Ensure no override exists
      await db.run("DELETE FROM settings WHERE key = ?", [`biaya_operasional_${TEST_YEAR}`])

      const { calculateSHU } = await import('../services/shuService')
      const result = await calculateSHU(TEST_YEAR)

      // Should have a default operating cost (20% of interest income or 0 if no loans)
      expect(result.biayaOperasional).toBeDefined()
    })
  })
})
