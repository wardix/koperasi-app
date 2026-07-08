import { execSync } from "child_process";
import { FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  console.log("Global setup: Resetting E2E database...");
  try {
    execSync("bun e2e/reset-db.ts", {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || "postgres://koperasi:koperasi_pass@localhost:5432/koperasi_e2e_test"
      },
      stdio: "inherit"
    });
  } catch (error) {
    console.error("Failed to reset database in global setup:", error);
    throw error;
  }
}

export default globalSetup;
