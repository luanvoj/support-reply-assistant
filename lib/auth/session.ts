import { SignJWT, jwtVerify } from "jose";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { query } from "@/lib/db";
import type { Role } from "@/lib/roles";

const SESSION_COOKIE = "support_reply_assistant_session";
const MFA_PENDING_COOKIE = "support_reply_assistant_mfa_pending";
const secret = new TextEncoder().encode(env.AUTH_SECRET);

export type SessionPayload = {
  userId: string;
  email: string;
  role: Role;
  sessionVersion: number;
};

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}

export async function createMfaPendingSession(payload: SessionPayload) {
  const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(secret);
  (await cookies()).set(MFA_PENDING_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 5, path: "/" });
}

export async function getMfaPendingSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(MFA_PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.userId !== "string" || typeof payload.email !== "string" || typeof payload.sessionVersion !== "number" || (payload.role !== "sales" && payload.role !== "technical" && payload.role !== "admin")) return null;
    return { userId: payload.userId, email: payload.email, role: payload.role, sessionVersion: payload.sessionVersion };
  } catch { return null; }
}

export async function clearMfaPendingSession() { (await cookies()).delete(MFA_PENDING_COOKIE); }

export async function getMfaPendingSessionFingerprint() {
  const token = (await cookies()).get(MFA_PENDING_COOKIE)?.value;
  return token ? createHmac("sha256", env.AUTH_SECRET).update(token).digest("base64url") : null;
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.sessionVersion !== "number" ||
      (payload.role !== "sales" && payload.role !== "technical" && payload.role !== "admin")
    ) {
      return null;
    }
    const current = await query<{ email: string; role: Role; status: string; session_version: number }>(
      `SELECT u.email, r.code AS role, u.status, u.session_version
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 LIMIT 1`,
      [payload.userId],
    );
    const user = current.rows[0];
    if (!user || user.status !== "active" || user.session_version !== payload.sessionVersion) return null;
    return { userId: payload.userId, email: user.email, role: user.role, sessionVersion: user.session_version };
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
