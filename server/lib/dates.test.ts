import { describe, it, expect } from "bun:test";
import { isEndOfMonthStr, generateLoanDueDates } from "./dates";

describe("dates helper functions", () => {
  describe("isEndOfMonthStr", () => {
    it("identifies end of month correctly", () => {
      expect(isEndOfMonthStr("2026-01-31")).toBe(true);
      expect(isEndOfMonthStr("2026-02-28")).toBe(true);
      expect(isEndOfMonthStr("2024-02-29")).toBe(true); // leap year
      expect(isEndOfMonthStr("2024-02-28")).toBe(false);
      expect(isEndOfMonthStr("2026-04-30")).toBe(true);
      expect(isEndOfMonthStr("2026-04-29")).toBe(false);
      expect(isEndOfMonthStr("2026-08-30")).toBe(false); // August has 31 days
      expect(isEndOfMonthStr("2026-08-31")).toBe(true);
      expect(isEndOfMonthStr("invalid")).toBe(false);
    });
  });

  describe("generateLoanDueDates", () => {
    it("generates end-of-month dates when first installment is end-of-month", () => {
      // 6-month loan starting 2026-09-30 (September ends on 30)
      const dates = generateLoanDueDates("2026-09-30", 6);
      expect(dates).toEqual([
        "2026-09-30",
        "2026-10-31",
        "2026-11-30",
        "2026-12-31",
        "2027-01-31",
        "2027-02-28", // 2027 non-leap Feb
      ]);
    });

    it("generates end-of-month dates properly across leap year Feb", () => {
      // 3-month loan starting 2024-01-31
      const dates = generateLoanDueDates("2024-01-31", 3);
      expect(dates).toEqual([
        "2024-01-31",
        "2024-02-29", // 2024 is leap year
        "2024-03-31",
      ]);
    });

    it("generates same-day dates when first installment is not end-of-month", () => {
      const dates = generateLoanDueDates("2026-09-15", 4);
      expect(dates).toEqual([
        "2026-09-15",
        "2026-10-15",
        "2026-11-15",
        "2026-12-15",
      ]);
    });

    it("clamps fixed-day dates to month max when day exceeds month days", () => {
      // Starting on 30th of a 31-day month (August), so isEndOfMonth is false
      const dates = generateLoanDueDates("2026-08-30", 7);
      expect(dates[0]).toBe("2026-08-30");
      expect(dates[1]).toBe("2026-09-30"); // Sept has 30
      expect(dates[2]).toBe("2026-10-30"); // Oct has 31
      expect(dates[3]).toBe("2026-11-30"); // Nov has 30
      expect(dates[4]).toBe("2026-12-30"); // Dec has 31
      expect(dates[5]).toBe("2027-01-30"); // Jan has 31
      expect(dates[6]).toBe("2027-02-28"); // Feb has 28, clamped
    });

    it("throws ServiceError for invalid date format", () => {
      expect(() => generateLoanDueDates("invalid-date", 3)).toThrow("Format tanggal angsuran pertama tidak valid");
    });
  });
});
