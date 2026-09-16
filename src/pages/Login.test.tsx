import { expect, test, describe, spyOn, afterEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Login from "./Login";
import { AuthProvider } from "../contexts/AuthContext";
import * as apiModule from "../services/api";

function renderLogin() {
  render(
    <AuthProvider>
      <Login />
    </AuthProvider>
  );
}

describe("Login Component", () => {
  let getSpy: any;

  afterEach(() => {
    cleanup();
    getSpy?.mockRestore?.();
  });

  test("renders login form", () => {
    getSpy = spyOn(apiModule.api, "get").mockResolvedValue({});
    renderLogin();
    expect(screen.getByText("Selamat Datang")).toBeTruthy();
    expect(screen.getByText("Masuk ke Sistem Informasi Koperasi")).toBeTruthy();
  });

  test("shows error when empty submission", async () => {
    getSpy = spyOn(apiModule.api, "get").mockResolvedValue({});
    renderLogin();
    const loginButton = screen.getByText("Masuk");
    fireEvent.click(loginButton);
    expect(screen.getByText("Kata sandi salah. Coba lagi.")).toBeTruthy();
  });
});
