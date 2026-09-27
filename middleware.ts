import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const sessionCookie = "support_reply_assistant_session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.redirect(new URL("/login", request.url));
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = payload.role;
    const path = request.nextUrl.pathname;
    const isSalesAllowed = path === "/" || path.startsWith("/assistant") || path.startsWith("/profile");
    if (role === "sales" && !isSalesAllowed) return NextResponse.redirect(new URL("/assistant", request.url));
    if (role === "technical" && path.startsWith("/settings")) return NextResponse.redirect(new URL("/assistant", request.url));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/", "/assistant/:path*", "/conversations/:path*", "/knowledge-base/:path*", "/unanswered/:path*", "/review/:path*", "/profile/:path*", "/settings/:path*"],
};
