import { expect, test, describe } from "bun:test";
import { formatAmountInput, parseAmountInput } from "./format";

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
