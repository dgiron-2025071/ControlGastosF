import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { UserRepository } from "../models/user.repository";
import { toPublicUser } from "../models/user.model";

const rawClientId = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_ID_PLACEHOLDER = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

function isGoogleClientConfigured(clientId: string): boolean {
  return (
    !!clientId &&
    clientId !== GOOGLE_CLIENT_ID_PLACEHOLDER &&
    !clientId.includes("YOUR_GOOGLE_CLIENT_ID")
  );
}

const googleClientId = isGoogleClientConfigured(rawClientId) ? rawClientId : "";
const googleClient = new OAuth2Client(googleClientId);

const userRepository = new UserRepository();

function signToken(user: { id: number; email: string; role: string }): string {
  const secret = process.env.JWT_SECRET as string;
  const expiresIn = process.env.JWT_EXPIRES_IN || "2m";
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn } as jwt.SignOptions
  );
}

export class GoogleAuthService {
  async loginWithGoogle(idToken: string): Promise<{ token: string; user: any }> {
    if (!idToken) {
      throw new GoogleAuthError("ID token de Google es requerido.", 400);
    }

    if (!googleClientId) {
      throw new GoogleAuthError("Google Client ID no configurado en el servidor.", 500);
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });
    } catch (err) {
      throw new GoogleAuthError("Token de Google inválido o expirado.", 401);
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new GoogleAuthError("No se pudo obtener el email de Google.", 401);
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split("@")[0];

    let user = await userRepository.findByEmail(email);

    if (user) {
      if (user.status !== "ACTIVE") {
        throw new GoogleAuthError("La cuenta está desactivada.", 403);
      }
    } else {
      user = await userRepository.create({
        name,
        email,
        passwordHash: "",
        role: "USER",
      });
    }

    const token = signToken(user);

    return { token, user: toPublicUser(user) };
  }
}

export class GoogleAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "GoogleAuthError";
  }
}

export const googleAuthService = new GoogleAuthService();
