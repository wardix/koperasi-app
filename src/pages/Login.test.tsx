import { expect, test, describe } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import Login from "./Login";
import { AuthProvider } from "../contexts/AuthContext";
import * as apiModule from "../services/api";
import { spyOn } from "bun:test";

function renderLogin() {
  render(
    <AuthProvider>
      <Login />
    </AuthProvider>
  );
}

describe("Login Component", () => {
  test("renders login form", () => {
    spyOn(apiModule.api, "get").mockResolvedValue({});
    renderLogin();
    expect(screen.getByText("Selamat Datang")).toBeTruthy();
    expect(screen.getByText("Masuk ke Sistem Informasi Koperasi")).toBeTruthy();
  });

  test("shows error when empty submission", async () => {
    spyOn(apiModule.api, "get").mockResolvedValue({});
    renderLogin();
    const loginButton = screen.getAllByText("Masuk")[0];
    fireEvent.click(loginButton);
    expect(screen.getByText("Kata sandi salah. Coba lagi.")).toBeTruthy();
  });
});
