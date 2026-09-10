import { describe, it, expect, mock } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ApproveLoanDialogContent,
  getEndOfMonth,
  isEndOfMonthStr,
  getDefaultFirstDueDate,
  computeScheduleDueDates,
} from "./ApproveLoanDialog";
import type { LoanRow } from "../shared/types";

// Mock useApiQuery
mock.module("../hooks/useApiQuery", () => ({
  useApiQuery: (url: string) => {
    if (url === "/api/settings") {
      return { data: { bungaPinjaman: "12" } };
    }
    if (url === "/api/loans/payment-sources") {
      return {
        data: {
          success: true,
          data: [
            { id: "acc-1", code: "1101", name: "Kas Utama", type: "Asset" },
          ],
        },
      };
    }
    return { data: null };
  },
}));

const sampleLoan: LoanRow = {
  id: "loan-test-1",
  memberId: "mem-1",
  name: "Budi Santoso",
  amount: 6000000,
  tenor: 3,
  purpose: "Modal Usaha",
  status: "Menunggu",
  destinationBank: "BCA",
  destinationAccount: "1234567890",
  destinationName: "Budi Santoso",
  createdAt: "2026-09-01T08:00:00.000Z",
};

describe("ApproveLoanDialog date utilities", () => {
  it("getEndOfMonth computes correct last day of month", () => {
    expect(getEndOfMonth(2026, 2)).toBe("2026-02-28");
    expect(getEndOfMonth(2024, 2)).toBe("2024-02-29");
    expect(getEndOfMonth(2026, 9)).toBe("2026-09-30");
    expect(getEndOfMonth(2026, 10)).toBe("2026-10-31");
  });

  it("isEndOfMonthStr detects whether a date string is end of month", () => {
    expect(isEndOfMonthStr("2026-09-30")).toBe(true);
    expect(isEndOfMonthStr("2026-09-29")).toBe(false);
    expect(isEndOfMonthStr("2026-10-31")).toBe(true);
    expect(isEndOfMonthStr("2026-10-30")).toBe(false);
  });

  it("getDefaultFirstDueDate suggests end of current month if approved <= 20th", () => {
    expect(getDefaultFirstDueDate("2026-09-10")).toBe("2026-09-30");
    expect(getDefaultFirstDueDate("2026-09-20")).toBe("2026-09-30");
  });

  it("getDefaultFirstDueDate suggests end of next month if approved > 20th", () => {
    expect(getDefaultFirstDueDate("2026-09-21")).toBe("2026-10-31");
    expect(getDefaultFirstDueDate("2026-09-28")).toBe("2026-10-31");
  });

  it("computeScheduleDueDates generates end-of-month dates when first installment is end-of-month", () => {
    const dates = computeScheduleDueDates("2026-09-30", 3);
    expect(dates).toEqual(["2026-09-30", "2026-10-31", "2026-11-30"]);
  });

  it("computeScheduleDueDates generates same-day dates when first installment is not end-of-month", () => {
    const dates = computeScheduleDueDates("2026-09-15", 3);
    expect(dates).toEqual(["2026-09-15", "2026-10-15", "2026-11-15"]);
  });
});

describe("ApproveLoanDialogContent component", () => {
  it("renders first installment date input and submits selected values", () => {
    const onConfirmMock = mock(() => {});
    const onCloseMock = mock(() => {});

    render(
      <ApproveLoanDialogContent
        loan={sampleLoan}
        onClose={onCloseMock}
        onConfirm={onConfirmMock}
      />
    );

    expect(screen.getByText("Tanggal Angsuran Pertama")).toBeTruthy();
    expect(screen.getByText(/Akhir Bulan Ini/)).toBeTruthy();
    expect(screen.getByText(/Akhir Bulan Depan/)).toBeTruthy();

    const submitBtn = screen.getByRole("button", { name: /Setujui & Catat Pencairan/i });
    expect(submitBtn).toBeTruthy();
    fireEvent.click(submitBtn);

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    const callArg = onConfirmMock.mock.calls[0][0];
    expect(callArg.firstInstallmentDate).toBeDefined();
    expect(typeof callArg.firstInstallmentDate).toBe("string");
  });
});
