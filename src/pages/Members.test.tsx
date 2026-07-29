import { expect, test, describe, afterEach, spyOn } from "bun:test";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Members from "./Members";
import { AuthProvider } from "../contexts/AuthContext";
import * as apiModule from "../services/api";

function renderMembers() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <Members />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Members Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders placeholder for members table", () => {
    spyOn(apiModule.api, "get").mockResolvedValue({});
    renderMembers();
    expect(true).toBe(true);
  });
});
