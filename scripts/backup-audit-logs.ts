import { SQL } from "bun";
import * as fs from "node:fs";
import * as path from "node:path";

async function backupAuditLogs(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL ||
    "postgres://koperasi:koperasi_pass@localhost:5432/koperasi_test";

  console.log("Menghubungkan ke database...");
  const sql = new SQL(databaseUrl);

  try {
    const rows = await sql`
      SELECT id, actor, action, entity, entity_id, before, after, ip, created_at
      FROM audit_logs
      ORDER BY created_at ASC, id ASC;
    `;

    const backupsDir = path.resolve(import.meta.dir, "../backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `audit_logs_${timestamp}.json`;
    const targetPath = path.join(backupsDir, filename);

    // Format rows with ISO string for timestamps
    const formattedRows = rows.map((r: any) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      entity: r.entity,
      entity_id: r.entity_id,
      before: r.before,
      after: r.after,
      ip: r.ip,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    }));

    fs.writeFileSync(targetPath, JSON.stringify(formattedRows, null, 2), "utf-8");

    const stat = fs.statSync(targetPath);
    console.log(`Backup berhasil:`);
    console.log(`- File: ${targetPath}`);
    console.log(`- Total Baris: ${rows.length}`);
    console.log(`- Ukuran File: ${(stat.size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error("Gagal melakukan backup audit_logs:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

backupAuditLogs();
