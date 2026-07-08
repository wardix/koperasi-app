import { expect, test, describe, mock, beforeEach } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { useApiQuery } from "./useApiQuery";
import { api } from "../services/api";

describe("useApiQuery", () => {
  beforeEach(() => {
    mock.restore();
  });

  test("should fetch data successfully", async () => {
    const mockData = { id: 1, name: "Test" };
    mock.module("../services/api", () => ({
      api: {
        get: async () => mockData
      }
    }));

    const { result } = renderHook(() => useApiQuery("/test"));

    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  test("should handle error", async () => {
    mock.module("../services/api", () => ({
      api: {
        get: async () => {
          throw new Error("Server error");
        }
      }
    }));

    const { result } = renderHook(() => useApiQuery("/test"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Server error");
    expect(result.current.data).toBeNull();
  });
});
