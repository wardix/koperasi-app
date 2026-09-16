import { describe, it, expect, mock, afterEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FeedbackDialog } from "./FeedbackDialog";

describe("FeedbackDialog Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not render when isOpen is false", () => {
    const onClose = mock(() => {});
    render(<FeedbackDialog isOpen={false} onClose={onClose} />);
    expect(screen.queryByText("Kirim Masukan & Laporan")).toBeNull();
  });

  it("renders form elements when isOpen is true", () => {
    const onClose = mock(() => {});
    render(<FeedbackDialog isOpen={true} onClose={onClose} />);

    expect(screen.getByText("Kirim Masukan & Laporan")).toBeDefined();
    expect(screen.getByText("Kendala / Bug")).toBeDefined();
    expect(screen.getByText("Usulan Fitur")).toBeDefined();
    expect(screen.getByText("Masukan Umum")).toBeDefined();
    expect(screen.getByRole("button", { name: "Kirim Masukan" })).toBeDefined();
  });

  it("switches feedback category when category button is clicked", () => {
    const onClose = mock(() => {});
    render(<FeedbackDialog isOpen={true} onClose={onClose} />);

    const featureBtn = screen.getByText("Usulan Fitur").closest("button");
    if (featureBtn) {
      fireEvent.click(featureBtn);
    }

    const descInput = screen.getByLabelText(/Deskripsi/i) as HTMLTextAreaElement;
    expect(descInput.placeholder).toContain("ide fitur baru");
  });

  it("displays screenshot preview when initialScreenshot is passed", () => {
    const onClose = mock(() => {});
    const sampleScreenshot = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    render(
      <FeedbackDialog
        isOpen={true}
        onClose={onClose}
        initialScreenshot={sampleScreenshot}
      />
    );

    expect(screen.getByText("Tangkapan Layar Halaman")).toBeDefined();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    // Can uncheck screenshot
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it("toggles technical metadata details", () => {
    const onClose = mock(() => {});
    render(<FeedbackDialog isOpen={true} onClose={onClose} />);

    const toggleBtn = screen.getByText(/Info Teknis Otomatis/i);
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/User Agent:/i)).toBeDefined();
    expect(screen.getByText(/Resolusi:/i)).toBeDefined();
  });

  it("calls onClose when Batal is clicked", () => {
    const onClose = mock(() => {});
    render(<FeedbackDialog isOpen={true} onClose={onClose} />);

    const cancelBtn = screen.getByRole("button", { name: "Batal" });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
