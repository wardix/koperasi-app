import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

const GoodComponent = () => <div>All Good</div>;
const BrokenComponent = () => {
  throw new Error("Test Error");
};

describe("ErrorBoundary Component", () => {
  let consoleErrorMock: any;

  beforeAll(() => {
    // Suppress React error logs in console during testing of thrown errors
    consoleErrorMock = console.error;
    console.error = () => {};
  });

  afterAll(() => {
    console.error = consoleErrorMock;
  });

  test("renders children normally when there is no error", () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("All Good")).toBeTruthy();
  });

  test("catches error and renders fallback UI", () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Terjadi Kesalahan")).toBeTruthy();
    expect(
      screen.getByText("Maaf, aplikasi mengalami masalah tak terduga. Silakan muat ulang halaman.")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Muat Ulang" })).toBeTruthy();
  });
});
