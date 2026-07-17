/**
 * Canonical API routes that must appear in openapi.yaml.
 * Paths are relative to the server base URL (/api/v1).
 *
 * Process: manual spec + CI check (see scripts/openapi-check.ts).
 * Update this manifest when adding routes covered by the public API contract.
 */
export type RouteEntry = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  tag: string;
};

export const OPENAPI_ROUTE_MANIFEST: RouteEntry[] = [
  // Auth (canonical prefix /api/v1/auth)
  { method: "POST", path: "/auth/login", tag: "auth" },
  { method: "POST", path: "/auth/google", tag: "auth" },
  { method: "POST", path: "/auth/refresh", tag: "auth" },
  { method: "POST", path: "/auth/logout", tag: "auth" },
  { method: "GET", path: "/auth/verify", tag: "auth" },

  // Members
  { method: "GET", path: "/members", tag: "members" },
  { method: "POST", path: "/members", tag: "members" },
  { method: "PUT", path: "/members/{id}", tag: "members" },
  { method: "DELETE", path: "/members/{id}", tag: "members" },
  { method: "PUT", path: "/members/{id}/savings", tag: "members" },
  { method: "PUT", path: "/members/{id}/portal-access", tag: "members" },
  { method: "POST", path: "/members/{id}/impersonate", tag: "members" },
  { method: "GET", path: "/members/{id}/transactions", tag: "members" },

  // Loans
  { method: "GET", path: "/loans", tag: "loans" },
  { method: "POST", path: "/loans", tag: "loans" },
  { method: "PUT", path: "/loans/{id}/status", tag: "loans" },
  { method: "PUT", path: "/loans/{id}/disbursement-date", tag: "loans" },
  { method: "DELETE", path: "/loans/{id}", tag: "loans" },
  { method: "GET", path: "/loans/payments", tag: "loans" },
  { method: "GET", path: "/loans/{id}/payments", tag: "loans" },
  { method: "POST", path: "/loans/{id}/payments", tag: "loans" },
  { method: "PUT", path: "/loans/{id}/payments/{paymentId}", tag: "loans" },
  { method: "DELETE", path: "/loans/{id}/payments/{paymentId}", tag: "loans" },

  // Savings
  { method: "GET", path: "/savings/transactions", tag: "savings" },

  // SHU
  { method: "GET", path: "/shu", tag: "shu" },
  { method: "GET", path: "/shu/config", tag: "shu" },
  { method: "POST", path: "/shu/close", tag: "shu" },
  { method: "POST", path: "/shu/reopen", tag: "shu" },

  // NPL
  { method: "GET", path: "/npl", tag: "npl" },

  // Cashflow
  { method: "GET", path: "/cashflow", tag: "cashflow" },

  // Expenses (pengeluaran operasional)
  { method: "GET", path: "/expenses", tag: "expenses" },
  { method: "POST", path: "/expenses", tag: "expenses" },
  { method: "PUT", path: "/expenses/{id}", tag: "expenses" },
  { method: "DELETE", path: "/expenses/{id}", tag: "expenses" },

  // Reports
  { method: "GET", path: "/reports/summary", tag: "reports" },
  { method: "GET", path: "/reports/monthly-interest", tag: "reports" },
];