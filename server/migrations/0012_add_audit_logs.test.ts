import { expect, test, describe, beforeAll } from "bun:test";
import db from "../db";

describe("audit_logs migration", () => {
  beforeAll(async () => {
    // Ensure the audit_logs table exists (migration should have run)
    await db.query("SELECT 1 FROM audit_logs LIMIT 1").all();
  });

  test("audit_logs table exists and is queryable", async () => {
    // Smoke-check: simple select must not throw
    const rows = await db.query("SELECT id, actor, action, entity FROM audit_logs LIMIT 1").all();
    expect(Array.isArray(rows)).toBe(true);
  });

  test("audit_logs has correct columns", async () => {
    const cols = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'audit_logs'
      ORDER BY ordinal_position
    `).all() as any[];

    const colNames = cols.map(c => c.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('actor');
    expect(colNames).toContain('action');
    expect(colNames).toContain('entity');
    expect(colNames).toContain('entity_id');
    expect(colNames).toContain('before');
    expect(colNames).toContain('after');
    expect(colNames).toContain('ip');
    expect(colNames).toContain('created_at');

    // Verify column types
    const actorCol = cols.find(c => c.column_name === 'actor');
    expect(actorCol?.data_type).toBe('text');

    const actionCol = cols.find(c => c.column_name === 'action');
    expect(actionCol?.data_type).toBe('text');

    const beforeCol = cols.find(c => c.column_name === 'before');
    // JSONB is stored as 'jsonb' in PostgreSQL
    expect(beforeCol?.data_type).toMatch(/json/);
  });

  test("indexes are created on audit_logs", async () => {
    const indexes = await db.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'audit_logs'
      ORDER BY indexname
    `).all() as any[];

    const indexNames = indexes.map(i => i.indexname);
    expect(indexNames).toContain('idx_audit_logs_created_at');
    expect(indexNames).toContain('idx_audit_logs_actor');
    expect(indexNames).toContain('idx_audit_logs_action');
    expect(indexNames).toContain('idx_audit_logs_entity');
  });

  test("can insert and query audit records", async () => {
    const testId = `test_${Date.now()}`;
    const testActor = 'test@example.com';
    const testAction = 'update_admin';
    const testEntity = 'admins';
    const testBefore = { role: 'viewer' };
    const testAfter = { role: 'admin' };

    // Insert a test record using prepared statement with proper parameter binding
    const insertStmt = await db.prepare(
      `INSERT INTO audit_logs (id, actor, action, entity, entity_id, before, after, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
    );
    await insertStmt.run(testId, testActor, testAction, testEntity, 'admin-123', JSON.stringify(testBefore), JSON.stringify(testAfter), '127.0.0.1');

    // Query it back using prepared statement
    const queryStmt = db.query(`SELECT * FROM audit_logs WHERE id = $1`);
    const rows = await queryStmt.all(testId) as any[];

    expect(rows.length).toBe(1);
    expect(rows[0].actor).toBe(testActor);
    expect(rows[0].action).toBe(testAction);
    expect(rows[0].entity).toBe(testEntity);

    // Verify JSONB fields are stored and can be parsed back
    const beforeParsed = typeof rows[0].before === 'string' ? JSON.parse(rows[0].before) : rows[0].before;
    expect(beforeParsed.role).toBe('viewer');

    const afterParsed = typeof rows[0].after === 'string' ? JSON.parse(rows[0].after) : rows[0].after;
    expect(afterParsed.role).toBe('admin');

    // Clean up test record using prepared statement
    const deleteStmt = await db.prepare(`DELETE FROM audit_logs WHERE id = $1`);
    await deleteStmt.run(testId);
  });

  test("audit log filtering works", async () => {
    const testId = `filter_test_${Date.now()}`;
    const testActor1 = 'actor1@example.com';
    const testActor2 = 'actor2@example.com';
    const testAction = 'update_settings';

    // Insert two records with different actors using prepared statements
    const insertStmt1 = await db.prepare(`INSERT INTO audit_logs (id, actor, action, entity) VALUES ($1, $2, $3, $4)`);
    await insertStmt1.run(testId + '_1', testActor1, testAction, 'settings');

    const insertStmt2 = await db.prepare(`INSERT INTO audit_logs (id, actor, action, entity) VALUES ($1, $2, $3, $4)`);
    await insertStmt2.run(testId + '_2', testActor2, testAction, 'settings');

    // Query with filter on actor1 using prepared statement
    const queryStmt = db.query(`SELECT * FROM audit_logs WHERE actor = $1 AND action = $2 ORDER BY id`);
    const rows = await queryStmt.all(testActor1, testAction) as any[];

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].actor).toBe(testActor1);

    // Clean up using prepared statement with LIKE pattern
    const deleteStmt = await db.prepare(`DELETE FROM audit_logs WHERE id LIKE $1`);
    await deleteStmt.run(`${testId}%`);
  });
});
