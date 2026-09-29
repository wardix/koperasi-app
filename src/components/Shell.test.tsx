import { expect, test, describe, afterEach, spyOn } from "bun:test";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Shell from "./Shell";
import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import * as apiModule from "../services/api";

function renderShell(initialEntries = ["/"]) {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("Shell Component", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("shows Hak Akses menu for superadmin role", async () => {
    localStorage.setItem("token", "test-token");
    localStorage.setItem("role", "superadmin");
    spyOn(apiModule.api, "get").mockResolvedValue({});
    renderShell();
    await waitFor(() => expect(screen.getByText("Hak Akses")).toBeTruthy());
    expect(screen.getAllByText("Dasbor").length).toBeGreaterThan(0);
  });

  test("hides Hak Akses menu for viewer role", async () => {
    localStorage.setItem("token", "test-token");
    localStorage.setItem("role", "viewer");
    spyOn(apiModule.api, "get").mockResolvedValue({});
    renderShell();
    await waitFor(() => expect(screen.queryByText("Hak Akses")).toBeNull());
    expect(screen.getAllByText("Dasbor").length).toBeGreaterThan(0);
  });

  test("hides financial analytics nav for viewer role", async () => {
    localStorage.setItem("token", "test-token");
    localStorage.setItem("role", "viewer");
    spyOn(apiModule.api, "get").mockResolvedValue({});
    renderShell();
    await waitFor(() => expect(screen.queryByText("Laporan")).toBeNull());
    expect(screen.queryByText("Arus Kas")).toBeNull();
    expect(screen.queryByText("Kredit Macet (NPL)")).toBeNull();
  });

  test("shows financial analytics nav for admin role", async () => {
    localStorage.setItem("token", "test-token");
    localStorage.setItem("role", "admin");
    spyOn(apiModule.api, "get").mockResolvedValue({});
    renderShell();
    await waitFor(() => expect(screen.getByText("Laporan")).toBeTruthy());
    expect(screen.getByText("Arus Kas")).toBeTruthy();
    expect(screen.getByText("Kredit Macet (NPL)")).toBeTruthy();
  });

  test("shows Kotak Masukan & Bug nav item", async () => {
    localStorage.setItem("token", "test-token");
    localStorage.setItem("role", "admin");
    spyOn(apiModule.api, "get").mockResolvedValue({});
    renderShell();
    await waitFor(() => expect(screen.getByText("Kotak Masukan & Bug")).toBeTruthy());
  });

  test("shows badge counters when pending actions exist", async () => {
    localStorage.setItem("token", "test-token");
    localStorage.setItem("role", "admin");
    spyOn(apiModule.api, "get").mockImplementation(async (path: string) => {
      if (path.includes("pending-actions")) {
        return {
          totalPending: 5,
          pendingLoans: 2,
          pendingEwa: 1,
          pendingSavingsDeposits: 1,
          pendingSavingsWithdrawals: 1,
          openFeedbacks: 3,
          overdueLoansCount: 4,
        };
      }
      return {};
    });
    renderShell();
    await waitFor(() => {
      expect(screen.getByText("Kotak Masukan & Bug")).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getAllByText("2").length).toBeGreaterThan(0);
      expect(screen.getAllByText("3").length).toBeGreaterThan(0);
      expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    });
  });
});
