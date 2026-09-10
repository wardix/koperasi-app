import { ServiceError } from "../services/errors";

/**
 * Resolve ISO timestamp for a calendar date (YYYY-MM-DD).
 * Uses local noon so toLocaleDateString stays on the same day.
 * Defaults to now when omitted.
 */
export function resolveCalendarDateIso(dateStr?: string): string {
  if (!dateStr) {
    return new Date().toISOString();
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new ServiceError("Format tanggal tidak valid", 400);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    Number.isNaN(localNoon.getTime()) ||
    localNoon.getFullYear() !== year ||
    localNoon.getMonth() !== month - 1 ||
    localNoon.getDate() !== day
  ) {
    throw new ServiceError("Tanggal tidak valid", 400);
  }

  const today = new Date();
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  if (localNoon.getTime() > endOfToday.getTime()) {
    throw new ServiceError("Tanggal tidak boleh di masa depan", 400);
  }

  return localNoon.toISOString();
}

/** YYYY-MM-DD for schedule due dates from a base date + months. */
export function addMonthsYmd(base: Date, months: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
  d.setMonth(d.getMonth() + months);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Check whether a YYYY-MM-DD date is the last day of its month. */
export function isEndOfMonthStr(dateStr: string): boolean {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return false;
  const [year, month, day] = parts;
  const maxDay = new Date(year, month, 0).getDate();
  return day === maxDay;
}

/**
 * Generate due dates for a loan based on the first installment date.
 * - If the first installment date is an end-of-month date, all subsequent installments
 *   fall on the last day of each subsequent month (e.g. 30/31/28/29).
 * - Otherwise, subsequent installments fall on the same day of each subsequent month
 *   (clamped to the maximum number of days in that month).
 */
export function generateLoanDueDates(firstDueDateStr: string, tenorMonths: number): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(firstDueDateStr);
  if (!match) {
    throw new ServiceError("Format tanggal angsuran pertama tidak valid", 400);
  }
  const startYear = Number(match[1]);
  const startMonth = Number(match[2]);
  const startDay = Number(match[3]);
  const isEOM = isEndOfMonthStr(firstDueDateStr);

  const dueDates: string[] = [];
  for (let i = 0; i < tenorMonths; i++) {
    const targetMonthIndex = (startMonth - 1) + i;
    if (isEOM) {
      const d = new Date(startYear, targetMonthIndex + 1, 0, 12, 0, 0, 0);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      dueDates.push(`${yyyy}-${mm}-${dd}`);
    } else {
      const maxDay = new Date(startYear, targetMonthIndex + 1, 0, 12, 0, 0, 0).getDate();
      const actualDay = Math.min(startDay, maxDay);
      const d = new Date(startYear, targetMonthIndex, actualDay, 12, 0, 0, 0);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      dueDates.push(`${yyyy}-${mm}-${dd}`);
    }
  }
  return dueDates;
}

