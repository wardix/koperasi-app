import { expect, test, describe, afterEach } from "bun:test";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { CopyableAccountNumber } from "./CopyableAccountNumber";

describe("CopyableAccountNumber Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders bank name, account number, and account holder", () => {
    render(
      <CopyableAccountNumber
        bankName="Bank Mandiri"
        accountNumber="1060012345678"
        accountHolder="Budi Santoso"
      />
    );

    expect(screen.getByText("Bank Mandiri — 1060012345678")).toBeDefined();
    expect(screen.getByText("a.n. Budi Santoso")).toBeDefined();
  });

  test("copies account number to clipboard on click", async () => {
    let copiedText = "";
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          copiedText = text;
        },
      },
      configurable: true,
      writable: true,
    });

    render(
      <CopyableAccountNumber
        bankName="Bank Mandiri"
        accountNumber="1060012345678"
        accountHolder="Budi Santoso"
      />
    );

    const button = screen.getByLabelText("Salin nomor rekening");
    fireEvent.click(button);

    expect(copiedText).toBe("1060012345678");
  });

  test("renders dash when no bank or account number", () => {
    render(<CopyableAccountNumber />);
    expect(screen.getByText("-")).toBeDefined();
  });
});
