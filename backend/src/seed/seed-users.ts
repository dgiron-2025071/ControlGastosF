import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import { pool } from "../config/database";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: string;
}

const SEED_USERS: SeedUser[] = [
  { name: "Diego", email: "diego@email.com", password: "Diego123!", role: "ADMIN" },
  { name: "Juan", email: "juan@email.com", password: "Juan123!", role: "USER" },
  { name: "Maria", email: "maria@email.com", password: "Maria123!", role: "USER" },
];

async function seed() {
  console.log("[seed] Starting user seed...");

  for (const seedUser of SEED_USERS) {
    const existing = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [seedUser.email]
    );

    if ((existing.rowCount ?? 0) > 0) {
      console.log(`[seed] User already exists: ${seedUser.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(seedUser.password, 10);

    await pool.query(
      `INSERT INTO users (name, email, password_hash, status, role)
       VALUES ($1, $2, $3, 'ACTIVE', $4)`,
      [seedUser.name, seedUser.email, passwordHash, seedUser.role]
    );

    console.log(`[seed] Created user: ${seedUser.email} (password: ${seedUser.password})`);
  }

  console.log("[seed] Done.");
  await pool.end();
}

seed().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});
