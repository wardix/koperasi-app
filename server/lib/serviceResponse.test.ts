import { expect, test, describe } from "bun:test";
import type { Context } from "hono";
import { Hono } from "hono";
import { mapServiceError, requireRouteParam } from "./serviceResponse";
import { ServiceError } from "../services/errors";

function mockContext(paramValue: string | undefined): Context {
  return {
    req: { param: () => paramValue },
    json: (body: unknown, status?: number) =>
      new Response(JSON.stringify(body), {
        status: status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
  } as unknown as Context;
}

describe("serviceResponse", () => {
  test("requireRouteParam throws ServiceError when param is missing", () => {
    expect(() => requireRouteParam(mockContext(undefined), "id")).toThrow(ServiceError);
  });

  test("requireRouteParam returns param value", () => {
    expect(requireRouteParam(mockContext("abc-123"), "id")).toBe("abc-123");
  });

  test("mapServiceError maps ServiceError to JSON response", async () => {
    const app = new Hono();
    app.get("/error", (c) => {
      const response = mapServiceError(c, new ServiceError("Not found", 404));
      return response ?? c.json({ success: true });
    });

    const res = await app.request("/error");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ success: false, message: "Not found" });
  });
});