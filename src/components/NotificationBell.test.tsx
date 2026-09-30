import { expect, test, describe, afterEach, mock } from "bun:test";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NotificationBell } from "./NotificationBell";
import { ThemeProvider } from "../contexts/ThemeContext";
import type { PendingActionsData } from "../../shared/types";

describe("NotificationBell Component", () => {
  afterEach(() => {
    cleanup();
  });

  const emptyData: PendingActionsData = {
    totalPending: 0,
    pendingLoans: 0,
    pendingEwa: 0,
    pendingSavingsDeposits: 0,
    pendingSavingsWithdrawals: 0,
    openFeedbacks: 0,
    overdueLoansCount: 0,
    items: [],
  };

  const sampleData: PendingActionsData = {
    totalPending: 4,
    pendingLoans: 1,
    pendingEwa: 1,
    pendingSavingsDeposits: 1,
    pendingSavingsWithdrawals: 0,
    openFeedbacks: 1,
    overdueLoansCount: 1,
    items: [
      {
        id: "loan-1",
        category: "loan",
        title: "Pinjaman: Gilang Zakaria Putra",
        subtitle: "Permohonan baru pinjaman sebesar Rp 15.000.000",
        amount: 15000000,
        route: "/loans",
        severity: "warning",
      },
      {
        id: "feedback-1",
        category: "feedback",
        title: "Masukan: Fitur Ekspor EWA",
        subtitle: "Dari Pengguna",
        route: "/feedbacks",
        severity: "info",
      },
    ],
  };

  test("renders clean bell icon when total pending is zero", () => {
    const onNavigate = mock(() => {});
    render(
      <ThemeProvider>
        <NotificationBell pendingActions={emptyData} onNavigate={onNavigate} />
      </ThemeProvider>
    );

    const button = screen.getByRole("button", { name: "Pemberitahuan Tugas" });
    expect(button).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  test("renders badge counter with total tasks when pending actions exist", () => {
    const onNavigate = mock(() => {});
    render(
      <ThemeProvider>
        <NotificationBell pendingActions={sampleData} onNavigate={onNavigate} />
      </ThemeProvider>
    );

    // Total = 4 + 1 overdue = 5
    expect(screen.getByText("5")).toBeTruthy();
  });

  test("opens popover with task details on click and navigates when item is clicked", async () => {
    const onNavigate = mock(() => {});
    render(
      <ThemeProvider>
        <NotificationBell pendingActions={sampleData} onNavigate={onNavigate} />
      </ThemeProvider>
    );

    const button = screen.getByRole("button", { name: /Pemberitahuan: 5 tugas/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Pemberitahuan Tugas")).toBeTruthy();
    });

    expect(screen.getByText("Pinjaman: Gilang Zakaria Putra")).toBeTruthy();
    expect(screen.getByText("Masukan: Fitur Ekspor EWA")).toBeTruthy();

    const loanItem = screen.getByText("Pinjaman: Gilang Zakaria Putra");
    fireEvent.click(loanItem);

    expect(onNavigate).toHaveBeenCalledWith("/loans");
  });

  test("shows empty state message inside popover when pending actions is zero", async () => {
    const onNavigate = mock(() => {});
    render(
      <ThemeProvider>
        <NotificationBell pendingActions={emptyData} onNavigate={onNavigate} />
      </ThemeProvider>
    );

    const button = screen.getByRole("button", { name: "Pemberitahuan Tugas" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Semua Antrean Bersih")).toBeTruthy();
    });
  });
});
