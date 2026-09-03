import { InvalidPayPeriodException } from "../exceptions.js";
import { FeeSchedule } from "../value-objects/fee-schedule.js";
import { PayPeriod } from "../value-objects/pay-period.js";
import { WalletBalance } from "../value-objects/wallet-balance.js";

export class WalletCalculator {
  getPayPeriod(
    todayInput: string | Date,
    cutoffDay: number = 25,
    joinDateInput?: string | Date | null
  ): PayPeriod {
    if (cutoffDay < 1 || cutoffDay > 28) {
      throw InvalidPayPeriodException.cutoffDayOutOfRange(cutoffDay);
    }

    const today = this.normalizeDateString(todayInput);
    const [yStr, mStr, dStr] = today.split("-");
    let year = parseInt(yStr, 10);
    let month = parseInt(mStr, 10);
    const dayOfMonth = parseInt(dStr, 10);

    if (dayOfMonth <= cutoffDay) {
      month--;
    }

    const start = this.dayAfterCutoff(year, month, cutoffDay);
    const end = this.dateAt(year, month + 1, cutoffDay);
    const totalDays = this.inclusiveDayCount(start, end);

    let accrualStart = start;
    if (joinDateInput) {
      const joinDate = this.normalizeDateString(joinDateInput);
      if (joinDate > start) {
        accrualStart = joinDate;
      }
    }

    let daysElapsed = 0;
    if (today >= accrualStart) {
      daysElapsed = Math.min(this.inclusiveDayCount(accrualStart, today), totalDays);
    }

    return new PayPeriod(start, end, totalDays, daysElapsed, accrualStart);
  }

  effectiveLimit(withdrawalLimit: number, maxWithdrawalAmount: number | null): number {
    if (maxWithdrawalAmount === null || maxWithdrawalAmount === undefined) {
      return Math.max(0, withdrawalLimit);
    }
    return Math.max(0, Math.min(withdrawalLimit, maxWithdrawalAmount));
  }

  dailyRate(withdrawalLimit: number, period: PayPeriod): number {
    if (period.totalDays <= 0) {
      return 0;
    }
    return Math.floor(withdrawalLimit / period.totalDays);
  }

  unlocked(withdrawalLimit: number, period: PayPeriod): number {
    return this.dailyRate(withdrawalLimit, period) * period.daysElapsed;
  }

  getMaxWithdrawable(
    withdrawalLimit: number,
    period: PayPeriod,
    alreadyWithdrawn: number
  ): number {
    return Math.max(0, this.unlocked(withdrawalLimit, period) - alreadyWithdrawn);
  }

  calculateFee(amount: number, feeSchedule: FeeSchedule): number {
    return feeSchedule.feeFor(amount);
  }

  calculateTotalRepayment(amount: number, feeSchedule: FeeSchedule): number {
    return amount + this.calculateFee(amount, feeSchedule);
  }

  buildBalance(
    withdrawalLimit: number,
    period: PayPeriod,
    alreadyWithdrawn: number,
    feeSchedule: FeeSchedule,
    maxWithdrawalAmount: number | null = null
  ): WalletBalance {
    const effective = this.effectiveLimit(withdrawalLimit, maxWithdrawalAmount);

    return new WalletBalance(
      period,
      withdrawalLimit,
      maxWithdrawalAmount,
      effective,
      this.dailyRate(effective, period),
      this.unlocked(effective, period),
      alreadyWithdrawn,
      this.getMaxWithdrawable(effective, period, alreadyWithdrawn),
      feeSchedule
    );
  }

  private dayAfterCutoff(year: number, month: number, cutoffDay: number): string {
    const normalized = this.normalizeYearMonth(year, month);
    // Number of days in this normalized month:
    const daysInMonth = new Date(Date.UTC(normalized.year, normalized.month, 0)).getUTCDate();

    if (cutoffDay + 1 > daysInMonth) {
      return this.dateAt(normalized.year, normalized.month + 1, 1);
    }

    return this.dateAt(normalized.year, normalized.month, cutoffDay + 1);
  }

  private dateAt(year: number, month: number, day: number): string {
    const normalized = this.normalizeYearMonth(year, month);
    const yStr = String(normalized.year).padStart(4, "0");
    const mStr = String(normalized.month).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    return `${yStr}-${mStr}-${dStr}`;
  }

  private normalizeYearMonth(year: number, month: number): { year: number; month: number } {
    while (month > 12) {
      month -= 12;
      year++;
    }
    while (month < 1) {
      month += 12;
      year--;
    }
    return { year, month };
  }

  private inclusiveDayCount(fromStr: string, toStr: string): number {
    const fromTime = Date.parse(fromStr + "T00:00:00Z");
    const toTime = Date.parse(toStr + "T00:00:00Z");
    return Math.round((toTime - fromTime) / 86400000) + 1;
  }

  private normalizeDateString(date: string | Date): string {
    if (typeof date === "string") {
      return date.slice(0, 10);
    }
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}
