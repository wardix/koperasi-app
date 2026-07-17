import { expect, test, describe } from "bun:test";
import { checkOpenApiSpec } from "./openapi-check";
import { OPENAPI_ROUTE_MANIFEST } from "../server/openapi/routeManifest";

describe("openapi-check", () => {
  test("openapi.yaml covers the route manifest", async () => {
    const result = await checkOpenApiSpec();
    if (!result.ok) {
      console.error(result.errors.join("\n"));
    }
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("manifest includes all required issue #207 resource groups", () => {
    const tags = new Set(OPENAPI_ROUTE_MANIFEST.map((entry) => entry.tag));
    for (const required of ["auth", "members", "loans", "savings", "shu", "npl", "cashflow", "expenses", "reports"]) {
      expect(tags.has(required)).toBe(true);
    }
  });
});