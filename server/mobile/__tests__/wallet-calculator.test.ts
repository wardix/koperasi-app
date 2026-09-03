import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FeeScheduleException } from "../domain/exceptions.js";
import { WalletCalculator } from "../domain/rules/wallet-calculator.js";
import { FeeSchedule } from "../domain/value-objects/fee-schedule.js";

const vectorsPath = join(import.meta.dir, "fixtures/wallet_vectors.json");
const vectors = JSON.parse(readFileSync(vectorsPath, "utf-8"));

describe("WalletCalculator with shared vectors", () => {
  const calculator = new WalletCalculator();
  const defaultFeeSchedule = FeeSchedule.fromArray(vectors.fee_schedule);

  describe("Pay Periods", () => {
    for (const vector of vectors.pay_periods) {
      it(vector.name, () => {
        const period = calculator.getPayPeriod(
          vector.today,
          vector.cutoff_day,
          vector.join_date ?? null
        );

        expect(period.start).toBe(vector.expected.start);
        expect(period.end).toBe(vector.expected.end);
        expect(period.totalDays).toBe(vector.expected.total_days);
        expect(period.daysElapsed).toBe(vector.expected.days_elapsed);
      });
    }
  });

  describe("Max Withdrawable", () => {
    for (const vector of vectors.max_withdrawable) {
      it(vector.name, () => {
        const period = calculator.getPayPeriod(
          vector.today,
          vector.cutoff_day,
          vector.join_date ?? null
        );

        const effectiveLimit = calculator.effectiveLimit(
          vector.withdrawal_limit,
          vector.max_withdrawal_amount ?? null
        );

        if (vector.expected.daily_rate !== undefined) {
          expect(calculator.dailyRate(effectiveLimit, period)).toBe(vector.expected.daily_rate);
        }

        if (vector.expected.unlocked !== undefined) {
          expect(calculator.unlocked(effectiveLimit, period)).toBe(vector.expected.unlocked);
        }

        if (vector.expected.max_withdrawable !== undefined) {
          expect(
            calculator.getMaxWithdrawable(
              effectiveLimit,
              period,
              vector.already_withdrawn
            )
          ).toBe(vector.expected.max_withdrawable);
        }
      });
    }
  });

  describe("Fees", () => {
    for (const vector of vectors.fees) {
      it(vector.name, () => {
        const schedule = vector.fee_tiers
          ? FeeSchedule.fromArray(vector.fee_tiers)
          : defaultFeeSchedule;

        if (vector.expected.uncovered) {
          expect(() => calculator.calculateFee(vector.amount, schedule)).toThrow(
            FeeScheduleException
          );
        } else {
          expect(calculator.calculateFee(vector.amount, schedule)).toBe(
            vector.expected.fee
          );
          expect(calculator.calculateTotalRepayment(vector.amount, schedule)).toBe(
            vector.expected.total_repayment
          );
        }
      });
    }
  });

  describe("Effective Limits", () => {
    for (const vector of vectors.effective_limits) {
      it(vector.name, () => {
        expect(
          calculator.effectiveLimit(
            vector.withdrawal_limit,
            vector.max_withdrawal_amount ?? null
          )
        ).toBe(vector.expected.effective_limit);
      });
    }
  });
});
