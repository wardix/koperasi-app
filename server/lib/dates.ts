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
