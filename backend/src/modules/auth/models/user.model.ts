export type UserStatus = "ACTIVE" | "INACTIVE";
export type UserRole = "USER" | "ADMIN" | "MANAGER" | "CONTADOR";

export interface User {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  role: UserRole;
  createdAt: Date;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  status: UserStatus;
  role: UserRole;
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt,
  };
}
