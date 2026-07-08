import { expect, test, describe, afterEach, spyOn } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Shell from "./Shell";
import * as config from "../config";

describe("Shell Component", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("shows Hak Akses menu for admin role", () => {
    localStorage.setItem("role", "admin");
    spyOn(config, "apiFetch").mockResolvedValue({ ok: true, json: async () => ({}) } as any);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Shell onLogout={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByText("Hak Akses")).toBeTruthy();
    expect(screen.getAllByText("Dasbor").length).toBeGreaterThan(0);
  });

  test("hides Hak Akses menu for viewer role", () => {
    localStorage.setItem("role", "viewer");
    spyOn(config, "apiFetch").mockResolvedValue({ ok: true, json: async () => ({}) } as any);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Shell onLogout={() => {}} />
      </MemoryRouter>
    );
    expect(screen.queryByText("Hak Akses")).toBeNull();
    expect(screen.getAllByText("Dasbor").length).toBeGreaterThan(0);
  });
});
