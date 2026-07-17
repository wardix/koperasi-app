import { expect, test, describe } from "bun:test";
import { hasPermission, ROLE_PERMISSIONS, type Permission } from "./permissions";

describe("permissions", () => {
  test("viewer can read basic modules but not financial analytics", () => {
    expect(hasPermission("viewer", "read:stats")).toBe(true);
    expect(hasPermission("viewer", "read:members")).toBe(true);
    expect(hasPermission("viewer", "read:cashflow")).toBe(false);
    expect(hasPermission("viewer", "read:npl")).toBe(false);
    expect(hasPermission("viewer", "read:reports")).toBe(false);
    expect(hasPermission("viewer", "export:reports")).toBe(false);
  });

  test("admin receives granular financial read permissions", () => {
    expect(hasPermission("admin", "read:cashflow")).toBe(true);
    expect(hasPermission("admin", "read:expenses")).toBe(true);
    expect(hasPermission("admin", "create:expenses")).toBe(true);
    expect(hasPermission("admin", "delete:expenses")).toBe(false);
    expect(hasPermission("admin", "read:npl")).toBe(true);
    expect(hasPermission("admin", "read:reports")).toBe(true);
    expect(hasPermission("admin", "export:reports")).toBe(true);
    expect(hasPermission("admin", "delete:members")).toBe(false);
    expect(hasPermission("admin", "manage:users")).toBe(false);
  });

  test("superadmin inherits all defined permissions", () => {
    const allPermissions = new Set<Permission>();
    for (const rolePerms of Object.values(ROLE_PERMISSIONS)) {
      for (const perm of rolePerms) {
        allPermissions.add(perm);
      }
    }

    for (const permission of allPermissions) {
      expect(hasPermission("superadmin", permission)).toBe(true);
    }
  });
});