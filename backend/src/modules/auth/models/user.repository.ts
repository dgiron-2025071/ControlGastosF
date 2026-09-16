import { pool } from "../../../config/database";
import { User } from "./user.model";

function mapRow(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    status: row.status,
    role: row.role,
    createdAt: row.created_at,
  };
}

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query(
      "SELECT id, name, email, password_hash, status, role, created_at FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapRow(result.rows[0]);
  }

  async findById(id: number): Promise<User | null> {
    const result = await pool.query(
      "SELECT id, name, email, password_hash, status, role, created_at FROM users WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapRow(result.rows[0]);
  }

  async create(input: {
    name: string;
    email: string;
    passwordHash: string;
    role?: string;
  }): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, status, role)
       VALUES ($1, $2, $3, 'ACTIVE', $4)
       RETURNING id, name, email, password_hash, status, role, created_at`,
      [input.name, input.email, input.passwordHash, input.role ?? "USER"]
    );

    return mapRow(result.rows[0]);
  }
}
