import { getSession } from "@/lib/auth/session";
import { hasPermission, type Role } from "@/lib/roles";
import { NextResponse } from "next/server";

export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    code: "UNAUTHORIZED" | "FORBIDDEN",
  ) {
    super(code);
    this.name = "AuthorizationError";
  }
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function authorizationErrorResponse(error: unknown) {
  if (!isAuthorizationError(error)) return null;
  return NextResponse.json(
    {
      error:
        error.status === 401
          ? "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
          : "Bạn không có quyền thực hiện thao tác này.",
      code: error.message,
    },
    { status: error.status },
  );
}

type RouteHandler = (...args: any[]) => Response | Promise<Response>;

/** Maps guard failures at the API boundary without masking unrelated server errors. */
export function withAuthorizationErrors<T extends RouteHandler>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      const response = authorizationErrorResponse(error);
      if (response) return response;
      throw error;
    }
  }) as T;
}

export async function requirePermission(permission: string) {
  const session = await getSession();
  if (!session) throw new AuthorizationError(401, "UNAUTHORIZED");
  if (!hasPermission(session.role, permission)) throw new AuthorizationError(403, "FORBIDDEN");
  return session;
}

export async function requireRole(...allowedRoles: Role[]) {
  const session = await getSession();
  if (!session) throw new AuthorizationError(401, "UNAUTHORIZED");
  if (!allowedRoles.includes(session.role)) throw new AuthorizationError(403, "FORBIDDEN");
  return session;
}
