import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { getEnv } from "@/lib/env";

const cookieName = "support_reply_assistant_password_reset";
export const RESET_TTL_SECONDS = 600;

function signingSecret() { return new TextEncoder().encode(getEnv().AUTH_SECRET); }
export function createOtp() { return String(randomInt(0, 1_000_000)).padStart(6, "0"); }
export function otpHash(requestId: string, otp: string) { return createHmac("sha256", getEnv().AUTH_SECRET).update(`${requestId}:${otp}`).digest("base64url"); }
export function otpMatches(requestId: string, otp: string, hash: string) {
  const received = Buffer.from(otpHash(requestId, otp)); const expected = Buffer.from(hash);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
export async function setPasswordResetChallenge(requestId: string) { (await cookies()).set(cookieName, await new SignJWT({ requestId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${RESET_TTL_SECONDS}s`).sign(signingSecret()), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: RESET_TTL_SECONDS, path: "/" }); }
export async function getPasswordResetChallenge() { const token = (await cookies()).get(cookieName)?.value; if (!token) return null; try { const { payload } = await jwtVerify(token, signingSecret()); return typeof payload.requestId === "string" ? payload.requestId : null; } catch { return null; } }
export async function clearPasswordResetChallenge() { (await cookies()).delete(cookieName); }
