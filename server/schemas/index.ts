import { z } from 'zod'
import xss from 'xss'

export const memberSchema = z.object({
  name: z.string().min(1, "Name is required").transform(xss),
  role: z.enum(["Anggota", "Ketua", "Bendahara", "Sekretaris"]),
  status: z.enum(["Aktif", "Pasif"]),
  joinDate: z.string().min(1, "Join date is required").transform(xss),
  simpananPokok: z.number().nonnegative().default(0),
  simpananWajib: z.number().nonnegative().default(0),
  simpananSukarela: z.number().nonnegative().default(0),
  totalSavings: z.number().nonnegative().optional(),
})

export const savingsSchema = z.object({
  additionalSavings: z.union([
    z.number(),
    z.string().regex(/^-?\d+$/).transform(val => parseInt(val, 10))
  ]),
  savingsType: z.enum(["pokok", "wajib", "sukarela"]).default("sukarela")
})

export const loanSchema = z.object({
  memberId: z.string().min(1, "Member ID is required").transform(xss),
  name: z.string().min(1, "Name is required").transform(xss),
  amount: z.number().positive(),
  tenor: z.string().min(1, "Tenor is required").transform(xss),
  purpose: z.string().min(1, "Purpose is required").transform(xss),
  status: z.enum(["Menunggu", "Disetujui", "Ditolak", "Lunas"]).default("Menunggu")
})

export const loanStatusSchema = z.object({
  status: z.enum(["Menunggu", "Disetujui", "Ditolak", "Lunas"]),
})

export const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1).transform(xss)
})

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
})

export const ALLOWED_SETTINGS_KEYS = [
  'koperasiName',
  'alamat',
  'telepon',
  'email',
  'bungaPinjaman',
  'bungaSimpanan',
  'denda',
  'viewReports',
  'selfRegister',
  'twoFactor'
];

export const settingsSchema = z.record(
  z.string().refine(key => ALLOWED_SETTINGS_KEYS.includes(key), { message: "Invalid setting key" }),
  z.union([z.string().transform(xss), z.boolean(), z.number()])
)
