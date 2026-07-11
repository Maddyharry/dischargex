import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isChatEnabled } from "@/lib/feature-flags";

const CHAT_BLOCKED_PATH_PREFIXES = [
  "/chat",
  "/admin/chat",
  "/admin/opd-assist-lab",
  "/admin/opd-assist-logs",
  "/api/specialist-chat",
  "/api/chat-threads",
  "/api/chat-style",
  "/api/opd-assist",
  "/api/admin/chat",
  "/api/admin/chatbot-insights",
  "/api/admin/chatbot-reply",
  "/api/admin/chatbot-settings",
];

function isChatBlockedPath(pathname: string) {
  return CHAT_BLOCKED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const middleware = withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;

    if (!isChatEnabled() && isChatBlockedPath(pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: "Feature disabled" }, { status: 404 });
      }
      return NextResponse.redirect(new URL("/app", req.url));
    }

    if (pathname.startsWith("/admin")) {
      const role = (req.nextauth.token as { role?: string } | null)?.role;
      if (role !== "admin") {
        const loginUrl = new URL("/login/admin", req.url);
        loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(loginUrl);
      }
    }
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // ปิด chat: ปล่อยผ่านมาให้ middleware() ด้านบนจัดการ 404/redirect เอง
        // ไม่ต้อง gate ด้วย login เพราะ route พวกนี้ควรหายไปเฉยๆ ไม่ใช่เด้งไปหน้า login
        if (!isChatEnabled() && isChatBlockedPath(pathname)) {
          return true;
        }

        /** สรุปชาร์จแบบสาธิต (/app/guest) — ไม่ต้องล็อกอิน (tutorial + mock API) */
        if (pathname === "/app/guest" || pathname.startsWith("/app/guest/")) {
          return true;
        }

        if (!token) return false;

        if (pathname.startsWith("/admin")) return Boolean(token);

        // สำหรับ /app ให้แค่ต้องล็อกอินก็พอ
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    "/app/:path*",
    "/admin",
    "/admin/:path*",
    "/chat",
    "/chat/:path*",
    "/api/specialist-chat/:path*",
    "/api/chat-threads/:path*",
    "/api/chat-style/:path*",
    "/api/opd-assist/:path*",
    "/api/admin/chat/:path*",
    "/api/admin/chatbot-insights/:path*",
    "/api/admin/chatbot-reply/:path*",
    "/api/admin/chatbot-settings/:path*",
  ],
};
