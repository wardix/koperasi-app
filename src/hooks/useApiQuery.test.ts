import { expect, test, describe, spyOn, afterEach } from "bun:test";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { useApiQuery } from "./useApiQuery";
import { api } from "../services/api";

describe("useApiQuery", () => {
  let getSpy: any;

  afterEach(() => {
    cleanup();
    getSpy?.mockRestore?.();
  });

  test("should fetch data successfully", async () => {
    const mockData = { id: 1, name: "Test" };
    getSpy = spyOn(api, "get").mockResolvedValue(mockData);

    const { result } = renderHook(() => useApiQuery("/test"));

    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  test("should handle error", async () => {
    getSpy = spyOn(api, "get").mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useApiQuery("/test"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Server error");
    expect(result.current.data).toBeNull();
  });
});
