import db from './db'

export function getDashboardData() {
  const members = db.query("SELECT * FROM members").all() as any[]
  const loans = db.query("SELECT * FROM loans").all() as any[]

  // Distribusi Anggota (berdasarkan Role)
  const roleDistribution = members.reduce((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1
    return acc
  }, {})
  const roleData = Object.keys(roleDistribution).map((role, i) => ({
    label: role,
    value: roleDistribution[role],
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  // Distribusi Pinjaman (berdasarkan Purpose)
  const loanDistribution = loans.reduce((acc, l) => {
    acc[l.purpose] = (acc[l.purpose] || 0) + 1
    return acc
  }, {})
  const purposeData = Object.keys(loanDistribution).map((purpose, i) => ({
    label: purpose,
    value: loanDistribution[purpose],
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  // Tren Simpanan (Proxy dari joinDate bulan)
  // For simplicity, generate 12 months data based on joinDates
  const monthlyData = [
    { label: 'Jan', simpanan: 1000000, pinjaman: 500000 },
    { label: 'Feb', simpanan: 1500000, pinjaman: 700000 },
    { label: 'Mar', simpanan: 1200000, pinjaman: 600000 },
    { label: 'Apr', simpanan: 1800000, pinjaman: 900000 },
    { label: 'May', simpanan: 2000000, pinjaman: 1000000 },
    { label: 'Jun', simpanan: 2200000, pinjaman: 1100000 },
  ]
  
  // Update recent activities
  const recentMembers = members.slice(-5).map(m => ({
    id: m.id,
    activity: 'Anggota Baru',
    name: m.name,
    amount: m.totalSavings,
    date: m.joinDate,
  }))

  const recentLoans = loans.slice(-5).map(l => ({
    id: l.id,
    activity: 'Pengajuan Pinjaman',
    name: l.name,
    amount: l.amount,
    date: new Date().toISOString().split('T')[0],
  }))

  return {
    roleData,
    purposeData,
    monthlyData,
    recentActivities: [...recentMembers, ...recentLoans].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5)
  }
}
