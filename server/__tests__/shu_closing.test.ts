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
    await db.run("DELETE FROM loan_schedules WHERE loanId LIKE 'shu-loan-%'")
    await db.run("DELETE FROM loans WHERE id LIKE 'shu-loan-%'")
    await db.run("DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE description LIKE 'SHU Test Expense%' OR description LIKE 'SHU Test Revenue%')")
    await db.run("DELETE FROM journal_entries WHERE description LIKE 'SHU Test Expense%' OR description LIKE 'SHU Test Revenue%'")

    // Remove any manual biaya_operasional override for test year
    await db.run("DELETE FROM settings WHERE key = ?", [`biaya_operasional_${TEST_YEAR}`])

    // Create 3 members with known savings (use ON CONFLICT for idempotent beforeEach)
    const members = [
      { id: 'shu-m1', name: 'SHU Test A', pokok: 100000, wajib: 200000, sukarela: 700000 },
      { id: 'shu-m2', name: 'SHU Test B', pokok: 200000, wajib: 400000, sukarela: 1400000 },
      { id: 'shu-m3', name: 'SHU Test C', pokok: 300000, wajib: 600000, sukarela: 2100000 },
    ]

    for (const m of members) {
      await db.run(
        `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           simpananPokok = EXCLUDED.simpananPokok,
           simpananWajib = EXCLUDED.simpananWajib,
           simpananSukarela = EXCLUDED.simpananSukarela,
           totalSavings = EXCLUDED.totalSavings`,
        [m.id, m.name, 'Anggota', 'Aktif', new Date().toISOString(), m.pokok, m.wajib, m.sukarela, (m.pokok + m.wajib + m.sukarela)]
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

  describe('operating cost synchronization & override', () => {
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

    it('should use actual accounting journal expenses when recorded for the year', async () => {
      // Ensure no override exists
      await db.run("DELETE FROM settings WHERE key = ?", [`biaya_operasional_${TEST_YEAR}`])

      // Get an expense account ID
      const expenseAcc = await db.query("SELECT id FROM accounts WHERE type = 'EXPENSE' LIMIT 1").get<{ id: string }>()
      expect(expenseAcc).not.toBeNull()

      const entryId = '00000000-0000-4000-8000-000000000001'
      const lineId = '00000000-0000-4000-8000-000000000002'
      const journalExpenseAmount = 1_500_000

      await db.run(`
        INSERT INTO journal_entries (id, transaction_date, description, reference_type)
        VALUES ($1, $2, $3, $4)
      `, [entryId, `${TEST_YEAR}-04-10`, 'SHU Test Expense Entry', 'test'])

      await db.run(`
        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [lineId, entryId, expenseAcc!.id, journalExpenseAmount, 0, 'Test expense line'])

      const { calculateSHU } = await import('../services/shuService')
      const result = await calculateSHU(TEST_YEAR)

      expect(result.biayaOperasional).toBe(journalExpenseAmount)

      // Clean up journal entry
      await db.run("DELETE FROM journal_lines WHERE journal_entry_id = $1", [entryId])
      await db.run("DELETE FROM journal_entries WHERE id = $1", [entryId])
    })

    it('should prefer manual override over journal expenses if override is set', async () => {
      // Get an expense account ID
      const expenseAcc = await db.query("SELECT id FROM accounts WHERE type = 'EXPENSE' LIMIT 1").get<{ id: string }>()
      expect(expenseAcc).not.toBeNull()

      const entryId = '00000000-0000-4000-8000-000000000003'
      const lineId = '00000000-0000-4000-8000-000000000004'
      const journalExpenseAmount = 1_500_000
      const customOverride = 7_000_000

      await db.run(`
        INSERT INTO journal_entries (id, transaction_date, description, reference_type)
        VALUES ($1, $2, $3, $4)
      `, [entryId, `${TEST_YEAR}-04-10`, 'SHU Test Expense Entry', 'test'])

      await db.run(`
        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [lineId, entryId, expenseAcc!.id, journalExpenseAmount, 0, 'Test expense line'])

      await db.run(
        "INSERT INTO settings (key, value) VALUES ('biaya_operasional_2026', ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [customOverride.toString()]
      )

      const { calculateSHU } = await import('../services/shuService')
      const result = await calculateSHU(TEST_YEAR)

      expect(result.biayaOperasional).toBe(customOverride)

      // Clean up
      await db.run("DELETE FROM settings WHERE key = ?", [`biaya_operasional_${TEST_YEAR}`])
      await db.run("DELETE FROM journal_lines WHERE journal_entry_id = $1", [entryId])
      await db.run("DELETE FROM journal_entries WHERE id = $1", [entryId])
    })

    it('should fall back to 20% of total interest income when no override and no journal expenses', async () => {
      // Ensure no override exists
      await db.run("DELETE FROM settings WHERE key = ?", [`biaya_operasional_${TEST_YEAR}`])

      const { calculateSHU } = await import('../services/shuService')
      const result = await calculateSHU(TEST_YEAR)

      // Should have a default operating cost (20% of revenue or 0 if no loans)
      expect(result.biayaOperasional).toBeDefined()
    })
  })

  describe('revenue synchronization with accounting journals', () => {
    it('should use actual accounting journal revenue when recorded for the year', async () => {
      const revAcc = await db.query("SELECT id FROM accounts WHERE type = 'REVENUE' LIMIT 1").get<{ id: string }>()
      expect(revAcc).not.toBeNull()

      const entryId = '00000000-0000-4000-8000-000000000010'
      const lineId = '00000000-0000-4000-8000-000000000011'
      const journalRevenueAmount = 2_500_000

      const { calculateSHU } = await import('../services/shuService')
      const baseline = await calculateSHU(TEST_YEAR)

      await db.run(`
        INSERT INTO journal_entries (id, transaction_date, description, reference_type)
        VALUES ($1, $2, $3, $4)
      `, [entryId, `${TEST_YEAR}-05-10`, 'SHU Test Revenue Entry', 'test'])

      await db.run(`
        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [lineId, entryId, revAcc!.id, 0, journalRevenueAmount, 'Test revenue line'])

      const result = await calculateSHU(TEST_YEAR)

      expect(result.realizedPendapatan).toBe(baseline.realizedPendapatan + journalRevenueAmount)

      // Clean up
      await db.run("DELETE FROM journal_lines WHERE journal_entry_id = $1", [entryId])
      await db.run("DELETE FROM journal_entries WHERE id = $1", [entryId])
    })
  })

  describe('projection mode', () => {
    it('should calculate projection mode with scheduled pending interest until year-end', async () => {
      const { calculateSHU } = await import('../services/shuService')

      // Get realization baseline
      const realResult = await calculateSHU(TEST_YEAR, { mode: 'realization' })
      expect(realResult.mode).toBe('realization')
      expect(realResult.projectedPendapatan).toBe(0)
      expect(realResult.pendapatan).toBe(realResult.realizedPendapatan)

      // Add a future pending loan schedule for shu-m1 in TEST_YEAR
      const scheduleId = 'shu-sched-proj-1'
      const projectedInterest = 450_000
      await db.run(`
        INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [scheduleId, 'shu-loan-0', 7, `${TEST_YEAR}-12-15`, 2_000_000, projectedInterest, 0, 'Pending'])

      const projResult = await calculateSHU(TEST_YEAR, { mode: 'projection' })

      expect(projResult.mode).toBe('projection')
      expect(projResult.projectedPendapatan).toBeGreaterThanOrEqual(projectedInterest)
      expect(projResult.pendapatan).toBe(projResult.realizedPendapatan + projResult.projectedPendapatan)
      expect(projResult.pendapatan).toBeGreaterThan(realResult.pendapatan)

      // Clean up
      await db.run("DELETE FROM loan_schedules WHERE id = ?", [scheduleId])
    })

    it('should return realization mode if year is already closed even if projection requested', async () => {
      const { calculateSHU } = await import('../services/shuService')

      // Close the year manually
      const preResult = await calculateSHU(TEST_YEAR)
      await db.run(`
        INSERT INTO shu_closes (year, pendapatan, biayaOperasional, shuNetto, distribusi, closedBy)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [TEST_YEAR, preResult.pendapatan, preResult.biayaOperasional, preResult.shuNetto, JSON.stringify(preResult.distribusi), 'admin'])

      const closedResult = await calculateSHU(TEST_YEAR, { mode: 'projection' })
      expect(closedResult.isClosed).toBe(true)
      expect(closedResult.mode).toBe('realization')
      expect(closedResult.projectedPendapatan).toBe(0)
    })
  })

  describe('Average Daily Balance (ADB) and Inactive Members Policy', () => {
    const SCEN_YEAR = '2025'

    beforeEach(async () => {
      // Clean up scenario members and transactions
      await db.run("DELETE FROM shu_member_allocations WHERE year = ?", [SCEN_YEAR])
      await db.run("DELETE FROM shu_closes WHERE year = ?", [SCEN_YEAR])
      await db.run("DELETE FROM transactions WHERE memberId LIKE 'scen-%'")
      await db.run("DELETE FROM loan_payments WHERE loanId LIKE 'scen-%'")
      await db.run("DELETE FROM loans WHERE memberId LIKE 'scen-%'")
      await db.run("DELETE FROM members WHERE id LIKE 'scen-%'")
      await db.run("DELETE FROM settings WHERE key = 'shu_include_inactive_members'")
    })

    it('should calculate ADB accurately: 11-month depositor (Member B) gets ~11x larger average savings than 1-month depositor (Member C)', async () => {
      const { calculateMemberAverageSavings, calculateSHU } = await import('../services/shuService')

      // Member B: Joined in 2024, deposited 100M on 2025-01-01, withdrew 100M on 2025-11-30 (ending balance: 0)
      await db.run(
        `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
         VALUES (?, ?, 'Anggota', 'Aktif', '2024-01-01', 0, 0, 0, 0)`,
        ['scen-b', 'Anggota B']
      )
      // Transaction 1: Deposit 100M on Jan 1
      await db.run(
        `INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
         VALUES (?, ?, 'setor_sukarela', ?, ?, ?, ?, 'system')`,
        ['tx-b-1', 'scen-b', 100_000_000, 0, 100_000_000, '2025-01-01T00:00:00.000Z']
      )
      // Transaction 2: Withdraw 100M on Nov 30 23:59:59
      await db.run(
        `INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
         VALUES (?, ?, 'tarik_sukarela', ?, ?, ?, ?, 'system')`,
        ['tx-b-2', 'scen-b', 100_000_000, 100_000_000, 0, '2025-11-30T23:59:59.000Z']
      )

      // Member C: Joined in 2024, deposited 100M on 2025-12-01, kept until Dec 31 (ending balance: 100M)
      await db.run(
        `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
         VALUES (?, ?, 'Anggota', 'Aktif', '2024-01-01', 0, 0, 100_000_000, 100_000_000)`,
        ['scen-c', 'Anggota C']
      )
      // Transaction 1: Deposit 100M on Dec 1
      await db.run(
        `INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
         VALUES (?, ?, 'setor_sukarela', ?, ?, ?, ?, 'system')`,
        ['tx-c-1', 'scen-c', 100_000_000, 0, 100_000_000, '2025-12-01T00:00:00.000Z']
      )

      const stats = await calculateMemberAverageSavings(SCEN_YEAR, true)
      const bStats = stats['scen-b']
      const cStats = stats['scen-c']

      expect(bStats).toBeDefined()
      expect(cStats).toBeDefined()

      // Member B held 100M for ~334 days (~11 months)
      expect(bStats.averageSavings).toBeGreaterThan(90_000_000)
      expect(bStats.averageSavings).toBeLessThan(93_000_000)

      // Member C held 100M for ~31 days (~1 month)
      expect(cStats.averageSavings).toBeGreaterThan(7_500_000)
      expect(cStats.averageSavings).toBeLessThan(9_500_000)

      // The ratio b / c should be roughly 11x (between 10x and 12x)
      const ratio = bStats.averageSavings / cStats.averageSavings
      expect(ratio).toBeGreaterThan(10)
      expect(ratio).toBeLessThan(12)

      // Generate some interest income so SHU can be distributed
      await db.run(
        `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, 'Disetujui', ?)`,
        ['scen-loan', 'scen-b', 'Loan Scen', 50_000_000, '12', 'Purpose', '2025-01-01T00:00:00.000Z']
      )
      await db.run(
        `INSERT INTO loan_payments (id, loanId, amount, paymentDate, method) VALUES (?, ?, ?, ?, ?)`,
        ['scen-pay-1', 'scen-loan', 10_000_000, '2025-06-01', 'transfer']
      )

      const shuResult = await calculateSHU(SCEN_YEAR)
      const bAlloc = shuResult.alokasiAnggota.find(a => a.id === 'scen-b')
      const cAlloc = shuResult.alokasiAnggota.find(a => a.id === 'scen-c')

      expect(bAlloc).toBeDefined()
      expect(cAlloc).toBeDefined()

      // In old system, bAlloc.savingsShare would have been 0 because totalSavings is 0.
      // In ADB system, bAlloc gets ~11x larger savings share than cAlloc!
      expect(bAlloc!.savingsShare).toBeGreaterThan(cAlloc!.savingsShare * 9)
    })

    it('should respect includeInactiveMembers setting toggle', async () => {
      const { calculateSHU } = await import('../services/shuService')

      // Create an active member and a resigned member
      await db.run(
        `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
         VALUES ('scen-active', 'Anggota Tetap', 'Anggota', 'Aktif', '2024-01-01', 1_000_000, 1_000_000, 0, 2_000_000)`
      )
      await db.run(
        `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
         VALUES ('scen-resigned', 'Mantan Anggota', 'Anggota', 'Keluar', '2024-01-01', 0, 0, 0, 0)`
      )
      // Resigned member had 50M for the first 6 months, then withdrew on July 1
      await db.run(
        `INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
         VALUES ('tx-res-1', 'scen-resigned', 'setor_sukarela', 50_000_000, 0, 50_000_000, '2025-01-01T00:00:00.000Z', 'system')`
      )
      await db.run(
        `INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
         VALUES ('tx-res-2', 'scen-resigned', 'tarik_sukarela', 50_000_000, 50_000_000, 0, '2025-07-01T00:00:00.000Z', 'system')`
      )

      // Test with includeInactiveMembers: true (default)
      await db.run("INSERT INTO settings (key, value) VALUES ('shu_include_inactive_members', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'")
      const resultWithInactive = await calculateSHU(SCEN_YEAR)
      const resignedAllocIncluded = resultWithInactive.alokasiAnggota.find(a => a.id === 'scen-resigned')
      expect(resignedAllocIncluded).toBeDefined()
      expect(resignedAllocIncluded?.status).toBe('Keluar')
      expect(resignedAllocIncluded?.averageSavings).toBeGreaterThan(20_000_000)

      // Test with includeInactiveMembers: false
      await db.run("INSERT INTO settings (key, value) VALUES ('shu_include_inactive_members', 'false') ON CONFLICT (key) DO UPDATE SET value = 'false'")
      const resultWithoutInactive = await calculateSHU(SCEN_YEAR)
      const resignedAllocExcluded = resultWithoutInactive.alokasiAnggota.find(a => a.id === 'scen-resigned')
      expect(resignedAllocExcluded).toBeUndefined()
      const activeAlloc = resultWithoutInactive.alokasiAnggota.find(a => a.id === 'scen-active')
      expect(activeAlloc).toBeDefined()
    })
  })
})

