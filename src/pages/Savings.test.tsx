import { expect, test, describe, afterEach, spyOn } from "bun:test";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Savings from "./Savings";
import { AuthProvider } from "../contexts/AuthContext";
import * as apiModule from "../services/api";

function renderSavings() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Savings />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Savings Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders without crashing with data and allows switching tabs", async () => {
    spyOn(apiModule.api, "get").mockImplementation((url: string) => {
      if (url.includes('/api/savings/transactions')) {
        return Promise.resolve({
          data: [
            {
              id: "tx-1",
              memberId: "m-1",
              memberName: "Budi Santoso",
              type: "setor_sukarela",
              amount: 500000,
              balanceBefore: 1000000,
              balanceAfter: 1500000,
              createdAt: "2026-09-01T10:00:00.000Z",
              createdBy: "admin@koperasi.com",
            }
          ],
          total: 1,
          page: 1,
          limit: 20
        });
      }
      if (url.includes('/api/savings/deposits')) {
        return Promise.resolve({
          data: [
            {
              id: "dep-1",
              memberId: "m-1",
              memberName: "Budi Santoso",
              memberNik: "1234567890",
              savingsType: "sukarela",
              amount: 500000,
              transferDate: "2026-09-01",
              destinationBank: "Mandiri",
              destinationAccountNumber: "12345",
              proofUrl: "/uploads/proof.jpg",
              status: "Menunggu",
              createdAt: "2026-09-01T10:00:00.000Z",
            }
          ],
          total: 1,
          page: 1,
          limit: 20
        });
      }
      if (url.includes('/api/savings/withdrawals')) {
        return Promise.resolve({
          data: [
            {
              id: "wd-1",
              memberId: "m-1",
              memberName: "Budi Santoso",
              memberNik: "1234567890",
              amount: 200000,
              destinationBank: "BCA",
              destinationAccount: "98765",
              destinationName: "Budi Santoso",
              status: "Menunggu",
              notes: "Keperluan mendadak",
              createdAt: "2026-09-01T10:00:00.000Z",
            }
          ],
          total: 1,
          page: 1,
          limit: 20
        });
      }
      return Promise.resolve({ data: [], total: 0, page: 1, limit: 20 });
    });

    renderSavings();

    // Verify heading rendered
    expect(screen.getByText("Pengelolaan Simpanan Anggota")).toBeDefined();

    // Wait for transaction table data
    await waitFor(() => {
      expect(screen.getByText("Budi Santoso")).toBeDefined();
    });

    // Switch to deposits tab
    const depositsTab = screen.getByText(/Konfirmasi Setoran Masuk/);
    fireEvent.click(depositsTab);

    // Switch to withdrawals tab
    const withdrawalsTab = screen.getByText(/Permohonan Penarikan Sukarela/);
    fireEvent.click(withdrawalsTab);
  });
});
