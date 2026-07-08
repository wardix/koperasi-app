import { expect, test, describe, mock } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import Login from "./Login";
import * as config from "./config";

describe("Login Component", () => {
  test("renders login form", () => {
    render(<Login onLoginSuccess={() => {}} />);
    expect(screen.getByText("Selamat Datang")).toBeTruthy();
    expect(screen.getByText("Masuk ke Sistem Informasi Koperasi")).toBeTruthy();
  });

  test("shows error when empty submission", async () => {
    render(<Login onLoginSuccess={() => {}} />);
    const loginButton = screen.getAllByText("Masuk")[0];
    fireEvent.click(loginButton);
    expect(screen.getByText("Kata sandi salah. Coba lagi.")).toBeTruthy();
  });
});
