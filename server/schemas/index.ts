import { z } from 'zod'
import xss from 'xss'

/** Wrap xss so Zod transform only receives the string value. */
const sanitize = (value: string) => xss(value)

export const memberSchema = z.object({
  name: z.string().min(1, "Name is required").transform(sanitize),
  role: z.enum(["Anggota", "Ketua", "Bendahara", "Sekretaris"]),
  status: z.enum(["Aktif", "Pasif"]),
  joinDate: z.string().min(1, "Join date is required").transform(sanitize),
  simpananPokok: z.number().nonnegative().default(0),
  simpananWajib: z.number().nonnegative().default(0),
  simpananSukarela: z.number().nonnegative().default(0),
  totalSavings: z.number().nonnegative().optional(),
})

// Strict transaction types for savings operations
export const SAVINGS_TRANSACTION_TYPES = [
  'setor_pokok',
  'setor_wajib',
  'setor_sukarela',
  'tarik_pokok',
  'tarik_wajib',
  'tarik_sukarela'
] as const;

export type SavingsTransactionType = typeof SAVINGS_TRANSACTION_TYPES[number];

export const savingsSchema = z.object({
  additionalSavings: z.union([
    z.number(),
    z.string().regex(/^-?\d+$/).transform(val => parseInt(val, 10))
  ]),
  savingsType: z.enum(["pokok", "wajib", "sukarela"]).default("sukarela"),
  /** Optional backdated transaction date (YYYY-MM-DD). Defaults to now when omitted. */
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional(),
})

// Schema for transaction type validation
export const transactionTypeSchema = z.enum(SAVINGS_TRANSACTION_TYPES);

export const loanSchema = z.object({
  memberId: z.string().min(1, "Member ID is required").transform(sanitize),
  name: z.string().min(1, "Name is required").transform(sanitize),
  amount: z.number().positive(),
  tenor: z.number().positive(),
  purpose: z.string().min(1, "Purpose is required").transform(sanitize),
  status: z.enum(["Menunggu", "Disetujui", "Ditolak", "Lunas"]).default("Menunggu"),
  /** Optional backdated loan date (YYYY-MM-DD). Defaults to now when omitted. */
  loanDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional(),
})

export const loanStatusSchema = z.object({
  status: z.enum(["Menunggu", "Disetujui", "Ditolak", "Lunas"]),
})

export const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1).transform(sanitize),
  /** Optional backdated payment date (YYYY-MM-DD). Defaults to now when omitted. */
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional(),
})

// Common passwords blocklist (top 100 most common)
const COMMON_PASSWORDS = [
  'password', '123456789', 'qwerty123', 'admin123', 'letmein1',
  'welcome', 'monkey', 'dragon', 'master', 'abc123',
  'password1', '12345678', '00000000', 'iloveyou', 'sunshine',
  'princess', 'football', 'shadow', 'superman', 'michael',
  'login', 'starwars', 'trustno1', 'mustang', 'access',
  'hello', 'charlie', 'donald', 'baseball', 'qwerty',
  'batman', 'test', 'pass', 'guest', 'changeme'
];

// Password complexity regex: min 12 chars, at least one uppercase, one lowercase, one digit
// Uses \S (non-whitespace) to allow all common special characters (!@#$%^&*()_+-=[]{}|;':",./<>?)
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S{12,}$/;

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
  'ssoAutoRegister'
];

export const settingsSchema = z.record(
  z.string().refine(key => ALLOWED_SETTINGS_KEYS.includes(key), { message: "Invalid setting key" }),
  z.union([z.string().transform(sanitize), z.boolean(), z.number()])
)

export const adminCreationSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string()
    .min(12, "Password minimal 12 karakter")
    .regex(STRONG_PASSWORD_REGEX, "Password harus mengandung huruf besar, huruf kecil, dan angka")
    .refine(password => !COMMON_PASSWORDS.includes(password.toLowerCase()), {
      message: "Password terlalu umum"
    })
    .optional()
    .or(z.literal("")) // Allow empty for Google SSO auto-register
  ,
  role: z.enum(["viewer", "admin", "superadmin"]),
  name: z.string().min(1, "Nama wajib diisi").transform(sanitize).optional(),
})

export const adminUpdateSchema = z.object({
  role: z.enum(["viewer", "admin", "superadmin"]),
})
