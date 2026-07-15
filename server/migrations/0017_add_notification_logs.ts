import type { Migration } from "./types";

export function createMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0017_add_notification_logs",
    async up() {
      await db.run(`
        CREATE TABLE IF NOT EXISTS notification_logs (
          id TEXT PRIMARY KEY,
          memberId TEXT NOT NULL,
          loanId TEXT,
          scheduleId TEXT,
          type TEXT NOT NULL, -- e.g. 'due_in_3_days', 'due_today', 'overdue'
          channel TEXT NOT NULL, -- 'email' or 'whatsapp'
          status TEXT NOT NULL, -- 'sent', 'failed'
          errorMessage TEXT,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY(memberId) REFERENCES members(id)
        )
      `);

      // Index to help with deduplication (scheduleId + type)
      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_notification_logs_schedule_type 
        ON notification_logs(scheduleId, type)
      `);
    },
  };
}
