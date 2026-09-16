import { describe, it, expect, mock, afterEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RejectLoanDialogContent } from "./RejectLoanDialog";
import type { LoanRow } from "../shared/types";

const sampleLoan: LoanRow = {
  id: "loan-reject-test-1",
  memberId: "mem-1",
  name: "Budi Santoso",
  amount: 5000000,
  tenor: 6,
  purpose: "Renovasi Rumah",
  status: "Menunggu",
  createdAt: "2026-09-01T08:00:00.000Z",
};

describe("RejectLoanDialogContent", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders loan details and title correctly", () => {
    const onClose = mock(() => {});
    const onConfirm = mock(() => {});

    render(
      <RejectLoanDialogContent
        loan={sampleLoan}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Tolak Pengajuan Pinjaman")).toBeDefined();
    expect(screen.getByText("Budi Santoso")).toBeDefined();
    expect(screen.getByText("6 Bulan")).toBeDefined();
    expect(screen.getByText("Renovasi Rumah")).toBeDefined();
  });

  it("validates that rejection reason is required before submitting", () => {
    const onClose = mock(() => {});
    const onConfirm = mock(() => {});

    render(
      <RejectLoanDialogContent
        loan={sampleLoan}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    const submitBtn = screen.getByRole("button", { name: "Tolak Pinjaman" });
    fireEvent.click(submitBtn);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Alasan penolakan wajib diisi")).toBeDefined();
  });

  it("submits the chosen common reason or typed reason", () => {
    const onClose = mock(() => {});
    const onConfirm = mock(() => {});

    render(
      <RejectLoanDialogContent
        loan={sampleLoan}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    // Click quick template reason
    const quickPill = screen.getByText("Kapasitas cicilan / rasio penghasilan belum mencukupi");
    fireEvent.click(quickPill);

    const submitBtn = screen.getByRole("button", { name: "Tolak Pinjaman" });
    fireEvent.click(submitBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("Kapasitas cicilan / rasio penghasilan belum mencukupi");
  });

  it("calls onClose when Batal is clicked", () => {
    const onClose = mock(() => {});
    const onConfirm = mock(() => {});

    render(
      <RejectLoanDialogContent
        loan={sampleLoan}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Batal" });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
