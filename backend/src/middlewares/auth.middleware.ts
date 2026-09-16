import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  userId?: number;
  userEmail?: string;
  userRole?: string;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const secret = process.env.JWT_SECRET as string;
    const payload = jwt.verify(token, secret) as unknown as {
      sub: number;
      email: string;
      role: string;
    };

    req.userId = payload.sub;
    req.userEmail = payload.email;
    req.userRole = payload.role;

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
