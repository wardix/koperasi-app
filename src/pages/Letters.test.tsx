import { expect, test, describe, afterEach, beforeEach, spyOn } from "bun:test";
import { render, cleanup, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LettersPage from "./Letters";
import * as apiModule from "../services/api";
import * as configModule from "../config";

const mockLettersData = {
  data: [
    {
      id: "letter-123",
      letterNumber: "005/SPP-ANG/IX/2026",
      seqNumber: 5,
      category: "PINJAMAN_ANGGOTA",
      letterDate: "2026-09-08",
      partyName: "Ahmad Wijaya",
      subject: "Perjanjian Pinjaman Multiguna",
      description: "Salah ketik keterangan awal",
      amount: 15000000,
      attachmentUrl: null,
      attachmentName: null,
      status: "AKTIF",
      createdAt: "2026-09-08T08:00:00.000Z",
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  stats: {
    total: 1,
    byCategory: {
      PINJAMAN_ANGGOTA: 1,
    },
  },
};

const mockCategories = [
  { id: "PINJAMAN_ANGGOTA", code: "SPP-ANG", label: "Surat Perjanjian Pinjaman Anggota" },
  { id: "PINJAMAN_MODAL", code: "SPH-MODAL", label: "Surat Perjanjian Pinjaman Modal Masuk" },
];

function renderLetters() {
  return render(
    <MemoryRouter>
      <LettersPage />
    </MemoryRouter>
  );
}

describe("Letters Page", () => {
  let apiGetSpy: ReturnType<typeof spyOn>;
  let apiFetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    apiGetSpy = spyOn(apiModule.api, "get").mockImplementation((url: string) => {
      if (url.includes("/api/letters/categories")) {
        return Promise.resolve(mockCategories);
      }
      if (url.includes("/api/letters/preview-next-number")) {
        return Promise.resolve({ nextSeq: 6, letterNumber: "006/SPP-ANG/IX/2026", categoryCode: "SPP-ANG" });
      }
      if (url.includes("/api/letters")) {
        return Promise.resolve(mockLettersData);
      }
      return Promise.resolve(null);
    });

    apiFetchSpy = spyOn(configModule, "apiFetch").mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === "PUT" && path.includes("/api/v1/letters/letter-123")) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, message: "Data surat berhasil diperbarui." }),
        } as any);
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true }),
      } as any);
    });
  });

  afterEach(() => {
    cleanup();
    apiGetSpy.mockRestore();
    apiFetchSpy.mockRestore();
  });

  test("renders letters table with Edit and Hapus buttons", async () => {
    renderLetters();

    await waitFor(() => {
      expect(screen.getByText("005/SPP-ANG/IX/2026")).toBeTruthy();
      expect(screen.getByText("Ahmad Wijaya")).toBeTruthy();
      expect(screen.getByText("Perjanjian Pinjaman Multiguna")).toBeTruthy();
    });

    // Check Edit and Hapus buttons
    const editBtn = screen.getByRole("button", { name: "Edit" });
    const deleteBtn = screen.getByRole("button", { name: "Hapus" });
    expect(editBtn).toBeTruthy();
    expect(deleteBtn).toBeTruthy();
  });

  test("opens edit modal, displays existing data and locked letter number, and submits update", async () => {
    renderLetters();

    await waitFor(() => {
      expect(screen.getByText("005/SPP-ANG/IX/2026")).toBeTruthy();
    });

    // Click Edit button
    const editBtn = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(editBtn);

    // Verify modal elements
    await waitFor(() => {
      expect(screen.getByText("Edit Data Surat Resmi")).toBeTruthy();
      expect(screen.getByText("Nomor Surat Resmi (Terkunci):")).toBeTruthy();
    });

    // Verify pre-filled inputs
    const partyInput = screen.getByPlaceholderText("Contoh: Budi Santoso / PT Modal Bersama") as HTMLInputElement;
    const subjectInput = screen.getByPlaceholderText("Contoh: Surat Perjanjian Pinjaman Multiguna Anggota") as HTMLInputElement;
    const descInput = screen.getByPlaceholderText("Keterangan jaminan, nomor rekening pencairan, atau klausul penting...") as HTMLTextAreaElement;

    expect(partyInput.value).toBe("Ahmad Wijaya");
    expect(subjectInput.value).toBe("Perjanjian Pinjaman Multiguna");
    expect(descInput.value).toBe("Salah ketik keterangan awal");

    // Correct the typo in description
    fireEvent.change(descInput, { target: { value: "Keterangan yang sudah diperbaiki" } });
    expect(descInput.value).toBe("Keterangan yang sudah diperbaiki");

    // Click submit
    const submitBtn = screen.getByRole("button", { name: "Simpan Perubahan" });
    fireEvent.click(submitBtn);

    // Verify PUT request
    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalled();
    });

    const calls = apiFetchSpy.mock.calls;
    const putCall = calls.find(([url, opts]: [string, any]) => opts?.method === "PUT" && url.includes("letter-123"));
    expect(putCall).toBeTruthy();
    const body = JSON.parse(putCall![1].body);
    expect(body.partyName).toBe("Ahmad Wijaya");
    expect(body.subject).toBe("Perjanjian Pinjaman Multiguna");
    expect(body.description).toBe("Keterangan yang sudah diperbaiki");
    expect(body.amount).toBe(15000000);
  });
});
