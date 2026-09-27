import { getSession } from "@/lib/auth/session";
import { hasPermission, type Role } from "@/lib/roles";

export async function requirePermission(permission: string) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, permission)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function requireRole(...allowedRoles: Role[]) {
  const session = await getSession();
  if (!session || !allowedRoles.includes(session.role)) throw new Error("FORBIDDEN");
  return session;
}
