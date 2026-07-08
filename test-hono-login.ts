process.env.DATABASE_URL = "postgres://koperasi:koperasi_pass@localhost:5432/koperasi_e2e_test";
process.env.JWT_SECRET = "e2e-secret";

import app from "./server/index";
import db from "./server/db";

async function run() {
  process.env.DATABASE_URL = "postgres://koperasi:koperasi_pass@localhost:5432/koperasi_e2e_test";
  process.env.JWT_SECRET = "e2e-secret";

  console.log("Admins in DB:");
  const admins = await db.query("SELECT * FROM admins").all();
  console.log(admins);

  const req = new Request("http://localhost/api/v1/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "admin@koperasi.com",
      password: "admin123"
    })
  });

  const res = await app.fetch(req);
  console.log("Response status:", res.status);
  console.log("Response body:", await res.json());

  await db.close();
}

await run();
