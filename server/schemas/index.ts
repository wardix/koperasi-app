import { z } from 'zod'
import xss from 'xss'

/** Wrap xss so Zod transform only receives the string value. */
const sanitize = (value: string) => xss(value)

/** Optional NIK: empty → null; otherwise exactly 16 digits. */
const nikField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const digits = String(v).replace(/\D/g, "");
    return digits.length === 0 ? null : digits;
  })
  .refine((v) => v === null || /^\d{16}$/.test(v), {
    message: "NIK harus 16 digit angka",
  });

/**
 * Optional phone: empty → null.
 * Allows leading +, spaces/dashes stripped; keeps digits (and single leading +).
 * Length: 8–15 digits (common mobile range, incl. country code without +).
 */
const phoneField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    let s = String(v).trim();
    if (!s) return null;
    const hasPlus = s.startsWith("+");
    const digits = s.replace(/\D/g, "");
    if (!digits) return null;
    return hasPlus ? `+${digits}` : digits;
  })
  .refine((v) => {
    if (v === null) return true;
    const digits = v.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15;
  }, {
    message: "Nomor telepon harus 8–15 digit (boleh diawali +)",
  });

const defaultSimpananPokokEnv = process.env.DEFAULT_SIMPANAN_POKOK || process.env.VITE_DEFAULT_SIMPANAN_POKOK;
const defaultSimpananPokok = defaultSimpananPokokEnv ? Number(defaultSimpananPokokEnv) : 0;

export const memberSchema = z.object({
  name: z.string().min(1, "Name is required").transform(sanitize),
  role: z.enum(["Anggota", "Ketua", "Bendahara", "Sekretaris"]),
  status: z.enum(["Aktif", "Pasif"]),
  joinDate: z.string().min(1, "Join date is required").transform(sanitize),
  nik: nikField.optional().default(null),
  phone: phoneField.optional().default(null),
  simpananPokok: z.number().nonnegative().default(Number.isFinite(defaultSimpananPokok) ? defaultSimpananPokok : 0),
  simpananWajib: z.number().nonnegative().default(0),
  simpananSukarela: z.number().nonnegative().default(0),
  totalSavings: z.number().nonnegative().optional(),
})

/**
 * Create member: base fields + optional portal credentials.
 * - email alone → can use Google SSO later
 * - email + password → full portal login
 * - password without email → rejected
 */
export const memberCreateSchema = memberSchema
  .extend({
    email: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null) return null;
        const t = String(v).trim().toLowerCase();
        return t.length === 0 ? null : t;
      })
      .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
        message: "Format email tidak valid",
      })
      .optional()
      .default(null),
    password: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null) return null;
        const t = String(v);
        return t.length === 0 ? null : t;
      })
      .refine((v) => v === null || v.length >= 8, {
        message: "Password minimal 8 karakter",
      })
      .optional()
      .default(null),
  })
  .refine((v) => !(v.password && !v.email), {
    message: "Email portal wajib diisi jika password diisi",
    path: ["email"],
  });

/** Admin sets portal login for a member (email + optional new password). */
export const memberPortalAccessSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Format email tidak valid")
      .optional()
      .or(z.literal("")),
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .optional()
      .or(z.literal("")),
  })
  .refine((v) => !!(v.email && v.email.length > 0) || !!(v.password && v.password.length > 0), {
    message: "Isi email dan/atau password portal",
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

export const batchSavingsImportItemSchema = z.object({
  memberId: z.string().optional(),
  nik: z.string().optional(),
  savingsType: z.enum(["pokok", "wajib", "sukarela"]).default("pokok"),
  amount: z.number().positive("Nominal setoran harus lebih dari 0"),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional(),
}).refine((v) => !!v.memberId || !!v.nik, {
  message: "memberId atau nik wajib diisi",
});

export const batchSavingsImportSchema = z.object({
  items: z.array(batchSavingsImportItemSchema).min(1, "Minimal 1 data simpanan untuk diimport"),
});

// Schema for transaction type validation
export const transactionTypeSchema = z.enum(SAVINGS_TRANSACTION_TYPES);

/** Operating expense categories for cooperative cash outflows */
export const EXPENSE_CATEGORIES = [
  'notaris',
  'atk',
  'sewa',
  'utilitas',
  'gaji',
  'transport',
  'pajak',
  'lainnya',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenseSchema = z.object({
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().min(1, "Keterangan wajib diisi").max(500).transform(sanitize),
  amount: z.number().int().positive("Nominal harus lebih dari 0"),
  paymentMethod: z.enum(["Transfer", "Cash", "Debit"]).default("Transfer"),
})

export const expenseUpdateSchema = z
  .object({
    expenseDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
      .optional(),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    description: z.string().min(1).max(500).transform(sanitize).optional(),
    amount: z.number().int().positive().optional(),
    paymentMethod: z.enum(["Transfer", "Cash", "Debit"]).optional(),
  })
  .refine(
    (v) =>
      v.expenseDate != null ||
      v.category != null ||
      v.description != null ||
      v.amount != null ||
      v.paymentMethod != null,
    { message: "Minimal satu field harus diisi" }
  )

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
  /**
   * Optional disbursement / approval calendar date (YYYY-MM-DD).
   * When approving historical loans, set this so cashflow pencairan uses the past date
   * instead of the moment the approve button is clicked.
   */
  approvedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional(),
  /**
   * Optional per-loan admin fee / interest rate (% p.a.) used to build installment schedule.
   * When omitted on approve, falls back to settings.bungaPinjaman.
   */
  interestRate: z.number().min(0).max(100).optional(),
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

export const paymentUpdateSchema = z
  .object({
    amount: z.number().positive().optional(),
    method: z.string().min(1).transform(sanitize).optional(),
    paymentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
      .optional(),
  })
  .refine((v) => v.amount != null || v.method != null || v.paymentDate != null, {
    message: "Minimal satu field harus diisi (amount, method, atau paymentDate)",
  })

export const loanDisbursementDateSchema = z.object({
  disbursementDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
})

/** Regenerate installment schedule with optional new admin-fee rate (% p.a.). */
export const loanScheduleRegenerateSchema = z.object({
  interestRate: z.number().min(0).max(100),
})

/** Replace full installment schedule (manual edit). */
export const loanScheduleReplaceSchema = z.object({
  rows: z
    .array(
      z.object({
        installmentNo: z.number().int().positive(),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
        principalAmount: z.number().int().nonnegative(),
        interestAmount: z.number().int().nonnegative(),
      })
    )
    .min(1, "Minimal satu baris jadwal"),
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

// ---------------------------------------------------------------------------
// Batch Member Import (CSV)
// ---------------------------------------------------------------------------

export const batchMemberImportItemSchema = z.object({
  nik: z.string().optional().nullable(),
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Format email tidak valid").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  joinDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional()
    .nullable(),
  simpananPokok: z.number().min(0).default(0),
  simpananWajib: z.number().min(0).default(0),
  simpananSukarela: z.number().min(0).default(0),
});

export const batchMemberImportSchema = z.object({
  items: z
    .array(batchMemberImportItemSchema)
    .min(1, "Minimal 1 data anggota untuk diimport"),
});

export type BatchMemberImportItem = z.infer<typeof batchMemberImportItemSchema>;

// ---------------------------------------------------------------------------
// Batch Loan Import (CSV)
// ---------------------------------------------------------------------------

export const batchLoanImportItemSchema = z.object({
  nik: z.string().min(1, "NIK wajib diisi"),
  nama_pinjaman: z.string().min(1, "Nama pinjaman wajib diisi"),
  jumlah: z.number().positive("Jumlah pinjaman harus lebih dari 0"),
  tenor: z.number().int().positive("Tenor harus lebih dari 0 bulan"),
  tujuan: z.string().min(1, "Tujuan pinjaman wajib diisi"),
  tanggal_pinjaman: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional()
    .nullable(),
  bunga: z.number().min(0).optional().nullable(),
});

export const batchLoanImportSchema = z.object({
  items: z
    .array(batchLoanImportItemSchema)
    .min(1, "Minimal 1 data pinjaman untuk diimport"),
});

export type BatchLoanImportItem = z.infer<typeof batchLoanImportItemSchema>;

// ---------------------------------------------------------------------------
// Batch Payment Import / Angsuran (CSV)
// ---------------------------------------------------------------------------

export const batchPaymentImportItemSchema = z.object({
  nik: z.string().min(1, "NIK wajib diisi"),
  loan_id: z.string().optional().nullable(), // Explicit if member has multiple active loans
  jumlah: z.number().positive("Jumlah angsuran harus lebih dari 0"),
  metode: z.enum(["Transfer", "Cash", "Debit"]).default("Transfer"),
  tanggal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional()
    .nullable(),
});

export const batchPaymentImportSchema = z.object({
  items: z
    .array(batchPaymentImportItemSchema)
    .min(1, "Minimal 1 data angsuran untuk diimport"),
});

export type BatchPaymentImportItem = z.infer<typeof batchPaymentImportItemSchema>;
