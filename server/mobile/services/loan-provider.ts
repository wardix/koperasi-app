import { LoanTerms } from "../domain/value-objects/loan-terms.js";
import { LoanQuote } from "../domain/value-objects/loan-quote.js";
import { LoanException } from "../domain/exceptions.js";
import { sql } from "../db/index.js";

export interface Membership {
  isMember: boolean;
  memberNumber: string | null;
  status: string | null;
  name: string | null;
  joinedAt: string | null;
}

export interface SubmittedLoan {
  externalId: string | null;
  status: string | null;
}

export class LoanProviderClient {
  private baseUrl: string | null;
  private apiKey: string;
  private timeout: number;

  constructor() {
    const rawUrl = process.env.LOAN_PROVIDER_BASE_URL;
    this.baseUrl = rawUrl && !rawUrl.includes("example.com") ? rawUrl.replace(/\/+$/, "") : null;
    this.apiKey = process.env.LOAN_PROVIDER_API_KEY || "";
    this.timeout = parseInt(process.env.LOAN_PROVIDER_TIMEOUT || "10000", 10);
  }

  async terms(): Promise<LoanTerms> {
    const fallbackRate = process.env.DEFAULT_LOAN_ANNUAL_INTEREST_RATE || "9.10462";

    // 1. If running internally, fetch from local settings directly
    try {
      const rows = await sql`
        SELECT bunga_pinjaman FROM settings LIMIT 1
      `;
      if (rows.length > 0 && rows[0].bunga_pinjaman) {
        const rate = String(rows[0].bunga_pinjaman);
        return new LoanTerms(rate);
      }
    } catch {
      // ignore and fallback
    }

    // 2. If external baseUrl is explicitly configured
    if (this.baseUrl) {
      try {
        const res = await fetch(`${this.baseUrl}/settings`, {
          method: "GET",
          headers: this.headers(),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (res.ok) {
          const body = (await res.json()) as Record<string, any>;
          const data = body.data || body;
          return LoanTerms.fromArray(data);
        }
      } catch {
        // fallback
      }
    }

    return new LoanTerms(fallbackRate);
  }

  async membership(email: string, nik?: string | null): Promise<Membership> {
    // 1. Direct local database check in members table
    try {
      let rows: any[] = [];
      if (nik && nik.trim() !== "") {
        rows = await sql`
          SELECT * FROM members 
          WHERE (email = ${email} OR nik = ${nik})
            AND (deletedat IS NULL)
          LIMIT 1
        `;
      } else {
        rows = await sql`
          SELECT * FROM members 
          WHERE email = ${email}
            AND (deletedat IS NULL)
          LIMIT 1
        `;
      }

      if (rows.length > 0) {
        const m = rows[0];
        return {
          isMember: true,
          memberNumber: m.member_number ? String(m.member_number) : (m.id ? String(m.id).slice(0, 8) : null),
          status: m.status ? String(m.status) : "active",
          name: m.name ? String(m.name) : null,
          joinedAt: m.created_at ? new Date(m.created_at).toISOString() : null,
        };
      }
    } catch (err: any) {
      console.warn("Direct membership lookup warning:", err.message);
    }

    // 2. If external baseUrl configured
    if (this.baseUrl) {
      const params = new URLSearchParams({ email });
      if (nik) params.append("nik", nik);

      try {
        const res = await fetch(`${this.baseUrl}/membership?${params.toString()}`, {
          method: "GET",
          headers: this.headers(),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (res.status === 404) {
          return {
            isMember: false,
            memberNumber: null,
            status: null,
            name: null,
            joinedAt: null,
          };
        }

        if (res.ok) {
          const body = (await res.json()) as Record<string, any>;
          const data = body.data || body;
          if (data && data.is_member !== false) {
            return {
              isMember: true,
              memberNumber: data.member_number ? String(data.member_number) : null,
              status: data.status ? String(data.status) : "active",
              name: data.name ? String(data.name) : null,
              joinedAt: data.joined_at ? String(data.joined_at) : null,
            };
          }
        }
      } catch (err: any) {
        if (err instanceof LoanException) throw err;
      }
    }

    return {
      isMember: false,
      memberNumber: null,
      status: null,
      name: null,
      joinedAt: null,
    };
  }

  async submit(
    reference: string,
    employee: { email: string; nik?: string | null; name: string },
    quote: LoanQuote,
    purpose?: string | null,
    submittedAt: string = new Date().toISOString()
  ): Promise<SubmittedLoan> {
    // 1. Direct local submission
    try {
      // Find member id
      const members = await sql`
        SELECT id FROM members 
        WHERE (email = ${employee.email} OR (nik = ${employee.nik ?? ""} AND ${employee.nik ?? ""} != ""))
          AND (deletedat IS NULL)
        LIMIT 1
      `;

      const loanId = crypto.randomUUID();
      const memberId = members.length > 0 ? members[0].id : null;

      if (memberId) {
        await sql`
          INSERT INTO loans (
            id, member_id, amount, duration_months, interest_rate, status, note, created_at, updated_at
          ) VALUES (
            ${loanId}, ${memberId}, ${quote.principal}, ${quote.tenorMonths}, ${quote.annualInterestRate}, 'PENDING', ${purpose || "Pengajuan via Mobile App"}, NOW(), NOW()
          )
        `;

        return {
          externalId: loanId,
          status: "pending",
        };
      }
    } catch (err: any) {
      console.warn("Direct loan submission warning, checking fallback:", err.message);
    }

    // 2. Fallback to external HTTP if configured
    if (this.baseUrl) {
      try {
        const res = await fetch(`${this.baseUrl}/loans`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({
            reference,
            member: {
              email: employee.email,
              nik: employee.nik,
              name: employee.name,
            },
            amount: quote.principal,
            tenor_months: quote.tenorMonths,
            purpose: purpose ?? null,
            annual_interest_rate: quote.annualInterestRate,
            monthly_installment: quote.monthlyInstallment,
            total_interest: quote.totalInterest,
            total_repayment: quote.totalRepayment,
            submitted_at: submittedAt,
          }),
          signal: AbortSignal.timeout(this.timeout),
        });

        const body = (await res.json().catch(() => ({}))) as Record<string, any>;
        const data = body.data || body;

        if (!res.ok) {
          const reason = data.message || data.error || "Loan application rejected by provider.";
          throw LoanException.rejectedBySubmission(reason);
        }

        return {
          externalId: data.id ? String(data.id) : null,
          status: data.status ? String(data.status) : "pending",
        };
      } catch (err: any) {
        if (err instanceof LoanException) throw err;
        throw new LoanException(`Upstream koperasi service error: ${err.message}`, "upstream_koperasi_error", 503);
      }
    }

    return {
      externalId: null,
      status: "pending",
    };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
      headers["X-Api-Key"] = this.apiKey;
    }
    return headers;
  }
}
