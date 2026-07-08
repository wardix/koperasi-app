import { expect, test, describe, afterEach, spyOn } from "bun:test";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Shell from "./Shell";
import { AuthProvider } from "../contexts/AuthContext";
import * as apiModule from "../services/api";

function renderShell(initialEntries = ["/"]) {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Shell Component", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("shows Hak Akses menu for admin role", async () => {
    localStorage.setItem("token", "test-token");
    localStorage.setItem("role", "admin");
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
});
