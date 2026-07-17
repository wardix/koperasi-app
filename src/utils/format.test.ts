import { expect, test, describe } from "bun:test";
import { formatAmountInput, formatRp, parseAmountInput } from "./format";

describe("formatRp", () => {
  test("formats numbers with thousand separators", () => {
    expect(formatRp(1000000)).toBe("Rp 1.000.000");
    expect(formatRp(0)).toBe("Rp 0");
  });

  test("formats numeric strings from Postgres SUM", () => {
    expect(formatRp("2500000")).toBe("Rp 2.500.000");
    expect(formatRp("0")).toBe("Rp 0");
  });

  test("handles null/invalid as zero", () => {
    expect(formatRp(null)).toBe("Rp 0");
    expect(formatRp(undefined)).toBe("Rp 0");
    expect(formatRp("")).toBe("Rp 0");
  });
});

describe("formatAmountInput", () => {
  test("adds Indonesian thousand separators", () => {
    expect(formatAmountInput("1000")).toBe("1.000");
    expect(formatAmountInput("1000000")).toBe("1.000.000");
    expect(formatAmountInput("1.000.000")).toBe("1.000.000");
  });

  test("preserves leading minus for withdrawals", () => {
    expect(formatAmountInput("-50000")).toBe("-50.000");
    expect(formatAmountInput("-")).toBe("-");
  });

  test("strips non-digits except leading minus", () => {
    expect(formatAmountInput("rp 12.345a")).toBe("12.345");
  });
});

describe("parseAmountInput", () => {
  test("parses formatted amounts", () => {
    expect(parseAmountInput("1.000.000")).toBe(1000000);
    expect(parseAmountInput("-50.000")).toBe(-50000);
    expect(parseAmountInput("")).toBe(0);
    expect(parseAmountInput("-")).toBe(0);
  });
});
