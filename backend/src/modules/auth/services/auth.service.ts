import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRepository } from "../models/user.repository";
import { toPublicUser, PublicUser } from "../models/user.model";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

const SALT_ROUNDS = 10;

export class AuthService {
  private userRepository = new UserRepository();

  async register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<PublicUser> {
    const { name, email, password } = input;

    if (!name?.trim() || !email?.trim() || !password) {
      throw new AuthError("Name, email and password are required", 400);
    }

    if (password.length < 6) {
      throw new AuthError("Password must be at least 6 characters long", 400);
    }

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new AuthError("A user with this email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await this.userRepository.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: "USER",
    });

    return toPublicUser(user);
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ token: string; user: PublicUser }> {
    const { email, password } = input;

    if (!email?.trim() || !password) {
      throw new AuthError("Email and password are required", 400);
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AuthError("Invalid credentials", 401);
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new AuthError("Invalid credentials", 401);
    }

    if (user.status !== "ACTIVE") {
      throw new AuthError("User account is not active", 403);
    }

    const token = this.signToken(user);

    return { token, user: toPublicUser(user) };
  }

  /**
   * Renueva el JWT mientras el usuario sigue activo: la expiración de la
   * sesión se mide por inactividad, no desde el momento del login.
   */
  async refresh(userId: number): Promise<{ token: string; user: PublicUser }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AuthError("User not found", 401);
    }

    if (user.status !== "ACTIVE") {
      throw new AuthError("User account is not active", 403);
    }

    const token = this.signToken(user);

    return { token, user: toPublicUser(user) };
  }

  async getById(id: number): Promise<PublicUser> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new AuthError("User not found", 404);
    }
    return toPublicUser(user);
  }

  private signToken(user: { id: number; email: string; role: string }): string {
    const secret = process.env.JWT_SECRET as string;
    const expiresIn = process.env.JWT_EXPIRES_IN || "2m";

    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn } as jwt.SignOptions
    );
  }
}
