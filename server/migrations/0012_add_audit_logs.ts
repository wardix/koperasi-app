import type { Migration } from "./types";

/**
 * Create audit_logs table for tracking sensitive admin operations.
 * Records actor, action, entity, before/after state snapshots, IP, and timestamp.
 */
export function createAddAuditLogsMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0012_add_audit_logs",
    async up() {
      // Create audit_logs table
      await db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor TEXT NOT NULL,
          action TEXT NOT NULL,
          entity TEXT NOT NULL,
          entity_id TEXT,
          before JSONB,
          after JSONB,
          ip TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for common query patterns
      await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id)`);
    },
  };
}
