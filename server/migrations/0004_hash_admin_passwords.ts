import type { Migration } from "./types";

/** One-time data fix: hash plaintext admin passwords with Bun argon2id. */
export function createHashAdminPasswordsMigration(db: {
  query: (q: string) => {
    all: (...args: unknown[]) => Promise<unknown[]>;
  };
  prepare: (q: string) => { run: (...args: unknown[]) => Promise<void> };
}): Migration {
  return {
    name: "0004_hash_admin_passwords",
    async up() {
      const admins = (await db.query("SELECT email, password FROM admins").all()) as {
        email: string;
        password: string;
      }[];
      const updateAdmin = db.prepare("UPDATE admins SET password = ? WHERE email = ?");
      for (const admin of admins) {
        if (!admin.password.startsWith("$argon2id$")) {
          const hashed = await Bun.password.hash(admin.password);
          await updateAdmin.run(hashed, admin.email);
        }
      }
    },
  };
}
