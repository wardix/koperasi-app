import { expect, test, describe, afterEach, spyOn } from "bun:test";
import { render, cleanup, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Loans from "./Loans";
import { AuthProvider } from "../contexts/AuthContext";
import * as apiModule from "../services/api";

function renderLoans() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Loans />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Loans Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders Rekening Tujuan column and displays member bank details", async () => {
    spyOn(apiModule.api, "get").mockImplementation((url: string) => {
      if (url.includes('/api/loans')) {
        return Promise.resolve({
          data: [
            {
              id: "loan-1",
              memberId: "m-1",
              name: "Budi Santoso",
              amount: 5000000,
              tenor: 12,
              purpose: "Biaya pendidikan",
              status: "Menunggu",
              destinationBank: "Bank Mandiri",
              destinationAccount: "1060012345678",
              destinationName: "Budi Santoso",
              createdAt: "2026-09-01T10:00:00.000Z",
            },
            {
              id: "loan-2",
              memberId: "m-2",
              name: "Siti Rahma",
              amount: 3000000,
              tenor: 6,
              purpose: "Renovasi rumah",
              status: "Disetujui",
              destinationBank: null,
              destinationAccount: null,
              destinationName: null,
              createdAt: "2026-09-01T10:00:00.000Z",
            }
          ],
          total: 2,
          page: 1,
          limit: 20
        });
      }
      return Promise.resolve({ data: [], total: 0, page: 1, limit: 20 });
    });

    renderLoans();

    // Wait for table to load and verify Rekening Tujuan column header is present
    await waitFor(() => {
      expect(screen.getByText("Rekening Tujuan")).toBeDefined();
      expect(screen.getByText("Bank Mandiri — 1060012345678")).toBeDefined();
      expect(screen.getByText("a.n. Budi Santoso")).toBeDefined();
    });
  });
});
