import type { Migration } from "./types";

/**
 * Migration 0038: Add user_feedbacks table.
 * Stores user feedbacks, bug reports, and feature requests along with
 * optional screenshot URL, page route, browser metadata, and status.
 */
export function createAddUserFeedbacksMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0038_add_user_feedbacks",
    async up() {
      await db.run(`
        CREATE TABLE IF NOT EXISTS user_feedbacks (
          id TEXT PRIMARY KEY,
          type VARCHAR(20) NOT NULL,
          title TEXT,
          description TEXT NOT NULL,
          screenshot_url TEXT,
          page_url TEXT,
          user_agent TEXT,
          screen_resolution VARCHAR(50),
          user_id TEXT,
          user_name TEXT,
          user_email TEXT,
          user_role VARCHAR(50),
          status VARCHAR(20) NOT NULL DEFAULT 'open',
          admin_notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);

      await db.run(`CREATE INDEX IF NOT EXISTS idx_user_feedbacks_status ON user_feedbacks(status)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_user_feedbacks_type ON user_feedbacks(type)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_user_feedbacks_created_at ON user_feedbacks(created_at DESC)`);
    },
  };
}
