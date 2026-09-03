export function formatEmployee(employee: any, employer?: any) {
  const emp = employer || (typeof employee.employer === "string" ? JSON.parse(employee.employer) : employee.employer);
  const hasBankDetails = Boolean(
    employee.bank_name &&
    employee.bank_account_number &&
    employee.bank_account_holder
  );

  let joinDateStr = employee.join_date;
  if (joinDateStr instanceof Date) {
    joinDateStr = joinDateStr.toISOString().slice(0, 10);
  } else if (typeof joinDateStr === "string") {
    joinDateStr = joinDateStr.slice(0, 10);
  }

  const salary = Math.round(Number(employee.base_salary || employee.withdrawal_limit || 0));

  return {
    id: Number(employee.id),
    name: employee.name,
    email: employee.email,
    nik: employee.nik,
    employee_number: employee.nip || employee.nik || null,
    monthly_salary: salary,
    withdrawal_limit: Number(employee.withdrawal_limit || salary),
    join_date: joinDateStr,
    status: employee.status,
    status_label:
      employee.status === "active"
        ? "Active"
        : employee.status === "frozen"
        ? "Frozen"
        : "Inactive",
    can_request_withdrawal: employee.status === "active",
    kyc_status: employee.kyc_status || null,
    bank: {
      name: employee.bank_name || null,
      account_number: employee.bank_account_number || null,
      account_holder: employee.bank_account_holder || null,
      is_complete: hasBankDetails,
    },
    employer: emp
      ? {
          id: Number(emp.id),
          company_name: emp.company_name,
          cutoff_day: Number(emp.cutoff_day),
          fee_percent: Number(emp.fee_percent ?? 5),
          fee_tiers: emp.fee_tiers,
          max_withdrawal_amount: emp.max_withdrawal_amount
            ? Number(emp.max_withdrawal_amount)
            : null,
        }
      : undefined,
  };
}

export function maskAccountNumber(num: string | null | undefined): string | null {
  if (!num) return null;
  const str = String(num).trim();
  if (str.length <= 4) return str;
  return "•".repeat(str.length - 4) + str.slice(-4);
}

export function formatWithdrawal(req: any) {
  const fee = Number(req.fee);
  const amount = Number(req.amount);
  const feeTier = typeof req.fee_tier_snapshot === "string" 
    ? JSON.parse(req.fee_tier_snapshot) 
    : req.fee_tier_snapshot;

  return {
    id: Number(req.id),
    amount,
    fee,
    fee_percent: Number(req.fee_percentage || (amount > 0 ? ((fee / amount) * 100).toFixed(2) : 0)),
    fee_tier: feeTier || null,
    total_repayment: amount + fee,
    status: req.status,
    status_label:
      req.status === "transferred"
        ? "Ditransfer"
        : req.status === "rejected"
        ? "Ditolak"
        : "Menunggu Transfer",
    is_final: req.status === "transferred" || req.status === "rejected",
    pay_period_start: req.pay_period_start instanceof Date ? req.pay_period_start.toISOString().slice(0, 10) : String(req.pay_period_start).slice(0, 10),
    pay_period_end: req.pay_period_end instanceof Date ? req.pay_period_end.toISOString().slice(0, 10) : String(req.pay_period_end).slice(0, 10),
    destination: {
      bank_name: req.destination_bank_name,
      account_number: maskAccountNumber(req.destination_account_number),
      account_holder: req.destination_account_holder,
    },
    requested_at: req.requested_at ? new Date(req.requested_at).toISOString() : null,
    approved_at: req.approved_at ? new Date(req.approved_at).toISOString() : null,
    transferred_at: req.transferred_at ? new Date(req.transferred_at).toISOString() : null,
    rejected_at: req.rejected_at ? new Date(req.rejected_at).toISOString() : null,
    rejection_reason: req.rejection_reason || null,
  };
}

export function formatLoanApplication(app: any, includeSchedule: boolean = false) {
  const isFinal = ["disbursed", "rejected", "cancelled"].includes(app.status);
  const labels: Record<string, string> = {
    pending_approval: "Menunggu Persetujuan",
    approved: "Disetujui",
    disbursed: "Dicairkan",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
  };

  const schedule = typeof app.schedule_snapshot === "string"
    ? JSON.parse(app.schedule_snapshot)
    : app.schedule_snapshot;

  return {
    id: Number(app.id),
    reference: app.reference,
    amount: Number(app.amount),
    tenor_months: Number(app.tenor_months),
    purpose: app.purpose,
    annual_interest_rate: String(app.annual_interest_rate),
    monthly_installment: Number(app.monthly_installment),
    total_interest: Number(app.total_interest),
    total_repayment: Number(app.total_repayment),
    status: app.status,
    status_label: labels[app.status] || app.status,
    is_final: isFinal,
    first_due_date: app.first_due_date ? (app.first_due_date instanceof Date ? app.first_due_date.toISOString().slice(0, 10) : String(app.first_due_date).slice(0, 10)) : null,
    ...(includeSchedule ? { schedule: schedule || [] } : {}),
    submitted_at: app.submitted_at ? new Date(app.submitted_at).toISOString() : null,
    decided_at: app.decided_at ? new Date(app.decided_at).toISOString() : null,
    disbursed_at: app.disbursed_at ? new Date(app.disbursed_at).toISOString() : null,
    rejection_reason: app.rejection_reason || null,
  };
}
